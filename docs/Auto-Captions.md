# Auto Captions

Auto Captions detects speech in an uploaded video and burns timed subtitles into an MP4. You can keep the spoken language or translate the captions into a different language.

## Export a captioned video

1. In Maestro's main workspace, open **Auto Captions** and select a **Video file**.
2. Under **Caption language**, leave **Original language** selected or choose a target language. The menu offers 100 translation targets, including Afrikaans, French, Xhosa, and Zulu. Maestro detects the spoken language automatically and keeps the timing of each caption when it translates the text.
3. Adjust **Font size**, **Font color**, and **Border color**. Size ranges from 12 to 36 and defaults to 21. The default style is white text with a black outline.
4. To replace the dialogue with a spoken translation, check **Dub translated audio**. The checkbox starts unchecked and requires a target language with a local voice.
5. Select **Export captioned video**. When it finishes, preview the result or select **Download MP4**. Maestro also saves the export in the active output workspace.

Maestro accepts MP4, MOV, M4V, MKV, AVI, and WebM files up to 1 GB and 30 minutes. The video needs an audio track with recognizable speech. If the file has multiple audio tracks, Maestro captions and exports the first one.

The export is a separate H.264 MP4 with AAC audio. Caption-only exports use the source audio. The captions are part of the video image and will appear in any player. To change the language or style, export again from the original file.

## Dub translated audio

When you check **Dub translated audio**, Maestro speaks the translated captions with a local synthetic voice and aligns it to the caption timing. It estimates the dialogue in the first audio track and removes it around the speech cues, then mixes in the dub. Music and sound effects between dialogue cues stay intact. In a mixed soundtrack, some original voices may remain, and sounds that overlap speech can change. Dubbing is available for languages with an installed voice, such as Afrikaans and French. Other targets remain available for caption-only exports.

## Install and first use

Use the [normal Maestro installation](../README.md#install). Pinokio installs the required Python packages and builds the UI. Maestro's startup locates or downloads FFmpeg and FFprobe. A source ZIP or Git clone also needs the normal setup before the feature can run.

| First use | Model downloaded | Approximate size |
| --- | --- | --- |
| Exporting any captions | faster-whisper Small | 484 MB |
| Translating captions into a different language | M2M100 INT8 | 500 MB |
| Dubbing translated speech | Hybrid Demucs soundtrack separation | 335 MB |

Maestro downloads the models automatically if they are missing. Internet access is needed for those downloads. Once the models are cached, speech recognition, translation, and dubbing run offline on the Maestro computer. The video and caption text stay on that computer during processing.

## Troubleshooting

- **Auto Captions is missing, or a new setting has no effect.** Update to a version that includes the feature and restart Maestro. On a manual source update, rebuild the UI before restarting, then reload the browser. [Updating Maestro](../README.md#updates)
- **No speech was detected.** Check that speech is audible on the first audio track.
- **The detected speech language cannot be translated.** Switch to **Original language** to export captions for speech that Whisper can recognize.
- **The first model download fails.** Check the Maestro computer's internet connection, then retry the export.
- **FFmpeg cannot render the captions.** Restart Maestro to rerun its media setup. If you supplied your own FFmpeg build, it needs FFprobe, the `subtitles` filter with libass, and the `libx264` encoder.
