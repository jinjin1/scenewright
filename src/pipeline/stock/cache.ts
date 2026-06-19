import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { copyFile, mkdir, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertValidSlug } from "../slug.js";
import { MAX_STOCK_WIDTH } from "./select.js";
import type { MediaResult } from "./types.js";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function cacheDir(slug: string): string {
  assertValidSlug(slug);
  return path.resolve("episodes", slug, "assets", "stock");
}

/**
 * Cross-episode content-addressed pool. Every stock asset is stored here exactly
 * once (named by {@link cacheKey}), and episodes get a copy. This is the canonical
 * store that makes assets reusable across episodes without re-hitting stock APIs.
 * Binaries are gitignored; the metadata index (assets/stock/index.json) is not.
 */
export function poolDir(): string {
  return path.resolve("assets", "stock", "pool");
}

// max-res를 키에 포함 — 캡 변경 / 기존 미캡 캐시가 있을 때 재실행이 캡된 variant를
// 새로 받게 한다(provider:id만 쓰면 같은 자산의 다른 화질이 같은 키로 묶여 캐시가
// 안 깨지는 variant 버그). 폭이 바뀌면 파일명 prefix가 바뀌어 기존 파일은 자연 무효화.
export function cacheKey(media: Pick<MediaResult, "provider" | "id">): string {
  return createHash("sha256")
    .update(`${media.provider}:${media.id}:w${MAX_STOCK_WIDTH}`)
    .digest("hex")
    .slice(0, 12);
}

function inferExtFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.([a-z0-9]{2,4})(?:$|\?)/i);
    return m ? m[1]!.toLowerCase() : null;
  } catch {
    return null;
  }
}

function pickExtension(downloadUrl: string, contentType: string | null): string {
  if (contentType) {
    const ct = contentType.split(";")[0]!.trim().toLowerCase();
    if (EXT_BY_MIME[ct]) return EXT_BY_MIME[ct]!;
  }
  const fromUrl = inferExtFromUrl(downloadUrl);
  if (fromUrl) return fromUrl;
  return "bin";
}

