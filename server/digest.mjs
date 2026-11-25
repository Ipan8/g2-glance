// Glance backend — Telegram digest from PUBLIC channel pages (t.me/s/<channel>).
// No auth, no bot token, no user data. Public posts only, read-only.
// Pure Node (fetch + regex), no dependencies.

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const CACHE_TTL_MS = 60_000
const cache = new Map() // channel -> { at, messages }

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function headlineOf(text, max = 80) {
  const first = text.split('\n')[0] || ''
  const cut = first.match(/^[^.!?]+[.!?]?/)?.[0] || first
  const h = (cut || first).trim()
  return h.length > max ? h.slice(0, max - 1).trimEnd() + '…' : h
}

/** Fetch + parse one public channel page. Returns newest-first messages. */
export async function fetchChannel(channel, limit = 15) {
  const now = Date.now()
  const hit = cache.get(channel)
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.messages.slice(0, limit)

  const url = `https://t.me/s/${encodeURIComponent(channel)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`t.me/s/${channel} -> HTTP ${res.status}`)
  const html = await res.text()

  const messages = []
  // Split on message wrappers; each block holds one post.
  const blocks = html.split('tgme_widget_message_wrap')
  for (const b of blocks.slice(1)) {
    const textMatch = b.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    if (!textMatch) continue
    const text = htmlToText(textMatch[1])
    if (!text) continue
    const timeMatch = b.match(/<time datetime="([^"]+)"/)
    const linkMatch = b.match(/tgme_widget_message_date[^>]*href="([^"]+)"/)
    const idMatch = linkMatch?.[1]?.match(/\/(\d+)$/)
    messages.push({
      channel,
      id: idMatch ? Number(idMatch[1]) : null,
      link: linkMatch ? linkMatch[1] : `https://t.me/s/${channel}`,
      time: timeMatch ? timeMatch[1] : null,
      text: text.slice(0, 2000),
      headline: headlineOf(text),
    })
  }
  // Page order is oldest-first; newest first.
  messages.reverse()
  cache.set(channel, { at: now, messages })
  return messages.slice(0, limit)
}

/** Digest across channels: newest first, deduped by link. */
export async function getDigest(channels, perChannel = 8, total = 12) {
  const settled = await Promise.allSettled(channels.map(c => fetchChannel(c, perChannel)))
  const all = []
  const seen = new Set()
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue
    for (const m of r.value) {
      if (seen.has(m.link)) continue
      seen.add(m.link)
      all.push(m)
    }
  }
  all.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')))
  const failed = channels.filter((_, i) => settled[i].status === 'rejected')
  return { items: all.slice(0, total), channels, failed, fetchedAt: new Date().toISOString() }
}

export const DEFAULT_CHANNELS = ['airdropfind', 'telegram', 'durov']
