# Maestro Editor transitions

## Install or update
These transitions are included in this fork's Editor source. After updating the source, run `npm ci` and `npm run build` from `ui` (or use Maestro's normal update process). Restart Maestro and refresh the Editor with Ctrl+F5. The local UI build has already been refreshed for this change.

## Add or change a transition
1. Put two clips edge to edge on the same unlocked video track.
2. Open **Transitions** in the timeline toolbar. A **+** appears at each eligible cut.
3. Drag a transition preset onto the +. For touch or keyboard use, select the preset and activate the cut button. A diamond marks a cut with matching transitions.
4. Play across the cut to preview it. Drop another preset to replace it. Choose **Hard cut** to clear both fades, or use **Undo** to reverse the last change.
5. To adjust the length, select the outgoing clip and open **Adjust → Transition out duration**. Use **Transition in duration** on the incoming clip for the other half. Save and export as usual.

## How the effects look
- **Dip to black** darkens the outgoing image to black, then brightens the incoming image.
- **Dip to white** fades the outgoing image to white, then reveals the incoming image from white.
- **Fade through layer** fades the outgoing image to transparency, revealing the underlying track or canvas, then fades in the incoming image. Place a contrasting image or video on a lower layer to see the difference on a black canvas.
- **Wipe left / right / up / down** removes the outgoing image in the named direction, then reveals the incoming image in the same direction. The hidden region shows the lower layer or canvas. Wipes affect the clip's own rectangle, including its scale and rotation.
- **Hard cut** switches directly between the clips.

Each transition defaults to half a second per side, capped at half the shorter clip. The edit preserves clip timing and total runtime. The transitions belong to the two clip edges and travel with their respective clips if moved. Existing Editor audio-envelope behaviour applies: audio fades with the edge duration even for a wipe. These are sequential edge effects; they do not overlap two clips or shorten the timeline.

All presets support preview, project save/reload, undo and FFmpeg export. You can also choose each edge separately in **Adjust → Transition in / out**. Changing the duration in Adjust or dragging a timeline fade handle preserves the chosen effect. Setting duration to zero clears that edge. FFmpeg processes wipe masks on the CPU, which can add export time at high resolutions; no extra Python package or GPU-specific attention library is required.

## Change record — 20 November 2026
Added draggable presets, drop targets and a click alternative to EditorTimeline. Added a paired transition action to the Editor store so both edges share one undo entry. The existing project fields support save, reload, preview and FFmpeg export. Existing projects require no migration.

Expanded the original three presets to eight with dip-to-white and four directional wipes. Extended project validation, preview and export together, and fixed duration adjustments to retain the transition type. Verified the UI build and lint, 21 Editor project tests, and small FFmpeg exports with pixel checks for all five new effects. Previously saved projects remain compatible; older Maestro versions do not recognize the new effect names.
