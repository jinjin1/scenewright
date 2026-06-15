import { z } from "zod";

export const TitleCardPropsSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  eyebrow: z.string().optional(),
});

export const BulletListPropsSchema = z.object({
  heading: z.string().optional(),
  items: z.array(z.string().min(1)).min(2).max(7),
});

export const StockBgPropsSchema = z.object({
  kind: z.enum(["video", "photo", "color"]),
  fallback_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "fallback_color must be a 6-digit hex like #1a1a1a")
    .optional(),
});

// HighlightedLine — 한 문장 + rough.js 형광펜 강조 키워드. explainer 영상의 "라인 카드" 대체.
export const HighlightedLinePropsSchema = z.object({
  text: z.string().min(1),
  highlights: z.array(z.string().min(1)).min(1).max(4),
  eyebrow: z.string().optional(),
  variant: z.enum(["marker", "underline"]).default("marker"),
  firstHighlightFrame: z.number().int().nonnegative().optional(),
  highlightStepFrames: z.number().int().positive().optional(),
});

// ProgressiveList — BulletList 대체. spring 진입 + 항목별 진입 시점 커스터마이즈.
export const ProgressiveListPropsSchema = z.object({
  heading: z.string().optional(),
  items: z.array(z.string().min(1)).min(2).max(7),
  eyebrow: z.string().optional(),
  itemStartFrames: z.array(z.number().int().nonnegative()).optional(),
  firstItemFrame: z.number().int().nonnegative().optional(),
  itemStepFrames: z.number().int().positive().optional(),
});

// PixelTitle — 픽셀 블록 채널 인트로 / 섹션 디바이더. 영문/숫자 권장.
export const PixelTitlePropsSchema = z.object({
  label: z.string().min(1),
  subtitle: z.string().optional(),
  accentColors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
  letterStaggerFrames: z.number().int().positive().optional(),
  pixelSize: z.number().int().positive().optional(),
});

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "fallback_color must be a 6-digit hex like #1a1a1a");

// HeroImage — 풀블리드 Ken Burns 이미지 + 제목/캡션 오버레이. 미디어를 *본문*으로 세운다.
// 자산은 StockBg와 동일하게 broll_keywords로 stock에서 수집(1장). 자산 0건이면 씬이 텍스트로 폴백.
export const HeroImagePropsSchema = z.object({
  title: z.string().optional(),
  caption: z.string().optional(),
  eyebrow: z.string().optional(),
  kind: z.enum(["photo", "video"]).default("photo"),
  overlay: z.enum(["bottom", "left", "full"]).default("bottom"),
  fallback_color: hexColor.optional(),
});

// SplitVisual — 이미지 절반 + 텍스트 절반. 정의/설명을 그 사례 이미지와 나란히.
// items가 있으면 불릿, 없으면 body 문단. 자산 0건이면 텍스트가 풀폭으로 폴백.
export const SplitVisualPropsSchema = z.object({
  heading: z.string().optional(),
  body: z.string().optional(),
  items: z.array(z.string().min(1)).max(5).optional(),
  eyebrow: z.string().optional(),
  image_side: z.enum(["left", "right"]).default("right"),
  kind: z.enum(["photo", "video"]).default("photo"),
  fallback_color: hexColor.optional(),
});

// ScreenshotCallout — 실제 제품 UI 스크린샷을 프레임에 담고 특정 영역을 주석으로 지목.
// 보통 큐레이션 라이브러리 자산(image_ref)으로 채워진다. Ken Burns 미사용(UI는 읽혀야 함).
// 자산 0건이면 title/caption 텍스트로 폴백.
export const ScreenshotCalloutPropsSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
  // 스샷 둘레 크롬: browser(상단 바)·window(테두리+그림자)·none.
  frame: z.enum(["browser", "window", "none"]).default("browser"),
  // UI는 보통 contain(크롭 금지). 풀블리드가 필요하면 cover.
  fit: z.enum(["contain", "cover"]).default("contain"),
  // 스샷 위 정규화(0~1) 하이라이트 박스 — 특정 UI 영역을 staggered로 지목.
  annotations: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0).max(1),
        h: z.number().min(0).max(1),
        label: z.string().optional(),
      }),
    )
    .max(4)
    .optional(),
  fallback_color: hexColor.optional(),
});

