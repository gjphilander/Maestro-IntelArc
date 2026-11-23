"""Local M2M100 translation for timed captions."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from threading import Lock

_MODEL_CACHE = Path(__file__).resolve().parents[1] / "ckpts" / "caption_translation"
_TRANSLATION_LOCK = Lock()


class CaptionTranslationError(RuntimeError):
    """The translation model could not load or complete inference."""


@lru_cache(maxsize=1)
def _translation_runtime():
    from ctranslate2 import Translator
    from huggingface_hub import hf_hub_download
    from transformers import M2M100Tokenizer

    # Commit hashes let the Hub client use cached files directly on later exports.
    for filename in ("config.json", "shared_vocabulary.json", "model.bin"):
        model_file = hf_hub_download(
            "gn64/M2M100_418M_CTranslate2", filename,
            revision="18e406c615ef2991fa74d53734bf66b0a6b10cb4", cache_dir=_MODEL_CACHE,
        )
    tokenizer = M2M100Tokenizer.from_pretrained(
        "facebook/m2m100_418M",
        revision="55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636",
        cache_dir=_MODEL_CACHE,
    )
    translator = Translator(str(Path(model_file).parent), device="cpu", compute_type="int8", intra_threads=4)
    return tokenizer, translator


def supported_translation_language(code: str) -> bool:
    from transformers.models.m2m_100.tokenization_m2m_100 import FAIRSEQ_LANGUAGE_CODES

    return code in FAIRSEQ_LANGUAGE_CODES["m2m100"]


def translate_segments(segments: list[dict], source: str, target: str) -> list[dict]:
    """Translate every caption independently and preserve its original timing."""
    if source == target or not segments:
        return segments

    # The tokenizer's source language is mutable and shared between exports.
    with _TRANSLATION_LOCK:
        try:
            tokenizer, translator = _translation_runtime()
            tokenizer.src_lang = source
            target_token = tokenizer.lang_code_to_token[target]
            encoded = tokenizer(
                [segment["text"] for segment in segments], truncation=True, max_length=512,
            ).input_ids
            tokens = [tokenizer.convert_ids_to_tokens(ids) for ids in encoded]
            results = translator.translate_batch(
                tokens, target_prefix=[[target_token] for _ in tokens], batch_type="tokens",
                max_batch_size=256, max_decoding_length=512, beam_size=3,
            )
            translated = [
                tokenizer.decode(
                    tokenizer.convert_tokens_to_ids(result.hypotheses[0][1:]), skip_special_tokens=True,
                ).strip()
                for result in results
            ]
            if not all(translated):
                raise CaptionTranslationError("The model returned an empty caption.")
        except Exception as error:
            raise CaptionTranslationError("Could not translate the captions.") from error

    return [
        {"start": segment["start"], "end": segment["end"], "text": text}
        for segment, text in zip(segments, translated, strict=True)
    ]

