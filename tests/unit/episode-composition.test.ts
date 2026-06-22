import { describe, expect, it } from "vitest";
import { StoryboardSchema } from "../../src/schemas/storyboard.js";
import {
  buildStockSegments,
  buildTransitionLayout,
  calculateTotalFrames,
  groupConsecutiveByVisual,
  OPENING_FADE_SEC,
  openingFadeEndFrame,
  openingFadeOpacity,
  resolveBoundaryTransitions,
  shotStartFrames,
} from "../../src/remotion/compositions/utils.js";
import { captionOpacity, CAPTION_FADE } from "../../src/remotion/scenes/_captions.js";

// Remotion 컴포넌트(JSX, useCurrentFrame)는 jsdom에서 직접 렌더 불안정 →
// 컴포지션 동작의 핵심인 frame 계산 유틸만 단위 테스트로 검증.
// 실제 렌더 검증은 `npx remotion preview`로 운영자가 수행.

const baseShot = {
  scene_id: "scene01",
  audio_ref: "assets/audio/scene01.wav",
  duration_sec: 2,
  broll_keywords: [],
  component: "TitleCard" as const,
  props: { title: "t" },
};

describe("Episode composition utils", () => {
  it("calculateTotalFrames sums duration_sec × fps with min-1 floor", () => {
    const sb = StoryboardSchema.parse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        { ...baseShot, scene_id: "scene01", duration_sec: 2 },
        { ...baseShot, scene_id: "scene02", duration_sec: 3.5 },
      ],
    });
    expect(calculateTotalFrames(sb)).toBe(60 + 105);
  });

  it("calculateTotalFrames floors sub-frame durations to 1 frame minimum", () => {
    const sb = StoryboardSchema.parse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [{ ...baseShot, duration_sec: 0.01 }],
    });
    expect(calculateTotalFrames(sb)).toBe(1);
  });

  it("shotStartFrames returns cumulative start frame per shot", () => {
    const sb = StoryboardSchema.parse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        { ...baseShot, scene_id: "scene01", duration_sec: 2 },
        { ...baseShot, scene_id: "scene02", duration_sec: 1 },
        { ...baseShot, scene_id: "scene03", duration_sec: 3 },
      ],
    });
    expect(shotStartFrames(sb)).toEqual([0, 60, 90]);
  });
});

// 연속 StockBg(photo) 2개 shot, 각 2초(60프레임) → 한 그룹으로 병합.
function stockGroup(durationsSec: number[]) {
  const sb = StoryboardSchema.parse({
    meta: { fps: 30, width: 1920, height: 1080 },
    shots: durationsSec.map((d, i) => ({
      scene_id: `scene${String(i + 1).padStart(2, "0")}`,
      audio_ref: `assets/audio/s${i}.wav`,
      duration_sec: d,
      broll_keywords: ["x"],
      component: "StockBg" as const,
      props: { kind: "photo" as const },
    })),
  });
  const groups = groupConsecutiveByVisual(sb);
  // 동일 props라 단일 그룹.
  return groups[0]!;
}

describe("buildStockSegments", () => {
  it("one asset per shot → one segment per shot span", () => {
    const group = stockGroup([2, 2]);
    const segs = buildStockSegments(group, { "0": ["a.jpg"], "1": ["b.jpg"] }, 30);
    expect(segs).toEqual([
      { src: "a.jpg", from: 0, durationInFrames: 60 },
      { src: "b.jpg", from: 60, durationInFrames: 60 },
    ]);
  });

  it("multiple assets on a long shot split the span by minHold", () => {
    const group = stockGroup([2, 2]);
    const segs = buildStockSegments(group, { "0": ["a", "b"], "1": ["c"] }, 20);
    expect(segs).toEqual([
      { src: "a", from: 0, durationInFrames: 30 },
      { src: "b", from: 30, durationInFrames: 30 },
      { src: "c", from: 60, durationInFrames: 60 },
    ]);
  });

  it("minHold caps the segment count (no clip shorter than minHold)", () => {
    const group = stockGroup([2]);
    // span 60, 3 assets, but minHold 60 → only 1 fits.
    const segs = buildStockSegments(group, { "0": ["a", "b", "c"] }, 60);
    expect(segs).toEqual([{ src: "a", from: 0, durationInFrames: 60 }]);
  });

  it("an asset-less span holds the previous asset", () => {
    const group = stockGroup([2, 2]);
    const segs = buildStockSegments(group, { "0": ["a"], "1": [] }, 30);
    expect(segs).toEqual([
      { src: "a", from: 0, durationInFrames: 60 },
      { src: "a", from: 60, durationInFrames: 60 },
    ]);
  });

  it("a leading asset-less span backfills from the first available asset", () => {
    const group = stockGroup([2, 2]);
    const segs = buildStockSegments(group, { "1": ["b"] }, 30);
    expect(segs).toEqual([
      { src: "b", from: 0, durationInFrames: 60 },
      { src: "b", from: 60, durationInFrames: 60 },
    ]);
  });

  it("returns empty when the whole group has no assets (caller falls back to LineCard)", () => {
    const group = stockGroup([2, 2]);
    expect(buildStockSegments(group, {}, 30)).toEqual([]);
  });
});

