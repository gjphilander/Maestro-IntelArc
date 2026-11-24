"""Transcribe a local video and burn timed captions into an MP4."""

from __future__ import annotations

import json
import logging
import math
import subprocess
import sys
from pathlib import Path

from services.caption_dubbing import (
    SAMPLE_RATE, DubbingEngine, dubbing_languages, omnivoice_languages, omnivoice_python,
)
from services.caption_translation import (
    CaptionTranslationError,
    supported_translation_language,
    translate_segments,
)
from services.source_audio_transcript import (
    SourceAudioTranscriptError,
    transcribe_source_audio,
)

VIDEO_EXTENSIONS = frozenset({".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"})
MAX_UPLOAD_BYTES = 1024 ** 3
MAX_DURATION_SECONDS = 30 * 60
MIN_CAPTION_FONT_SIZE = 12
DEFAULT_CAPTION_FONT_SIZE = 21
MAX_CAPTION_FONT_SIZE = 36
DEFAULT_CAPTION_FONT_COLOR = "#ffffff"
DEFAULT_CAPTION_OUTLINE_COLOR = "#000000"
CAPTION_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"

# Accept container files only. In particular, never open playlists supplied as videos.
_INPUT_OPTIONS = (
    "-protocol_whitelist", "file",
    "-format_whitelist", "avi,matroska,webm,mov,mp4,m4a,3gp,3g2,mj2",
)
_LOG = logging.getLogger(__name__)


class CaptionInputError(ValueError):
    """The source could not be captioned."""


class CaptionExportError(RuntimeError):
    """The captioning runtime or encoder failed."""


def _run(command: list[str], directory: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=directory,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )


def _timestamp(seconds: float) -> str:
    minutes, milliseconds = divmod(round(seconds * 1000), 60_000)
    hours, minutes = divmod(minutes, 60)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"


def _write_captions(path: Path, segments: list[dict], duration: float) -> None:
    # The SRT decoder recognizes inline markup. Keep recognized speech literal.
    escape_markup = str.maketrans("<>{}\\", "＜＞｛｝＼")
    cues = []
    for segment in segments:
        start = _timestamp(segment["start"])
        end = _timestamp(min(segment["end"], duration))
        caption = " ".join(segment["text"].split()).translate(escape_markup)
        if start < end and caption:
            cues.append(f"{len(cues) + 1}\n{start} --> {end}\n{caption}\n")
    if not cues:
        raise CaptionInputError("No speech was detected in this video.")
    path.write_text("\n".join(cues), encoding="utf-8")


def _ass_color(color: str) -> str:
    red, green, blue = bytes.fromhex(color[1:])
    return f"&H00{blue:02X}{green:02X}{red:02X}"


def _prepare_dub(
    directory: Path, ffmpeg_input: list[str], duration: float, segments: list[dict], language: str,
    engine: DubbingEngine,
) -> None:
    extracted = _run(
        [
            *ffmpeg_input, "-t", str(duration), "-map", "0:a:0", "-ar", str(SAMPLE_RATE), "-ac", "2",
            "-af", f"aresample={SAMPLE_RATE}:async=1:first_pts=0,apad=whole_dur={duration}",
            "-c:a", "pcm_f32le", "dub-source.wav",
        ],
        directory,
        300,
    )
    if extracted.returncode:
        _LOG.warning("Dubbing audio extraction failed: %s", extracted.stderr.strip())
        raise CaptionInputError("FFmpeg could not read the soundtrack for dubbing.")

    request = {"segments": segments, "language": language, "engine": engine}
    (directory / "dub-request.json").write_text(json.dumps(request, ensure_ascii=False), encoding="utf-8")
    python = str(omnivoice_python()) if engine == "omnivoice" else sys.executable
    result = _run(
        [python, "-m", "services.caption_dubbing", str(directory), ffmpeg_input[0]],
        Path(__file__).resolve().parents[1],
        5400,
    )
    if result.returncode:
        _LOG.error("Caption dubbing failed: %s", result.stderr.strip()[-5000:])
        raise CaptionExportError(
            "Could not generate the dubbed soundtrack. Check the first-run model download and Maestro's log."
        )


