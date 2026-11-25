// Glance backend — optional speech-to-text via faster-whisper (local, CPU).
// If faster-whisper is not installed, transcribe() throws STT_UNAVAILABLE and
// the API answers 501 with a clear message. The glasses app then falls back
// to quick-reply chips + typed input. No audio is stored anywhere.
//
// The G2 mic already sends raw PCM s16le 16kHz mono, so we feed it to
// faster-whisper as a numpy float32 array via stdin — this skips PyAV
// entirely (the venv's av version rejects faster-whisper's decode_audio).

import { spawn } from 'node:child_process'

const VENV_PY = process.env.GLANCE_STT_PY || `${process.env.HOME}/.venvs/glance-stt/bin/python`

let checked = null
async function whisperAvailable() {
  if (checked !== null) return checked
  checked = await new Promise(resolve => {
    const py = spawn(VENV_PY, ['-c', 'import faster_whisper'], { stdio: 'ignore' })
    py.on('error', () => resolve(false))
    py.on('close', code => resolve(code === 0))
  })
  return checked
}

/** pcm: Buffer of s16le mono 16kHz audio. Returns { text, lang } or throws. */
export async function transcribe(pcm, { model = 'tiny', language = null } = {}) {
  if (!(await whisperAvailable())) {
    const e = new Error('STT engine not installed on this server (faster-whisper missing)')
    e.code = 'STT_UNAVAILABLE'
    throw e
  }
  if (pcm.length < 3200) return { text: '', lang: language || 'auto' } // < 0.1s: nothing to hear
  const script = [
    'import sys, numpy as np',
    'from faster_whisper import WhisperModel',
    'raw = sys.stdin.buffer.read()',
    'audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0',
    `m = WhisperModel(${JSON.stringify(model)}, device="cpu", compute_type="int8")`,
    `segs, info = m.transcribe(audio${language ? `, language=${JSON.stringify(language)}` : ''})`,
    'print(" ".join(s.text.strip() for s in segs if s.text.strip()))',
  ].join('\n')
  const text = await new Promise((resolve, reject) => {
    const py = spawn(VENV_PY, ['-c', script], { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    py.stdout.on('data', d => { out += d })
    py.stderr.on('data', d => { err += d })
    py.on('error', e => reject(new Error('stt spawn failed: ' + e.message)))
    py.on('close', code => {
      if (code !== 0) reject(new Error('whisper failed: ' + err.slice(-500)))
      else resolve(out.trim())
    })
    py.stdin.end(pcm)
  })
  return { text, lang: language || 'auto' }
}

export default async function stt(req, res) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const pcm = Buffer.concat(chunks)
  if (pcm.length < 3200) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'empty audio (need >= 0.1s PCM s16le 16kHz mono)' }))
  }
  try {
    const { text } = await transcribe(pcm)
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: 'no speech detected' }))
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ text }))
  } catch (e) {
    const code = e.code === 'STT_UNAVAILABLE' ? 501 : 500
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: e.message }))
  }
}
