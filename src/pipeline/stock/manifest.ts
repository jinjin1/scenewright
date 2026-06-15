// stock manifest.json 읽기-측 파서 — 단수/복수 스키마를 통일한다.
//
// 왜: 멀티컷 도입 전 옛 manifest는 단수형 attribution/local_path만 가졌고 keywords[]도 없다.
//   복수형(attributions/local_paths)을 가정하면 백필이 옛 에피소드(내부 파일럿 등)에서
//   크래시한다(QA 발견). 모든 필드를 optional로 두고 여기서 통일한다. cli/library.ts의
//   진입점(main)을 임포트하지 않고 테스트할 수 있도록 CLI에서 분리.

import type { MediaResult } from "./types.js";

// cli/stock.ts ManifestEntry와 구조 호환(읽기 전용 부분집합). 옛/새 스키마를 모두 받기 위해
// 단수·복수 필드를 전부 optional로 둔다.
export interface ManifestEntryLite {
  shot_id: string;
  media_type: "photo" | "video" | "color";
  keyword?: string | null;
  keywords?: string[];
  provider: string | null;
  local_path?: string | null;
  local_paths?: string[];
  attribution?: MediaResult | null;
  attributions?: MediaResult[];
}

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
