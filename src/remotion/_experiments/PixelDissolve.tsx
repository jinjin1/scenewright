import React from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, typography } from "../theme/index.js";

// 픽셀 모자이크 디졸브 트랜지션 — 씬 A가 블록 단위로 사라지며 씬 B를 드러냄.
// 각 셀의 랜덤 임계값 vs 진행률로 dissolve. 씬 전환에 재사용 가능.

const CELLS_X = 32;
const CELLS_Y = 18;

function SceneB() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        backgroundImage: `radial-gradient(circle at 50% 45%, ${colors.signal}18 0%, transparent 55%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: typography.family,
          fontSize: 120,
          fontWeight: typography.weight.black,
          color: colors.signal,
        }}
      >
        다음 챕터
      </span>
      <span
        style={{
          fontFamily: typography.family,
          fontSize: 40,
          color: colors.textMuted,
          marginTop: 16,
        }}
      >
        지표를 움직인 한 번의 결정
      </span>
    </AbsoluteFill>
  );
}

export function PixelDissolve() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const progress = interpolate(frame, [4, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cellW = width / CELLS_X;
  const cellH = height / CELLS_Y;

  // 아직 dissolve 되지 않은(=씬 A가 덮고 있는) 셀
  const remaining: { x: number; y: number; shade: number }[] = [];
  for (let y = 0; y < CELLS_Y; y++) {
    for (let x = 0; x < CELLS_X; x++) {
      const threshold = random(`dissolve-${x}-${y}`);
      if (threshold > progress) {
        remaining.push({ x, y, shade: random(`shade-${x}-${y}`) });
      }
    }
  }

  return (
    <AbsoluteFill>
      {/* 씬 B (아래) */}
      <SceneB />

      {/* 씬 A 모자이크 (위) — 진행에 따라 블록이 사라짐 */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0 }}
        shapeRendering="crispEdges"
      >
        {remaining.map((c) => {
          // 인디고 톤에 살짝 변주를 줘 "씬"처럼 보이게
          const base = 36 + Math.round(c.shade * 18);
          const color = `rgb(${base},${base - 8},${base + 30})`;
          return (
            <rect
              key={`${c.x}-${c.y}`}
              x={c.x * cellW}
              y={c.y * cellH}
              width={cellW + 1}
              height={cellH + 1}
              fill={color}
            />
          );
        })}
      </svg>

      {/* 씬 A 타이틀 — dissolve와 함께 페이드아웃 */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: Math.max(0, 1 - progress * 1.6),
        }}
      >
        <span
          style={{
            fontFamily: typography.family,
            fontSize: 120,
            fontWeight: typography.weight.black,
            color: colors.text,
          }}
        >
          이전 씬
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
