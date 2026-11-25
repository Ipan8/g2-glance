# Glance — glasses app (Even Hub)

This folder is the G2 app itself. See the **root README** (`../README.md`)
for what it does, how to run it, and the full architecture.

Origin: this folder started as the `asr` template from
[even-realities/evenhub-templates](https://github.com/even-realities/evenhub-templates)
(mic capture + STT client skeleton + companion UI shell). The STT stub the
template ships with has been replaced: `src/asr/stt.ts` now posts mic PCM to
the Glance backend `/api/stt` (local faster-whisper, no key), `src/main.ts`
is the four-screen digest app (home / item / reply / sent), and `app.json`
declares the `network` permission for the backend origin.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
npm run pack       # build + evenhub pack -> glance.ehpk
```
