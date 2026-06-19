// 워딩 검수 게이트 — 결정적(deterministic) 층.
//
// 왜: /tts가 내레이션을, /render가 화면 텍스트를 "굽는다". 어색한 워딩을 그 뒤에
//   발견하면 재합성(~4분)·재렌더(~30분)가 든다. script.json 단계에서 **객관적으로
//   검출 가능한** 워딩 위험을 먼저 잡는다. 번역체·어색한 한글 같은 *의미 판단*은
//   /script-review 커맨드에서 CC 세션이 이 리포트를 출발점으로 보강한다(하이브리드).
//
// 규칙(선택된 4개 항목 매핑):
//   - orphan-highlight (error): HighlightedLine.highlights가 text의 부분문자열이 아님
//       → 형광펜이 조용히 안 칠해지는 렌더 silent 실패.
//   - screen-english (info): 화면 노출 텍스트에 남은 Latin/영어 — 의도한 제목인지,
//       한글/음차가 빠진 건지 육안 체크.
//   - untransliterated-abbrev (warn): 내레이션의 영어 약어/단어가 TRANSLITERATION_MAP에
//       없음 → TTS 발음 깨짐. MAP 추가 권유.
//   - translationese (info): 영어 직역체 한국어 패턴 후보(의미 판단은 CC가 확정).
//   - sentence-end (warn/info): 라인이 너무 길거나 문장 끝이 영어/모호 → TTS 잘림·어색.
//   - cliche-keyword (warn): broll_keywords가 AI-영상 스톡 클리셰(악수·팀워크 포즈·발광
//       전구 등) → 진부한 b-roll. 구체적인 한 장면으로 교체 권유(/script "구체화 사다리").
//   - source-fidelity (info): source.txt에 없는 용어 — 충실도 확인(소스 제공 시).

import { TRANSLITERATION_MAP } from "./transliterate.js";
import type { Script, ScriptLine, VisualSpec } from "../schemas/script.js";
import type { Treatment } from "../schemas/treatment.js";

export type Severity = "error" | "warn" | "info";

export interface Finding {
  lineId: string;
  lineIndex: number;
  /** "narration" 또는 "visual:<Component>.<field>" */
  where: string;
  rule:
    | "orphan-highlight"
    | "screen-english"
    | "untransliterated-abbrev"
    | "translationese"
    | "sentence-end"
    | "tts-truncation-risk"
    | "cliche-keyword"
    | "weak-opening"
    | "animated-emoji-cap"
    | "starburst-cap"
    | "starburst-numeric-headline"
    | "source-fidelity";
  severity: Severity;
  /** 문제가 된 텍스트/부분 문자열. */
  snippet: string;
  /** 운영자용 한국어 설명. */
  message: string;
  /** 선택적 수정 힌트. */
  suggestion?: string;
}

// 한 호흡 권장 상한(자). script.md: ~30~80자 권장.
const LINE_LEN_WARN = 90;

// TTS 끝-잘림 위험: 짧은 라인이 정중 종결어미로 끝나면 Supertonic이 끝 2~3음절을
// 누락하는 현상(실측: "활동 영역입니다"→"활동 영역"). 보수적으로 매우 짧은 라인만 잡는다
// (긴 라인의 "~어요"는 거의 안전). 공백·문장부호 제외 글자 수 기준.
const SHORT_LINE_MAX = 20;
// 위험한 종결: 명사 뒤 copula "입니다/이다"와 짧은 구어 어미. 길고 견고한 동사 어미
// ("~살펴보겠습니다" 등 "겠습니다"류)는 끝 음절이 빠져도 알아들을 수 있어 제외한다
// — "습니다"를 통째로 잡지 않고 copula "입니다"만 잡는 게 핵심(오탐 방지).
// 문장 종결 구두점(마침표·물음표·느낌표·말줄임표 + 닫는 따옴표/괄호류).
// 종결 판정 정규식 3종(RISKY_ENDING·SENTENCE_END_OK·tailLatin)이 공유하는 단일 소스 —
// 정규식 문자 클래스 내부에 그대로 들어가므로 닫는 `]`만 escape한다.
const SENT_END_CLASS = `[.?!…"'”’」』)\\]]`;

const RISKY_ENDING = new RegExp(
  `(입니다|이다|어요|에요|예요|아요|해요|세요|죠|네요|까요)${SENT_END_CLASS}*\\s*$`,
);

// Latin 토큰(슬래시 포함, 길이 2+). "A/B", "UX/UI", "Notion" 등.
const LATIN_TOKEN_RE = /[A-Za-z][A-Za-z/]*[A-Za-z]/g;

// 영어 직역체 후보 패턴(고신호만 — 과다 플래그 방지). CC가 의미로 확정.
const TRANSLATIONESE: { re: RegExp; label: string }[] = [
  { re: /[을를]\s*가지(다|는|고|며|면서)/, label: '"have" 직역(~을 가지다)' },
  { re: /되어\s?[지진졌질]/, label: "이중 피동(되어지-)" },
  { re: /에\s*의해(서)?/, label: '"by" 수동태(~에 의해)' },
  { re: /중\s*의?\s*하나/, label: '"one of"(~중 하나)' },
  { re: /(우리|당신|그들|저희)의\b/, label: "소유격 남발(영어 possessive)" },
  { re: /라는\s*것(을|이|은)?/, label: '"the fact that"(~라는 것)' },
  { re: /가능하게\s*(하|만들)/, label: '"enable"(가능하게 하다)' },
  { re: /에\s*있어서/, label: '"in terms of"(~에 있어서)' },
  { re: /(것|점)으로\s*(보인다|생각된다|여겨진다)/, label: "헤지 피동(~것으로 보인다)" },
];

