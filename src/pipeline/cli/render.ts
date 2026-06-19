/**
 * CLI: episodes/<slug> → out/final.mp4 (+ out/render-stats.json)
 *
 * 사용: npm run render -- <slug>
 *
 * render.md step 4(`npx remotion render` CLI)를 대체하는 프로그래매틱 렌더러.
 * @remotion/bundler `bundle()` + @remotion/renderer `renderMedia()`를 직접 호출해
 * `onStart`/`onProgress`로 **render vs encode 시간·프레임 수를 분해** 기록한다
 * (render-stats.json). "느림"을 추적 수치로 만들어 quick-win 효과를 before/after 증명.
 *
 * 선행(= /render 커맨드 순서): npm run stock → reconcile → captions.
 * stock/captions 어댑터는 render-adapter.ts에서 PORT(단위 테스트로 parity 보장).
 *
 * ⚠️ 이 모듈은 remotion *컴포넌트*를 import하지 않는다(.png import 등이 tsx에서 깨짐).
 *    inputProps는 plain object로 만들고 검증은 번들 안의 Composition(zod)에 맡긴다.
 */

import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ScriptSchema } from "../../schemas/script.js";
import { StoryboardSchema } from "../../schemas/storyboard.js";
import {
  buildCaptionsByShot,
  buildStockSrcByShotIndex,
  type RenderManifest,
} from "../render-adapter.js";
import { MAX_STOCK_WIDTH } from "../stock/select.js";
import { assertValidSlug } from "../slug.js";

const COMPOSITION_ID = "Episode";
const ENTRY_POINT = "src/remotion/index.ts";
// 기본 28s delayRender는 stock 미디어 fetch/디코드에 짧다(handoff: 4K에서 타임아웃).
// 1920w 캡 이후에도 여유롭게.
const RENDER_TIMEOUT_MS = 120_000;

const r2 = (n: number): number => Math.round(n * 100) / 100;
const r1 = (n: number): number => Math.round(n * 10) / 10;

// 렌더는 수십 분 걸리고 Remotion은 체크포인트가 없다 — 도중에 시스템이 슬립에 들면
// 헤드리스 Chrome의 CDP 연결이 끊겨 전체 렌더가 통째로 날아간다(실측 내부 파일럿:
// 배터리 노트북에서 뚜껑 덮음 → "Clamshell Sleep" → frame 12929에서 "Target closed" /
// "browser has disconnected"로 사망). 렌더 프로세스는 시스템 슬립 차단 assertion을 걸지
// 않으므로(디스플레이 슬립만 막힘), macOS에선 caffeinate로 명시적으로 막는다.
//   -dimsu: display/idle/disk/system/user 슬립 방지, -w <pid>: 이 프로세스가 끝나면 자동 해제.
// ⚠️ 완전 보호는 AC 전원에서만. 배터리 + 뚜껑 덮음(clamshell)은 OS가 강제로 재우므로
//    caffeinate로도 못 막는다 — 장편 렌더는 AC 연결 또는 뚜껑을 열어둘 것.
function preventSleepDuringRender(): void {
  if (process.platform !== "darwin") return;
  try {
    // 같은 process group에 둬서 렌더가 Ctrl-C로 죽으면 caffeinate도 곧장 동반 종료되게 한다
    // (detached로 분리하면 -w poll 주기만큼 sleep assertion이 잠깐 남는다). node가 먼저
    // 빠져나가는 건 unref()가 보장 — caffeinate는 -w <pid>로 알아서 끝난다.
    const caffeinate = spawn("caffeinate", ["-dimsu", "-w", String(process.pid)], {
      stdio: "ignore",
    });
    caffeinate.on("error", () => {
      /* caffeinate 미존재 등 — 보호만 못 받고 렌더는 진행 */
    });
    caffeinate.unref();
  } catch {
    /* spawn 자체 실패 — 무시 */
  }
}

interface RenderStats {
  slug: string;
  frames: number;
  fps: number;
  videoDurationSec: number;
  wallClockSec: number;
  // render(프레임 래스터) vs encode(인코딩) 분해 — onProgress의 *DoneIn.
  renderSec: number | null;
  encodeSec: number | null;
  bundleSec: number;
  // RTF = wall-clock 렌더 시간 ÷ 영상 길이. >1 = 실시간보다 느림. 목표 <1.
  rtf: number;
  renderFps: number;
  concurrency: number;
  flags: string;
  ts: string;
}

