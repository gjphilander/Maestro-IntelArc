export type ChatAttachment = { name: string; text?: string; image?: string }

export async function readChatFiles(files: FileList, previous: ChatAttachment[]): Promise<ChatAttachment[]> {
  if (previous.length + files.length > 5) throw new Error('Attach up to five files per message.')
  const result = [...previous]
  for (const file of Array.from(files)) {
    if (file.size > 2 * 1024 * 1024) throw new Error(`${file.name}: maximum file size is 2 MB.`)
    if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
        reader.readAsDataURL(file)
      })
      result.push({ name: file.name, image })
    } else {
      if (!/\.(txt|md|csv|json|jsonl|py|php|js|ts|tsx|jsx|html|css|log|yaml|yml|sql|xml|toml|ini|sh|ps1)$/i.test(file.name)) throw new Error(`${file.name}: choose a text/code file or PNG/JPEG/WebP image. PDF and Word are not supported yet.`)
      if (file.size > 100 * 1024) throw new Error(`${file.name}: text files must be under 100 KB.`)
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
      if (text.includes('\0')) throw new Error(`${file.name}: binary files are unsupported.`)
      result.push({ name: file.name, text })
    }
  }
  if (JSON.stringify(result).length > 8 * 1024 * 1024) throw new Error('Attachments are too large; send fewer images.')
  return result
}
