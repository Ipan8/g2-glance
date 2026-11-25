// Glance — Telegram digest for Even Realities G2.
// Track 01 Messaging & News + Best Telegram integration.
// One glance, one action: unread Telegram channel posts, condensed to fit
// the 576x288 glasses display; reply by voice or quick chip; tap to send
// via Telegram on the phone (deep link, no credentials, no bot token).
//
// Data: public Telegram channel pages via our backend (t.me/s/<channel>).
// Voice: G2 mic PCM -> backend /api/stt (faster-whisper when installed).
// In the headless simulator there is no mic device, so the companion web UI
// offers a typed transcript stand-in, labelled as simulator-only.

import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { startSttStream } from './asr/stt'
import { mountUi, setStatus, setCompanion } from './ui'
import { fetchDigest, fetchDraft, fetchShareLinks, type DigestItem } from './api'

const DEFAULT_CHANNELS = ['airdropfind', 'telegram', 'durov']
const LIST_PER_PAGE = 3

type Screen = 'home' | 'item' | 'reply' | 'sent'

interface State {
  screen: Screen
  items: DigestItem[]
  channels: string[]
  loading: boolean
  error: string | null
  sel: number // selected item index on home
  page: number // text page inside item view
  replyIdx: number // selected draft option on reply screen
  draft: string
  chips: string[]
  transcript: string
  micOn: boolean
  sttNote: string | null
  shareUrl: string | null
  fetchedAt: string | null
}

const state: State = {
  screen: 'home',
  items: [],
  channels: [...DEFAULT_CHANNELS],
  loading: true,
  error: null,
  sel: 0,
  page: 0,
  replyIdx: 0,
  draft: '',
  chips: [],
  transcript: '',
  micOn: false,
  sttNote: null,
  shareUrl: null,
  fetchedAt: null,
}

mountUi()

const bridge = await waitForEvenAppBridge()

// ---- text wrapping: pre-wrap to ~43 cols so pagination is predictable ----
function wrap(text: string, cols = 43): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!line) { line = word; continue }
      if (line.length + 1 + word.length > cols) { out.push(line); line = word }
      else line += ' ' + word
    }
    if (line) out.push(line)
    if (!para.trim()) out.push('')
  }
  return out
}

function paginate(text: string): string[] {
  const lines = wrap(text)
  const per = 10
  const pages: string[] = []
  for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per).join('\n'))
  return pages.length ? pages : ['']
}

function shortHeadline(h: string, max = 40): string {
  if (h.length <= max) return h
  const cut = h.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 10 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

function timeShort(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
}

// ---- rendering: one full-screen text container.
// Screen transitions REBUILD the page (a fresh container clears the old
// text — textContainerUpgrade left ghost copies of the previous screen
// when the new content was shorter). In-screen updates use the cheaper
// upgrade path.
function pageContainer(content: string): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: 0, yPosition: 0, width: 576, height: 288,
    borderWidth: 0, borderColor: 5, paddingLength: 4,
    containerID: 1, containerName: 'main',
    content,
    isEventCapture: 1,
  })
}

// The startup page must be created once before any rebuild.
const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [pageContainer('GLANCE · Telegram\n\nLoading digest…')],
  }),
)
if (created !== 0) console.error('createStartUpPageContainer failed:', created)

let lastRender = ''
let renderTimer: number | null = null
async function render(content: string) {
  if (content === lastRender) return
  lastRender = content
  try {
    await bridge.rebuildPageContainer(
      new RebuildPageContainer({ containerTotalNum: 1, textObject: [pageContainer(content)] }),
    )
  } catch (e) {
    console.error('rebuild failed', e)
  }
  setCompanion(state)
}
function scheduleRender(content: string) {
  if (renderTimer !== null) return
  renderTimer = window.setTimeout(() => { renderTimer = null; render(content) }, 120)
}

