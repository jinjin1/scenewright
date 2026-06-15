// 워딩 검수 리포트 HTML — lint findings를 라인별 그룹으로 굽는다.
// 스톡 contact-sheet와 같은 결: /tts·/render 전에 운영자가 한눈에 검수하는 아티팩트.

import {
  CHARS_PER_SEC,
  type DiversityReport,
  type Finding,
  type LintSummary,
  type SceneLengthReport,
} from "./script-lint.js";
import type { Script } from "../schemas/script.js";
import { escapeHtml as esc } from "./html.js";

const SEV_LABEL: Record<Finding["severity"], string> = {
  error: "ERROR",
  warn: "WARN",
  info: "CHECK",
};

const RULE_LABEL: Record<Finding["rule"], string> = {
  "orphan-highlight": "강조어 불일치",
  "screen-english": "화면 영어",
  "untransliterated-abbrev": "미음차 영어",
  translationese: "번역체",
  "sentence-end": "문장끝/길이",
  "tts-truncation-risk": "TTS 끝-잘림 위험",
  "cliche-keyword": "b-roll 클리셰",
  "weak-opening": "약한 오프닝(콜드 오픈 아님)",
  "animated-emoji-cap": "애니 이모지 캡",
  "starburst-cap": "스타버스트 캡",
  "starburst-numeric-headline": "스타버스트 숫자 헤드라인",
  "source-fidelity": "소스 충실도",
};

