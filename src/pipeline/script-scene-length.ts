// 씬별 분량 예산 (결정적 분량 게이트) — whole-video 분석(파일당 한 가지 분석).
// lintScript(라인별)·analyzeDiversity(다양성)와 별개의 분량 축.
//
// Supertonic speed 1.4 실측 ≈ 9자/초. 한 씬 예산 = duration_sec × 9.
// 주의: chars는 transliterate 적용 전 `line.text.length`다(TTS는 transliterate(text)를 합성).
//   한글 위주 내레이션은 차이가 미미하나 영어 약어 많은 라인은 음차 확장만큼 약간 드리프트한다.
// 단일 패스 /script는 프롬프트에 씬별 예산을 줘도 누적 분량을 못 느껴 ~60%로 미달하는
// 경향이 끈질기다(실측: baseline 62% / 예산 주입 후에도 58%). 그래서 프롬프트 자가점검이
// 아니라 *코드가 세어* 90% 미달 씬을 플래그하는 결정적 점검으로 잡는다.

import type { Script } from "../schemas/script.js";
import type { Treatment } from "../schemas/treatment.js";

export const CHARS_PER_SEC = 9;
const UNDER_BUDGET_RATIO = 0.9;
const SCENE_PREFIX_RE = /^(scene\d+)-/;

export interface SceneLengthRow {
  sceneId: string;
  beat: string;
  durationSec: number;
  /** 예산 = round(durationSec × CHARS_PER_SEC). */
  budget: number;
  /** 이 씬 라인들의 내레이션(text) 글자수 합. */
  chars: number;
  lines: number;
  /** chars / budget. */
  pct: number;
  /** budget의 90% 미만(예산 0 제외). */
  underBudget: boolean;
}

export interface SceneLengthReport {
  /** treatment에 씬이 있는가. false면 검사 스킵. */
  applies: boolean;
  rows: SceneLengthRow[];
  totalChars: number;
  totalBudget: number;
  totalPct: number;
  /** 예산 90% 미달 씬 수. */
  underBudgetCount: number;
  /** treatment에 있으나 라인이 하나도 없는 씬 id. */
  emptyScenes: string[];
  /** line.id의 "sceneNN-" 접두사가 treatment 씬에 매칭되지 않는 라인 수. */
  orphanLines: number;
}

/**
 * 씬별 내레이션 글자수를 treatment 예산(duration_sec × 9)과 대조한다.
 * 단일 패스 /script의 끈질긴 분량 미달(실측 ~60%)을 결정적으로 잡는 게이트 —
 * line.id의 "sceneNN-" 접두사로 그룹핑하므로 storyboard 평탄화 전 script.json에 바로 적용된다.
 * lintScript/analyzeDiversity와 별개의 whole-video 분석(분량 축).
 */
export function analyzeSceneLength(script: Script, treatment: Treatment): SceneLengthReport {
  const charsByScene = new Map<string, number>();
  const linesByScene = new Map<string, number>();
  const treatmentIds = new Set(treatment.scenes.map((s) => s.id));
  let orphanLines = 0;
  for (const line of script.lines) {
    const sid = line.id.match(SCENE_PREFIX_RE)?.[1];
    if (!sid || !treatmentIds.has(sid)) {
      orphanLines++;
      continue;
    }
    charsByScene.set(sid, (charsByScene.get(sid) ?? 0) + line.text.length);
    linesByScene.set(sid, (linesByScene.get(sid) ?? 0) + 1);
  }

  const rows: SceneLengthRow[] = treatment.scenes.map((s) => {
    const chars = charsByScene.get(s.id) ?? 0;
    const budget = Math.round(s.duration_sec * CHARS_PER_SEC);
    const pct = budget > 0 ? chars / budget : 0;
    return {
      sceneId: s.id,
      beat: s.beat,
      durationSec: s.duration_sec,
      budget,
      chars,
      lines: linesByScene.get(s.id) ?? 0,
      pct,
      underBudget: budget > 0 && pct < UNDER_BUDGET_RATIO,
    };
  });

  const totalChars = rows.reduce((a, r) => a + r.chars, 0);
  const totalBudget = rows.reduce((a, r) => a + r.budget, 0);
  return {
    applies: treatment.scenes.length > 0,
    rows,
    totalChars,
    totalBudget,
    totalPct: totalBudget > 0 ? totalChars / totalBudget : 0,
    underBudgetCount: rows.filter((r) => r.underBudget).length,
    emptyScenes: rows.filter((r) => r.chars === 0).map((r) => r.sceneId),
    orphanLines,
  };
}
