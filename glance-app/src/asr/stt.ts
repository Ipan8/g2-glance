// Glance STT client — implements the asr-template interface.
// Mic PCM (s16le mono 16 kHz) is buffered while the mic is live; when the
// user stops the mic, the buffer is POSTed to the Glance backend /api/stt
// (faster-whisper when installed there, else a clean 501). No audio is
// stored anywhere. No API key is bundled — the key (if any) lives server-side.

import { postStt } from '../api'

export interface SttSnapshot {
  finalText: string
  interimText: string
  finished: boolean
}

export interface SttClient {
  sendPcm(chunk: Uint8Array): void
  close(): void
  /** Flush the buffered audio to the backend and emit the transcript. */
  finish(): Promise<void>
}

export function startSttStream(
  _apiKey: string,
  onSnapshot: (snap: SttSnapshot) => void,
  onError?: (err: unknown) => void,
): SttClient {
  const chunks: Uint8Array[] = []
  let total = 0
  let closed = false
  let busy = false

  return {
    sendPcm(chunk: Uint8Array) {
      if (closed || busy) return
      chunks.push(chunk)
      total += chunk.length
      // Cap the buffer at ~30 s of audio (16 kHz * 2 bytes * 30).
      if (total > 960_000) {
        chunks.shift()
        total -= chunks[0]?.length ?? 0
      }
    },
    async finish() {
      if (closed || busy) return
      busy = true
      try {
        if (total < 3200) {
          // Less than 100 ms of audio — nothing to transcribe.
          onSnapshot({ finalText: '', interimText: '', finished: true })
          return
        }
        const pcm = new Uint8Array(total)
        let off = 0
        for (const c of chunks) { pcm.set(c, off); off += c.length }
        const text = await postStt(pcm)
        onSnapshot({ finalText: text, interimText: '', finished: true })
      } catch (err) {
        onError?.(err)
      } finally {
        chunks.length = 0
        total = 0
        busy = false
      }
    },
    close() {
      closed = true
      chunks.length = 0
      total = 0
    },
  }
}