const STYLE = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0c0d10; color: #e7e7ea;
    font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  header { padding: 20px 24px; border-bottom: 1px solid #23252b; position: sticky; top: 0;
    background: #0c0d10ee; backdrop-filter: blur(6px); }
  h1 { margin: 0 0 4px; font-size: 18px; }
  .summary { color: #9aa0a6; font-size: 13px; }
  .summary b { color: #e7e7ea; }
  .pill { display: inline-block; padding: 1px 9px; border-radius: 999px; margin-right: 6px;
    font-size: 12px; font-weight: 600; }
  .p-error { background: #4f2424; color: #f06151; }
  .p-warn { background: #4f3a1f; color: #f0b429; }
  .p-info { background: #1f3a4f; color: #6bb6ff; }
  .wrap { padding: 18px 24px; max-width: 1000px; }
  .clean { color: #6b7077; padding: 18px 24px; }
  .card { background: #16181d; border: 1px solid #23252b; border-radius: 10px;
    margin-bottom: 14px; overflow: hidden; }
  .card.has-error { border-color: #6b2f2f; }
  .lhead { padding: 11px 14px; border-bottom: 1px solid #23252b; display: flex; gap: 10px;
    align-items: baseline; flex-wrap: wrap; }
  .idx { font-weight: 700; }
  .comp { color: #7c818a; font-size: 12px; }
  .ltext { color: #cfd3da; font-size: 13px; margin-left: auto; max-width: 70%; text-align: right; }
  .finding { padding: 9px 14px; border-bottom: 1px solid #1c1e24; display: flex; gap: 10px;
    align-items: flex-start; }
  .finding:last-child { border-bottom: none; }
  .badge { flex: none; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px;
    margin-top: 2px; }
  .b-error { background: #4f2424; color: #f06151; }
  .b-warn { background: #4f3a1f; color: #f0b429; }
  .b-info { background: #1f3a4f; color: #6bb6ff; }
  .fbody { flex: 1; }
  .frule { color: #9aa0a6; font-size: 12px; }
  .fsnip { color: #ffd479; font-weight: 600; }
  .fmsg { color: #d6dae1; }
  .fsug { color: #7c818a; font-size: 12px; margin-top: 2px; }
  .where { color: #5f656e; font-size: 11px; }
  .divpanel { margin: 16px 24px 0; max-width: 1000px; background: #16181d;
    border: 1px solid #23252b; border-radius: 10px; padding: 14px 16px; }
  .divpanel h2 { margin: 0 0 10px; font-size: 14px; color: #cfd3da; }
  .divpanel h2 .meta { color: #7c818a; font-weight: 400; font-size: 12px; }
  .divrow { display: flex; align-items: center; gap: 10px; margin: 3px 0; }
  .divname { flex: none; width: 150px; font-size: 12px; color: #cfd3da; text-align: right; }
  .divtrack { flex: 1; height: 14px; background: #0c0d10; border-radius: 3px; overflow: hidden; }
  .divbar { height: 100%; background: #3d6a8a; border-radius: 3px; }
  .divbar.over { background: #b07a1f; }
  .divbar.img { background: #2f7d5b; }
  .divnum { flex: none; width: 86px; font-size: 12px; color: #9aa0a6; }
  .divflag { margin-top: 8px; font-size: 12.5px; display: flex; gap: 8px; align-items: flex-start; }
  .divflag .badge { margin-top: 1px; }
  .divflag .fmsg { color: #d6dae1; }
  .divclean { margin-top: 8px; font-size: 12.5px; color: #6bbf8a; }
`;

// 컴포넌트 분포 히스토그램 + 다양성 플래그 패널. carry-forward 해소 후 시청자가
// 실제로 보는 분포를 한눈에 — "단조로운가?"를 라인별 카드가 아니라 전체 모양으로 본다.
const IMAGE_FIRST = new Set(["HeroImage", "SplitVisual", "ScreenshotCallout"]);

function renderDiversityPanel(d: DiversityReport): string {
  if (!d.applies) return "";
  const maxCount = d.counts.reduce((m, c) => Math.max(m, c.count), 1);
  const rows = d.counts
    .map((c) => {
      const over = c.share > 0.25;
      const cls = IMAGE_FIRST.has(c.component) ? "img" : over ? "over" : "";
      const w = Math.max(2, Math.round((c.count / maxCount) * 100));
      return `<div class="divrow">
        <span class="divname">${esc(c.component)}</span>
        <span class="divtrack"><span class="divbar ${cls}" style="width:${w}%"></span></span>
        <span class="divnum">${c.count} · ${(c.share * 100).toFixed(0)}%</span>
      </div>`;
    })
    .join("\n");

  const flags =
    d.flags.length > 0
      ? d.flags
          .map(
            (f) => `<div class="divflag">
        <span class="badge b-${f.severity}">${SEV_LABEL[f.severity]}</span>
        <span class="fmsg">${esc(f.message)}</span>
      </div>`,
          )
          .join("\n")
      : `<div class="divclean">✓ 분포 양호 — 권고 임계 내.</div>`;

  return `<div class="divpanel">
    <h2>컴포넌트 다양성 <span class="meta">· ${d.distinct}종 등장 (권장 ≥${d.distinctFloor}) · image-first ${d.imageFirst} · 최장 연속 ${d.longestRun?.instances ?? 0}</span></h2>
    ${rows}
    ${flags}
  </div>`;
}

// 씬별 분량 패널 — duration_sec×9 예산 대비 글자수. 단일 패스 분량 미달(~60%)을 한눈에.
function renderLengthPanel(l: SceneLengthReport): string {
  if (!l.applies) return "";
  const rows = l.rows
    .map((r) => {
      const w = Math.max(2, Math.min(100, Math.round(r.pct * 100)));
      const color = r.underBudget ? "#d6452e" : r.pct >= 1 ? "#89b482" : "#d8a657";
      // 표시는 Math.floor — 플래그 기준이 pct<0.9라 89.5~89.99%가 "90% ⚠"로 반올림돼 보이는 혼동 방지.
      return `<div class="divrow">
        <span class="divname">${esc(r.sceneId)} <span class="meta">${esc(r.beat)}</span></span>
        <span class="divtrack"><span class="divbar" style="width:${w}%;background:${color}"></span></span>
        <span class="divnum">${r.chars}/${r.budget} · ${Math.floor(r.pct * 100)}%${r.underBudget ? " ⚠" : ""}</span>
      </div>`;
    })
    .join("\n");
  // id 미매칭(treatment 씬 id ↔ script line "sceneNN-" 접두사 어긋남) 경고 — 이게 있으면 분량%가
  // 실제와 다를 수 있다(특히 전부 0%면 분량 미달이 아니라 id 정합 문제). HTML 리포트가 주 검수 artifact라 꼭 노출.
  const orphanWarn =
    l.orphanLines > 0
      ? `<div class="divflag"><span class="badge b-warn">WARN</span><span class="fmsg">scene 접두사 미매칭 라인 ${l.orphanLines}개 — treatment 씬 id와 script line id(sceneNN-)가 어긋나 분량%가 실제와 다를 수 있다. 전부 0%로 보이면 분량 미달이 아니라 id 정합부터 확인.</span></div>`
      : "";
  const flag =
    l.underBudgetCount > 0
      ? `<div class="divflag"><span class="badge b-warn">WARN</span><span class="fmsg">${l.underBudgetCount}개 씬이 예산의 90% 미달 — 그 씬만 "약 N자로 늘려라"로 재생성(소스 근거 더 풀어쓰기). 단일 패스는 프롬프트 지시만으론 ~60%로 끝난다.</span></div>`
      : `<div class="divclean">✓ 전 씬 분량 예산 충족.</div>`;
  return `<div class="divpanel">
    <h2>씬별 분량 <span class="meta">· 총 ${l.totalChars}/${l.totalBudget}자 (${(l.totalPct * 100).toFixed(0)}%) · 예산 = duration_sec × ${CHARS_PER_SEC}자</span></h2>
    ${rows}
    ${orphanWarn}
    ${flag}
  </div>`;
}

/**
 * findings를 라인별로 묶어 HTML 리포트로. error 있는 라인은 테두리 강조.
 */
export function renderLintReport(
  script: Script,
  findings: Finding[],
  summary: LintSummary,
  diversity: DiversityReport,
  length: SceneLengthReport | null,
  slug: string,
  generatedAt: string,
): string {
  const byLine = new Map<number, Finding[]>();
  for (const f of findings) {
    const bucket = byLine.get(f.lineIndex) ?? [];
    bucket.push(f);
    byLine.set(f.lineIndex, bucket);
  }

  const flaggedIdx = [...byLine.keys()].sort((a, b) => a - b);
  const cleanCount = script.lines.length - flaggedIdx.length;

  const cards = flaggedIdx.map((idx) => {
    const line = script.lines[idx]!;
    const fs = byLine.get(idx)!;
    const hasError = fs.some((f) => f.severity === "error");
    const comp = line.visual ? line.visual.component : "(carry-forward)";

    const findingRows = fs
      .map(
        (f) => `<div class="finding">
        <span class="badge b-${f.severity}">${SEV_LABEL[f.severity]}</span>
        <div class="fbody">
          <span class="frule">${RULE_LABEL[f.rule]}</span> ·
          <span class="fsnip">${esc(f.snippet)}</span>
          <span class="where">${esc(f.where)}</span>
          <div class="fmsg">${esc(f.message)}</div>
          ${f.suggestion ? `<div class="fsug">↳ ${esc(f.suggestion)}</div>` : ""}
        </div>
      </div>`,
      )
      .join("\n");

    return `<div class="card${hasError ? " has-error" : ""}">
      <div class="lhead">
        <span class="idx">#${idx} ${esc(line.id)}</span>
        <span class="comp">${esc(comp)}</span>
        <span class="ltext">${esc(line.text)}</span>
      </div>
      ${findingRows}
    </div>`;
  });

  const summaryPills =
    `<span class="pill p-error">ERROR ${summary.error}</span>` +
    `<span class="pill p-warn">WARN ${summary.warn}</span>` +
    `<span class="pill p-info">CHECK ${summary.info}</span>`;

  const body =
    cards.length > 0
      ? `<div class="wrap">${cards.join("\n")}</div>`
      : `<div class="clean">✓ 결정적 검사에서 플래그된 워딩 없음. 그래도 /script-review의 CC 의미 검토(번역체·어색함)는 권장.</div>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(slug)} — script wording review</title>
<style>${STYLE}</style></head>
<body>
<header>
  <h1>${esc(slug)} — 워딩 검수 (렌더/TTS 전)</h1>
  <div style="margin:6px 0">${summaryPills}<span class="summary">· ${flaggedIdx.length}/${script.lines.length} 라인 플래그 · ${cleanCount} 클린</span></div>
  <div class="summary">생성 ${esc(generatedAt)} · <b>ERROR</b>=조용한 렌더 실패(강조어) — 반드시 수정 · <b>WARN</b>=TTS 발음/잘림 위험 · <b>CHECK</b>=의미 확인(번역체·화면 영어·소스). 결정적 검사 결과이며, 번역체/어색함의 최종 판단은 <code>/script-review</code>의 CC 검토가 보강한다.</div>
</header>
${renderDiversityPanel(diversity)}
${length ? renderLengthPanel(length) : ""}
${body}
</body></html>
`;
}
