import { describe, expect, it } from "vitest";
import {
  analyzeDiversity,
  analyzeSceneLength,
  lintScript,
  summarize,
  type Finding,
} from "../../src/pipeline/script-lint.js";
import { ScriptSchema, type Script } from "../../src/schemas/script.js";
import { TreatmentSchema } from "../../src/schemas/treatment.js";

// 한 라인짜리 script를 schema로 검증해 만든다(실제 파이프라인과 동일 입력 형태).
function oneLine(line: Record<string, unknown>): Script {
  return ScriptSchema.parse({ lines: [{ broll_keywords: [], ...line }] });
}

function rules(findings: Finding[]): string[] {
  return findings.map((f) => f.rule);
}

describe("analyzeSceneLength — 씬별 분량 결정적 점검", () => {
  const treatment = TreatmentSchema.parse({
    scenes: [
      { id: "scene01", beat: "Opening", purpose: "도입부 후킹", duration_sec: 10, visual_concept: "타이틀" },
      { id: "scene02", beat: "Body", purpose: "본론 설명", duration_sec: 100, visual_concept: "리스트" },
      { id: "scene03", beat: "Closing", purpose: "마무리 정리", duration_sec: 10, visual_concept: "엔딩 카드" },
    ],
  });

  function scriptOf(lines: { id: string; text: string }[]): Script {
    return ScriptSchema.parse({
      lines: lines.map((l) => ({
        broll_keywords: [],
        visual: { component: "BulletList", props: { items: ["가", "나"] } },
        ...l,
      })),
    });
  }

  it("씬별 글자수를 예산(duration_sec×9)과 대조하고 미달 씬을 플래그한다", () => {
    // scene01 예산 90자, 충족(90자). scene02 예산 900자, 미달(20자).
    const r = analyzeSceneLength(
      scriptOf([
        { id: "scene01-line01", text: "가".repeat(90) }, // 예산 90, 충족
        { id: "scene02-line01", text: "나".repeat(20) }, // 예산 900, 미달
        { id: "scene03-line01", text: "다".repeat(90) }, // 예산 90, 충족
      ]),
      treatment,
    );
    expect(r.applies).toBe(true);
    const s1 = r.rows.find((x) => x.sceneId === "scene01")!;
    const s2 = r.rows.find((x) => x.sceneId === "scene02")!;
    expect(s1.budget).toBe(90);
    expect(s1.chars).toBe(90);
    expect(s1.underBudget).toBe(false);
    expect(s2.budget).toBe(900);
    expect(s2.chars).toBe(20);
    expect(s2.underBudget).toBe(true);
    expect(r.underBudgetCount).toBe(1);
  });

  it("여러 라인의 글자수를 씬별로 합산한다", () => {
    const r = analyzeSceneLength(
      scriptOf([
        { id: "scene01-line01", text: "가".repeat(50) },
        { id: "scene01-line02", text: "가".repeat(50) },
      ]),
      treatment,
    );
    const s1 = r.rows.find((x) => x.sceneId === "scene01")!;
    expect(s1.chars).toBe(100);
    expect(s1.lines).toBe(2);
    expect(s1.underBudget).toBe(false); // 100 ≥ 90
  });

  it("라인이 없는 씬은 emptyScenes로, 90% 미달이라 underBudget으로 잡는다", () => {
    const r = analyzeSceneLength(
      scriptOf([{ id: "scene01-line01", text: "가".repeat(90) }]),
      treatment,
    );
    expect(r.emptyScenes).toContain("scene02");
    expect(r.rows.find((x) => x.sceneId === "scene02")!.underBudget).toBe(true);
  });

  it("treatment 씬에 없는 접두사의 라인은 orphanLines로 센다", () => {
    const r = analyzeSceneLength(
      scriptOf([
        { id: "scene01-line01", text: "가".repeat(90) },
        { id: "scene99-line01", text: "다".repeat(10) },
      ]),
      treatment,
    );
    expect(r.orphanLines).toBe(1);
  });
});