// FlowDiagram — 라벨 노드 2~6개를 화살표로 연결하는 다이어그램. 화살표가 evolvePath로
// 그려지며 항목 *사이의 흐름/인과*를 보여준다(퍼널·유저 저니·파이프라인·프레임워크 단계).
// 단순 나열은 ProgressiveList, 흐름이 있으면 FlowDiagram.
export const FlowDiagramPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  // vertical = 위→아래(흐름/퍼널), horizontal = 좌→우(파이프라인).
  orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
  nodes: z
    .array(
      z.object({
        label: z.string().min(1),
        sublabel: z.string().optional(),
      }),
    )
    .min(2)
    .max(6),
  // arrow = 화살촉 있음, line = 단순 선.
  connector: z.enum(["arrow", "line"]).default("arrow"),
  fallback_color: hexColor.optional(),
});

// PixelBarChart — 픽셀 막대차트. 수치 배열의 비교/추이를 레트로 결로. 최댓값(또는
// highlightIndex) 막대를 앰버로 강조. 거대 단일 숫자는 StatHero, 흐름/단계는 FlowDiagram.
export const PixelBarChartPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  caption: z.string().optional(),
  bars: z
    .array(
      z.object({
        label: z.string().optional(),
        value: z.number().nonnegative(),
      }),
    )
    .min(2)
    .max(8),
  // 강조할 막대 index. 생략 시 최댓값 막대 자동 강조.
  highlightIndex: z.number().int().nonnegative().optional(),
  fallback_color: hexColor.optional(),
});

// PixelDonut — 단일 비율(달성률·점유율 등)을 픽셀 도넛 % 링으로. 가운데 % 숫자.
export const PixelDonutPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  percent: z.number().min(0).max(100),
  caption: z.string().optional(),
  fallback_color: hexColor.optional(),
});

// PixelGauge — 점수/역량/충족도(value/max)를 픽셀 세그먼트 칸으로. 비율별 색(빨강/앰버/그린).
export const PixelGaugePropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  label: z.string().optional(),
  value: z.number().nonnegative(),
  max: z.number().int().positive().default(10),
  caption: z.string().optional(),
  fallback_color: hexColor.optional(),
}).refine((d) => d.value <= d.max, {
  message: "PixelGauge value must be <= max",
  path: ["value"],
});

// PixelStepTracker — 선형 단계 진행(완료/현재/예정). 분기 없는 프로세스/체크리스트.
export const PixelStepTrackerPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  steps: z.array(z.string().min(1)).min(2).max(7),
  currentIndex: z.number().int().nonnegative(),
  fallback_color: hexColor.optional(),
}).refine((d) => d.currentIndex < d.steps.length, {
  message: "PixelStepTracker currentIndex must be < steps.length",
  path: ["currentIndex"],
});

// PixelRoadmap — 마일스톤 여정 맵(지그재그). 위치는 개수에서 자동 계산. 장기 로드맵·여정.
export const PixelRoadmapPropsSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  milestones: z.array(z.object({ label: z.string().min(1) })).min(2).max(6),
  currentIndex: z.number().int().nonnegative(),
  fallback_color: hexColor.optional(),
}).refine((d) => d.currentIndex < d.milestones.length, {
  message: "PixelRoadmap currentIndex must be < milestones.length",
  path: ["currentIndex"],
});

// GlitchTransition — RGB shift + slice displacement transition. 0.5~1초 짧게.
export const GlitchTransitionPropsSchema = z.object({
  eyebrow: z.string().optional(),
  label: z.string().min(1),
  intensity: z.number().min(0).max(1).default(0.7),
  burstFrames: z.number().int().positive().default(24),
});

// TerminalCard — 빈티지 CRT 터미널. SQL/CLI/로그 출력에 사용.
export const TerminalCardPropsSchema = z.object({
  lines: z
    .array(
      z.object({
        kind: z.enum(["prompt", "output", "comment"]),
        text: z.string().min(1),
      }),
    )
    .min(1)
    .max(12),
  perLineStartFrames: z.array(z.number().int().nonnegative()).optional(),
  charsPerFrame: z.number().positive().optional(),
  tone: z.enum(["amber", "green", "white"]).default("amber"),
  windowTitle: z.string().optional(),
});

// SweepDivider — 섹션 transition shot. yellow sweep line + eyebrow + 큰 label.
export const SweepDividerPropsSchema = z.object({
  eyebrow: z.string().optional(),
  label: z.string().min(1),
  caption: z.string().optional(),
});

