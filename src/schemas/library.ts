// 크로스-에피소드 스톡 자산 라이브러리 — 글로벌 인덱스 스키마.
//
// 왜: 스톡 자산은 에피소드-로컬로만 저장돼(episodes/{slug}/assets/stock/) 에피소드 A가
//   받은 자산을 에피소드 B가 못 보고 stock API를 다시 친다. 이 인덱스는 "지금까지 받은
//   모든 자산 + 메타데이터"를 단일 카탈로그(assets/stock/index.json)로 모아, API 앞단에서
//   재활용을 가로채 쿼터를 아낀다. JSON-as-contract 원칙(CLAUDE.md)에 따라 zod로 검증한다.

import { z } from "zod";

// types.ts의 MediaResult를 zod로 미러링(구조 동일). publish-kit attribution에 그대로 쓰이므로
// provider page URL·photographer 등 원본 필드를 모두 보존한다.
export const MediaResultSchema = z.object({
  provider: z.enum(["pexels", "unsplash", "pixabay"]),
  id: z.string(),
  url: z.string(),
  download_url: z.string(),
  thumb_url: z.string(),
  width: z.number(),
  height: z.number(),
  duration_sec: z.number().optional(),
  photographer: z.string(),
  photographer_url: z.string(),
  license_note: z.string(),
  tags: z.array(z.string()).optional(),
});

// 자산이 어느 에피소드의 어느 shot에 쓰였는지(provenance). 다양성 가드(과사용 판정)와
// 카탈로그 used_by 표시의 근거.
export const UsageSchema = z.object({
  slug: z.string(),
  shot_id: z.string(),
  used_at: z.string(), // ISO 8601
});

export const LibraryEntrySchema = z.object({
  // 자산 정체성 — "provider:id". cacheKey와 달리 사람이 읽을 수 있고 manifest와도 매칭된다.
  key: z.string(),
  provider: z.enum(["pexels", "unsplash", "pixabay"]),
  media_type: z.enum(["photo", "video"]),
  // assets/stock/pool/ 아래 콘텐츠 주소 경로(프로젝트 루트 기준 상대). 단일 저장 위치.
  pool_path: z.string(),
  width: z.number(),
  height: z.number(),
  duration_sec: z.number().optional(),
  // publish-kit 크레딧용 원본 attribution.
  attribution: MediaResultSchema,
  // provider가 준 서술 토큰(소문자 정규화). searchIndex 관련도 점수의 근거.
  tags: z.array(z.string()),
  // 이 자산을 실제로 골랐던 모든 검색 키워드(누적·중복 제거). 의미 매칭의 핵심 신호 —
  // 같은 자산이 여러 키워드로 매치될수록 재활용 후보로 강해진다.
  matched_keywords: z.array(z.string()),
  used_by: z.array(UsageSchema),
  first_seen: z.string(), // ISO 8601
  last_used: z.string(), // ISO 8601
  bytes: z.number().optional(),
});

export const LibraryIndexSchema = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  entries: z.array(LibraryEntrySchema),
});

export type MediaResultLike = z.infer<typeof MediaResultSchema>;
export type Usage = z.infer<typeof UsageSchema>;
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;
export type LibraryIndex = z.infer<typeof LibraryIndexSchema>;
