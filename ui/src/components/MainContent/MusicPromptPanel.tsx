import { PromptLibraryPanel } from './PromptLibraryPanel'
import { insertMusicPrompt, musicModifierGroup, musicPromptField, musicPromptGroups } from './musicPrompts'

export function MusicPromptPanel() {
  return (
    <PromptLibraryPanel
      title="Background music"
      categoryLabel="Music category"
      groups={musicPromptGroups}
      field={musicPromptField}
      instructions="Insert sets the last scene’s background score. Mixing modifiers add instructions to the score."
      searchPlaceholder="Search music prompts"
      insertIntoDraft={(draft, prompt, category) => insertMusicPrompt(draft, prompt, category === musicModifierGroup)}
    />
  )
}