function homeContent(): string {
  if (state.loading) return 'GLANCE · Telegram\n\nLoading digest…'
  if (state.error && !state.items.length) return `GLANCE · Telegram\n\nDigest offline.\n${state.error}\n\nTap to retry.`
  if (!state.items.length) return 'GLANCE · Telegram\n\nNo new posts.\n\nTap to refresh.'
  const pages = Math.ceil(state.items.length / LIST_PER_PAGE)
  const pageIdx = Math.floor(state.sel / LIST_PER_PAGE)
  const slice = state.items.slice(pageIdx * LIST_PER_PAGE, pageIdx * LIST_PER_PAGE + LIST_PER_PAGE)
  const lines = [`GLANCE · Telegram — ${state.items.length} new`, '']
  slice.forEach((it, i) => {
    const idx = pageIdx * LIST_PER_PAGE + i
    const mark = idx === state.sel ? '> ' : '  '
    lines.push(`${mark}@${it.channel} · ${timeShort(it.time)}`)
    lines.push(`  ${shortHeadline(it.headline)}`)
  })
  lines.push('')
  lines.push(`p ${pageIdx + 1}/${pages} · up/down move · tap open`)
  return lines.join('\n')
}

function itemContent(): string {
  const it = state.items[state.sel]
  if (!it) return homeContent()
  const pages = paginate(`@${it.channel} · ${timeShort(it.time)}\n\n${it.text}`)
  state.page = Math.min(state.page, pages.length - 1)
  return `${pages[state.page]}\n\n— p ${state.page + 1}/${pages.length} · tap reply`
}

function replyContent(): string {
  const it = state.items[state.sel]
  const opts = [state.draft, ...state.chips].filter(Boolean)
  const lines = [
    `Reply to @${it?.channel ?? ''}`,
    '',
    state.micOn ? '● Listening… tap to stop' : state.transcript ? `“${state.transcript.slice(0, 60)}”` : '○ Mic off — tap to speak',
  ]
  if (state.sttNote) lines.push(`(${state.sttNote})`)
  lines.push('')
  opts.forEach((o, i) => lines.push(`${i === state.replyIdx ? '> ' : '  '}${o.slice(0, 40)}`))
  lines.push('')
  lines.push('tap mic · hold to send · dbl-tap back')
  return lines.join('\n')
}

function sentContent(): string {
  return [
    'Draft ready ✓',
    '',
    'Open Telegram on your phone',
    'to send it — link is on the',
    'companion screen.',
    '',
    'Tap for home.',
  ].join('\n')
}

function currentContent(): string {
  switch (state.screen) {
    case 'home': return homeContent()
    case 'item': return itemContent()
    case 'reply': return replyContent()
    case 'sent': return sentContent()
  }
}

function go(screen: Screen) {
  state.screen = screen
  state.page = 0
  if (screen === 'reply') { state.replyIdx = 0 }
  scheduleRender(currentContent())
}

// ---- digest loading ----
async function loadDigest() {
  state.loading = true
  state.error = null
  scheduleRender(currentContent())
  try {
    const saved = await bridge.getLocalStorage('channels').catch(() => null)
    if (saved) {
      try {
        const list = JSON.parse(saved)
        if (Array.isArray(list) && list.length) state.channels = list.slice(0, 5)
      } catch { /* keep defaults */ }
    }
    const data = await fetchDigest(state.channels)
    state.items = data.items
    state.fetchedAt = data.fetchedAt
    if (data.failed.length) state.error = `(${data.failed.join(', ')} unreachable)`
    state.sel = 0
    setStatus('ok', `${state.items.length} new · ${state.channels.join(', ')}`)
  } catch (e) {
    state.error = String((e as Error)?.message ?? e).slice(0, 60)
    setStatus('error', state.error)
  } finally {
    state.loading = false
    scheduleRender(currentContent())
    console.log('[glance] ready')
  }
}

// ---- voice: mic capture + STT ----
let stt: ReturnType<typeof startSttStream> | null = null
stt = startSttStream(
  '',
  snap => {
    if (snap.finalText) {
      state.transcript = snap.finalText
      state.sttNote = null
      applyTranscriptAsDraft()
    }
  },
  err => {
    const msg = String((err as Error)?.message ?? err)
    state.sttNote = msg.includes('STT_UNAVAILABLE')
      ? 'STT not on this server — pick a chip or type below'
      : `STT error: ${msg.slice(0, 40)}`
    state.micOn = false
    scheduleRender(currentContent())
  },
)

async function setMic(on: boolean) {
  state.micOn = on
  await bridge.audioControl(on).catch(e => console.error('audioControl failed', e))
  if (!on && stt) {
    // Flush buffered audio to the backend for transcription.
    await stt.finish()
  }
  scheduleRender(currentContent())
}

