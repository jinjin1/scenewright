import { z } from "zod";
import {
  BulletListPropsSchema,
  DecisionMatrixPropsSchema,
  FlowDiagramPropsSchema,
  GlitchTransitionPropsSchema,
  ReactionBeatPropsSchema,
  HeroImagePropsSchema,
  HighlightedLinePropsSchema,
  PixelBarChartPropsSchema,
  PixelDonutPropsSchema,
  PixelGaugePropsSchema,
  PixelRoadmapPropsSchema,
  PixelStepTrackerPropsSchema,
  PixelTitlePropsSchema,
  ProgressiveListPropsSchema,
  ScreenshotCalloutPropsSchema,
  SplitVisualPropsSchema,
  StarburstRevealPropsSchema,
  StatHeroPropsSchema,
  StockBgPropsSchema,
  SweepDividerPropsSchema,
  TerminalCardPropsSchema,
  TitleCardPropsSchema,
  safeImageRef,
} from "./script.js";

export const StoryboardMetaSchema = z.object({
  fps: z.literal(30),
  width: z.literal(1920),
  height: z.literal(1080),
  // "varied" = 경계별 다양 전환(권장, 신규 에피소드). none/fade/wipe = 단일 고정.
  // 기본값은 "fade" 유지 — 기존 storyboard.json 무변경 보장.
  transition: z.enum(["none", "fade", "wipe", "varied"]).default("fade"),
  bgm_id: z.string().nullable().default(null),
  bgm_volume: z.number().min(0).max(1).default(0.15),
});

// 개별 전환 종류 (per-boundary). meta.transition(정책)과 별개 — 이건 "이 경계에서
// 실제로 쓸 전환". /storyboard에서 CC가 두 씬의 내용·무드를 보고 고른다.
export const TransitionNameSchema = z.enum([
  "fade", // 차분한 화제 전환·부드러운 연결 (기본)
  "slide", // 같은 층위 이동 (목록, 좌우 비교)
  "wipe", // 순차/병렬 진행 (A 다음 B)
  "flip", // 반전·대조 ("잘못된 X" ↔ "올바른 X")
  "clockWipe", // 시간 경과·진행·주기 (로드맵, before→after)
  "iris", // 한 점으로 집중·줌인 (핵심 인사이트)
  "none", // 전환 없음 (하드 컷)
]);
export type TransitionName = z.infer<typeof TransitionNameSchema>;

const shotBase = {
  // 어느 treatment scene에 속하는 shot인가.
  scene_id: z.string().regex(/^scene\d{2,}$/),
  // 라인별 wav 파일 상대 경로. 예: "assets/audio/scene01-line01.wav".
  audio_ref: z.string().min(1),
  // declared duration (초). reconcile 단계가 실제 오디오 길이로 덮어씀.
  duration_sec: z.number().positive(),
  // StockBg가 필요한 shot에서 stock 카스케이드에 쓰일 키워드 (script 단계에서 carry-forward).
  broll_keywords: z.array(z.string().min(1)).default([]),
  // 큐레이션 라이브러리 자산 파일명 (script 단계에서 carry-forward). stock보다 우선.
  image_ref: safeImageRef.optional(),
  // 이 shot이 새 비주얼 그룹을 "여는" 경계에서 쓸 전환 (직전 그룹 → 이 그룹).
  // meta.transition="varied"일 때만 적용. CC가 /storyboard에서 내용 보고 고른다.
  // 생략 시 폴백: scene 바뀌면 fade, 같은 scene이면 하드 컷.
  transition_in: TransitionNameSchema.optional(),
};

export const StoryboardShotSchema = z.discriminatedUnion("component", [
  z.object({
    component: z.literal("TitleCard"),
    props: TitleCardPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("BulletList"),
    props: BulletListPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("StockBg"),
    props: StockBgPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("HighlightedLine"),
    props: HighlightedLinePropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("ProgressiveList"),
    props: ProgressiveListPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("StatHero"),
    props: StatHeroPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("SweepDivider"),
    props: SweepDividerPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("TerminalCard"),
    props: TerminalCardPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("GlitchTransition"),
    props: GlitchTransitionPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("PixelTitle"),
    props: PixelTitlePropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("HeroImage"),
    props: HeroImagePropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("SplitVisual"),
    props: SplitVisualPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("ScreenshotCallout"),
    props: ScreenshotCalloutPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("FlowDiagram"),
    props: FlowDiagramPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("PixelBarChart"),
    props: PixelBarChartPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("PixelDonut"),
    props: PixelDonutPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("PixelGauge"),
    props: PixelGaugePropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("PixelStepTracker"),
    props: PixelStepTrackerPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("PixelRoadmap"),
    props: PixelRoadmapPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("DecisionMatrix"),
    props: DecisionMatrixPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("ReactionBeat"),
    props: ReactionBeatPropsSchema,
    ...shotBase,
  }),
  z.object({
    component: z.literal("StarburstReveal"),
    props: StarburstRevealPropsSchema,
    ...shotBase,
  }),
]);

export const StoryboardSchema = z.object({
  meta: StoryboardMetaSchema,
  shots: z.array(StoryboardShotSchema).min(1),
});

export type StoryboardMeta = z.infer<typeof StoryboardMetaSchema>;
export type StoryboardShot = z.infer<typeof StoryboardShotSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;
