# SPEC — Glance: Telegram digest for Even Realities G2
# Heads Up: Even Realities Hackathon (DoraHacks) — Track 01 Messaging & News + Best Telegram integration

## Status (updated 25 Nov 2026 ~19:35 WIB)
- App COMPLETE + verified in simulator: home/item/reply/sent screens, real
  digest data (12 items), draft + chips + share link, 0 console errors
  (sim-test.py: ready marker, 4 screens, OK).
- faster-whisper STT PROVEN end-to-end on real speech (tiny model, local
  CPU): real English sample transcribed accurately; no-speech audio returns
  empty text (client keeps the draft, no crash); engine absent -> 501.
- Production build passes (`npm run build`, tsc clean).
- Remaining: demo video (26–27 Nov), .ehpk pack attempt, repo Ipan8/g2-glance
  (browser task), DoraHacks submit. Target: SUBMIT ≤ 29 Nov 21:00 WIB.
  Hard deadline: 30 Nov 02:59 WIB (29 Nov 23:59 Dubai).
- Budget guard: HSK build 28–29 Nov + Binance testnet deploy 28 Nov run in
  the gaps; G2 must not eat them.
- Vercel deploy UNRESOLVED (no token/CLI login on this VM) — demo uses
  localhost backend; README documents `vercel deploy` as the production step.

## Verified facts (re-checked 25 Nov, DoraHacks page + hub.evenrealities.com docs)
- Prizes $10,000 USDT: Grand $2,000 + 2 G2; 1st/track $1,250; 2nd/track $375; Best Telegram $1,000; Community Partner ≤$500. One cash prize per project (highest wins). Cash in USDT ≤7 days after Demo Day. Demo Day 3 Dec 14:00–18:00 Dubai = 17:00–21:00 WIB (finalists remote OK; clashes with HSK submit day — only matters if finalist).
- Eligibility: solo OK, no KYC, no wallet, no fee. Public repo + README; demo video ≤3 min (simulator or G2); money demos testnet/paper/read-only only; never hold user funds; never ship API keys/secrets in the app.
- Stack: web app (HTML/CSS/JS/TS) in a WebView in the Even Realities phone app, talks to G2 over Bluetooth via Even Hub SDK. Simulator free, no glasses needed. Display mono green 576×288. Input: mic + tap + R1 ring. No camera, no speaker on glasses.
- SDK: `@evenrealities/even_hub_sdk` (latest 0.0.16, floor 0.0.14); CLI `evenhub` 0.2.0; simulator 0.9.5. Templates: `minimal`, `text-heavy`, `asr`, `image` (even-realities/evenhub-templates).
- Judging: usefulness on G2 25% · read-and-write 20% · technical execution 20% · UX display/voice 15% · business potential & safety 20%.
- Rules: build during hackathon (open-source libs + existing APIs OK; README must state what existed before 23 Nov). Up to 2 tracks. Only apps listed in entered tracks.
- Submit via DoraHacks: public repo + README, video ≤3 min, short description (problem / who / how / track), up to 5 feature requests, optional .ehpk.

