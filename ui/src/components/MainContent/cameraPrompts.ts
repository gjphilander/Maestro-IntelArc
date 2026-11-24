type CameraPromptGroup = {
  title: string
  moves: readonly (readonly [name: string, direction: string])[]
}

export const cameraPromptField = 'detailed_description:'

export function insertCameraPrompt(draft: string, movement: string): string {
  const fields = [...draft.matchAll(/\b(subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music)[ \t]*:/gi)]
  // A Studio script can contain several H3 windows. Target the final scene.
  const names = fields.map(field => field[1].toLowerCase())
  const start = Math.max(0, names.lastIndexOf('subject_definitions'))
  const description = names.lastIndexOf('detailed_description')
  const hasDescription = description >= start
  const nextField = hasDescription ? fields[description + 1]
    : fields.slice(start).find(field => /^(overall_soundscape|non_diegetic_music)$/i.test(field[1]))
  const before = draft.slice(0, nextField?.index ?? draft.length)
  const body = before.trimEnd()
  const boundary = before.slice(body.length)
  const after = draft.slice(before.length)
  const labeledMovement = hasDescription ? movement : `${cameraPromptField} ${movement}`
  // Reuse a multiline field boundary where present. Otherwise stay on the
  // same line so Studio's manual window count is preserved.
  const separator = nextField && !hasDescription && /[\r\n]/.test(boundary) ? boundary : body ? ' ' : ''
  const suffix = nextField && !boundary ? ' ' : boundary
  return `${body}${separator}${labeledMovement}${suffix}${after}`
}

