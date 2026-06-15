import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import type { PixelBarChartProps } from "../../schemas/script.js";
import { colors, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { SceneHeader } from "./_SceneHeader.js";

const MAX_ROWS = 9; // 막대 최대 셀 높이
const BAR_W = 2; // 막대 폭(셀)
const GAP = 1; // 막대 간격(셀)
const CELL = 52; // 셀 1개 px

// 데이터 배열을 픽셀 막대차트로. 최댓값(또는 highlightIndex) 막대를 앰버로 강조.
// 단순 수치 비교/추이용. 거대 단일 숫자는 StatHero, 흐름은 FlowDiagram.
export function PixelBarChart({
  eyebrow,
  heading,
  caption,
  bars,
  highlightIndex,
  fallback_color,
}: PixelBarChartProps) {
  const frame = useCurrentFrame();
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const hi =
    highlightIndex !== undefined && highlightIndex < bars.length
      ? highlightIndex
      : bars.reduce((mi, b, i) => (b.value > bars[mi]!.value ? i : mi), 0);

  const cols = bars.length * (BAR_W + GAP) - GAP;
  const svgW = cols * CELL;
  const svgH = (MAX_ROWS + 1) * CELL;

  const rects: { x: number; y: number; w: number; color: string }[] = [];
  rects.push({ x: 0, y: MAX_ROWS, w: cols, color: colors.rule }); // baseline
  bars.forEach((b, i) => {
    const h = Math.max(1, Math.round((b.value / maxVal) * MAX_ROWS));
    const startF = 6 + i * 3;
    const visH = Math.round(
      interpolate(frame, [startF, startF + 14], [0, h], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
    const x = i * (BAR_W + GAP);
    const base = i === hi ? colors.signal : colors.accent;
    for (let k = 0; k < visH; k++) {
      const y = MAX_ROWS - 1 - k;
      const top = k === h - 1;
      rects.push({ x, y, w: BAR_W, color: top ? "#ffffff" : base });
    }
  });

  const hasHeader = Boolean(eyebrow || heading);
  const hasLabels = bars.some((b) => b.label);

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
            paddingTop: hasHeader ? 120 : 0,
          }}
        >
          <div style={{ position: "relative", width: svgW }}>
            <svg
              width={svgW}
              height={svgH}
              viewBox={`0 0 ${cols} ${MAX_ROWS + 1}`}
              shapeRendering="crispEdges"
            >
              {rects.map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={1.02} fill={r.color} />
              ))}
            </svg>
            {hasLabels ? (
              <div style={{ position: "relative", width: svgW, height: 44, marginTop: 12 }}>
                {bars.map((b, i) =>
                  b.label ? (
                    <span
                      key={i}
                      style={{
                        position: "absolute",
                        left: (i * (BAR_W + GAP) + BAR_W / 2) * CELL,
                        transform: "translateX(-50%)",
                        fontFamily: typography.family,
                        fontSize: 26,
                        color: i === hi ? colors.signal : colors.textMuted,
                        fontWeight:
                          i === hi ? typography.weight.bold : typography.weight.regular,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.label}
                    </span>
                  ) : null,
                )}
              </div>
            ) : null}
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
