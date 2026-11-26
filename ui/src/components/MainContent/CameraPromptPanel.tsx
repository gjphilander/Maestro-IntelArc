import { PromptLibraryPanel } from './PromptLibraryPanel'
import { cameraPromptGroups } from './cameraPrompts'
import { appendDetailedDescription, detailedDescriptionField } from './detailedDescriptionPrompt'

export function CameraPromptPanel() {
  return (
    <PromptLibraryPanel
      title="Camera movements"
      categoryLabel="Movement type"
      groups={cameraPromptGroups}
      field={detailedDescriptionField}
      instructions="Insert adds the movement to the detailed_description field in Studio."
      formatPrompt={(name, direction) => `${name}. ${direction}`}
      insertIntoDraft={appendDetailedDescription}
    />
  )
}
