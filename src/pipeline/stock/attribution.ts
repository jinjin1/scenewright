import type { MediaResult, Provider } from "./types.js";

const PROVIDER_LABEL: Record<Provider, string> = {
  unsplash: "Unsplash",
  pexels: "Pexels",
  pixabay: "Pixabay",
};

const PROVIDER_HOME: Record<Provider, string> = {
  unsplash: "https://unsplash.com",
  pexels: "https://www.pexels.com",
  pixabay: "https://pixabay.com",
};

// Stable order: license-mandatory providers first (Unsplash, Pexels), then Pixabay.
const PROVIDER_ORDER: Provider[] = ["unsplash", "pexels", "pixabay"];

function creditLine(media: MediaResult): string {
  const verb = media.duration_sec !== undefined ? "Video" : "Photo";
  const label = PROVIDER_LABEL[media.provider];
  return `- ${verb} by ${media.photographer} on ${label} (${media.photographer_url}) — ${media.url}`;
}

/**
 * Build the attribution block for a video description.
 *
 * - Groups credits by provider; preserves first-seen order within each group.
 * - Deduplicates by (provider, id) so reusing the same asset across shots
 *   only credits the photographer once.
 * - Unsplash and Pexels attribution are license requirements; Pixabay is
 *   strongly recommended.
 *
 * Returns an empty string when no credits are needed.
 */
export function formatAttribution(used: MediaResult[]): string {
  if (used.length === 0) return "";

  const seen = new Set<string>();
  const grouped = new Map<Provider, MediaResult[]>();

  for (const media of used) {
    const dedupKey = `${media.provider}:${media.id}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const bucket = grouped.get(media.provider) ?? [];
    bucket.push(media);
    grouped.set(media.provider, bucket);
  }

  const sections: string[] = [];
  for (const provider of PROVIDER_ORDER) {
    const items = grouped.get(provider);
    if (!items || items.length === 0) continue;
    sections.push(
      `${PROVIDER_LABEL[provider]} (${PROVIDER_HOME[provider]})`,
      ...items.map(creditLine),
    );
    sections.push("");
  }
  // Drop the trailing blank line from the last section.
  while (sections.length > 0 && sections[sections.length - 1] === "") sections.pop();

  return ["## Stock media credits", "", ...sections].join("\n");
}

/**
 * Compact attribution for a YouTube description (5000-char limit).
 *
 * Unsplash/Pexels/Pixabay licenses do NOT require attribution (it is appreciated,
 * not mandatory), so we credit creators as a courtesy without the bloat: one line
 * per **unique photographer** (deduped by provider+name), photographer link only —
 * the long per-asset media URL is dropped. A 21-asset block (~3.4k chars with two
 * URLs per line) collapses to ~photographer-count lines (~1.1k). The FULL per-asset
 * credits still live in {@link formatAttribution} (written to publish/credits.txt).
 *
 * Returns an empty string when no credits are needed.
 */
export function formatAttributionCompact(used: MediaResult[]): string {
  if (used.length === 0) return "";

  const seen = new Set<string>();
  const grouped = new Map<Provider, MediaResult[]>();
  for (const media of used) {
    const key = `${media.provider}:${media.photographer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bucket = grouped.get(media.provider) ?? [];
    bucket.push(media);
    grouped.set(media.provider, bucket);
  }

  const providers = PROVIDER_ORDER.filter((p) => grouped.has(p));
  const lines = [`📷 Stock media: ${providers.map((p) => PROVIDER_LABEL[p]).join(" · ")}`];
  for (const provider of providers) {
    for (const media of grouped.get(provider)!) {
      lines.push(`- ${media.photographer} (${PROVIDER_LABEL[provider]}) ${media.photographer_url}`);
    }
  }
  return lines.join("\n");
}
