// shot 하나에 쓸 stock 자산 수집 — 키워드 확장 + early-exit.
//
// 왜 분리: 예전엔 cli/stock.ts의 collectAssets가 expandKeywords로 키워드를 모든
//   n-gram 하위구절로 폭발시킨 뒤 *전부* 미리 검색했다. searchStockAll은 photo에서
//   Unsplash를 1순위로 호출하고 hit면 멈추므로, 확장 구절 1개 = Unsplash 요청 1건.
//   want=1짜리 image-first 샷도 ~40회를 돌려 단 1회 실행이 Unsplash 50/hr를 184건으로
//   폭파했다(실측 2026-05-29). 여기서 **검색을 lazy하게** 돌리고 want가 fresh+clean으로
//   차면 즉시 멈춘다(+ 샷당 검색 상한). want=1이면 보통 1~3회로 줄어든다.
//   테스트를 위해 검색 함수를 주입 가능하게 한다(기본은 searchStockAll).

import { searchStockAll } from "./index.js";
import { rankHits } from "./rank.js";
import type { MediaResult, MediaType } from "./types.js";

// 샷 하나가 쏠 수 있는 검색 요청 상한(backstop). 키워드 확장이 아무리 커도
// 이 이상은 안 돈다 — early-exit가 안 먹는 최악(전부 0건)에서도 쿼터 폭증 방지.
export const MAX_SEARCHES_PER_SHOT = 8;

// 입력 키워드를 [원본..., 단어 단위 broaden...] 순서로 펼친다 (중복 제거, 순서 유지).
// "team meeting office" → "team meeting office", "team meeting", "meeting office", "team", ...
// 원본이 앞에 오므로 lazy 검색이 원본부터 시도하고, 부족할 때만 하위구절로 넓힌다.
export function expandKeywords(keywords: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (k: string): void => {
    const t = k.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };

  for (const kw of keywords) push(kw);

  for (const kw of keywords) {
    const trimmed = kw.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/).filter((w) => w.length >= 3);
    for (let n = words.length - 1; n >= 1; n--) {
      for (let i = 0; i + n <= words.length; i++) {
        push(words.slice(i, i + n).join(" "));
      }
    }
  }
  return out;
}

export type SearchFn = (keyword: string, mediaType: MediaType) => Promise<MediaResult[]>;

// 글로벌 라이브러리에서 재활용 후보를 고르는 함수(동기). 기본은 미주입 = 재활용 끔
// (기존 동작·테스트 보존). cli/stock.ts가 searchIndex를 비율 캡과 함께 감싸 주입한다.
export type ReuseFn = (
  keywords: string[],
  mediaType: MediaType,
  want: number,
  episodeUsed: Set<string>,
) => MediaResult[];

export interface CollectResult {
  assets: MediaResult[];
  /** 자산을 실제로 매치한 키워드(우선순위 순). */
  keywords: string[];
  /** 실행한 검색(=provider 캐스케이드) 횟수 — 쿼터 관측용. */
  searches: number;
  /** 이 중 글로벌 라이브러리에서 재활용한 자산 수(searches를 태우지 않은 만큼). */
  reused: number;
}

/**
 * shot 하나에 쓸 distinct 자산을 want개까지 수집한다.
 *
 * 검색은 확장 키워드 순서대로 **lazy**하게 돈다. 매 검색 뒤 fresh+clean(에피소드 미사용 &
 * 비-blank) 우선으로 골라보고, want가 차면 **즉시 멈춘다**(원본 키워드가 앞이라 보통 1~3회).
 * 그래도 부족하면 *이미 받은* 결과 안에서만 단계적으로 완화한다(추가 검색 없음):
 *   1) fresh + clean  2) fresh + any(blank 허용)  3) reuse + any
 * → 흰 화면/목업은 깨끗한 대안이 없을 때만, 재사용은 최후에만.
 *
 * 글로벌 재활용(opts.reuse): API 검색 전에 라이브러리에서 want를 먼저 채워본다. 채워진
 * 만큼 stock API를 안 친다(쿼터 절약 핵심). 부족분만 아래 lazy 검색으로 보충한다.
 *
 * @param episodeUsed 에피소드 전체에서 이미 쓴 (provider:id) — shot 간 중복 방지(부수효과로 추가됨).
 * @param opts.search 검색 함수 주입(기본 searchStockAll). opts.maxSearches 샷당 상한.
 * @param opts.reuse 글로벌 라이브러리 재활용 함수(기본 미주입 = 재활용 끔).
 */
