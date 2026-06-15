import { describe, expect, it } from "vitest";
import {
  collectAssets,
  expandKeywords,
  type SearchFn,
} from "../../src/pipeline/stock/collect.js";
import type { MediaResult } from "../../src/pipeline/stock/types.js";

function asset(id: string, tags?: string[]): MediaResult {
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
    ...(tags ? { tags } : {}),
  };
}

// 키워드별 결과를 흉내내고 호출 횟수를 센다(실제 API 미호출).
function fakeSearch(map: Record<string, MediaResult[]>): { fn: SearchFn; calls: string[] } {
  const calls: string[] = [];
  const fn: SearchFn = async (kw) => {
    calls.push(kw);
    return map[kw] ?? [];
  };
  return { fn, calls };
}

describe("expandKeywords", () => {
  it("원본 먼저, 그다음 하위구절, 중복 제거", () => {
    const ex = expandKeywords(["team meeting office"]);
    expect(ex[0]).toBe("team meeting office");
    expect(ex).toContain("team meeting");
    expect(ex).toContain("meeting office");
    expect(ex).toContain("team");
    expect(new Set(ex).size).toBe(ex.length); // 중복 없음
  });
});

describe("collectAssets — early-exit (쿼터 보호)", () => {
  it("want=1: 첫 키워드가 clean+fresh를 주면 즉시 멈춘다(추가 검색 없음)", async () => {
    const { fn, calls } = fakeSearch({
      "city street": [asset("a1")],
      "office desk": [asset("a2")],
    });
    const used = new Set<string>();
    const r = await collectAssets(["city street", "office desk"], "photo", 1, used, {
      search: fn,
    });
    expect(r.assets.map((a) => a.id)).toEqual(["a1"]);
    expect(r.searches).toBe(1); // 2번째 키워드는 검색하지 않음
    expect(calls).toEqual(["city street"]);
    expect(used.has("pexels:a1")).toBe(true); // episodeUsed에 등록
  });

  it("want=2: 충분히 모일 때까지 다음 키워드로 계속", async () => {
    const { fn } = fakeSearch({ "kw one": [asset("a1")], "kw two": [asset("a2")] });
    const r = await collectAssets(["kw one", "kw two"], "photo", 2, new Set(), { search: fn });
    expect(r.assets.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
    expect(r.searches).toBe(2);
  });

  it("이미 에피소드에서 쓴 자산은 건너뛰고 계속 검색한다", async () => {
    const { fn } = fakeSearch({ alpha: [asset("dup")], beta: [asset("fresh")] });
    const used = new Set(["pexels:dup"]);
    const r = await collectAssets(["alpha", "beta"], "photo", 1, used, { search: fn });
    expect(r.assets.map((a) => a.id)).toEqual(["fresh"]);
    expect(r.searches).toBe(2); // 첫 키워드의 유일 hit이 이미 사용됨 → 더 검색
  });

  it("아무것도 안 맞으면 maxSearches에서 멈춘다(폭증 backstop)", async () => {
    const { fn } = fakeSearch({}); // 전부 []
    // 두 키워드가 ~12개 하위구절로 확장되지만 cap이 3에서 끊는다.
    const r = await collectAssets(["red blue green", "big small tall"], "photo", 1, new Set(), {
      search: fn,
      maxSearches: 3,
    });
    expect(expandKeywords(["red blue green", "big small tall"]).length).toBeGreaterThan(3);
    expect(r.assets).toEqual([]);
    expect(r.searches).toBe(3);
  });
});

describe("collectAssets — clean/blank 우선순위 보존", () => {
  it("clean이 있으면 blank를 건너뛰고 clean을 고른다", async () => {
    const { fn } = fakeSearch({
      k1: [asset("blanky", ["white background", "mockup"])],
      k2: [asset("cleany")],
    });
    const r = await collectAssets(["k1", "k2"], "photo", 1, new Set(), { search: fn });
    expect(r.assets.map((a) => a.id)).toEqual(["cleany"]);
  });

  it("blank밖에 없으면 폴백으로 blank를 쓴다", async () => {
    const { fn } = fakeSearch({ only: [asset("blanky", ["mockup"])] });
    const r = await collectAssets(["only"], "photo", 1, new Set(), { search: fn });
    expect(r.assets.map((a) => a.id)).toEqual(["blanky"]);
  });
});
