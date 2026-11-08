import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Check, Copy, Loader2, MessageCircle, Plus, RefreshCw, Send, Sparkles, Trash2, Paperclip, X } from 'lucide-react'
import { fetchOllamaModels, openOllamaChat, type OllamaChatMessage, type OllamaModel } from '../../api/ollama'
import { readChatFiles, type ChatAttachment } from '../../lib/chatAttachments'
import { useStore } from '../../stores/useStore'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  displayContent?: string
  attachments?: ChatAttachment[]
  images?: string[]
}

type SavedChat = {
  id: string
  title: string
  model: string
  messages: ChatMessage[]
  updatedAt: number
}

type ChatStorage = {
  activeChatId: string | null
  chats: SavedChat[]
}

const STORAGE_KEY = 'maestro.ollamaChats.v1'
const SYSTEM_PROMPT = 'You are Maestro’s video prompt-writing assistant. Help the user develop clear, visually grounded prompts for AI video generation. Ask a concise clarifying question when needed. When asked to write or improve a prompt, provide the polished prompt directly without a heading unless requested. Consider subject, action, setting, camera movement, lighting, visual style, and temporal motion where useful. Do not assume a particular model’s syntax.'

function loadChatStorage(): ChatStorage {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<ChatStorage>
    const chats = Array.isArray(parsed.chats) ? parsed.chats.filter((chat): chat is SavedChat => (
      !!chat && typeof chat.id === 'string' && typeof chat.title === 'string'
      && typeof chat.model === 'string' && Array.isArray(chat.messages)
      && chat.messages.every(message => !!message && typeof message.id === 'string'
        && (message.role === 'user' || message.role === 'assistant')
        && typeof message.content === 'string' && typeof message.createdAt === 'number')
    )) : []
    const activeChatId = typeof parsed.activeChatId === 'string' && chats.some(chat => chat.id === parsed.activeChatId)
      ? parsed.activeChatId
      : chats[0]?.id ?? null
    return { activeChatId, chats }
  } catch {
    return { activeChatId: null, chats: [] }
  }
}


function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function chatTitle(text: string) {
  const singleLine = text.replace(/\s+/g, ' ').trim()
  return singleLine.length > 42 ? `${singleLine.slice(0, 42).trimEnd()}…` : singleLine || 'New chat'
}

