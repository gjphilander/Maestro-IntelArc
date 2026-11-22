import { useState } from 'react'
import { combineOutputs } from '../../api/client'
import { useStore } from '../../stores/useStore'

type Clip = { workspace: string; name: string }

export function CombinePanel() {
  const outputs = useStore(s => s.outputs)
  const active = useStore(s => s.activeWorkspace)
  const uploads = useStore(s => s.browsingUploads)
  const more = useStore(s => s.loadMoreOutputs)
  const total = useStore(s => s.outputsTotal)
  const loading = useStore(s => s.outputsLoading)
  const refresh = useStore(s => s.refreshOutputs)
  const [queue, setQueue] = useState<Clip[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const button = 'rounded border border-border px-3 py-2 hover:bg-bg-tertiary disabled:opacity-40'
  async function combine() {
    setBusy(true)
    setStatus('Combining clips with FFmpeg…')
    try {
      const result = await combineOutputs(queue, active)
      setStatus(`Saved ${result.name} in ${result.workspace}.`)
      await refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  const videos = outputs.filter(o => o.type === 'video')
  return <section className="flex-1 overflow-y-auto p-4 md:p-8">
    <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-bg-secondary p-5 text-sm text-text-primary">
      <h2 className="font-semibold">Combine clips</h2>
      {uploads ? <p>Switch to an output workspace to select clips.</p> : <>
        <label className="block">Add a video
          <select disabled={busy} value="" onChange={e => {
            const clip = JSON.parse(e.target.value) as Clip
            setQueue(q => [...q, clip])
            setStatus('')
          }} className="mt-2 block w-full rounded border border-border bg-bg-tertiary p-2">
            <option value="">{videos.length ? 'Choose a clip…' : 'No videos in this view'}</option>
            {videos.map(o => {
              const key = JSON.stringify({ workspace: o.workspace || active, name: o.name })
              return <option key={key} value={key}>{o.name} · {o.workspace || active}</option>
            })}
          </select>
        </label>
        {outputs.length < total && <button className={button} disabled={loading} onClick={() => void more()}>Load more clips</button>}
        <p className="text-text-secondary">Clips play from top to bottom. The first clip sets the frame size.</p>
        <ol className="space-y-2">{queue.map((clip, i) =>
          <li key={i} className="flex items-center gap-3 rounded border border-border p-2">
            <span>{i + 1}.</span><span className="flex-1 break-all">{clip.name}</span>
            <button className={button} disabled={busy} aria-label={`Remove clip ${i + 1}`} onClick={() => setQueue(q => q.filter((_, j) => i !== j))}>Remove</button>
          </li>)}</ol>
        <button className={button} disabled={busy || queue.length < 2} onClick={combine}>{busy ? 'Combining…' : 'Combine clips'}</button>
        <p role="status">{status}</p>
      </>}
    </div>
  </section>
}

