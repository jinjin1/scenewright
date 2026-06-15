import { describe, it, expect } from "vitest";
import { transliterate } from "../../src/pipeline/transliterate.js";

describe("transliterate", () => {
  it("converts standalone PM acronyms to Korean", () => {
    expect(transliterate("RICE 프레임워크를 활용해서")).toBe("라이스 프레임워크를 활용해서");
    expect(transliterate("KPI를 정의하고")).toBe("케이피아이를 정의하고");
  });

  it("handles slash-form acronyms", () => {
    expect(transliterate("A/B 테스트를 돌렸다")).toBe("에이비 테스트를 돌렸다");
  });

  it("handles digit-bearing acronyms", () => {
    expect(transliterate("B2B SaaS 시장")).toBe("비투비 사스 시장");
  });

  it("does not match acronyms inside other Latin tokens", () => {
    expect(transliterate("PRICE는 RICE가 아니다")).toBe("PRICE는 라이스가 아니다");
  });

  it("preserves unmapped English words", () => {
    expect(transliterate("Notion에서 작성")).toBe("Notion에서 작성");
  });

  it("converts multiple acronyms in one sentence", () => {
    expect(transliterate("MAU 대비 DAU 비율로 LTV를 추정")).toBe(
      "엠에이유 대비 디에이유 비율로 엘티비를 추정",
    );
  });

  it("splits slash-joined acronyms that are not in the map", () => {
    // 'UX/UI'는 매핑에 없지만 UX, UI 각각은 있음 → 슬래시를 boundary로 자연 분리.
    expect(transliterate("UX/UI 개선")).toBe("유엑스/유아이 개선");
    expect(transliterate("API/SDK 문서")).toBe("에이피아이/에스디케이 문서");
  });

  it("preserves explicit slash-mapped acronyms (longest-first)", () => {
    // 'A/B'는 매핑에 명시적 — 'A' 단독 매칭으로 쪼개지지 않고 한 단위로 처리.
    expect(transliterate("A/B 결과")).toBe("에이비 결과");
  });

  it("treats hyphen as boundary so prefix acronyms still convert", () => {
    expect(transliterate("RICE-framework 비교")).toBe("라이스-framework 비교");
  });

  it("converts leadership and delivery acronyms", () => {
    expect(transliterate("CEO와 CFO가 합의")).toBe("씨이오와 씨에프오가 합의");
    expect(transliterate("CI/CD 파이프라인")).toBe("씨아이씨디 파이프라인");
  });

  it("converts common role and tech acronyms", () => {
    expect(transliterate("PM이 IT 모델에서 일한다")).toBe("피엠이 아이티 모델에서 일한다");
    expect(transliterate("생성형 AI 시대")).toBe("생성형 에이아이 시대");
  });

  it("converts PR for the worktree episode without clobbering PRD", () => {
    expect(transliterate("PR을 머지하면")).toBe("피알을 머지하면");
    expect(transliterate("PRD를 먼저 쓴다")).toBe("피알디를 먼저 쓴다");
  });

  it("converts LLM/RAG/IDE for the LLM Wiki episode", () => {
    expect(transliterate("LLM 위키를 만든다")).toBe("엘엘엠 위키를 만든다");
    expect(transliterate("RAG 방식으로 답한다")).toBe("랙 방식으로 답한다");
    expect(transliterate("옵시디언은 IDE라고 보면 됩니다")).toBe("옵시디언은 아이디이라고 보면 됩니다");
  });
});
