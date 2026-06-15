// HTML 이스케이프 — 검수용 정적 HTML 아티팩트(script-review·contact-sheet·library 카탈로그)를
// 굽는 여러 모듈이 공유한다. 같은 esc()를 파일마다 복붙하지 않도록 단일 소스로 둔다.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
