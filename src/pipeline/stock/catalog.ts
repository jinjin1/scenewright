// LLM-위키 카탈로그 — 글로벌 인덱스를 사람·CC가 훑는 두 가지 뷰로 굽는다.
//
// 왜: 결정적 키워드 매칭(searchIndex)이 자동 재활용을 처리하지만, 의미 기반 재활용
//   ("바쁜 거리"≈"도심 횡단보도")은 사람/CC의 판단이 낫다. library.md는 CC가
//   /storyboard·/stock에서 키워드를 정하기 전에 읽고 "이미 가진 자산이 있으니 재활용"을
//   제안하는 텍스트 카탈로그, library.html은 운영자가 썸네일로 브라우즈하는 갤러리.
//
// 다양성: 과사용(used_by ≥ REUSE_OVERUSE_CAP) 자산엔 ⚠ 배지/표시 — 더 쓰면 영상이 똑같아짐.

import { REUSE_OVERUSE_CAP } from "./library.js";
import type { LibraryEntry, LibraryIndex } from "../../schemas/library.js";
import { escapeHtml as esc, SHEET_BASE_STYLE, sheetShell } from "../html.js";

function dims(e: LibraryEntry): string {
  const base = `${e.width}×${e.height}`;
  return e.duration_sec != null ? `${base} · ${e.duration_sec}s` : base;
}

// 자산을 대표하는 검색어 — matched_keywords(이 자산을 고른 실제 쿼리) 우선, 없으면 tags.
function descriptors(e: LibraryEntry, limit: number): string[] {
  const src = e.matched_keywords.length > 0 ? e.matched_keywords : e.tags;
  return src.slice(0, limit);
}

function usageLabel(e: LibraryEntry): string {
  const slugs = Array.from(new Set(e.used_by.map((u) => u.slug)));
  return `${e.used_by.length}× (${slugs.join(", ")})`;
}

const isOveruse = (e: LibraryEntry): boolean => e.used_by.length >= REUSE_OVERUSE_CAP;

// 사용 횟수↓, 동률이면 key 사전순. 마크다운·HTML 카탈로그가 공유하는 정렬.
const byUsage = (a: LibraryEntry, b: LibraryEntry): number =>
  b.used_by.length - a.used_by.length || (a.key < b.key ? -1 : 1);

/**
 * 인덱스 → CC가 읽는 압축 마크다운 카탈로그. 자산 1개 = 1줄.
 * 비디오/사진으로 그룹화, 각 그룹은 사용 횟수↓·key 순.
 */
export function renderLibraryMarkdown(index: LibraryIndex): string {
  const videos = index.entries.filter((e) => e.media_type === "video");
  const photos = index.entries.filter((e) => e.media_type === "photo");

  const line = (e: LibraryEntry): string => {
    const kw = descriptors(e, 6).join(", ") || "(태그 없음)";
    const flag = isOveruse(e) ? " ⚠과사용" : "";
    return `- \`${e.key}\` — ${kw} · ${dims(e)} · ${usageLabel(e)}${flag}`;
  };

  const section = (title: string, list: LibraryEntry[]): string =>
    list.length === 0
      ? ""
      : `\n## ${title} (${list.length})\n\n${[...list].sort(byUsage).map(line).join("\n")}\n`;

  return (
    `# 스톡 자산 라이브러리 (재활용 카탈로그)\n\n` +
    `> 자동 생성 — \`assets/stock/index.json\` 기준. 총 ${index.entries.length}개 ` +
    `(비디오 ${videos.length} · 사진 ${photos.length}). 갱신 ${index.generated_at}.\n>\n` +
    `> **재활용 안내**: \`/storyboard\`·\`/stock\`에서 새 b-roll 키워드를 정하기 전에 이 목록을 훑어,\n` +
    `> 맞는 자산이 있으면 그 키워드를 재사용하라(stock API 쿼터 절약). \`⚠과사용\` 자산은 이미\n` +
    `> 여러 영상에 나왔으니 가급적 새 소재를 쓴다. \`npm run stock\`은 매치 자산을 자동 재활용한다.\n` +
    section("비디오", videos) +
    section("사진", photos)
  );
}

// SHEET_BASE_STYLE(공유)에 라이브러리 갤러리 고유 규칙만 덧붙인다.
const STYLE =
  SHEET_BASE_STYLE +
  `
  .card.overuse { border-color: #f0b429; }
  img { width: 100%; height: 130px; object-fit: cover; display: block; background: #000; }
  .row { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
  .key { font-weight: 600; font-size: 12px; word-break: break-all; }
  .dim { color: #7c818a; font-size: 12px; white-space: nowrap; }
  .use { color: #7c818a; font-size: 12px; margin-top: 4px; }
  .b-warn { background: #4f3a1f; color: #f0b429; }
`;

/** 인덱스 → 자체완결 HTML 갤러리(remote thumb_url). 운영자 브라우즈·검수용. */
export function renderLibraryHtml(index: LibraryIndex): string {
  const videos = index.entries.filter((e) => e.media_type === "video").length;
  const photos = index.entries.filter((e) => e.media_type === "photo").length;
  const overused = index.entries.filter(isOveruse).length;

  const cards = [...index.entries]
    .sort(byUsage)
    .map((e) => {
      const over = isOveruse(e);
      const thumb = e.attribution.thumb_url;
      const kw = descriptors(e, 8).join(" · ") || "—";
      const badges = [
        e.media_type === "video"
          ? `<span class="badge b-video">video</span>`
          : `<span class="badge b-photo">photo</span>`,
        over ? `<span class="badge b-warn">⚠ 과사용</span>` : "",
      ].join("");
      return `<div class="card${over ? " overuse" : ""}">
      ${thumb ? `<img src="${esc(thumb)}" alt="${esc(e.key)}" loading="lazy">` : `<div class="ph"></div>`}
      <div class="meta">
        <div class="row"><span class="key">${esc(e.key)}</span><span class="dim">${esc(dims(e))}</span></div>
        <div class="kw">${esc(kw)}</div>
        <div class="use">${esc(usageLabel(e))}</div>
        <div>${badges}</div>
      </div>
    </div>`;
    });

  const summary =
    `<span class="summary"><b>${index.entries.length}</b> assets · ` +
    `<b>${videos}</b> video · <b>${photos}</b> photo · ` +
    `<b>${overused}</b> overused (≥${REUSE_OVERUSE_CAP}×)</span>`;

  return sheetShell({
    title: "stock 자산 라이브러리",
    style: STYLE,
    headerHtml: `  <h1>스톡 자산 라이브러리 — 재활용 카탈로그</h1>
  ${summary}
  <div class="summary" style="margin-top:6px">생성 ${esc(index.generated_at)} · 노랑=과사용(새 영상엔 가급적 새 소재). 자동 재활용은 <code>npm run stock</code>이 처리.</div>`,
    gridBody: cards.join("\n"),
  });
}
