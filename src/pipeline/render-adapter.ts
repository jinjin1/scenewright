// /render 인라인 어댑터의 PORT.
//
// 예전엔 render.md 안에서 Bash + Node one-liner로 `stockSrcByShotIndex`와
// `captions`를 만들었다(검증 불가, 드리프트 위험). 프로그래매틱 렌더러
// (`cli/render.ts`)로 옮기면서 순수 함수로 추출했다 — 동작은 render.md 의사코드와
// 동일하며 `tests/unit/render-adapter.test.ts`가 그 parity를 회귀로 잠근다(Finding 1A).

import type { Script } from "../schemas/script.js";
import type { Storyboard } from "../schemas/storyboard.js";
import type { ManifestEntry } from "./stock/manifest.js";
import { captionByShot } from "./captions.js";

// 어댑터가 읽는 manifest entry 필드(권위 타입 ManifestEntry의 부분집합).
// shot_index는 옛 manifest엔 없을 수 있어 optional, provider는 옛 임의 문자열도 받게 넓게.
export type RenderManifestEntry = Pick<ManifestEntry, "audio_ref" | "local_paths"> & {
  shot_index?: number;
  provider: string | null;
};

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
 * 캡션 빌드 로직은 captions.ts의 `captionByShot`이 단일 소스다(SRT 경로와 공유).
 * 여기서는 EpisodeProps 형태로 노출하는 얇은 어댑터만 유지한다.
 */
export function buildCaptionsByShot(storyboard: Storyboard, script: Script): string[] {
  return captionByShot(storyboard, script);
}
