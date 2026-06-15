// 썸네일(TransformedThumbnail) 전용 폰트 로딩.
// thumbnail-index.tsx만 이 파일을 import한다 — Root.tsx(Episode)는 fonts.ts만 import한다.
//
// 왜 분리했나: 폰트 로딩은 eager(슬라이스마다 FontFace.load() + delayRender)라, Episode 렌더가
// 안 쓰는 폰트를 끌고 오면 매 탭의 시작 지연·타임아웃 위험만 커진다. Noto 900(한글 ~120 슬라이스)·
// Archivo·Space Mono는 썸네일에서만 쓰이므로 ~28분짜리 Episode 렌더에서 떼어낸다
// (Episode Noto 요청 480→360). 썸네일은 단일 프레임 렌더라 폰트 시작 비용이 무의미하다.
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadNoto } from "@remotion/google-fonts/NotoSansKR";
import { loadFont as loadSpaceMono } from "@remotion/google-fonts/SpaceMono";

// base(Noto 400/500/700 한글 + Geist 등)를 그대로 가져온다 — 썸네일 한글 제목도 이게 필요.
import "./fonts.js";

// 북카드/제목 한글의 true black weight — 썸네일 전용.
loadNoto("normal", {
  weights: ["900"],
  subsets: ["korean"],
  ignoreTooManyRequestsWarning: true,
});

// Archivo 800/900 — 북카드 영문 "TRANSFORMED".
loadArchivo("normal", {
  weights: ["800", "900"],
});

// Space Mono — eyebrow/태그 모노 라벨.
loadSpaceMono("normal", {
  weights: ["400", "700"],
});
