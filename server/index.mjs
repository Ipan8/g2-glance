// Glance backend — local dev server (same handlers as the Vercel deployment).
// Run: node server/index.mjs  (port 3101 — 3001 is taken by freellmapi)
// Endpoints: GET /api/digest?channels=a,b  ·  POST /api/draft  ·  GET /api/share
//            POST /api/stt (WAV body)  ·  GET /api/health

import { createServer } from 'node:http'
import { getDigest, DEFAULT_CHANNELS } from './digest.mjs'
import { makeDraft, shareLinks } from './draft.mjs'
import { transcribe } from './stt.mjs'

const PORT = Number(process.env.PORT || 3101)

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function json(res, code, obj) {
  cors(res)
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks)
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end() }
    const u = new URL(req.url, 'http://localhost')

    if (u.pathname === '/api/health') return json(res, 200, { ok: true, at: new Date().toISOString() })

    if (u.pathname === '/api/digest' && req.method === 'GET') {
      const channels = (u.searchParams.get('channels') || DEFAULT_CHANNELS.join(','))
        .split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
      const data = await getDigest(channels)
      return json(res, 200, data)
    }

    if (u.pathname === '/api/draft' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}')
      return json(res, 200, makeDraft(body.text || '', body.lang || 'id'))
    }

    if (u.pathname === '/api/share' && req.method === 'GET') {
      const draft = u.searchParams.get('text') || ''
      const link = u.searchParams.get('link') || ''
      return json(res, 200, shareLinks(draft, link))
    }

    if (u.pathname === '/api/stt' && req.method === 'POST') {
      const pcm = await readBody(req)
      if (!pcm.length) return json(res, 400, { error: 'empty audio body' })
      try {
        const out = await transcribe(pcm, { language: req.headers['x-lang'] || undefined })
        return json(res, 200, out)
      } catch (e) {
        if (e.code === 'STT_UNAVAILABLE') return json(res, 501, { error: e.message })
        return json(res, 500, { error: e.message })
      }
    }

    return json(res, 404, { error: 'not found' })
  } catch (e) {
    return json(res, 500, { error: String(e.message || e).slice(0, 300) })
  }
})

server.listen(PORT, () => console.log(`[glance-server] listening on http://localhost:${PORT}`))
