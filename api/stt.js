// STT is not available on Vercel serverless (no faster-whisper there).
// The endpoint exists so the app gets a clean, documented 501 instead of a
// mystery failure; local/self-hosted backends can run the real engine.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  return res.status(501).json({ error: 'STT engine not installed on this server (faster-whisper missing)' })
}
