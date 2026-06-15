// 크로스-에피소드 스톡 자산 라이브러리 — 글로벌 인덱스(read/write) + 재활용 검색.
//
// 왜: 스톡 자산은 에피소드-로컬 저장이라 에피소드 A가 받은 자산을 B가 못 보고 API를
//   다시 친다(Unsplash 50/hr 쿼터 소진). 이 인덱스는 콘텐츠 주소 풀(cache.ts:poolDir)에
//   쌓인 모든 자산의 메타데이터를 모아, collectAssets가 API를 치기 *전에* 재활용 후보를
//   가로채게 한다. 자산 정체성은 cacheKey(provider:id) 덕에 이미 cross-episode로 통일돼 있다.
//
// 다양성 가드(운영자 우려): 재활용이 영상을 똑같게 만들지 않도록 — 과사용 자산 제외,
//   덜/오래 안 쓴 것 우선, 관련도 최소치 요구. 에피소드당 재활용 *비율* 캡은 호출부
//   (cli/stock.ts)가 관리한다. searchIndex 자체는 부수효과 없는 순수 함수(테스트 용이).

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  LibraryIndexSchema,
  type LibraryEntry,
  type LibraryIndex,
} from "../../schemas/library.js";
import { isBlankish, normalizeTags } from "./rank.js";
import type { MediaResult, MediaType } from "./types.js";

// ── 다양성 가드 상수 (추후 튜닝) ───────────────────────────────────────────────
/** 이 횟수 이상 쓰인 자산은 자동 재활용에서 제외(과노출 방지). 카탈로그엔 남아 운영자 수동 선택은 가능. */
export const REUSE_OVERUSE_CAP = 3;
/** 재활용하려면 키워드 토큰이 최소 이만큼 겹쳐야 한다(무관한 자산 재활용 금지). */
export const REUSE_MIN_RELEVANCE = 1;
/** 에피소드의 fresh-fetch 미디어 shot 중 재활용으로 채울 수 있는 최대 비율(나머지는 새 소재). */
export const REUSE_FRACTION_CAP = 0.4;

export function indexPath(): string {
  return path.resolve("assets", "stock", "index.json");
}

/** LLM-위키 카탈로그(브라우즈·검수용 HTML). 생성물 — gitignore. */
export function catalogHtmlPath(): string {
  return path.resolve("assets", "stock", "library.html");
}

/** CC가 /storyboard·/stock에서 읽는 텍스트 카탈로그. 커밋 대상(공유 가치). */
export function catalogMarkdownPath(): string {
  return path.resolve("assets", "stock", "library.md");
}

export function emptyIndex(): LibraryIndex {
  return { version: 1, generated_at: new Date().toISOString(), entries: [] };
}

/** 인덱스를 로드한다. 없거나 손상되면 빈 인덱스(재생성 가능). */
export async function loadIndex(): Promise<LibraryIndex> {
  const p = indexPath();
  if (!existsSync(p)) return emptyIndex();
  try {
    return LibraryIndexSchema.parse(JSON.parse(await readFile(p, "utf-8")));
  } catch (err) {
    console.warn(`library: index.json 파싱 실패 — 빈 인덱스로 시작 (${(err as Error).message})`);
    return emptyIndex();
  }
}

