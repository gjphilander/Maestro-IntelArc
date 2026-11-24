"""Build dialogue and background tracks for an opt-in caption dub.

The worker runs in its own process because eSpeak has process-wide voice state.
"""

from __future__ import annotations

import ctypes
from functools import lru_cache
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Literal

SAMPLE_RATE = 44100
DubbingEngine = Literal["espeak", "omnivoice"]
_APP_DIR = Path(__file__).resolve().parents[1]
_OMNIVOICE_ENV = _APP_DIR / "env-omnivoice"
_OMNIVOICE_MANIFEST = "maestro-voices-v1.json"
_OMNIVOICE_ALIASES = {"ns": "nso"}
_VOICE_ALIASES = {"no": "nb", "ns": "nso", "tl": "fil", "zh": "cmn"}
_SYNCHRONOUS = 2
_DONT_EXIT_ON_INIT_ERROR = 0x8000
_RATE_PARAMETER = 1
_UTF8_TEXT = 1
_POSITION_CHARACTER = 1
_AUDIO_CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)


@lru_cache(maxsize=1)
def _voice_names() -> dict[str, str]:
    from espeakng_loader import get_data_path

    files = (Path(get_data_path()) / "lang").glob("*/*")
    names = {file.name: file.name for file in files if file.is_file() and re.fullmatch(r"[a-z]{2,3}", file.name)}
    for code, alias in _VOICE_ALIASES.items():
        if alias in names:
            names.setdefault(code, alias)
    return names


def dubbing_languages() -> frozenset[str]:
    return frozenset(_voice_names())


