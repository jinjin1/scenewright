// CLI: Episode 컴포지션의 한 frame을 PNG로 출력.
//
// 사용: npm run thumbnail -- <slug> [frame]
//   frame 기본값 30 (1초 시점). 오프닝 마스터 페이드업이 frame 15(0.5s)에, 씬 자체 진입이
//   ~frame 20에 끝나므로 기본값 30은 모두 끝난 안전 구간이다. 페이드 구간(< 15) 프레임을
//   직접 지정하면 검정 백드롭이 비쳐 어둡거나(=frame 0은 완전 검정) 캡처되니 경고한다.

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { StoryboardSchema } from "../../schemas/storyboard.js";
import { openingFadeEndFrame } from "../../remotion/compositions/utils.js";
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

  // 오프닝 페이드업 구간 안의 프레임은 비주얼이 검정 백드롭 위로 페이드 중이라 어둡게(또는
  // frame 0은 완전 검정으로) 잡힌다. 명시적 선택은 막지 않되 의도치 않은 검은 썸네일을 경고.
  const fadeEnd = openingFadeEndFrame(storyboard.meta.fps);
  if (frame < fadeEnd) {
    console.warn(
      `⚠ frame ${frame}은 오프닝 페이드업(0~${fadeEnd}f) 구간 — 썸네일이 어둡거나 검게 나올 수 있습니다. frame ${fadeEnd} 이상을 권장합니다.`,
    );
  }

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
