import { describe, expect, it } from "vitest";
import {
  buildCues,
  formatSrt,
  formatSrtTimestamp,
  toCaption,
} from "../../src/pipeline/captions.js";
import { ScriptSchema } from "../../src/schemas/script.js";
import { StoryboardSchema } from "../../src/schemas/storyboard.js";

describe("formatSrtTimestamp", () => {
  it("formats integer seconds", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(65)).toBe("00:01:05,000");
    expect(formatSrtTimestamp(3661.5)).toBe("01:01:01,500");
  });

  it("rounds sub-millisecond to nearest millisecond", () => {
    expect(formatSrtTimestamp(1.2345)).toBe("00:00:01,235");
  });
});

describe("buildCues", () => {
  const script = ScriptSchema.parse({
    lines: [
      { id: "scene01-line01", text: "첫 번째 라인" },
      { id: "scene02-line01", text: "두 번째 라인" },
    ],
  });
  const storyboard = StoryboardSchema.parse({
    meta: { fps: 30, width: 1920, height: 1080 },
    shots: [
      {
        scene_id: "scene01",
        audio_ref: "assets/audio/scene01-line01.wav",
        duration_sec: 3,
        broll_keywords: [],
        component: "TitleCard",
        props: { title: "t" },
      },
      {
        scene_id: "scene02",
        audio_ref: "assets/audio/scene02-line01.wav",
        duration_sec: 5,
        broll_keywords: [],
        component: "TitleCard",
        props: { title: "t" },
      },
    ],
  });

  it("matches each shot to its line by audio_ref basename", () => {
    const cues = buildCues(storyboard, script);
    expect(cues).toHaveLength(2);
    expect(cues[0]?.text).toBe("첫 번째 라인");
    expect(cues[1]?.text).toBe("두 번째 라인");
  });

  it("accumulates start/end timestamps from shot durations", () => {
    const cues = buildCues(storyboard, script);
    expect(cues[0]).toMatchObject({ startSec: 0, endSec: 3 });
    expect(cues[1]).toMatchObject({ startSec: 3, endSec: 8 });
  });

  it("returns empty text when line id is missing from script", () => {
    const cues = buildCues(storyboard, ScriptSchema.parse({ lines: [script.lines[0]!] }));
    expect(cues[1]?.text).toBe("");
  });
});

describe("toCaption", () => {
  it("strips commas (replaces with space)", () => {
    expect(toCaption("두 번째 규칙은, 미래에 대한 일반론입니다.")).toBe(
      "두 번째 규칙은 미래에 대한 일반론입니다.",
    );
  });

  it("strips ellipsis (... and …)", () => {
    expect(toCaption("음... 그러니까")).toBe("음 그러니까");
    expect(toCaption("음… 그러니까")).toBe("음 그러니까");
  });

  it("strips em dash", () => {
    expect(toCaption("결국 — 본질은 하나입니다")).toBe(
      "결국 본질은 하나입니다",
    );
  });

  it("preserves periods, question marks, exclamation marks", () => {
    expect(toCaption("좋습니다. 정말일까요? 그렇죠!")).toBe(
      "좋습니다. 정말일까요? 그렇죠!",
    );
  });

  it("collapses multiple spaces from stripped punctuation", () => {
    expect(toCaption("A, B, C, 입니다")).toBe("A B C 입니다");
  });

  // 화면 표기: 발화는 한글("깃"·"클로드 코드"·"깃허브")로 읽되 자막엔 영어 고유명사로.
  it("renders git/github/claude code as English on screen", () => {
    expect(toCaption("깃은 폴더 기준입니다")).toBe("Git은 폴더 기준입니다");
    expect(toCaption("깃의 워크트리를 씁니다")).toBe("Git의 워크트리를 씁니다");
    expect(toCaption("깃허브가 합쳐 줍니다")).toBe("GitHub가 합쳐 줍니다");
    expect(toCaption("클로드 코드가 정리해 줍니다")).toBe(
      "Claude Code가 정리해 줍니다",
    );
  });

  it("does not mangle Korean words that merely start with 깃", () => {
    expect(toCaption("깃발을 꽂았습니다")).toBe("깃발을 꽂았습니다");
    expect(toCaption("옷깃을 여미고")).toBe("옷깃을 여미고");
    expect(toCaption("희망이 깃든 곳")).toBe("희망이 깃든 곳");
    expect(toCaption("깃털처럼 가볍게")).toBe("깃털처럼 가볍게");
  });
});

describe("formatSrt", () => {
  it("renders standard SRT format with index, timestamps, text, blank line", () => {
    const out = formatSrt([
      { index: 1, startSec: 0, endSec: 2.5, text: "hi" },
      { index: 2, startSec: 2.5, endSec: 5, text: "bye" },
    ]);
    expect(out).toContain("1\n00:00:00,000 --> 00:00:02,500\nhi\n");
    expect(out).toContain("2\n00:00:02,500 --> 00:00:05,000\nbye\n");
  });
});
