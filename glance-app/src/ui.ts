// Glance companion web UI — the phone-side view inside the Even Realities app.
// Mirrors the glasses state, lets the user pick channels, type a transcript
// (simulator stand-in for voice — labelled as such), and open the Telegram
// deep link to send a draft. This is a plain web page; the glasses UI is
// rendered by main.ts through the Even Hub SDK.

import type { DigestItem } from './api'

type StatusKind = 'ok' | 'error'

interface CompanionState {
  screen: string
  items: DigestItem[]
  channels: string[]
  sel: number
  draft: string
  chips: string[]
  transcript: string
  micOn: boolean
  shareUrl: string | null
  fetchedAt: string | null
}

let statusEl: HTMLDivElement
let stateEl: HTMLDivElement
let channelsEl: HTMLInputElement
let voiceEl: HTMLInputElement

export function mountUi() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <main class="panel">
      <header>
        <h1>Glance — Telegram for G2</h1>
        <div id="status" class="status status-ok">Starting…</div>
      </header>
      <section class="card">
        <label>Channels (public, comma-separated)</label>
        <div class="row">
          <input id="channels" value="airdropfind, telegram, durov" />
          <button id="apply-channels">Apply</button>
        </div>
        <p class="hint">Public channels only — read from t.me/s pages, no login.</p>
      </section>
      <section class="card">
        <label>Voice (simulator stand-in — on real G2 this comes from the mic)</label>
        <div class="row">
          <input id="voice" placeholder="Type what you would say…" />
          <button id="send-voice">Use as voice</button>
        </div>
      </section>
      <section class="card">
        <label>Glasses state</label>
        <div id="state" class="state">—</div>
      </section>
      <section class="card">
        <label>Send draft in Telegram</label>
        <div id="send-link" class="send-link">No draft yet — open a message on the glasses and pick a reply.</div>
      </section>
      <footer>Glance · Track 01 Messaging &amp; News · Even Realities Hackathon</footer>
    </main>
  `
  statusEl = app.querySelector<HTMLDivElement>('#status')!
  stateEl = app.querySelector<HTMLDivElement>('#state')!
  channelsEl = app.querySelector<HTMLInputElement>('#channels')!
  voiceEl = app.querySelector<HTMLInputElement>('#voice')!
  app.querySelector<HTMLButtonElement>('#apply-channels')!.onclick = () => {
    const list = channelsEl.value.split(',').map(s => s.trim().replace(/^@/, '')).filter(Boolean)
    ;(window as unknown as { __glanceChannels: (c: string[]) => void }).__glanceChannels?.(list)
  }
  app.querySelector<HTMLButtonElement>('#send-voice')!.onclick = () => {
    const t = voiceEl.value.trim()
    if (!t) return
    ;(window as unknown as { __glanceVoice: (t: string) => void }).__glanceVoice?.(t)
    voiceEl.value = ''
  }
  injectStyles()
}

export function setStatus(kind: StatusKind, text: string) {
  if (!statusEl) return
  statusEl.className = `status status-${kind}`
  statusEl.textContent = text
}

export function setCompanion(s: CompanionState) {
  if (!stateEl) return
  const it = s.items[s.sel]
  stateEl.innerHTML = [
    `<div><b>Screen:</b> ${s.screen}</div>`,
    `<div><b>Items:</b> ${s.items.length}${s.fetchedAt ? ` · fetched ${s.fetchedAt.slice(11, 19)} UTC` : ''}</div>`,
    it ? `<div><b>Selected:</b> @${it.channel} — ${escapeHtml(it.headline)}</div>` : '',
    s.draft ? `<div><b>Draft:</b> ${escapeHtml(s.draft)}</div>` : '',
    s.transcript ? `<div><b>Transcript:</b> “${escapeHtml(s.transcript)}”</div>` : '',
    `<div><b>Mic:</b> ${s.micOn ? 'listening' : 'off'}</div>`,
  ].join('')
  const sendEl = document.querySelector<HTMLDivElement>('#send-link')
  if (sendEl) {
    sendEl.innerHTML = s.shareUrl
      ? `<a href="${escapeHtml(s.shareUrl)}" target="_blank" rel="noopener">Open in Telegram to send ↗</a>`
      : 'No draft yet — open a message on the glasses and pick a reply.'
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function injectStyles() {
  const css = `
    :root { color-scheme: dark; }
    html, body { margin: 0; height: 100%; background: #232323; color: #E5E5E5;
      font: 16px/1.4 -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif;
      touch-action: manipulation; -webkit-text-size-adjust: 100%; overscroll-behavior: none; }
    #app { display: flex; min-height: 100%; }
    .panel { display: flex; flex-direction: column; gap: 14px;
      width: 100%; max-width: 640px; margin: 0 auto; padding: 24px; box-sizing: border-box; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h1 { font-size: 18px; font-weight: 600; margin: 0; letter-spacing: 0.02em; }
    .status { font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid transparent; }
    .status-ok { color: #3CFA44; border-color: #3CFA44; }
    .status-error { color: #FF453A; border-color: #FF453A; }
    .card { background: #2E2E2E; border: 1px solid #3E3E3E; border-radius: 12px; padding: 16px; }
    .card label { display: block; font-size: 12px; color: #A7A7A7; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
    .row { display: flex; gap: 8px; }
    input { flex: 1; background: #232323; border: 1px solid #3E3E3E; color: #E5E5E5;
      border-radius: 8px; padding: 10px 12px; font-size: 15px; min-width: 0; }
    button { background: #3CFA44; color: #111; border: 0; border-radius: 8px;
      padding: 10px 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .hint { font-size: 12px; color: #7B7B7B; margin: 8px 0 0; }
    .state { font-size: 14px; line-height: 1.7; word-break: break-word; }
    .send-link a { color: #3CFA44; font-weight: 600; }
    footer { font-size: 12px; color: #7B7B7B; text-align: center; }
  `
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}
