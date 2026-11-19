import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

type SpeechResult = { isFinal: boolean; 0: { transcript: string } }
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

const errors: Record<string, string> = {
  'not-allowed': 'Microphone access was denied. Allow the microphone in your browser site settings, then try again.',
  'service-not-allowed': 'Speech recognition is unavailable here. Open Maestro in Chrome or Edge and allow microphone access.',
  'audio-capture': 'No microphone is available. Connect a microphone and check your system input settings.',
  network: 'The speech service could not connect. Check your internet connection and try again in Chrome or Edge.',
  'no-speech': 'No speech was detected. Click the microphone and try speaking again.',
  'language-not-supported': 'The speech service does not support this language. Try another browser or speech language in your browser settings.',
}

export function ChatDictation({ disabled, onText, onActiveChange }: {
  disabled: boolean
  onText: (text: string) => void
  onActiveChange: (active: boolean) => void
}) {
  const [active, setActive] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef<Recognition | null>(null)
  const callbacks = useRef({ onText, onActiveChange })
  useEffect(() => { callbacks.current = { onText, onActiveChange } }, [onText, onActiveChange])

  useEffect(() => () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null
      recognition.abort()
    }
    callbacks.current.onActiveChange(false)
  }, [])

  const toggle = () => {
    const current = recognitionRef.current
    if (current) {
      setStopping(true)
      // Wait for the final result before enabling Send.
      current.stop()
      return
    }
    setError('')
    const speechWindow = window as SpeechWindow
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!window.isSecureContext) {
      setError('Microphone dictation needs localhost or HTTPS. Open Maestro on this PC using its localhost address, or use its secure HTTPS address.')
      return
    }
    if (!Constructor) {
      setError('This browser does not support speech dictation. Open Maestro in Chrome or Edge to use the microphone.')
      return
    }
    try {
      const recognition = new Constructor()
      recognition.lang = navigator.language || 'en-ZA'
      recognition.continuous = true
      recognition.interimResults = true
      const committed = new Set<number>()
      recognition.onresult = event => {
        if (recognitionRef.current !== recognition) return
        const pending: string[] = []
        const completed: string[] = []
        for (let index = 0; index < event.results.length; index++) {
          const result = event.results[index]
          if (result.isFinal) {
            if (!committed.has(index)) {
              committed.add(index)
              completed.push(result[0].transcript.trim())
            }
          } else pending.push(result[0].transcript)
        }
        const text = completed.filter(Boolean).join(' ')
        if (text) callbacks.current.onText(text)
        setPreview(pending.join(' '))
      }
      recognition.onerror = event => {
        if (recognitionRef.current !== recognition) return
        if (event.error !== 'aborted') setError(errors[event.error] || 'Speech recognition failed. Click the microphone to try again.')
        // Release the UI even if the browser fails to dispatch an end event.
        finish()
        recognition.abort()
      }
      const finish = () => {
        if (recognitionRef.current !== recognition) return
        recognitionRef.current = null
        setActive(false)
        setStopping(false)
        setPreview('')
        callbacks.current.onActiveChange(false)
      }
      recognition.onend = finish
      recognitionRef.current = recognition
      setActive(true)
      setStopping(false)
      callbacks.current.onActiveChange(true)
      recognition.start()
    } catch {
      recognitionRef.current?.abort()
      recognitionRef.current = null
      setActive(false)
      setStopping(false)
      callbacks.current.onActiveChange(false)
      setError('Could not start the microphone. Check microphone permissions and try again in Chrome or Edge.')
    }
  }

  return (
    <>
      <button type="button" onClick={toggle} disabled={stopping || (disabled && !active)}
        aria-label={active ? 'Stop dictation' : 'Dictate message'} aria-pressed={active}
        title={active ? 'Stop dictation' : 'Speak to enter text (browser speech service; may need internet)'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-40 ${active ? 'bg-red-500/15 text-red-400' : 'text-text-secondary hover:bg-bg-hover'}`}>
        {active ? <Square size={16} /> : <Mic size={17} />}
      </button>
      {(active || error) && <div className="order-last basis-full px-2 pb-1 text-xs">
        {active && <p role="status" className="text-accent-blue">{stopping ? 'Finishing dictation…' : 'Listening… Speak, then click Stop to review and send.'}</p>}
        {preview && <p className="mt-1 break-words text-text-muted">{preview}</p>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
      </div>}
    </>
  )
}
