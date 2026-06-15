import { spring } from "remotion";
import { motion } from "../theme/index.js";

// 공용 spring 진입 헬퍼. 선형 interpolate(opacity+rise) 진입을 물리 기반으로 대체한다.
// 같은 컴포넌트라도 스프링으로 들어오면 "살아있는" 결 — 19종 전부의 floor를 올린다.
// 비용은 interpolate와 동일(프레임당 산술 1회 → opacity/transform만 구동, 허용 목록 내).
//
// 훅 아님(내부에 React 훅 없음) — frame/fps는 호출부가 useCurrentFrame/useVideoConfig로
// 전달한다. 순수 함수라 직접 단위 테스트 가능. (use- 접두사는 진입 의미 표기일 뿐.)

export type EntrancePreset = keyof typeof motion.springs;

export interface Entrance {
  opacity: number; // [0,1] 클램프
  translateY: number; // px. gentle은 rise→0 단조, lively는 살짝 음수로 팝 후 0
}

export interface EntranceOptions {
  // 진입 시작을 늦출 프레임 수 (stagger·narration 동기화).
  delayFrames?: number;
  // 스프링 결 (기본 gentle).
  preset?: EntrancePreset;
  // translateY 시작 거리 (기본 motion.entranceRise=16). 0이면 fade만.
  rise?: number;
}

export function useEntrance(
  frame: number,
  fps: number,
  opts: EntranceOptions = {},
): Entrance {
  const delayFrames = opts.delayFrames ?? 0;
  const preset = opts.preset ?? "gentle";
  const rise = opts.rise ?? motion.entranceRise;

  // frame < delay면 spring이 from(0)을 반환(ProgressiveList와 동일 패턴).
  const progress = spring({
    frame: frame - delayFrames,
    fps,
    config: motion.springs[preset],
  });

  const opacity = Math.min(Math.max(progress, 0), 1);
  // translateY는 raw progress로 — lively가 1을 넘으면 음수가 돼 "팝"(올라갔다 정착).
  return { opacity, translateY: (1 - progress) * rise };
}
