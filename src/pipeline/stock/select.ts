// Stock 자산 해상도 캡 + variant 선택 헬퍼.
//
// 렌더 비용(특히 4K 비디오 디코드/스케일)은 소스 해상도에 지배된다. 1920×1080
// 컴포지션에 4K 소스를 넣으면 매 프레임 다운스케일 비용만 늘 뿐 화질 이득이 없다
// (handoff: 4K stock fetch가 기본 28s delayRender도 넘겨 렌더 실패까지 유발).
// 그래서 다운로드 단계에서 1920w를 상한으로 둔다.
//
// 이 상한은 cache 키(cache.ts)에도 들어간다 — 캡을 바꾸거나 기존(미캡) 캐시가
// 남아있을 때 재실행이 캡된 variant를 새로 받도록 강제한다(variant 버그 수정).
//
// 적용 범위: pickWithinWidthCap은 현재 **비디오 variant 선택**에만 쓴다(디코드 비용
// 지배 = 비디오). 사진은 provider 기본 variant가 이미 ≤1920라 별도 캡을 안 건다
// (Pexels large2x≈1880 · Pixabay largeImageURL≤1280 · Unsplash regular≈1080). 사진까지
// 강제 캡하는 건 가치가 낮아 measure-first로 보류(2026-05-29 플랜 codex 교정).

/** Stock 다운로드 폭 상한(px). 1920×1080 컴포지션 기준. */
export const MAX_STOCK_WIDTH = 1920;

/**
 * provider가 준 여러 화질 variant 중 하나를 고른다(폭 정보 기준):
 * 1. 폭이 **알려진** variant 중 상한 이내가 있으면 → 그중 가장 큰 것(화질 최대, 캡 이내).
 * 2. 알려진 게 전부 상한 초과면(예: 4K만 제공) → 그중 가장 작은 것(디코드 비용 최소).
 * 3. 폭이 전혀 알려지지 않았으면 → 첫 variant(차선).
 *
 * ⚠️ 폭 미상(undefined·0)은 "캡 이내"로 가정하지 **않는다**. 미상 파일이 실제로
 * 4K일 수 있어, 그걸 "캡 이내 최대"로 골라 캡을 우회하는 함정을 피한다 — 미상은
 * 알려진 후보가 하나도 없을 때만 폴백으로 쓴다. 빈 목록이면 null.
 */
export function pickWithinWidthCap<T extends { width?: number }>(
  variants: readonly T[],
  cap: number = MAX_STOCK_WIDTH,
): T | null {
  if (variants.length === 0) return null;
  const known = variants.filter(
    (v): v is T & { width: number } => typeof v.width === "number" && v.width > 0,
  );
  const withinCap = known.filter((v) => v.width <= cap);
  if (withinCap.length > 0) {
    return withinCap.reduce((best, v) => (v.width > best.width ? v : best));
  }
  if (known.length > 0) {
    // 알려진 게 전부 캡 초과 → 최소 폭(가장 덜 나쁜 known).
    return known.reduce((best, v) => (v.width < best.width ? v : best));
  }
  // 폭 정보가 전혀 없으면 첫 variant.
  return variants[0] ?? null;
}
