# Even Realities G2 — Even Hub SDK Reference

> Sources (read in full 2026-11-25, hub.evenrealities.com): `docs/get-started/quickstart/first-app`
> (2026-07-04) · `docs/build/device-apis` (2026-08-29) · `docs/build/networking` (2026-06-11) ·
> `docs/build/design-guidelines` (2026-07-10) · `docs/get-started/quickstart/templates`
> (2026-06-04) · `docs/test/simulator` (v0.9.3, SDK 0.0.14) · `docs/ship/app-submission`
> (2026-10-09). SDK: `@evenrealities/even_hub_sdk`, manifest `edition: "202601"`, SDK floor
> `0.0.14`. The `*.d.ts` files in the npm package are authoritative for signatures.

## 0. Skeleton

```ts
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
const bridge = await waitForEvenAppBridge() // ALWAYS first; earlier SDK calls silently no-op
```

- Vite + TypeScript; `app.json` at root; `index.html` / `vite.config.ts` keep as-is.
- `app.json` minimum: `package_id` (reverse-DNS, unique), `name` (≤20 chars, must NOT contain
  "Even"), `version` (semver `x.y.z`, no `v` prefix), `edition: "202601"`,
  `min_sdk_version: "0.0.14"`, `entrypoint: "index.html"`, `permissions: []`,
  `supported_languages: ["en"]`.
- Render via containers, not DOM: `bridge.createStartUpPageContainer(new CreateStartUpPageContainer({ containerTotalNum, textObject: [...] }))` returns `0` = success, `1` = invalid params, `2` = oversize, `3` = out of memory. Update text flicker-free with `bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID, containerName, content }))`; `rebuildPageContainer` is only for layout changes.
- `TextContainerProperty`: `xPosition, yPosition, width, height, borderWidth, borderColor, paddingLength, containerID, containerName, content, isEventCapture` (1 = receives input, default 0 = display-only). `containerID` + `containerName` must match exactly between create and upgrade.

## 1. Device APIs

### 1.1 Events — one subscription for everything

```ts
bridge.onEvenHubEvent((event) => {
  const t = event.textEvent            // text container with isEventCapture: 1
  const l = event.listEvent            // list container with isEventCapture: 1
  const s = event.sysEvent             // system events: long press, IMU
  const a = event.audioEvent           // microphone buffers
  const m = event.menuItemClickEvent   // contextual-menu selection (itemID)
})
```

- Only **one container per page** captures events. Long press and menu selections bypass routing and arrive regardless of the capturing container. Do NOT listen for DOM `click` — input comes only via `onEvenHubEvent`.

### 1.2 Event types (`OsEventTypeList`)

| Event | Value | Meaning |
|---|---|---|
| `CLICK_EVENT` | 0 | Single press, G2 temple or R1 ring |
| `SCROLL_TOP_EVENT` | 1 | Swipe up / scroll to top |
| `SCROLL_BOTTOM_EVENT` | 2 | Swipe down / scroll to bottom |
| `DOUBLE_CLICK_EVENT` | 3 | Double press |
| `LONG_PRESS_EVENT` | 9 | Long press begins (SDK 0.0.14+, Even App 2.2.9+) |
| `LONG_PRESS_RELEASE_EVENT` | 10 | Long press released |
| `IMU_DATA_REPORT` | — | IMU sample (see §1.4) |

- Gotcha: SDK normalizes `CLICK_EVENT` (0) to `undefined` sometimes — handle both: `case OsEventTypeList.CLICK_EVENT: case undefined:`.
- G2 touchpads and R1 ring share event types but carry distinct sources, so glasses-vs-ring input can be routed to different handlers.
- **Long press** arrives as a *pair* on `event.sysEvent` (never on the capturing container; `eventSource` absent). A rebuild mid-press keeps the pair intact. Caveat: tap-then-sustained-press raises the OS contextual menu instead — treat long press as an enhancement, not the only path to a feature.

### 1.3 Audio / microphone (voice input)

```ts
import { AudioInputSource } from '@evenrealities/even_hub_sdk'
await bridge.audioControl(true, AudioInputSource.Glasses) // start, G2 4-mic array (default)
await bridge.audioControl(true, AudioInputSource.Phone)   // start, phone mic
await bridge.audioControl(false)                          // stop
bridge.onEvenHubEvent((event) => {
  const audio = event.audioEvent; if (!audio) return
  // audio.source: AudioInputSource.Glasses | AudioInputSource.Phone
  // audio.audioPcm: Uint8Array — PCM 16 kHz, signed 16-bit LE, mono
})
```

