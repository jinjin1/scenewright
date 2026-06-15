import { isIllustrationIntent, normalizeTags } from "./rank.js";
import { pickWithinWidthCap } from "./select.js";
import { fetchJson, makeKeyReader, RESULTS_PER_PAGE } from "./provider-util.js";
import type { MediaResult, StockProvider } from "./types.js";

const PHOTO_ENDPOINT = "https://pixabay.com/api/";
const VIDEO_ENDPOINT = "https://pixabay.com/api/videos/";
const LICENSE_NOTE =
  "Pixabay Content License — free for commercial use, attribution appreciated.";

interface PixabayPhoto {
  id: number;
  pageURL: string;
  largeImageURL: string;
  webformatURL?: string;
  previewURL?: string;
  tags?: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
  user_id: number;
}

interface PixabayPhotoResponse {
  hits?: PixabayPhoto[];
}

interface PixabayVideoVariant {
  url: string;
  width: number;
  height: number;
  size?: number;
}

interface PixabayVideo {
  id: number;
  pageURL: string;
  duration: number;
  user: string;
  user_id: number;
  tags?: string;
  picture_id?: string;
  videos: {
    large?: PixabayVideoVariant;
    medium?: PixabayVideoVariant;
    small?: PixabayVideoVariant;
    tiny?: PixabayVideoVariant;
  };
}

interface PixabayVideoResponse {
  hits?: PixabayVideo[];
}

const userUrl = (uid: number): string => `https://pixabay.com/users/${uid}/`;

const readApiKey = makeKeyReader("PIXABAY_API_KEY", "pixabay");

// Pixabay는 API 키를 쿼리 파라미터(key=)로 보낸다(Pexels는 Authorization 헤더 — provider별 차이).
function call<T>(endpoint: string, params: URLSearchParams): Promise<T | null> {
  return fetchJson<T>(`${endpoint}?${params.toString()}`, {}, "pixabay", endpoint);
}

// 1920w 캡 이내 최대 화질 variant(전부 초과면 최소). pexels 비디오와 동일 규칙.
function pickVideoVariant(v: PixabayVideo): PixabayVideoVariant | null {
  const ordered = [v.videos.large, v.videos.medium, v.videos.small, v.videos.tiny].filter(
    (x): x is PixabayVideoVariant => Boolean(x?.url),
  );
  return pickWithinWidthCap(ordered);
}

export const pixabay: StockProvider = {
  name: "pixabay",

  async searchPhotos(query) {
    const apiKey = readApiKey();
    if (!apiKey) return [];
    // 키워드가 카툰/플랫 결을 의도하면 illustration 채널로(합법적 "심슨 결" 대체).
    // 아니면 사진. Pixabay만 illustration/vector를 무료·상업 라이선스로 준다.
    const imageType = isIllustrationIntent(query) ? "illustration" : "photo";
    const params = new URLSearchParams({
      key: apiKey,
      q: query,
      image_type: imageType,
      orientation: "horizontal",
      per_page: String(RESULTS_PER_PAGE),
      safesearch: "true",
    });
    const data = await call<PixabayPhotoResponse>(PHOTO_ENDPOINT, params);
    if (!data?.hits) return [];

    return data.hits.map<MediaResult>((p) => ({
      provider: "pixabay",
      id: String(p.id),
      url: p.pageURL,
      download_url: p.largeImageURL,
      thumb_url: p.previewURL ?? p.webformatURL ?? p.largeImageURL,
      width: p.imageWidth,
      height: p.imageHeight,
      photographer: p.user,
      photographer_url: userUrl(p.user_id),
      license_note: LICENSE_NOTE,
      tags: normalizeTags(p.tags),
    }));
  },

  async searchVideos(query) {
    const apiKey = readApiKey();
    if (!apiKey) return [];
    const params = new URLSearchParams({
      key: apiKey,
      q: query,
      per_page: String(RESULTS_PER_PAGE),
      safesearch: "true",
    });
    const data = await call<PixabayVideoResponse>(VIDEO_ENDPOINT, params);
    if (!data?.hits) return [];

    const results: MediaResult[] = [];
    for (const v of data.hits) {
      const variant = pickVideoVariant(v);
      if (!variant) continue;
      results.push({
        provider: "pixabay",
        id: String(v.id),
        url: v.pageURL,
        download_url: variant.url,
        thumb_url: variant.url,
        width: variant.width,
        height: variant.height,
        duration_sec: v.duration,
        photographer: v.user,
        photographer_url: userUrl(v.user_id),
        license_note: LICENSE_NOTE,
        tags: normalizeTags(v.tags),
      });
    }
    return results;
  },
};
