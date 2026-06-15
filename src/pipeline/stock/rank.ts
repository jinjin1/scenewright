// Stock 자산 재랭킹 + 스타일 라우팅.
//
// 왜: provider 기본 정렬은 "인기순"이라 1순위 = 모두가 본 그 클립이고, 그중엔
//   "빈 폰/노트북 목업·흰 배경 isolated 컷" 같은 광고용 자산이 섞여 영상에 깔리면
//   식상하거나 화면이 비어 보인다(운영자 회고: blank 폰→노트북 화면이 연달아 잡혀
//   2번 재렌더). API에 네거티브 검색어가 없으므로 **선택 단계에서** provider가 준
//   tags/alt를 보고 거른다.
//
// 무엇을:
//   1) blank/mockup/cliché 신호 태그가 붙은 자산은 후순위(clean이 부족할 때만 사용).
//   2) 키워드 토큰과 태그가 겹치는 자산을 우선(관련도).
//   3) 키워드가 일러스트 결을 암시하면(cartoon/flat illustration 등) Pixabay
//      illustration 채널로 라우팅하는 intent 판정을 제공.
//
// 전부 결정적(determinstic) — 같은 입력은 같은 순서. 재렌더 캐시가 깨지지 않는다.

import type { MediaResult } from "./types.js";

// blank/목업/광고 cliché 신호. 하나라도 매치하면 "penalized"(후순위).
// 단어 경계로 매칭해 "blanket" 같은 오탐을 피한다. 다단어 구(white background)는
// 태그를 공백으로 이어붙인 문자열에서 그대로 매칭된다.
const BLANK_RE =
  /\b(blank|mockup|mock[- ]?up|empty|copy[- ]?space|copyspace|white background|plain background|isolated|template|placeholder|clipping path|cut[- ]?out|cutout|white screen|empty screen|blank screen)\b/;

// 화면 달린 기기 — 그 자체론 무해(쓰는 손/장면이면 OK)하지만 blank 신호와 겹치면
// 정확히 운영자가 싫어한 "흰 화면 폰" 케이스라 페널티를 키운다.
const DEVICE_RE =
  /\b(phone|smartphone|mobile|iphone|android phone|laptop|notebook|tablet|ipad|screen|monitor|display|computer)\b/;

// 일러스트/카툰 결 암시어. 키워드에 있으면 Pixabay illustration 채널로 라우팅.
// (심슨 등 저작권 캐릭터는 사용 불가 — 합법적인 flat/vector 결만.)
const ILLUSTRATION_HINTS = [
  "illustration",
  "illustrated",
  "vector",
  "flat design",
  "flat icon",
  "cartoon",
  "line art",
  "lineart",
  "clipart",
  "clip art",
  "doodle",
  "comic",
  "isometric",
];

/**
 * provider가 준 tags/alt를 소문자 토큰 배열로 정규화한다.
 * - string[]: Unsplash tags[].title 등 — 각 원소를 토큰화.
 * - string: Pixabay `tags`(콤마 구분) / Pexels `alt`(문장) — 분해.
 * 알파넘 토큰만, 길이 2+ 유지. 중복 제거.
 */
export function normalizeTags(input: string | string[] | undefined | null): string[] {
  if (!input) return [];
  const parts = Array.isArray(input) ? input : [input];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const tok of part.toLowerCase().split(/[^a-z0-9]+/)) {
      if (tok.length >= 2 && !seen.has(tok)) {
        seen.add(tok);
        out.push(tok);
      }
    }
  }
  return out;
}

/** 키워드를 관련도 비교용 토큰(길이 3+)으로 쪼갠다. */
function keywordTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/** 이 자산이 blank/목업/광고 cliché로 보이는가(태그 기준). */
export function isBlankish(tags: string[] | undefined): boolean {
  if (!tags || tags.length === 0) return false;
  return BLANK_RE.test(tags.join(" "));
}

export interface ScoredAsset {
  asset: MediaResult;
  /** true면 blank/목업 신호가 있어 clean 자산이 부족할 때만 쓴다. */
  penalized: boolean;
  /** 키워드 토큰과 태그가 겹친 개수(클수록 관련도 높음). */
  relevance: number;
}

/**
 * 한 키워드의 hits를 재랭킹한다(자산을 버리지 않고 순서만):
 *   clean(비-blank) 먼저, 그 안에서 관련도 높은 순, 동률이면 원래 순서(안정 정렬).
 *   penalized(blank)는 뒤로 — clean으로 want를 못 채울 때만 도달.
 * 태그가 없는 provider(예: Pexels video)는 전부 penalized=false·relevance=0 →
 * 원래 순서가 보존돼 회귀가 없다.
 */
export function rankHits(hits: readonly MediaResult[], keyword: string): ScoredAsset[] {
  const kwTokens = keywordTokens(keyword);
  const scored = hits.map((asset, i) => {
    const tagText = (asset.tags ?? []).join(" ");
    const blank = BLANK_RE.test(tagText);
    const device = DEVICE_RE.test(tagText);
    const relevance = kwTokens.reduce((n, t) => (tagText.includes(t) ? n + 1 : n), 0);
    return {
      scored: { asset, penalized: blank, relevance } satisfies ScoredAsset,
      // 흰 화면 기기는 가장 뒤로(blank+device), 그다음 일반 blank.
      sortPenalty: blank ? (device ? 2 : 1) : 0,
      i,
    };
  });

  scored.sort((a, b) => {
    if (a.sortPenalty !== b.sortPenalty) return a.sortPenalty - b.sortPenalty;
    if (b.scored.relevance !== a.scored.relevance) return b.scored.relevance - a.scored.relevance;
    return a.i - b.i; // stable
  });

  return scored.map((s) => s.scored);
}

/** 키워드가 일러스트/카툰 결을 의도하는가 → Pixabay illustration 채널 라우팅. */
export function isIllustrationIntent(keyword: string): boolean {
  const k = keyword.toLowerCase();
  return ILLUSTRATION_HINTS.some((h) => k.includes(h));
}