// 서로 다른 visual N개 → 각각 단일 그룹. (scene도 전부 다름 → 모든 경계가 cross-scene)
function distinctGroups(durationsSec: number[]) {
  const sb = StoryboardSchema.parse({
    meta: { fps: 30, width: 1920, height: 1080 },
    shots: durationsSec.map((d, i) => ({
      scene_id: `scene${String(i + 1).padStart(2, "0")}`,
      audio_ref: `assets/audio/s${i}.wav`,
      duration_sec: d,
      broll_keywords: [],
      component: "TitleCard" as const,
      props: { title: `t${i}` },
    })),
  });
  return { sb, groups: groupConsecutiveByVisual(sb) };
}

// scene_id(+선택적 transition_in)를 명시 지정해 경계를 제어. 각 shot은 서로 다른 visual(단일 그룹).
function scenedGroups(specs: { scene: string; dur: number; t?: string }[]) {
  const sb = StoryboardSchema.parse({
    meta: { fps: 30, width: 1920, height: 1080 },
    shots: specs.map((s, i) => ({
      scene_id: s.scene,
      audio_ref: `assets/audio/s${i}.wav`,
      duration_sec: s.dur,
      broll_keywords: [],
      component: "TitleCard" as const,
      props: { title: `t${i}` },
      ...(s.t ? { transition_in: s.t } : {}),
    })),
  });
  return { sb, groups: groupConsecutiveByVisual(sb) };
}

