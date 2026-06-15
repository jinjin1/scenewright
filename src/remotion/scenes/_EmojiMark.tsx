import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useEntrance, type EntrancePreset } from "./_anim.js";

// Tier 1 이모지 정책 — "의미의 구두점" (판정/리스크/추세). 장식 아님.
//
// 왜 폰트 글리프가 아니라 SVG <Img>인가:
//   과거 이모지 드롭 사유 = 헤드리스 Chromium이 시스템 컬러 이모지 글리프를 안 그림.
//   Twemoji(jdecked/twemoji, CC BY 4.0) 평면 SVG를 staticFile로 로드하면 그 함정을
//   원천 회피한다(폰트가 아니라 이미지라서) + 비디오 디코드 0 + $0.
//   3D 애니 이모지는 Tier 2(@remotion/animated-emoji, 영상당 1개 캡) — 별 컴포넌트.
//
// 등장은 우리 모션 시스템(useEntrance)으로 — 수입 만화가 아니라 디자인 언어의 일부로 읽히게.
// 자산: public/emoji/twemoji/<codepoint>.svg

// 이름→codepoint 매핑 — 호출부가 hex 대신 의미로 쓰게. 새 마커는 자산 추가 후 여기에.
export const EMOJI_CODEPOINTS = {
  check: "2705", // ✅ 판정: 적합 / 통과 / ship
  cross: "274c", // ❌ 판정: 부적합 / kill
  warning: "26a0", // ⚠️ 리스크 / 주의
  up: "1f4c8", // 📈 추세 상승
  down: "1f4c9", // 📉 추세 하락
} as const;

export type EmojiName = keyof typeof EMOJI_CODEPOINTS;

export interface EmojiMarkProps {
  emoji: EmojiName;
  // 변(px). 기본 64 — 내레이션 옆 인라인 마커 기준.
  size?: number;
  // 진입 stagger (프레임). 같은 화면에 여러 마커면 i*step으로 어긋나게.
  delayFrames?: number;
  // 스프링 결 — 기본 lively(미세 overshoot 팝). 큰 단독 마커는 gentle.
  preset?: EntrancePreset;
}

// 단일 의미 마커. 인라인/블록 어디든 — verticalAlign으로 텍스트 베이스라인에 맞춤.
export function EmojiMark({
  emoji,
  size = 64,
  delayFrames = 0,
  preset = "lively",
}: EmojiMarkProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // rise 12: 작은 마커라 기본 16보다 짧은 팝. lively면 살짝 음수 overshoot로 "톡".
  const { opacity, translateY } = useEntrance(frame, fps, {
    delayFrames,
    preset,
    rise: 12,
  });
  // 0.6→1 grow-in을 opacity(=클램프된 spring progress)에 묶어 팝 느낌 보강.
  const scale = 0.6 + 0.4 * opacity;

  return (
    <Img
      src={staticFile(`emoji/twemoji/${EMOJI_CODEPOINTS[emoji]}.svg`)}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        verticalAlign: "middle",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    />
  );
}
