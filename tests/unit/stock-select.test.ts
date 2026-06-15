import { describe, expect, it } from "vitest";
import { MAX_STOCK_WIDTH, pickWithinWidthCap } from "../../src/pipeline/stock/select.js";

describe("pickWithinWidthCap (stock 1920w 캡)", () => {
  it("default cap is 1920", () => {
    expect(MAX_STOCK_WIDTH).toBe(1920);
  });

  it("empty input → null", () => {
    expect(pickWithinWidthCap([])).toBeNull();
  });

  it("all within cap → largest", () => {
    const v = pickWithinWidthCap([{ width: 640 }, { width: 1920 }, { width: 1280 }]);
    expect(v).toEqual({ width: 1920 });
  });

  it("mixed → largest within cap, excludes oversized (4K dropped)", () => {
    const v = pickWithinWidthCap([{ width: 1280 }, { width: 3840 }, { width: 1920 }]);
    expect(v).toEqual({ width: 1920 });
  });

  it("all exceed cap → smallest (minimize decode)", () => {
    const v = pickWithinWidthCap([{ width: 3840 }, { width: 2560 }]);
    expect(v).toEqual({ width: 2560 });
  });

  it("prefers a known within-cap variant over an unknown-width one", () => {
    const v = pickWithinWidthCap([{ width: undefined }, { width: 1080 }]);
    expect(v).toEqual({ width: 1080 });
  });

  // Codex #2 regression: an unknown-width variant must NOT be assumed within-cap.
  // It could secretly be 4K — so a *known* oversized variant is preferred over it.
  it("does NOT pick an unknown-width variant over a known oversized one", () => {
    const v = pickWithinWidthCap([{ width: undefined, id: "mystery" }, { width: 3840, id: "4k" }]);
    expect(v).toEqual({ width: 3840, id: "4k" });
  });

  it("falls back to the first variant only when NO width is known", () => {
    const v = pickWithinWidthCap([{ width: undefined, id: "a" }, { width: 0, id: "b" }]);
    expect(v).toEqual({ width: undefined, id: "a" });
  });

  it("single variant → itself, even if it exceeds the cap", () => {
    expect(pickWithinWidthCap([{ width: 4096 }])).toEqual({ width: 4096 });
  });

  it("honors a custom cap", () => {
    const v = pickWithinWidthCap([{ width: 640 }, { width: 1280 }, { width: 1920 }], 1000);
    expect(v).toEqual({ width: 640 });
  });

  it("preserves the original variant object (provider link/url etc. survive)", () => {
    const big = { width: 1920, link: "hd.mp4" };
    const small = { width: 640, link: "sd.mp4" };
    expect(pickWithinWidthCap([small, big])).toBe(big);
  });
});
