// Remotion preview/render 시점에 폰트 로딩 (Episode 컴포지션 + 공유 base).
// Root.tsx가 첫 줄에서 이 파일을 import하여 side effect로 실행한다.
// 테스트(jsdom)에서는 Episode 컴포지션을 직접 import하지 않으므로 이 파일도 트리거되지 않는다.
//
// 한글 본문은 Noto Sans KR, 영문/숫자 디스플레이는 Geist(Vercel) — 숫자 가독성·weight 결이
// 분석적·정보 전달 톤과 매치된다.
//
// ⚠️ 폰트 로딩은 eager다 — @remotion/google-fonts는 슬라이스마다 FontFace.load()를 호출하고
//    각각을 delayRender로 감싸, 렌더가 첫 프레임 전에 모든 폰트 fetch를 기다린다.
//    그래서 Episode가 안 쓰는 폰트를 여기 넣으면 매 탭의 시작 지연 + delayRender 타임아웃
//    위험만 늘린다. **썸네일 전용 폰트(Noto 900·Archivo·Space Mono)는 여기 두지 말고
//    fonts-thumbnail.ts에 둔다** — 그 파일은 thumbnail-index.tsx만 import한다.
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadNoto } from "@remotion/google-fonts/NotoSansKR";
import { loadFont as loadPressStart } from "@remotion/google-fonts/PressStart2P";

loadNoto("normal", {
  // Episode 씬이 실제 쓰는 weight만: 700 헤딩 / 500 자막·본문 / 400 서브타이틀.
  // (900은 썸네일 전용 — fonts-thumbnail.ts로 분리.)
  weights: ["400", "500", "700"],
  subsets: ["korean"],
  // Noto Sans KR "korean" 서브셋은 unicode-range로 weight당 ~120개 슬라이스로 쪼개진다
  // (3 weight = ~360 요청, 글자 커버리지상 불가피 — API에 glyph/text 서브셋 옵션 없음).
  // Remotion이 이걸 "too many requests" 경고로 도배해 실제 크래시 스택을 묻어서 경고만 끈다.
  // 요청 수 자체를 더 줄이려면 fonttools로 서브셋 woff2를 self-host해야 한다(빌드 스텝 필요).
  ignoreTooManyRequestsWarning: true,
});

loadGeist("normal", {
  // 900 포함 — StatHero CountUp가 `typography.weight.black`(=900)으로 Geist 숫자를 렌더(빼면 안 됨).
  // ※ 코드는 리터럴 900이 아니라 weight.black 상수를 쓰므로 "900" grep으로는 안 잡힌다.
  weights: ["400", "500", "700", "900"],
});

// 모노스페이스 — TerminalCard 등 터미널/코드 표현용
loadGeistMono("normal", {
  weights: ["400", "500", "700"],
});

// 픽셀 블록 — PixelTitle 채널 인트로/섹션 디바이더
loadPressStart("normal", {
  weights: ["400"],
});
