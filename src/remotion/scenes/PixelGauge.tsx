import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { PixelGaugeProps } from "../../schemas/script.js";
import { colors, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { SceneHeader } from "./_SceneHeader.js";

const SEG_W = 3;
const GAP = 1;
const ROWS = 4;
const CELL = 30;

// 픽셀 세그먼트 게이지 — 점수/역량/단계 충족도(value/max)를 칸으로. 비율별 색.
export function PixelGauge({ eyebrow, heading, label, value, max, caption, fallback_color }: PixelGaugeProps) {
  const frame = useCurrentFrame();
  const shown = interpolate(frame, [6, 36], [0, value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ratio = value / max;
  const fillColor = ratio < 0.4 ? colors.negative : ratio < 0.7 ? colors.signal : colors.positive;
  const filled = Math.round(shown);
  const cols = max * (SEG_W + GAP) - GAP;

  return (
    <AmbientBg tint="cool">
      <AbsoluteFill style={{ backgroundColor: fallback_color ?? "transparent" }}>
        <SceneHeader eyebrow={eyebrow} heading={heading} />
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            {label ? (
              <span
                style={{
                  fontFamily: typography.family,
                  fontSize: typography.size.subhead,
                  fontWeight: typography.weight.medium,
                  color: colors.textMuted,
                }}
              >
                {label}
              </span>
            ) : null}
            <span
              style={{
                fontFamily: typography.family,
                fontSize: 64,
                fontWeight: typography.weight.bold,
                color: fillColor,
              }}
            >
              {Math.round(shown)} / {max}
            </span>
          </div>
          <svg
            width={cols * CELL}
            height={ROWS * CELL}
            viewBox={`0 0 ${cols} ${ROWS}`}
            shapeRendering="crispEdges"
          >
            {Array.from({ length: max }).map((_, i) => (
              <rect
                key={i}
                x={i * (SEG_W + GAP)}
                y={0}
                width={SEG_W}
                height={ROWS}
                fill={i < filled ? fillColor : colors.rule}
              />
            ))}
          </svg>
          {caption ? (
            <span
              style={{
                fontFamily: typography.family,
                fontSize: typography.size.body,
                fontWeight: typography.weight.medium,
                color: colors.textMuted,
              }}
            >
              {caption}
            </span>
          ) : null}
        </AbsoluteFill>
      </AbsoluteFill>
    </AmbientBg>
  );
}
