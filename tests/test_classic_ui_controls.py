"""Build Classic control selectors from real model capabilities without loading weights."""
from __future__ import annotations

import ast
from pathlib import Path
import runpy
from types import SimpleNamespace
import unittest


ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "app" / "wgp.py"
TREE = ast.parse(ENGINE.read_text(encoding="utf-8"), filename=str(ENGINE))


def _function(name: str) -> ast.FunctionDef:
    return next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == name)


def _execute(nodes: list[ast.stmt], namespace: dict) -> None:
    module = ast.Module(body=nodes, type_ignores=[])
    ast.fix_missing_locations(module)
    exec(compile(module, str(ENGINE), "exec"), namespace)


def _build_selectors(model_def: dict, image_mode: int = 0) -> tuple[dict, bool]:
    """Execute the actual UI setup and selector branches, with inert Gradio components."""
    ui = _function("generate_video_tab")
    column = next(node for node in ast.walk(ui) if isinstance(node, ast.With)
                  and any(isinstance(item.optional_vars, ast.Name)
                          and item.optional_vars.id == "video_prompt_column" for item in node.items))
    siblings = next(value for node in ast.walk(ui) for _, value in ast.iter_fields(node)
                    if isinstance(value, list) and column in value)
    column_index = siblings.index(column)
    start = next(i for i, node in enumerate(siblings[:column_index])
                 if isinstance(node, ast.Assign) and any(
                     isinstance(target, ast.Name) and target.id == "any_control_video"
                     for target in node.targets))
    row = next(node for node in column.body if isinstance(node, ast.With)
               and any(isinstance(item.optional_vars, ast.Name)
                       and item.optional_vars.id == "guide_selection_row" for item in node.items))
    option_names = {"guide_preprocessing", "guide_custom_choices", "mask_preprocessing"}
    selectors = [node for node in row.body if isinstance(node, ast.If)
                 and isinstance(node.test, ast.Compare)
                 and isinstance(node.test.left, ast.Name) and node.test.left.id in option_names]

    def dropdown(*args, **kwargs):
        if args:
            kwargs["choices"] = args[0]
        return kwargs

    namespace = {
        "model_def": model_def, "image_mode_value": image_mode,
        "image_outputs": image_mode > 0, "video_prompt_type_value": "",
        "dropdown_selectable": True, "any_reference_image": False,
        "all_guide_processes": "UVPDESLCM", "gr": SimpleNamespace(Dropdown=dropdown),
    }
    _execute([_function("filter_letters"), _function("get_default_value")], namespace)
    _execute(siblings[start:column_index], namespace)
    visible = next(keyword.value for keyword in column.items[0].context_expr.keywords
                   if keyword.arg == "visible")
    column_visible = eval(compile(ast.Expression(visible), str(ENGINE), "eval"), namespace)
    _execute(selectors, namespace)
    return namespace, column_visible


class ClassicUiControlsTests(unittest.TestCase):
    def test_fasth3_disabled_controls_do_not_prevent_ui_construction(self):
        capabilities = runpy.run_path(str(ROOT / "app/models/minimax_h3/fasth3.py"))["fasth3_capabilities"]()
        controls, visible = _build_selectors(capabilities)
        self.assertFalse(visible)
        for name in ("video_prompt_type_video_guide", "video_prompt_type_video_guide_alt", "video_prompt_type_video_mask"):
            self.assertFalse(controls[name]["visible"], name)
        self.assertFalse(controls["any_control_video"])

    def test_absent_and_empty_optional_sections_have_the_same_ui(self):
        absent, _ = _build_selectors({})
        empty, visible = _build_selectors({
            "guide_preprocessing": {}, "guide_custom_choices": {}, "mask_preprocessing": {},
        })
        self.assertFalse(visible)
        for name in ("video_prompt_type_video_guide", "video_prompt_type_video_guide_alt", "video_prompt_type_video_mask"):
            self.assertEqual(absent[name], empty[name])

    def test_valid_control_choices_and_masks_remain_available(self):
        choices = [("No Control Video", ""), ("Use Control Video", "GV")]
        model_def = {
            "guide_custom_choices": {"choices": choices, "letters_filter": "GV", "default": "", "label": "Control Video / Frames"},
            "mask_preprocessing": {"selection": ["", "A", "NA"]},
        }
        for image_mode in (0, 1):
            with self.subTest(image_mode=image_mode):
                controls, visible = _build_selectors(model_def, image_mode)
                self.assertTrue(visible)
                dropdown = controls["video_prompt_type_video_guide_alt"]
                expected = [(label.replace("Video", "Image") if image_mode else label, value) for label, value in choices]
                self.assertEqual(expected, dropdown["choices"])
                self.assertTrue(dropdown["visible"])
                self.assertEqual("", dropdown["value"])
                self.assertEqual(["", "A", "NA"], [value for _, value in controls["video_prompt_type_video_mask"]["choices"]])

    def test_inpainting_keeps_its_synthetic_guide_and_mask_choices(self):
        controls, visible = _build_selectors({}, image_mode=2)
        self.assertTrue(visible)
        self.assertEqual(["V", "VG"], [value for _, value in controls["video_prompt_type_video_guide"]["choices"]])
        self.assertEqual(["A"], [value for _, value in controls["video_prompt_type_video_mask"]["choices"]])

    def test_prompt_updates_accept_disabled_option_overrides(self):
        results = []
        for model_def in ({}, {"guide_preprocessing": {}, "guide_custom_choices": {}, "mask_preprocessing": {}}):
            with self.subTest(model_def=model_def):
                settings = {"video_prompt_type": ""}
                namespace = {
                    "get_current_model_settings": lambda _: settings,
                    "get_state_model_type": lambda _: "test",
                    "get_model_def": lambda _: model_def,
                }
                _execute([_function("add_to_sequence"), _function("update_video_prompt_type")], namespace)
                namespace["update_video_prompt_type"]({}, any_video_guide=True, any_video_mask=True)
                results.append(settings["video_prompt_type"])
        self.assertEqual(results[0], results[1])


if __name__ == "__main__":
    unittest.main()
