/**
 * CLI: episodes/<slug>/script.json → episodes/<slug>/assets/audio/<id>.wav
 *
 * 사용: npm run tts -- <slug>
 *   ex)  npm run tts -- pmf-discovery
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { ScriptSchema } from "../../schemas/script.js";
import { transliterate } from "../transliterate.js";
import { SupertonicProvider } from "../tts.js";
import { runCli } from "./run.js";

async function main(slug: string): Promise<void> {
  const episodeDir = path.resolve("episodes", slug);
  const scriptPath = path.join(episodeDir, "script.json");
  const raw = JSON.parse(readFileSync(scriptPath, "utf-8"));
  const script = ScriptSchema.parse(raw);

  const lines = script.lines.map((line) => ({
    id: line.id,
    text: transliterate(line.text),
  }));

  const outDir = path.join(episodeDir, "assets", "audio");
  const provider = new SupertonicProvider();
  const results = await provider.synthesize(lines, outDir);

  for (const r of results) {
    console.log(`  ${r.id} → ${path.relative(process.cwd(), r.path)}`);
  }
}

runCli("tts <episode-slug>", main);