- Format (both sources): **PCM 16 kHz, signed 16-bit little-endian, mono**. Simulator emits 100 ms per event (3,200 bytes / 1,600 samples).
- Permissions: `g2-microphone` (Glasses), `phone-microphone` (Phone). Glasses source requires `createStartUpPageContainer` first; Phone does not.
- **Track 01:** voice reply = `audioControl(true, Glasses)` → buffer `audioPcm` chunks → send to backend STT → show result in a text container. There is **no audio output** on the glasses — replies are visual only.

### 1.4 IMU

```ts
await bridge.imuControl(true, ImuReportPace.P500) // start; P100…P1000 pacing codes (not literal Hz)
bridge.onEvenHubEvent((event) => {
  const sys = event.sysEvent
  if (sys?.eventType !== OsEventTypeList.IMU_DATA_REPORT || !sys.imuData) return
  const { x, y, z } = sys.imuData // floats, IMU_Report_Data protobuf
})
await bridge.imuControl(false) // stop
```

- Samples push continuously until stopped. Track 01 likely doesn't need IMU — keep it off (battery + event noise).

### 1.5 Location, photos, device/user info, storage

```ts
const fix = await bridge.getAppLocation({ accuracy: AppLocationAccuracy.High, timeoutMs: 5000 })
// { latitude, longitude, accuracy?, altitude?, speed?, heading?, timestamp? } | null — always null-check
await bridge.startAppLocationUpdates({ accuracy: AppLocationAccuracy.Medium, intervalMs: 1000, distanceFilter: 5 })
const unsub = bridge.onAppLocationChanged(loc => { /* loc.latitude, loc.longitude, loc.speed */ })
await bridge.stopAppLocationUpdates(); unsub()
const img = await bridge.pickImageFromAlbum()      // needs `album` perm; null on cancel/deny; single-select
const shot = await bridge.captureImageFromCamera() // needs `camera` perm; G2 has NO camera — phone camera
// AppImageAsset: { path, name, mimeType, size, base64 } — downscale before sending to glasses
const info = await bridge.getDeviceInfo() // model (G1/G2/Ring1), serial, battery, wearing, charging, in-case
bridge.onDeviceStatusChanged(status => { /* battery/wearing/charging updates */ })
const user = await bridge.getUserInfo()   // uid, name, avatar, country
await bridge.setLocalStorage('key', 'value'); const v = await bridge.getLocalStorage('key')
// local storage = remembered setup — never re-prompt (QA checks this)
```

### 1.6 What the SDK does NOT expose

No direct Bluetooth, no arbitrary pixel drawing, no audio output, no text alignment, no font control, no background colors, no per-item list styling, no programmatic scroll position, no animations, no glasses-side camera; images are greyscale-only.

## 2. Networking

- Plain `fetch()` / `XMLHttpRequest` / WebSockets from the WebView hosted by the Even Realities App on the phone. **Two independent gates** — both must pass: (1) **Even-side permission:** destination origin must be in `app.json` `network` permission `whitelist` (unlisted = blocked before any traffic). (2) **Browser CORS:** WebView (Chromium/Android, WKWebView/iOS) enforces standard CORS. **Whitelist ≠ CORS bypass.**
- Whitelist format — one entry per origin, full origin, no bare hostnames, no wildcards; HTTPS in production (`http://` only for LAN dev):

```json
"permissions": [
  { "name": "network", "desc": "Fetches Telegram digest from our backend.", "whitelist": ["https://api.example.com"] },
  { "name": "g2-microphone", "desc": "Voice replies via glasses mic." }
]
```