// 한국어 종결로 끝나는가(문장부호 또는 종결어미). 아니면 TTS 잘림/어색 위험.
const SENTENCE_END_OK = new RegExp(
  `(다|요|죠|까|네|군|함|음|걸|데)\\s*$|${SENT_END_CLASS}\\s*$`,
);

// AI-영상 b-roll 클리셰 — 스톡에서 누구나 쓰는 식상한 장면(악수·팀워크 포즈·발광 전구
// 등). /script "구체화 사다리"가 예방하지만, 새어든 클리셰 키워드를 결정적으로 검출한다.
// 오탐(alert fatigue) 방지를 위해 *거의 항상 클리셰*인 구·단어만 등록(고정밀 denylist).
// warn 수준 — 하드 게이트가 아니라 교체 권유.
const CLICHE_KEYWORDS: { re: RegExp; label: string }[] = [
  { re: /\bhandshake\b/i, label: "악수" },
  { re: /\b(corporate\s+)?teamwork\b|\bteam\s+collaboration\b/i, label: "팀워크 포즈" },
  { re: /\bdiverse\s+(team|group)\b/i, label: "다양성 팀 포즈" },
  { re: /\bhands?\s+(stacked|together|in\s+a\s+circle)\b|\bstack(ing|ed)?\s+hands\b/i, label: "손 모으기 포즈" },
  { re: /\bglowing\s+(brain|light\s*bulb)\b|\blight\s*bulb\s+(idea|moment)\b|\blightbulb\b/i, label: "발광 전구/뇌" },
  { re: /\b(abstract\s+)?(digital\s+network|data\s+stream|network\s+connection)\b/i, label: "추상 네트워크/데이터" },
  { re: /\bfaceless\b|\bbusinessman\s+in\s+(a\s+)?suit\b/i, label: "얼굴 없는 정장" },
  { re: /\b3d\s+arrow\b|\barrow\s+(going\s+up|pointing\s+up)\b|\b(rising|growth)\s+arrow\b/i, label: "상승 화살표" },
  { re: /\bpuzzle\s+pieces?\b/i, label: "퍼즐 조각" },
  { re: /\bsynergy\b/i, label: "추상어 synergy" },
  { re: /\bbusiness\s+(growth|success)\b/i, label: "추상 비즈니스 성공/성장" },
];