describe("buildTransitionLayout", () => {
  it("transition=none → no overlap, seqDuration == contentFrames", () => {
    const { groups } = distinctGroups([2, 2, 2]);
    const layout = buildTransitionLayout(groups, "none", 10);
    expect(layout.groups.map((g) => g.seqDuration)).toEqual([60, 60, 60]);
    expect(layout.groups.map((g) => g.transitionAfter)).toEqual([0, 0, 0]);
    expect(layout.totalFrames).toBe(180);
  });

  it("fade → extends each non-last seq by D and preserves total length", () => {
    const { sb, groups } = distinctGroups([2, 2, 2]);
    const layout = buildTransitionLayout(groups, "fade", 10);
    expect(layout.groups.map((g) => g.transitionAfter)).toEqual([10, 10, 0]);
    expect(layout.groups.map((g) => g.seqDuration)).toEqual([70, 70, 60]);
    // 총 길이는 전환과 무관하게 보존 (calculateTotalFrames와 동일).
    expect(layout.totalFrames).toBe(calculateTotalFrames(sb));
  });

  it("group absolute starts stay aligned with non-overlapped content starts", () => {
    const { sb, groups } = distinctGroups([2, 2, 2]);
    const layout = buildTransitionLayout(groups, "fade", 10);
    // TransitionSeries 내 그룹 i 시작 = ∑_{k<i} seqDuration_k − ∑_{k<i} D_k.
    let acc = 0;
    let dSum = 0;
    const starts = layout.groups.map((g) => {
      const start = acc - dSum;
      acc += g.seqDuration;
      dSum += g.transitionAfter;
      return start;
    });
    // 원래 절대 시작(겹침 없는 콘텐츠 누적)과 정렬되어야 한다.
    expect(starts).toEqual(shotStartFrames(sb));
  });

  it("clamps D so a short group is not consumed by the transition", () => {
    // frames [6, 60]: D0 = min(10, floor(6/2)=3, floor(60/2)=30) = 3.
    const { groups } = distinctGroups([0.2, 2]);
    const layout = buildTransitionLayout(groups, "fade", 10);
    expect(layout.groups.map((g) => g.contentFrames)).toEqual([6, 60]);
    expect(layout.groups.map((g) => g.transitionAfter)).toEqual([3, 0]);
    expect(layout.groups.map((g) => g.seqDuration)).toEqual([9, 60]);
  });

  // "varied"는 전환을 scene(섹션) 경계에만 둔다 — 같은 scene 안 비주얼 교체는 하드 컷.
  // 전환 남발 방지. fade/wipe는 모든 경계 적용(기존 동작).
  it('"varied" transitions only at cross-scene boundaries (within-scene = 하드 컷)', () => {
    // scene01,01 | scene02,02 | scene03 → 경계: within, cross, within, cross.
    const { groups } = scenedGroups([
      { scene: "scene01", dur: 2 },
      { scene: "scene01", dur: 2 },
      { scene: "scene02", dur: 2 },
      { scene: "scene02", dur: 2 },
      { scene: "scene03", dur: 2 },
    ]);
    const varied = buildTransitionLayout(groups, "varied", 10);
    // within 경계(0,2)는 tail 0(컷), cross 경계(1,3)만 전환.
    expect(varied.groups.map((g) => g.transitionAfter)).toEqual([0, 10, 0, 10, 0]);
    // fade는 모든 경계에 전환(대조군).
    const fade = buildTransitionLayout(groups, "fade", 10);
    expect(fade.groups.map((g) => g.transitionAfter)).toEqual([10, 10, 10, 10, 0]);
  });

  // [CRITICAL-REGRESSION] 전환을 어디 두든 총 길이는 보존돼야 오디오·자막 sync가 유지된다
  // (TODOS T2: "전환 overlap이 오디오 타이밍 보존 로직과 충돌 안 하는지 회귀 테스트").
  it('"varied" preserves total length = sync 보존 (전환 위치 무관)', () => {
    const { sb, groups } = scenedGroups([
      { scene: "scene01", dur: 2 },
      { scene: "scene01", dur: 1 },
      { scene: "scene02", dur: 3 },
      { scene: "scene02", dur: 2 },
      { scene: "scene03", dur: 2 },
    ]);
    const varied = buildTransitionLayout(groups, "varied", 10);
    expect(varied.totalFrames).toBe(calculateTotalFrames(sb));
  });

  // 모든 경계가 cross-scene이면 varied tail 패턴 == fade (전환이 빠지는 within 경계가 없음).
  it('"varied" with all cross-scene boundaries matches "fade" tails', () => {
    const { groups } = distinctGroups([2, 1, 3, 2, 2]);
    const varied = buildTransitionLayout(groups, "varied", 10);
    const fade = buildTransitionLayout(groups, "fade", 10);
    expect(varied.groups.map((g) => g.transitionAfter)).toEqual(
      fade.groups.map((g) => g.transitionAfter),
    );
  });

  // CC가 transition_in을 명시하면 그게 tail 유무를 결정한다 (폴백을 덮어씀).
  it("varied: explicit transition_in drives the tail (cut/transition 모두 override)", () => {
    const { groups } = scenedGroups([
      { scene: "scene01", dur: 2 },
      // within 경계지만 CC가 fade로 명시 → tail 생김.
      { scene: "scene01", dur: 2, t: "fade" },
      // cross 경계지만 CC가 컷("none")으로 명시 → tail 0.
      { scene: "scene02", dur: 2, t: "none" },
      // cross 경계, CC가 iris 명시 → tail.
      { scene: "scene03", dur: 2, t: "iris" },
    ]);
    expect(buildTransitionLayout(groups, "varied", 10).groups.map((g) => g.transitionAfter)).toEqual(
      [10, 0, 10, 0],
    );
  });
});

describe("resolveBoundaryTransitions", () => {
  it('"none" 정책은 전부 컷(null)', () => {
    const { groups } = scenedGroups([
      { scene: "scene01", dur: 2 },
      { scene: "scene02", dur: 2 },
    ]);
    expect(resolveBoundaryTransitions(groups, "none")).toEqual([null]);
  });

  it('"fade"/"wipe" 정책은 모든 경계 단일 고정', () => {
    const { groups } = scenedGroups([
      { scene: "scene01", dur: 2 },
      { scene: "scene01", dur: 2 },
      { scene: "scene02", dur: 2 },
    ]);
    expect(resolveBoundaryTransitions(groups, "fade")).toEqual(["fade", "fade"]);
    expect(resolveBoundaryTransitions(groups, "wipe")).toEqual(["wipe", "wipe"]);
  });

  it("varied: transition_in 우선, 생략 시 cross=fade / within=null", () => {
    const { groups } = scenedGroups([
      { scene: "scene01", dur: 2 }, // g0
      { scene: "scene01", dur: 2 }, // g1: within 생략 → null
      { scene: "scene02", dur: 2, t: "wipe" }, // g2: 명시 wipe
      { scene: "scene03", dur: 2 }, // g3: cross 생략 → fade
    ]);
    expect(resolveBoundaryTransitions(groups, "varied")).toEqual([null, "wipe", "fade"]);
  });

  it('varied: transition_in="none"은 cross여도 null(컷)', () => {
    const { groups } = scenedGroups([
      { scene: "scene01", dur: 2 },
      { scene: "scene02", dur: 2, t: "none" },
    ]);
    expect(resolveBoundaryTransitions(groups, "varied")).toEqual([null]);
  });
});

