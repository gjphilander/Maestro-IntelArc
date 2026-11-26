import { useEffect, useId, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Copy, Plus, X } from 'lucide-react'
import { useStore } from '../../stores/useStore'
import { GenerateButton } from '../Sidebar/GenerateButton'
import {
  buildVenuePrompt, castTypes, depthPositions, horizontalPositions, loadVenueScene, newSceneCharacter,
  newSceneObject, objectLighting, objectPresets, objectScales, objectVisibility, placementSurfaces,
  saveVenueScene, venueName, venuePresets, type SceneObject, type VenueScene,
} from './venueScene'

const steps = ['Select Venue', 'Add Objects', 'Add Characters', 'Configure Scene', 'Generate Scene']
const fieldClass = 'min-w-0 w-full rounded-md border border-border bg-bg-tertiary px-2.5 py-2 text-sm text-text-primary'
const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:opacity-40'
const gridClass = 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
const panelClass = 'rounded-xl border border-border bg-bg-secondary p-4'

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return <div className="grid min-w-0 gap-1 text-xs font-medium text-text-secondary"><label htmlFor={id}>{label}</label>{children(id)}</div>
}

function TextField({ label, value, onChange, placeholder, multiline = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean
}) {
  return (
    <Field label={label}>
      {id => multiline
        ? <textarea id={id} className={fieldClass} rows={3} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
        : <input id={id} className={fieldClass} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />}
    </Field>
  )
}

function SelectField({ label, value, options, onChange, empty }: {
  label: string; value: string; options: readonly string[]; onChange: (value: string) => void; empty?: string
}) {
  return (
    <Field label={label}>
      {id => <select id={id} className={fieldClass} value={value} onChange={event => onChange(event.target.value)}>
        {empty && <option value="">{empty}</option>}
        {options.map(option => <option key={option}>{option}</option>)}
      </select>}
    </Field>
  )
}

function ObjectSettings({ object, update }: { object: SceneObject; update: (patch: Partial<SceneObject>) => void }) {
  return (
    <div className={gridClass}>
      <TextField label="Object name" value={object.name} onChange={name => update({ name })} />
      <TextField label="Category" value={object.category} onChange={category => update({ category })} />
      <SelectField label="Position" value={object.horizontal} options={horizontalPositions} onChange={horizontal => update({ horizontal })} />
      <SelectField label="Depth" value={object.depth} options={depthPositions} onChange={depth => update({ depth })} />
      <SelectField label="Scale" value={object.scale} options={objectScales} onChange={scale => update({ scale })} />
      {object.scale === 'Custom' && <TextField label="Custom scale" value={object.customScale} onChange={customScale => update({ customScale })} placeholder="e.g. waist-high or 1.2 m wide" />}
      <Field label="Rotation (degrees)">
        {id => <input id={id} type="number" step="1" className={fieldClass} value={object.rotation} onChange={event => update({ rotation: event.target.value })} />}
      </Field>
      <TextField label="Material" value={object.material} onChange={material => update({ material })} />
      <TextField label="Colour" value={object.colour} onChange={colour => update({ colour })} />
      <TextField label="State" value={object.state} onChange={state => update({ state })} placeholder="e.g. open, closed, or lit" />
      <TextField label="Animation" value={object.animation} onChange={animation => update({ animation })} placeholder="e.g. static or slowly rotating" />
      <TextField label="Interaction" value={object.interaction} onChange={interaction => update({ interaction })} placeholder="e.g. Aisha picks it up" />
      <SelectField label="Visibility" value={object.visibility} options={objectVisibility} onChange={visibility => update({ visibility })} />
      <SelectField label="Lighting behaviour" value={object.lighting} options={objectLighting} onChange={lighting => update({ lighting })} empty="Unspecified" />
      <SelectField label="Placement surface" value={object.placement} options={placementSurfaces} onChange={placement => update({ placement })} empty="Unspecified" />
      <TextField label="Placement detail" value={object.anchor} onChange={anchor => update({ anchor })} placeholder="e.g. on the table beside the window" />
      <label className="flex items-center gap-2 self-end py-2 text-sm text-text-primary">
        <input type="checkbox" checked={object.persistent} onChange={event => update({ persistent: event.target.checked })} />
        Keep consistent between shots
      </label>
    </div>
  )
}

