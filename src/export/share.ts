import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Message } from '../model/embed'
import { parseImport, toWebhookPayload } from './json'

export function encodeShare(m: Message): string {
  return compressToEncodedURIComponent(JSON.stringify(toWebhookPayload(m)))
}

export function decodeShare(hash: string): Message | null {
  const code = hash.replace(/^#/, '').replace(/^m=/, '')
  if (!code) return null
  let json: string | null
  try {
    json = decompressFromEncodedURIComponent(code)
  } catch {
    return null
  }
  if (!json) return null
  const result = parseImport(json)
  return result.ok ? result.message : null
}

export function shareUrl(m: Message, base: string): string {
  return `${base}#m=${encodeShare(m)}`
}
