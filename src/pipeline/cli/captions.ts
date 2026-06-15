// CLI: storyboard + script → episodes/<slug>/captions.srt
//
// 사용: npm run captions -- <slug>
//   /tts 와 /reconcile 이 먼저 끝나 있어야 정확한 timestamp가 나옴.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ScriptSchema } from "../../schemas/script.js";
import { StoryboardSchema } from "../../schemas/storyboard.js";
import { buildCues, formatSrt } from "../captions.js";
import { runCli } from "./run.js";

async function main(slug: string): Promise<void> {
  const episodeDir = path.resolve("episodes", slug);
  const script = ScriptSchema.parse(
    JSON.parse(readFileSync(path.join(episodeDir, "script.json"), "utf-8")),
  );
  const storyboard = StoryboardSchema.parse(
    JSON.parse(readFileSync(path.join(episodeDir, "storyboard.json"), "utf-8")),
  );

  const cues = buildCues(storyboard, script);
  const srt = formatSrt(cues);
  const outPath = path.join(episodeDir, "captions.srt");
  writeFileSync(outPath, srt);
  console.log(`wrote ${cues.length} cues → ${path.relative(process.cwd(), outPath)}`);
}

runCli("captions <episode-slug>", main);