describe("lintScript — orphan highlights (silent render failure)", () => {
  it("flags a highlight that is not a substring of text", () => {
    const s = oneLine({
      id: "l1",
      text: "깨끗한 내레이션입니다.",
      visual: {
        component: "HighlightedLine",
        props: { text: "고객 인터뷰는 잘못되기 쉽다", highlights: ["잘못되기", "우리의 일"] },
      },
    });
    const f = lintScript(s).filter((x) => x.rule === "orphan-highlight");
    expect(f).toHaveLength(1);
    expect(f[0]!.snippet).toBe("우리의 일");
    expect(f[0]!.severity).toBe("error");
  });

  it("does not flag highlights that are substrings of text", () => {
    const s = oneLine({
      id: "l1",
      text: "깨끗한 내레이션입니다.",
      visual: {
        component: "HighlightedLine",
        props: { text: "고객 인터뷰는 잘못되기 쉽다", highlights: ["잘못되기", "쉽다"] },
      },
    });
    expect(rules(lintScript(s))).not.toContain("orphan-highlight");
  });
});

describe("lintScript — screen english", () => {
  it("flags Latin text in a TitleCard title", () => {
    const s = oneLine({
      id: "l1",
      text: "안녕하세요.",
      visual: { component: "TitleCard", props: { title: "The Mom Test" } },
    });
    const f = lintScript(s).filter((x) => x.rule === "screen-english");
    expect(f).toHaveLength(1);
    expect(f[0]!.where).toBe("visual:TitleCard.title");
  });

  it("exempts PixelTitle (English-by-design signature)", () => {
    const s = oneLine({
      id: "l1",
      text: "안녕하세요.",
      visual: { component: "PixelTitle", props: { label: "PMVIDEO" } },
    });
    expect(rules(lintScript(s))).not.toContain("screen-english");
  });

  it("exempts decorative eyebrow kickers (Chapter 01 etc.) to avoid alert fatigue", () => {
    const s = oneLine({
      id: "l1",
      text: "안녕하세요.",
      visual: { component: "TitleCard", props: { title: "엄마 테스트", eyebrow: "Book Review 01" } },
    });
    // eyebrow English is decorative → not flagged; a Korean title with no Latin → no flag.
    expect(rules(lintScript(s))).not.toContain("screen-english");
  });
});

describe("lintScript — untransliterated abbreviations (TTS pronunciation)", () => {
  it("warns on an abbreviation missing from the transliteration map", () => {
    const s = oneLine({ id: "l1", text: "JTBD가 핵심입니다." });
    const f = lintScript(s).filter((x) => x.rule === "untransliterated-abbrev");
    expect(f).toHaveLength(1);
    expect(f[0]!.snippet).toBe("JTBD");
    expect(f[0]!.severity).toBe("warn");
  });

  it("does not flag abbreviations already in the map (RICE)", () => {
    const s = oneLine({ id: "l1", text: "RICE 점수를 계산합니다." });
    expect(rules(lintScript(s))).not.toContain("untransliterated-abbrev");
  });

  it("treats slash-composed abbreviations as covered when both parts are mapped (UX/UI)", () => {
    const s = oneLine({ id: "l1", text: "UX/UI를 다듬습니다." });
    expect(rules(lintScript(s))).not.toContain("untransliterated-abbrev");
  });

  it("flags a stray English proper noun as info (needs 음차)", () => {
    const s = oneLine({ id: "l1", text: "Notion에서 관리합니다." });
    const f = lintScript(s).filter((x) => x.rule === "untransliterated-abbrev");
    expect(f).toHaveLength(1);
    expect(f[0]!.snippet).toBe("Notion");
    expect(f[0]!.severity).toBe("info");
  });
});

