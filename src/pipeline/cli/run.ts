// 단일 에피소드 CLI 진입점 공통 부트스트랩 — captions/reconcile/tts/thumbnail/lint-script가
// 똑같이 반복하던 (1) slug 검증 + usage 안내 + exit(2), (2) main 실행 + 에러 → exit(1)을 모은다.
// `usage`는 "usage: " 뒤에 붙는 문구(예: "captions <episode-slug>", "thumbnail <episode-slug> [frame]").

import { assertValidSlug } from "./slug.js";

export function runCli(usage: string, main: (slug: string) => Promise<void>): void {
  const slug = process.argv[2];
  try {
    assertValidSlug(slug);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(`usage: ${usage}`);
    process.exit(2);
  }

  main(slug).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
