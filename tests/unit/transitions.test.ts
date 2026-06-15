import { describe, expect, it } from "vitest";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";
import { none } from "@remotion/transitions/none";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { StoryboardSchema } from "../../src/schemas/storyboard.js";
import { groupConsecutiveByVisual } from "../../src/remotion/compositions/utils.js";
import {
  type AnyPresentation,
  boundaryPresentations,
  presentationFor,
} from "../../src/remotion/compositions/transitions.js";

const DIMS = { width: 1920, height: 1080 };

// presentation을 component 동일성으로 식별(component는 모듈 상수).
const COMPONENT: Record<string, unknown> = {
  fade: fade().component,
  none: none().component,
  wipe: wipe().component,
  slide: slide().component,
  flip: flip().component,
  clockWipe: clockWipe({ width: 1, height: 1 }).component,
  iris: iris({ width: 1, height: 1 }).component,
};
const CHEAP = new Set(Object.keys(COMPONENT)); // 전부 CSS/clipPath (WebGL 0)
function nameOf(p: AnyPresentation): string {
  for (const [k, v] of Object.entries(COMPONENT)) if (p.component === v) return k;
  return "unknown";
}

describe("presentationFor", () => {
  it("전환 이름 → 해당 presentation", () => {
    expect(nameOf(presentationFor("fade", DIMS))).toBe("fade");
    expect(nameOf(presentationFor("slide", DIMS))).toBe("slide");
    expect(nameOf(presentationFor("wipe", DIMS))).toBe("wipe");
    expect(nameOf(presentationFor("flip", DIMS))).toBe("flip");
    expect(nameOf(presentationFor("clockWipe", DIMS))).toBe("clockWipe");
    expect(nameOf(presentationFor("iris", DIMS))).toBe("iris");
    expect(nameOf(presentationFor("none", DIMS))).toBe("none");
  });

  it("clockWipe/iris는 composition width/height를 받는다(필수 인자)", () => {
    expect(presentationFor("clockWipe", DIMS).props).toMatchObject({ width: 1920, height: 1080 });
    expect(presentationFor("iris", DIMS).props).toMatchObject({ width: 1920, height: 1080 });
  });

  it("모든 전환 이름이 CSS-cheap 7종 (WebGL 0)", () => {
    (["fade", "slide", "wipe", "flip", "clockWipe", "iris", "none"] as const).forEach((n) =>
      expect(CHEAP.has(nameOf(presentationFor(n, DIMS)))).toBe(true),
    );
  });
});

// scene_id + 선택적 transition_in을 가진 그룹들. 각 shot이 서로 다른 visual → 단일 그룹.
function groupsFrom(specs: { scene: string; t?: string }[]) {
  const sb = StoryboardSchema.parse({
    meta: { fps: 30, width: 1920, height: 1080, transition: "varied" },
    shots: specs.map((s, i) => ({
      scene_id: s.scene,
      audio_ref: `a${i}.wav`,
      duration_sec: 2,
      broll_keywords: [],
      component: "TitleCard" as const,
      props: { title: `t${i}` },
      ...(s.t ? { transition_in: s.t } : {}),
    })),
  });
  return groupConsecutiveByVisual(sb);
}

describe("boundaryPresentations", () => {
  it("varied: CC가 정한 transition_in을 그대로 쓴다", () => {
    const groups = groupsFrom([
      { scene: "scene01" },
      { scene: "scene02", t: "clockWipe" },
      { scene: "scene03", t: "iris" },
    ]);
    expect(boundaryPresentations(groups, "varied", DIMS).map(nameOf)).toEqual([
      "clockWipe",
      "iris",
    ]);
  });

  it("varied: transition_in 생략 시 폴백 — cross=fade, within=컷(none placeholder)", () => {
    const groups = groupsFrom([
      { scene: "scene01" }, // g0
      { scene: "scene01" }, // g1: within 경계(생략) → 컷
      { scene: "scene02" }, // g2: cross 경계(생략) → fade
    ]);
    expect(boundaryPresentations(groups, "varied", DIMS).map(nameOf)).toEqual(["none", "fade"]);
  });

  it('varied: transition_in="none"이면 cross여도 명시적 컷', () => {
    const groups = groupsFrom([{ scene: "scene01" }, { scene: "scene02", t: "none" }]);
    expect(boundaryPresentations(groups, "varied", DIMS).map(nameOf)).toEqual(["none"]);
  });

  it('"fade"/"wipe" 정책은 모든 경계 단일 고정(back-compat)', () => {
    const groups = groupsFrom([
      { scene: "scene01" },
      { scene: "scene01" },
      { scene: "scene02", t: "iris" },
    ]);
    expect(boundaryPresentations(groups, "fade", DIMS).map(nameOf)).toEqual(["fade", "fade"]);
    expect(boundaryPresentations(groups, "wipe", DIMS).map(nameOf)).toEqual(["wipe", "wipe"]);
  });

  it("길이 = groups.length - 1", () => {
    expect(boundaryPresentations(groupsFrom([{ scene: "scene01" }]), "varied", DIMS)).toHaveLength(0);
    expect(
      boundaryPresentations(
        groupsFrom([{ scene: "scene01" }, { scene: "scene02" }, { scene: "scene03" }]),
        "varied",
        DIMS,
      ),
    ).toHaveLength(2);
  });
});
