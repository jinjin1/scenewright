import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { PixelStepTrackerProps } from "../../schemas/script.js";
import { colors, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { SceneHeader } from "./_SceneHeader.js";

type State = "done" | "current" | "todo";

function StepNode({ state }: { state: State }) {
  const N = 5;
  const PX = 22;
  const fill = state === "done" ? colors.positive : state === "current" ? colors.signal : colors.elevated;
  const border = state === "todo" ? colors.textDim : fill;
  const cells: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const onBorder = x === 0 || x === N - 1 || y === 0 || y === N - 1;
      cells.push({ x, y, color: onBorder ? border : fill });
    }
  }
  if (state !== "todo") cells.push({ x: 2, y: 2, color: "#ffffff" });
  return (
    <svg width={N * PX} height={N * PX} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges">
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={1.02} height={1.02} fill={c.color} />
      ))}
    </svg>
  );
}

// 픽셀 스텝 트래커 — 선형 단계 진행 상태(완료/현재/예정). 분기 없는 프로세스/체크리스트.
export function PixelStepTracker({ eyebrow, heading, steps, currentIndex, fallback_color }: PixelStepTrackerProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AmbientBg tint="cool">
      <AbsoluteFill style={{ backgroundColor: fallback_color ?? "transparent" }}>
        <SceneHeader eyebrow={eyebrow} heading={heading} />
        <AbsoluteFill
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 28, width: 1300 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {steps.map((label, i) => {
                const state: State = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
                const reveal = spring({ frame: frame - i * 4, fps, config: { damping: 12 } });
                const op = Math.min(Math.max(reveal, 0), 1);
                const connectorOn = i > 0 && i <= currentIndex;
                return (
                  <React.Fragment key={label}>
                    {i > 0 ? (
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: `repeating-linear-gradient(90deg, ${
                            connectorOn ? colors.positive : colors.rule
                          } 0 10px, transparent 10px 18px)`,
                        }}
                      />
                    ) : null}
                    <div style={{ opacity: op, transform: `scale(${op})` }}>
                      <StepNode state={state} />
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {steps.map((label, i) => (
                <span
                  key={label}
                  style={{
                    flex: 1,
                    textAlign: i === 0 ? "left" : i === steps.length - 1 ? "right" : "center",
                    fontFamily: typography.family,
                    fontSize: typography.size.eyebrow,
                    fontWeight: i === currentIndex ? typography.weight.bold : typography.weight.regular,
                    color: i < currentIndex ? colors.text : i === currentIndex ? colors.signal : colors.textDim,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AmbientBg>
  );
}
