// /render 인라인 어댑터의 PORT.
//
// 예전엔 render.md 안에서 Bash + Node one-liner로 `stockSrcByShotIndex`와
// `captions`를 만들었다(검증 불가, 드리프트 위험). 프로그래매틱 렌더러
// (`cli/render.ts`)로 옮기면서 순수 함수로 추출했다 — 동작은 render.md 의사코드와
// 동일하며 `tests/unit/render-adapter.test.ts`가 그 parity를 회귀로 잠근다(Finding 1A).

import type { Script } from "../schemas/script.js";
import type { Storyboard } from "../schemas/storyboard.js";
import { toCaption } from "./captions.js";

/** stock manifest entry 중 어댑터가 읽는 최소 형태(전체 스키마는 cli/stock.ts). */
export interface RenderManifestEntry {
  // stock.ts가 storyboard 순서대로 기록한 권위 있는 shot 인덱스. 있으면 우선 사용.
  shot_index?: number;
  audio_ref: string;
  // stock provider | "library" | null(매치 0건 → 폴백). null이면 자산 없음.
  provider: string | null;
  // episode 루트 기준 상대 경로들("episodes/<slug>/assets/stock/...").
  local_paths: string[];
}

export interface RenderManifest {
  entries: RenderManifestEntry[];
}

/**
 * EpisodeProps.stockSrcByShotIndex (shot index → episode-dir 기준 상대 경로 목록).
 *
 * render.md 의사코드와 동일하되, shot 매핑이 더 견고하다:
 * - provider===null 또는 local_paths 비면 skip(색 폴백 entry).
 * - **매니페스트의 권위 있는 `shot_index`를 우선** 쓰고(중복 audio_ref에 강건),
 *   범위 밖이거나 그 위치 shot의 audio_ref가 안 맞으면(예: storyboard 재정렬)
 *   `audio_ref` `findIndex`로 폴백한다.
 * - local_paths는 project root 기준이므로 `episodes/<slug>/` prefix를 떼어
 *   `--public-dir`/bundle publicDir(=episodes/<slug>) 기준 상대 경로로 만든다.
 * - 라이브러리 자산(provider:"library")도 local_paths가 채워진 일반 entry라 동일 처리.
 */
export function buildStockSrcByShotIndex(
  manifest: RenderManifest,
  storyboard: Storyboard,
  slug: string,
): Record<string, string[]> {
  const stockByShot: Record<string, string[]> = {};
  for (const entry of manifest.entries) {
    if (entry.provider === null || entry.local_paths.length === 0) continue;
    let idx = -1;
    // 권위 있는 shot_index가 storyboard와 일관되면(그 위치 shot의 audio_ref가 일치) 사용.
    if (
      typeof entry.shot_index === "number" &&
      entry.shot_index >= 0 &&
      entry.shot_index < storyboard.shots.length &&
      storyboard.shots[entry.shot_index]!.audio_ref === entry.audio_ref
    ) {
      idx = entry.shot_index;
    } else {
      idx = storyboard.shots.findIndex((s) => s.audio_ref === entry.audio_ref);
    }
    if (idx >= 0) {
      stockByShot[String(idx)] = entry.local_paths.map((p) =>
        p.replace(`episodes/${slug}/`, ""),
      );
    }
  }
  return stockByShot;
}

/**
 * EpisodeProps.captions (shot index → 화면 하단 자막 텍스트).
 *
 * render.md 의사코드와 동일: shot.audio_ref에서 line id를 떼고, script line의
 * text를 toCaption()으로 정제. 매칭 line이 없으면 빈 문자열(누락 cue 보존).
 */
export function buildCaptionsByShot(storyboard: Storyboard, script: Script): string[] {
  const lineById = new Map(script.lines.map((l) => [l.id, l]));
  return storyboard.shots.map((shot) => {
    const id = shot.audio_ref.replace(/^assets\/audio\//, "").replace(/\.wav$/, "");
    return toCaption(lineById.get(id)?.text ?? "");
  });
}