function ObjectStep({ objects, onChange }: {
  objects: SceneObject[]; onChange: (objects: SceneObject[]) => void
}) {
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState('')
  const [customName, setCustomName] = useState('')
  const categories = [...new Set(objectPresets.map(([, group]) => group))].sort()
  const query = search.trim().toLowerCase()
  const matches = objectPresets.filter(([name, group]) =>
    (!category || category === group) && `${name} ${group}`.toLowerCase().includes(query))

  function add(object: SceneObject) {
    onChange([...objects, object])
    setExpanded(object.id)
  }

  return (
    <div className="space-y-4">
      <section className={panelClass} aria-label="Object presets">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Search object presets">
            {id => <input id={id} type="search" className={fieldClass} value={search} onChange={event => setSearch(event.target.value)} />}
          </Field>
          <SelectField label="Object category" value={category} options={categories} onChange={setCategory} empty="All categories" />
        </div>
        <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {matches.map(preset => (
            <button type="button" key={preset[0]} className={buttonClass} aria-label={`Add ${preset[0]}`} onClick={() => add(newSceneObject(preset))}>
              <Plus size={14} /> {preset[0]}
            </button>
          ))}
          {!matches.length && <p className="text-sm text-text-muted">No matching object presets.</p>}
        </div>
        <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
          <div className="min-w-0 flex-1">
            <TextField label="Custom object name" value={customName} onChange={setCustomName} />
          </div>
          <button type="button" className={buttonClass} disabled={!customName.trim()} onClick={() => {
            add(newSceneObject([customName.trim(), 'Custom', '', 'Medium', '']))
            setCustomName('')
          }}>Add object</button>
        </div>
      </section>
      {objects.map((object, index) => {
        const name = object.name.trim() || `Object ${index + 1}`
        const open = object.id === expanded
        return (
          <section key={object.id} className={panelClass} aria-label={`Object ${index + 1}: ${name}`}>
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-text-primary" aria-expanded={open} onClick={() => setExpanded(open ? '' : object.id)}>
                {name} <span className="font-normal text-text-muted">· {object.horizontal}, {object.depth}</span>
              </button>
              <button type="button" className={buttonClass} aria-label={`Remove object ${index + 1}: ${name}`} onClick={() => onChange(objects.filter(item => item.id !== object.id))}>
                <X size={14} />
              </button>
            </div>
            {open && <div className="mt-3 border-t border-border pt-3">
              <ObjectSettings object={object} update={patch => onChange(objects.map(item => item.id === object.id ? { ...item, ...patch } : item))} />
            </div>}
          </section>
        )
      })}
    </div>
  )
}

