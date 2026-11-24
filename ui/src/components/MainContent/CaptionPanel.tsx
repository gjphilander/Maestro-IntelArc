import { useEffect, useState, type FormEvent } from 'react'
import { Captions, Download, LoaderCircle } from 'lucide-react'
import { captionVideo, fetchCaptionDubbingLanguages, getFileUrl, type CaptionDubbingEngine } from '../../api/client'
import { useStore } from '../../stores/useStore'

const formats = '.mp4,.mov,.m4v,.mkv,.avi,.webm'
const maxUploadBytes = 1024 ** 3

// Language codes from the M2M100 tokenizer used by the caption exporter.
const translationCodes = [
  'af am ar ast az ba be bg bn br bs ca ceb cs cy da de el en es et fa ff fi fr fy ga gd gl gu',
  'ha he hi hr ht hu hy id ig ilo is it ja jv ka kk km kn ko lb lg ln lo lt lv mg mk ml mn mr',
  'ms my ne nl no ns oc or pa pl ps pt ro ru sd si sk sl so sq sr ss su sv sw ta th tl tn tr',
  'uk ur uz vi wo xh yi yo zh zu',
].join(' ').split(' ')
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' })
const captionLanguages = translationCodes
  .map(code => ({ code, label: languageNames.of(code === 'ns' ? 'nso' : code) || code }))
  .sort((first, second) => first.label.localeCompare(second.label, 'en'))

