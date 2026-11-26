export const detailedDescriptionField = 'detailed_description:'

export function appendDetailedDescription(draft: string, descriptionText: string): string {
  const structure = draft.replace(/<d>[\s\S]*?<\/d>/gi, dialogue => dialogue.replace(/[^\r\n]/g, ' '))
  const fields = [...structure.matchAll(/\b(subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music)[ \t]*:/gi)]
  const lastField = fields.at(-1)
  const draftBody = draft.trimEnd()
  if (lastField && lastField.index <= draftBody.lastIndexOf('\n')) {
    const fieldLineStart = structure.lastIndexOf('\n', lastField.index) + 1
    if (structure.slice(fieldLineStart, lastField.index).trim()) {
      // A one-line H3 window can be followed by an unstructured prompt line.
      return `${draftBody} ${detailedDescriptionField} ${descriptionText}${draft.slice(draftBody.length)}`
    }
  }
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
  const labeledDescription = hasDescription ? descriptionText : `${detailedDescriptionField} ${descriptionText}`
  // Reuse a multiline field boundary where present. Otherwise stay on the
  // same line so Studio's manual window count is preserved.
  const separator = nextField && !hasDescription && /[\r\n]/.test(boundary) ? boundary : body ? ' ' : ''
  const suffix = nextField && !boundary ? ' ' : boundary
  return `${body}${separator}${labeledDescription}${suffix}${after}`
}
