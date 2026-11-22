# Editor text overlays

## Add text

1. Open the Editor and place the playhead where the text should start.
2. Click **Add text** in the timeline toolbar, or **+** on an unlocked Titles track. The Media panel's **Title** button is another entry point.
3. The new title is selected and **Adjust** opens automatically. Replace “Your title” in the Text field. Press Enter for additional lines.
4. Set the start and duration in Adjust, or move and trim the title on the timeline. New titles last three seconds and use the next available space if another title occupies that part of the track. Add another Titles track for simultaneous text overlays.
5. Save the project and export normally. Undo also applies to text and style edits.

## Appearance

| Control | Behavior |
| --- | --- |
| Font | Select a font family from the existing font list. |
| Font weight | Regular (400) or Bold (700). |
| Font style | Normal or Italic. |
| Font size / Color | Size in canvas pixels, from 8 to 400, and text fill color. |
| Text X / Text Y | Pixel offsets from the canvas center; negative moves left/up. |
| Alignment | Anchor the text's left edge, center, or right edge at the X position. |
| Border width / color | Outline around the letters, from 0 to 20 pixels. Zero disables it. |
| Text shadow | Toggle the shadow independently of the outline. |
| Shadow color / X / Y | Shadow color and offset, from -50 to 50 pixels on each axis. This is a hard shadow, without blur. |
| Background | Separate text-box color and opacity; zero opacity removes the box. |

Preview sizes scale with the video canvas. Export uses FFmpeg drawtext with the saved font, outline, shadow, position and opacity. Multiline text and punctuation are passed through a UTF-8 text file so they cannot become FFmpeg filter instructions.

## Font availability

Windows, macOS and Linux font locations are supported. Requested bold/italic faces are used when installed, with system fallback when unavailable. Display fonts may lack alternate faces, and browser-synthesized bold/italic can differ from export. Install matching fonts for the closest result. `MAESTRO_EDITOR_FONT` overrides export font selection if set. Browser and FFmpeg metrics can still differ slightly, particularly for multiline text.

## Change record — 20 November 2026

- Added visible Add text and per-track creation buttons; title creation opens Adjust, including the mobile sidebar.
- Added weight, italic, outline and configurable shadow controls with project validation and export support.
- Preserved all style fields when editing another control.
- Replaced viewport-based preview text sizing with canvas-based sizing.
- Verified the production UI build, lint, 22 Editor project tests, and a real FFmpeg bold-italic multiline render with pixel checks for fill, border and shadow colors.

After updating the source, rebuild the UI with `npm ci` and `npm run build` from `ui` (or use the normal Maestro update process), restart Maestro, and refresh with Ctrl+F5. The UI was rebuilt locally for this change. Older versions may discard the additional styling fields when saving a project.
