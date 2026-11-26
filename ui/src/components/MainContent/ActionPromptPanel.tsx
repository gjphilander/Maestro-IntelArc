import { PromptLibraryPanel } from './PromptLibraryPanel'
import { actionPromptGroups } from './actionPrompts'
import { appendDetailedDescription, detailedDescriptionField } from './detailedDescriptionPrompt'

export function ActionPromptPanel() {
  return (
    <PromptLibraryPanel
      title="Character actions"
      categoryLabel="Action category"
      groups={actionPromptGroups}
      field={detailedDescriptionField}
      instructions="Insert adds the action to the last scene’s detailed_description. Name the character, prop, or target when it matters."
      searchPlaceholder="Search action prompts"
      insertIntoDraft={appendDetailedDescription}
    />
  )
}
