// CLI: episodes/<slug>/script.json → 워딩 검수 findings + script-review.html
//
// 사용: npm run lint:script -- <slug>
//
// /tts(내레이션)·/render(화면 텍스트)가 워딩을 굽기 전에 객관적 워딩 위험을 잡는
// 결정적 게이트. 번역체·어색한 한글의 의미 판단은 /script-review에서 CC가 보강한다.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeDiversity, analyzeSceneLength, lintScript, summarize } from "../script-lint.js";
import { renderLintReport } from "../script-lint-report.js";
import { ScriptSchema } from "../../schemas/script.js";
import { TreatmentSchema } from "../../schemas/treatment.js";
import { runCli } from "./run.js";

async function main(slug: string): Promise<void> {
  const episodeDir = path.resolve("episodes", slug);
  const scriptPath = path.join(episodeDir, "script.json");
  if (!existsSync(scriptPath)) {
    console.error(`script.json not found: ${scriptPath} — run /script first.`);
    process.exit(2);
  }
  const script = ScriptSchema.parse(JSON.parse(readFileSync(scriptPath, "utf-8")));

  // source.txt가 있으면 source-fidelity 검사 활성화(없으면 스킵).
  const sourcePath = path.join(episodeDir, "source.txt");
  const source = existsSync(sourcePath) ? readFileSync(sourcePath, "utf-8") : undefined;

  const findings = lintScript(script, { source });
  const summary = summarize(findings);
  const diversity = analyzeDiversity(script);

  // treatment.json이 있으면 씬별 분량 결정적 점검(예산 = duration_sec×9). 단일 패스의
  // 끈질긴 분량 미달(실측 ~60%)을 프롬프트 자가점검이 아니라 코드가 세어 잡는다.
  // 분량 점검은 부가 기능 — treatment.json이 깨져 있어도 워딩 검수는 계속 돌도록 파싱 실패는 스킵.
  const treatmentPath = path.join(episodeDir, "treatment.json");
  let length: ReturnType<typeof analyzeSceneLength> | null = null;
  if (existsSync(treatmentPath)) {
    try {
      const treatment = TreatmentSchema.parse(JSON.parse(readFileSync(treatmentPath, "utf-8")));
      length = analyzeSceneLength(script, treatment);
    } catch (err) {
      console.warn(
        `treatment.json 파싱 실패 — 분량 점검만 스킵(워딩 검수는 계속): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const generatedAt = new Date().toISOString();

  const reportPath = path.join(episodeDir, "script-review.html");
  writeFileSync(
    reportPath,
    renderLintReport(script, findings, summary, diversity, length, slug, generatedAt),
  );

  const rel = path.relative(process.cwd(), reportPath);
  console.log(
    `wording review: ${summary.error} error · ${summary.warn} warn · ${summary.info} check ` +
      `(${findings.length} findings over ${script.lines.length} lines)`,
  );
  if (summary.byRule["orphan-highlight"]) {
    console.log(
      `  ⚠ ${summary.byRule["orphan-highlight"]} orphan highlight(s) — 형광펜이 조용히 안 칠해짐, 반드시 수정`,
    );
  }

  // 컴포넌트 다양성(과소-다양성 권고). 하드 게이트 아님 — 운영자 판단용.
  if (diversity.applies) {
    const topShare = diversity.counts[0]
      ? `${diversity.counts[0].component} ${(diversity.counts[0].share * 100).toFixed(0)}%`
      : "—";
    console.log(
      `component diversity: ${diversity.distinct}종 (권장 ≥${diversity.distinctFloor}) · ` +
        `최다 ${topShare} · image-first ${diversity.imageFirst} · 최장 연속 ${diversity.longestRun?.instances ?? 0}`,
    );
    for (const f of diversity.flags) {
      console.log(`  ⚠ ${f.message}`);
    }
  }

  // 분량 결정적 점검 — 단일 패스 /script는 프롬프트 예산만으론 ~60%로 미달하므로 코드가 잡는다.
  if (length?.applies) {
    console.log(
      `scene length: 총 ${length.totalChars}/${length.totalBudget}자 ` +
        `(${(length.totalPct * 100).toFixed(0)}%) · ${length.underBudgetCount} 씬 예산<90%`,
    );
    for (const r of length.rows) {
      if (r.underBudget) {
        console.log(
          `  ⚠ ${r.sceneId} ${r.chars}/${r.budget}자 (${Math.floor(r.pct * 100)}%) — "약 ${r.budget}자로 늘려라"로 그 씬만 재생성`,
        );
      }
    }
    if (length.orphanLines > 0) {
      console.log(
        `  (scene 접두사 미매칭 라인 ${length.orphanLines}개 — id가 sceneNN-lineMM 형식인지 확인)`,
      );
    }
  }

  console.log(`report → ${rel}`);
  console.log(
    summary.error > 0
      ? "  → ERROR가 있어요. 수정 후 다시 검사하거나 /script-review로 CC 의미 검토를 받으세요."
      : "  → /script-review로 번역체·어색함 의미 검토를 받은 뒤 /tts로 진행하세요.",
  );
}

runCli("lint:script <episode-slug>", main);
