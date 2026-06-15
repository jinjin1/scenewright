import { interpolate, spring } from "remotion";
import { motion } from "../theme/index.js";

// 공용 파티클 버스트 헬퍼. 여러 인스턴스가 시차로 spring 진입하며 중심에서 2D로 산란한다.
// "정답"·"승자" reveal 같은 한 순간의 악센트용 (apple-wow-tutorial 파티클 stagger+spring 결).
//
// 시간축 stagger + spring 물리는 useEntrance(_anim.ts)와 같은 메커니즘 — 순수 net-new는
// **2D 공간 산란**(인덱스→각도·거리 offset)뿐이다. useEntrance/useDrawOn과 동일하게 내부에
// React 훅 없는 순수 함수(frame/fps는 호출부가 주입)라 직접 단위 테스트 가능. map으로 N개
// 인스턴스에 돌린다(ProgressiveList가 useEntrance를 부르는 패턴). 비용은 파티클당 spring 1회
// + 산술 → 정상상태 무시 가능, 파티클 수는 8~20으로 제한(렌더 예산·다크 에디토리얼 절제).
//
// 결정적(Math.random 미사용 — 렌더 재현성): 각도는 균등 링 + golden-angle, 거리 지터는
// 인덱스 기반. 같은 i는 항상 같은 위치.

export type BurstPreset = keyof typeof motion.springs;

export interface BurstParticle {
  opacity: number; // [0,1] — spring 진입 후 페이드아웃
  x: number; // 중심 기준 px offset
  y: number;
  scale: number; // 0 → 1 팝 (lively 오버슈트)
}

export interface BurstOptions {
  // 버스트가 발사되는 프레임 (보통 카운트업이 착지하는 순간).
  delayFrames?: number;
  // 각도 분배에 쓰는 전체 파티클 수 (8~20 권장). 기본 14.
  count?: number;
  // 최대 산란 거리 px. 기본 240.
  radius?: number;
  // spring 결 (기본 lively — 팝).
  preset?: BurstPreset;
  // 파티클별 진입 지연 간격 프레임 (stagger). 기본 1.
  staggerFrames?: number;
  // 바깥까지 도달하는 대략 프레임 (페이드 타이밍용). 기본 16.
  travelFrames?: number;
  // 끝까지 간 뒤 유지 프레임. 기본 10.
  holdFrames?: number;
  // 페이드아웃 길이 프레임. 기본 14.
  fadeFrames?: number;
}

const GOLDEN_ANGLE = 2.399963; // rad — 유기적 각 분포(해바라기 씨앗 패턴)
const PHI = 0.618033988749895; // 거리 지터용 무리수

export function useBurstParticle(
  frame: number,
  fps: number,
  i: number,
  opts: BurstOptions = {},
): BurstParticle {
  const delay = opts.delayFrames ?? 0;
  const count = opts.count ?? 14;
  const radius = opts.radius ?? 240;
  const preset = opts.preset ?? "lively";
  const stagger = opts.staggerFrames ?? 1;
  const travel = opts.travelFrames ?? 16;
  const hold = opts.holdFrames ?? 10;
  const fade = opts.fadeFrames ?? 14;

  const start = delay + i * stagger;

  // 바깥으로 나가는 spring 진입 — lively는 1을 살짝 넘겨 "팝".
  // frame < start면 spring이 from(0)을 반환(useEntrance와 동일 패턴).
  const progress = spring({
    frame: frame - start,
    fps,
    config: motion.springs[preset],
  });

  // 결정적 각도: 균등 링 + golden-angle offset → 기계적이지 않게 흩어진다.
  const angle = (i / count) * Math.PI * 2 + i * GOLDEN_ANGLE;
  // 결정적 거리 지터 [0.7, 1.0] — 인덱스 기반(랜덤 아님).
  const jitter = 0.7 + 0.3 * ((i * PHI) % 1);
  const dist = radius * jitter * progress;

  const x = Math.cos(angle) * dist;
  const y = Math.sin(angle) * dist;

  // 스케일 팝: progress 그대로 — lively 오버슈트가 "통통" 튀게 한다.
  const scale = Math.max(0, progress);

  // 불투명도: progress로 들어왔다가, travel+hold 뒤 페이드아웃(한 순간의 버스트).
  const fadeStart = start + travel + hold;
  const fadeOut = interpolate(frame, [fadeStart, fadeStart + fade], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(Math.max(progress, 0), 1) * fadeOut;

  return { opacity, x, y, scale };
}