// StatHero — 거대 숫자 + 라벨. CountUp 애니메이션 내장.
export const StatHeroPropsSchema = z.object({
  value: z.number(),
  from: z.number().default(0),
  decimals: z.number().int().min(0).max(3).default(0),
  eyebrow: z.string().optional(),
  caption: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  suffixSize: z.enum(["match", "small"]).default("small"),
  countDurationFrames: z.number().int().positive().optional(),
  // slot-machine scramble 효과
  scramble: z.boolean().default(false),
  // 카운트업 착지 순간 파티클 stagger+spring 버스트(승자/정답 reveal 악센트). storyboard로 carry.
  burst: z.boolean().optional(),
});

// DecisionMatrix — 판정/의사결정 매트릭스. 각 행에 의미 마커 이모지(Tier1, 정적 Twemoji SVG).
// 이모지는 "의미의 구두점"(판정·리스크·추세)일 때만 — 장식 금지. 화면 한·영 병기(ko + en?),
// 내레이션(line.text)엔 이모지 절대 금지(TTS가 못 읽음).
export const DecisionMatrixPropsSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  rows: z
    .array(
      z.object({
        ko: z.string().min(1),
        en: z.string().optional(),
        // 의미 마커. _EmojiMark의 EMOJI_CODEPOINTS 키와 동기 유지(check ✅/cross ❌/warning ⚠️/up 📈/down 📉).
        verdict: z.enum(["check", "cross", "warning", "up", "down"]),
      }),
    )
    .min(2)
    .max(5),
});

// ReactionBeat — 단일 애니메이션 이모지(Tier2, @remotion/animated-emoji 비디오) + 헤드라인.
// 톤 리스크 높음(3D 만화) → **영상당 1개 하드캡**(lint:script animated-emoji-cap이 경고).
// 훅 펀치라인·결과 공개 같은 가장 강한 리액션 1순간에만. emoji는 public/에 자산 있는 것만(enum).
export const ReactionBeatPropsSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string().min(1),
  emoji: z.enum(["partying-face", "fire", "star-struck", "rocket"]),
});

// StarburstReveal — 중앙 헤드라인(**키워드·펀치라인**) 뒤 방사형 광선 후광(Tier2, @remotion/starburst
// WebGL 정적 패턴을 frame 구동). 톤 리스크 높음(레트로 광선=축하·hype 기호) → **영상당 2개 하드캡**
// (lint:script starburst-cap). 훅 반전·챕터 키워드·결론 펀치 같은 강한 1~2순간만. **수치·성과는 금지**
// — hype 광선이 숫자의 권위를 깎는다(숫자는 StatHero). lint `starburst-numeric-headline`이 숫자만 든
// headline 경고. 화면 텍스트라 한·영 병기 규칙 적용(headline/caption). 라이선스 Remotion License(attribution 의무 없음).
export const StarburstRevealPropsSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string().min(1),
  caption: z.string().optional(),
});

export const VisualSpecSchema = z.discriminatedUnion("component", [
  z.object({ component: z.literal("TitleCard"), props: TitleCardPropsSchema }),
  z.object({ component: z.literal("BulletList"), props: BulletListPropsSchema }),
  z.object({ component: z.literal("StockBg"), props: StockBgPropsSchema }),
  z.object({
    component: z.literal("HighlightedLine"),
    props: HighlightedLinePropsSchema,
  }),
  z.object({
    component: z.literal("ProgressiveList"),
    props: ProgressiveListPropsSchema,
  }),
  z.object({ component: z.literal("StatHero"), props: StatHeroPropsSchema }),
  z.object({
    component: z.literal("SweepDivider"),
    props: SweepDividerPropsSchema,
  }),
  z.object({
    component: z.literal("TerminalCard"),
    props: TerminalCardPropsSchema,
  }),
  z.object({
    component: z.literal("GlitchTransition"),
    props: GlitchTransitionPropsSchema,
  }),
  z.object({
    component: z.literal("PixelTitle"),
    props: PixelTitlePropsSchema,
  }),
  z.object({ component: z.literal("HeroImage"), props: HeroImagePropsSchema }),
  z.object({
    component: z.literal("SplitVisual"),
    props: SplitVisualPropsSchema,
  }),
  z.object({
    component: z.literal("ScreenshotCallout"),
    props: ScreenshotCalloutPropsSchema,
  }),
  z.object({
    component: z.literal("FlowDiagram"),
    props: FlowDiagramPropsSchema,
  }),
  z.object({
    component: z.literal("PixelBarChart"),
    props: PixelBarChartPropsSchema,
  }),
  z.object({
    component: z.literal("PixelDonut"),
    props: PixelDonutPropsSchema,
  }),
  z.object({
    component: z.literal("PixelGauge"),
    props: PixelGaugePropsSchema,
  }),
  z.object({
    component: z.literal("PixelStepTracker"),
    props: PixelStepTrackerPropsSchema,
  }),
  z.object({
    component: z.literal("PixelRoadmap"),
    props: PixelRoadmapPropsSchema,
  }),
  z.object({
    component: z.literal("DecisionMatrix"),
    props: DecisionMatrixPropsSchema,
  }),
  z.object({
    component: z.literal("ReactionBeat"),
    props: ReactionBeatPropsSchema,
  }),
  z.object({
    component: z.literal("StarburstReveal"),
    props: StarburstRevealPropsSchema,
  }),
]);

