import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, motion, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";

type Props = {
  eyebrow?: string;
  label: string;
  caption?: string;
};

// 섹션 사이 transition shot — yellow sweep line이 좌→우로 그어지고 eyebrow + label
// + caption이 stagger fade. 1~1.5초 짧게. 한 영상에서 3~5회 정도가 적당.
export function SweepDivider({ eyebrow, label, caption }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sweepProgress = spring({
    frame: frame - 4,
    fps,
    config: { damping: 18, mass: 0.8, stiffness: 80 },
  });

  const eyebrowOpacity = interpolate(
    frame,
    [10, 26],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const labelOpacity = interpolate(
    frame,
    [22, 40],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const labelRise = interpolate(
    frame,
    [22, 40],
    [motion.riseDistance, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const captionOpacity = interpolate(
    frame,
    [30, 48],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AmbientBg tint="warm">
      <AbsoluteFill
        style={{
          padding: "120px 160px",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          color: colors.text,
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
              marginBottom: 40,
              opacity: eyebrowOpacity,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            width: "55%",
            height: 3,
            backgroundColor: colors.signal,
            transform: `scaleX(${Math.min(Math.max(sweepProgress, 0), 1)})`,
            transformOrigin: "left center",
            marginBottom: 56,
          }}
        />
        <h2
          style={{
            fontFamily: typography.family,
            fontSize: typography.size.title,
            fontWeight: typography.weight.bold,
            letterSpacing: typography.letterSpacing.display,
            lineHeight: typography.lineHeightTight,
            margin: 0,
            color: colors.text,
            maxWidth: 1500,
            opacity: labelOpacity,
            transform: `translateY(${labelRise}px)`,
          }}
        >
          {label}
        </h2>
        {caption ? (
          <div
            style={{
              fontFamily: typography.family,
              fontSize: typography.size.body,
              color: colors.textMuted,
              lineHeight: typography.lineHeight,
              marginTop: 40,
              maxWidth: 1300,
              opacity: captionOpacity,
            }}
          >
            {caption}
          </div>
        ) : null}
      </AbsoluteFill>
    </AmbientBg>
  );
}
