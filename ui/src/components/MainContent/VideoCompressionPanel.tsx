import { useEffect, useMemo, useState } from 'react'
import { Loader2, Minimize2, RefreshCw } from 'lucide-react'
import { compressOutput } from '../../api/client'
import { useStore } from '../../stores/useStore'
import type { OutputFile } from '../../types'

function outputKey(output: OutputFile) {
  return JSON.stringify([output.workspace || 'default', output.name])
}

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function isCompressedOutput(name: string) {
  return /_compressed(?:_\d+)?\.mp4$/i.test(name)
}

export function VideoCompressionPanel() {
  const outputs = useStore(s => s.outputs)
  const outputsTotal = useStore(s => s.outputsTotal)
  const outputsLoading = useStore(s => s.outputsLoading)
  const loadMoreOutputs = useStore(s => s.loadMoreOutputs)
  const refreshOutputs = useStore(s => s.refreshOutputs)
  const browsingUploads = useStore(s => s.browsingUploads)
  const activeWorkspace = useStore(s => s.activeWorkspace)
  const [selectedKey, setSelectedKey] = useState('')
  const [quality, setQuality] = useState(28)
  const [preset, setPreset] = useState('medium')
  const [replaceOriginal, setReplaceOriginal] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [status, setStatus] = useState('')

  const videos = useMemo(
    () => outputs.filter(output => output.type === 'video' && !isCompressedOutput(output.name)),
    [outputs],
  )
  const selectedVideo = videos.find(output => outputKey(output) === selectedKey) || videos[0] || null
  const replaceSupported = !!selectedVideo && selectedVideo.name.toLowerCase().endsWith('.mp4')
  const hasMore = outputs.length < outputsTotal

  useEffect(() => {
    if (!videos.some(video => outputKey(video) === selectedKey)) {
      setSelectedKey(videos[0] ? outputKey(videos[0]) : '')
    }
  }, [videos, selectedKey])

  useEffect(() => {
    if (!replaceSupported) setReplaceOriginal(false)
  }, [replaceSupported])

  const handleCompress = async () => {
    if (!selectedVideo || compressing || browsingUploads) return
    setCompressing(true)
    setStatus('Compressing with FFmpeg. Large videos may take a while…')
    try {
      const result = await compressOutput(
        selectedVideo.name,
        selectedVideo.workspace || activeWorkspace,
        quality,
        preset,
        replaceOriginal,
      )
      setStatus(result.replaced_original
        ? `Replaced ${result.name}: ${formatSize(result.original_size)} → ${formatSize(result.compressed_size)}.`
        : `Saved ${result.name}: ${formatSize(result.original_size)} → ${formatSize(result.compressed_size)}. Original preserved.`)
      await refreshOutputs()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setCompressing(false)
    }
  }

  return (
    <section className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-bg-secondary p-4 md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-accent-blue/10 p-2 text-accent-blue">
            <Minimize2 size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Compress a generated video</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Create a smaller H.264 MP4 with FFmpeg. Maestro keeps the original video.
            </p>
          </div>
        </div>

        {browsingUploads ? (
          <p className="rounded-lg border border-border bg-bg-tertiary p-3 text-xs text-text-secondary">
            Switch from Uploads to an output workspace to compress a generated video.
          </p>
        ) : videos.length === 0 ? (
          <p className="rounded-lg border border-border bg-bg-tertiary p-3 text-xs text-text-secondary">
            No videos found in this view. Generate a video or switch to a workspace containing one.
          </p>
        ) : (
          <>
            <label className="mb-4 block text-xs text-text-secondary">
              Video
              <select
                value={selectedVideo ? outputKey(selectedVideo) : ''}
                onChange={event => setSelectedKey(event.target.value)}
                disabled={compressing}
                className="mt-1.5 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
              >
                {videos.map(video => (
                  <option key={outputKey(video)} value={outputKey(video)}>
                    {video.workspace && video.workspace !== activeWorkspace ? `${video.workspace} / ` : ''}
                    {video.name} · {formatSize(video.size)}
                  </option>
                ))}
              </select>
            </label>

            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs text-text-secondary">
                Quality: {quality} <span className="text-text-muted">(higher means smaller)</span>
                <input
                  type="range"
                  min={18}
                  max={35}
                  step={1}
                  value={quality}
                  onChange={event => setQuality(Number(event.target.value))}
                  disabled={compressing}
                  className="mt-2 block w-full accent-blue-500"
                />
              </label>
              <label className="block text-xs text-text-secondary">
                Encoding speed
                <select
                  value={preset}
                  onChange={event => setPreset(event.target.value)}
                  disabled={compressing}
                  className="mt-1.5 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
                >
                  <option value="fast">Fast</option>
                  <option value="medium">Balanced</option>
                  <option value="slow">Smaller file</option>
                </select>
              </label>
            </div>

            <label className={`mb-4 flex items-start gap-2 text-xs ${replaceSupported ? 'text-text-secondary' : 'text-text-muted'}`}>
              <input
                type="checkbox"
                checked={replaceOriginal}
                onChange={event => setReplaceOriginal(event.target.checked)}
                disabled={!replaceSupported || compressing}
                className="mt-0.5 accent-blue-500"
              />
              <span>
                Delete original and replace it with compressed MP4
                {replaceSupported && <span className="block text-[11px] text-text-muted">Maestro replaces it only after compression succeeds.</span>}
                {!replaceSupported && <span className="block text-[11px] text-text-muted">Available for MP4 sources; other formats are saved as a separate MP4.</span>}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCompress()}
                disabled={!selectedVideo || compressing}
                className="flex items-center gap-2 rounded-lg bg-accent-blue px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {compressing ? <Loader2 size={14} className="animate-spin" /> : <Minimize2 size={14} />}
                {compressing ? 'Compressing…' : 'Compress video'}
              </button>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => void loadMoreOutputs()}
                  disabled={outputsLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                >
                  {outputsLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Load more videos
                </button>
              )}
            </div>
          </>
        )}

        {status && (
          <p role="status" className="mt-4 whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-tertiary p-3 text-xs text-text-secondary">
            {status}
          </p>
        )}
      </div>
    </section>
  )
}
