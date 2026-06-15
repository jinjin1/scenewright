import { describe, it, expect } from "vitest";
import { StoryboardSchema } from "../../src/schemas/storyboard.js";

describe("StoryboardSchema", () => {
  const validShot = {
    scene_id: "scene01",
    component: "TitleCard" as const,
    props: { title: "RICE의 함정" },
    audio_ref: "assets/audio/scene01-line01.wav",
    duration_sec: 4.2,
  };

  it("accepts storyboard with meta defaults filled", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [validShot],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meta.transition).toBe("fade");
      expect(result.data.meta.bgm_id).toBeNull();
      expect(result.data.shots[0]?.broll_keywords).toEqual([]);
    }
  });

  it("rejects shot with mismatched component/props discriminator", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          ...validShot,
          component: "BulletList",
          props: { title: "wrong" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts StockBg shot with broll_keywords", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          scene_id: "scene02",
          component: "StockBg",
          props: { kind: "video", fallback_color: "#101820" },
          audio_ref: "assets/audio/scene02-line01.wav",
          duration_sec: 6,
          broll_keywords: ["startup office", "team meeting"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts HeroImage and SplitVisual shots with broll_keywords", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          scene_id: "scene03",
          component: "HeroImage",
          props: { title: "실제 화면", overlay: "bottom" },
          audio_ref: "assets/audio/scene03-line01.wav",
          duration_sec: 5,
          broll_keywords: ["analytics dashboard ui"],
        },
        {
          scene_id: "scene03",
          component: "SplitVisual",
          props: { heading: "무엇을 듣는가", items: ["행동", "맥락"], image_side: "left" },
          audio_ref: "assets/audio/scene03-line02.wav",
          duration_sec: 5,
          broll_keywords: ["user interview"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts ScreenshotCallout shot with image_ref and annotations", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          scene_id: "scene04",
          component: "ScreenshotCallout",
          props: {
            title: "Linear 보드",
            frame: "browser",
            annotations: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.15, label: "우선순위" }],
          },
          audio_ref: "assets/audio/scene04-line01.wav",
          duration_sec: 6,
          broll_keywords: [],
          image_ref: "linear-board.png",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shots[0]?.image_ref).toBe("linear-board.png");
    }
  });

  it("accepts FlowDiagram shot with nodes", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          scene_id: "scene05",
          component: "FlowDiagram",
          props: {
            orientation: "horizontal",
            nodes: [{ label: "수집" }, { label: "가설" }, { label: "실험" }],
          },
          audio_ref: "assets/audio/scene05-line01.wav",
          duration_sec: 6,
          broll_keywords: [],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const shot = result.data.shots[0];
      if (shot?.component === "FlowDiagram") {
        expect(shot.props.nodes).toHaveLength(3);
      }
    }
  });

  it("accepts PixelBarChart shot with bars", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          scene_id: "scene06",
          component: "PixelBarChart",
          props: {
            heading: "주간 활성 사용자",
            bars: [
              { label: "1월", value: 1200 },
              { label: "2월", value: 1800 },
              { label: "3월", value: 3400 },
            ],
            highlightIndex: 2,
          },
          audio_ref: "assets/audio/scene06-line01.wav",
          duration_sec: 5,
          broll_keywords: [],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const shot = result.data.shots[0];
      if (shot?.component === "PixelBarChart") {
        expect(shot.props.bars).toHaveLength(3);
        expect(shot.props.highlightIndex).toBe(2);
      }
    }
  });

  it("rejects PixelBarChart shot with a single bar", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          scene_id: "scene06",
          component: "PixelBarChart",
          props: { bars: [{ value: 5 }] },
          audio_ref: "assets/audio/scene06-line02.wav",
          duration_sec: 4,
          broll_keywords: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts PixelDonut / PixelGauge / PixelStepTracker / PixelRoadmap shots", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          scene_id: "scene07",
          component: "PixelDonut",
          props: { percent: 73, caption: "목표 달성률" },
          audio_ref: "assets/audio/scene07-line01.wav",
          duration_sec: 5,
          broll_keywords: [],
        },
        {
          scene_id: "scene07",
          component: "PixelGauge",
          props: { label: "팀 역량", value: 7 },
          audio_ref: "assets/audio/scene07-line02.wav",
          duration_sec: 4,
          broll_keywords: [],
        },
        {
          scene_id: "scene07",
          component: "PixelStepTracker",
          props: { steps: ["발견", "정의", "설계", "개발"], currentIndex: 2 },
          audio_ref: "assets/audio/scene07-line03.wav",
          duration_sec: 5,
          broll_keywords: [],
        },
        {
          scene_id: "scene07",
          component: "PixelRoadmap",
          props: {
            milestones: [{ label: "발견" }, { label: "설계" }, { label: "출시" }],
            currentIndex: 1,
          },
          audio_ref: "assets/audio/scene07-line04.wav",
          duration_sec: 6,
          broll_keywords: [],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const gauge = result.data.shots[1];
      if (gauge?.component === "PixelGauge") {
        expect(gauge.props.max).toBe(10); // default
      }
    }
  });

  it("rejects PixelDonut with out-of-range percent", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          scene_id: "scene07",
          component: "PixelDonut",
          props: { percent: 140 },
          audio_ref: "assets/audio/scene07-line05.wav",
          duration_sec: 4,
          broll_keywords: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects shot image_ref with path traversal", () => {
    const result = StoryboardSchema.safeParse({
      meta: { fps: 30, width: 1920, height: 1080 },
      shots: [
        {
          scene_id: "scene04",
          component: "ScreenshotCallout",
          props: { title: "x" },
          audio_ref: "assets/audio/scene04-line02.wav",
          duration_sec: 4,
          broll_keywords: [],
          image_ref: "../../etc/passwd.png",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
