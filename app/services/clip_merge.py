import json
import subprocess


def run(command, cwd=None):
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, encoding="utf8",
                            errors="replace", creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if result.returncode:
        raise RuntimeError(result.stderr.strip()[-1600:] or "FFmpeg could not process the clip.")
    return result.stdout


def merge_clips(paths, temp, ffmpeg, probe):
    segments = []
    for index, path in enumerate(paths):
        streams = json.loads(run([probe, "-v", "error", "-show_streams", "-of", "json", str(path)]))["streams"]
        video = next((s for s in streams if s["codec_type"] == "video" and not s.get("disposition", {}).get("attached_pic")), None)
        if not video:
            raise ValueError(f"Clip {index + 1} has no video track.")
        if index == 0:
            width, height = video["width"], video["height"]
            rotation = next((s.get("rotation", 0) for s in video.get("side_data_list", []) if "rotation" in s), 0)
            if int(rotation) % 180 == 90:
                width, height = height, width
            width, height = max(2, width // 2 * 2), max(2, height // 2 * 2)
        has_audio = any(s["codec_type"] == "audio" for s in streams)
        command = [ffmpeg, "-nostdin", "-loglevel", "error", "-i", str(path)]
        if not has_audio:
            command += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        segment = f"clip{index:06d}.mp4"
        scale = f"scale={width}:{height}:force_original_aspect_ratio=decrease:force_divisible_by=2"
        run(command + ["-map", f"0:{video['index']}", "-map", "0:a:0" if has_audio else "1:a:0",
                       "-vf", f"fps=30,{scale},pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1",
                       "-af", "aresample=48000:async=1:first_pts=0,apad", "-shortest",
                       "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
                       "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "160k", str(temp / segment)])
        segments.append(f"file '{segment}'")
    manifest = temp / "clips.txt"
    manifest.write_text("\n".join(segments), encoding="ascii")
    output = temp / "combined.mp4"
    run([ffmpeg, "-nostdin", "-loglevel", "error", "-f", "concat", "-safe", "1",
         "-i", manifest.name, "-c", "copy", "-movflags", "+faststart", output.name], cwd=temp)
    return output

