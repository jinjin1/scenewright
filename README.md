# scenewright

**English** · [한국어](README.ko.md)

**A Claude Code–native pipeline that turns a source text into a narrated, Remotion-rendered YouTube explainer video — for any topic, at ~$0 per video.**

You drive it by running slash commands inside a [Claude Code](https://claude.com/claude-code) session. Each step reads and writes a JSON file (`JSON-as-contract`), so every stage is restartable and reviewable. Narration is synthesized **locally** with the Supertonic TTS model (Korean), and frames are rendered with [Remotion](https://remotion.dev). The LLM reasoning happens *inside your Claude Code session*, so there's no API key and no per-video model cost.

> **Not another Shorts generator.** scenewright targets **long-form explainers**, runs **inside Claude Code**, uses **local $0 Korean TTS**, and renders with Remotion. It's a structured, human-in-the-loop production pipeline — not a one-click viral-clip machine.

> ⚠️ Narration is **Korean** (the Supertonic voice presets + the English→Korean transliteration step are Korean-specific). The topic/segment is fully configurable; the language is not (yet).

---

## How it works

```
(configure once: channel.config.md + VOICE.md)
        │
/new-episode → /synopsis → /treatment → /script → /script-review → /storyboard
        │                                            (wording gate)
        ▼
/tts → /render → /publish-kit  →  episodes/{slug}/out/final.mp4
```

Each command previews its result and points you to the next — you approve before spending the expensive steps (TTS, render).

## Why it's ~$0 per video

| Cost center | How it's absorbed |
|---|---|
| LLM (script writing) | Runs **in your Claude Code session** — folded into the CC subscription, no API key |
| TTS (narration) | **Local** Supertonic ONNX model on your machine |
| Stock media | Free-tier APIs (Pexels/Unsplash/Pixabay) with your own keys — or solid-color fallback |
| Render | Local Remotion |

## Prerequisites

- **Claude Code** — the `/synopsis … /publish-kit` steps are slash commands executed in a CC session
- **Node** ≥ 18.18 + npm
- **Python** 3.10 with [`uv`](https://github.com/astral-sh/uv) — for the Supertonic bridge
- **macOS / Apple Silicon** recommended (Supertonic runs ~0.43 RTF on M-series CPU)
- *Optional:* stock API keys in `.env` (see `.env.example`). Without them, media shots fall back to solid backgrounds.
- **Remotion** is installed via npm. Note Remotion's own license for commercial/team use (see `NOTICE`).

## Quickstart

```bash
git clone <your-fork-url> scenewright && cd scenewright
npm install
# Python env for local TTS
cd python && uv venv && uv pip install -r requirements.txt && cd ..
cp .env.example .env   # (optional) add stock API keys
```

Then, **in a Claude Code session** opened in this repo:

```
/new-episode my-first-topic     # creates episodes/my-first-topic/ + source.txt
# paste your source material into episodes/my-first-topic/source.txt
/synopsis my-first-topic
/treatment my-first-topic
/script my-first-topic
/script-review my-first-topic   # wording gate (also: npm run lint:script)
/storyboard my-first-topic
/tts my-first-topic
/render my-first-topic          # stock → reconcile → captions → render
/publish-kit my-first-topic     # title/description/tags/thumbnail + required disclaimers
```

Output: `episodes/my-first-topic/out/final.mp4`.

## Configure your channel (any topic)

The engine is **domain-neutral**; topic specifics live in three files:

| File | What it controls |
|---|---|
| **`channel.config.md`** | Channel niche, persona, target audience, handle |
| **`VOICE.md`** | Script tone, cold-open hooks, banned clichés, natural-Korean rules (template; `examples/VOICE.pm.md` is a filled example) |
| **`REFERENCE/`** | Drop-in "domain knowledge cards" the writer consults (RICE/JTBD ship as examples) |

Edit those three and you've retargeted the whole pipeline — no code changes.

## Which topics fit?

Based on a survey of the faceless-explainer format (auto-generation safety, stock availability, liability):

| | Segments |
|---|---|
| ✅ **Strong fit** | Science/space · "how things work"/engineering · history · tech/AI · business case studies |
| ⚠️ **Use guardrails** | Health/psychology (**mechanism only — no medical advice**) · personal finance (**literacy only — no investment advice**) · self-development |
| ❌ **Avoid** | Book/movie/IP summaries (copyright) · medical or financial **advice** (YMYL) · breaking news |

The included demo, **`episodes/why-sky-blue`**, is a science explainer built from public-domain sources (NASA, Wikipedia) — deliberately far from any single domain to show the pipeline is general.

## Repo layout

```
channel.config.md   VOICE.md   examples/VOICE.pm.md
.claude/commands/   # the slash commands (prompt bodies)
src/                # remotion scenes, pipeline (tts, stock, transliterate, …), zod schemas
python/             # Supertonic synthesis bridge
REFERENCE/          # domain knowledge cards (examples)
episodes/{slug}/    # per-episode JSON contracts (+ gitignored assets/out)
NOTICE              # downstream obligations for media you publish
```

## Publishing obligations (read before you upload)

The code is MIT, but **videos you generate** must carry certain disclosures — `/publish-kit` automates them. See **`NOTICE`**:

- **AI-voice disclosure** (Supertonic is OpenRAIL-M) — auto-inserted in description + end card
- **Emoji attribution** (Twemoji / Google Noto, CC BY 4.0) — auto-appended when those scenes are used
- **Remotion license** — may require a company license for commercial/team use

## Status

This is a **reference implementation of a personal video-production workflow**, open-sourced as a starting point. It's opinionated, Korean-narration-centric, and provided as-is (MIT, no warranty). Issues and forks welcome.

## License

[MIT](./LICENSE) for the code. Generated-media obligations are documented in [`NOTICE`](./NOTICE).
