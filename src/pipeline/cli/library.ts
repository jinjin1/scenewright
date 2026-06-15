/**
 * CLI: 크로스-에피소드 스톡 자산 라이브러리 관리.
 *
 *   npm run library -- --backfill   기존 episodes/*\/assets/stock/manifest.json을 스캔해
 *                                   글로벌 인덱스를 부트스트랩 + 파일을 풀로 이전(중복 제거).
 *   npm run library -- --catalog    library.html + library.md 재생성.
 *   npm run library -- --stats      인덱스 요약(재사용 TOP·dead·provider 분포). 기본값.
 *
 * stock API 키가 필요 없다(네트워크 호출 없음) — 디스크의 manifest/파일만 다룬다.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureInPool } from "../stock/cache.js";
import { renderLibraryHtml, renderLibraryMarkdown } from "../stock/catalog.js";
import {
  catalogHtmlPath,
  catalogMarkdownPath,
  loadIndex,
  registerAsset,
  saveIndex,
} from "../stock/library.js";
import {
  entryPrimaryKeyword,
  normalizeEntryAssets,
  type ManifestLite,
} from "../stock/manifest.js";
import type { MediaType } from "../stock/types.js";
import type { LibraryIndex } from "../../schemas/library.js";

function listEpisodeManifests(): { slug: string; manifestPath: string }[] {
  const root = path.resolve("episodes");
  if (!existsSync(root)) return [];
  const out: { slug: string; manifestPath: string }[] = [];
  for (const slug of readdirSync(root)) {
    const mp = path.join(root, slug, "assets", "stock", "manifest.json");
    if (existsSync(mp)) out.push({ slug, manifestPath: mp });
  }
  return out;
}

async function backfill(): Promise<void> {
  const index = await loadIndex();
  const manifests = listEpisodeManifests();
  let assetsSeen = 0;
  let pooled = 0;
  let missing = 0;

  for (const { slug, manifestPath } of manifests) {
    let manifest: ManifestLite;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ManifestLite;
    } catch {
      console.warn(`  ⚠ ${slug}: manifest 파싱 실패 — 건너뜀`);
      continue;
    }
    const usedAt = manifest.generated_at || new Date().toISOString();
    let perEpisode = 0;

    for (const entry of manifest.entries) {
      if (entry.media_type === "color") continue;
      // 단수/복수 스키마 통일. library 자산은 attribution이 비어 자연히 건너뛴다
      // (운영자 큐레이션 — 이미 cross-episode 공유).
      for (const { asset, localPath } of normalizeEntryAssets(entry)) {
        if (!localPath) continue;
        assetsSeen++;
        const abs = path.resolve(localPath);
        if (!existsSync(abs)) {
          missing++;
          continue;
        }
        const { poolRelPath: poolRel, hit } = await ensureInPool(asset, abs);
        if (!hit) pooled++;
        registerAsset(
          index,
          asset,
          entry.media_type as MediaType,
          poolRel,
          { slug, shot_id: entry.shot_id },
          entryPrimaryKeyword(entry),
          usedAt,
        );
        perEpisode++;
      }
    }
    console.log(`  ${slug}: ${perEpisode} assets`);
  }

  index.generated_at = new Date().toISOString();
  await saveIndex(index);
  writeCatalog(index);
  console.log(
    `\nbackfill 완료 — ${manifests.length} episodes · ${index.entries.length} unique assets indexed ` +
      `(${assetsSeen} refs seen · ${pooled} copied to pool · ${missing} missing files).`,
  );
  console.log(`pool: ${poolSizeLabel()}`);
}

function poolSizeLabel(): string {
  const pool = path.resolve("assets", "stock", "pool");
  if (!existsSync(pool)) return "0 files";
  let bytes = 0;
  let n = 0;
  for (const f of readdirSync(pool)) {
    if (f.endsWith(".tmp")) continue;
    try {
      bytes += statSync(path.join(pool, f)).size;
      n++;
    } catch {
      /* skip */
    }
  }
  return `${n} files · ${(bytes / 1024 / 1024).toFixed(0)}MB`;
}

function writeCatalog(index: LibraryIndex): void {
  writeFileSync(catalogHtmlPath(), renderLibraryHtml(index));
  writeFileSync(catalogMarkdownPath(), renderLibraryMarkdown(index));
  console.log(
    `catalog → ${path.relative(process.cwd(), catalogHtmlPath())} · ` +
      `${path.relative(process.cwd(), catalogMarkdownPath())}`,
  );
}

async function catalog(): Promise<void> {
  const index = await loadIndex();
  writeCatalog(index);
}

async function stats(): Promise<void> {
  const index = await loadIndex();
  const e = index.entries;
  if (e.length === 0) {
    console.log("라이브러리가 비어 있습니다. `npm run library -- --backfill`로 부트스트랩하세요.");
    return;
  }
  const byProvider = new Map<string, number>();
  const byType = new Map<string, number>();
  for (const x of e) {
    byProvider.set(x.provider, (byProvider.get(x.provider) ?? 0) + 1);
    byType.set(x.media_type, (byType.get(x.media_type) ?? 0) + 1);
  }
  const top = [...e].sort((a, b) => b.used_by.length - a.used_by.length).slice(0, 10);
  const dead = e.filter((x) => x.used_by.length <= 1).length;

  console.log(`스톡 자산 라이브러리 — ${e.length} assets · pool ${poolSizeLabel()}`);
  console.log(`  type: ${[...byType].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`  provider: ${[...byProvider].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`  재사용 1회 이하(재활용 여지): ${dead}`);
  console.log(`  최다 재사용 TOP:`);
  for (const x of top) {
    const slugs = Array.from(new Set(x.used_by.map((u) => u.slug)));
    console.log(`    ${x.used_by.length}×  ${x.key}  (${slugs.join(", ")})`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--backfill")) await backfill();
  else if (argv.includes("--catalog")) await catalog();
  else await stats();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
