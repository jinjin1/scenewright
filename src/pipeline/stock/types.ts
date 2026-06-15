export type MediaType = "photo" | "video";
export type Provider = "pexels" | "unsplash" | "pixabay";

export interface MediaResult {
  provider: Provider;
  id: string;
  // Provider page URL (used for attribution back-link).
  url: string;
  download_url: string;
  thumb_url: string;
  width: number;
  height: number;
  duration_sec?: number;
  photographer: string;
  photographer_url: string;
  license_note: string;
  // Provider-supplied descriptive terms (Pixabay `tags`, Pexels `alt`,
  // Unsplash `alt_description` + tags), normalized to lowercase tokens.
  // Used by rank.ts to down-rank blank/mockup clichés and up-rank relevance.
  // Optional: some endpoints (e.g. Pexels video) return none → undefined.
  tags?: string[];
}

export interface StockProvider {
  name: Provider;
  searchPhotos?(query: string): Promise<MediaResult[]>;
  searchVideos?(query: string): Promise<MediaResult[]>;
}
