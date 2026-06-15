import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colors, typography } from "../theme/index.js";

type Props = {
  texts: string[]; // group 내 각 shot의 라인 텍스트 (자막과 동일)
  shotStartFrames: number[]; // group 시작 기준 각 shot 오프셋
  fallbackColor?: string | undefined;
};

// StockBg src 없을 때 빈 화면을 채우는 텍스트 카드.
// group의 현재 frame이 어느 shot에 속하는지 계산해 해당 line의 텍스트를 큰 글씨로 표시.
// 화면 하단 자막 컴포넌트(Captions)는 별도로 동작 — 같은 텍스트지만 시청자에게는
// "메인 슬라이드 + 자막" 구도로 자연스럽게 보임.
export function LineCard({ texts, shotStartFrames, fallbackColor }: Props) {
  const frame = useCurrentFrame();
  let idx = 0;
  for (let i = shotStartFrames.length - 1; i >= 0; i--) {
    const offset = shotStartFrames[i] ?? 0;
    if (frame >= offset) {
      idx = i;
      break;
    }
  }
  const text = texts[idx] ?? "";
  const bg = fallbackColor ?? colors.bg;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: "center",
        alignItems: "center",
        padding: "120px 160px 280px 160px",
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          color: colors.text,
          fontFamily: typography.family,
          fontSize: 72,
          fontWeight: typography.weight.bold,
          lineHeight: 1.35,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}
