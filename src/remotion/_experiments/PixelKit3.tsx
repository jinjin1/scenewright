import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, typography } from "../theme/index.js";

const PALETTE: Record<string, string> = {
  ".": "transparent",
  c: colors.accent,
  a: colors.signal,
  g: colors.positive,
  m: "#8f8a7e",
};

function iconCells(rows: string[]) {
  const cells: { x: number; y: number; color: string }[] = [];
  rows.forEach((row, y) =>
    Array.from(row).forEach((ch, x) => {
      const col = PALETTE[ch];
      if (col && col !== "transparent") cells.push({ x, y, color: col });
    }),
  );
  return cells;
}

// ── 세그먼트 막대 게이지 ──────────────────────────────────────────────
function PixelGauge({
  value,
  max,
  label,
  frame,
}: {
  value: number;
  max: number;
  label: string;
  frame: number;
}) {
  const SEG_W = 3;
  const GAP = 1;
  const ROWS = 4;
  const cols = max * (SEG_W + GAP) - GAP;
  const CELL = 24;

  const shown = interpolate(frame, [10, 42], [0, value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ratio = value / max;
  const fillColor =
    ratio < 0.4 ? colors.negative : ratio < 0.7 ? colors.signal : colors.positive;
  const filled = Math.round(shown);

  const rects: { x: number; color: string }[] = [];
  for (let i = 0; i < max; i++) {
    rects.push({ x: i * (SEG_W + GAP), color: i < filled ? fillColor : colors.rule });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <span
          style={{
            fontFamily: typography.family,
            fontSize: 30,
            fontWeight: typography.weight.medium,
            color: colors.textMuted,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: typography.family,
            fontSize: 40,
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
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={0} width={SEG_W} height={ROWS} fill={r.color} />
        ))}
      </svg>
    </div>
  );
}

// ── RPG 아이템 슬롯 ──────────────────────────────────────────────────
type Slot = { rows: string[]; label: string; rarity: string };

const SLOTS: Slot[] = [
  {
    label: "목표",
    rarity: colors.signal,
    rows: [
      "............",
      "...cccccc...",
      "..c......c..",
      ".c........c.",
      ".c...aa...c.",
      ".c...aa...c.",
      ".c........c.",
      "..c......c..",
      "...cccccc...",
      "............",
      "............",
      "............",
    ],
  },
  {
    label: "속도",
    rarity: colors.positive,
    rows: [
      "............",
      "......aaa...",
      ".....aaa....",
      "....aaa.....",
      "...aaaaaa...",
      ".....aaa....",
      "....aaa.....",
      "...aaa......",
      "..aaa.......",
      "............",
      "............",
      "............",
    ],
  },
  {
    label: "권한",
    rarity: colors.accent,
    rows: [
      "............",
      "...cc..cc...",
      "..cc....cc..",
      "..cc....cc..",
      "...cc..cc...",
      "....cccc....",
      ".....cc.....",
      ".....cc.....",
      ".....ccc....",
      ".....cc.....",
      ".....ccc....",
      "............",
    ],
  },
  {
    label: "우선순위",
    rarity: colors.signal,
    rows: [
      "............",
      ".....aa.....",
      "....aaaa....",
      "...aaaaaa...",
      "..aaaaaaaa..",
      ".aaaaaaaaaa.",
      ".aaaaaaaaaa.",
      "..aaaaaaaa..",
      "...aaaaaa...",
      "....aaaa....",
      ".....aa.....",
      "............",
    ],
  },
];

function ItemSlot({ slot, frame, fps, delay }: { slot: Slot; frame: number; fps: number; delay: number }) {
  const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 0.5, stiffness: 140 } });
  const op = Math.min(Math.max(pop, 0), 1);
  const scale = interpolate(pop, [0, 1], [0.5, 1]);
  const TILE = 150;
  const ICON_PX = 104;
  const cells = iconCells(slot.rows);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, opacity: op }}>
      <div
        style={{
          width: TILE,
          height: TILE,
          borderRadius: 14,
          backgroundColor: colors.surface,
          border: `3px solid ${slot.rarity}`,
          boxShadow: `0 0 24px ${slot.rarity}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${scale})`,
        }}
      >
        <svg width={ICON_PX} height={ICON_PX} viewBox="0 0 12 12" shapeRendering="crispEdges">
          {cells.map((c, i) => (
            <rect key={i} x={c.x} y={c.y} width={1.02} height={1.02} fill={c.color} />
          ))}
        </svg>
      </div>
      <span
        style={{
          fontFamily: typography.family,
          fontSize: 26,
          fontWeight: typography.weight.medium,
          color: colors.textMuted,
        }}
      >
        {slot.label}
      </span>
    </div>
  );
}

export function PixelKit3() {
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
        gap: 110,
      }}
    >
      <PixelGauge value={7} max={10} label="팀 역량 점수" frame={frame} />

      <div style={{ display: "flex", gap: 70 }}>
        {SLOTS.map((slot, i) => (
          <ItemSlot key={slot.label} slot={slot} frame={frame} fps={fps} delay={i * 5} />
        ))}
      </div>
    </AbsoluteFill>
  );
}
