import { normalizeTags } from "./rank.js";
import { pickWithinWidthCap } from "./select.js";
import { fetchJson, makeKeyReader, RESULTS_PER_PAGE } from "./provider-util.js";
import type { MediaResult, StockProvider } from "./types.js";

const PHOTO_ENDPOINT = "https://api.pexels.com/v1/search";
const VIDEO_ENDPOINT = "https://api.pexels.com/videos/search";
const LICENSE_NOTE = "Pexels License — free for commercial use, attribution appreciated.";

interface PexelsPhoto {
  id: number;
  photographer: string;
  photographer_url: string;
  url: string;
  alt?: string;
  width: number;
  height: number;
  src: {
    original: string;
    large2x?: string;
    large?: string;
    medium?: string;
    small?: string;
    tiny?: string;
  };
}

interface PexelsPhotoResponse {
  photos?: PexelsPhoto[];
}

interface PexelsVideoFile {
  id?: number;
  file_type?: string;
  width?: number;
  height?: number;
  link?: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image?: string;
  user: { name: string; url: string };
  video_files?: PexelsVideoFile[];
}

interface PexelsVideoResponse {
  videos?: PexelsVideo[];
}

// Pexels는 API 키를 Authorization 헤더로 보낸다(Pixabay는 쿼리 파라미터 — provider별 차이).
function call<T>(endpoint: string, params: URLSearchParams, apiKey: string): Promise<T | null> {
  return fetchJson<T>(
    `${endpoint}?${params.toString()}`,
    { headers: { Authorization: apiKey } },
    "pexels",
    endpoint,
  );
}

const readApiKey = makeKeyReader("PEXELS_API_KEY", "pexels");

function pickPhotoUrl(src: PexelsPhoto["src"]): string {
  return src.large2x ?? src.large ?? src.original;
}

// mp4 파일 중 1920w 캡 이내 최대 화질을 고른다(전부 초과면 최소 — 4K 대신 작은 걸).
// 예전엔 "가장 큰 mp4"를 골라 4K를 끌어와 디코드 비용·delayRender 타임아웃을 유발했다.
function pickVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  const mp4s = files.filter((f) => f.file_type === "video/mp4" && f.link);
  return pickWithinWidthCap(mp4s);
}

export const pexels: StockProvider = {
  name: "pexels",

  async searchPhotos(query) {
    const apiKey = readApiKey();
    if (!apiKey) return [];
    const params = new URLSearchParams({
      query,
      per_page: String(RESULTS_PER_PAGE),
      orientation: "landscape",
    });
    const data = await call<PexelsPhotoResponse>(PHOTO_ENDPOINT, params, apiKey);
    if (!data?.photos) return [];

    return data.photos.map<MediaResult>((p) => ({
      provider: "pexels",
      id: String(p.id),
      url: p.url,
      download_url: pickPhotoUrl(p.src),
      thumb_url: p.src.medium ?? p.src.small ?? p.src.tiny ?? pickPhotoUrl(p.src),
      width: p.width,
      height: p.height,
      photographer: p.photographer,
      photographer_url: p.photographer_url,
      license_note: LICENSE_NOTE,
      tags: normalizeTags(p.alt),
    }));
  },

  async searchVideos(query) {
    const apiKey = readApiKey();
    if (!apiKey) return [];
    const params = new URLSearchParams({
      query,
      per_page: String(RESULTS_PER_PAGE),
      orientation: "landscape",
      size: "medium",
    });
    const data = await call<PexelsVideoResponse>(VIDEO_ENDPOINT, params, apiKey);
    if (!data?.videos) return [];

    const results: MediaResult[] = [];
    for (const v of data.videos) {
      const file = pickVideoFile(v.video_files ?? []);
      if (!file?.link) continue;
      results.push({
        provider: "pexels",
        id: String(v.id),
        url: v.url,
        download_url: file.link,
        thumb_url: v.image ?? file.link,
        width: file.width ?? v.width,
        height: file.height ?? v.height,
        duration_sec: v.duration,
        photographer: v.user.name,
        photographer_url: v.user.url,
        license_note: LICENSE_NOTE,
      });
    }
    return results;
  },
};
