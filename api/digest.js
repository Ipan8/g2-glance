import { getDigest, DEFAULT_CHANNELS } from '../server/digest.mjs'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  const channels = String(req.query.channels || DEFAULT_CHANNELS.join(','))
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
  try {
    const data = await getDigest(channels)
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 300) })
  }
}
