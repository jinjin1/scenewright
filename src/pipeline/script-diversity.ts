// 컴포넌트 다양성 (whole-video) — 파일당 한 가지 분석.
//
// 운영자 피드백: 영상이 단조롭다 — 한 컴포넌트(주로 HighlightedLine)가 화면을 독식하고
// 카탈로그 19종 중 소수만 등장한다. /script 의사결정 트리가 greedy "first-match-wins"라
// 구조적으로 수렴하기 때문(실측 내부 파일럿 58샷: 7종만·HighlightedLine 34%·image-first 0).
// 여기서 carry-forward를 해소해 *시청자가 실제로 보는* 컴포넌트 분포를 측정하고,
// 과소-다양성을 권고(warn) 수준으로 경고한다 — 하드 게이트가 아니다(부적합 컴포넌트를
// 다양성 채우려 억지로 끼워넣는 역효과 회피). 운영자가 리포트를 보고 판단.

import type { Script, VisualSpec } from "../schemas/script.js";

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
