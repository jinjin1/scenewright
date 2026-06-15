import { describe, expect, it } from "vitest";
import { useDrawOn } from "../../src/remotion/scenes/_draw.js";

const PATH = "M 0 0 L 100 0"; // 길이 100인 수평선

describe("useDrawOn", () => {
  it("delay 전: progress 0, 선 완전히 가려짐, 화살촉 0", () => {
    const d = useDrawOn(-1, PATH, { delayFrames: 0, drawFrames: 20 });
    expect(d.progress).toBe(0);
    // evolvePath는 progress 0에서 길이를 1.5배 확장(브라우저 라운딩 아티팩트 회피).
    // 절대값에 묶지 말고 "offset ≥ dash 길이 → 완전히 가려짐"만 단언.
    const dashLen = Number(d.strokeDasharray.split(" ")[0]);
    expect(d.strokeDashoffset).toBeGreaterThanOrEqual(dashLen);
    expect(d.headProgress).toBe(0);
  });

  it("delayFrames만큼 시작이 밀린다", () => {
    const before = useDrawOn(5, PATH, { delayFrames: 10, drawFrames: 20 });
    expect(before.progress).toBe(0);
    const after = useDrawOn(20, PATH, { delayFrames: 10, drawFrames: 20 });
    expect(after.progress).toBeGreaterThan(0);
  });

  it("끝(end 이후): progress 1, 선 완성(offset 0), headProgress 1", () => {
    const d = useDrawOn(100, PATH, { delayFrames: 0, drawFrames: 20 });
    expect(d.progress).toBe(1);
    expect(d.strokeDashoffset).toBeCloseTo(0, 5);
    expect(d.headProgress).toBe(1);
  });

  it("진행 중 offset은 단조 감소(선이 점점 그려진다)", () => {
    let prev = Infinity;
    for (let f = 0; f <= 20; f++) {
      const { strokeDashoffset } = useDrawOn(f, PATH, { delayFrames: 0, drawFrames: 20 });
      expect(strokeDashoffset).toBeLessThanOrEqual(prev + 1e-9);
      prev = strokeDashoffset;
    }
  });

  it("progress는 항상 [0,1] · NaN 없음", () => {
    for (let f = -5; f <= 40; f += 2) {
      const { progress } = useDrawOn(f, PATH, { delayFrames: 5, drawFrames: 20 });
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
      expect(Number.isNaN(progress)).toBe(false);
    }
  });

  it("headLeadFrac=0: 화살촉 없음(headProgress 항상 0)", () => {
    for (let f = 0; f <= 25; f++) {
      expect(
        useDrawOn(f, PATH, { drawFrames: 20, headLeadFrac: 0 }).headProgress,
      ).toBe(0);
    }
  });

  it("화살촉은 마지막 20% 구간에서만 팝", () => {
    // window = [end - drawFrames*0.2, end] = [16, 20]
    expect(
      useDrawOn(10, PATH, { delayFrames: 0, drawFrames: 20, headLeadFrac: 0.2 }).headProgress,
    ).toBe(0);
    expect(
      useDrawOn(16, PATH, { delayFrames: 0, drawFrames: 20, headLeadFrac: 0.2 }).headProgress,
    ).toBeCloseTo(0, 5);
    expect(
      useDrawOn(20, PATH, { delayFrames: 0, drawFrames: 20, headLeadFrac: 0.2 }).headProgress,
    ).toBeCloseTo(1, 5);
  });

  it("결정적: 같은 입력 → 같은 출력", () => {
    const a = useDrawOn(9, PATH, { delayFrames: 2, drawFrames: 18 });
    const b = useDrawOn(9, PATH, { delayFrames: 2, drawFrames: 18 });
    expect(a).toEqual(b);
  });
});