// id는 TTS 파이프라인에서 `${id}.wav` 파일명으로 그대로 사용됨 (cli/tts.ts).
// LLM 출력이 "../etc/passwd" 같은 path traversal로 escape하지 못하도록 좁힘.
export const ScriptLineSchema = z.object({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, "id must be alphanumeric + underscore/hyphen only"),
  text: z.string().min(1),
  // `visual`을 생략하면 직전 라인의 visual을 유지(storyboard 단계에서 carry-forward).
  visual: VisualSpecSchema.optional(),
  // StockBg가 필요한 라인에서 stock 카스케이드 검색에 쓰일 키워드 후보.
  broll_keywords: z.array(z.string().min(1)).default([]),
  // 큐레이션 라이브러리(`assets/images/library/`) 자산 파일명. 미디어 씬에서 이게
  // 지정되면 stock보다 우선해 그 자산을 쓴다(miss면 stock으로 폴백). `..` 금지·확장자
  // 필수로 path traversal 차단(id 안전 규칙과 동일 정신).
  image_ref: z
    .string()
    .regex(
      /^(?!.*\.\.)[a-zA-Z0-9][a-zA-Z0-9._/-]*\.[a-zA-Z0-9]+$/,
      "image_ref must be a safe library-relative filename (no '..', extension required)",
    )
    .optional(),
});

export const ScriptSchema = z.object({
  lines: z.array(ScriptLineSchema).min(1),
});

export type TitleCardProps = z.infer<typeof TitleCardPropsSchema>;
export type BulletListProps = z.infer<typeof BulletListPropsSchema>;
export type StockBgProps = z.infer<typeof StockBgPropsSchema>;
export type HighlightedLineProps = z.infer<typeof HighlightedLinePropsSchema>;
export type ProgressiveListProps = z.infer<typeof ProgressiveListPropsSchema>;
export type StatHeroProps = z.infer<typeof StatHeroPropsSchema>;
export type SweepDividerProps = z.infer<typeof SweepDividerPropsSchema>;
export type TerminalCardProps = z.infer<typeof TerminalCardPropsSchema>;
export type GlitchTransitionProps = z.infer<typeof GlitchTransitionPropsSchema>;
export type PixelTitleProps = z.infer<typeof PixelTitlePropsSchema>;
export type HeroImageProps = z.infer<typeof HeroImagePropsSchema>;
export type SplitVisualProps = z.infer<typeof SplitVisualPropsSchema>;
export type ScreenshotCalloutProps = z.infer<typeof ScreenshotCalloutPropsSchema>;
export type FlowDiagramProps = z.infer<typeof FlowDiagramPropsSchema>;
export type PixelBarChartProps = z.infer<typeof PixelBarChartPropsSchema>;
export type PixelDonutProps = z.infer<typeof PixelDonutPropsSchema>;
export type PixelGaugeProps = z.infer<typeof PixelGaugePropsSchema>;
export type PixelStepTrackerProps = z.infer<typeof PixelStepTrackerPropsSchema>;
export type PixelRoadmapProps = z.infer<typeof PixelRoadmapPropsSchema>;
export type DecisionMatrixProps = z.infer<typeof DecisionMatrixPropsSchema>;
export type ReactionBeatProps = z.infer<typeof ReactionBeatPropsSchema>;
export type StarburstRevealProps = z.infer<typeof StarburstRevealPropsSchema>;
export type VisualSpec = z.infer<typeof VisualSpecSchema>;
export type ScriptLine = z.infer<typeof ScriptLineSchema>;
export type Script = z.infer<typeof ScriptSchema>;
