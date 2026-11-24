import { useRef, useState } from 'react'
import { Copy, Plus } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { cameraPromptField, cameraPromptGroups, insertCameraPrompt } from './cameraPrompts'

const buttonClass = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'

export function CameraPromptPanel() {
  const [category, setCategory] = useState('')
  const [notice, setNotice] = useState({ text: '', error: false })
  const resultsRef = useRef<HTMLDivElement>(null)
  const groups = category ? cameraPromptGroups.filter(group => group.title === category) : cameraPromptGroups

  async function copyPrompt(name: string, prompt: string) {
    try {
      await navigator.clipboard.writeText(`${cameraPromptField} ${prompt}`)
      setNotice({ text: `Copied ${name}.`, error: false })
    } catch {
      setNotice({ text: 'Clipboard access was blocked. You can select and copy the prompt text.', error: true })
    }
  }

  function insertPrompt(name: string, prompt: string) {
    const { params, setParam } = useStore.getState()
    setParam('prompt', insertCameraPrompt(params.prompt, prompt))
    setNotice({ text: `Added ${name} to the Studio prompt.`, error: false })
  }

  return (
    <section aria-labelledby="camera-prompts-title" className="flex min-w-0 flex-1 flex-col bg-bg-primary">
      <header className="border-b border-border bg-bg-secondary px-3 py-3 md:px-5">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="camera-prompts-title" className="text-sm font-semibold text-text-primary">Camera movements</h2>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              Movement type
              <select
                value={category}
                onChange={event => {
                  setCategory(event.target.value)
                  resultsRef.current?.scrollTo({ top: 0 })
                }}
                className="max-w-full rounded-md border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
              >
                <option value="">All types</option>
                {cameraPromptGroups.map(group => <option key={group.title}>{group.title}</option>)}
              </select>
            </label>
          </div>
          <p role="status" className={`mt-1 min-h-5 text-xs ${notice.error ? 'text-chip-red' : 'text-text-secondary'}`}>
            {notice.text || 'Insert adds the movement to the detailed_description field in Studio.'}
          </p>
        </div>
      </header>
      <div ref={resultsRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5">
        <div className="mx-auto max-w-6xl space-y-5">
          {groups.map(group => (
            <section key={group.title}>
              <h3 className="mb-2 text-xs font-semibold text-text-primary">{group.title}</h3>
              <div className="grid gap-2 xl:grid-cols-2">
                {group.moves.map(([name, direction]) => {
                  const prompt = `${name}. ${direction}`
                  return (
                    <article key={name} className="flex flex-col rounded-lg border border-border bg-bg-secondary p-3">
                      <h4 className="text-sm font-medium text-text-primary">{name}</h4>
                      <p className="mt-1 grow text-xs leading-relaxed text-text-secondary">{direction}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-label={`Copy ${name}`}
                          onClick={() => void copyPrompt(name, prompt)}
                          className={`${buttonClass} border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary`}
                        >
                          <Copy size={12} aria-hidden="true" /> Copy
                        </button>
                        <button
                          type="button"
                          aria-label={`Insert ${name} into Studio`}
                          onClick={() => insertPrompt(name, prompt)}
                          className={`${buttonClass} bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20`}
                        >
                          <Plus size={13} aria-hidden="true" /> Insert
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}
