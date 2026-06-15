import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colors, typography } from "../theme/index.js";

// 모든 자막을 동일한 고정 크기로 — cue마다 fitText로 줄이면 자막 크기가 갑자기 바뀌어
// 어색하다(운영자 피드백). 긴 자막은 같은 크기로 줄만 더 늘어난다(일반 자막 동작).
const CAPTION_SIZE = 40;

type CaptionCue = {
  startFrame: number;
  endFrame: number;
  text: string;
};

type Props = {
  cues: CaptionCue[];
};

// 화면 하단 자막 burn-in. 현재 frame이 속한 cue의 text를 표시.
// StockBg가 src 없이 단색으로 떨어지는 구간에서도 자막이 채워주므로
// 빈 화면 문제도 함께 완화한다.
export function Captions({ cues }: Props) {
  const frame = useCurrentFrame();
  const active = cues.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!active || !active.text) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          margin: "0 80px 80px 80px",
          padding: "24px 48px",
          backgroundColor: "rgba(0, 0, 0, 0.72)",
          borderRadius: 12,
          color: colors.text,
          fontFamily: typography.family,
          fontSize: CAPTION_SIZE,
          fontWeight: typography.weight.medium,
          lineHeight: 1.4,
          textAlign: "center",
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
}
