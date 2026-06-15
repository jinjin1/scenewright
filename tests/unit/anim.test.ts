import { describe, expect, it } from "vitest";
import { useEntrance } from "../../src/remotion/scenes/_anim.js";

const FPS = 30;

describe("useEntrance", () => {
  it("frame 0 / delay 전: opacity 0, translateY = rise", () => {
    expect(useEntrance(0, FPS).opacity).toBe(0);
    const e = useEntrance(5, FPS, { delayFrames: 20 });
    expect(e.opacity).toBe(0);
    expect(e.translateY).toBeCloseTo(16, 5); // 기본 rise
  });

  it("settled(큰 frame): opacity ~1, translateY ~0", () => {
    const e = useEntrance(90, FPS, { preset: "gentle" });
    expect(e.opacity).toBeGreaterThan(0.99);
    expect(Math.abs(e.translateY)).toBeLessThan(0.5);
  });

  it("opacity는 항상 [0,1] · NaN 없음", () => {
    for (let f = -5; f <= 90; f += 3) {
      const { opacity } = useEntrance(f, FPS, { preset: "lively" });
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
      expect(Number.isNaN(opacity)).toBe(false);
    }
  });

  it("gentle은 overshoot 없음 (translateY 음수 안 됨)", () => {
    let minTy = Infinity;
    for (let f = 0; f <= 90; f++) minTy = Math.min(minTy, useEntrance(f, FPS, { preset: "gentle" }).translateY);
    expect(minTy).toBeGreaterThanOrEqual(-0.01);
  });

  it("lively는 미세 overshoot (translateY 음수 구간 = 팝)", () => {
    let minTy = Infinity;
    for (let f = 0; f <= 90; f++) minTy = Math.min(minTy, useEntrance(f, FPS, { preset: "lively" }).translateY);
    expect(minTy).toBeLessThan(0);
  });

  it("rise 커스텀: frame 0에서 translateY = rise", () => {
    expect(useEntrance(0, FPS, { rise: 40 }).translateY).toBeCloseTo(40, 5);
    expect(useEntrance(0, FPS, { rise: 0 }).translateY).toBe(0);
  });

  it("delayFrames만큼 진입이 밀린다", () => {
    const noDelay = useEntrance(20, FPS, { preset: "gentle" });
    const delayed = useEntrance(20, FPS, { preset: "gentle", delayFrames: 15 });
    expect(delayed.opacity).toBeLessThan(noDelay.opacity);
  });
});
