import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

// Remotion의 Episode 컴포지션에서 단일 frame을 PNG로 추출.
// CLI 진입점에서 inputProps에 실제 storyboard.json을 주입 — 비어있으면 Root의
// placeholderProps가 그대로 렌더됨 (Walking Skeleton 캡션).
export async function renderThumbnail(args: {
  outputPath: string;
  frame?: number;
  inputProps?: Record<string, unknown>;
}): Promise<void> {
  const { outputPath, frame = 30, inputProps } = args;
  const entryPoint = path.resolve("src/remotion/index.ts");
  // remotion render CLI는 remotion.config.ts를 자동으로 읽지만 bundle()을 직접
  // 호출할 땐 webpackOverride를 명시해야 함. ESM `.js` import → `.ts/.tsx` 매핑.
  const serveUrl = await bundle({
    entryPoint,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: {
          ".js": [".ts", ".tsx", ".js"],
          ".jsx": [".tsx", ".jsx"],
        },
      },
    }),
  });
  const composition = await selectComposition({
    serveUrl,
    id: "Episode",
    inputProps,
  });
  await renderStill({
    composition,
    serveUrl,
    output: outputPath,
    frame,
    inputProps,
  });
}
