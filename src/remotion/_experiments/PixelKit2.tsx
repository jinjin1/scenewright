import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, typography } from "../theme/index.js";

// 절차적 픽셀 그래픽 확장 키트 — 콘텐츠용 UI 요소.
// 콜아웃 프레임 + 도넛 게이지 + 로드맵 스텝 트래커. 전부 코드 생성, $0·AI 0.

// ── 1) 픽셀 도넛 게이지 ────────────────────────────────────────────────
function PixelDonut({
  progress,
  label,
  frame,
}: {
  progress: number;
  label: string;
  frame: number;
}) {
  const GRID = 28;
  const CELL = 14;
  const cx = (GRID - 1) / 2;
  const cy = (GRID - 1) / 2;
  const rOuter = 13.5;
  const rInner = 9;

  const shown = interpolate(frame, [10, 45], [0, progress], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cells: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < rInner || dist > rOuter) continue;
      let ang = Math.atan2(dx, -dy); // 0 = 위, 시계방향
      if (ang < 0) ang += Math.PI * 2;
      const norm = ang / (Math.PI * 2);
      const filled = norm <= shown;
      cells.push({ x, y, color: filled ? colors.signal : colors.rule });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ position: "relative", width: GRID * CELL, height: GRID * CELL }}>
        <svg
          width={GRID * CELL}
          height={GRID * CELL}
          viewBox={`0 0 ${GRID} ${GRID}`}
          shapeRendering="crispEdges"
        >
          {cells.map((c, i) => (
            <rect key={i} x={c.x} y={c.y} width={1.02} height={1.02} fill={c.color} />
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
            fontSize: 80,
            fontWeight: typography.weight.bold,
            color: colors.text,
          }}
        >
          {Math.round(shown * 100)}%
        </div>
      </div>
      <span
        style={{
          fontFamily: typography.family,
          fontSize: 28,
          fontWeight: typography.weight.medium,
          color: colors.textMuted,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── 2) 픽셀 콜아웃 프레임 (RPG 대화상자 풍) ──────────────────────────────
function PixelFrame({
  frame,
  fps,
  children,
}: {
  frame: number;
  fps: number;
  children: React.ReactNode;
}) {
  const cols = 46;
  const rows = 16;
  const CELL = 22;

  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6, stiffness: 120 } });
  const scale = interpolate(pop, [0, 1], [0.92, 1]);
  const opacity = Math.min(Math.max(pop, 0), 1);

  const cells: { x: number; y: number; color: string }[] = [];
  const isCorner = (x: number, y: number) =>
    (x === 0 || x === cols - 1) && (y === 0 || y === rows - 1);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const onOuter = x < 2 || x >= cols - 2 || y < 2 || y >= rows - 2;
      const onInner = x === 3 || x === cols - 4 || y === 3 || y === rows - 4;
      const insideInner = x >= 3 && x <= cols - 4 && y >= 3 && y <= rows - 4;
      if (onOuter && !isCorner(x, y)) {
        cells.push({ x, y, color: colors.accent });
      } else if (onInner && insideInner) {
        cells.push({ x, y, color: colors.signal });
      }
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: cols * CELL,
        height: rows * CELL,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <svg
        width={cols * CELL}
        height={rows * CELL}
        viewBox={`0 0 ${cols} ${rows}`}
        shapeRendering="crispEdges"
        style={{ position: "absolute", inset: 0 }}
      >
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={1.02} height={1.02} fill={c.color} />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: CELL * 3.5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── 3) 픽셀 로드맵 스텝 트래커 ────────────────────────────────────────────
function StepNode({ state }: { state: "done" | "current" | "todo" }) {
  const N = 5;
  const PX = 15;
  const fill =
    state === "done" ? colors.positive : state === "current" ? colors.signal : colors.elevated;
  const border = state === "todo" ? colors.textDim : fill;

  const cells: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const onBorder = x === 0 || x === N - 1 || y === 0 || y === N - 1;
      if (onBorder) cells.push({ x, y, color: border });
      else cells.push({ x, y, color: fill });
    }
  }
  // done = 가운데 흰 점, current = 가운데 흰 점
  if (state !== "todo") {
    cells.push({ x: 2, y: 2, color: "#ffffff" });
  }

  return (
    <svg width={N * PX} height={N * PX} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges">
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={1.02} height={1.02} fill={c.color} />
      ))}
    </svg>
  );
}

function PixelSteps({
  steps,
  currentIndex,
  frame,
  fps,
}: {
  steps: string[];
  currentIndex: number;
  frame: number;
  fps: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, width: 760 }}>
      <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
        {steps.map((label, i) => {
          const state: "done" | "current" | "todo" =
            i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
          const reveal = spring({ frame: frame - i * 6, fps, config: { damping: 12 } });
          const op = Math.min(Math.max(reveal, 0), 1);
          const connectorOn = i > 0 && i <= currentIndex;
          return (
            <React.Fragment key={label}>
              {i > 0 ? (
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: connectorOn
                      ? `repeating-linear-gradient(90deg, ${colors.positive} 0 8px, transparent 8px 14px)`
                      : `repeating-linear-gradient(90deg, ${colors.rule} 0 8px, transparent 8px 14px)`,
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
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        {steps.map((label, i) => (
          <span
            key={label}
            style={{
              flex: 1,
              textAlign: i === 0 ? "left" : i === steps.length - 1 ? "right" : "center",
              fontFamily: typography.family,
              fontSize: 22,
              color: i <= currentIndex ? colors.text : colors.textDim,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PixelKit2() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 90,
      }}
    >
      <PixelFrame frame={frame} fps={fps}>
        <span
          style={{
            fontFamily: typography.family,
            fontSize: 52,
            fontWeight: typography.weight.bold,
            color: colors.text,
            lineHeight: 1.3,
          }}
        >
          핵심: 온보딩 이탈 -32%
        </span>
        <span
          style={{
            fontFamily: typography.family,
            fontSize: 28,
            color: colors.textMuted,
            marginTop: 12,
          }}
        >
          3단계 가입 흐름을 1단계로 압축
        </span>
      </PixelFrame>

      <div style={{ display: "flex", alignItems: "center", gap: 130 }}>
        <PixelDonut progress={0.73} label="목표 달성률" frame={frame} />
        <PixelSteps
          steps={["발견", "정의", "설계", "개발", "출시"]}
          currentIndex={2}
          frame={frame}
          fps={fps}
        />
      </div>
    </AbsoluteFill>
  );
}
