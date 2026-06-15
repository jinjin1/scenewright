import { evolvePath } from "@remotion/paths";
import { interpolate } from "remotion";

// 공용 draw-on 헬퍼. SVG 선이 한쪽 끝에서 반대 끝으로 "그려지는" 모션을 만든다.
// FlowDiagram 연결선이 선례 — 그 인라인 로직을 추출해 다른 다이어그램·언더라인·콜아웃이
// 같은 결로 재사용한다(에피소드가 부를 때 on-demand 채택).
//
// evolvePath(@remotion/paths)는 path 문자열 길이를 해석적으로 계산 → DOM 불필요. 본 헬퍼도
// 내부 React 훅 없는 순수 함수(frame은 호출부가 useCurrentFrame으로 전달)라 직접 단위 테스트
// 가능. 비용은 interpolate 산술 + path 길이 1회 계산뿐 — 정상상태 프레임 비용 무시 가능.
// (use- 접두사는 _anim.ts useEntrance와 동일하게 진입 의미 표기일 뿐, 훅 아님.)

const DEFAULT_DRAW_FRAMES = 18;
const DEFAULT_HEAD_LEAD_FRAC = 0.2;

export interface DrawOn {
  // <path>에 그대로 전달 — strokeDasharray/strokeDashoffset로 그려진 길이를 표현.
  strokeDasharray: string;
  strokeDashoffset: number;
  // [0,1] 선이 그려진 정도.
  progress: number;
  // [0,1] 화살촉·끝장식이 나타나는 정도(끝 구간에서 팝). headLeadFrac=0이면 항상 0.
  headProgress: number;
}

export interface DrawOnOptions {
  // 그리기 시작을 늦출 프레임 수 (노드 stagger·narration 동기화).
  delayFrames?: number;
  // 선 1개가 다 그려지는 프레임 수 (기본 18 ≈ 0.6초).
  drawFrames?: number;
  // 화살촉이 도는 마지막 구간 비율 (기본 0.2 → 끝 20%에서 팝). 0이면 화살촉 없음.
  headLeadFrac?: number;
}

export function useDrawOn(
  frame: number,
  pathD: string,
  opts: DrawOnOptions = {},
): DrawOn {
  const delayFrames = opts.delayFrames ?? 0;
  const drawFrames = opts.drawFrames ?? DEFAULT_DRAW_FRAMES;
  const headLeadFrac = opts.headLeadFrac ?? DEFAULT_HEAD_LEAD_FRAC;

  const end = delayFrames + drawFrames;
  const progress = interpolate(frame, [delayFrames, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, pathD);

  const headProgress =
    headLeadFrac > 0
      ? interpolate(frame, [end - drawFrames * headLeadFrac, end], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return { strokeDasharray, strokeDashoffset, progress, headProgress };
}
