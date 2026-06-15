import { describe, expect, it } from "vitest";
import {
  formatAttribution,
  formatAttributionCompact,
} from "../../src/pipeline/stock/attribution.js";
import type { MediaResult } from "../../src/pipeline/stock/types.js";

function media(overrides: Partial<MediaResult> & Pick<MediaResult, "provider" | "id">): MediaResult {
  return {
    url: `https://example.test/${overrides.provider}/${overrides.id}`,
    download_url: `https://cdn.example.test/${overrides.provider}/${overrides.id}.jpg`,
    thumb_url: `https://cdn.example.test/${overrides.provider}/${overrides.id}-thumb.jpg`,
    width: 1920,
    height: 1080,
    photographer: `${overrides.provider}-photog`,
    photographer_url: `https://example.test/u/${overrides.provider}-photog`,
    license_note: `${overrides.provider} license`,
    ...overrides,
  };
}

describe("formatAttribution", () => {
  it("returns an empty string when given no inputs", () => {
    expect(formatAttribution([])).toBe("");
  });

  it("renders a credits header and one section per provider", () => {
    const block = formatAttribution([
      media({ provider: "unsplash", id: "u1", photographer: "Alice", photographer_url: "https://unsplash.com/@alice", url: "https://unsplash.com/photos/u1" }),
      media({ provider: "pexels", id: "p1", photographer: "Bob", photographer_url: "https://pexels.com/@bob", url: "https://pexels.com/photo/p1" }),
      media({ provider: "pixabay", id: "x1", photographer: "Carol", photographer_url: "https://pixabay.com/users/123/", url: "https://pixabay.com/photos/x1" }),
    ]);

    expect(block).toContain("## Stock media credits");
    expect(block).toContain("Unsplash (https://unsplash.com)");
    expect(block).toContain("Photo by Alice on Unsplash (https://unsplash.com/@alice)");
    expect(block).toContain("Pexels (https://www.pexels.com)");
    expect(block).toContain("Photo by Bob on Pexels");
    expect(block).toContain("Pixabay (https://pixabay.com)");
    expect(block).toContain("Photo by Carol on Pixabay");
  });

  it("labels video assets as 'Video by' (presence of duration_sec)", () => {
    const block = formatAttribution([
      media({
        provider: "pexels",
        id: "v1",
        photographer: "Dave",
        photographer_url: "https://pexels.com/@dave",
        duration_sec: 12,
      }),
    ]);
    expect(block).toContain("Video by Dave on Pexels (https://pexels.com/@dave)");
    expect(block).not.toContain("Photo by Dave");
  });

  it("deduplicates by (provider, id) so reusing the same asset credits only once", () => {
    const dup = media({ provider: "unsplash", id: "shared", photographer: "Erin" });
    const block = formatAttribution([dup, dup, dup]);
    const matches = block.match(/Photo by Erin/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("groups multiple credits per provider together regardless of input order", () => {
    const block = formatAttribution([
      media({ provider: "pexels", id: "p1", photographer: "Bob" }),
      media({ provider: "unsplash", id: "u1", photographer: "Alice" }),
      media({ provider: "pexels", id: "p2", photographer: "Frank" }),
    ]);

    const unsplashIdx = block.indexOf("Unsplash (");
    const pexelsIdx = block.indexOf("Pexels (");
    const bobIdx = block.indexOf("Photo by Bob");
    const frankIdx = block.indexOf("Photo by Frank");

    // License-mandatory providers (Unsplash) come before Pexels in the stable ordering.
    expect(unsplashIdx).toBeGreaterThan(-1);
    expect(pexelsIdx).toBeGreaterThan(unsplashIdx);
    // Both Pexels credits sit under the single Pexels heading.
    expect(bobIdx).toBeGreaterThan(pexelsIdx);
    expect(frankIdx).toBeGreaterThan(pexelsIdx);
  });

  it("skips provider sections that have no credits", () => {
    const block = formatAttribution([media({ provider: "pixabay", id: "x9", photographer: "Gina" })]);
    expect(block).toContain("Pixabay (");
    expect(block).not.toContain("Unsplash (");
    expect(block).not.toContain("Pexels (");
  });
});

describe("formatAttributionCompact (YouTube 5000자용)", () => {
  it("빈 입력은 빈 문자열", () => {
    expect(formatAttributionCompact([])).toBe("");
  });

  it("provider 요약 + 사진작가당 1줄(photographer 링크만, media URL 없음)", () => {
    const block = formatAttributionCompact([
      media({ provider: "unsplash", id: "u1", photographer: "Alice", photographer_url: "https://unsplash.com/@alice", url: "https://unsplash.com/photos/super-long-descriptive-slug-u1" }),
      media({ provider: "pexels", id: "p1", photographer: "Bob", photographer_url: "https://pexels.com/@bob", url: "https://pexels.com/photo/another-long-slug-p1" }),
    ]);
    expect(block).toContain("📷 Stock media: Unsplash · Pexels");
    expect(block).toContain("- Alice (Unsplash) https://unsplash.com/@alice");
    expect(block).toContain("- Bob (Pexels) https://pexels.com/@bob");
    // media URL(긴 슬러그)은 빠진다 — 이게 5000자 폭주의 원인이었다.
    expect(block).not.toContain("super-long-descriptive-slug");
    expect(block).not.toContain("another-long-slug");
  });

  it("같은 사진작가의 여러 자산은 1줄로 합친다(자산별 dedup이 아니라 작가별)", () => {
    const block = formatAttributionCompact([
      media({ provider: "unsplash", id: "u1", photographer: "Alice", photographer_url: "https://unsplash.com/@alice" }),
      media({ provider: "unsplash", id: "u2", photographer: "Alice", photographer_url: "https://unsplash.com/@alice" }),
      media({ provider: "unsplash", id: "u3", photographer: "Alice", photographer_url: "https://unsplash.com/@alice" }),
    ]);
    const matches = block.match(/- Alice \(Unsplash\)/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("전체 포맷보다 확연히 짧다(실측 회귀)", () => {
    const many: MediaResult[] = Array.from({ length: 21 }, (_, i) =>
      media({
        provider: i % 2 === 0 ? "unsplash" : "pexels",
        id: `a${i}`,
        photographer: `Creator ${i}`,
        photographer_url: `https://example.test/u/creator-${i}`,
        url: `https://example.test/photos/a-very-long-descriptive-photo-slug-number-${i}`,
      }),
    );
    expect(formatAttributionCompact(many).length).toBeLessThan(
      formatAttribution(many).length,
    );
  });
});