// 오프닝 마스터 페이드업 — frame 0 검정 → end 프레임에서 1, 이후 clamp.
describe("openingFadeOpacity", () => {
  it("frame 0 → 0, end(=round(sec*fps)) → 1, 이후 clamp 1", () => {
    expect(openingFadeOpacity(0, 30, 0.5)).toBe(0);
    expect(openingFadeOpacity(15, 30, 0.5)).toBe(1); // round(0.5*30)=15
    expect(openingFadeOpacity(30, 30, 0.5)).toBe(1); // 이후 무영향
    expect(openingFadeOpacity(7, 30, 0.5)).toBeCloseTo(7 / 15, 5);
  });

  it("음수 프레임은 좌측 clamp 0", () => {
    expect(openingFadeOpacity(-5, 30, 0.5)).toBe(0);
  });

  it("sec=0이어도 0폭 입력 없이 안전(end 최소 1)", () => {
    expect(openingFadeOpacity(0, 30, 0)).toBe(0);
    expect(openingFadeOpacity(1, 30, 0)).toBe(1);
  });

  it("openingFadeEndFrame = round(sec*fps), 기본 sec=OPENING_FADE_SEC", () => {
    expect(OPENING_FADE_SEC).toBe(0.5);
    expect(openingFadeEndFrame(30)).toBe(15);
    expect(openingFadeEndFrame(24, 0.5)).toBe(12);
  });
});

// 자막 침묵-경계 페이드 + 짧은 cue clamp.
describe("captionOpacity", () => {
  it("연속 자막(앞뒤 텍스트 있음)은 하드 컷 = 항상 1", () => {
    const o = (frame: number) =>
      captionOpacity({ frame, startFrame: 0, endFrame: 120, gapBefore: false, gapAfter: false });
    expect(o(0)).toBe(1);
    expect(o(3)).toBe(1);
    expect(o(60)).toBe(1);
    expect(o(119)).toBe(1);
  });

  it("첫 자막(gapBefore)은 [start, start+CAPTION_FADE] 페이드인, 끝은 컷", () => {
    const args = { startFrame: 0, endFrame: 120, gapBefore: true, gapAfter: false };
    expect(captionOpacity({ ...args, frame: 0 })).toBe(0);
    expect(captionOpacity({ ...args, frame: CAPTION_FADE / 2 })).toBeCloseTo(0.5, 5);
    expect(captionOpacity({ ...args, frame: CAPTION_FADE })).toBe(1);
    expect(captionOpacity({ ...args, frame: 119 })).toBe(1); // gapAfter=false → 끝 컷
  });

  it("마지막 자막(gapAfter)은 [end-CAPTION_FADE, end] 페이드아웃, 시작은 컷", () => {
    const args = { startFrame: 0, endFrame: 120, gapBefore: false, gapAfter: true };
    expect(captionOpacity({ ...args, frame: 0 })).toBe(1); // gapBefore=false → 시작 컷
    expect(captionOpacity({ ...args, frame: 120 - CAPTION_FADE })).toBe(1);
    expect(captionOpacity({ ...args, frame: 120 - CAPTION_FADE / 2 })).toBeCloseTo(0.5, 5);
    expect(captionOpacity({ ...args, frame: 120 })).toBe(0);
  });

  it("짧은 고립 cue(span < 2*fade)도 clamp 덕에 full opacity에 도달한다", () => {
    // span 8 < 12 → fade=floor(8/2)=4. 중앙(frame 4)에서 fadeIn=fadeOut=1 → 1.
    const args = { startFrame: 0, endFrame: 8, gapBefore: true, gapAfter: true };
    expect(captionOpacity({ ...args, frame: 0 })).toBe(0);
    expect(captionOpacity({ ...args, frame: 4 })).toBe(1);
    expect(captionOpacity({ ...args, frame: 8 })).toBe(0);
  });

  it("span<2(또는 0)는 fade=0으로 떨어져 즉시 full opacity(0폭 입력 회피)", () => {
    expect(
      captionOpacity({ frame: 0, startFrame: 0, endFrame: 1, gapBefore: true, gapAfter: true }),
    ).toBe(1);
    expect(
      captionOpacity({ frame: 5, startFrame: 5, endFrame: 5, gapBefore: true, gapAfter: true }),
    ).toBe(1);
  });
});