- Server must return at minimum `Access-Control-Allow-Origin: *` (or the WebView origin). For JSON bodies / custom headers / non-GET/POST, handle the `OPTIONS` preflight: `204` with `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, `Access-Control-Allow-Headers: Content-Type, Authorization`, `Access-Control-Max-Age: 86400`.
- If a third-party API can't do CORS, **proxy through a server you control** that sets the headers — then whitelist *that* server's domain.
- **Never bundle secrets/API keys into the `.ehpk`** — published builds are extractable. Keys live behind your own server-side proxy.
- Debug order on device failure: (1) domain in whitelist? (repack + reupload if changed) (2) `Access-Control-Allow-Origin` present? (3) preflight `OPTIONS` 2xx with right Allow-*? (4) `curl` works but WebView doesn't ⇒ almost always CORS.
- **Track 01:** Telegram Bot API has no browser-friendly CORS for direct calls — route everything through your own backend (digest fetch + STT + send-message) and whitelist only that one origin. One origin = simplest QA story.

## 3. Design Guidelines — the 576×288 green canvas

- **Canvas 576×288 px**, origin top-left. **4-bit greyscale** rendered as shades of green. **No background fill** — borders + text/image content only.
- **Max 4 image containers, 8 other containers** per page. **One event-capturing container** per page.
- Single LVGL font, no monospaced variant, **no sizing controls** — hierarchy comes from `textColor` brightness levels 0–4 (simulator renders five distinct levels, not photometrically matched to hardware) and layout.
- Store icon is stricter: **1-bit monochrome**, built from **2×2 blocks** (thinnest stroke 2 px; single pixels / 1-px lines fail validation) — effective 12×12 detail budget. In-app icons: draw big, fill border to border, downscale to 24×24, threshold to pure on/off, clean up by hand; flat filled shapes, strokes ≥2 px, one subject, no gradients/shadows.
- Common patterns: fake buttons = prefix text with `>`; selection highlight = toggle `borderWidth` on a text container; multi-row layout = stack text containers vertically (e.g. 3 × 96 px); progress bars = Unicode blocks `━ ─ █▇▆▅▄▃▂▁`; page flipping = pre-paginate text at ~400–500 char boundaries, rebuild on scroll events.
- Reliable glyphs: navigation `▲△▶▷▼▽◀◁`, selection `●○ ■□ ★☆`, borders `╭╮╯╰ │─` (box-drawing set), suits `♠♣♥♦`.
- **Glanceable UX (Track 01):** one screen = one digest, headline first, pre-paginate long digests at ~400–500 chars, swipe down = next page, tap = open item, double-tap = exit. Keep lit pixels low — dense walls of text hurt legibility and battery.

## 4. Templates — `github.com/even-realities/evenhub-templates`

| Template | Ships with | Use when |
|---|---|---|
| `minimal` | Vite + TS + SDK wired, single page, click handler | Learning; one-shot demos; default |
| `text-heavy` | Pagination component, large-text rendering, font-measurement helper | Reading apps, long-form content |
| `asr` | **Audio capture wired, transcription scaffolding, mic UI states** | Voice notes, transcription, voice control |
| `image` | Image rendering pipeline, greyscale conversion helper, placeholder swap | Photo viewers, glanceable images |

```bash
npx degit even-realities/evenhub-templates/asr my-app
cd my-app && npm install && npm run dev
```

- Every template: Vite + TS + HMR, SDK pre-installed, `app.json` pre-filled (still edit `package_id` + `name`), `src/main.ts` boots the bridge first, `index.html` / `vite.config.ts` keep as-is. No in-place upgrader — diff against upstream to pull fixes. Trim demo code before shipping.
- **Track 01 pick: start from `asr`** (mic wiring + mic UI states already done — the voice-reply half), then borrow the `text-heavy` pagination helper for the digest half. Do "Your First App" once first if learning the raw SDK — templates hide bridge mechanics behind helpers.

## 5. App Submission & QA

### 5.1 Build state machine

`Private` (you only) → `Beta` (one beta slot, `Active` testers) → `Public` (submit for review → `In Review` → `Approved`/`Rejected` → `Published`). CLI: `evenhub upload`, `evenhub promote <version> --to beta`, `evenhub delist --from beta|public`. Submit/cancel/publish are portal-only. **Published versions are immutable** — no manifest edit, no `.ehpk` replacement, no rollback; fix-forward only with a higher version. New versions need a non-empty changelog (1–3 lines per locale, user-facing wording).

### 5.2 Reviewer rubric

- **Manifest:** `package_id` reverse-domain, lowercase, no hyphens/underscores, ≥2 segments, each starting with a lowercase letter. `edition` exactly `"202601"`. `name` ≤20 chars, no "Even". `version` semver `x.y.z`. `min_sdk_version` required (floor `0.0.14`). `entrypoint` resolves to a real file. `permissions` = array of `{name, desc}` (desc 1–300 chars); `network` entries also need `whitelist`. **Every requested permission must actually be used in code** — unused permissions are flagged (e.g. `g2-microphone` only if you call `audioControl(true, AudioInputSource.Glasses)`).
- **Store listing:** legible monochrome/greyscale icon + background (both supplied, neither null/empty); screenshots must match real on-device rendering (capture via simulator screenshot); display name matches `app.json` name and on-glasses name; no impersonation, brand logos, or keyword stuffing.
- **Privacy:** policy covers *every* permission; backend domains documented and traceable to the developer.
- **First-run (no black screens):** if setup is needed (e.g. Telegram link code), glasses must show an on-glasses message explaining what to do — never a black screen. Setup remembered across launches via local storage — never re-prompt. CORS correctly configured on any API called (whitelist is not a CORS bypass).
- **Locked-phone operation:** reviewers test with the phone locked and the Even App backgrounded. App must render in reasonable time (no infinite spinner / black screen); **core flow runs end-to-end on glasses + ring input alone**; long tasks continue while locked; still alive and responsive after **2 min idle**; unlock → use another app → re-lock leaves the session unaffected. **Test with a beta build — QR sideload dies when the WebView backgrounds and cannot validate these checks.**
- **Exit & lifecycle:** root-page double-tap **must** call `bridge.shutDownPageContainer(1)` (system exit-confirmation dialog). Mode `0` (silent exit) and custom in-app exit UI are **rejected** on the root page; doing nothing on double-tap is rejected. After confirmed exit, the phone-side WebView must also close automatically. After exit, other apps (e.g. Conversate) must launch without restarting glasses. (Non-root pages may route double-tap to a menu with an "Exit" item that then calls `shutDownPageContainer(1)`.)
- **Content & safety:** no medical diagnosis, financial advice, or emergency-routing; no offensive/explicit/NSFW/hateful content.

### 5.3 Pre-submission sanity loop

1. `evenhub pack app.json dist -o myapp.ehpk -c` — package_id available, manifest validates.
2. Install as a **beta build**, lock the phone 5 min — stays alive and responsive?
3. Root-page double-tap — system exit dialog appears and WebView closes?
4. Re-launch a first-party app (Conversate) — starts without restart?
5. Re-read privacy policy — covers every permission in `app.json`?

### 5.4 Headless pre-submission checks (simulator automation, v0.7.0+)

```bash
evenhub-simulator http://localhost:5173 --automation-port 9898
curl http://127.0.0.1:9898/api/ping  # → pong
```

- `GET /api/screenshot/glasses` — 576×288 **RGBA** PNG of the LVGL framebuffer; keep RGBA (RGB fuses background and text); **lit-pixel test = `alpha > 0`**; assert boot framebuffer has lit pixels (e.g. `> 100`) — a blank framebuffer fails.
- `GET /api/console[?since_id=N]` — console entries, uncaught exceptions, unhandled rejections, failed `fetch` calls; assert **no console errors at boot**. Read startup logs *before* `DELETE /api/console` (emitted once).
- `POST /api/input {"action": "up|down|click|double_click|long_press|long_press_release|context_menu"}` — drive the touchpad; allow ~4 s after launch before sending input. Assert `double_click` on the root page produces the exit dialog (large lit-pixel jump).
- Simulator caveats: not an emulator (no BLE timing/perf); display not pixel-perfect; image transfer/size limits not enforced; status events not emitted; list-scroll focus may differ from hardware. **Always validate on real hardware before submission.**

## 6. Track 01 cheat sheet — Telegram glanceable digest + voice reply

| Need | SDK piece |
|---|---|
| Digest fetch | `fetch()` to own backend; whitelist that one origin; backend proxies Telegram Bot API + sets CORS |
| Digest pages | `text-heavy` pagination; pre-paginate ~400–500 chars; `SCROLL_BOTTOM_EVENT` = next page |
| Open item / back | `CLICK_EVENT` on capturing text container; `DOUBLE_CLICK_EVENT` = back / root exit dialog |
| Voice reply | `asr` template + `audioControl(true, AudioInputSource.Glasses)`; `g2-microphone` permission; PCM 16k mono → backend STT → send via backend |
| Remember link/setup | `setLocalStorage` / `getLocalStorage`; first-run glasses message, never black screen |
| Locked-phone use | Core flow must work with phone locked — test via **beta build**, not QR sideload |
| QA tripwires | Root double-tap → `shutDownPageContainer(1)`; no unused permissions; no secrets in `.ehpk`; no console errors at boot; lit pixels > 0 |
