# Maestro 4.1.1 on Intel Arc Pro B70

## Start Maestro

Double-click `start-maestro.bat` in the Maestro folder. On this installation it runs `app/env-xpu/Scripts/python.exe`, checks GPU matrix multiplication and attention, and launches Studio. The default port is 7861. Use the URL printed in the terminal. Keep the terminal open during generation.

The owner confirmed a successful video generation on Windows using the standalone installation. The startup log identified PyTorch 2.11.0+xpu and 31.16 GiB of GPU memory.

## Local tools

Use Video Prompt Chat for Ollama conversations and dictation. **Use in Studio** transfers the reply into the Studio prompt. **Combine Clips** joins gallery videos in selection order. **Compress** produces a smaller H.264 copy. The Editor supports title styling and drag-and-drop transitions. See [Editor transitions](Editor-Transitions.md) and [Editor text overlays](Editor-Text-Overlays.md).

## Moving a working installation

The standalone launcher uses the local XPU runtime whenever its Python executable exists. On the first migrated launch it can copy the previous runtime from the sibling folder named `.Maestro.git`. It does not migrate user media, LoRAs or projects. The active model directory configured on this workstation includes `D:\.MaestroModels\app\ckpts`.

If startup after a folder move reports that Agent Access settings belong to another installation, close Maestro, back up the `app/settings/agent-access` folder by renaming it, then relaunch. Maestro creates a fresh identity. Pair any MCP clients again.

## Retiring v3

Preserve wanted files from the old installation before removing it. Check the contents of `app/outputs`, `app/uploads`, `app/recipes_user`, `app/loras`, and `app/settings`. Keep conflicting versions separately. Preserve the old Git checkout if you need its branch history or uncommitted work. The v4 installation extracted from a ZIP has no Git history of its own. Keep the external model directory on D: in place.