async function applyTranscriptAsDraft() {
  try {
    const d = await fetchDraft(state.transcript, 'id')
    state.draft = d.draft
    state.chips = d.chips
    state.replyIdx = 0
  } catch {
    state.draft = state.transcript
  }
  scheduleRender(currentContent())
}

// Companion UI (phone side) can inject a typed transcript — the simulator
// has no mic device, so this is the honest stand-in, labelled in the UI.
;(window as unknown as { __glanceVoice: (t: string) => void }).__glanceVoice = (t: string) => {
  state.transcript = t.slice(0, 200)
  state.sttNote = 'simulated voice (simulator has no mic)'
  applyTranscriptAsDraft()
}
;(window as unknown as { __glanceChannels: (c: string[]) => void }).__glanceChannels = (c: string[]) => {
  state.channels = c.filter(Boolean).slice(0, 5)
  bridge.setLocalStorage('channels', JSON.stringify(state.channels)).catch(() => {})
  loadDigest()
}

// ---- reply flow ----
async function openReply() {
  const it = state.items[state.sel]
  if (!it) return
  state.draft = ''
  state.chips = []
  state.transcript = ''
  state.sttNote = null
  state.shareUrl = null
  try {
    const d = await fetchDraft(it.text, 'id')
    state.draft = d.draft
    state.chips = d.chips
  } catch {
    state.draft = 'Oke, noted. Thanks!'
    state.chips = ['Oke, gas 👍', 'Siap, thanks infonya', 'Noted, gw cek dulu']
  }
  go('reply')
}

async function sendReply() {
  const it = state.items[state.sel]
  const opts = [state.draft, ...state.chips].filter(Boolean)
  const text = opts[state.replyIdx] ?? state.draft
  if (!text) return
  try {
    const links = await fetchShareLinks(text, it?.link ?? '')
    state.shareUrl = links.shareUrl
  } catch {
    state.shareUrl = `https://t.me/share/url?text=${encodeURIComponent(text)}`
  }
  setCompanion(state)
  go('sent')
}

// ---- events ----
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

let cleanedUp = false
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  bridge.audioControl(false).catch(() => {})
  stt?.close()
  unsubscribe()
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const pcm = event.audioEvent?.audioPcm
  if (pcm) stt?.sendPcm(pcm)

  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)
  const type = sysType ?? textType
  if (type === null) return

  // Double-tap: root = exit dialog (QA requirement); elsewhere = back.
  if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    if (state.screen === 'home') { bridge.shutDownPageContainer(1); return }
    if (state.micOn) { setMic(false); return }
    go(state.screen === 'item' ? 'home' : state.screen === 'reply' ? 'item' : 'home')
    return
  }

  if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    if (state.screen === 'home') state.sel = Math.min(state.sel + 1, state.items.length - 1)
    else if (state.screen === 'item') state.page += 1
    else if (state.screen === 'reply') {
      const n = [state.draft, ...state.chips].filter(Boolean).length
      state.replyIdx = Math.min(state.replyIdx + 1, Math.max(0, n - 1))
    }
    scheduleRender(currentContent())
    return
  }

  if (type === OsEventTypeList.SCROLL_TOP_EVENT) {
    if (state.screen === 'home') state.sel = Math.max(state.sel - 1, 0)
    else if (state.screen === 'item') state.page = Math.max(state.page - 1, 0)
    else if (state.screen === 'reply') state.replyIdx = Math.max(state.replyIdx - 1, 0)
    scheduleRender(currentContent())
    return
  }

  if (type === OsEventTypeList.LONG_PRESS_EVENT) {
    // Long press = confirm/send on the reply screen.
    if (state.screen === 'reply') { sendReply() }
    return
  }

  if (type === OsEventTypeList.CLICK_EVENT) {
    if (state.screen === 'home') {
      if (state.error || !state.items.length) { loadDigest(); return }
      go('item')
    } else if (state.screen === 'item') {
      openReply()
    } else if (state.screen === 'reply') {
      // Tap toggles the mic. Sending is a long press (see above).
      setMic(!state.micOn)
    } else if (state.screen === 'sent') {
      go('home')
    }
    return
  }

  if (type === OsEventTypeList.SYSTEM_EXIT_EVENT || type === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    cleanup()
  }
})

window.addEventListener('beforeunload', cleanup)

setStatus('ok', 'Starting Glance…')
loadDigest()
