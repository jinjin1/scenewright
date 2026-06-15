import { describe, expect, it } from "vitest";
import { useBurstParticle } from "../../src/remotion/scenes/_burst.js";

const FPS = 30;

describe("useBurstParticle", () => {
  it("발사 전(delay 전): opacity 0, 중심(x=y=0), scale 0", () => {
    const p = useBurstParticle(0, FPS, 0, { delayFrames: 20 });
    expect(p.opacity).toBe(0);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
    expect(p.scale).toBe(0);
  });

  it("발사 후 산란: 중심에서 멀어진다(거리 > 0)", () => {
    const p = useBurstParticle(40, FPS, 3, { delayFrames: 0, radius: 280 });
    const dist = Math.hypot(p.x, p.y);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThanOrEqual(280 + 1); // 지터 ≤1.0 · progress 오버슈트 여유
  });

  it("결정적: 같은 i·frame은 항상 같은 위치(랜덤 없음)", () => {
    const a = useBurstParticle(35, FPS, 7, { delayFrames: 0 });
    const b = useBurstParticle(35, FPS, 7, { delayFrames: 0 });
    expect(a).toEqual(b);
  });

  it("서로 다른 i는 다른 각도로 흩어진다", () => {
    const p0 = useBurstParticle(40, FPS, 0, { delayFrames: 0 });
    const p1 = useBurstParticle(40, FPS, 1, { delayFrames: 0 });
    expect(p0.x === p1.x && p0.y === p1.y).toBe(false);
  });

  it("opacity는 항상 [0,1] · NaN 없음 (전 구간)", () => {
    for (let f = -5; f <= 120; f += 3) {
      for (let i = 0; i < 14; i++) {
        const { opacity } = useBurstParticle(f, FPS, i, { delayFrames: 10, count: 14 });
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
        expect(Number.isNaN(opacity)).toBe(false);
      }
    }
  });

  it("한 순간의 버스트: 충분히 뒤에는 페이드아웃(opacity → 0)", () => {
    const late = useBurstParticle(200, FPS, 0, {
      delayFrames: 0,
      travelFrames: 16,
      holdFrames: 10,
      fadeFrames: 14,
    });
    expect(late.opacity).toBe(0);
  });

  it("stagger: i가 클수록 진입이 밀린다(같은 frame에서 거리 더 짧음)", () => {
    const early = useBurstParticle(12, FPS, 0, { delayFrames: 0, staggerFrames: 2 });
    const later = useBurstParticle(12, FPS, 5, { delayFrames: 0, staggerFrames: 2 });
    expect(Math.hypot(later.x, later.y)).toBeLessThan(Math.hypot(early.x, early.y));
  });
});
