export interface OllamaModel {
  name: string
  size?: number
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
}

async function responseError(response: Response): Promise<Error> {
  let message = `Ollama request failed (${response.status})`
  let text = ''
  try {
    text = await response.text()
  } catch {
    return new Error(message)
  }
  try {
    const payload = JSON.parse(text) as { detail?: unknown; error?: unknown }
    if (typeof payload.detail === 'string') message = payload.detail
    else if (typeof payload.error === 'string') message = payload.error
  } catch {
    if (text) message = text.slice(0, 500)
  }
  return new Error(message)
}

export async function fetchOllamaModels(): Promise<OllamaModel[]> {
  const response = await fetch('/api/v1/ollama/models', { cache: 'no-store' })
  if (!response.ok) throw await responseError(response)
  const payload = await response.json() as { models?: OllamaModel[] }
  return Array.isArray(payload.models) ? payload.models.filter(model => typeof model.name === 'string') : []
}

export async function openOllamaChat(
  model: string,
  messages: OllamaChatMessage[],
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetch('/api/v1/ollama/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify({ model, messages }),
    signal,
  })
  if (!response.ok) throw await responseError(response)
  return response
}