async function main(): Promise<void> {
  const slug = process.argv[2];
  assertValidSlug(slug);

  // 렌더 도중 시스템 슬립으로 브라우저가 죽는 것 방지(macOS). 위 helper 주석 참조.
  preventSleepDuringRender();

  const episodeDir = path.resolve("episodes", slug);
  const storyboard = StoryboardSchema.parse(
    JSON.parse(readFileSync(path.join(episodeDir, "storyboard.json"), "utf-8")),
  );
  const script = ScriptSchema.parse(
    JSON.parse(readFileSync(path.join(episodeDir, "script.json"), "utf-8")),
  );

  // manifest는 stock 단계 산출. 없으면 stock 자산 없이(LineCard 폴백) 렌더.
  const manifestPath = path.join(episodeDir, "assets", "stock", "manifest.json");
  let manifest: RenderManifest = { entries: [] };
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as RenderManifest;
  } else {
    console.warn(`render: ${path.relative(process.cwd(), manifestPath)} 없음 — stock 자산 없이 렌더(LineCard 폴백).`);
  }

  // EpisodeProps. 검증은 번들 안 Composition의 zod 스키마가 수행(import 회피).
  const inputProps: Record<string, unknown> = {
    storyboard,
    // 빈 문자열이면 Episode가 staticFile(audio_ref)로 폴백 → publicDir 기준 해석.
    audioBaseUrl: "",
    stockSrcByShotIndex: buildStockSrcByShotIndex(manifest, storyboard, slug),
    captions: buildCaptionsByShot(storyboard, script),
  };

  const outDir = path.join(episodeDir, "out");
  mkdirSync(outDir, { recursive: true });
  const outputLocation = path.join(outDir, "final.mp4");

  // Finding 4A: concurrency를 cores-1로 명시(빠뜨리면 Remotion 기본 ≈코어 절반이라 1.84x 손해).
  const concurrency = Math.max(1, os.cpus().length - 1);

  // GL 백엔드 — 기본 "angle"(macOS Metal HW 합성). Remotion 헤드리스 기본값 swangle
  // (소프트웨어 GL)은 그라디언트·transform·SVG·blendMode를 전부 CPU 래스터라 느리다.
  // 측정(내부 파일럿 1456f): swangle render 254.6s → angle 32.8s (7.8x), wall 272.7s →
  // 45.1s (6.0x), RTF 5.62 → 0.93. 출력 파리티 육안 확인됨. 문제 시 REMOTION_GL=swangle.
  const gl = (process.env.REMOTION_GL as
    | "angle"
    | "angle-egl"
    | "egl"
    | "swangle"
    | "swiftshader"
    | "vulkan"
    | undefined) || "angle";
  // HW 인코드(VideoToolbox)는 opt-in — encode 슬라이스만 줄이고(~1.7s) 화질·파일크기
  // 미세 변동 여지. 큰 레버는 gl이라 기본은 software encode 유지. REMOTION_HWACCEL=if-possible.
  const hardwareAcceleration =
    (process.env.REMOTION_HWACCEL as "disable" | "if-possible" | "required" | undefined) ||
    "disable";

  // publicDir=episodeDir 오버라이드 때문에 Remotion이 프로젝트 루트 public/(emoji 등 공유 자산)을
  // 보지 못한다. DecisionMatrix/ReactionBeat가 staticFile("emoji/twemoji/<cp>.svg")로 로드하므로,
  // 루트 public/ 트리를 episodeDir로 머지해 둔다(이미 있는 assets/out/JSON은 보존 — force:false).
  // 안 하면 emoji 404 → cancelRender로 렌더 전체가 죽는다(특히 워크트리는 루트 public/이 episodeDir
  // 밖이라 항상 미스). public/은 작아서(수백 KB SVG) 복사 비용 무시 가능.
  const rootPublic = path.resolve("public");
  if (existsSync(rootPublic)) {
    cpSync(rootPublic, episodeDir, { recursive: true, force: false, errorOnExist: false });
  }

  console.log(`render: bundling ${ENTRY_POINT} (publicDir=episodes/${slug})…`);
  const bundleStart = Date.now();
  const serveUrl = await bundle({
    entryPoint: path.resolve(ENTRY_POINT),
    // staticFile(audio_ref)/stock 경로가 episode 디렉터리 기준으로 풀리도록.
    // (renderMedia엔 publicDir 옵션이 없어 bundle 시점에 지정해야 한다.)
    publicDir: episodeDir,
    // episode 디렉터리(assets/audio·stock + 직전 out/final.mp4)를 통째로 번들에
    // 복사하지 않고 심볼릭 링크 — 재렌더마다 수백 MB가 /tmp로 복사되는 것 방지.
    // (번들 자체는 아래 finally에서 삭제하므로 throwaway, 심링크가 안전.)
    symlinkPublicDir: true,
    // remotion render CLI는 remotion.config.ts를 자동으로 읽지만 bundle()을 직접
    // 호출할 땐 webpackOverride를 명시해야 함. ESM `.js` import → `.ts/.tsx` 매핑
    // (thumbnail.ts와 동일 — remotion.config.ts의 overrideWebpackConfig 미적용 때문).
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
  const bundleSec = (Date.now() - bundleStart) / 1000;

  try {
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
      chromiumOptions: { gl },
    });
    const frames = composition.durationInFrames;
    const fps = composition.fps;
    const videoDurationSec = frames / fps;

    let renderedDoneIn: number | null = null;
    let encodedDoneIn: number | null = null;
    let lastLoggedPct = -1;

    console.log(
      `render: ${frames} frames @ ${fps}fps (${r2(videoDurationSec)}s), concurrency=${concurrency}…`,
    );
    const renderStart = Date.now();
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps,
      concurrency,
      chromiumOptions: { gl },
      hardwareAcceleration,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      onProgress: ({ progress, renderedFrames, encodedFrames, renderedDoneIn: rd, encodedDoneIn: ed }) => {
        renderedDoneIn = rd;
        encodedDoneIn = ed;
        const pct = Math.floor(progress * 100);
        if (pct !== lastLoggedPct && pct % 5 === 0) {
          lastLoggedPct = pct;
          process.stdout.write(
            `\r  ${String(pct).padStart(3)}%  rendered ${renderedFrames}/${frames}  encoded ${encodedFrames}   `,
          );
        }
      },
    });
    process.stdout.write("\n");
    const wallClockSec = (Date.now() - renderStart) / 1000;

    const stats: RenderStats = {
      slug,
      frames,
      fps,
      videoDurationSec: r2(videoDurationSec),
      wallClockSec: r2(wallClockSec),
      renderSec: renderedDoneIn != null ? r2(renderedDoneIn / 1000) : null,
      encodeSec: encodedDoneIn != null ? r2(encodedDoneIn / 1000) : null,
      bundleSec: r2(bundleSec),
      rtf: videoDurationSec > 0 ? r2(wallClockSec / videoDurationSec) : 0,
      renderFps: wallClockSec > 0 ? r1(frames / wallClockSec) : 0,
      concurrency,
      flags: `h264 conc${concurrency} stockcap${MAX_STOCK_WIDTH}w gl=${gl ?? "default"} hwaccel=${hardwareAcceleration}`,
      ts: new Date().toISOString(),
    };

    // fs write 실패가 렌더 성공을 무효화하면 안 됨(이미 final.mp4는 나왔다).
    try {
      const statsPath = path.join(outDir, "render-stats.json");
      writeFileSync(statsPath, JSON.stringify(stats, null, 2) + "\n");
      console.log(`render-stats → ${path.relative(process.cwd(), statsPath)}`);
    } catch (err) {
      console.warn("render: render-stats.json 기록 실패(렌더 자체는 성공):", err);
    }

    const decomp =
      stats.renderSec != null && stats.encodeSec != null
        ? ` (render ${stats.renderSec}s + encode ${stats.encodeSec}s)`
        : "";
    console.log(
      `✓ ${path.relative(process.cwd(), outputLocation)}  RTF ${stats.rtf}  ` +
        `${stats.wallClockSec}s wall / ${stats.videoDurationSec}s video${decomp}`,
    );
  } finally {
    // 임시 번들 디렉터리 정리 — 재렌더마다 /tmp에 번들이 쌓이는 것 방지(성공·실패 모두).
    // symlinkPublicDir라 episode 자산은 복사본이 아니라 링크 — rm은 링크만 끊고 원본은 안전.
    rmSync(serveUrl, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