def omnivoice_python() -> Path:
    return _OMNIVOICE_ENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def omnivoice_languages() -> frozenset[str]:
    if not omnivoice_python().is_file():
        return frozenset()
    try:
        codes = json.loads((_OMNIVOICE_ENV / _OMNIVOICE_MANIFEST).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return frozenset()
    if not isinstance(codes, list):
        return frozenset()
    return frozenset(code for code in codes if isinstance(code, str) and re.fullmatch(r"[a-z]{2,3}", code))


def _check_omnivoice(device: str) -> None:
    import torch
    from omnivoice import OmniVoice  # noqa: F401
    from omnivoice.utils.lang_map import LANG_IDS
    from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS  # noqa: F401

    if device == "xpu" and not torch.xpu.is_available():
        raise RuntimeError("PyTorch cannot access the Intel Arc GPU for OmniVoice.")
    languages = set(LANG_IDS)
    languages.update(alias for alias, code in _OMNIVOICE_ALIASES.items() if code in LANG_IDS)
    manifest = Path(sys.prefix) / _OMNIVOICE_MANIFEST
    temporary = manifest.with_suffix(".tmp")
    temporary.write_text(json.dumps(sorted(languages)), encoding="utf-8")
    temporary.replace(manifest)


class _Voice:
    def __init__(self, language: str):
        from espeakng_loader import get_data_path, get_library_path

        self.chunks: list[bytes] = []
        self.engine = ctypes.CDLL(get_library_path())
        initialize = self.engine.espeak_Initialize
        initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
        self.rate = initialize(
            _SYNCHRONOUS, 0, str(Path(get_data_path()).parent).encode(), _DONT_EXIT_ON_INIT_ERROR,
        )
        voice = self.engine.espeak_SetVoiceByName
        voice.argtypes = [ctypes.c_char_p]
        code = _voice_names()[language]
        if self.rate <= 0 or voice(code.encode("ascii")) != 0:
            raise RuntimeError(f"Could not load the local voice for {language}.")

        self.callback = _AUDIO_CALLBACK(self._collect)
        self.engine.espeak_SetSynthCallback.argtypes = [_AUDIO_CALLBACK]
        self.engine.espeak_SetSynthCallback.restype = None
        self.engine.espeak_SetSynthCallback(self.callback)
        self.engine.espeak_SetParameter.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
        self.engine.espeak_Synth.argtypes = [
            ctypes.c_char_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int, ctypes.c_uint,
            ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p,
        ]

    def _collect(self, samples, count: int, events) -> int:
        if samples and count > 0:
            self.chunks.append(ctypes.string_at(samples, count * ctypes.sizeof(ctypes.c_short)))
        return 0

    def synthesize(self, text: str, words_per_minute: int) -> bytes:
        self.chunks.clear()
        payload = text.replace("\x00", " ").encode("utf-8")
        if self.engine.espeak_SetParameter(_RATE_PARAMETER, words_per_minute, 0) != 0:
            raise RuntimeError("Could not set the dubbing voice speed.")
        # Use plain text so embedded markup cannot load external audio.
        status = self.engine.espeak_Synth(
            payload, len(payload) + 1, 0, _POSITION_CHARACTER, 0, _UTF8_TEXT, None, None,
        )
        if status != 0 or not self.chunks:
            raise RuntimeError("The local voice returned no audio.")
        return b"".join(self.chunks)


def _speech_clip(voice: _Voice, text: str, frames: int, ffmpeg: str):
    import numpy as np
    from scipy.signal import resample_poly

    nominal_speed = 160
    pcm = voice.synthesize(text, nominal_speed)
    ratio = (len(pcm) // 2) * SAMPLE_RATE / (frames * voice.rate)
    if ratio > 1.0:
        pcm = voice.synthesize(text, min(340, math.ceil(nominal_speed * ratio)))
    ratio = (len(pcm) // 2 + 16) * SAMPLE_RATE / (frames * voice.rate)
    if ratio > 1.0:
        # Chain atempo filters for very short cue windows without changing pitch.
        factor_count = max(1, math.ceil(math.log2(ratio)))
        factor = ratio ** (1 / factor_count)
        result = subprocess.run(
            [
                ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "s16le",
                "-ar", str(voice.rate), "-ac", "1", "-i", "pipe:0",
                "-af", ",".join([f"atempo={factor:.8f}"] * factor_count),
                "-ar", str(SAMPLE_RATE), "-f", "f32le", "pipe:1",
            ],
            input=pcm, capture_output=True, timeout=30, check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        clip = np.frombuffer(result.stdout, dtype="<f4").copy()
    else:
        divisor = math.gcd(SAMPLE_RATE, voice.rate)
        waveform = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768
        clip = resample_poly(waveform, SAMPLE_RATE // divisor, voice.rate // divisor)
    return _fit_clip(clip, frames)


def _fit_clip(clip, frames: int):
    import numpy as np

    if not clip.size:
        raise RuntimeError("A translated voice clip could not fit its caption timing.")
    clip = clip[:frames]
    # Prevent clicks at tightly trimmed cue boundaries.
    fade = min(clip.size // 2, SAMPLE_RATE // 100)
    if fade:
        ramp = np.linspace(0, 1, fade, dtype=np.float32)
        clip[:fade] *= ramp
        clip[-fade:] *= ramp[::-1]
    return clip


class _NeuralVoice:
    def __init__(self, language: str):
        # OmniVoice resolves both checkpoints through the Hub before it loads weights.
        os.environ["HF_HUB_CACHE"] = str(_APP_DIR / "ckpts" / "omnivoice")
        import torch
        from omnivoice import OmniVoice

        torch.set_num_threads(4)
        device = "xpu" if torch.xpu.is_available() else "cpu"
        print(f"OmniVoice dubbing device: {device}", flush=True)
        self.model = OmniVoice.from_pretrained(
            "k2-fsa/OmniVoice",
            device_map=device,
            dtype=torch.float16 if device == "xpu" else torch.float32,
        )
        self.language = _OMNIVOICE_ALIASES.get(language, language)
        self.prompt = None

    def clip(self, text: str, frames: int):
        import numpy as np
        import torch
        from scipy.signal import resample_poly

        text = text.translate(str.maketrans("[]<>", "［］＜＞"))
        rate = self.model.sampling_rate
        if self.prompt is None:
            # Generate one voice, then use it as the speaker reference for every cue.
            reference = self.model.generate(text=text, language=self.language)[0]
            self.prompt = self.model.create_voice_clone_prompt(
                ref_audio=(torch.as_tensor(reference).reshape(1, -1), rate),
                ref_text=text,
            )
        waveform = self.model.generate(
            text=text,
            language=self.language,
            duration=frames / SAMPLE_RATE,
            voice_clone_prompt=self.prompt,
            pad_duration=0,
        )[0]
        divisor = math.gcd(SAMPLE_RATE, rate)
        clip = resample_poly(np.asarray(waveform, dtype=np.float32), SAMPLE_RATE // divisor, rate // divisor)
        return _fit_clip(clip, frames)


def _write_speech(
    path: Path, language: str, segments: list[dict], frames: int, ffmpeg: str,
    engine: DubbingEngine = "espeak",
) -> None:
    import numpy as np
    import soundfile as sf

    if engine == "omnivoice":
        synthesize = _NeuralVoice(language).clip
    else:
        voice = _Voice(language)

        def synthesize(text: str, available_frames: int):
            return _speech_clip(voice, text, available_frames, ffmpeg)

    silence = np.zeros(SAMPLE_RATE, dtype=np.float32)

    with sf.SoundFile(path, "w", SAMPLE_RATE, 1, subtype="FLOAT") as output:
        def pad_to(position: int) -> None:
            while output.tell() < position:
                output.write(silence[:min(len(silence), position - output.tell())])

        for index, segment in enumerate(segments):
            start = max(output.tell(), round(segment["start"] * SAMPLE_RATE))
            next_start = segments[index + 1]["start"] if index + 1 < len(segments) else frames / SAMPLE_RATE
            # Use a short natural gap, when available, for longer translations.
            end = min(frames, round(min(segment["end"] + 0.3, next_start) * SAMPLE_RATE))
            if end <= start:
                continue
            pad_to(start)
            output.write(synthesize(" ".join(segment["text"].split()), end - start))
        pad_to(frames)


def _dialogue_intervals(segments: list[dict], frames: int) -> list[tuple[int, int]]:
    margin = round(0.1 * SAMPLE_RATE)
    intervals: list[tuple[int, int]] = []
    for segment in segments:
        start = max(0, round(segment["start"] * SAMPLE_RATE) - margin)
        end = min(frames, round(segment["end"] * SAMPLE_RATE) + margin)
        if end <= start:
            continue
        if intervals and start <= intervals[-1][1]:
            intervals[-1] = (intervals[-1][0], max(end, intervals[-1][1]))
        else:
            intervals.append((start, end))
    return intervals


def _write_background(source: Path, path: Path, segments: list[dict]) -> None:
    import numpy as np
    import soundfile as sf
    import torch
    from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS

    torch.set_num_threads(4)
    model = HDEMUCS_HIGH_MUSDB_PLUS.get_model().eval()
    vocal_index = model.sources.index("vocals")
    window, overlap = 8 * SAMPLE_RATE, SAMPLE_RATE
    stride = window - overlap

    with sf.SoundFile(source) as audio, sf.SoundFile(path, "w", SAMPLE_RATE, 2, subtype="FLOAT") as output:
        intervals = _dialogue_intervals(segments, len(audio))
        fade_samples = round(0.04 * SAMPLE_RATE)
        previous = None
        for start in range(0, len(audio), stride):
            audio.seek(start)
            original = audio.read(window, dtype="float32", always_2d=True)
            end = start + len(original)
            mask = np.zeros(len(original), dtype=np.float32)
            for left, right in intervals:
                if right <= start:
                    continue
                if left >= end:
                    break
                local_start, local_end = max(start, left), min(end, right)
                positions = np.arange(local_start, local_end)
                distances = np.minimum(positions - left, right - 1 - positions)
                mask[local_start - start:local_end - start] = np.minimum(distances / fade_samples, 1)
            background = original
            if mask.any():
                with torch.inference_mode():
                    block = torch.from_numpy(original.T.copy())
                    reference = block.mean(0)
                    mean = reference.mean()
                    deviation = reference.std(unbiased=False).clamp_min(1e-6)
                    # Pad the final block for the model's minimum convolution length.
                    padded = torch.nn.functional.pad((block - mean) / deviation, (0, window - len(original)))
                    vocals = model(padded.unsqueeze(0))[0, vocal_index, :, :len(original)]
                    vocals = (vocals * deviation + mean).T.numpy()
                background = original - vocals * mask[:, None]
            if previous is not None:
                blend = np.linspace(0, 1, overlap, dtype=np.float32)[:, None]
                background[:overlap] = previous * (1 - blend) + background[:overlap] * blend
            if end == len(audio):
                output.write(background)
                break
            output.write(background[:stride])
            previous = background[stride:]


def _main() -> None:
    if len(sys.argv) == 3 and sys.argv[1] == "--check-omnivoice":
        _check_omnivoice(sys.argv[2])
        return

    import soundfile as sf

    directory = Path(sys.argv[1])
    ffmpeg = sys.argv[2]
    request = json.loads((directory / "dub-request.json").read_text(encoding="utf-8"))
    segments = request["segments"]
    language = request["language"]
    source = directory / "dub-source.wav"
    _write_speech(
        directory / "dub-voice.wav", language, segments, sf.info(source).frames, ffmpeg,
        request.get("engine", "espeak"),
    )
    _write_background(source, directory / "dub-background.wav", segments)


if __name__ == "__main__":
    _main()

