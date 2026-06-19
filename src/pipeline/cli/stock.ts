/**
 * CLI: episodes/<slug>/storyboard.json → cached stock media + manifest.json
 *
 * 사용: npm run stock -- <slug>
 *
 * StockBg shot마다 duration에 비례한 N개의 *서로 다른* 자산을 3-provider
 * 카스케이드로 수집해 다운로드한다 (긴 내레이션 구간에 B-roll을 컷으로 깔기 위함).
 * 키워드는 입력 순서대로 시도하되, 매치가 부족하면 단어 단위로 broaden한다.
 * 한 에피소드 안에서 같은 자산이 반복되지 않도록 episode-level dedup을 적용하고,
 * 그래도 0건이면 manifest entry의 provider=null로 기록 → Remotion이 LineCard로 폴백.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { StoryboardSchema, type StoryboardShot } from "../../schemas/storyboard.js";
import { assertValidSlug } from "../slug.js";
import { formatAttribution } from "../stock/attribution.js";
import { cacheDir, copyIntoCache, download, resolveLibraryRef } from "../stock/cache.js";
import { renderLibraryHtml, renderLibraryMarkdown } from "../stock/catalog.js";
import { collectAssets, type ReuseFn } from "../stock/collect.js";
import { renderContactSheet } from "../stock/contact-sheet.js";
import {
  REUSE_FRACTION_CAP,
  catalogHtmlPath,
  catalogMarkdownPath,
  loadIndex,
  registerAsset,
  saveIndex,
  searchIndex,
} from "../stock/library.js";
import type { MediaResult, MediaType, Provider } from "../stock/types.js";

const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "m4v"]);

// 라이브러리 자산의 media_type은 파일 확장자로 정한다(운영자가 핀한 파일 그대로).
function libraryMediaType(p: string): "photo" | "video" {
  return VIDEO_EXTS.has(path.extname(p).slice(1).toLowerCase()) ? "video" : "photo";
}

// 자산 한 개당 화면에 머무는 목표 길이(초). shot duration ÷ 이 값 ≈ 자산 수.
const SECONDS_PER_CLIP = 5;
// shot 하나가 끌어올 수 있는 자산 상한. 너무 잘게 컷하면 산만해진다.
const MAX_CLIPS_PER_SHOT = 4;

interface ManifestEntry {
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

interface Manifest {
  generated_at: string;
  entries: ManifestEntry[];
  attribution_block: string;
}

// shot duration → 끌어올 자산 수.
function clipCountFor(durationSec: number): number {
  return Math.max(1, Math.min(MAX_CLIPS_PER_SHOT, Math.round(durationSec / SECONDS_PER_CLIP)));
}

// 이 shot이 미디어 자산을 필요로 하는가, 필요하면 어떤 타입을 몇 개?
// - StockBg(photo/video): 내레이션 길이에 비례한 멀티컷 b-roll.
// - HeroImage/SplitVisual: 본문 이미지 1장 (image-first 씬).
// - ScreenshotCallout: 실제 UI 스샷 1장 (보통 라이브러리에서; stock은 약한 폴백).
// - 그 외(텍스트 씬, StockBg color): 자산 불필요 → null.
function mediaNeedFor(
  shot: StoryboardShot,
): { mediaType: MediaType; want: number } | null {
  if (shot.component === "StockBg") {
    if (shot.props.kind === "color") return null;
    return { mediaType: shot.props.kind, want: clipCountFor(shot.duration_sec) };
  }
  if (shot.component === "HeroImage" || shot.component === "SplitVisual") {
    return { mediaType: shot.props.kind, want: 1 };
  }
  if (shot.component === "ScreenshotCallout") {
    return { mediaType: "photo", want: 1 };
  }
  return null;
}

// 키워드 확장 + early-exit 수집은 ../stock/collect.ts로 분리(쿼터 폭증 방지 + 테스트 가능).

// 이전 manifest 엔트리를 이번 run의 shot에 재사용할 수 있나?
// 입력(broll_keywords·image_ref)이 동일하고, 미디어가 필요한 경우 이전에 성공(provider≠null)했고
// 캐시 파일이 디스크에 남아 있어야 한다. 옛 manifest엔 input_* 필드가 없어 자동으로 미스→재검색.
function arrayEq(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function filesExist(paths: string[]): boolean {
  return paths.length > 0 && paths.every((p) => existsSync(path.resolve(p)));
}

function canReuse(
  old: ManifestEntry,
  shot: StoryboardShot,
  need: ReturnType<typeof mediaNeedFor>,
): boolean {
  if (!arrayEq(old.input_keywords, shot.broll_keywords)) return false;
  if ((old.input_image_ref ?? null) !== (shot.image_ref ?? null)) return false;
  if (!need) return old.media_type === "color" && old.provider === null;
  if (old.provider === null) return false; // 이전에 0건 → 재시도
  if (old.local_paths.length < need.want) return false; // want 늘어남 → 재검색
  if (!filesExist(old.local_paths)) return false; // 캐시 파일 사라짐
  // library는 확장자로 media_type을 정하므로 photo/video 비교 생략.
  if (old.provider !== "library" && old.media_type !== need.mediaType) return false;
  return true;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force"); // 증분 캐시 무시하고 전부 재검색
  const slug = argv.find((a) => !a.startsWith("-"));
  if (!slug) {
    console.error("usage: stock <episode-slug> [--force]");
    process.exit(2);
  }
  assertValidSlug(slug);

  const episodeDir = path.resolve("episodes", slug);
  const storyboardPath = path.join(episodeDir, "storyboard.json");
  const raw = JSON.parse(readFileSync(storyboardPath, "utf-8"));
  const storyboard = StoryboardSchema.parse(raw);

  await mkdir(cacheDir(slug), { recursive: true });
  const manifestPath = path.join(cacheDir(slug), "manifest.json");

  // 증분 fetch: 이전 manifest에서 입력(broll_keywords·image_ref)이 안 바뀐 shot은
  // 재검색/재다운로드 없이 재사용한다. audio_ref(=line.id 기반)로 shot 정체성을 매칭.
  // --force면 무시하고 전부 재검색.
  const oldByAudio = new Map<string, ManifestEntry>();
  if (!force && existsSync(manifestPath)) {
    try {
      const oldManifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
      for (const e of oldManifest.entries) oldByAudio.set(e.audio_ref, e);
    } catch {
      // 손상된 manifest는 무시하고 전부 재검색.
    }
  }

  const entries: ManifestEntry[] = [];
  const usedForAttribution: MediaResult[] = [];
  // 에피소드 전체에서 이미 선택된 (provider:id) — shot 간 자산 반복을 줄인다.
  const episodeUsed = new Set<string>();

  // 재사용 pre-pass: 재사용할 shot을 먼저 정하고 그 자산 id를 episodeUsed에 미리 심어,
  // 새로 fetch하는 shot이 재사용 shot과 같은 자산을 고르지 않게 한다.
  const reuseByIndex = new Map<number, ManifestEntry>();
  storyboard.shots.forEach((shot, i) => {
    const old = oldByAudio.get(shot.audio_ref);
    if (old && canReuse(old, shot, mediaNeedFor(shot))) {
      reuseByIndex.set(i, old);
      for (const a of old.attributions) episodeUsed.add(`${a.provider}:${a.id}`);
    }
  });

  let reusedCount = 0;
  let fetchedCount = 0;
  let totalSearches = 0;

  // 글로벌 라이브러리 재활용: API를 치기 전에 이전 에피소드들이 받아둔 자산을 가로챈다.
  // 다양성을 위해 이번 run에서 *새로 fetch할* 미디어 shot 중 비율 캡만큼만 재활용으로 채운다
  // (나머지는 새 소재 확보). reuseByIndex(증분 재사용)·library image_ref 히트는 애초에
  // collectAssets를 안 거치므로 분모에서 뺀다.
  const index = await loadIndex();
  const freshMediaShots = storyboard.shots.filter((shot, i) => {
    if (reuseByIndex.has(i)) return false;
    if (!mediaNeedFor(shot)) return false;
    if (shot.image_ref && resolveLibraryRef(shot.image_ref)) return false;
    return true;
  }).length;
  const reuseCap = Math.floor(freshMediaShots * REUSE_FRACTION_CAP);
  let libraryReuseUsed = 0;
  const reuseFn: ReuseFn = (kw, mt, want, used) => {
    if (libraryReuseUsed >= reuseCap) return [];
    const picks = searchIndex(index, kw, mt, Math.min(want, reuseCap - libraryReuseUsed), used);
    libraryReuseUsed += picks.length;
    return picks;
  };

  for (const [i, shot] of storyboard.shots.entries()) {
    const shotId = `shot-${String(i).padStart(3, "0")}`;
    const base: Pick<ManifestEntry, "shot_index" | "shot_id" | "scene_id" | "audio_ref"> = {
      shot_index: i,
      shot_id: shotId,
      scene_id: shot.scene_id,
      audio_ref: shot.audio_ref,
    };
    const inputKeywords = shot.broll_keywords;
    const inputImageRef = shot.image_ref ?? null;

    // 증분 재사용: 입력 안 바뀐 shot은 이전 엔트리를 그대로(위치만 갱신) 쓴다.
    const reuse = reuseByIndex.get(i);
    if (reuse) {
      entries.push({
        ...reuse,
        ...base,
        input_keywords: inputKeywords,
        input_image_ref: inputImageRef,
      });
      usedForAttribution.push(...reuse.attributions);
      reusedCount += 1;
      console.log(
        `  ${shotId} reused ${reuse.media_type} ×${reuse.local_paths.length} ` +
          `(${reuse.provider ?? "color"}) — 입력 동일, 재검색 생략`,
      );
      continue;
    }

    const colorEntry = (mediaType: ManifestEntry["media_type"], keyword: string | null): ManifestEntry => ({
      ...base,
      media_type: mediaType,
      keyword,
      keywords: [],
      provider: null,
      local_path: null,
      local_paths: [],
      attribution: null,
      attributions: [],
      input_keywords: inputKeywords,
      input_image_ref: inputImageRef,
    });

    const need = mediaNeedFor(shot);
    if (!need) {
      entries.push(colorEntry("color", null));
      continue;
    }

    // 큐레이션 라이브러리 우선: image_ref가 가리키는 자산이 있으면 stock보다 먼저 쓴다.
    // miss면 경고 후 stock 캐스케이드로 폴백한다 (두 갈래 체인).
    if (shot.image_ref) {
      const abs = resolveLibraryRef(shot.image_ref);
      if (abs) {
        const dl = await copyIntoCache(abs, slug, shot.image_ref);
        const mt = libraryMediaType(abs);
        console.log(
          `  ${shotId} library ${mt} [${shot.image_ref}] → ${dl.relPath}${dl.hit ? " (cached)" : ""}`,
        );
        entries.push({
          ...base,
          media_type: mt,
          keyword: shot.image_ref,
          keywords: [shot.image_ref],
          provider: "library",
          local_path: dl.relPath,
          local_paths: [dl.relPath],
          attribution: null,
          attributions: [],
          input_keywords: inputKeywords,
          input_image_ref: inputImageRef,
        });
        continue;
      }
      console.warn(
        `stock: ${shotId} image_ref "${shot.image_ref}" not found in library — falling back to stock.`,
      );
    }

    const { mediaType, want } = need;
    if (shot.broll_keywords.length === 0) {
      console.warn(`stock: ${shotId} (${shot.scene_id}) has no broll_keywords — color fallback.`);
      entries.push(colorEntry(mediaType, null));
      continue;
    }

    const { assets, keywords, searches, reused } = await collectAssets(
      shot.broll_keywords,
      mediaType,
      want,
      episodeUsed,
      { reuse: reuseFn },
    );
    totalSearches += searches;

    if (assets.length === 0) {
      console.warn(
        `stock: ${shotId} no provider matched [${shot.broll_keywords.join(", ")}] (${searches} search) — color fallback.`,
      );
      entries.push(colorEntry(mediaType, shot.broll_keywords[0] ?? null));
      continue;
    }

    const localPaths: string[] = [];
    let cachedCount = 0;
    const primaryKeyword = keywords[0] ?? shot.broll_keywords[0] ?? null;
    for (const asset of assets) {
      const dl = await download(asset, slug);
      localPaths.push(dl.relPath);
      if (dl.hit) cachedCount += 1;
      // 받은(또는 재활용한) 자산을 글로벌 인덱스에 기록 → 미래 에피소드가 재활용 가능.
      if (dl.poolRelPath) {
        registerAsset(index, asset, mediaType, dl.poolRelPath, { slug, shot_id: shotId }, primaryKeyword);
      }
    }
    fetchedCount += 1;
    console.log(
      `  ${shotId} ${mediaType} ×${assets.length} (want ${want}, ${searches} search` +
        (reused > 0 ? `, ${reused} reused` : "") +
        `) [${keywords.join(", ")}] ` +
        `→ ${assets.map((a) => `${a.provider}/${a.id}`).join(", ")} ` +
        `(${cachedCount} cached)`,
    );

    entries.push({
      ...base,
      media_type: mediaType,
      keyword: keywords[0] ?? shot.broll_keywords[0] ?? null,
      keywords,
      provider: assets[0]!.provider,
      local_path: localPaths[0]!,
      local_paths: localPaths,
      attribution: assets[0]!,
      attributions: assets,
      input_keywords: inputKeywords,
      input_image_ref: inputImageRef,
    });
    usedForAttribution.push(...assets);
  }

  const manifest: Manifest = {
    generated_at: new Date().toISOString(),
    entries,
    attribution_block: formatAttribution(usedForAttribution),
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `manifest → ${path.relative(process.cwd(), manifestPath)}  ` +
      `(${fetchedCount} fetched · ${reusedCount} reused · ${totalSearches} stock searches)`,
  );

  // 렌더 전 검수 게이트: shot별 썸네일 컨택트시트. 빈 화면·식상·자산 누락을
  // 30분 렌더 전에 육안으로 거르기 위함(stock 재수집은 ~1분).
  const sheetPath = path.join(cacheDir(slug), "contact-sheet.html");
  writeFileSync(sheetPath, renderContactSheet(manifest, slug));
  const missing = entries.filter((e) => e.provider === null && e.media_type !== "color").length;
  console.log(
    `contact sheet → ${path.relative(process.cwd(), sheetPath)}` +
      (missing > 0 ? `  ⚠ ${missing} shot(s) missing media — review before /render` : ""),
  );

  // 글로벌 라이브러리 인덱스·카탈로그 갱신(이번 run에서 받은/재활용한 자산 반영).
  index.generated_at = new Date().toISOString();
  await saveIndex(index);
  writeFileSync(catalogHtmlPath(), renderLibraryHtml(index));
  writeFileSync(catalogMarkdownPath(), renderLibraryMarkdown(index));
  console.log(
    `library → ${index.entries.length} assets indexed` +
      (libraryReuseUsed > 0 ? `  ·  ${libraryReuseUsed} reused from library (saved API calls)` : "") +
      `  (cap ${reuseCap}/${freshMediaShots} fresh shots)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
