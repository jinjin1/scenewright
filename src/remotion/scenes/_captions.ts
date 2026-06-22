import { interpolate } from "remotion";

// 침묵 경계에서만 적용하는 기본 페이드 길이(~0.2s @30fps). 연속 자막 사이엔 하드 컷 유지.
export const CAPTION_FADE = 6;

// 자막 burn-in opacity. 순수 함수(테스트 가능) — Captions가 frame/경계 정보를 넘긴다.
//
// - gapBefore/gapAfter: 앞/뒤 cue가 비었거나(=침묵) 없을 때만 true. 이 경계에서만 페이드 →
//   첫 자막이 검은 화면에 "팝"하지 않고, 연속 발화 사이엔 매 줄 깜빡임이 없다(하드 컷=1).
// - 짧은 cue(span < 2*fade)는 fade를 span 절반으로 clamp → fadeIn/fadeOut이 겹쳐 영영 full
//   opacity에 못 닿는 일을 막는다(스키마는 duration_sec 하한이 없어 이론상 도달 가능).
export function captionOpacity(args: {
  frame: number;
  startFrame: number;
  endFrame: number;
  gapBefore: boolean;
  gapAfter: boolean;
  fade?: number;
}): number {
  const { frame, startFrame, endFrame, gapBefore, gapAfter } = args;
  const span = Math.max(0, endFrame - startFrame);
  // span의 절반을 넘지 않게 clamp. span<2면 fade=0(즉시 full) — interpolate 0폭 입력 회피도 겸함.
  const fade = Math.min(args.fade ?? CAPTION_FADE, Math.floor(span / 2));
  if (fade <= 0) return 1;

  const fadeIn = gapBefore
    ? interpolate(frame, [startFrame, startFrame + fade], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const fadeOut = gapAfter
    ? interpolate(frame, [endFrame - fade, endFrame], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  return Math.min(fadeIn, fadeOut);
}
