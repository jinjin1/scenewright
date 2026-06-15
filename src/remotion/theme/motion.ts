// 모션 토큰 — entry(전경 진입), ambient(배경 상시), curve(공통 곡선).
// ambient는 모든 씬이 _AmbientBg로 공통 적용 — 정지 화면이 "살아있는" 느낌.
export const motion = {
  // entry — 전경 콘텐츠 진입
  fadeInFrames: 20,
  staggerStepFrames: 6,
  bulletEnterFrames: 14,
  riseFrames: 18,
  riseDistance: 16, // px
  countUpFrames: 24,

  // ambient — 배경 상시 모션 (loop)
  ambientLoopFrames: 360, // 12s @ 30fps — 시청자가 의식 못 할 정도로 느림
  ambientScaleMax: 1.02,
  ambientDriftPx: 24, // 그라디언트 mesh가 움직이는 최대 거리

  // spring 진입 프리셋 — 선형 interpolate 진입을 물리 기반으로 교체(_anim.ts useEntrance).
  // 비용은 interpolate와 동일(프레임당 산술→transform/opacity). 과한 overshoot 금지(시선 분산).
  // gentle: overshoot 없음(제목·큰 숫자·헤딩). lively: 미세 overshoot 팝(불릿·리스트 항목).
  // lively는 ProgressiveList에서 검증된 값 {damping:12, mass:0.7, stiffness:100}.
  springs: {
    gentle: { damping: 22, mass: 1, stiffness: 120 }, // 임계 직상(overshoot 0)·스냅
    lively: { damping: 12, mass: 0.7, stiffness: 100 }, // 미세 overshoot
  },
  // 진입 기본 이동 거리 (translateY, px). riseDistance와 동일 결.
  entranceRise: 16,

  // 곡선 — CSS cubic-bezier (easeInOutQuart)
  curve: "cubic-bezier(0.77, 0, 0.175, 1)",
} as const;
