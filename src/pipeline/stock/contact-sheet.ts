// 렌더 전 컨택트시트 — manifest를 shot별 썸네일 그리드 HTML로 굽는다.
//
// 왜: 렌더는 ~30분으로 비싸다. 그 전에 운영자가 "빈 화면·식상·자산 누락"을 육안으로
//   한 번 거르는 게이트가 필요하다(회고: blank 폰→노트북 화면이 연달아 잡혀 2번
//   재렌더). stock 재수집은 ~1분이라 여기서 잡으면 싸게 고친다.
//
// 무엇을 강조:
//   - color/누락 폴백(provider=null) → 빨강 카드 "미디어 없음".
//   - blankish 태그(목업·빈 화면) 자산 → 노랑 배지(rank가 후순위로 밀었어도 노출 경고).
//   - 멀티컷 StockBg는 자산 전부 나열.

import path from "node:path";
import { isBlankish } from "./rank.js";
import type { MediaResult, Provider } from "./types.js";
import { escapeHtml as esc, SHEET_BASE_STYLE, sheetShell } from "../html.js";

// cli/stock.ts의 ManifestEntry/Manifest와 구조적으로 호환되는 최소 입력 타입
// (순환 import를 피하려고 여기서 좁게 재선언).
export interface SheetEntry {
  shot_index: number;
  shot_id: string;
  scene_id: string;
  media_type: "photo" | "video" | "color";
  keywords: string[];
  provider: Provider | "library" | null;
  local_paths: string[];
  attributions: MediaResult[];
}

