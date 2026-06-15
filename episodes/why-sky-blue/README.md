# Demo episode — `why-sky-blue` (왜 하늘은 파란가)

A short, original **science** explainer used as scenewright's reference example. It's
deliberately *not* product-management content — it demonstrates that the pipeline works
for any topic just by setting `channel.config.md` (here: a general-knowledge profile).

**Copyright:** `source.txt` is original prose built from widely-known physics (Rayleigh
scattering). It does not reproduce any single copyrighted work. Background references:
NASA Space Place "Why Is the Sky Blue?", Wikipedia "Rayleigh scattering" / "Diffuse sky
radiation".

## What's committed (the JSON contracts)

| File | Stage |
|---|---|
| `source.txt` | input |
| `synopsis.json` | 1 — identity (logline, cold-open hook, takeaways) |
| `treatment.json` | 2 — 6-scene structure |
| `script.json` | 3 — 18 narration lines + inline visual directives |
| `storyboard.json` | 4 — flattened shots + Remotion meta (1920×1080 @ 30fps) |

All four are schema-valid (`src/schemas/*`). Heavy outputs (`assets/audio/`, `out/final.mp4`,
thumbnail) are **gitignored** — generate them locally.

## Finish it locally

In a Claude Code session opened in this repo:

```
/tts why-sky-blue         # synthesize narration (Supertonic, local, ~Korean)
/render why-sky-blue      # stock → reconcile → captions → render
/publish-kit why-sky-blue # title/description/tags + AI-voice disclaimer
```

Output: `episodes/why-sky-blue/out/final.mp4`. Re-run any stage by re-invoking its command
(e.g. edit `source.txt`, then `/synopsis why-sky-blue`).
