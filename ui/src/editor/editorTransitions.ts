import type { EditorTimelineItem, EditorTrack, EditorTransitionType } from '../types'

export const cutPresets = [
  ['fade_black', 'Dip to black'],
  ['fade_white', 'Dip to white'],
  ['wipe_left', 'Wipe left'],
  ['wipe_right', 'Wipe right'],
  ['wipe_up', 'Wipe up'],
  ['wipe_down', 'Wipe down'],
  ['dissolve', 'Fade through layer'],
  ['none', 'Hard cut'],
] as const satisfies ReadonlyArray<readonly [EditorTransitionType, string]>

export function transitionWithDuration(type: EditorTransitionType | undefined, duration: number): EditorTransitionType {
  return duration > 0 ? type && type !== 'none' ? type : 'dissolve' : 'none'
}

export function visualTransitionStyle(item: EditorTimelineItem, playhead: number) {
  let opacity = 1
  const filters: string[] = []
  const inset = [0, 0, 0, 0]
  for (const incoming of [true, false]) {
    const duration = Math.min(item.duration, (incoming ? item.fade_in : item.fade_out) || 0)
    if (duration <= 0) continue
    const progress = Math.max(0, Math.min(1, incoming
      ? (playhead - item.start) / duration
      : (playhead - item.start - item.duration + duration) / duration))
    const visible = incoming ? progress : 1 - progress
    const kind = incoming ? item.transition_in : item.transition_out
    if (kind === 'fade_black') filters.push(`brightness(${visible})`)
    else if (kind === 'fade_white') filters.push(`invert(1) brightness(${visible}) invert(1)`)
    else if (kind?.startsWith('wipe_')) {
      const edge = kind === 'wipe_left' ? (incoming ? 3 : 1)
        : kind === 'wipe_right' ? (incoming ? 1 : 3)
        : kind === 'wipe_up' ? (incoming ? 0 : 2) : (incoming ? 2 : 0)
      inset[edge] = Math.max(inset[edge], (1 - visible) * 100)
    } else opacity = Math.min(opacity, visible)
  }
  return {
    opacity,
    filter: filters.length ? filters.join(' ') : undefined,
    clipPath: inset.some(value => value > 0) ? `inset(${inset.map(value => `${value}%`).join(' ')})` : undefined,
  }
}

export function transitionCuts(track: EditorTrack, fps: number) {
  if (track.locked || track.type !== 'video') return []
  const clips = [...track.items].sort((a, b) => a.start - b.start)
  return clips.slice(1).flatMap((right, i) => {
    const left = clips[i]
    const gap = right.start - (left.start + left.duration)
    return Math.abs(gap) <= 0.5 / Math.max(1, fps) ? [{ left, right }] : []
  })
}