export async function collectAssets(
  keywords: string[],
  mediaType: MediaType,
  want: number,
  episodeUsed: Set<string>,
  opts: { search?: SearchFn; maxSearches?: number; reuse?: ReuseFn } = {},
): Promise<CollectResult> {
  const search = opts.search ?? searchStockAll;
  const maxSearches = opts.maxSearches ?? MAX_SEARCHES_PER_SHOT;
  const expanded = expandKeywords(keywords);

  // 0) 글로벌 라이브러리 재활용 먼저. 고른 자산은 episodeUsed에 심어 아래 API 검색이
  //    같은 자산을 다시 고르지 않게 한다. want가 다 차면 API는 0건.
  const reused: MediaResult[] = opts.reuse ? opts.reuse(keywords, mediaType, want, episodeUsed) : [];
  for (const a of reused) episodeUsed.add(`${a.provider}:${a.id}`);
  const need = want - reused.length;

  const perKeyword: { kw: string; ranked: ReturnType<typeof rankHits> }[] = [];
  let chosen: MediaResult[] = [];
  let matchedKeywords = new Set<string>();

  // 누적된 perKeyword에서 accept 조건으로 need까지 고른다(매번 처음부터 재선택 — 멱등).
  const runPick = (accept: (id: string, penalized: boolean) => boolean): void => {
    chosen = [];
    matchedKeywords = new Set();
    const chosenIds = new Set<string>();
    for (const { kw, ranked } of perKeyword) {
      if (chosen.length >= need) break;
      for (const { asset, penalized } of ranked) {
        if (chosen.length >= need) break;
        const id = `${asset.provider}:${asset.id}`;
        if (chosenIds.has(id)) continue;
        if (!accept(id, penalized)) continue;
        chosen.push(asset);
        chosenIds.add(id);
        matchedKeywords.add(kw);
      }
    }
  };

  let searches = 0;
  // 재활용으로 want가 다 찼으면 API를 아예 안 친다.
  if (need > 0) {
    for (const kw of expanded) {
      if (searches >= maxSearches) break;
      const hits = await search(kw, mediaType);
      searches += 1;
      if (hits.length > 0) perKeyword.push({ kw, ranked: rankHits(hits, kw) });
      // 충분한 fresh+clean 자산을 확보하면 더 검색하지 않는다(쿼터 보호 핵심).
      runPick((id, penalized) => !episodeUsed.has(id) && !penalized);
      if (chosen.length >= need) break;
    }

    // 부족하면 *이미 받은* 결과에 한해 완화 (추가 검색 없음).
    if (chosen.length < need) runPick((id) => !episodeUsed.has(id));
    if (chosen.length === 0 && reused.length === 0) runPick(() => true);

    for (const asset of chosen) episodeUsed.add(`${asset.provider}:${asset.id}`);
  }

  // 재활용분(앞) + 새로 fetch한 자산(뒤). 매치 키워드는 재활용이 있으면 입력 키워드를 곁들인다.
  const matched = expanded.filter((k) => matchedKeywords.has(k));
  const keywordsOut = reused.length > 0 ? Array.from(new Set([...keywords, ...matched])) : matched;
  return {
    assets: [...reused, ...chosen],
    keywords: keywordsOut,
    searches,
    reused: reused.length,
  };
}