function CharacterStep({ characters, onChange }: {
  characters: VenueScene['characters']; onChange: (characters: VenueScene['characters']) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('Person')
  return (
    <div className="space-y-3">
      <div className={`${panelClass} flex flex-wrap items-end gap-3`}>
        <div className="min-w-36 flex-1"><TextField label="Character name" value={name} onChange={setName} /></div>
        <SelectField label="Character type" value={type} options={castTypes} onChange={setType} />
        <button type="button" className={buttonClass} disabled={!name.trim()} onClick={() => {
          onChange([...characters, newSceneCharacter(name.trim(), type)])
          setName('')
        }}><Plus size={14} /> Add character</button>
      </div>
      {characters.map((character, index) => {
        const update = (patch: Partial<typeof character>) => onChange(characters.map(item =>
          item.id === character.id ? { ...item, ...patch } : item))
        return (
          <section key={character.id} className={panelClass} aria-label={`Character ${index + 1}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-text-primary">{character.name || `Character ${index + 1}`}</h3>
              <button type="button" className={buttonClass} aria-label={`Remove character ${index + 1}`} onClick={() => onChange(characters.filter(item => item.id !== character.id))}><X size={14} /></button>
            </div>
            <div className={gridClass}>
              <TextField label="Name" value={character.name} onChange={name => update({ name })} />
              <SelectField label="Type" value={character.type} options={castTypes} onChange={type => update({ type })} />
              <SelectField label="Position" value={character.horizontal} options={horizontalPositions} onChange={horizontal => update({ horizontal })} />
              <SelectField label="Depth" value={character.depth} options={depthPositions} onChange={depth => update({ depth })} />
              <TextField label="Appearance" value={character.appearance} onChange={appearance => update({ appearance })} />
              <TextField label="Action" value={character.action} onChange={action => update({ action })} />
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function VenueScenePanel() {
  const [scene, setScene] = useState(loadVenueScene)
  const [step, setStep] = useState(0)
  const [notice, setNotice] = useState('')
  const studioVideo = useStore(state => state.sidebarMode === 'studio' && state.generationMode === 'video'
    && (state.studioVideoWorkflow === 'frames' || state.studioVideoWorkflow === 'references'))
  const studioError = useStore(state => state.promptEnhanceError)
  const studioHasMultipleWindows = useStore(state =>
    (state.params.minimax_h3_multi_window === true || state.params.minimax_h3_reference_sequence === true
      || state.params.ltx_multi_window === true)
    && state.durationSeconds > state.slidingWindowSeconds + 0.05)
  useEffect(() => { saveVenueScene(scene) }, [scene])

  const venue = venueName(scene)
  const prompt = buildVenuePrompt(scene)
  const missingObject = scene.objects.some(object => !object.name.trim()
    || (object.scale === 'Custom' && !object.customScale.trim()))
  const missingCharacter = scene.characters.some(character => !character.name.trim())
  const ready = !!venue && !missingObject && !missingCharacter
  const update = (patch: Partial<VenueScene>) => setScene(current => ({ ...current, ...patch }))

  function useInStudio() {
    const store = useStore.getState()
    if (store.sidebarMode !== 'studio') store.setSidebarMode('studio')
    if (store.generationMode !== 'video') store.setGenerationMode('video')
    const video = useStore.getState()
    if (video.studioVideoWorkflow !== 'frames' && video.studioVideoWorkflow !== 'references') {
      video.setStudioVideoWorkflow('frames')
    }
    video.setParam('prompt', prompt)
    setNotice('Scene loaded into the Studio video prompt.')
  }

  function useOneWindow() {
    const studio = useStore.getState()
    studio.setParam('_duration_planning_mode', 'duration')
    studio.setDurationSeconds(studio.slidingWindowSeconds)
    setNotice('Studio duration set to one video window.')
  }

  return (
    <section aria-label="Venue Scene Builder" className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg-primary">
      <header className="shrink-0 border-b border-border bg-bg-secondary px-3 py-3 md:px-5">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-sm font-semibold text-text-primary">Scene Builder</h2>
          <nav aria-label="Scene Builder steps" className="mt-2 flex gap-1 overflow-x-auto">
            {steps.map((name, index) => (
              <button key={name} type="button" aria-current={step === index ? 'step' : undefined}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium ${step === index ? 'bg-accent-blue/15 text-accent-blue' : 'text-text-secondary hover:bg-bg-hover'}`}
                onClick={() => { setStep(index); setNotice('') }}>
                {index + 1}. {name}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <div key={step} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5">
        <div className="mx-auto max-w-5xl space-y-4">
          {step === 0 && <div className={`${panelClass} space-y-3`}>
            <Field label="Base venue">
              {id => <select id={id} className={fieldClass} value={scene.venue} onChange={event => update({ venue: event.target.value })}>
                <option value="">Choose a venue</option>
                {venuePresets.map(([name]) => <option key={name}>{name}</option>)}
                <option value="custom">Custom venue</option>
              </select>}
            </Field>
            {scene.venue === 'custom' && <TextField label="Venue name" value={scene.customVenue} onChange={customVenue => update({ customVenue })} />}
            <TextField label="Venue details" value={scene.venueDetails} onChange={venueDetails => update({ venueDetails })} multiline placeholder="Describe the layout, architecture, or landmarks." />
          </div>}
          {step === 1 && <ObjectStep objects={scene.objects} onChange={objects => update({ objects })} />}
          {step === 2 && <CharacterStep characters={scene.characters} onChange={characters => update({ characters })} />}
          {step === 3 && <div className={`${panelClass} ${gridClass}`}>
            <TextField label="Lighting" value={scene.lighting} onChange={lighting => update({ lighting })} placeholder="Soft window light from the left" />
            <TextField label="Weather" value={scene.weather} onChange={weather => update({ weather })} placeholder="Light rain outside" />
            <TextField label="Time of day" value={scene.time} onChange={time => update({ time })} placeholder="Late afternoon" />
            <TextField label="Atmosphere" value={scene.atmosphere} onChange={atmosphere => update({ atmosphere })} placeholder="Quiet, tense, or lively" />
            <TextField label="Camera" value={scene.camera} onChange={camera => update({ camera })} placeholder="Eye-level medium shot with a slow push in" />
            <TextField label="Soundscape" value={scene.soundscape} onChange={soundscape => update({ soundscape })} placeholder="Room tone and rain on the windows" />
          </div>}
          {step === 4 && <div className={`${panelClass} space-y-3`}>
            <p className="text-sm font-medium text-text-primary">{venue || 'Choose a venue'} · {scene.objects.length} objects · {scene.characters.length} characters</p>
            {missingObject && <p className="text-sm text-indicator-warning">Give each object a name and fill in any custom scale.</p>}
            {missingCharacter && <p className="text-sm text-indicator-warning">Give each character a name.</p>}
            <Field label="Scene prompt">
              {id => <textarea id={id} className={fieldClass} rows={9} value={prompt} readOnly />}
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={buttonClass} disabled={!ready} onClick={async () => {
                try {
                  await navigator.clipboard.writeText(prompt)
                  setNotice('Scene prompt copied.')
                } catch {
                  setNotice('Clipboard access was blocked. Select the scene prompt to copy it.')
                }
              }}><Copy size={14} /> Copy scene</button>
              <button type="button" className={buttonClass} disabled={!ready} onClick={useInStudio}>Use as Studio prompt</button>
              {ready && studioVideo && <div className="w-48 max-w-full"><GenerateButton stretch label="Generate scene" prepareGeneration={useInStudio} /></div>}
            </div>
            {ready && <p className="text-xs text-text-muted">{studioVideo
              ? 'Generation and queueing use the current Studio video model and references.'
              : 'Load the prompt into Studio Video to select a model and generate.'}</p>}
            {ready && studioVideo && studioHasMultipleWindows && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-text-secondary">Studio is set to multiple windows. This scene has one prompt line.</p>
                <button type="button" className={buttonClass} onClick={useOneWindow}>Use one window</button>
              </div>
            )}
            {studioVideo && studioError && <p role="alert" className="text-sm text-indicator-warning">{studioError}</p>}
            <p role="status" className="text-sm text-text-secondary">{notice}</p>
          </div>}
        </div>
      </div>
      <footer className="shrink-0 border-t border-border bg-bg-secondary px-3 py-2 md:px-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <button type="button" className={buttonClass} disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={14} /> Back</button>
          {step < steps.length - 1 && <button type="button" className={buttonClass} disabled={step === 0 && !venue} onClick={() => setStep(step + 1)}>Next <ArrowRight size={14} /></button>}
        </div>
      </footer>
    </section>
  )
}