export function CaptionPanel({ hidden }: { hidden: boolean }) {
  const workspace = useStore(s => s.activeWorkspace)
  const refreshOutputs = useStore(s => s.refreshOutputs)
  const [file, setFile] = useState<File | null>(null)
  const [fontSize, setFontSize] = useState(21)
  const [fontColor, setFontColor] = useState('#ffffff')
  const [outlineColor, setOutlineColor] = useState('#000000')
  const [targetLanguage, setTargetLanguage] = useState('')
  const [dubAudio, setDubAudio] = useState(false)
  const [dubbingVoices, setDubbingVoices] = useState<Awaited<ReturnType<typeof fetchCaptionDubbingLanguages>> | null>(null)
  const [selectedEngine, setSelectedEngine] = useState<CaptionDubbingEngine | null>(null)
  const [dubbingError, setDubbingError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof captionVideo>> | null>(null)
  const url = result ? getFileUrl(result.name, result.workspace) : ''

  const canUseNeural = dubbingVoices?.omnivoice_languages?.includes(targetLanguage) === true
  const canUseStandard = dubbingVoices?.languages.includes(targetLanguage) === true
  const canDub = canUseNeural || canUseStandard
  const defaultEngine = canUseNeural ? 'omnivoice' : 'espeak'
  const dubbingEngine = canUseNeural && canUseStandard ? selectedEngine ?? defaultEngine : defaultEngine

  useEffect(() => {
    if (hidden || !targetLanguage) return
    const controller = new AbortController()
    void fetchCaptionDubbingLanguages(controller.signal)
      .then(setDubbingVoices)
      .catch(() => {
        if (!controller.signal.aborted) setDubbingError(true)
      })
    return () => controller.abort()
  }, [hidden, targetLanguage])

  async function exportVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || busy) return
    if (file.size > maxUploadBytes) {
      setError('Choose a video smaller than 1 GB.')
      return
    }

    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await captionVideo(file, workspace, {
        fontSize, fontColor, outlineColor, targetLanguage, dubAudio: canDub && dubAudio, dubbingEngine,
      }))
      void refreshOutputs()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not export the captioned video.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section hidden={hidden} className="flex-1 overflow-y-auto p-4 md:p-8" aria-labelledby="captions-heading">
      <div className="mx-auto max-w-2xl space-y-5 rounded-xl border border-border bg-bg-secondary p-5 text-sm text-text-primary">
        <div className="space-y-1">
          <h2 id="captions-heading" className="flex items-center gap-2 font-semibold">
            <Captions size={18} aria-hidden="true" /> Auto Captions
          </h2>
          <p className="text-text-secondary">Upload a video to transcribe its speech locally and burn the captions into an MP4.</p>
        </div>

        <form onSubmit={exportVideo} className="space-y-3">
          <div>
            <label htmlFor="caption-video" className="font-medium">Video file</label>
            <input
              id="caption-video"
              type="file"
              accept={formats}
              disabled={busy}
              aria-describedby="caption-limits"
              onChange={event => {
                setFile(event.target.files?.[0] || null)
                setError('')
                setResult(null)
              }}
              className="mt-2 block w-full rounded-lg border border-border bg-bg-tertiary p-2 file:mr-3 file:rounded file:border-0 file:bg-bg-active file:px-3 file:py-1.5 file:text-text-primary"
            />
            <p id="caption-limits" className="mt-2 text-xs text-text-secondary">
              MP4, MOV, M4V, MKV, AVI, or WebM. Up to 1 GB and 30 minutes.
            </p>
          </div>

          <div>
            <label htmlFor="caption-language" className="font-medium">Caption language</label>
            <select
              id="caption-language"
              value={targetLanguage}
              onChange={event => {
                setTargetLanguage(event.target.value)
                setDubAudio(false)
                setSelectedEngine(null)
                setDubbingError(false)
              }}
              disabled={busy}
              aria-describedby={targetLanguage ? 'caption-language-help' : undefined}
              className="mt-2 block w-full max-w-xs rounded-lg border border-border bg-bg-tertiary p-2 text-text-primary"
            >
              <option value="">Original language</option>
              <optgroup label="Translate captions to">
                {captionLanguages.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
              </optgroup>
            </select>
            {targetLanguage && (
              <p id="caption-language-help" className="mt-2 text-xs text-text-secondary">
                The first translation may download a local model of about 500 MB.
              </p>
            )}
          </div>

          {targetLanguage && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={dubAudio}
                  onChange={event => setDubAudio(event.target.checked)}
                  disabled={busy || !canDub}
                  aria-describedby="caption-dubbing-help"
                  className="accent-accent-blue"
                />
                Dub translated audio
              </label>
              <p id="caption-dubbing-help" className="text-xs text-text-secondary">
                {canDub
                  ? 'Keep the separated music and sound effects. The first dub may download about 335 MB for soundtrack separation.'
                  : dubbingError
                    ? 'Dubbing voices are currently unavailable.'
                    : dubbingVoices
                      ? 'No local dubbing voice is available for this language.'
                      : 'Checking for a local dubbing voice…'}
              </p>
              {dubbingVoices && !dubbingVoices.omnivoice_languages?.length && (
                <p className="text-xs text-text-secondary">For a neural voice, choose Install OmniVoice Dubbing in Pinokio.</p>
              )}
              {dubAudio && canDub && (
                <label className="block max-w-xs text-sm">
                  Dubbing voice
                  <select
                    value={dubbingEngine}
                    onChange={event => setSelectedEngine(event.target.value === 'omnivoice' ? 'omnivoice' : 'espeak')}
                    disabled={busy}
                    className="mt-1 block w-full rounded-lg border border-border bg-bg-tertiary p-2 text-text-primary"
                  >
                    {canUseNeural && <option value="omnivoice">OmniVoice (neural)</option>}
                    {canUseStandard && <option value="espeak">eSpeak NG (basic)</option>}
                  </select>
                  {dubbingEngine === 'omnivoice' && (
                    <span className="mt-1 block text-xs text-text-secondary">First use downloads the OmniVoice model, about 3.3 GB.</span>
                  )}
                </label>
              )}
            </div>
          )}

          <div className="max-w-xs">
            <label htmlFor="caption-font-size" className="flex justify-between font-medium">
              Font size <span className="tabular-nums text-text-secondary">{fontSize}</span>
            </label>
            <input
              id="caption-font-size"
              type="range"
              min={12}
              max={36}
              step={1}
              value={fontSize}
              onChange={event => setFontSize(event.target.valueAsNumber)}
              disabled={busy}
              className="mt-2 block w-full accent-accent-blue"
            />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="color"
                value={fontColor}
                onChange={event => setFontColor(event.target.value)}
                disabled={busy}
                className="h-8 w-10 rounded border border-border bg-bg-tertiary p-0.5"
              />
              Font color
            </label>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="color"
                value={outlineColor}
                onChange={event => setOutlineColor(event.target.value)}
                disabled={busy}
                className="h-8 w-10 rounded border border-border bg-bg-tertiary p-0.5"
              />
              Border color
            </label>
          </div>

          <button
            type="submit"
            disabled={busy || !file}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-blue/15 px-3 py-2 font-medium text-accent-blue hover:bg-accent-blue/25 disabled:opacity-45"
          >
            {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
            {busy ? 'Exporting…' : 'Export captioned video'}
          </button>
        </form>

        <div role="status">
          {busy && <p className="text-text-secondary">
            {dubAudio
              ? 'Transcribing, translating, separating the soundtrack, and dubbing. This can take several minutes.'
              : targetLanguage
                ? 'Uploading, transcribing, translating, and rendering. This can take a few minutes.'
                : 'Uploading, transcribing, and rendering. This can take a few minutes.'}
          </p>}
          {result && <p>Saved to <strong>{result.workspace}</strong>.</p>}
        </div>
        {error && <p role="alert" className="text-red-400">{error}</p>}
        {result && (
          <div className="space-y-3">
            <video controls preload="metadata" src={url} className="max-h-[55vh] w-full rounded-lg bg-black" aria-label="Captioned video preview" />
            <a href={url} download={result.name} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-bg-tertiary">
              <Download size={16} aria-hidden="true" /> Download MP4
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