async function findExisting(dir: string, prefix: string): Promise<string | null> {
  try {
    const files = await readdir(dir);
    const hit = files.find((f) => f.startsWith(`${prefix}.`));
    return hit ? path.join(dir, hit) : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export interface DownloadResult {
  /** Absolute path of the episode-local cached file (what Remotion/reconcile read). */
  path: string;
  /** Episode-local path relative to project root (suitable for manifest.json). */
  relPath: string;
  /** True when no network fetch happened (pool hit, or seeded from an existing episode file). */
  hit: boolean;
  /** Pool path relative to project root — set by {@link download}; absent for library copies. */
  poolRelPath?: string;
}

/** Atomically copy `src` → `dest` via a tmp file. */
async function copyAtomic(src: string, dest: string): Promise<void> {
  const tmp = `${dest}.tmp`;
  try {
    await copyFile(src, tmp);
    await rename(tmp, dest);
  } catch (err) {
    if (existsSync(tmp)) await unlink(tmp).catch(() => undefined);
    throw err;
  }
}

/**
 * Download a stock asset, idempotently, into the cross-episode pool, then copy
 * it into the episode's cache. The SHA256-based filename ({@link cacheKey}) is
 * stable across episodes, so once any episode has fetched an asset the pool
 * holds it and every later episode is a no-network copy (hit=true) — this is the
 * quota-saving core. Returns the episode-local path plus the pool path so the
 * caller can register the asset in the global index.
 */
export async function download(media: MediaResult, slug: string): Promise<DownloadResult> {
  const pool = poolDir();
  await mkdir(pool, { recursive: true });

  const key = cacheKey(media);
  const filenamePrefix = `${media.provider}-${key}`;
  const dir = cacheDir(slug);

  // 1) 풀에 자산이 있나? 없으면:
  //    ① 이 에피소드가 이미 받아둔 파일이 있으면 그걸로 풀을 시드(무네트워크) — 백필 전이나
  //       옛 캐시에서도 풀이 자가 충전되고, 풀 도입 전의 "파일 있으면 재다운로드 안 함"을 보존.
  //    ② 그것도 없으면 단 한 번만 네트워크 fetch.
  let poolFile = await findExisting(pool, filenamePrefix);
  let networkFetched = false;
  if (!poolFile) {
    const episodeExisting = await findExisting(dir, filenamePrefix);
    if (episodeExisting) {
      const { poolRelPath } = await ensureInPool(media, episodeExisting);
      poolFile = path.resolve(poolRelPath);
    } else {
      const res = await fetch(media.download_url);
      if (!res.ok) {
        throw new Error(
          `stock download failed: ${media.provider}/${media.id} (${res.status}) ${media.download_url}`,
        );
      }
      const ext = pickExtension(media.download_url, res.headers.get("content-type"));
      poolFile = path.join(pool, `${filenamePrefix}.${ext}`);
      const tmpPath = `${poolFile}.tmp`;
      const buf = Buffer.from(await res.arrayBuffer());
      try {
        await writeFile(tmpPath, buf);
        await rename(tmpPath, poolFile);
      } catch (err) {
        if (existsSync(tmpPath)) await unlink(tmpPath).catch(() => undefined);
        throw err;
      }
      networkFetched = true;
    }
  }

  // 2) 풀 → 에피소드 캐시로 복사(멱등). Remotion/reconcile은 에피소드-로컬 경로를 그대로 쓴다.
  await mkdir(dir, { recursive: true });
  const ext = path.extname(poolFile).slice(1) || "bin";
  const episodeFile = path.join(dir, `${filenamePrefix}.${ext}`);
  if (!existsSync(episodeFile)) await copyAtomic(poolFile, episodeFile);

  return {
    path: episodeFile,
    relPath: path.relative(process.cwd(), episodeFile),
    hit: !networkFetched, // 네트워크를 안 탔으면(풀 히트 또는 에피소드 시드) hit=true.
    poolRelPath: path.relative(process.cwd(), poolFile),
  };
}

/**
 * Ensure the pool holds a copy of a locally-present asset (e.g. an existing
 * episode download during backfill). Named by {@link cacheKey} so it dedupes
 * with {@link download}. Returns the pool path relative to the project root.
 */
export async function ensureInPool(
  media: Pick<MediaResult, "provider" | "id">,
  srcAbs: string,
): Promise<{ poolRelPath: string; hit: boolean }> {
  const pool = poolDir();
  await mkdir(pool, { recursive: true });
  const prefix = `${media.provider}-${cacheKey(media)}`;
  const existing = await findExisting(pool, prefix);
  if (existing) {
    return { poolRelPath: path.relative(process.cwd(), existing), hit: true };
  }
  const ext = path.extname(srcAbs).slice(1).toLowerCase() || "bin";
  const dest = path.join(pool, `${prefix}.${ext}`);
  await copyAtomic(srcAbs, dest);
  return { poolRelPath: path.relative(process.cwd(), dest), hit: false };
}

/**
 * Operator-curated, cross-episode image library. Real product UI screenshots,
 * diagrams, people photos — assets stock providers can't supply. Not gitignored:
 * operator-owned and meant to be versioned/shared across episodes.
 */
export function libraryDir(): string {
  return path.resolve("assets", "images", "library");
}

/**
 * Resolve a library-relative ref to an absolute path, or null if it does not
 * exist or escapes the library directory. The schema already rejects "..", but
 * we re-check that the resolved *real* path stays inside the library root as
 * defense in depth (symlinks, unexpected inputs).
 */
export function resolveLibraryRef(ref: string): string | null {
  const root = libraryDir();
  const resolved = path.resolve(root, ref);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  if (!existsSync(resolved)) return null;
  try {
    const realRoot = realpathSync(root);
    const realTarget = realpathSync(resolved);
    if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
      return null;
    }
    return realTarget;
  } catch {
    return null;
  }
}

/**
 * Copy a local library asset into the episode's stock cache, idempotently.
 * Named by a SHA of the stable ref (not the absolute path) so the same asset
 * reused across shots/episodes resolves to one cached file. Mirrors
 * {@link download} so the manifest/render path treats library and stock assets
 * identically.
 */
export async function copyIntoCache(
  absSrc: string,
  slug: string,
  key: string,
): Promise<DownloadResult> {
  const dir = cacheDir(slug);
  await mkdir(dir, { recursive: true });

  const hash = createHash("sha256").update(`library:${key}`).digest("hex").slice(0, 12);
  const filenamePrefix = `library-${hash}`;

  const existing = await findExisting(dir, filenamePrefix);
  if (existing) {
    return { path: existing, relPath: path.relative(process.cwd(), existing), hit: true };
  }

  const ext = path.extname(absSrc).slice(1).toLowerCase() || "bin";
  const finalPath = path.join(dir, `${filenamePrefix}.${ext}`);
  const tmpPath = `${finalPath}.tmp`;
  try {
    await copyFile(absSrc, tmpPath);
    await rename(tmpPath, finalPath);
  } catch (err) {
    if (existsSync(tmpPath)) await unlink(tmpPath).catch(() => undefined);
    throw err;
  }

  return { path: finalPath, relPath: path.relative(process.cwd(), finalPath), hit: false };
}
