// HTML 이스케이프 — 검수용 정적 HTML 아티팩트(script-review·contact-sheet·library 카탈로그)를
// 굽는 여러 모듈이 공유한다. 같은 esc()를 파일마다 복붙하지 않도록 단일 소스로 둔다.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 검수용 다크 시트(stock contact-sheet · library 갤러리)가 공유하는 기본 스타일.
// 두 페이지에서 완전히 동일한 규칙만 모은다 — 페이지 고유 규칙(.thumbs / .card.overuse 등)은
// 각 모듈이 이 뒤에 덧붙인다(선택자가 겹치지 않아 순서 무관).
export const SHEET_BASE_STYLE = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0c0d10; color: #e7e7ea;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  header { padding: 20px 24px; border-bottom: 1px solid #23252b; position: sticky; top: 0;
    background: #0c0d10ee; backdrop-filter: blur(6px); }
  h1 { margin: 0 0 4px; font-size: 18px; }
  .summary { color: #9aa0a6; font-size: 13px; }
  .summary b { color: #e7e7ea; }
  .grid { display: grid; gap: 14px; padding: 20px 24px;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
  .card { background: #16181d; border: 1px solid #23252b; border-radius: 10px; overflow: hidden; }
  .meta { padding: 9px 11px; }
  .kw { color: #b9bec6; font-size: 12px; margin-top: 4px; word-break: break-word; }
  .badge { display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 4px;
    margin-top: 6px; margin-right: 4px; }
  .b-video { background: #1f3a5f; color: #9cc4ff; }
  .b-photo { background: #2a2f38; color: #aeb4bd; }
`;

// 다크 시트 페이지 셸 — <!doctype>부터 sticky <header> + .grid 본문까지. 두 시트가 공유.
export function sheetShell(opts: {
  title: string;
  style: string;
  headerHtml: string;
  gridBody: string;
}): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title>
<style>${opts.style}</style></head>
<body>
<header>
${opts.headerHtml}
</header>
<div class="grid">
${opts.gridBody}
</div>
</body></html>
`;
}