describe("lintScript — translationese candidates", () => {
  it('flags "have" 직역 and double-passive', () => {
    const s1 = oneLine({ id: "l1", text: "권한을 가지는 사람이 결정합니다." });
    const s2 = oneLine({ id: "l2", text: "그 일은 자동으로 처리되어진다." });
    expect(rules(lintScript(s1))).toContain("translationese");
    expect(rules(lintScript(s2))).toContain("translationese");
  });

  it("does not flag natural Korean", () => {
    const s = oneLine({ id: "l1", text: "사용자에게 직접 물어보는 게 제일 빠릅니다." });
    expect(rules(lintScript(s))).not.toContain("translationese");
  });
});

describe("lintScript — sentence-end / TTS-cut risk", () => {
  it("warns on a very long line", () => {
    const long = "사용자 인터뷰를 진행할 때는 ".repeat(8) + "주의해야 합니다.";
    const f = lintScript(oneLine({ id: "l1", text: long })).filter((x) => x.rule === "sentence-end");
    expect(f.some((x) => x.severity === "warn")).toBe(true);
  });

  it("warns when a sentence ends in English (cut risk)", () => {
    const f = lintScript(oneLine({ id: "l1", text: "이 프레임워크의 이름은 RICE" })).filter(
      (x) => x.rule === "sentence-end",
    );
    expect(f.some((x) => x.severity === "warn")).toBe(true);
  });

  it("does not flag a clean sentence ending in 다/요", () => {
    const f = lintScript(oneLine({ id: "l1", text: "그래서 직접 물어봐야 합니다." })).filter(
      (x) => x.rule === "sentence-end",
    );
    expect(f).toHaveLength(0);
  });
});

