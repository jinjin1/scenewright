import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { z } from "zod";
import { StoryboardSchema } from "../../schemas/storyboard.js";
import { BulletList } from "../scenes/BulletList.js";
import { Captions } from "../scenes/Captions.js";
import { DecisionMatrix } from "../scenes/DecisionMatrix.js";
import { FlowDiagram } from "../scenes/FlowDiagram.js";
import { ReactionBeat } from "../scenes/ReactionBeat.js";
import { HeroImage } from "../scenes/HeroImage.js";
import { HighlightedLine } from "../scenes/HighlightedLine.js";
import { LineCard } from "../scenes/LineCard.js";
import { ProgressiveList } from "../scenes/ProgressiveList.js";
import { ScreenshotCallout } from "../scenes/ScreenshotCallout.js";
import { SplitVisual } from "../scenes/SplitVisual.js";
import { StarburstReveal } from "../scenes/StarburstReveal.js";
import { StatHero } from "../scenes/StatHero.js";
import { StockBg } from "../scenes/StockBg.js";
import { GlitchTransition } from "../scenes/GlitchTransition.js";
import { PixelTitle } from "../scenes/PixelTitle.js";
import { PixelBarChart } from "../scenes/PixelBarChart.js";
import { PixelDonut } from "../scenes/PixelDonut.js";
import { PixelGauge } from "../scenes/PixelGauge.js";
import { PixelStepTracker } from "../scenes/PixelStepTracker.js";
import { PixelRoadmap } from "../scenes/PixelRoadmap.js";
import { SweepDivider } from "../scenes/SweepDivider.js";
import { TerminalCard } from "../scenes/TerminalCard.js";
import { TitleCard } from "../scenes/TitleCard.js";
import {
  buildStockSegments,
  buildTransitionLayout,
  groupConsecutiveByVisual,
  shotStartFrames,
} from "./utils.js";
import { boundaryPresentations } from "./transitions.js";

// 그룹 경계 크로스페이드 기본 길이 (~0.35s). buildTransitionLayout이 짧은 그룹에선 클램프.
const TRANSITION_BASE_FRAMES = 10;

export const EpisodePropsSchema = z.object({
  storyboard: StoryboardSchema,
  // shot.audio_ref는 episode 폴더 기준 상대 경로 — preview/render 시 prefix 주입.
  audioBaseUrl: z.string().default(""),
  // stock manifest에서 shot index → 다운로드된 미디어 URL 목록 (B-roll 멀티컷).
  stockSrcByShotIndex: z.record(z.string(), z.array(z.string())).default({}),
  // shot index → 화면 하단 자막 텍스트. /render 어댑터가 script.json에서 추출.
  captions: z.array(z.string()).default([]),
});

export type EpisodeProps = z.infer<typeof EpisodePropsSchema>;

