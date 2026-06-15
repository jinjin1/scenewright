import type { TransitionPresentation } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";
import { none } from "@remotion/transitions/none";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { TransitionName } from "../../schemas/storyboard.js";
import {
  resolveBoundaryTransitions,
  type TransitionKind,
  type VisualGroup,
} from "./utils.js";

// 전환 어휘 — Episode가 영상 전체에 단일 presentation(fade/wipe) 하나만 쓰던 것을
// 대체한다. 어떤 경계에 어떤 전환을 쓸지는 CC가 /storyboard에서 두 씬의 내용·무드를
// 보고 정한다(shot.transition_in). 여기는 그 이름을 presentation으로 바꾸는 순수 매핑일 뿐
// — "어디에 무엇" 판단은 resolveBoundaryTransitions(utils)에 있다(레이아웃과 단일 진실원).
//
// 렌더 비용: 7종 모두 CSS/transform/clipPath(WebGL 0). 전환은 ~10프레임 overlap 구간만
// 작동 → 정상상태 프레임 비용 불변. clockWipe/iris(clipPath 원형)는 약간 더 비싸나
// CC가 내용상 필요할 때만 써서 절제됨(셰이더 전환 film-burn 등은 미사용).

// 모든 presentation을 하나의 느슨한 타입으로 좁힌다 (혼합 presentation을 한
// TransitionSeries에 — 각 .Transition은 P를 독립 파라미터화하므로 타입 안전).
export type AnyPresentation = TransitionPresentation<Record<string, unknown>>;

const widen = <P extends Record<string, unknown>>(
  p: TransitionPresentation<P>,
): AnyPresentation => p as unknown as AnyPresentation;

// 전환 이름 → presentation. wipe/slide/flip은 차분한 고정 방향 기본.
// clockWipe/iris는 composition width/height 필수(주입).
export function presentationFor(
  name: TransitionName,
  dims: { width: number; height: number },
): AnyPresentation {
  switch (name) {
    case "fade":
      return widen(fade());
    case "slide":
      return widen(slide({ direction: "from-right" }));
    case "wipe":
      return widen(wipe({ direction: "from-left" }));
    case "flip":
      return widen(flip({ direction: "from-right" }));
    case "clockWipe":
      return widen(clockWipe({ width: dims.width, height: dims.height }));
    case "iris":
      return widen(iris({ width: dims.width, height: dims.height }));
    case "none":
      return widen(none());
    default: {
      const _exhaustive: never = name;
      void _exhaustive;
      return widen(fade());
    }
  }
}

// 각 그룹 경계의 presentation 배열 (Episode가 순서대로 map). 경계별 전환 이름은
// resolveBoundaryTransitions가 정한다(null=컷 → none placeholder, Episode가 tail 0이라 미사용).
// 길이 = max(0, groups.length - 1).
export function boundaryPresentations(
  groups: VisualGroup[],
  policy: TransitionKind,
  dims: { width: number; height: number },
): AnyPresentation[] {
  const names = resolveBoundaryTransitions(groups, policy);
  return names.map((n) => presentationFor(n ?? "none", dims));
}
