// 스톡 프로바이더 공통 plumbing — pexels/unsplash/pixabay가 똑같이 반복하던 세 가지를 모은다:
//   1) API 키를 env에서 읽고 없으면 "한 번만" 경고 (makeKeyReader)
//   2) fetch → status 체크 → JSON 파싱, 실패 시 null + 경고 (fetchJson)
//   3) 키워드당 결과 수 캡 (RESULTS_PER_PAGE)
// 키워드당 결과 수 — 다양성/쿼터 트레이드오프 튜닝 포인트(세 프로바이더 공통).
export const RESULTS_PER_PAGE = 15;

/**
 * env 변수에서 API 키를 읽는 함수를 만든다. 키가 없으면 프로세스 수명 동안 "한 번만"
 * 경고하고 null을 반환(매 키워드마다 도배되지 않게). 프로바이더별로 호출해 클로저로 격리한다.
 */
export function makeKeyReader(envVar: string, provider: string): () => string | null {
  let warned = false;
  return (): string | null => {
    const key = process.env[envVar];
    if (!key) {
      if (!warned) {
        console.warn(`stock(${provider}): ${envVar} not set — skipping (check .env loading)`);
        warned = true;
      }
      return null;
    }
    return key;
  };
}

/**
 * fetch + status 검사 + JSON 파싱. 비-2xx 응답이나 예외 시 경고를 찍고 null을 반환한다
 * (호출부는 null을 빈 결과로 처리). `label`은 경고 메시지에 들어가는 엔드포인트 식별자.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  provider: string,
  label: string,
): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      console.warn(`stock(${provider}): ${label} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`stock(${provider}): ${label} fetch failed:`, err);
    return null;
  }
}
