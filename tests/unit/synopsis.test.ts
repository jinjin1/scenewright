import { describe, it, expect } from "vitest";
import { SynopsisSchema } from "../../src/schemas/synopsis.js";

describe("SynopsisSchema", () => {
  const valid = {
    logline: "PM이 RICE 프레임워크로 우선순위를 정하는 실전 가이드",
    hook: "RICE는 왜 대부분의 팀에서 실패할까?",
    takeaways: [
      "RICE 점수를 신뢰하지 말고 가설로 다뤄라",
      "Reach 추정의 함정 3가지",
      "Confidence를 분리하지 않으면 Effort가 왜곡된다",
    ],
    audience: "스타트업 PM 1~3년차",
    duration_min: 12,
  };

  it("accepts a valid synopsis", () => {
    expect(SynopsisSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects takeaways with wrong count", () => {
    const bad = { ...valid, takeaways: valid.takeaways.slice(0, 2) };
    expect(SynopsisSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects duration outside 5~20", () => {
    expect(SynopsisSchema.safeParse({ ...valid, duration_min: 3 }).success).toBe(false);
    expect(SynopsisSchema.safeParse({ ...valid, duration_min: 25 }).success).toBe(false);
  });
});