export const cameraPromptGroups: readonly CameraPromptGroup[] = [
  {
    title: 'Locked camera, pans, tilts, and rolls',
    moves: [
      ['Locked-off shot', 'The camera holds its exact starting position, angle, and framing for the entire clip as the scene moves naturally within the frame.'],
      ['Pan left', 'From a fixed position, the camera turns smoothly to look left, revealing what lies beyond the left edge of the opening frame, then settles.'],
      ['Pan right', 'From a fixed position, the camera turns smoothly to look right, revealing what lies beyond the right edge of the opening frame, then settles.'],
      ['Tilt up', 'From a fixed position, the camera angles upward from the lower part of the subject to the top, finishing on the space above it.'],
      ['Tilt down', 'From a fixed position, the camera angles downward from the upper part of the subject to the ground or objects below.'],
      ['Diagonal pan and tilt up-left', 'From a fixed position, the camera turns left and tilts up together, ending on a detail above and left of the starting view.'],
      ['Diagonal pan and tilt down-right', 'From a fixed position, the camera turns right and tilts down together, ending on a detail below and right of the starting view.'],
      ['Whip pan left', 'The camera snaps left from a fixed position, producing a brief streak of motion blur before settling sharply on the new view.'],
      ['Whip pan right', 'The camera snaps right from a fixed position, producing a brief streak of motion blur before settling sharply on the new view.'],
      ['Whip tilt up', 'The camera snaps upward from the lower framing, briefly blurring the image before landing on a clear view overhead.'],
      ['Whip tilt down', 'The camera snaps downward from the upper framing, briefly blurring the image before landing on a clear view below.'],
      ['Clockwise camera roll', 'The composition rotates clockwise around the center of the frame to a slight Dutch angle, with the subject held at the center.'],
      ['Counterclockwise camera roll', 'The composition rotates counterclockwise around the center of the frame to a slight Dutch angle, with the subject held at the center.'],
      ['Dutch-angle correction', 'Begin with a visibly slanted horizon and slowly roll the camera upright until the horizon is level.'],
      ['Full barrel roll', 'The image rotates one complete turn around the center of the frame, ending upright with the subject still centered.'],
    ],
  },
  {
    title: 'Dolly, truck, pedestal, and crane',
    moves: [
      ['Slow dolly in', 'The camera physically glides toward the subject at a fixed focal length, moving from a medium shot into a close-up as foreground objects shift against the background.'],
      ['Slow dolly out', 'The camera physically retreats from the subject at a fixed focal length, gradually revealing the wider setting around it.'],
      ['Fast dolly in', 'The camera rushes straight toward the subject, decelerates into a close-up, then holds the final framing steady.'],
      ['Fast dolly out', 'The camera rapidly retreats from the subject, opening into a wide view that reveals its surroundings, then settles.'],
      ['Truck left', 'The camera slides bodily to the left at constant height and keeps looking in the same direction, making nearby objects shift across the frame faster than the distant background.'],
      ['Truck right', 'The camera slides bodily to the right at constant height and keeps looking in the same direction, making nearby objects shift across the frame faster than the distant background.'],
      ['Diagonal dolly in-left', 'The camera glides forward and left in a straight line, tightening the framing and revealing the subject from a slightly more oblique angle.'],
      ['Diagonal dolly out-right', 'The camera glides backward and right in a straight line, widening the framing and revealing more of the setting from the new position.'],
      ['Pedestal up', 'The camera rises vertically from waist height to eye level, keeping the same lens angle and a level horizon throughout.'],
      ['Pedestal down', 'The camera lowers vertically from eye level to waist height, keeping the same lens angle and a level horizon throughout.'],
      ['Crane up', 'The camera sweeps upward and back from near the subject, tilting down as it rises to reveal the layout of the setting from above.'],
      ['Crane down', 'The camera sweeps downward and forward from a high establishing view, arriving at eye level in a medium shot of the subject.'],
    ],
  },
  {
    title: 'Arcs and orbits',
    moves: [
      ['Leftward arc', 'The camera glides in a shallow curve from the subject’s front toward its left side, keeping the subject centered at roughly the same size.'],
      ['Rightward arc', 'The camera glides in a shallow curve from the subject’s front toward its right side, keeping the subject centered at roughly the same size.'],
      ['Quarter orbit to the left', 'The camera circles 90 degrees from a front view to a left profile at a constant distance and height, continuously aiming at the subject.'],
      ['Quarter orbit to the right', 'The camera circles 90 degrees from a front view to a right profile at a constant distance and height, continuously aiming at the subject.'],
      ['Half orbit', 'The camera travels in a 180-degree horizontal arc from directly in front of the subject to directly behind it, maintaining a constant radius.'],
      ['Full clockwise orbit', 'Viewed from above, the camera circles the stationary subject clockwise through 360 degrees at a constant height and radius, returning to its starting view.'],
      ['Full counterclockwise orbit', 'Viewed from above, the camera circles the stationary subject counterclockwise through 360 degrees at a constant height and radius, returning to its starting view.'],
      ['Orbit and ascend', 'The camera curves around the subject while rising from eye level to a high angle, keeping the subject near the center throughout.'],
      ['Orbit and descend', 'The camera curves around the subject while lowering from a high angle to eye level, keeping the subject near the center throughout.'],
      ['Spiral in', 'The camera circles the subject while steadily reducing its distance, moving from a wide three-quarter view into a close-up.'],
      ['Spiral out', 'The camera circles the subject while steadily increasing its distance, moving from a close-up into a wide view of the setting.'],
    ],
  },
  {
    title: 'Tracking, handheld, and POV',
    moves: [
      ['Rear follow shot', 'The camera travels behind the walking subject at the same pace, keeping a steady gap and a clear view of the subject’s back.'],
      ['Front leading shot', 'The camera travels backward as the subject walks toward it, matching the subject’s pace to maintain a steady frontal medium shot.'],
      ['Left-side tracking', 'The camera moves parallel to the subject on its left side, matching its speed and maintaining a stable profile view.'],
      ['Right-side tracking', 'The camera moves parallel to the subject on its right side, matching its speed and maintaining a stable profile view.'],
      ['Lateral pass-by', 'The camera glides sideways past a stationary subject, allowing it to enter one side of the frame and leave the other while the background moves more slowly.'],
      ['Over-the-shoulder follow', 'The camera tracks just behind the subject’s shoulder, keeping the shoulder in the near foreground and the path ahead clearly visible.'],
      ['Crowd tracking', 'The camera glides through a small crowd, reaches a clear view of the singer, then matches the singer’s movement while keeping them in frame.'],
      ['Tracking handoff', 'The camera follows the first subject until a second subject crosses the frame, then smoothly redirects and follows the second subject.'],
      ['Stabilized gimbal walk-through', 'The camera glides forward at walking pace through the setting, turns smoothly around a corner, and keeps the horizon level.'],
      ['Handheld follow', 'The camera follows close behind with subtle footstep bounce and small framing corrections, keeping the subject legible throughout.'],
      ['Handheld hold', 'The camera remains roughly in place on a medium close-up, with gentle breathing sway and small natural adjustments.'],
      ['Walking POV', 'The camera advances at eye level along the path as if seen through a walking person’s eyes, with a gentle step rhythm and a forward gaze.'],
      ['Running POV', 'The camera rushes forward at eye level with rhythmic footstep bounce, briefly glances around an obstacle, and returns to the path ahead.'],
      ['Vehicle-mounted tracking', 'The camera travels beside the moving vehicle at matching speed, holding its side profile steady while the surroundings stream past.'],
    ],
  },
  {
    title: 'Aerial and overhead moves',
    moves: [
      ['Drone flyover', 'The camera flies straight forward above the landscape at a steady altitude, looking slightly down as the terrain scrolls underneath.'],
      ['Drone rise reveal', 'The camera begins low behind a foreground ridge or rooftop, then climbs until the landscape beyond becomes visible.'],
      ['Drone descent', 'The camera lowers smoothly from an aerial wide shot toward the scene below, gradually revealing detail and easing to a stop above ground level.'],
      ['Drone pullback', 'The camera flies backward and upward while keeping the original subject near the center, revealing the scale of the surrounding landscape.'],
      ['Top-down drift', 'The camera points straight down and slides horizontally at a constant height, letting the ground pattern move steadily beneath it.'],
      ['Top-down descent', 'The camera points straight down and lowers vertically toward the subject, keeping it centered as the overhead view tightens.'],
      ['Bird’s-eye transition', 'The camera climbs above the subject and gradually tilts down until it reaches a straight-down overhead view.'],
      ['Overhead-to-eye-level reveal', 'Start directly above the subject, then descend along an arc and gradually level the lens, finishing at eye height.'],
      ['FPV swoop', 'The aerial camera banks smoothly around a foreground obstacle, descends toward the open path, then levels out and continues forward.'],
    ],
  },
  {
    title: 'Lens moves and focus changes',
    moves: [
      ['Optical zoom in', 'The camera stays in one place while the lens smoothly lengthens its focal length, tightening from a medium shot to a close-up.'],
      ['Optical zoom out', 'The camera stays in one place while the lens smoothly shortens its focal length, widening from a close-up to show the surroundings.'],
      ['Snap zoom in', 'Hold the camera position fixed, then rapidly zoom from a wider view into a detail and hold it sharply in frame.'],
      ['Snap zoom out', 'Hold the camera position fixed, then rapidly zoom out from a detail to a wide view and hold the new composition.'],
      ['Dolly zoom in', 'The camera physically moves toward the subject while the lens zooms out, holding the subject at roughly the same size as the background appears to stretch away.'],
      ['Dolly zoom out', 'The camera physically moves away from the subject while the lens zooms in, holding the subject at roughly the same size as the background appears to compress behind it.'],
      ['Rack focus to the background', 'Hold the camera and framing steady. Begin with a sharp foreground object, then shift focus smoothly to the subject farther back.'],
      ['Rack focus to the foreground', 'Hold the camera and framing steady. Begin with the distant subject sharp, then shift focus smoothly to a nearer object.'],
    ],
  },
  {
    title: 'Reveals and combined moves',
    moves: [
      ['Lateral reveal', 'Begin with a foreground pillar partly blocking the subject, then slide sideways until the subject is fully visible and framed clearly.'],
      ['Doorway push-through', 'Begin outside a doorway, glide forward through it at a steady pace, and settle on a clear view of the room beyond.'],
      ['Low ground-level push', 'Glide forward just above the ground at a fixed height, letting the foreground texture flow past as the subject fills more of the frame.'],
      ['Push in and tilt up', 'Glide toward the subject while tilting upward from its lower detail to its face or upper silhouette, then hold the final framing.'],
      ['Pull back and tilt down', 'Retreat smoothly while tilting down, revealing the subject’s full figure and the ground around it.'],
      ['Truck and counter-pan', 'Slide sideways while turning the lens back toward the stationary subject, keeping it centered as the foreground and background shift visibly against each other.'],
      ['Push in with a focus pull', 'Glide forward while holding focus on a near object, then shift focus to the subject behind it as the move ends.'],
      ['Static-to-side-angle move', 'Hold the starting composition for the first quarter of the clip, glide in a short arc to a three-quarter side view, then hold the new angle through the end.'],
      ['Push in, hold, and pull back', 'Glide toward the subject during the first third of the clip, hold the close framing during the middle third, then retreat smoothly to the original framing.'],
    ],
  },
]