/** 인덱스를 atomic하게 쓴다. entries는 key 정렬 → 깔끔한 diff(커밋 대상). */
export async function saveIndex(index: LibraryIndex): Promise<void> {
  const p = indexPath();
  await mkdir(path.dirname(p), { recursive: true });
  const sorted: LibraryIndex = {
    ...index,
    entries: [...index.entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
  const tmp = `${p}.tmp`;
  await writeFile(tmp, JSON.stringify(sorted, null, 2) + "\n");
  await rename(tmp, p);
}

/** ISO 문자열은 사전식 비교 = 시간순. min/max 헬퍼. */
const minIso = (a: string, b: string): string => (a < b ? a : b);
const maxIso = (a: string, b: string): string => (a > b ? a : b);

/**
 * 자산 하나를 인덱스에 upsert한다(멱등). 이미 있으면 matched_keywords·used_by를 누적하고
 * first_seen은 가장 이른 값, last_used는 가장 늦은 값으로 수렴시킨다(백필이 임의 순서로
 * 같은 자산을 여러 번 호출해도 안정적). index.entries를 제자리 변형한다.
 */
export function registerAsset(
  index: LibraryIndex,
  media: MediaResult,
  mediaType: MediaType,
  poolRelPath: string,
  usage: { slug: string; shot_id: string },
  keyword: string | null,
  now: string = new Date().toISOString(),
): LibraryEntry {
  const key = `${media.provider}:${media.id}`;
  const tags = normalizeTags(media.tags);
  const existing = index.entries.find((e) => e.key === key);

  if (!existing) {
    const entry: LibraryEntry = {
      key,
      provider: media.provider,
      media_type: mediaType,
      pool_path: poolRelPath,
      width: media.width,
      height: media.height,
      ...(media.duration_sec != null ? { duration_sec: media.duration_sec } : {}),
      attribution: media,
      tags,
      matched_keywords: keyword ? [keyword] : [],
      used_by: [{ ...usage, used_at: now }],
      first_seen: now,
      last_used: now,
    };
    index.entries.push(entry);
    return entry;
  }

  existing.pool_path = poolRelPath;
  existing.attribution = media;
  if (tags.length) existing.tags = Array.from(new Set([...existing.tags, ...tags]));
  if (keyword && !existing.matched_keywords.includes(keyword)) {
    existing.matched_keywords.push(keyword);
  }
  if (!existing.used_by.some((u) => u.slug === usage.slug && u.shot_id === usage.shot_id)) {
    existing.used_by.push({ ...usage, used_at: now });
  }
  existing.first_seen = minIso(existing.first_seen, now);
  existing.last_used = maxIso(existing.last_used, now);
  return existing;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

export interface ReuseOpts {
  overuseCap?: number;
  minRelevance?: number;
}

/**
 * 인덱스에서 이 키워드 묶음에 맞는 재활용 자산을 want개까지 고른다(순수 함수).
 * 제외: 타입 불일치 · 이미 이 에피소드에서 쓴 것(episodeUsed) · 과사용(used_by ≥ cap) ·
 *   풀 파일 소실 · blank/목업 태그 · 관련도 미달.
 * 정렬: 관련도 높은 순 → 덜 쓴 순 → 오래 안 쓴 순 → key(안정). 다양성을 위해
 *   "인기 자산 쏠림"이 아니라 "신선하고 적게 노출된" 자산을 먼저 돌려준다.
 */
export function searchIndex(
  index: LibraryIndex,
  keywords: string[],
  mediaType: MediaType,
  want: number,
  episodeUsed: Set<string>,
  opts: ReuseOpts = {},
): MediaResult[] {
  if (want <= 0) return [];
  const overuseCap = opts.overuseCap ?? REUSE_OVERUSE_CAP;
  const minRel = opts.minRelevance ?? REUSE_MIN_RELEVANCE;
  const kwTokens = new Set(keywords.flatMap(tokenize));
  if (kwTokens.size === 0) return [];

  const scored: { entry: LibraryEntry; relevance: number }[] = [];
  for (const entry of index.entries) {
    if (entry.media_type !== mediaType) continue;
    if (episodeUsed.has(entry.key)) continue;
    if (entry.used_by.length >= overuseCap) continue;
    if (!existsSync(path.resolve(entry.pool_path))) continue;
    if (isBlankish(entry.tags)) continue;
    const text = [...entry.tags, ...entry.matched_keywords].join(" ").toLowerCase();
    let relevance = 0;
    for (const t of kwTokens) if (text.includes(t)) relevance += 1;
    if (relevance < minRel) continue;
    scored.push({ entry, relevance });
  }

  scored.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    if (a.entry.used_by.length !== b.entry.used_by.length) {
      return a.entry.used_by.length - b.entry.used_by.length;
    }
    if (a.entry.last_used !== b.entry.last_used) {
      return a.entry.last_used < b.entry.last_used ? -1 : 1;
    }
    return a.entry.key < b.entry.key ? -1 : 1;
  });

  return scored.slice(0, want).map((s) => s.entry.attribution as MediaResult);
}
