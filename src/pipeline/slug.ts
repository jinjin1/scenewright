// Episode slug 검증 — 단일 소스(trust boundary).
// slug는 `path.join("episodes", slug)`·stock 캐시 경로에 그대로 들어가므로 argv를
// trust boundary로 취급해 path traversal / 예상 외 문자를 차단한다. CLI 진입점과
// stock 캐시(stock/cache.ts)가 공유한다 — 진입점 모듈을 import하면 top-level
// `main()`이 실행되므로 검증 로직만 별도 모듈에 둔다.

// 소문자 영숫자로 시작, 이후 영숫자·하이픈, 최대 64자. 선행 하이픈·과도한 길이 차단.
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function assertValidSlug(slug: string | undefined): asserts slug is string {
  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new Error(
      `invalid slug: ${String(slug)} — must match ${SLUG_PATTERN.source} ` +
        `(lowercase alphanumeric start, then letters/digits/hyphen, ≤64 chars)`,
    );
  }
}