describe("lintScript — TTS truncation risk (short line + risky ending)", () => {
  it("flags a short line ending in copula 입니다", () => {
    const f = lintScript(oneLine({ id: "l1", text: "두 번째 차원, 활동 영역입니다." })).filter(
      (x) => x.rule === "tts-truncation-risk",
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe("warn");
  });

  it("flags a short line ending in 세요", () => {
    expect(rules(lintScript(oneLine({ id: "l1", text: "이 세 가지를 점검해 보세요." })))).toContain(
      "tts-truncation-risk",
    );
  });

  it("does NOT flag the robust fix ending (~살펴보겠습니다)", () => {
    const s = oneLine({ id: "l1", text: "이번엔 두 번째 차원, 활동 영역을 살펴보겠습니다." });
    expect(rules(lintScript(s))).not.toContain("tts-truncation-risk");
  });

  it("does NOT flag a long line even if it ends in 어요", () => {
    const s = oneLine({
      id: "l1",
      text: "시티플로우 리더십은 먼저 회사 비전을 천천히 들여다보는 데서 출발했어요.",
    });
    expect(rules(lintScript(s))).not.toContain("tts-truncation-risk");
  });
});

describe("lintScript — cliche keyword (b-roll 진부함)", () => {
  function withKeywords(keywords: string[]): Script {
    return oneLine({
      id: "l1",
      text: "이건 한 줄짜리 내레이션입니다.",
      visual: { component: "StockBg", props: { kind: "video" } },
      broll_keywords: keywords,
    });
  }

  it("flags a textbook cliché keyword (business handshake)", () => {
    const f = lintScript(withKeywords(["business handshake"])).filter(
      (x) => x.rule === "cliche-keyword",
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe("warn");
    expect(f[0]!.snippet).toBe("business handshake");
    expect(f[0]!.where).toBe("broll_keywords");
  });

  it("flags assorted known clichés", () => {
    for (const kw of [
      "team collaboration",
      "diverse team smiling at laptop",
      "glowing lightbulb",
      "puzzle pieces",
      "stacking hands together",
      "abstract digital network",
      "3d arrow going up",
    ]) {
      expect(rules(lintScript(withKeywords([kw])))).toContain("cliche-keyword");
    }
  });

  it("does NOT flag concrete scene keywords", () => {
    for (const kw of [
      "runner crossing a finish line",
      "seedling trays under grow lights",
      "barista restocking shelves",
      "programmer reviewing code at night",
      "open door into a bright room",
    ]) {
      expect(rules(lintScript(withKeywords([kw])))).not.toContain("cliche-keyword");
    }
  });

  it("reports each cliché keyword in a line separately (and skips concrete ones)", () => {
    const f = lintScript(
      withKeywords(["business handshake", "team collaboration", "runner crossing a finish line"]),
    ).filter((x) => x.rule === "cliche-keyword");
    expect(f).toHaveLength(2);
  });

  it("does NOT flag when broll_keywords is empty", () => {
    expect(rules(lintScript(withKeywords([])))).not.toContain("cliche-keyword");
  });
});

describe("lintScript — weak opening (콜드 오픈 게이트)", () => {
  // 여러 라인 스크립트(첫 라인만 검사하는지 확인용).
  function multi(lines: Record<string, unknown>[]): Script {
    return ScriptSchema.parse({ lines: lines.map((l) => ({ broll_keywords: [], ...l })) });
  }
  const SCENE = "버튼 색 하나 바꿨더니 가입률이 올랐습니다.";

  it("flags greeting-first narration (인사가 첫 마디)", () => {
    const s = oneLine({
      id: "s1l1",
      text: "안녕하세요. 이번 영상은 A/B 테스트를 풀어보려고 합니다.",
      visual: { component: "StockBg", props: { kind: "video" } },
    });
    const f = lintScript(s).filter((x) => x.rule === "weak-opening");
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe("warn");
    expect(f[0]!.where).toBe("narration");
  });

  it("flags TitleCard as the first shot (정적 제목 카드)", () => {
    const s = oneLine({
      id: "s1l1",
      text: SCENE,
      visual: { component: "TitleCard", props: { title: "A/B 테스트" } },
    });
    const f = lintScript(s).filter((x) => x.rule === "weak-opening");
    expect(f).toHaveLength(1);
    expect(f[0]!.where).toBe("visual:TitleCard");
  });

  it("flags BOTH sides when greeting + TitleCard", () => {
    const s = oneLine({
      id: "s1l1",
      text: "안녕하세요. 이번 영상은 A/B 테스트입니다.",
      visual: { component: "TitleCard", props: { title: "A/B 테스트" } },
    });
    const f = lintScript(s).filter((x) => x.rule === "weak-opening");
    expect(f).toHaveLength(2);
    expect(f.map((x) => x.where).sort()).toEqual(["narration", "visual:TitleCard"]);
  });

  it("does NOT flag a proper cold open (구체 장면 + 비-TitleCard 비주얼)", () => {
    for (const visual of [
      { component: "StockBg", props: { kind: "video" } },
      { component: "HeroImage", props: { caption: "가입 화면" } },
      { component: "GlitchTransition", props: { label: "진짜 문제는" } },
      { component: "HighlightedLine", props: { text: SCENE, highlights: ["가입률"] } },
    ]) {
      const s = oneLine({ id: "s1l1", text: SCENE, visual });
      expect(rules(lintScript(s))).not.toContain("weak-opening");
    }
  });

  it("only checks the FIRST line — 인사/TitleCard가 line02면 통과", () => {
    const s = multi([
      { id: "s1l1", text: SCENE, visual: { component: "StockBg", props: { kind: "video" } } },
      {
        id: "s1l2",
        text: "안녕하세요. 이번 영상은 A/B 테스트를 풀어보려고 합니다.",
        visual: { component: "TitleCard", props: { title: "A/B 테스트" } },
      },
    ]);
    expect(rules(lintScript(s))).not.toContain("weak-opening");
  });
});

describe("lintScript — source fidelity (opt-in)", () => {
  it("flags an abbreviation absent from source.txt", () => {
    const s = oneLine({ id: "l1", text: "JTBD로 정리합니다." });
    const f = lintScript(s, { source: "이 책은 고객 인터뷰에 대한 내용이다." }).filter(
      (x) => x.rule === "source-fidelity",
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.snippet).toBe("JTBD");
  });

  it("does not flag when the term is present in source", () => {
    const s = oneLine({ id: "l1", text: "RICE 점수." });
    const f = lintScript(s, { source: "우리는 RICE 프레임워크를 쓴다." }).filter(
      (x) => x.rule === "source-fidelity",
    );
    expect(f).toHaveLength(0);
  });

  it("runs no source-fidelity check when no source is provided", () => {
    const s = oneLine({ id: "l1", text: "JTBD로 정리합니다." });
    expect(rules(lintScript(s))).not.toContain("source-fidelity");
  });
});

describe("lintScript — animated emoji cap (ReactionBeat 영상당 1개)", () => {
  function reactionBeats(n: number): Script {
    return ScriptSchema.parse({
      lines: Array.from({ length: n }, (_, i) => ({
        id: `l${i}`,
        text: "내레이션 라인입니다.",
        broll_keywords: [],
        visual: {
          component: "ReactionBeat",
          props: { headline: "결과", emoji: "partying-face" },
        },
      })),
    });
  }

  it("does not flag a single ReactionBeat", () => {
    expect(rules(lintScript(reactionBeats(1)))).not.toContain("animated-emoji-cap");
  });

  it("flags the 2nd+ ReactionBeat (hard cap 1)", () => {
    const f = lintScript(reactionBeats(3)).filter((x) => x.rule === "animated-emoji-cap");
    expect(f).toHaveLength(2); // 2번째·3번째에 경고
    expect(f.every((x) => x.severity === "warn")).toBe(true);
  });

  it("does NOT cap static DecisionMatrix marks (낮은 톤 리스크)", () => {
    const rows = [
      { ko: "한다", verdict: "check" },
      { ko: "접는다", verdict: "cross" },
    ];
    const s = ScriptSchema.parse({
      lines: [
        {
          id: "l0",
          text: "판정입니다.",
          broll_keywords: [],
          visual: { component: "DecisionMatrix", props: { title: "이거 할까?", rows } },
        },
        {
          id: "l1",
          text: "또 판정입니다.",
          broll_keywords: [],
          visual: { component: "DecisionMatrix", props: { title: "저건?", rows } },
        },
      ],
    });
    expect(rules(lintScript(s))).not.toContain("animated-emoji-cap");
  });
});

describe("lintScript — starburst cap (StarburstReveal 영상당 2개)", () => {
  function reveals(n: number): Script {
    return ScriptSchema.parse({
      lines: Array.from({ length: n }, (_, i) => ({
        id: `l${i}`,
        text: "내레이션 라인입니다.",
        broll_keywords: [],
        visual: {
          component: "StarburstReveal",
          props: { headline: "3.2배" },
        },
      })),
    });
  }

  it("does not flag two StarburstReveals (cap 2)", () => {
    expect(rules(lintScript(reveals(2)))).not.toContain("starburst-cap");
  });

  it("flags the 3rd+ StarburstReveal (hard cap 2)", () => {
    const f = lintScript(reveals(4)).filter((x) => x.rule === "starburst-cap");
    expect(f).toHaveLength(2); // 3번째·4번째에 경고
    expect(f.every((x) => x.severity === "warn")).toBe(true);
  });
});

describe("lintScript — starburst numeric headline (수치는 StatHero로)", () => {
  function reveal(headline: string): Script {
    return ScriptSchema.parse({
      lines: [
        {
          id: "l0",
          text: "내레이션 라인입니다.",
          broll_keywords: [],
          visual: { component: "StarburstReveal", props: { headline } },
        },
      ],
    });
  }
  const numericRule = (s: Script) =>
    lintScript(s).filter((x) => x.rule === "starburst-numeric-headline");

  it("flags a pure-number headline (배/%/통화)", () => {
    expect(numericRule(reveal("3.2배"))).toHaveLength(1);
    expect(numericRule(reveal("87%"))).toHaveLength(1);
    expect(numericRule(reveal("$1.5M ARR"))).toHaveLength(1);
  });

  it("does NOT flag a keyword headline", () => {
    expect(numericRule(reveal("결국 답은 속도"))).toHaveLength(0);
    expect(numericRule(reveal("버려라"))).toHaveLength(0);
  });

  it("does NOT flag a phrase that merely contains a number", () => {
    expect(numericRule(reveal("3배 빠르게"))).toHaveLength(0);
    expect(numericRule(reveal("12분 안에 결정"))).toHaveLength(0);
  });
});

// ── 컴포넌트 다양성 ──────────────────────────────────────────────────────

// 컴포넌트명 → 스키마 통과하는 최소 props.
function minimalProps(component: string): Record<string, unknown> {
  switch (component) {
    case "HighlightedLine":
      return { text: "핵심 문장입니다", highlights: ["핵심"] };
    case "ProgressiveList":
      return { items: ["하나", "둘"] };
    case "BulletList":
      return { items: ["가", "나"] };
    case "FlowDiagram":
      return { nodes: [{ label: "A" }, { label: "B" }] };
    case "StatHero":
      return { value: 87 };
    case "StockBg":
      return { kind: "photo" };
    case "TitleCard":
      return { title: "제목" };
    case "SweepDivider":
      return { label: "다음" };
    case "GlitchTransition":
      return { label: "반전" };
    case "SplitVisual":
      return { heading: "정의" };
    case "HeroImage":
      return { title: "사례" };
    case "TerminalCard":
      return { lines: [{ kind: "prompt", text: "ls" }] };
    case "StarburstReveal":
      return { headline: "3.2배" };
    default:
      return {};
  }
}

// 컴포넌트 시퀀스로 script 생성. null = carry-forward(visual 생략).
function scriptOf(components: (string | null)[]): Script {
  return ScriptSchema.parse({
    lines: components.map((c, i) => ({
      id: `l${i}`,
      text: "내레이션 라인입니다.",
      broll_keywords: [],
      ...(c ? { visual: { component: c, props: minimalProps(c) } } : {}),
    })),
  });
}

describe("analyzeDiversity — carry-forward 해소", () => {
  it("visual 생략 라인은 직전 컴포넌트로 이어진다(인스턴스는 1개)", () => {
    // line0 HighlightedLine 명시 + 19라인 carry-forward → effective 전부 HighlightedLine.
    const d = analyzeDiversity(scriptOf(["HighlightedLine", ...Array(19).fill(null)]));
    expect(d.applies).toBe(true);
    expect(d.totalLines).toBe(20);
    expect(d.distinct).toBe(1);
    expect(d.counts[0]!.component).toBe("HighlightedLine");
    expect(d.counts[0]!.count).toBe(20); // 해소 후 20 shot 모두 HighlightedLine
    // carry-forward(1 인스턴스 hold)는 run으로 안 잡힌다.
    expect(d.longestRun!.instances).toBe(1);
    expect(d.flags.some((f) => f.kind === "run")).toBe(false);
    // 편중·image-first 0은 잡힌다.
    expect(d.flags.some((f) => f.kind === "distinct")).toBe(true);
    expect(d.flags.some((f) => f.kind === "dominant")).toBe(true);
    expect(d.flags.some((f) => f.kind === "image-first")).toBe(true);
  });
});

describe("analyzeDiversity — run(동일 인스턴스 연속)", () => {
  it("서로 다른 인스턴스가 4개 이상 연속이면 run 경고", () => {
    // FlowDiagram 5개 명시 연속(=25%, 독식 아님) + 나머지 다양.
    const d = analyzeDiversity(
      scriptOf([
        "FlowDiagram",
        "FlowDiagram",
        "FlowDiagram",
        "FlowDiagram",
        "FlowDiagram",
        "HighlightedLine",
        "StockBg",
        "SplitVisual",
        "ProgressiveList",
        "StatHero",
        "HeroImage",
        "TitleCard",
        "SweepDivider",
        "BulletList",
        "StockBg",
        "HighlightedLine",
        "SplitVisual",
        "TerminalCard",
        "ProgressiveList",
        "StatHero",
      ]),
    );
    expect(d.longestRun!.component).toBe("FlowDiagram");
    expect(d.longestRun!.instances).toBe(5);
    expect(d.flags.some((f) => f.kind === "run")).toBe(true);
    // FlowDiagram 5/20 = 25% (>25% 아님) → 독식 경고는 없다.
    expect(d.flags.some((f) => f.kind === "dominant")).toBe(false);
  });
});

describe("analyzeDiversity — 건강한 분포", () => {
  it("8종 이상·독식 없음·image-first 있음·연속 없음·glitch 1회면 플래그 없음", () => {
    const d = analyzeDiversity(
      scriptOf([
        "TitleCard",
        "HighlightedLine",
        "StockBg",
        "SplitVisual",
        "FlowDiagram",
        "ProgressiveList",
        "StatHero",
        "HeroImage",
        "GlitchTransition",
        "StockBg",
        "SplitVisual",
        "FlowDiagram",
        "ProgressiveList",
        "SweepDivider",
        "HeroImage",
        "StockBg",
        "HighlightedLine",
        "BulletList",
        "TerminalCard",
        "StatHero",
      ]),
    );
    expect(d.applies).toBe(true);
    expect(d.distinct).toBeGreaterThanOrEqual(8);
    expect(d.imageFirst).toBeGreaterThan(0);
    expect(d.flags).toHaveLength(0);
  });
});

describe("analyzeDiversity — GlitchTransition 최소 1회 필수", () => {
  const base16 = [
    "TitleCard",
    "HighlightedLine",
    "StockBg",
    "SplitVisual",
    "FlowDiagram",
    "ProgressiveList",
    "StatHero",
    "HeroImage",
    "StockBg",
    "SplitVisual",
    "FlowDiagram",
    "ProgressiveList",
    "SweepDivider",
    "HeroImage",
    "StockBg",
    "BulletList",
  ];

  it("16+ 라인에 GlitchTransition이 0회면 glitch 경고", () => {
    const d = analyzeDiversity(scriptOf(base16));
    expect(d.applies).toBe(true);
    expect(d.flags.some((f) => f.kind === "glitch")).toBe(true);
  });

  it("GlitchTransition이 1회 있으면 glitch 경고 없음", () => {
    const withGlitch = [...base16];
    withGlitch[1] = "GlitchTransition";
    const d = analyzeDiversity(scriptOf(withGlitch));
    expect(d.flags.some((f) => f.kind === "glitch")).toBe(false);
  });

  it("GlitchTransition이 3회 이상이면 과사용 경고", () => {
    const over = [...base16];
    over[1] = "GlitchTransition";
    over[5] = "GlitchTransition";
    over[9] = "GlitchTransition";
    const d = analyzeDiversity(scriptOf(over));
    expect(d.flags.some((f) => f.kind === "glitch")).toBe(true);
  });
});

describe("analyzeDiversity — min-lines 가드", () => {
  it("짧은 스크립트는 검사를 스킵한다(applies=false, 플래그 없음)", () => {
    const d = analyzeDiversity(scriptOf(Array(8).fill("HighlightedLine")));
    expect(d.applies).toBe(false);
    expect(d.flags).toHaveLength(0);
  });
});

describe("summarize", () => {
  it("counts by severity and rule", () => {
    const s = oneLine({
      id: "l1",
      text: "JTBD가 중요합니다.",
      visual: {
        component: "HighlightedLine",
        props: { text: "핵심은 측정", highlights: ["없는강조어"] },
      },
    });
    const sum = summarize(lintScript(s));
    expect(sum.error).toBeGreaterThanOrEqual(1); // orphan
    expect(sum.warn).toBeGreaterThanOrEqual(1); // abbrev
    expect(sum.total).toBe(sum.error + sum.warn + sum.info);
  });
});
