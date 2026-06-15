import { pexels } from "./pexels.js";
import { pixabay } from "./pixabay.js";
import { isIllustrationIntent } from "./rank.js";
import type { MediaResult, MediaType, StockProvider } from "./types.js";
import { unsplash } from "./unsplash.js";

const PHOTO_ORDER: StockProvider[] = [unsplash, pexels, pixabay];
const VIDEO_ORDER: StockProvider[] = [pexels, pixabay];
// 일러스트/카툰 결 키워드는 Pixabay만 illustration 채널을 무료·상업 라이선스로
// 준다. 단락(short-circuit) 특성상 Unsplash가 먼저면 사진을 돌려주고 멈춰 일러스트가
// 안 나오므로, intent가 있으면 Pixabay를 1순위로 올린다(빈손이면 사진으로 폴백).
const ILLUSTRATION_PHOTO_ORDER: StockProvider[] = [pixabay, unsplash, pexels];

export interface CascadeOverride {
  photoOrder?: StockProvider[];
  videoOrder?: StockProvider[];
}

/**
 * Cascade across stock providers for a single keyword. Returns *all* hits from
 * the first provider that yields any results, or an empty array if every
 * provider is empty (no key configured, no match, or upstream error).
 *
 * Short-circuits on the first non-empty provider — the remaining providers are
 * never queried, same as {@link searchStock}.
 *
 * Order:
 *   photo → unsplash → pexels → pixabay
 *   photo (illustration-intent keyword) → pixabay → unsplash → pexels
 *   video → pexels → pixabay  (Unsplash has no video API)
 *
 * An explicit {@link CascadeOverride} bypasses illustration routing.
 */
export async function searchStockAll(
  keyword: string,
  mediaType: MediaType,
  override?: CascadeOverride,
): Promise<MediaResult[]> {
  const defaultPhotoOrder =
    isIllustrationIntent(keyword) ? ILLUSTRATION_PHOTO_ORDER : PHOTO_ORDER;
  const order =
    mediaType === "photo"
      ? (override?.photoOrder ?? defaultPhotoOrder)
      : (override?.videoOrder ?? VIDEO_ORDER);

  for (const provider of order) {
    const fn = mediaType === "photo" ? provider.searchPhotos : provider.searchVideos;
    if (!fn) continue;
    const hits = await fn.call(provider, keyword);
    if (hits.length > 0) {
      return hits;
    }
  }
  return [];
}

/**
 * Cascade for a single keyword and return only the first hit (or null).
 * Thin wrapper over {@link searchStockAll} — preserves the single-asset
 * contract used where only one match is needed.
 */
export async function searchStock(
  keyword: string,
  mediaType: MediaType,
  override?: CascadeOverride,
): Promise<MediaResult | null> {
  const hits = await searchStockAll(keyword, mediaType, override);
  return hits[0] ?? null;
}

export { pexels, pixabay, unsplash };
export type { MediaResult, MediaType, Provider, StockProvider } from "./types.js";
