import { describe, it, expect } from "vitest";
import { TreatmentSchema } from "../../src/schemas/treatment.js";

describe("TreatmentSchema", () => {
  const validScene = {
    id: "scene01",
    beat: "Hook",
    purpose: "시청자가 RICE의 흔한 오용을 본인 일로 인식",
    duration_sec: 18,
    visual_concept: "타이틀 + 실패 사례 헤드라인",
  };

  it("accepts treatment with 3+ scenes", () => {
    const result = TreatmentSchema.safeParse({
      scenes: [
        validScene,
        { ...validScene, id: "scene02" },
        { ...validScene, id: "scene03" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 3 scenes", () => {
    const result = TreatmentSchema.safeParse({ scenes: [validScene, validScene] });
    expect(result.success).toBe(false);
  });

  it("rejects scene id that does not match scene\\d{2,}", () => {
    const result = TreatmentSchema.safeParse({
      scenes: [
        { ...validScene, id: "intro" },
        { ...validScene, id: "scene02" },
        { ...validScene, id: "scene03" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate scene ids", () => {
    const result = TreatmentSchema.safeParse({
      scenes: [
        { ...validScene, id: "scene01" },
        { ...validScene, id: "scene02" },
        { ...validScene, id: "scene01" }, // duplicate
      ],
    });
    expect(result.success).toBe(false);
  });
});
