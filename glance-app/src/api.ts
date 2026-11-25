// Glance — backend client. Single origin, set at build time via
// VITE_GLANCE_API (production = Vercel URL); dev fallback is localhost.
export const API_BASE =
  (import.meta.env.VITE_GLANCE_API as string | undefined) || 'http://localhost:3101'

export interface DigestItem {
  channel: string
  id: number | null
  link: string
  time: string | null
  text: string
  headline: string
}

export interface DigestResponse {
  items: DigestItem[]
  channels: string[]
  failed: string[]
  fetchedAt: string
}

export async function fetchDigest(channels: string[]): Promise<DigestResponse> {
  const q = encodeURIComponent(channels.join(','))
  const res = await fetch(`${API_BASE}/api/digest?channels=${q}`)
  if (!res.ok) throw new Error(`digest HTTP ${res.status}`)
  return res.json()
}

export interface DraftResponse {
  draft: string
  chips: string[]
  lang: string
}

export async function fetchDraft(text: string, lang = 'id'): Promise<DraftResponse> {
  const res = await fetch(`${API_BASE}/api/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
  })
  if (!res.ok) throw new Error(`draft HTTP ${res.status}`)
  return res.json()
}

export interface ShareLinks {
  shareUrl: string
  tgMsg: string
}

export async function fetchShareLinks(text: string, link: string): Promise<ShareLinks> {
  const res = await fetch(
    `${API_BASE}/api/share?text=${encodeURIComponent(text)}&link=${encodeURIComponent(link)}`,
  )
  if (!res.ok) throw new Error(`share HTTP ${res.status}`)
  return res.json()
}

/** POST raw PCM (s16le mono 16kHz) to /api/stt. Returns transcript text. */
export async function postStt(pcm: Uint8Array): Promise<string> {
  const wav = pcmToWav(pcm)
  const res = await fetch(`${API_BASE}/api/stt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: wav.buffer as ArrayBuffer,
  })
  if (res.status === 501) throw new Error('STT_UNAVAILABLE')
  if (!res.ok) throw new Error(`stt HTTP ${res.status}`)
  const data = await res.json()
  return (data.text || '').trim()
}

function pcmToWav(pcm: Uint8Array): Uint8Array {
  const out = new Uint8Array(44 + pcm.length)
  const dv = new DataView(out.buffer)
  const wstr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  wstr(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length, true); wstr(8, 'WAVE')
  wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true)
  dv.setUint16(22, 1, true); dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true)
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  wstr(36, 'data'); dv.setUint32(40, pcm.length, true)
  out.set(pcm, 44)
  return out
}