export function Episode({
  storyboard,
  audioBaseUrl,
  stockSrcByShotIndex,
  captions,
}: EpisodeProps) {
  const fps = storyboard.meta.fps;
  const transition = storyboard.meta.transition;
  const groups = groupConsecutiveByVisual(storyboard);
  const starts = shotStartFrames(storyboard);
  const layout = buildTransitionLayout(groups, transition, TRANSITION_BASE_FRAMES);

  // captions cues: shot index → {startFrame, endFrame, text}. 절대 프레임 — 전환 무관.
  const cues = storyboard.shots.map((shot, i) => {
    const startFrame = starts[i] ?? 0;
    const frames = Math.max(1, Math.round(shot.duration_sec * fps));
    return {
      startFrame,
      endFrame: startFrame + frames,
      text: captions[i] ?? "",
    };
  });

  // 경계별 전환 presentation. 단일 공유 대신 경계 의미(scene 바뀜)·종류별 서수로 회전.
  // "varied"가 아니면 모든 경계가 같은 고정 presentation(back-compat). 인덱스는 그룹 경계
  // gi와 1:1 (presentations[gi] = 그룹 gi 뒤 전환).
  const presentations = boundaryPresentations(groups, transition, {
    width: storyboard.meta.width,
    height: storyboard.meta.height,
  });

  // 시각 트랙: 그룹들을 TransitionSeries로. 각 그룹 시퀀스는 콘텐츠 길이 + 뒤따르는
  // 전환 길이(tail)만큼 늘려, 크로스페이드 겹침에도 그룹 시작이 절대 오디오와 정렬됨.
  const visualChildren: React.ReactNode[] = [];
  groups.forEach((group, gi) => {
    const gl = layout.groups[gi]!;
    const tail = gl.transitionAfter;
    const shot = group.representative;

    // component → 씬 매핑. switch + never default로 **컴파일 타임 완전성 보장**:
    // 스키마 union에 component를 추가하고 여기 case를 빠뜨리면 tsc가 막는다(조용한 빈 화면 방지).
    let scene: React.ReactNode = null;
    switch (shot.component) {
      case "TitleCard":
        scene = <TitleCard {...shot.props} />;
        break;
      case "BulletList":
        scene = <BulletList {...shot.props} />;
        break;
      case "HighlightedLine":
        scene = <HighlightedLine {...shot.props} />;
        break;
      case "ProgressiveList":
        scene = <ProgressiveList {...shot.props} />;
        break;
      case "StatHero":
        scene = <StatHero {...shot.props} />;
        break;
      case "SweepDivider":
        scene = <SweepDivider {...shot.props} />;
        break;
      case "TerminalCard":
        scene = <TerminalCard {...shot.props} />;
        break;
      case "GlitchTransition":
        scene = <GlitchTransition {...shot.props} />;
        break;
      case "PixelTitle":
        scene = <PixelTitle {...shot.props} />;
        break;
      case "FlowDiagram":
        scene = <FlowDiagram {...shot.props} />;
        break;
      case "PixelBarChart":
        scene = <PixelBarChart {...shot.props} />;
        break;
      case "PixelDonut":
        scene = <PixelDonut {...shot.props} />;
        break;
      case "PixelGauge":
        scene = <PixelGauge {...shot.props} />;
        break;
      case "PixelStepTracker":
        scene = <PixelStepTracker {...shot.props} />;
        break;
      case "PixelRoadmap":
        scene = <PixelRoadmap {...shot.props} />;
        break;
      case "DecisionMatrix":
        scene = <DecisionMatrix {...shot.props} />;
        break;
      case "ReactionBeat":
        scene = <ReactionBeat {...shot.props} />;
        break;
      case "StarburstReveal":
        scene = <StarburstReveal {...shot.props} />;
        break;
      case "HeroImage": {
        // image-first 씬은 그룹 시작 shot의 첫 자산 1장을 받는다 (없으면 텍스트 폴백).
        const src = (stockSrcByShotIndex[String(group.startIndex)] ?? [])[0];
        scene = (
          <HeroImage {...shot.props} src={src} durationInFrames={gl.seqDuration} />
        );
        break;
      }
      case "SplitVisual": {
        const src = (stockSrcByShotIndex[String(group.startIndex)] ?? [])[0];
        scene = (
          <SplitVisual {...shot.props} src={src} durationInFrames={gl.seqDuration} />
        );
        break;
      }
      case "ScreenshotCallout": {
        const src = (stockSrcByShotIndex[String(group.startIndex)] ?? [])[0];
        scene = (
          <ScreenshotCallout
            {...shot.props}
            src={src}
            durationInFrames={gl.seqDuration}
          />
        );
        break;
      }
      case "StockBg": {
        // 그룹 내 shot별 자산을 duration·minHold에 맞춰 컷 세그먼트로 분해.
        // 자산 0건이면 빈 화면 대신 LineCard로 라인 텍스트를 큰 글씨로 표시.
        const segments = buildStockSegments(
          group,
          stockSrcByShotIndex,
          Math.round(3 * fps),
        );
        if (segments.length > 0) {
          // 전환 꼬리(tail) 동안 마지막 컷을 hold — 크로스페이드 중 빈 화면 방지.
          if (tail > 0) {
            const lastSeg = segments[segments.length - 1]!;
            lastSeg.durationInFrames += tail;
          }
          scene = <StockBg {...shot.props} segments={segments} />;
        } else {
          const groupTexts = group.shots.map(
            (_, j) => captions[group.startIndex + j] ?? "",
          );
          scene = (
            <LineCard
              texts={groupTexts}
              shotStartFrames={group.shotStartFrames}
              fallbackColor={shot.props.fallback_color}
            />
          );
        }
        break;
      }
      default: {
        const _exhaustive: never = shot;
        void _exhaustive;
      }
    }

    visualChildren.push(
      <TransitionSeries.Sequence
        key={`group-${group.startIndex}`}
        durationInFrames={gl.seqDuration}
      >
        {scene}
      </TransitionSeries.Sequence>,
    );
    // 전환은 마지막 그룹 뒤엔 없음 (transitionAfter === 0).
    if (tail > 0) {
      visualChildren.push(
        <TransitionSeries.Transition
          key={`transition-${group.startIndex}`}
          timing={linearTiming({ durationInFrames: tail })}
          presentation={presentations[gi]!}
        />,
      );
    }
  });

  return (
    <AbsoluteFill>
      <TransitionSeries>{visualChildren}</TransitionSeries>

      {/* 오디오 트랙: 샷별 절대 위치. 전환 겹침과 독립이라 내레이션 타이밍 보존. */}
      {storyboard.shots.map((shot, i) => {
        const audioFrames = Math.max(1, Math.round(shot.duration_sec * fps));
        const audioSrc = audioBaseUrl
          ? `${audioBaseUrl}/${shot.audio_ref}`
          : staticFile(shot.audio_ref);
        return (
          <Sequence
            key={`audio-${i}`}
            from={starts[i] ?? 0}
            durationInFrames={audioFrames}
          >
            <Audio src={audioSrc} />
          </Sequence>
        );
      })}

      <Captions cues={cues} />
    </AbsoluteFill>
  );
}