def export_captioned_video(
    source: Path,
    output: Path,
    *,
    ffmpeg: str,
    ffprobe: str,
    font_size: int = DEFAULT_CAPTION_FONT_SIZE,
    font_color: str = DEFAULT_CAPTION_FONT_COLOR,
    outline_color: str = DEFAULT_CAPTION_OUTLINE_COLOR,
    target_language: str = "",
    dub_audio: bool = False,
    dubbing_engine: DubbingEngine = "espeak",
) -> None:
    """Write an H.264/AAC MP4 to the caller's staging path."""
    if target_language and not supported_translation_language(target_language):
        raise CaptionInputError("Choose a supported caption language.")
    if dub_audio:
        if dubbing_engine == "omnivoice":
            neural_languages = omnivoice_languages()
            if not neural_languages:
                raise CaptionInputError("Install OmniVoice Dubbing from the Maestro menu in Pinokio.")
            if target_language not in neural_languages:
                raise CaptionInputError("Choose a translation language supported by OmniVoice.")
        elif target_language not in dubbing_languages():
            raise CaptionInputError("Choose a translation language with an available dubbing voice.")

    directory = source.parent
    probe = _run(
        [
            ffprobe, "-v", "error", *_INPUT_OPTIONS,
            "-show_entries", "format=duration:stream=index,codec_type:stream_disposition=attached_pic",
            "-of", "json", source.name,
        ],
        directory,
        30,
    )
    if probe.returncode:
        raise CaptionInputError("Choose a readable MP4, MOV, M4V, MKV, AVI, or WebM video.")

    metadata = json.loads(probe.stdout)
    streams = metadata.get("streams", [])
    video = next(
        (stream for stream in streams
         if stream["codec_type"] == "video" and not stream.get("disposition", {}).get("attached_pic")),
        None,
    )
    if video is None:
        raise CaptionInputError("This file does not contain a video track.")
    if not any(stream["codec_type"] == "audio" for stream in streams):
        raise CaptionInputError("This video has no audio track to transcribe.")
    try:
        duration = float(metadata.get("format", {}).get("duration", 0))
    except (TypeError, ValueError):
        duration = 0
    if not math.isfinite(duration) or not 0 < duration <= MAX_DURATION_SECONDS:
        raise CaptionInputError("Choose a video with a readable duration of up to 30 minutes.")

    ffmpeg_input = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin",
        *_INPUT_OPTIONS, "-i", source.name,
    ]
    audio = directory / "audio.wav"
    extracted = _run(
        [
            *ffmpeg_input, "-t", str(MAX_DURATION_SECONDS), "-map", "0:a:0", "-ac", "1", "-ar", "16000",
            "-af", "aresample=async=1:first_pts=0", audio.name,
        ],
        directory,
        300,
    )
    if extracted.returncode:
        _LOG.warning("Caption audio extraction failed: %s", extracted.stderr.strip())
        raise CaptionInputError("FFmpeg could not read this video's audio track.")

    try:
        source_language, transcript = transcribe_source_audio(audio)
    except SourceAudioTranscriptError as error:
        _LOG.exception("Caption transcription failed")
        raise CaptionExportError("Could not transcribe the audio. Check Maestro's Whisper setup and try again.") from error

    segments = [
        segment for segment in transcript
        if segment["end"] > segment["start"] and segment["text"].strip()
    ]
    # Whisper uses the former ISO code for Javanese.
    source_language = "jv" if source_language == "jw" else source_language
    if segments and target_language and target_language != source_language:
        try:
            if not supported_translation_language(source_language):
                raise CaptionInputError(
                    "Translation is unavailable for the detected speech language. "
                    "Choose Original language to export captions."
                )
            segments = translate_segments(segments, source_language, target_language)
        except CaptionTranslationError as error:
            _LOG.exception("Caption translation failed")
            raise CaptionExportError(
                "Could not translate the captions. Check your connection for the first model download and try again."
            ) from error

    _write_captions(directory / "captions.srt", segments, duration)
    audio_inputs: list[str] = []
    audio_map = ["-map", "0:a:0"]
    if dub_audio:
        if not segments:
            raise CaptionInputError("No speech was detected to dub.")
        _prepare_dub(directory, ffmpeg_input, duration, segments, target_language, dubbing_engine)
        audio_inputs = ["-i", "dub-background.wav", "-i", "dub-voice.wav"]
        audio_map = [
            "-filter_complex",
            "[2:a]pan=stereo|FL=c0|FR=c0[voice];"
            "[1:a][voice]amix=inputs=2:duration=first:normalize=0,"
            "alimiter=limit=0.97:level=false:latency=true[dub]",
            "-map", "[dub]",
        ]
    rendered = _run(
        [
            *ffmpeg_input, *audio_inputs, "-t", str(MAX_DURATION_SECONDS),
            "-map", f"0:{video['index']}", *audio_map,
            "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2,subtitles=captions.srt:"
            f"force_style='FontSize={font_size:d},PrimaryColour={_ass_color(font_color)},"
            f"OutlineColour={_ass_color(outline_color)},Outline=2,Shadow=0,MarginV=24'",
            "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-f", "mp4", "-y", str(output),
        ],
        directory,
        1800,
    )
    if rendered.returncode or not output.is_file() or not output.stat().st_size:
        _LOG.error("Caption rendering failed: %s", rendered.stderr.strip())
        raise CaptionExportError("FFmpeg could not render the captioned video.")

