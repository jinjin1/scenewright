import { normalizeTags } from "./rank.js";
import { fetchJson, makeKeyReader, RESULTS_PER_PAGE } from "./provider-util.js";
import type { MediaResult, StockProvider } from "./types.js";

const SEARCH_ENDPOINT = "https://api.unsplash.com/search/photos";
const LICENSE_NOTE =
  "Unsplash License — free to use, attribution required (photographer + Unsplash).";

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  alt_description?: string | null;
  description?: string | null;
  tags?: { title?: string }[];
  urls: { full?: string; regular?: string; small?: string; thumb?: string };
  links: { html: string; download_location?: string };
  user: { name: string; links: { html: string } };
}

interface UnsplashSearchResponse {
  results?: UnsplashPhoto[];
}

const readAccessKey = makeKeyReader("UNSPLASH_ACCESS_KEY", "unsplash");

export const unsplash: StockProvider = {
  name: "unsplash",

  async searchPhotos(query) {
    const accessKey = readAccessKey();
    if (!accessKey) return [];
    const params = new URLSearchParams({
      query,
      per_page: String(RESULTS_PER_PAGE),
      orientation: "landscape",
      content_filter: "high",
    });

    const data = await fetchJson<UnsplashSearchResponse>(
      `${SEARCH_ENDPOINT}?${params.toString()}`,
      { headers: { Authorization: `Client-ID ${accessKey}` } },
      "unsplash",
      "search",
    );
    if (!data?.results) return [];

    return data.results.map<MediaResult>((p) => {
      const download = p.urls.regular ?? p.urls.full ?? p.urls.small ?? "";
      const tagTitles = (p.tags ?? []).map((t) => t.title ?? "");
      return {
        provider: "unsplash",
        id: p.id,
        url: p.links.html,
        download_url: download,
        thumb_url: p.urls.thumb ?? p.urls.small ?? download,
        width: p.width,
        height: p.height,
        photographer: p.user.name,
        photographer_url: p.user.links.html,
        license_note: LICENSE_NOTE,
        tags: normalizeTags([p.alt_description ?? "", ...tagTitles]),
      };
    });
  },

  // Unsplash does not provide a video API; intentionally undefined so cascade skips it.
};
