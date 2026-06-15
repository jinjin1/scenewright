import { describe, expect, it } from "vitest";
import {
  isBlankish,
  isIllustrationIntent,
  normalizeTags,
  rankHits,
} from "../../src/pipeline/stock/rank.js";
import type { MediaResult } from "../../src/pipeline/stock/types.js";

function asset(id: string, tags?: string[]): MediaResult {
  return {
    provider: "pixabay",
    id,
    url: `https://example.test/${id}`,
    download_url: `https://cdn.example.test/${id}.jpg`,
    thumb_url: `https://cdn.example.test/${id}-thumb.jpg`,
    width: 1920,
    height: 1080,
    photographer: `photog-${id}`,
    photographer_url: `https://example.test/u/${id}`,
    license_note: "test license",
    tags,
  };
}

describe("normalizeTags", () => {
  it("splits a comma string (Pixabay) into lowercase tokens", () => {
    expect(normalizeTags("Team, Meeting, White Board")).toEqual([
      "team",
      "meeting",
      "white",
      "board",
    ]);
  });

  it("tokenizes a sentence (Pexels alt) and dedupes", () => {
    expect(normalizeTags("A man holding a phone, a man.")).toEqual(["man", "holding", "phone"]);
  });

  it("flattens an array (Unsplash alt + tag titles)", () => {
    expect(normalizeTags(["Person typing", "laptop", "code"])).toEqual([
      "person",
      "typing",
      "laptop",
      "code",
    ]);
  });

  it("empty / nullish → []", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags("")).toEqual([]);
  });
});

describe("isBlankish — blank/mockup cliché detection", () => {
  it("flags mockup / blank screen tags", () => {
    expect(isBlankish(["smartphone", "mockup", "blank", "white"])).toBe(true);
    expect(isBlankish(["white", "background", "isolated", "product"])).toBe(true);
    expect(isBlankish(["empty", "screen", "phone"])).toBe(true);
  });

  it("does not flag a phone genuinely in use", () => {
    expect(isBlankish(["woman", "scrolling", "phone", "cafe"])).toBe(false);
  });

  it("avoids substring false positives (blanket ≠ blank)", () => {
    expect(isBlankish(["blanket", "picnic", "park"])).toBe(false);
  });

  it("undefined/empty → false", () => {
    expect(isBlankish(undefined)).toBe(false);
    expect(isBlankish([])).toBe(false);
  });
});

describe("rankHits — clean-first, relevance-ordered, blank last", () => {
  it("pushes blank-mockup assets behind clean ones", () => {
    const hits = [
      asset("blankphone", ["smartphone", "mockup", "blank", "white"]),
      asset("clean", ["team", "meeting", "office"]),
    ];
    const ranked = rankHits(hits, "team meeting");
    expect(ranked.map((r) => r.asset.id)).toEqual(["clean", "blankphone"]);
    expect(ranked[0]!.penalized).toBe(false);
    expect(ranked[1]!.penalized).toBe(true);
  });

  it("within clean group, higher keyword relevance wins", () => {
    const hits = [
      asset("low", ["sunset", "beach"]),
      asset("high", ["product", "roadmap", "planning"]),
    ];
    const ranked = rankHits(hits, "product roadmap");
    expect(ranked[0]!.asset.id).toBe("high");
    expect(ranked[0]!.relevance).toBe(2);
  });

  it("is a stable sort on ties (original order preserved)", () => {
    const hits = [asset("a", ["x"]), asset("b", ["y"]), asset("c", ["z"])];
    const ranked = rankHits(hits, "unrelated keyword");
    expect(ranked.map((r) => r.asset.id)).toEqual(["a", "b", "c"]);
  });

  it("no-tags provider (e.g. Pexels video) keeps original order, none penalized", () => {
    const hits = [asset("v1"), asset("v2"), asset("v3")];
    const ranked = rankHits(hits, "city skyline");
    expect(ranked.map((r) => r.asset.id)).toEqual(["v1", "v2", "v3"]);
    expect(ranked.every((r) => !r.penalized)).toBe(true);
  });

  it("blank phone (device+blank) sorts behind a generic isolated asset", () => {
    const hits = [
      asset("blankphone", ["smartphone", "blank", "screen"]),
      asset("isolated", ["mug", "isolated", "white"]),
      asset("clean", ["coffee", "morning"]),
    ];
    const ranked = rankHits(hits, "coffee");
    // clean first; among penalized, device-blank is worst → last.
    expect(ranked.map((r) => r.asset.id)).toEqual(["clean", "isolated", "blankphone"]);
  });
});

describe("isIllustrationIntent", () => {
  it("detects cartoon/flat illustration style hints", () => {
    expect(isIllustrationIntent("product roadmap flat illustration")).toBe(true);
    expect(isIllustrationIntent("teamwork cartoon")).toBe(true);
    expect(isIllustrationIntent("isometric vector office")).toBe(true);
    expect(isIllustrationIntent("funnel line art")).toBe(true);
  });

  it("plain photographic keywords are not illustration-intent", () => {
    expect(isIllustrationIntent("developer typing code")).toBe(false);
    expect(isIllustrationIntent("city skyline night")).toBe(false);
  });
});
