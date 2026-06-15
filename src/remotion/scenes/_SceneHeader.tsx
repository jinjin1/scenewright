import { interpolate, useCurrentFrame } from "remotion";
import { colors, motion, typography } from "../theme/index.js";

// 씬 좌상단 eyebrow + heading 헤더. FlowDiagram 컨벤션을 공유 (PAD=120, top=80).
// 픽셀 데이터-비주얼 씬들이 공통으로 사용.
export function SceneHeader({
  eyebrow,
  heading,
}: {
  eyebrow?: string;
  heading?: string;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, motion.fadeInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });

  if (!eyebrow && !heading) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 120,
        right: 120,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      {eyebrow ? (
        <div
          style={{
            fontFamily: `"Geist", ${typography.family}`,
            fontSize: typography.size.eyebrow,
            color: colors.accent,
            fontWeight: typography.weight.medium,
            letterSpacing: typography.letterSpacing.eyebrow,
            textTransform: "uppercase",
            marginBottom: 14,
            opacity,
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      {heading ? (
        <div
          style={{
            fontFamily: typography.family,
            fontSize: typography.size.heading,
            fontWeight: typography.weight.bold,
            lineHeight: typography.lineHeightTight,
            color: colors.text,
            opacity,
          }}
        >
          {heading}
        </div>
      ) : null}
    </div>
  );
}