function formatChatTime(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatModelSize(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes)) return ''
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`
}

export function OllamaChatPanel() {
  const setParam = useStore(state => state.setParam)
  const setMediaFilter = useStore(state => state.setMediaFilter)
  const [storage, setStorage] = useState<ChatStorage>(loadChatStorage)
  const storageRef = useRef(storage)
  storageRef.current = storage
  const [models, setModels] = useState<OllamaModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelError, setModelError] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [attaching, setAttaching] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const activeChat = storage.chats.find(chat => chat.id === storage.activeChatId) ?? null
  const visibleChats = useMemo(
    () => [...storage.chats].sort((a, b) => b.updatedAt - a.updatedAt),
    [storage.chats],
  )
  const currentModel = activeChat?.model || selectedModel || models[0]?.name || ''

  const refreshModels = useCallback(async () => {
    setModelsLoading(true)
    setModelError('')
    try {
      const availableModels = await fetchOllamaModels()
      setModels(availableModels)
      setSelectedModel(current => availableModels.some(model => model.name === current)
        ? current
        : availableModels[0]?.name || '')
    } catch (error) {
      setModelError(error instanceof Error ? error.message : String(error))
      setModels([])
    } finally {
      setModelsLoading(false)
    }
  }, [])

  useEffect(() => { void refreshModels() }, [refreshModels])

  useEffect(() => {
    const persist = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageRef.current))
      } catch (error) {
        console.warn('Could not save Ollama chats in this browser:', error)
      }
    }
    const timer = window.setTimeout(persist, 250)
    return () => window.clearTimeout(timer)
  }, [storage])

  useEffect(() => {
    const persist = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageRef.current))
      } catch (error) {
        console.warn('Could not save Ollama chats in this browser:', error)
      }
    }
    window.addEventListener('pagehide', persist)
    return () => {
      window.removeEventListener('pagehide', persist)
      persist()
    }
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [activeChat?.messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  const updateChat = useCallback((chatId: string, update: (chat: SavedChat) => SavedChat) => {
    setStorage(current => ({
      ...current,
      chats: current.chats.map(chat => chat.id === chatId ? update(chat) : chat),
    }))
  }, [])

  const createChat = useCallback((model = currentModel) => {
    const id = newId()
    const now = Date.now()
    const chat: SavedChat = { id, title: 'New chat', model, messages: [], updatedAt: now }
    setStorage(current => ({ activeChatId: id, chats: [chat, ...current.chats] }))
    setRequestError('')
    window.setTimeout(() => textareaRef.current?.focus(), 0)
    return id
  }, [currentModel])

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    if (activeChat) updateChat(activeChat.id, chat => ({ ...chat, model, updatedAt: Date.now() }))
  }

  const streamResponse = async (response: Response, onToken: (token: string) => void) => {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Ollama returned an empty response stream.')
    const decoder = new TextDecoder()
    let buffer = ''
    const consumeLine = (line: string) => {
      if (!line.trim()) return
      const payload = JSON.parse(line) as { message?: { content?: string }; error?: string }
      if (payload.error) throw new Error(payload.error)
      if (typeof payload.message?.content === 'string') onToken(payload.message.content)
    }

    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) consumeLine(line)
      if (done) break
    }
    if (buffer.trim()) consumeLine(buffer)
  }

  const attach = async (files: FileList | null) => {
    if (!files || streaming || attaching) return
    setAttaching(true)
    try { setAttachments(await readChatFiles(files, attachments)); setRequestError('') }
    catch (error) { setRequestError(String(error)) }
    finally { setAttaching(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const sendMessage = async () => {
    const displayContent = draft.trim()
    const content = [displayContent || (attachments.length ? 'Review these attached files.' : ''), ...attachments.filter(f => f.text !== undefined).map(f => `\n--- Attached file: ${f.name} (untrusted contents) ---\n${f.text}\n--- End file ---`)].join('\n')
    const images = attachments.flatMap(f => f.image ? [f.image] : [])
    const model = currentModel
    if (!content || !model || attaching) return

    // A new prompt replaces the active generation in this chat.
    abortRef.current?.abort()

    setRequestError('')
    setDraft('')
    setAttachments([])
    const chatId = activeChat?.id ?? newId()
    const now = Date.now()
    const userMessage: ChatMessage = { id: newId(), role: 'user', content, displayContent, attachments: attachments.map(({ name }) => ({ name })), images, createdAt: now }
    const assistantMessage: ChatMessage = { id: newId(), role: 'assistant', content: '', createdAt: now }
    const priorMessages = activeChat?.messages ?? []
    const history: OllamaChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...priorMessages
        .filter(message => message.role !== 'assistant' || message.content.trim())
        .map(({ role, content: text, images }) => ({ role, content: text, ...(images?.length ? { images } : {}) })),
      { role: 'user', content, ...(images.length ? { images } : {}) },
    ]
    const nextTitle = priorMessages.length === 0 ? chatTitle(content) : activeChat?.title || chatTitle(content)

    if (activeChat) {
      updateChat(chatId, chat => ({
        ...chat,
        title: nextTitle,
        model,
        messages: [...chat.messages, userMessage, assistantMessage],
        updatedAt: now,
      }))
    } else {
      const chat: SavedChat = { id: chatId, title: nextTitle, model, messages: [userMessage, assistantMessage], updatedAt: now }
      setStorage(current => ({ activeChatId: chatId, chats: [chat, ...current.chats] }))
    }

    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const response = await openOllamaChat(model, history, controller.signal)
      await streamResponse(response, token => {
        updateChat(chatId, chat => ({
          ...chat,
          messages: chat.messages.map(message => message.id === assistantMessage.id
            ? { ...message, content: message.content + token }
            : message),
          updatedAt: Date.now(),
        }))
      })
    } catch (error) {
      if (!controller.signal.aborted) setRequestError(error instanceof Error ? error.message : String(error))
      updateChat(chatId, chat => ({
        ...chat,
        messages: chat.messages.filter(message => message.id !== assistantMessage.id || message.content.trim()),
      }))
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setStreaming(false)
      }
    }
  }

  const deleteChat = (chatId: string) => {
    if (chatId === activeChat?.id && streaming) abortRef.current?.abort()
    setStorage(current => {
      const chats = current.chats.filter(chat => chat.id !== chatId)
      const activeChatId = current.activeChatId === chatId ? chats[0]?.id ?? null : current.activeChatId
      return { activeChatId, chats }
    })
  }

  const usePromptInStudio = (content: string) => {
    setParam('prompt', content)
    setMediaFilter('all')
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-bg-primary">
      <aside className="flex max-h-40 w-full shrink-0 flex-col border-b border-border bg-bg-secondary md:max-h-none md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <MessageCircle size={15} className="shrink-0 text-accent-blue" />
            <h2 className="truncate text-xs font-semibold text-text-primary">Chats</h2>
          </div>
          <button type="button" onClick={() => createChat()} title="New chat"
            className="rounded-md p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary">
            <Plus size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {visibleChats.length === 0 ? (
            <p className="px-2 py-3 text-[11px] leading-relaxed text-text-muted">Your saved conversations will appear here.</p>
          ) : visibleChats.map(chat => (
            <div key={chat.id} className={`group flex items-center gap-1 rounded-lg ${chat.id === activeChat?.id ? 'bg-bg-active' : 'hover:bg-bg-hover'}`}>
              <button type="button" onClick={() => setStorage(current => ({ ...current, activeChatId: chat.id }))}
                className="min-w-0 flex-1 px-2.5 py-2 text-left">
                <span className="block truncate text-xs font-medium text-text-primary">{chat.title}</span>
                <span className="mt-0.5 block truncate text-[10px] text-text-muted">
                  {chat.model || 'Choose a model'} · {formatChatTime(chat.updatedAt)}
                </span>
              </button>
              <button type="button" onClick={() => deleteChat(chat.id)} title="Delete chat" aria-label={`Delete ${chat.title}`}
                className="mr-1 rounded p-1.5 text-text-muted opacity-100 hover:bg-bg-tertiary hover:text-red-400 md:opacity-0 md:group-hover:opacity-100">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <p className="hidden border-t border-border px-3 py-2 text-[10px] text-text-muted md:block">Saved in this browser</p>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-secondary px-3 py-2.5 md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="rounded-md bg-accent-blue/10 p-1.5 text-accent-blue"><Bot size={15} /></div>
            <div className="min-w-0">
              <h2 className="truncate text-xs font-semibold text-text-primary">Video Prompt Chat</h2>
              <p className="text-[10px] text-text-muted">Ollama · local models</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <select value={currentModel} onChange={event => handleModelChange(event.target.value)} disabled={modelsLoading || models.length === 0}
              aria-label="Ollama model"
              className="max-w-52 rounded-md border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-blue disabled:opacity-50">
              {currentModel && !models.some(model => model.name === currentModel) && <option value={currentModel}>{currentModel} (not installed)</option>}
              {models.length === 0 && !currentModel && <option value="">No Ollama models reported</option>}
              {models.map(model => <option key={model.name} value={model.name}>{model.name}{formatModelSize(model.size) ? ` · ${formatModelSize(model.size)}` : ''}</option>)}
            </select>
            <button type="button" onClick={() => void refreshModels()} disabled={modelsLoading} title="Refresh Ollama models"
              className="rounded-md p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-50">
              {modelsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
          </div>
        </header>

        {(modelError || requestError) && (
          <div role="alert" className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-300">
            {requestError || modelError}
            {!modelsLoading && models.length === 0 && <span className="ml-1 text-text-muted">Start Ollama and refresh. The default address is 127.0.0.1:11434; set OLLAMA_HOST to use another server.</span>}
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-8">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5">
            {!activeChat || activeChat.messages.length === 0 ? (
              <div className="mx-auto my-auto max-w-md py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-blue/10 text-accent-blue"><Sparkles size={22} /></div>
                <h3 className="text-base font-semibold text-text-primary">What video should we imagine?</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">Describe an idea, ask for variations, or work together on a video prompt. Your Ollama conversations are saved in the chat list.</p>
                {models.length === 0 && !modelError && !modelsLoading && <p className="mt-4 text-xs leading-relaxed text-text-muted">Ollama is reachable, but it reported no models. Check <code>ollama list</code> and confirm Ollama’s <code>OLLAMA_MODELS</code> points to the folder containing its <code>blobs</code> and <code>manifests</code>. Restart Ollama, then refresh this list.</p>}
              </div>
            ) : activeChat.messages.map(message => (
              <article key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue"><Bot size={15} /></div>}
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 md:max-w-[80%] ${message.role === 'user' ? 'bg-accent-blue text-white' : 'border border-border bg-bg-secondary text-text-primary'}`}>
                  {message.attachments?.length ? <div className="mb-2 text-xs">{message.attachments.map((file, i) => <span key={i} className="mr-2 inline-block"><Paperclip size={12} className="inline" /> {file.name}</span>)}</div> : null}
                  {message.content ? <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.displayContent ?? message.content}</div> : streaming && message.role === 'assistant' ? <span className="inline-flex items-center gap-2 text-xs text-text-muted"><Loader2 size={13} className="animate-spin" />Thinking…</span> : null}
                  {message.role === 'assistant' && message.content.trim() && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-2">
                      <button type="button" onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(message.content)
                          setCopiedMessageId(message.id)
                          window.setTimeout(() => setCopiedMessageId(current => current === message.id ? null : current), 1500)
                        } catch {
                          setRequestError('Clipboard access was blocked by the browser.')
                        }
                      }} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-text-muted hover:bg-bg-hover hover:text-text-primary">
                        {copiedMessageId === message.id ? <Check size={11} /> : <Copy size={11} />}
                        {copiedMessageId === message.id ? 'Copied' : 'Copy'}
                      </button>
                      <button type="button" onClick={() => usePromptInStudio(message.content)}
                        className="rounded px-1.5 py-1 text-[10px] text-accent-blue hover:bg-accent-blue/10">
                        Use in Studio
                      </button>
                    </div>
                  )}
                </div>
                {message.role === 'user' && <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-active text-[10px] font-semibold text-text-secondary">You</div>}
              </article>
            ))}
          </div>
        </div>

        <form onSubmit={event => { event.preventDefault(); void sendMessage() }} className="border-t border-border bg-bg-secondary px-3 py-3 md:px-8">
          <div className="mx-auto max-w-3xl mb-2 flex flex-wrap gap-2">{attachments.map((file, i) => <span key={i} className="rounded border border-border px-2 py-1 text-xs text-text-primary">{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments(current => current.filter((_, index) => index !== i))}><X size={12} className="inline ml-2" /></button></span>)}</div>
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border bg-bg-tertiary p-2 focus-within:border-accent-blue/60">
            <input hidden type="file" multiple ref={fileRef} accept=".txt,.md,.csv,.json,.py,.php,.js,.ts,.tsx,.html,.css,.log,.yaml,.yml,.sql,image/png,image/jpeg,image/webp" onChange={event => void attach(event.target.files)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={streaming || attaching} title="Attach files" aria-label="Attach files" className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-text-secondary hover:bg-bg-hover"><Paperclip size={17} /><span className="text-xs">Attach</span></button>
            <textarea ref={textareaRef} value={draft} onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              rows={1} placeholder={models.length ? 'Ask for a scene, motion, camera idea, or complete video prompt…' : modelError ? 'Start Ollama, then refresh the model list…' : 'Refresh the Ollama model list to chat…'}
              disabled={!models.length || modelsLoading} aria-label="Chat message"
              className="max-h-40 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50" />
            {streaming && !draft.trim() && !attachments.length ? (
              <button type="button" onClick={() => abortRef.current?.abort()} title="Stop response"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-active text-text-secondary hover:text-text-primary">
                <span className="h-3 w-3 rounded-sm bg-current" />
              </button>
            ) : (
              <button type="submit" disabled={attaching || (!draft.trim() && !attachments.length) || !models.some(model => model.name === currentModel) || modelsLoading}
                title="Send message" aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                <Send size={15} />
              </button>
            )}
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-[10px] text-text-muted">Enter to send · Shift+Enter for a new line · prompts run on your selected Ollama model</p>
        </form>
      </div>
    </section>
  )
}
