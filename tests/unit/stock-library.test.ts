import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  registerAsset,
  searchIndex,
  emptyIndex,
  REUSE_OVERUSE_CAP,
} from "../../src/pipeline/stock/library.js";
import { renderLibraryHtml, renderLibraryMarkdown } from "../../src/pipeline/stock/catalog.js";
import { collectAssets, type ReuseFn } from "../../src/pipeline/stock/collect.js";
import type { LibraryEntry, LibraryIndex } from "../../src/schemas/library.js";
import type { MediaResult, MediaType, Provider } from "../../src/pipeline/stock/types.js";

// 실제 풀 파일을 흉내내는 임시 디렉터리 — searchIndex의 existsSync 게이트를 통과시키기 위함.
const POOL = mkdtempSync(path.join(tmpdir(), "stock-pool-"));
afterAll(() => {
  // 임시 디렉터리는 OS가 정리; 명시적 rm은 생략(테스트 산출물 작음).
});

function poolFile(name: string): string {
  const p = path.join(POOL, name);
  writeFileSync(p, "x");
  return p;
}

function media(id: string, opts: Partial<MediaResult> = {}): MediaResult {
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
    ...opts,
  };
}

function entry(over: Partial<LibraryEntry>): LibraryEntry {
  return {
    key: "pexels:1",
    provider: "pexels" as Provider,
    media_type: "video" as MediaType,
    pool_path: poolFile("a.mp4"),
    width: 1920,
    height: 1080,
    attribution: media("1"),
    tags: [],
    matched_keywords: [],
    used_by: [{ slug: "ep", shot_id: "shot-000", used_at: "2026-01-01T00:00:00.000Z" }],
    first_seen: "2026-01-01T00:00:00.000Z",
    last_used: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("registerAsset", () => {
  it("새 자산 entry를 만든다 (메타 채움)", () => {
    const index = emptyIndex();
    const e = registerAsset(
      index,
      media("42", { tags: ["crosswalk", "city"], duration_sec: 13 }),
      "video",
      "assets/stock/pool/pexels-abc.mp4",
      { slug: "ep1", shot_id: "shot-003" },
      "busy crosswalk",
      "2026-02-01T00:00:00.000Z",
    );
    expect(index.entries).toHaveLength(1);
    expect(e.key).toBe("pexels:42");
    expect(e.media_type).toBe("video");
    expect(e.duration_sec).toBe(13);
    expect(e.matched_keywords).toEqual(["busy crosswalk"]);
    expect(e.tags).toEqual(["crosswalk", "city"]);
    expect(e.used_by).toEqual([
      { slug: "ep1", shot_id: "shot-003", used_at: "2026-02-01T00:00:00.000Z" },
    ]);
  });

  it("같은 자산 재등록은 keyword·used_by를 누적하고 중복은 제거한다 (멱등)", () => {
    const index = emptyIndex();
    const args = [media("42", { tags: ["city"] }), "video" as MediaType, "p.mp4"] as const;
    registerAsset(index, ...args, { slug: "ep1", shot_id: "s0" }, "crosswalk", "2026-02-01T00:00:00.000Z");
    registerAsset(index, ...args, { slug: "ep1", shot_id: "s0" }, "crosswalk", "2026-02-01T00:00:00.000Z"); // 완전 중복
    registerAsset(index, ...args, { slug: "ep2", shot_id: "s9" }, "commute", "2026-03-01T00:00:00.000Z"); // 새 사용처+키워드
    expect(index.entries).toHaveLength(1);
    const e = index.entries[0]!;
    expect(e.matched_keywords).toEqual(["crosswalk", "commute"]);
    expect(e.used_by).toHaveLength(2);
    // first_seen은 가장 이른, last_used는 가장 늦은 시각으로 수렴.
    expect(e.first_seen).toBe("2026-02-01T00:00:00.000Z");
    expect(e.last_used).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("searchIndex", () => {
  function indexOf(...entries: LibraryEntry[]): LibraryIndex {
    return { version: 1, generated_at: "now", entries };
  }

  it("키워드 토큰이 겹치는 자산을 돌려준다 (관련도)", () => {
    const idx = indexOf(
      entry({ key: "pexels:1", matched_keywords: ["busy crosswalk"], pool_path: poolFile("1.mp4") }),
      entry({ key: "pexels:2", tags: ["mountain", "snow"], pool_path: poolFile("2.mp4") }),
    );
    const got = searchIndex(idx, ["crosswalk commute"], "video", 2, new Set());
    expect(got.map((m) => m.id)).toEqual(["1"]); // 2는 관련도 0 → 제외
  });

  it("media_type이 다르면 제외한다", () => {
    const idx = indexOf(
      entry({ key: "pexels:1", media_type: "photo", matched_keywords: ["crosswalk"], pool_path: poolFile("p1.jpg") }),
    );
    expect(searchIndex(idx, ["crosswalk"], "video", 1, new Set())).toHaveLength(0);
  });

  it("episodeUsed에 있는 자산은 제외한다", () => {
    const idx = indexOf(entry({ key: "pexels:1", matched_keywords: ["crosswalk"], pool_path: poolFile("u1.mp4") }));
    expect(searchIndex(idx, ["crosswalk"], "video", 1, new Set(["pexels:1"]))).toHaveLength(0);
  });

  it("과사용 자산(used_by ≥ cap)은 자동 재활용에서 제외한다", () => {
    const heavy = Array.from({ length: REUSE_OVERUSE_CAP }, (_, i) => ({
      slug: `ep${i}`,
      shot_id: "s",
      used_at: "2026-01-01T00:00:00.000Z",
    }));
    const idx = indexOf(
      entry({ key: "pexels:1", matched_keywords: ["crosswalk"], used_by: heavy, pool_path: poolFile("h1.mp4") }),
    );
    expect(searchIndex(idx, ["crosswalk"], "video", 1, new Set())).toHaveLength(0);
  });

  it("풀 파일이 없으면 제외한다", () => {
    const idx = indexOf(
      entry({ key: "pexels:1", matched_keywords: ["crosswalk"], pool_path: "/nope/missing.mp4" }),
    );
    expect(searchIndex(idx, ["crosswalk"], "video", 1, new Set())).toHaveLength(0);
  });

  it("blank/목업 태그 자산은 자동 재활용하지 않는다", () => {
    const idx = indexOf(
      entry({ key: "pexels:1", tags: ["mockup", "white", "background"], matched_keywords: ["laptop"], pool_path: poolFile("b1.mp4") }),
    );
    expect(searchIndex(idx, ["laptop"], "video", 1, new Set())).toHaveLength(0);
  });

  it("덜 쓴·오래 안 쓴 자산을 먼저 돌려준다 (다양성)", () => {
    const idx = indexOf(
      entry({
        key: "pexels:hot",
        attribution: media("hot"),
        matched_keywords: ["crosswalk"],
        used_by: [
          { slug: "a", shot_id: "s", used_at: "2026-05-01T00:00:00.000Z" },
          { slug: "b", shot_id: "s", used_at: "2026-05-01T00:00:00.000Z" },
        ],
        pool_path: poolFile("hot.mp4"),
      }),
      entry({
        key: "pexels:fresh",
        attribution: media("fresh"),
        matched_keywords: ["crosswalk"],
        used_by: [{ slug: "a", shot_id: "s", used_at: "2026-01-01T00:00:00.000Z" }],
        pool_path: poolFile("fresh.mp4"),
      }),
    );
    const got = searchIndex(idx, ["crosswalk"], "video", 2, new Set());
    expect(got[0]!.id).toBe("fresh"); // 덜 쓴 자산 먼저
  });

  it("want 개수만큼만 돌려준다", () => {
    const idx = indexOf(
      entry({ key: "pexels:1", matched_keywords: ["crosswalk"], pool_path: poolFile("w1.mp4") }),
      entry({ key: "pexels:2", matched_keywords: ["crosswalk"], pool_path: poolFile("w2.mp4") }),
    );
    expect(searchIndex(idx, ["crosswalk"], "video", 1, new Set())).toHaveLength(1);
  });
});

describe("collectAssets × reuse 통합", () => {
  function reuseFn(picks: MediaResult[]): ReuseFn {
    return () => picks;
  }

  it("재활용이 want를 다 채우면 API를 안 친다 (searches=0)", async () => {
    const calls: string[] = [];
    const search = async (kw: string) => {
      calls.push(kw);
      return [];
    };
    const res = await collectAssets(["crosswalk"], "video", 1, new Set(), {
      search,
      reuse: reuseFn([media("R1", { tags: ["crosswalk"] })]),
    });
    expect(res.reused).toBe(1);
    expect(res.searches).toBe(0);
    expect(calls).toHaveLength(0);
    expect(res.assets.map((a) => a.id)).toEqual(["R1"]);
  });

  it("부분 재활용이면 부족분만 API로 채운다", async () => {
    const search = async () => [media("API1", { tags: ["crosswalk"] })];
    const res = await collectAssets(["crosswalk"], "video", 2, new Set(), {
      search,
      reuse: reuseFn([media("R1", { tags: ["crosswalk"] })]),
    });
    expect(res.reused).toBe(1);
    expect(res.assets.map((a) => a.id)).toEqual(["R1", "API1"]); // 재활용 먼저, API 보충
    expect(res.searches).toBeGreaterThan(0);
  });

  it("reuse 미주입이면 기존 동작과 동일 (reused=0)", async () => {
    const search = async () => [media("API1")];
    const res = await collectAssets(["x"], "video", 1, new Set(), { search });
    expect(res.reused).toBe(0);
    expect(res.assets.map((a) => a.id)).toEqual(["API1"]);
  });
});

describe("catalog 렌더", () => {
  const idx: LibraryIndex = {
    version: 1,
    generated_at: "2026-06-01T00:00:00.000Z",
    entries: [
      entry({
        key: "pexels:1",
        matched_keywords: ["busy crosswalk"],
        tags: ["city", "street"],
        duration_sec: 13,
      }),
    ],
  };

  it("markdown은 key·키워드·사용처를 담는다", () => {
    const md = renderLibraryMarkdown(idx);
    expect(md).toContain("pexels:1");
    expect(md).toContain("busy crosswalk");
    expect(md).toContain("비디오");
  });

  it("html은 썸네일과 key를 담는다", () => {
    const html = renderLibraryHtml(idx);
    expect(html).toContain("pexels:1");
    expect(html).toContain("t/1"); // thumb_url
    expect(html).toContain("<!doctype html>");
  });
});
