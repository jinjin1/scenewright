// CLI argv slug 검증.
// `npm run tts -- <slug>` 등에서 slug가 `path.join("episodes", slug)`에 그대로 들어가므로
// argv를 trust boundary로 취급해 path traversal / 예상 외 문자를 차단한다.
// cli/tts.ts와 cli/stock.ts 양쪽에서 공유 가능한 형태로 분리 — 진입점 모듈을 import하면
// top-level `main()`이 실행되므로 검증 로직만 별도 파일에 둔다.

export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function assertValidSlug(slug: string | undefined): asserts slug is string {
  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new Error(
      `invalid slug: ${String(slug)} — must match /^[a-z0-9-]+$/ (lowercase letters, digits, hyphen only)`,
    );
  }
}