export interface SheetManifest {
  generated_at: string;
  entries: SheetEntry[];
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

// 시트는 episodes/<slug>/assets/stock/ 안에 있고 local_paths는 project-root 기준이라,
// 같은 디렉터리의 파일은 basename으로 참조된다.
function localThumb(relPath: string): string | null {
  const base = path.basename(relPath);
  const ext = path.extname(base).slice(1).toLowerCase();
  return IMAGE_EXTS.has(ext) ? base : null;
}

interface Thumb {
  src: string;
  caption: string;
  blank: boolean;
}

function entryThumbs(e: SheetEntry): Thumb[] {
  // stock 자산: attribution의 remote thumb_url(비디오 preview 포함) 우선.
  if (e.attributions.length > 0) {
    return e.attributions.map((a, i) => ({
      src: a.thumb_url || localThumb(e.local_paths[i] ?? "") || "",
      caption: `${a.provider}/${a.id}`,
      blank: isBlankish(a.tags),
    }));
  }
  // 라이브러리 자산: attribution 없음 → 로컬 파일(이미지면 표시, 비디오면 라벨).
  return e.local_paths.map((p) => {
    const t = localThumb(p);
    return {
      src: t ?? "",
      caption: t ? path.basename(p) : `▶ ${path.basename(p)}`,
      blank: false,
    };
  });
}

// SHEET_BASE_STYLE(공유)에 컨택트시트 고유 규칙만 덧붙인다.
const STYLE =
  SHEET_BASE_STYLE +
  `
  .warn { color: #f0b429; }
  .bad { color: #f06151; }
  .card.missing { border-color: #f06151; }
  .card.flagged { border-color: #f0b429; }
  .thumbs { display: flex; flex-wrap: wrap; gap: 2px; background: #000; min-height: 96px; }
  .thumbs img { width: 100%; height: 130px; object-fit: cover; display: block; flex: 1 1 100%; }
  .thumbs.multi img { flex: 1 1 calc(50% - 1px); height: 84px; }
  .ph { display: flex; align-items: center; justify-content: center; width: 100%; height: 130px;
    color: #6b7077; font-size: 13px; text-align: center; padding: 8px; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .idx { font-weight: 600; }
  .scene { color: #7c818a; font-size: 12px; }
  .b-lib { background: #2d3b2a; color: #a6d49a; }
  .b-illo { background: #3a2d4f; color: #c9a6ff; }
  .b-blank { background: #4f3a1f; color: #f0b429; }
  .b-miss { background: #4f2424; color: #f06151; }
`;

/**
 * manifest → 자체완결 HTML 컨택트시트. 외부 자산 없음(remote thumb_url + 로컬 파일).
 * episodes/<slug>/assets/stock/contact-sheet.html 로 저장하는 걸 전제로 한 상대 경로.
 */
export function renderContactSheet(manifest: SheetManifest, slug: string): string {
  const entries = manifest.entries;
  const mediaShots = entries.filter((e) => e.media_type !== "color" || e.provider !== null);
  const missing = entries.filter((e) => e.provider === null && e.media_type !== "color");
  const colorShots = entries.filter((e) => e.media_type === "color");
  let blankCount = 0;

  const cards = entries.map((e) => {
    const isMissing = e.provider === null && e.media_type !== "color";
    const isColor = e.media_type === "color";
    const thumbs = isColor ? [] : entryThumbs(e);
    const flagged = thumbs.some((t) => t.blank);
    if (flagged) blankCount += 1;

    const cls = ["card", isMissing ? "missing" : "", flagged ? "flagged" : ""]
      .filter(Boolean)
      .join(" ");

    let thumbHtml: string;
    if (isColor) {
      thumbHtml = `<div class="ph">텍스트/색 씬 — 미디어 없음</div>`;
    } else if (isMissing) {
      thumbHtml = `<div class="ph bad">⚠ 매치 0건 → 단색/LineCard 폴백<br>키워드 재검토</div>`;
    } else if (thumbs.length === 0) {
      thumbHtml = `<div class="ph">(썸네일 없음)</div>`;
    } else {
      const imgs = thumbs
        .map((t) =>
          t.src
            ? `<img src="${esc(t.src)}" alt="${esc(t.caption)}" title="${esc(t.caption)}" loading="lazy">`
            : `<div class="ph">${esc(t.caption)}</div>`,
        )
        .join("");
      thumbHtml = `<div class="thumbs${thumbs.length > 1 ? " multi" : ""}">${imgs}</div>`;
    }

    const badges: string[] = [];
    if (e.provider === "library") badges.push(`<span class="badge b-lib">library</span>`);
    else if (e.media_type === "video") badges.push(`<span class="badge b-video">video</span>`);
    else if (!isColor && !isMissing) badges.push(`<span class="badge b-photo">photo</span>`);
    if (e.keywords.some((k) => /illustration|cartoon|vector|flat|doodle|line art/i.test(k)))
      badges.push(`<span class="badge b-illo">illustration</span>`);
    if (flagged) badges.push(`<span class="badge b-blank">⚠ blank-ish</span>`);
    if (isMissing) badges.push(`<span class="badge b-miss">no media</span>`);

    const kw = e.keywords.length ? esc(e.keywords.join(" · ")) : "—";

    return `<div class="${cls}">
      ${thumbHtml}
      <div class="meta">
        <div class="row"><span class="idx">#${e.shot_index} ${esc(e.shot_id)}</span><span class="scene">${esc(e.scene_id)}</span></div>
        <div class="kw">${kw}</div>
        <div>${badges.join("")}</div>
      </div>
    </div>`;
  });

  const summary =
    `<span class="summary"><b>${entries.length}</b> shots · ` +
    `<b>${mediaShots.length}</b> media · ` +
    `<b>${colorShots.length}</b> text/color · ` +
    `<span class="${missing.length ? "bad" : ""}"><b>${missing.length}</b> missing</span> · ` +
    `<span class="${blankCount ? "warn" : ""}"><b>${blankCount}</b> blank-ish</span></span>`;

  return sheetShell({
    title: `${esc(slug)} — stock contact sheet`,
    style: STYLE,
    headerHtml: `  <h1>${esc(slug)} — 렌더 전 스톡 검수</h1>
  ${summary}
  <div class="summary" style="margin-top:6px">생성 ${esc(manifest.generated_at)} · 빨강=미디어 누락(키워드 재검토) · 노랑=blank/목업 의심. 문제 shot은 키워드 고치고 <code>npm run stock</code> 재실행(렌더 전).</div>`,
    gridBody: cards.join("\n"),
  });
}
