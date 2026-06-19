// stock manifest.json 읽기-측 파서 — 단수/복수 스키마를 통일한다.
//
// 왜: 멀티컷 도입 전 옛 manifest는 단수형 attribution/local_path만 가졌고 keywords[]도 없다.
//   복수형(attributions/local_paths)을 가정하면 백필이 옛 에피소드(내부 파일럿 등)에서
//   크래시한다(QA 발견). 모든 필드를 optional로 두고 여기서 통일한다. cli/library.ts의
//   진입점(main)을 임포트하지 않고 테스트할 수 있도록 CLI에서 분리.

import type { MediaResult, Provider } from "./types.js";

// ── 권위 있는 manifest 형태 (cli/stock.ts가 기록하는 단일 소스) ──────────────
// stock manifest.json의 한 entry. 작성자(cli/stock.ts)는 항상 복수형 필드(keywords/
// local_paths/attributions)를 채우고, 단수형(keyword/local_path/attribution)은 옛
// reader를 위한 back-compat다. 아래 reader 뷰(Lite/Sheet/Render)는 모두 이 타입에서
// 파생한다 — 필드 타입이 바뀌면 reader가 자동으로 따라오고, 손으로 4벌을 맞출 필요가 없다.
export interface ManifestEntry {
  shot_index: number;
  shot_id: string;
  scene_id: string;
  audio_ref: string;
  media_type: "photo" | "video" | "color";
  // 첫 매치 키워드 (back-compat). 전체는 keywords[].
  keyword: string | null;
  keywords: string[];
  // 첫 자산의 provider (back-compat; null이면 매치 0건 → 폴백).
  // "library" = 운영자 큐레이션 라이브러리 자산(attribution 불필요).
  provider: Provider | "library" | null;
  // 첫 자산 경로 (back-compat). 전체는 local_paths[].
  local_path: string | null;
  local_paths: string[];
  // 첫 자산 attribution (back-compat). 전체는 attributions[].
  attribution: MediaResult | null;
  attributions: MediaResult[];
  // 증분 fetch용 검색 입력 스냅샷 — 다음 run이 안 바뀐 shot을 재검색 없이 재사용할 수 있게.
  // (옛 manifest엔 없음 → undefined → 입력 비교 미스 → 재검색. 안전한 마이그레이션.)
  input_keywords: string[];
  input_image_ref: string | null;
}

export interface Manifest {
  generated_at: string;
  entries: ManifestEntry[];
  attribution_block: string;
}

// 읽기-측 부분집합. 옛(단수)·새(복수) 스키마를 모두 받기 위해 단수·복수 필드를 optional로,
// provider는 옛 임의 문자열도 받도록 넓게(string) 둔다. ManifestEntry에서 파생.
export type ManifestEntryLite = Pick<ManifestEntry, "shot_id" | "media_type"> & {
  provider: string | null;
} & Partial<
    Pick<
      ManifestEntry,
      | "keyword"
      | "keywords"
      | "local_path"
      | "local_paths"
      | "attribution"
      | "attributions"
    >
  >;

export interface ManifestLite {
  generated_at: string;
  entries: ManifestEntryLite[];
}

/**
 * 한 entry를 (asset, localPath) 쌍 목록으로 정규화한다. 복수형 우선, 없으면 옛 단수형 폴백.
 * library 자산(attribution 없음)·color 자산은 빈 목록을 돌려준다.
 */
export function normalizeEntryAssets(
  entry: ManifestEntryLite,
): { asset: MediaResult; localPath: string | undefined }[] {
  const assets = entry.attributions ?? (entry.attribution ? [entry.attribution] : []);
  const paths = entry.local_paths ?? (entry.local_path != null ? [entry.local_path] : []);
  return assets.map((asset, i) => ({ asset, localPath: paths[i] }));
}

/** 이 자산을 골랐던 대표 키워드(복수형 우선, 옛 단수형 폴백). */
export function entryPrimaryKeyword(entry: ManifestEntryLite): string | null {
  return entry.keywords?.[0] ?? entry.keyword ?? null;
}
