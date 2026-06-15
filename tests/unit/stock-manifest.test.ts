import { describe, expect, it } from "vitest";
import {
  entryPrimaryKeyword,
  normalizeEntryAssets,
  type ManifestEntryLite,
} from "../../src/pipeline/stock/manifest.js";
import type { MediaResult } from "../../src/pipeline/stock/types.js";

// Regression: backfill이 옛 manifest(단수형 attribution/local_path, keywords[] 없음)에서
// `entry.attributions.length` 읽다 크래시 — modeling-diff 등 멀티컷 도입 전 에피소드 4건.
// Found by /qa on 2026-06-01.

function media(id: string): MediaResult {
  return {
    provider: "pexels",
    id,
    url: `u/${id}`,
    download_url: `d/${id}`,
    thumb_url: `t/${id}`,
    width: 1920,
    height: 1080,
    photographer: "x",
    photographer_url: "y",
    license_note: "z",
  };
}

describe("normalizeEntryAssets", () => {
  it("옛 단수형 스키마(attribution/local_path)를 정규화한다 — 크래시 금지", () => {
    const legacy = {
      shot_id: "shot-003",
      media_type: "video",
      keyword: "person working laptop",
      provider: "pexels",
      local_path: "episodes/modeling-diff/assets/stock/pexels-abc.mp4",
      attribution: media("7490371"),
      // attributions / local_paths / keywords 없음 (멀티컷 도입 전)
    } satisfies ManifestEntryLite;
    const got = normalizeEntryAssets(legacy);
    expect(got).toHaveLength(1);
    expect(got[0]!.asset.id).toBe("7490371");
    expect(got[0]!.localPath).toBe("episodes/modeling-diff/assets/stock/pexels-abc.mp4");
  });

  it("새 복수형 스키마(attributions/local_paths, 멀티컷)를 정규화한다", () => {
    const modern = {
      shot_id: "shot-008",
      media_type: "video",
      keywords: ["a"],
      provider: "pexels",
      local_paths: ["p/1.mp4", "p/2.mp4"],
      attributions: [media("1"), media("2")],
    } satisfies ManifestEntryLite;
    const got = normalizeEntryAssets(modern);
    expect(got.map((g) => g.asset.id)).toEqual(["1", "2"]);
    expect(got.map((g) => g.localPath)).toEqual(["p/1.mp4", "p/2.mp4"]);
  });

  it("복수형이 단수형보다 우선한다(둘 다 있는 전환기 manifest)", () => {
    const both = {
      shot_id: "s",
      media_type: "photo",
      provider: "unsplash",
      attribution: media("singular"),
      local_path: "p/singular.jpg",
      attributions: [media("plural")],
      local_paths: ["p/plural.jpg"],
    } satisfies ManifestEntryLite;
    const got = normalizeEntryAssets(both);
    expect(got).toHaveLength(1);
    expect(got[0]!.asset.id).toBe("plural");
  });

  it("library/누락 자산(attribution 없음)은 빈 목록 — 자연 스킵", () => {
    const lib = {
      shot_id: "s",
      media_type: "photo",
      provider: "library",
      local_path: "episodes/x/assets/stock/library-abc.png",
      // attribution 없음 (운영자 라이브러리는 attribution 미보유)
    } satisfies ManifestEntryLite;
    expect(normalizeEntryAssets(lib)).toEqual([]);
  });

  it("asset은 있는데 local_path가 빠진 부분 manifest도 안 터진다(localPath=undefined)", () => {
    const partial = {
      shot_id: "s",
      media_type: "video",
      provider: "pexels",
      attributions: [media("1"), media("2")],
      local_paths: ["only-one.mp4"], // 두 번째 누락
    } satisfies ManifestEntryLite;
    const got = normalizeEntryAssets(partial);
    expect(got[0]!.localPath).toBe("only-one.mp4");
    expect(got[1]!.localPath).toBeUndefined();
  });
});

describe("entryPrimaryKeyword", () => {
  it("복수형 keywords[0] 우선", () => {
    expect(
      entryPrimaryKeyword({
        shot_id: "s",
        media_type: "video",
        provider: "pexels",
        keywords: ["new kw"],
        keyword: "old kw",
      }),
    ).toBe("new kw");
  });

  it("옛 단수형 keyword로 폴백", () => {
    expect(
      entryPrimaryKeyword({
        shot_id: "s",
        media_type: "video",
        provider: "pexels",
        keyword: "old kw",
      }),
    ).toBe("old kw");
  });

  it("둘 다 없으면 null", () => {
    expect(
      entryPrimaryKeyword({ shot_id: "s", media_type: "video", provider: "pexels" }),
    ).toBeNull();
  });
});