## App concept — Glance
One glance, one action: a Telegram digest that shows unread messages from the channels you follow, then lets you reply by voice in seconds — without pulling out your phone.
- READ: digest of recent posts from public Telegram channels (real data, no login) via our backend, which fetches public channel pages (t.me/s/<channel>) and extracts + condenses messages. Verified 25 Nov: t.me/s/airdropfind returns HTTP 200, 260 message widgets from the VM.
- WRITE: AI-drafted short reply (template-based, bilingual ID/EN) + quick-reply chips; tap to confirm → deep link opens Telegram on the phone with the draft prefilled (`t.me/share/url`). No credentials, no bot token, no user data stored. Real write path, zero auth.
- VOICE: G2 mic via SDK `audioControl` + `audioEvent.audioPcm` (PCM 16kHz s16le mono) → backend `/api/stt` (faster-whisper if installed, else clear 501). In the headless simulator there is no mic device, so the demo uses a typed transcript stand-in in the companion UI — labelled on screen as simulator-only. The mic capture path is real code (from the `asr` template), not faked.
- Channels default: `airdropfind` (Ivan's airdrop source), `telegram` (official), + 1 more public channel (verify before hardcoding).

## Architecture
```
glance-app/            Vite + TS Even Hub app (from `asr` template)
  src/main.ts          bridge + screens + event routing
  src/ui.ts            companion web UI (phone side, mirrors glasses state)
  src/asr/stt.ts       STT client: PCM -> POST /api/stt (backend), snapshot callback
  src/api.ts           fetch digest/draft/share from backend (single origin)
  app.json             package_id com.ipan8.glance, name "Glance", v0.1.0,
                       edition 202601, min_sdk_version 0.0.16,
                       permissions: network (whitelist [backend origin]),
                       g2-microphone; supported_languages ["en"] (SDK allows only en/de/fr/es/it/zh/ja/ko; "id" rejected by pack validation)
server/                shared backend logic (Node, no framework)
  digest.mjs           fetch + parse t.me/s pages, condense, cache 60s
  draft.mjs            template-based draft replies (ID/EN)
  stt.mjs              faster-whisper wrapper (optional, 501 if absent)
api/                   Vercel serverless wrappers (digest, draft, share, stt)
  index.mjs            local dev server (same handlers, :3101) — 3001 is taken by freellmapi
```
- Backend origin (whitelist): Vercel deployment URL (deploy early, keep stable). Local dev uses http://localhost:3101 (dev only).
- No secrets anywhere in the repo/.ehpk. No user data stored server-side. Digest is public-channel data only.

## G2 screens (576×288, SDK text containers; ONE capturing container per page)
1. HOME — "GLANCE · Telegram" + "N new" + top 3 items (channel + headline). up/down = prev/next page, click = open item, double-click = exit dialog (root).
2. ITEM — channel + time + message text, paginated ~450 chars/page. up/down = next/prev page, click = reply screen, double-click = back to HOME.
3. REPLY — mic state + transcript/draft + quick chips. tap = mic on/off, click chip = pick draft, click "> Send" = generate deep link (companion UI shows clickable link), double-click = back.
4. SENT — "Draft ready — open Telegram to send" (glasses) + link on companion UI.
- First run: defaults work out of the box (3 public channels) — never a black screen. Channel list remembered via localStorage (setLocalStorage/getLocalStorage).
- Companion web UI: mirrors state, channel picker, typed-transcript box (simulator voice stand-in, labelled), "Open in Telegram" button, status line.

## QA gates (from App Submission & QA docs)
- Boot: lit pixels > 100, no console errors (sim-test.py).
- Root double-tap → shutDownPageContainer(1) (exit dialog). Non-root double-tap = back.
- No unused permissions; no secrets in .ehpk; `evenhub pack app.json dist -o glance.ehpk -c`.
- README states what existed before 23 Nov (asr template scaffold).

## Deliverables
- Repo: Ipan8/g2-glance (public, via browser task — MCP create_repository 403).
- Video ≤3 min: simulator screen capture (ffmpeg x11grab on Xvfb) + companion UI + TTS narration (avocado voice). Honest labels: simulator voice = typed stand-in.
- DoraHacks submit (browser task, Ivan's Ipan8 account): repo URL, video link, description, Track 01 + Best Telegram, 5 feature requests.
- BUILD-LOG.md in ~/workspace/even-realities-g2/ + this SPEC.

## Hard limits
No money (no deposit/fee/top-up), no connect/sign Ivan's wallet, no KYC/phone number, no user funds, money demos read-only only. Ivan only for: money decisions, phone-only steps (e.g. YouTube upload if needed — cloud browser Google session may cover it), final call on Demo Day attendance if finalist.

## Open items / risks
- [x] faster-whisper install — DONE 25 Nov ~19:20 (venv ~/.venvs/glance-stt, tiny model, real speech transcribed).
- [x] Verify 2nd/3rd default channels via t.me/s — DONE (telegram, durov both HTTP 200).
- [ ] Vercel backend deploy (URL for app.json whitelist) — UNRESOLVED, no CLI login on VM; localhost for demo.
- [ ] Video hosting for DoraHacks (YouTube via cloud browser Google session, else repo-hosted mp4 — check submit form).
- [ ] DoraHacks submit form fields (check via browser task at submit time).
- [ ] Demo Day 3 Dec clashes with HSK submit — finalist-only problem, decide if it happens.

## Bugs found & fixed during the build (25 Nov)
- sim-test.py orphaned vite/simulator grandchildren (plain terminate() doesn't
  reach npm/xvfb-run children) — fixed with process groups (start_new_session
  + killpg SIGKILL); stale processes served old code with byte-identical
  screenshots. Also: `pkill -f` with a literal target self-matches the exec
  shell — always use the bracket trick (`[v]ite`, `[e]venhub-simulator`).
- Simulator loads the dev URL once at startup — Vite must answer HTTP 200
  BEFORE the simulator starts, else the canvas stays blank (sim-test.py now
  polls :5173 first).
- A headline edit dropped the `timeShort` signature line (syntax error,
  `Unexpected "}"` at main.ts:102) — caught by Vite, fixed, tsc clean.
- Item screen "ghost text" was a real bug, not a stale frame: `${pages}`
  interpolated the whole string[] into the footer (`— p 1/<page text> · tap
  reply`) — fixed to `${pages.length}`.
- Screen transitions now use `rebuildPageContainer` (fresh container clears
  old text) instead of `textContainerUpgrade`.
- STT: faster-whisper's file-path transcribe() breaks on the venv's PyAV
  (`metadata_errors` kwarg) — fixed by feeding raw PCM as a numpy float32
  array via stdin, skipping PyAV entirely.
