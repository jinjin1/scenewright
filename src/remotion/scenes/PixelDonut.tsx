import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { PixelDonutProps } from "../../schemas/script.js";
import { colors, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { SceneHeader } from "./_SceneHeader.js";

const GRID = 28;
const CELL = 16;
const R_OUTER = 13.5;
const R_INNER = 9;

// 픽셀 도넛 게이지 — 단일 비율(달성률·점유율 등)을 % 링으로. 가운데 % 숫자.
export function PixelDonut({ eyebrow, heading, percent, caption, fallback_color }: PixelDonutProps) {
  const frame = useCurrentFrame();
  const target = Math.max(0, Math.min(100, percent)) / 100;
  const shown = interpolate(frame, [6, 38], [0, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const c = (GRID - 1) / 2;
  const cells: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const dist = Math.hypot(x - c, y - c);
      if (dist < R_INNER || dist > R_OUTER) continue;
      let ang = Math.atan2(x - c, -(y - c));
      if (ang < 0) ang += Math.PI * 2;
      cells.push({ x, y, color: ang / (Math.PI * 2) <= shown ? colors.signal : colors.rule });
    }
  }
  const size = GRID * CELL;

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
            gap: 28,
          }}
        >
          <div style={{ position: "relative", width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`} shapeRendering="crispEdges">
              {cells.map((cell, i) => (
                <rect key={i} x={cell.x} y={cell.y} width={1.02} height={1.02} fill={cell.color} />
              ))}
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: typography.family,
                fontSize: 96,
                fontWeight: typography.weight.bold,
                color: colors.text,
              }}
            >
              {Math.round(shown * 100)}%
            </div>
          </div>
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
