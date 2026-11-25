# BUILD-LOG — Glance (Even Realities G2)

Hackathon: **Heads Up: Even Realities** (DoraHacks) · $10,000 USDT ·
Track 01 Messaging & News + Best Telegram integration ·
Submit deadline **30 Nov 2026 02:59 WIB** · target **29 Nov 21:00 WIB**.

## Status — 25 Nov 2026 ~19:45 WIB: APP COMPLETE, submission prep in progress

| Item | State |
|---|---|
| Glasses app (home/item/reply/sent) | DONE, verified in simulator (real data, 0 console errors) |
| Backend digest / draft / share | DONE, tested live (12 real items, 0 failed) |
| STT (faster-whisper tiny, local CPU) | DONE, proven on real speech |
| Production build (`npm run build`, tsc clean) | DONE |
| `.ehpk` package | DONE — `glance-app/glance.ehpk` (40,883 bytes) |
| README + LICENSE + docs | DONE |
| Repo `Ipan8/g2-glance` | NOT YET CREATED — needs browser task (MCP create_repository = 403) |
| Push files | READY — paths file `push-paths.txt` (text files only; 4 PNG screenshots need a browser-task upload, push-files is text-only) |
| Demo video ≤3 min | TODO — 26–27 Nov (ffmpeg x11grab on Xvfb + TTS narration) |
| DoraHacks submit | TODO — browser task, target 27–29 Nov |
| Vercel backend deploy | UNRESOLVED — no CLI login on VM; demo uses localhost:3101; README documents `vercel deploy` as the production step |

## Verified numbers (25 Nov)

- Backend `/api/digest`: 12 real items from 3 public channels, 0 failed.
- `/api/draft`: keyword-aware draft + chips; `/api/share`: shareUrl + tgMsg.
- `/api/stt`: real English speech sample (Signal Logic male.wav, 8 kHz →
  resampled 16 kHz) transcribed accurately by faster-whisper tiny;
  pure-tone input returns empty text (client keeps the draft, no crash);
  empty body → 400; engine absent → 501.
- Simulator harness (`scripts/sim-test.py click down click long_press`):
  ready marker True · boot 3,780 lit px · item 1,115 · reply 3,312 ·
  sent 2,043 · console errors 0 · OK.
- `npm run build`: tsc clean, vite build 8 modules, 95.42 kB JS.
- `evenhub pack`: `glance.ehpk` 40,883 bytes, min_app_version 2.2.10.
  Server-side ID check (`-c`) needs `evenhub login` — not done (interactive,
  needs an Even Hub account); the package itself is stamped and the `.ehpk`
  is optional for submission.

## Files

```
~/workspace/even-realities-g2/
  README.md  LICENSE  .gitignore
  docs/SPEC.md  docs/SDK-REFERENCE.md  docs/screenshots/01–04-*.png
  glance-app/  (Vite + TS; app.json package_id com.ipan8.glance v0.1.0)
  server/      (Node backend, :3101; faster-whisper venv ~/.venvs/glance-stt)
  api/         (Vercel serverless wrappers)
  scripts/sim-test.py   (headless simulator harness)
  shots/       (dev screenshots, not in the repo)
  BUILD-LOG.md (this file)
```

Backend server: run `node server/index.mjs` (PID 68182 at last check, :3101).
Keep it running for demo/video work; it does not survive VM restarts.

## Repo setup

1. Create public repo **Ipan8/g2-glance** on GitHub (no README/init —
   files come from the push).
2. Push text files via the GitHub CLI/MCP push-files flow
   (`--source-dir` this folder, `--paths-file push-paths.txt` —
   paths file is NUL-delimited, ends with trailing NUL).
3. Upload the 4 PNGs in `docs/screenshots/` via GitHub web
   upload (push-files cannot carry binary files), set About
   (website https://dorahacks.io/hackathon/even-realities/detail, topics:
   `even-realities`, `g2`, `telegram`, `hackathon`).
4. Verify: repo page lists the files + README renders + screenshots load.

## DoraHacks submit

- Form fields to confirm at submit time: repo URL, video link (YouTube —
  upload via the Google session, else repo-hosted mp4), short description
  (problem / who / how / track), tracks: **01 Messaging & News** + **Best
  Telegram integration**, 5 feature requests (listed in README.md
  §Feature requests).
- After submit: two-layer verify (status + re-check) and record the
  submission id/link here.

## Risks / open items

- Vercel backend has no deploy path from this VM (no token/CLI login).
  Demo uses localhost; production is one `vercel deploy` + whitelist edit.
- Demo Day 3 Dec 17:00–21:00 WIB clashes with HSK submit day — only
  matters if Glance is a finalist.
- `evenhub login` needed for the server-side package-ID check — optional.

## Bugs fixed during the build (see docs/SPEC.md for detail)

- sim-test.py orphaned vite/simulator grandchildren → process groups + killpg.
- `pkill -f` self-match → bracket trick.
- Simulator blank canvas if Vite not up at sim start → poll :5173 first.
- Headline edit dropped the `timeShort` signature (syntax error) → fixed.
- Item-screen "ghost text" = `${pages}` interpolating a string[] into the
  footer → `${pages.length}`.
- Screen transitions → `rebuildPageContainer` (clears old text).
- STT PyAV incompatibility → feed raw PCM as numpy float32 via stdin.
- `supported_languages: ["id"]` rejected by pack validation (SDK allows only
  en/de/fr/es/it/zh/ja/ko) → declared `["en"]`, content stays bilingual.
