// CLI: Episode 컴포지션의 첫 TitleCard frame을 PNG로 출력.
//
// 사용: npm run thumbnail -- <slug> [frame]
//   frame 기본값 30 (1초 시점). 보통 fade-in 끝나는 시점에 인상적인 프레임이 잡힘.

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { StoryboardSchema } from "../../schemas/storyboard.js";
import { renderThumbnail } from "../thumbnail.js";
import { runCli } from "./run.js";

async function main(slug: string): Promise<void> {
  const frame = process.argv[3] ? Number(process.argv[3]) : 30;
  if (!Number.isFinite(frame) || frame < 0) {
    console.error(`invalid frame: ${process.argv[3]}`);
    process.exit(2);
  }

  const episodeDir = path.resolve("episodes", slug);
  const storyboard = StoryboardSchema.parse(
    JSON.parse(readFileSync(path.join(episodeDir, "storyboard.json"), "utf-8")),
  );

  // publish-kit이 기대하는 위치(publish/thumbnail.png)에 직접 출력.
  const publishDir = path.join(episodeDir, "publish");
  mkdirSync(publishDir, { recursive: true });
  const outputPath = path.join(publishDir, "thumbnail.png");

  await renderThumbnail({
    outputPath,
    frame,
    inputProps: {
      storyboard,
      audioBaseUrl: `file://${episodeDir}`,
      stockSrcByShotIndex: {},
    },
  });

  console.log(
    `wrote thumbnail (frame ${frame}) → ${path.relative(process.cwd(), outputPath)}`,
  );
}

runCli("thumbnail <episode-slug> [frame]", main);
