import { describe, it, expect } from "vitest";
import { ScriptSchema } from "../../src/schemas/script.js";

describe("ScriptSchema", () => {
  it("accepts minimal line (no visual, no broll)", () => {
    const result = ScriptSchema.safeParse({
      lines: [{ id: "scene01-line01", text: "안녕하세요." }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines[0]?.broll_keywords).toEqual([]);
    }
  });

  it("accepts a line with a TitleCard visual", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene01-line01",
          text: "오늘은 RICE 이야기를 해보겠습니다.",
          visual: {
            component: "TitleCard",
            props: { title: "RICE의 함정", subtitle: "왜 점수를 믿으면 안 되는가" },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts BulletList with items in range", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene02-line01",
          text: "함정은 셋입니다.",
          visual: {
            component: "BulletList",
            props: { items: ["Reach 추정", "Confidence 누락", "Effort 왜곡"] },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects BulletList with only 1 item", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene02-line01",
          text: "...",
          visual: { component: "BulletList", props: { items: ["하나뿐"] } },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects line id that escapes the safe charset (path traversal)", () => {
    for (const badId of ["../etc/passwd", "a/b", ".", "scene 01", ""]) {
      const result = ScriptSchema.safeParse({
        lines: [{ id: badId, text: "x" }],
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects StockBg with invalid fallback_color", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene03-line01",
          text: "배경입니다.",
          visual: {
            component: "StockBg",
            props: { kind: "color", fallback_color: "midnight" },
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts HeroImage and applies kind/overlay defaults", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene04-line01",
          text: "이게 실제 화면입니다.",
          visual: {
            component: "HeroImage",
            props: { title: "디스커버리 보드", caption: "한 화면에 모인 인터뷰" },
          },
          broll_keywords: ["product roadmap board"],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const v = result.data.lines[0]?.visual;
      if (v?.component === "HeroImage") {
        expect(v.props.kind).toBe("photo");
        expect(v.props.overlay).toBe("bottom");
      }
    }
  });

  it("accepts SplitVisual with items and defaults image_side to right", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene04-line02",
          text: "인터뷰는 세 가지를 봅니다.",
          visual: {
            component: "SplitVisual",
            props: { heading: "무엇을 듣는가", items: ["행동", "감정", "맥락"] },
          },
          broll_keywords: ["user interview notes"],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const v = result.data.lines[0]?.visual;
      if (v?.component === "SplitVisual") {
        expect(v.props.image_side).toBe("right");
      }
    }
  });

  it("rejects SplitVisual with more than 5 items", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene04-line03",
          text: "...",
          visual: {
            component: "SplitVisual",
            props: { items: ["1", "2", "3", "4", "5", "6"] },
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts ScreenshotCallout and applies frame/fit defaults", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene05-line01",
          text: "이게 Linear의 실제 보드입니다.",
          visual: {
            component: "ScreenshotCallout",
            props: {
              title: "Linear 보드",
              annotations: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.15, label: "우선순위" }],
            },
          },
          image_ref: "linear-board.png",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const v = result.data.lines[0]?.visual;
      if (v?.component === "ScreenshotCallout") {
        expect(v.props.frame).toBe("browser");
        expect(v.props.fit).toBe("contain");
      }
      expect(result.data.lines[0]?.image_ref).toBe("linear-board.png");
    }
  });

  it("rejects ScreenshotCallout with more than 4 annotations", () => {
    const ann = { x: 0.1, y: 0.1, w: 0.1, h: 0.1 };
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene05-line02",
          text: "...",
          visual: {
            component: "ScreenshotCallout",
            props: { annotations: [ann, ann, ann, ann, ann] },
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects ScreenshotCallout annotation coords outside 0..1", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene05-line03",
          text: "...",
          visual: {
            component: "ScreenshotCallout",
            props: { annotations: [{ x: 1.5, y: 0.2, w: 0.3, h: 0.1 }] },
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts FlowDiagram and applies orientation/connector defaults", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene07-line01",
          text: "인지에서 전환까지 흐름입니다.",
          visual: {
            component: "FlowDiagram",
            props: {
              heading: "전환 퍼널",
              nodes: [{ label: "인지" }, { label: "관심", sublabel: "콘텐츠" }, { label: "전환" }],
            },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const v = result.data.lines[0]?.visual;
      if (v?.component === "FlowDiagram") {
        expect(v.props.orientation).toBe("vertical");
        expect(v.props.connector).toBe("arrow");
      }
    }
  });

  it("rejects FlowDiagram with <2 or >6 nodes", () => {
    const mk = (count: number) =>
      ScriptSchema.safeParse({
        lines: [
          {
            id: "scene07-line02",
            text: "...",
            visual: {
              component: "FlowDiagram",
              props: { nodes: Array.from({ length: count }, (_, i) => ({ label: `n${i}` })) },
            },
          },
        ],
      });
    expect(mk(1).success).toBe(false);
    expect(mk(2).success).toBe(true);
    expect(mk(6).success).toBe(true);
    expect(mk(7).success).toBe(false);
  });

  it("accepts PixelBarChart visual with bars (highlightIndex optional)", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene08-line01",
          text: "활성 사용자가 올랐습니다.",
          visual: {
            component: "PixelBarChart",
            props: {
              heading: "주간 활성 사용자",
              bars: [{ label: "1주", value: 12 }, { label: "2주", value: 34 }],
            },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts PixelGauge and applies max default of 10", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene08-line02",
          text: "역량 점수입니다.",
          visual: { component: "PixelGauge", props: { label: "역량", value: 7 } },
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const v = result.data.lines[0]?.visual;
      if (v?.component === "PixelGauge") expect(v.props.max).toBe(10);
    }
  });

  it("rejects PixelGauge with value greater than max", () => {
    const result = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene08-line03",
          text: "...",
          visual: { component: "PixelGauge", props: { value: 12, max: 10 } },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects PixelStepTracker / PixelRoadmap with currentIndex out of range", () => {
    const step = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene08-line04",
          text: "...",
          visual: {
            component: "PixelStepTracker",
            props: { steps: ["발견", "정의", "설계"], currentIndex: 3 },
          },
        },
      ],
    });
    expect(step.success).toBe(false);

    const road = ScriptSchema.safeParse({
      lines: [
        {
          id: "scene08-line05",
          text: "...",
          visual: {
            component: "PixelRoadmap",
            props: { milestones: [{ label: "a" }, { label: "b" }], currentIndex: 2 },
          },
        },
      ],
    });
    expect(road.success).toBe(false);
  });

  it("accepts a safe image_ref but rejects path traversal / absolute / no-extension", () => {
    const ok = ScriptSchema.safeParse({
      lines: [{ id: "scene06-line01", text: "x", image_ref: "ui/dashboard-v2.png" }],
    });
    expect(ok.success).toBe(true);

    for (const bad of ["../secrets.png", "/etc/passwd.png", "a/../b.png", "noext", "logo.png/../x"]) {
      const result = ScriptSchema.safeParse({
        lines: [{ id: "scene06-line02", text: "x", image_ref: bad }],
      });
      expect(result.success, `image_ref "${bad}" should be rejected`).toBe(false);
    }
  });
});
