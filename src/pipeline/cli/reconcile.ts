// CLI: storyboard.json의 shot.duration_sec를 실제 audio file 길이로 보정.
//
// 사용: npm run reconcile -- <slug>
//   ex)  npm run reconcile -- pmf-discovery

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { StoryboardSchema } from "../../schemas/storyboard.js";
import { reconcileStoryboard } from "../reconcile.js";
import { runCli } from "./run.js";

async function main(slug: string): Promise<void> {
  const episodeDir = path.resolve("episodes", slug);
  const storyboardPath = path.join(episodeDir, "storyboard.json");
  const raw = JSON.parse(readFileSync(storyboardPath, "utf-8"));
  const storyboard = StoryboardSchema.parse(raw);

  const reconciled = reconcileStoryboard(storyboard, episodeDir);
  const validated = StoryboardSchema.parse(reconciled);
  writeFileSync(storyboardPath, JSON.stringify(validated, null, 2) + "\n");

  const before = storyboard.shots.reduce((s, x) => s + x.duration_sec, 0);
  const after = validated.shots.reduce((s, x) => s + x.duration_sec, 0);
  console.log(
    `reconciled ${validated.shots.length} shots: ${before.toFixed(1)}s → ${after.toFixed(1)}s`,
  );
}

runCli("reconcile <episode-slug>", main);