function isAbbrevToken(tok: string): boolean {
  // 슬래시 제거 후 알파벳이 전부 대문자면 약어로 본다(A/B, CI/CD 포함).
  const letters = tok.replace(/\//g, "");
  return letters.length >= 2 && letters === letters.toUpperCase();
}

// 토큰이 TRANSLITERATION_MAP으로 커버되는가(직접 또는 슬래시 분해).
function isCoveredByMap(tok: string): boolean {
  if (tok in TRANSLITERATION_MAP) return true;
  if (tok.includes("/")) {
    return tok.split("/").every((part) => part.length > 0 && part in TRANSLITERATION_MAP);
  }
  return false;
}

// 화면 노출 텍스트 추출. screenEnglish=false면 screen-english 검사에서 제외하되
// 다른 검사(source-fidelity 약어 등)는 받는다. 제외 대상:
//   - eyebrow: 작은 장식 kicker("Chapter 01"·"Book Review")라 영어가 거의 의도적.
//   - PixelTitle/TerminalCard: 영문/코드가 본질인 컴포넌트.
//   - StatHero prefix/suffix: 단위($·%·x).
// 이렇게 해서 의도된 장식 영어로 인한 alert fatigue를 줄이고, 본문(title/heading/
// label/caption/body/items)에 새어든 영어·미번역만 검사한다.
interface VisibleField {
  field: string;
  value: string;
  screenEnglish: boolean;
}

function visibleFields(visual: VisualSpec): VisibleField[] {
  const out: VisibleField[] = [];
  const push = (field: string, value: string | undefined, screenEnglish = true): void => {
    if (typeof value === "string" && value.trim()) out.push({ field, value, screenEnglish });
  };
  const pushArr = (field: string, arr: string[] | undefined): void => {
    (arr ?? []).forEach((v, i) => push(`${field}[${i}]`, v));
  };

  // visual은 discriminated union이라 case 안에서 visual.props가 해당 컴포넌트 props로
  // 정밀하게 좁혀진다 — `as` 캐스트 없이 타입 안전하게 필드를 읽는다.
  switch (visual.component) {
    case "TitleCard":
      push("title", visual.props.title);
      push("subtitle", visual.props.subtitle);
      push("eyebrow", visual.props.eyebrow, false);
      break;
    case "BulletList":
      push("heading", visual.props.heading);
      pushArr("items", visual.props.items);
      break;
    case "HighlightedLine":
      push("text", visual.props.text);
      push("eyebrow", visual.props.eyebrow, false);
      // highlights는 orphan 검사에서 별도로 다룸(여기선 screen-english용으로만).
      pushArr("highlights", visual.props.highlights);
      break;
    case "ProgressiveList":
      push("heading", visual.props.heading);
      push("eyebrow", visual.props.eyebrow, false);
      pushArr("items", visual.props.items);
      break;
    case "StatHero":
      push("eyebrow", visual.props.eyebrow, false);
      push("caption", visual.props.caption);
      // prefix/suffix($, %, x)는 화면 영어 검사 제외(단위라 의도적).
      push("prefix", visual.props.prefix, false);
      push("suffix", visual.props.suffix, false);
      break;
    case "SweepDivider":
      push("eyebrow", visual.props.eyebrow, false);
      push("label", visual.props.label);
      push("caption", visual.props.caption);
      break;
    case "GlitchTransition":
      push("eyebrow", visual.props.eyebrow, false);
      push("label", visual.props.label);
      break;
    case "TerminalCard":
      // CLI/코드라 Latin이 본질 — screen-english 제외.
      push("windowTitle", visual.props.windowTitle, false);
      visual.props.lines?.forEach((l, i) => push(`lines[${i}].text`, l.text, false));
      break;
    case "PixelTitle":
      // "영문/숫자 권장" 시그니처 — screen-english 제외.
      push("label", visual.props.label, false);
      push("subtitle", visual.props.subtitle, false);
      break;
    case "HeroImage":
      push("title", visual.props.title);
      push("caption", visual.props.caption);
      push("eyebrow", visual.props.eyebrow, false);
      break;
    case "SplitVisual":
      push("heading", visual.props.heading);
      push("body", visual.props.body);
      push("eyebrow", visual.props.eyebrow, false);
      pushArr("items", visual.props.items);
      break;
    case "ScreenshotCallout":
      push("eyebrow", visual.props.eyebrow, false);
      push("title", visual.props.title);
      push("caption", visual.props.caption);
      visual.props.annotations?.forEach((a, i) =>
        push(`annotations[${i}].label`, a.label),
      );
      break;
    case "FlowDiagram":
      push("eyebrow", visual.props.eyebrow, false);
      push("heading", visual.props.heading);
      visual.props.nodes?.forEach((n, i) => {
        push(`nodes[${i}].label`, n.label);
        push(`nodes[${i}].sublabel`, n.sublabel);
      });
      break;
    case "PixelBarChart":
      push("eyebrow", visual.props.eyebrow, false);
      push("heading", visual.props.heading);
      push("caption", visual.props.caption);
      visual.props.bars?.forEach((b, i) => push(`bars[${i}].label`, b.label));
      break;
    case "PixelDonut":
      push("eyebrow", visual.props.eyebrow, false);
      push("heading", visual.props.heading);
      push("caption", visual.props.caption);
      break;
    case "PixelGauge":
      push("eyebrow", visual.props.eyebrow, false);
      push("heading", visual.props.heading);
      push("label", visual.props.label);
      push("caption", visual.props.caption);
      break;
    case "PixelStepTracker":
      push("eyebrow", visual.props.eyebrow, false);
      push("heading", visual.props.heading);
      pushArr("steps", visual.props.steps);
      break;
    case "PixelRoadmap":
      push("eyebrow", visual.props.eyebrow, false);
      push("heading", visual.props.heading);
      visual.props.milestones?.forEach((m, i) =>
        push(`milestones[${i}].label`, m.label),
      );
      break;
    case "DecisionMatrix":
      push("eyebrow", visual.props.eyebrow, false);
      push("title", visual.props.title);
      visual.props.rows?.forEach((r, i) => {
        push(`rows[${i}].ko`, r.ko);
        // en은 의도적 영어 병기 — screen-english 제외(eyebrow와 동일 정신).
        push(`rows[${i}].en`, r.en, false);
      });
      break;
    case "ReactionBeat":
      push("eyebrow", visual.props.eyebrow, false);
      push("headline", visual.props.headline);
      break;
    case "StarburstReveal":
      push("eyebrow", visual.props.eyebrow, false);
      push("headline", visual.props.headline);
      push("caption", visual.props.caption);
      break;
    case "StockBg":
      // 화면에 노출되는 텍스트 없음.
      break;
    default: {
      // 새 컴포넌트가 union에 추가됐는데 위 case를 빠뜨리면 tsc가 막는다(검사 누락 방지).
      const _exhaustive: never = visual;
      void _exhaustive;
    }
  }
  return out;
}

// ── 개별 규칙 ──────────────────────────────────────────────────────────────

function checkOrphanHighlights(line: ScriptLine, idx: number, out: Finding[]): void {
  const v = line.visual;
  if (!v || v.component !== "HighlightedLine") return;
  const text = v.props.text;
  for (const h of v.props.highlights) {
    if (!text.includes(h)) {
      out.push({
        lineId: line.id,
        lineIndex: idx,
        where: "visual:HighlightedLine.highlights",
        rule: "orphan-highlight",
        severity: "error",
        snippet: h,
        message: `강조어 "${h}"가 text에 없어 형광펜이 칠해지지 않는다(조용한 렌더 실패).`,
        suggestion: `highlights는 text의 부분문자열이어야 함. text: "${text}"`,
      });
    }
  }
}

function checkScreenEnglish(line: ScriptLine, idx: number, out: Finding[]): void {
  if (!line.visual) return;
  for (const f of visibleFields(line.visual)) {
    if (!f.screenEnglish) continue;
    const latin = f.value.match(LATIN_TOKEN_RE);
    if (latin && latin.length > 0) {
      out.push({
        lineId: line.id,
        lineIndex: idx,
        where: `visual:${line.visual.component}.${f.field}`,
        rule: "screen-english",
        severity: "info",
        snippet: latin.join(" · "),
        message: `화면 텍스트에 영어가 남아있다: "${f.value}". 의도한 제목/고유명사인지, 한글·음차가 빠진 건지 확인.`,
      });
    }
  }
}

function checkNarrationAbbrev(line: ScriptLine, idx: number, out: Finding[]): void {
  const tokens = line.text.match(LATIN_TOKEN_RE);
  if (!tokens) return;
  const seen = new Set<string>();
  for (const tok of tokens) {
    if (seen.has(tok) || isCoveredByMap(tok)) continue;
    seen.add(tok);
    const abbrev = isAbbrevToken(tok);
    out.push({
      lineId: line.id,
      lineIndex: idx,
      where: "narration",
      rule: "untransliterated-abbrev",
      severity: abbrev ? "warn" : "info",
      snippet: tok,
      message: abbrev
        ? `영어 약어 "${tok}"가 음차 사전에 없어 TTS 발음이 깨질 수 있다.`
        : `영어 단어 "${tok}"는 TTS가 한국어로 못 읽는다(예: 고유명사 → 음차 필요).`,
      suggestion: `필요하면 src/pipeline/transliterate.ts의 TRANSLITERATION_MAP에 "${tok}" 추가 + 회귀 테스트 1줄.`,
    });
  }
}

function checkTranslationese(line: ScriptLine, idx: number, out: Finding[]): void {
  for (const { re, label } of TRANSLATIONESE) {
    const m = line.text.match(re);
    if (m) {
      out.push({
        lineId: line.id,
        lineIndex: idx,
        where: "narration",
        rule: "translationese",
        severity: "info",
        snippet: m[0],
        message: `번역체 후보: ${label}. 자연스러운 한국어인지 확인(CC 의미 검토).`,
      });
    }
  }
}

function checkSentenceEnd(line: ScriptLine, idx: number, out: Finding[]): void {
  const text = line.text.trim();
  if (text.length > LINE_LEN_WARN) {
    out.push({
      lineId: line.id,
      lineIndex: idx,
      where: "narration",
      rule: "sentence-end",
      severity: "warn",
      snippet: `${text.length}자`,
      message: `라인이 길다(${text.length}자, 권장 ~80자). 한 호흡에 길어 끊김/잘림 위험 — 분할 검토.`,
    });
  }
  // 마지막 토큰이 Latin이면(예: "...это RICE") TTS가 끝을 잘릴 위험이 가장 크다.
  const tailLatin = text.match(
    new RegExp(`[A-Za-z][A-Za-z/]*\\s*${SENT_END_CLASS}*$`),
  );
  if (tailLatin) {
    out.push({
      lineId: line.id,
      lineIndex: idx,
      where: "narration",
      rule: "sentence-end",
      severity: "warn",
      snippet: tailLatin[0].trim(),
      message: "문장이 영어로 끝난다 — Supertonic이 끝 음절을 잘릴 위험. 핵심어를 문장 끝에서 떼는 리라이트 권장.",
    });
  } else if (!SENTENCE_END_OK.test(text)) {
    out.push({
      lineId: line.id,
      lineIndex: idx,
      where: "narration",
      rule: "sentence-end",
      severity: "info",
      snippet: text.slice(-12),
      message: "문장 종결이 모호하다(명확한 종결어미/문장부호 없음). TTS 운율·잘림 확인.",
    });
  }
}

// 짧은 라인 + 정중 종결어미 → Supertonic 끝-잘림 위험. 합성 전에 리라이트 유도.
function checkTtsTruncationRisk(line: ScriptLine, idx: number, out: Finding[]): void {
  const t = line.text.trim();
  const visibleLen = (t.match(/[가-힣A-Za-z0-9]/g) ?? []).length;
  if (visibleLen <= SHORT_LINE_MAX && RISKY_ENDING.test(t)) {
    out.push({
      lineId: line.id,
      lineIndex: idx,
      where: "narration",
      rule: "tts-truncation-risk",
      severity: "warn",
      snippet: t.slice(-10),
      message:
        "짧은 라인 + 정중 종결어미 — Supertonic이 끝 음절을 누락할 위험(예: '활동 영역입니다'→'활동 영역'). 라인을 길게 + 견고한 어미('~살펴보겠습니다')로, 핵심어는 문장 앞쪽에.",
    });
  }
}

function checkClicheKeywords(line: ScriptLine, idx: number, out: Finding[]): void {
  for (const kw of line.broll_keywords ?? []) {
    for (const { re, label } of CLICHE_KEYWORDS) {
      if (re.test(kw)) {
        out.push({
          lineId: line.id,
          lineIndex: idx,
          where: "broll_keywords",
          rule: "cliche-keyword",
          severity: "warn",
          snippet: kw,
          message: `b-roll 키워드 "${kw}"는 AI-영상 스톡 클리셰(${label}). 개념 말고 구체적인 한 장면으로 — [누가]+[행동]+[장소] 3~5어(예: 'business handshake'→'runner crossing a finish line'). /script "구체화 사다리" 참조.`,
        });
        break; // 한 키워드당 한 번만 보고(여러 패턴 중복 매치 방지)
      }
    }
  }
}

// 콜드 오픈 게이트 — 영상 첫 라인이 콜드 오픈인지 결정적으로 점검한다.
// 운영자 피드백(2026-06-04): 제작 영상 6/7편이 "안녕하세요. 이번 영상은 ~" 한 템플릿으로
// 시작해 0~15초 후킹에 실패. VOICE.md §4가 콜드 오픈(구체 장면·반전을 먼저 던지고 인사는
// 그 다음 비트)으로 전환됨. 내레이션과 화면 *양면*을 본다:
//   - 내레이션: 첫 라인이 "안녕…"으로 시작 → 인사가 첫 마디 = 콜드 오픈 아님.
//   - 화면: 첫 visual이 TitleCard → 정적 제목 카드가 첫 shot = 콜드 오픈 아님(제목은 인사 비트로).
// warn(권고) — 의도적 예외(짧은 공지성 영상 등)를 하드 차단하진 않되 단조 오프닝을 잡는다.
const GREETING_OPENING_RE = /^\s*안녕/;

function checkColdOpen(line: ScriptLine, idx: number, out: Finding[]): void {
  if (idx !== 0) return; // 영상 첫 라인만 본다.
  if (GREETING_OPENING_RE.test(line.text)) {
    out.push({
      lineId: line.id,
      lineIndex: idx,
      where: "narration",
      rule: "weak-opening",
      severity: "warn",
      snippet: line.text.slice(0, 16),
      message:
        '첫 라인이 인사("안녕하세요~")로 시작한다 — 콜드 오픈이 아니다(VOICE.md §4). 구체 장면·반전·시청자 본인 상황 한 마디를 먼저 던지고, 인사+주제("안녕하세요. 이번 영상은 ~")는 그 다음 비트로 민다.',
    });
  }
  if (line.visual?.component === "TitleCard") {
    out.push({
      lineId: line.id,
      lineIndex: idx,
      where: "visual:TitleCard",
      rule: "weak-opening",
      severity: "warn",
      snippet: "TitleCard",
      message:
        "첫 shot이 정적 제목 카드(TitleCard)다 — 콜드 오픈은 화면도 같이 가야 한다(양면 일치). 첫 shot을 그 장면/반전을 받는 비주얼(HeroImage·StockBg·GlitchTransition·StarburstReveal·HighlightedLine)로 바꾸고, 제목 카드는 인사 비트로 미뤄라.",
    });
  }
}

function checkSourceFidelity(
  line: ScriptLine,
  idx: number,
  sourceLower: string,
  out: Finding[],
): void {
  // 후보 용어: 음차 대상 약어(원형) + 화면/내레이션에 등장한 Latin 약어.
  const candidates = new Set<string>();
  for (const tok of line.text.match(LATIN_TOKEN_RE) ?? []) {
    if (isAbbrevToken(tok)) candidates.add(tok);
  }
  if (line.visual) {
    for (const f of visibleFields(line.visual)) {
      for (const tok of f.value.match(LATIN_TOKEN_RE) ?? []) {
        if (isAbbrevToken(tok)) candidates.add(tok);
      }
    }
  }
  for (const term of candidates) {
    if (!sourceLower.includes(term.toLowerCase())) {
      out.push({
        lineId: line.id,
        lineIndex: idx,
        where: "narration/visual",
        rule: "source-fidelity",
        severity: "info",
        snippet: term,
        message: `용어 "${term}"가 source.txt에 없다 — 소스에 근거 없는 프레임워크/약어 삽입인지 확인.`,
      });
    }
  }
}

/**
 * script를 결정적으로 스캔해 워딩 검수 findings를 반환한다.
 * @param opts.source 있으면 source-fidelity 검사를 켠다(소스에 없는 용어 플래그).
 */
export function lintScript(script: Script, opts: { source?: string } = {}): Finding[] {
  const findings: Finding[] = [];
  const sourceLower = opts.source?.toLowerCase();

  script.lines.forEach((line, idx) => {
    checkOrphanHighlights(line, idx, findings);
    checkScreenEnglish(line, idx, findings);
    checkNarrationAbbrev(line, idx, findings);
    checkTranslationese(line, idx, findings);
    checkSentenceEnd(line, idx, findings);
    checkTtsTruncationRisk(line, idx, findings);
    checkClicheKeywords(line, idx, findings);
    checkColdOpen(line, idx, findings);
    if (sourceLower) checkSourceFidelity(line, idx, sourceLower, findings);
  });

  for (const capRule of COMPONENT_CAPS) checkComponentCap(script, capRule, findings);
  checkStarburstNumericHeadline(script, findings);

  return findings;
}

interface ComponentCap {
  component: string;
  cap: number;
  rule: Finding["rule"];
  message: string;
}

// 컴포넌트별 영상당 하드캡 — 톤 리스크가 있는 비주얼을 N개로 제한한다.
// 정적 마커(DecisionMatrix/EmojiMark)는 캡 없음 — 톤 클래시가 낮다.
const COMPONENT_CAPS: ComponentCap[] = [
  // 애니메이션 이모지(ReactionBeat, Tier2 비디오) 1개 — 3D 만화 톤 리스크.
  {
    component: "ReactionBeat",
    cap: 1,
    rule: "animated-emoji-cap",
    message:
      "애니메이션 이모지(ReactionBeat)는 영상당 1개 하드캡(3D 만화 톤 리스크). 가장 강한 리액션 1개만 남기고 나머지는 정적 마커(DecisionMatrix)로 바꿔라.",
  },
  // 스타버스트 리빌(StarburstReveal, Tier2 WebGL 광선) 2개 — 레트로 광선 톤 리스크.
  //
  {
    component: "StarburstReveal",
    cap: 2,
    rule: "starburst-cap",
    message:
      "스타버스트 리빌(StarburstReveal)은 영상당 2개 하드캡(레트로 광선 톤 리스크). 가장 강한 키워드·펀치라인 1~2개만 남기고 나머지는 HighlightedLine으로 바꿔라.",
  },
];

// cap을 넘은 (cap+1)번째 인스턴스부터 그 라인에 경고. 명시적 인스턴스만 세고 carry-forward는 무관.
function checkComponentCap(script: Script, spec: ComponentCap, out: Finding[]): void {
  const hits = script.lines
    .map((line, idx) => ({ line, idx }))
    .filter(({ line }) => line.visual?.component === spec.component);
  if (hits.length <= spec.cap) return;
  for (const { line, idx } of hits.slice(spec.cap)) {
    out.push({
      lineId: line.id,
      lineIndex: idx,
      where: `visual:${spec.component}`,
      rule: spec.rule,
      severity: "warn",
      snippet: `${spec.component} ×${hits.length}`,
      message: spec.message,
    });
  }
}

// 숫자만 든 StarburstReveal headline 경고 — 레트로 hype 광선이 수치의 권위·신뢰를 깎는다
// (심야 홈쇼핑 느낌). 숫자·성과는 StatHero(클린 거대 숫자 + CountUp)가 정답. StarburstReveal은
// 키워드·펀치라인 전용. 숫자가 섞인 "구"(예: "3배 빠르게")는 OK — 순수 숫자+단위만 잡는다.
function checkStarburstNumericHeadline(script: Script, out: Finding[]): void {
  script.lines.forEach((line, idx) => {
    if (line.visual?.component !== "StarburstReveal") return;
    const headline = line.visual.props.headline;
    if (!isNumericHeadline(headline)) return;
    out.push({
      lineId: line.id,
      lineIndex: idx,
      where: "visual:StarburstReveal.headline",
      rule: "starburst-numeric-headline",
      severity: "warn",
      snippet: headline,
      message:
        "StarburstReveal headline이 사실상 숫자뿐이다. 레트로 광선이 수치의 권위를 깎는다(hype 톤). 성과·수치는 StatHero(클린 거대 숫자 + 카운트업)로 바꿔라. StarburstReveal은 키워드·펀치라인 전용.",
    });
  });
}

// headline이 "사실상 숫자+단위뿐"인지. 숫자가 없으면 false(키워드). 숫자·기호·통화·흔한 단위와
// 영문 약어(M/K/ARR 등)를 떼고 나서 남는 실질 한글 단어가 없으면 numeric-only로 본다.
const NUMERIC_UNITS = "배분초원억만천개명위점일주달년퍼센트시간프로";
function isNumericHeadline(h: string): boolean {
  if (!/\d/.test(h)) return false;
  const stripped = h
    .replace(/[\d\s.,%$₩+\-/x×()~]/gi, "")
    .replace(new RegExp(`[${NUMERIC_UNITS}]`, "g"), "")
    .replace(/[a-z]/gi, ""); // M·K·ARR 같은 영문 단위/약어
  return stripped.length === 0;
}

export interface LintSummary {
  error: number;
  warn: number;
  info: number;
  total: number;
  byRule: Record<string, number>;
}

export function summarize(findings: Finding[]): LintSummary {
  const s: LintSummary = { error: 0, warn: 0, info: 0, total: findings.length, byRule: {} };
  for (const f of findings) {
    s[f.severity] += 1;
    s.byRule[f.rule] = (s.byRule[f.rule] ?? 0) + 1;
  }
  return s;
}

// ── 컴포넌트 다양성 (whole-video) ──────────────────────────────────────────
//
// 운영자 피드백: 영상이 단조롭다 — 한 컴포넌트(주로 HighlightedLine)가 화면을 독식하고
// 카탈로그 19종 중 소수만 등장한다. /script 의사결정 트리가 greedy "first-match-wins"라
// 구조적으로 수렴하기 때문(실측 내부 파일럿 58샷: 7종만·HighlightedLine 34%·image-first 0).
// 여기서 carry-forward를 해소해 *시청자가 실제로 보는* 컴포넌트 분포를 측정하고,
// 과소-다양성을 권고(warn) 수준으로 경고한다 — 하드 게이트가 아니다(부적합 컴포넌트를
// 다양성 채우려 억지로 끼워넣는 역효과 회피). 운영자가 리포트를 보고 판단.

export const IMAGE_FIRST_COMPONENTS = new Set<VisualSpec["component"]>([
  "HeroImage",
  "SplitVisual",
  "ScreenshotCallout",
]);

// 짧은 스크립트(테스트·아주 짧은 영상)는 다양성 통계가 무의미 — 이 미만이면 스킵.
const DIVERSITY_MIN_LINES = 16;
// 10~15분 영상이 쓸 수 있는 distinct 컴포넌트 바닥(짧은 영상은 길이에 비례해 완화).
const DISTINCT_FLOOR = 8;
// 단일 컴포넌트가 차지해도 되는 최대 shot 점유율(초과 시 "독식").
export const DOMINANT_SHARE_MAX = 0.25;
// 같은 컴포넌트의 *서로 다른 인스턴스*가 연속 노출돼도 되는 최대 개수.
// carry-forward(한 비주얼을 여러 라인 hold)는 인스턴스 1개라 여기 안 걸린다 —
// 그건 carry-forward 30초 규칙의 영역. 여기선 "다른 다이어그램 5개 연속" 같은 단조 클러스터만.
const SAME_COMPONENT_RUN_MAX = 3;

// ── 씬별 분량 예산 (결정적 분량 게이트) ──────────────────────────────────────
// Supertonic speed 1.4 실측 ≈ 9자/초. 한 씬 예산 = duration_sec × 9.
// 주의: chars는 transliterate 적용 전 `line.text.length`다(TTS는 transliterate(text)를 합성).
//   한글 위주 내레이션은 차이가 미미하나 영어 약어 많은 라인은 음차 확장만큼 약간 드리프트한다.
// 단일 패스 /script는 프롬프트에 씬별 예산을 줘도 누적 분량을 못 느껴 ~60%로 미달하는
// 경향이 끈질기다(실측: baseline 62% / 예산 주입 후에도 58%). 그래서 프롬프트 자가점검이
// 아니라 *코드가 세어* 90% 미달 씬을 플래그하는 결정적 점검으로 잡는다.
export const CHARS_PER_SEC = 9;
const UNDER_BUDGET_RATIO = 0.9;
const SCENE_PREFIX_RE = /^(scene\d+)-/;

export interface SceneLengthRow {
  sceneId: string;
  beat: string;
  durationSec: number;
  /** 예산 = round(durationSec × CHARS_PER_SEC). */
  budget: number;
  /** 이 씬 라인들의 내레이션(text) 글자수 합. */
  chars: number;
  lines: number;
  /** chars / budget. */
  pct: number;
  /** budget의 90% 미만(예산 0 제외). */
  underBudget: boolean;
}

export interface SceneLengthReport {
  /** treatment에 씬이 있는가. false면 검사 스킵. */
  applies: boolean;
  rows: SceneLengthRow[];
  totalChars: number;
  totalBudget: number;
  totalPct: number;
  /** 예산 90% 미달 씬 수. */
  underBudgetCount: number;
  /** treatment에 있으나 라인이 하나도 없는 씬 id. */
  emptyScenes: string[];
  /** line.id의 "sceneNN-" 접두사가 treatment 씬에 매칭되지 않는 라인 수. */
  orphanLines: number;
}

/**
 * 씬별 내레이션 글자수를 treatment 예산(duration_sec × 9)과 대조한다.
 * 단일 패스 /script의 끈질긴 분량 미달(실측 ~60%)을 결정적으로 잡는 게이트 —
 * line.id의 "sceneNN-" 접두사로 그룹핑하므로 storyboard 평탄화 전 script.json에 바로 적용된다.
 * lintScript/analyzeDiversity와 별개의 whole-video 분석(분량 축).
 */
export function analyzeSceneLength(script: Script, treatment: Treatment): SceneLengthReport {
  const charsByScene = new Map<string, number>();
  const linesByScene = new Map<string, number>();
  const treatmentIds = new Set(treatment.scenes.map((s) => s.id));
  let orphanLines = 0;
  for (const line of script.lines) {
    const sid = line.id.match(SCENE_PREFIX_RE)?.[1];
    if (!sid || !treatmentIds.has(sid)) {
      orphanLines++;
      continue;
    }
    charsByScene.set(sid, (charsByScene.get(sid) ?? 0) + line.text.length);
    linesByScene.set(sid, (linesByScene.get(sid) ?? 0) + 1);
  }

  const rows: SceneLengthRow[] = treatment.scenes.map((s) => {
    const chars = charsByScene.get(s.id) ?? 0;
    const budget = Math.round(s.duration_sec * CHARS_PER_SEC);
    const pct = budget > 0 ? chars / budget : 0;
    return {
      sceneId: s.id,
      beat: s.beat,
      durationSec: s.duration_sec,
      budget,
      chars,
      lines: linesByScene.get(s.id) ?? 0,
      pct,
      underBudget: budget > 0 && pct < UNDER_BUDGET_RATIO,
    };
  });

  const totalChars = rows.reduce((a, r) => a + r.chars, 0);
  const totalBudget = rows.reduce((a, r) => a + r.budget, 0);
  return {
    applies: treatment.scenes.length > 0,
    rows,
    totalChars,
    totalBudget,
    totalPct: totalBudget > 0 ? totalChars / totalBudget : 0,
    underBudgetCount: rows.filter((r) => r.underBudget).length,
    emptyScenes: rows.filter((r) => r.chars === 0).map((r) => r.sceneId),
    orphanLines,
  };
}

export type DiversitySeverity = "warn" | "info";

export interface DiversityFlag {
  kind: "distinct" | "dominant" | "run" | "image-first" | "glitch";
  severity: DiversitySeverity;
  message: string;
}

export interface DiversityReport {
  /** min-lines 가드 통과 여부. false면 검사 스킵(짧은 스크립트). */
  applies: boolean;
  totalLines: number;
  /** carry-forward 해소 후 등장하는 distinct 컴포넌트 수. */
  distinct: number;
  /** distinct 권장 바닥(영상 길이에 비례해 완화된 실효 임계). */
  distinctFloor: number;
  /** 컴포넌트별 등장 shot 수(내림차순) + 점유율. */
  counts: { component: string; count: number; share: number }[];
  /** image-first 씬(HeroImage/SplitVisual/ScreenshotCallout) shot 수. */
  imageFirst: number;
  /** 같은 컴포넌트 인스턴스가 가장 길게 연속된 run. */
  longestRun: {
    component: string;
    instances: number;
    startIndex: number;
    startLineId: string;
  } | null;
  flags: DiversityFlag[];
}

interface EffectiveLine {
  component: VisualSpec["component"] | null;
  /** 이 라인이 새 비주얼 인스턴스를 명시했나(아니면 직전 visual을 carry-forward). */
  explicit: boolean;
  lineId: string;
}

// carry-forward 해소: visual 생략 라인은 직전 visual 컴포넌트를 잇는다.
function effectiveComponents(script: Script): EffectiveLine[] {
  let prev: VisualSpec["component"] | null = null;
  return script.lines.map((line) => {
    if (line.visual) {
      prev = line.visual.component;
      return { component: prev, explicit: true, lineId: line.id };
    }
    return { component: prev, explicit: false, lineId: line.id };
  });
}

/**
 * carry-forward를 해소해 시청자가 실제로 보는 컴포넌트 분포를 측정하고,
 * 과소-다양성(소수 종 편중·독식·동일 컴포넌트 연속·image-first 부재)을 경고한다.
 * per-line findings(lintScript)와 별개의 whole-video 분석.
 */
export function analyzeDiversity(script: Script): DiversityReport {
  const eff = effectiveComponents(script);
  const totalLines = eff.length;

  const countMap = new Map<string, number>();
  for (const e of eff) {
    if (!e.component) continue;
    countMap.set(e.component, (countMap.get(e.component) ?? 0) + 1);
  }
  const counted = [...countMap.values()].reduce((a, b) => a + b, 0);
  const counts = [...countMap.entries()]
    .map(([component, count]) => ({ component, count, share: counted ? count / counted : 0 }))
    .sort((a, b) => b.count - a.count);

  const distinct = counts.length;
  const imageFirst = counts
    .filter((c) => IMAGE_FIRST_COMPONENTS.has(c.component as VisualSpec["component"]))
    .reduce((a, c) => a + c.count, 0);

  // 같은 컴포넌트 *인스턴스*(explicit) 연속 run 중 가장 긴 것.
  let longestRun: DiversityReport["longestRun"] = null;
  let i = 0;
  while (i < eff.length) {
    const comp = eff[i]!.component;
    if (!comp) {
      i += 1;
      continue;
    }
    let j = i;
    let instances = 0;
    while (j < eff.length && eff[j]!.component === comp) {
      if (eff[j]!.explicit) instances += 1;
      j += 1;
    }
    if (!longestRun || instances > longestRun.instances) {
      longestRun = { component: comp, instances, startIndex: i, startLineId: eff[i]!.lineId };
    }
    i = j;
  }

  // 짧은 영상은 distinct 바닥을 길이에 비례해 완화(16라인→4, 40+라인→8).
  const distinctFloor = Math.min(DISTINCT_FLOOR, Math.max(2, Math.ceil(totalLines / 5)));

  const flags: DiversityFlag[] = [];
  const applies = totalLines >= DIVERSITY_MIN_LINES;
  if (applies) {
    if (distinct < distinctFloor) {
      flags.push({
        kind: "distinct",
        severity: "warn",
        message: `컴포넌트 ${distinct}종만 등장(권장 ≥${distinctFloor}). 카탈로그 19종 중 일부만 쓰여 단조롭다 — 안 쓴 컴포넌트(StatHero·SplitVisual·HeroImage·TerminalCard 등)를 적극 끼워라.`,
      });
    }
    const top = counts[0];
    if (top && top.share > DOMINANT_SHARE_MAX) {
      flags.push({
        kind: "dominant",
        severity: "warn",
        message: `${top.component}가 전체 shot의 ${(top.share * 100).toFixed(0)}%를 독식(권장 ≤${(DOMINANT_SHARE_MAX * 100).toFixed(0)}%, ${top.count}/${counted}). 일부 라인을 인접한 다른 컴포넌트로 교체해 분산하라.`,
      });
    }
    if (longestRun && longestRun.instances > SAME_COMPONENT_RUN_MAX) {
      flags.push({
        kind: "run",
        severity: "warn",
        message: `${longestRun.component} 인스턴스 ${longestRun.instances}개 연속(#${longestRun.startIndex} ${longestRun.startLineId}부터, 권장 ≤${SAME_COMPONENT_RUN_MAX}). 서로 다른 컴포넌트로 결을 끊어라.`,
      });
    }
    if (imageFirst === 0) {
      flags.push({
        kind: "image-first",
        severity: "warn",
        message: `image-first 씬(SplitVisual/HeroImage/ScreenshotCallout)이 0개. 정책상 사례·제품은 배경(StockBg)보다 본문 이미지가 우선 — 최소 1~2개 도입.`,
      });
    }
    // GlitchTransition: 영상당 최소 1회 필수(가장 강한 반전·임팩트 모먼트), 최대 2회.
    const glitch = counts.find((c) => c.component === "GlitchTransition")?.count ?? 0;
    if (glitch === 0) {
      flags.push({
        kind: "glitch",
        severity: "warn",
        message: `GlitchTransition이 0회 — 영상당 최소 1회 필수. 가장 강한 반전·"잘못된 X" 임팩트 한 줄을 GlitchTransition으로.`,
      });
    } else if (glitch > 2) {
      flags.push({
        kind: "glitch",
        severity: "warn",
        message: `GlitchTransition ${glitch}회 — 과사용(권장 ≤2). 산만해지니 가장 강한 1~2개만 남겨라.`,
      });
    }
  }

  return {
    applies,
    totalLines,
    distinct,
    distinctFloor,
    counts,
    imageFirst,
    longestRun,
    flags,
  };
}
