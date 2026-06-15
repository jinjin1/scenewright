import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, typography } from "../theme/index.js";

// 절차적 픽셀 그래픽 샘플러 — 캐릭터가 아닌 "필요한 픽셀 그래픽" 데모.
// 아이콘 3종(코드 매트릭스) + 데이터 배열 기반 픽셀 막대차트.
// 전부 외부 에셋·AI 0, 코드만으로 생성.

const PALETTE: Record<string, string> = {
  ".": "transparent",
  g: colors.positive, // 그린
  a: colors.signal, // 앰버
  c: colors.accent, // 크림
  m: "#8f8a7e", // 메탈 그레이
};

type IconDef = { rows: string[]; label: string };

const ICONS: IconDef[] = [
  {
    label: "완료",
    rows: [
      "............",
      "..........g.",
      ".........gg.",
      "........gg..",
      ".g.....gg...",
      ".gg...gg....",
      "..gg.gg.....",
      "...ggg......",
      "....g.......",
      "............",
      "............",
      "............",
    ],
  },
  {
    label: "성장",
    rows: [
      "............",
      ".....aa.....",
      "....aaaa....",
      "...aaaaaa...",
      "..aaaaaaaa..",
      ".aaaaaaaaaa.",
      "....aaaa....",
      "....aaaa....",
      "....aaaa....",
      "....aaaa....",
      "....aaaa....",
      "............",
    ],
  },
  {
    label: "아이디어",
    rows: [
      "...cccccc...",
      "..cccccccc..",
      "..cccccccc..",
      "..cccaaccc..",
      "..cccaaccc..",
      "..cccccccc..",
      "...cccccc...",
      "....cccc....",
      "....mmmm....",
      "....mmmm....",
      ".....mm.....",
      "............",
    ],
  },
];

const ICON_GRID = 12;

function IconTile({ def, frame, fps, delay }: { def: IconDef; frame: number; fps: number; delay: number }) {
  const pop = spring({
    frame: frame - delay,
    fps,
    config: { damping: 11, mass: 0.5, stiffness: 140 },
  });
  const scale = interpolate(pop, [0, 1], [0.4, 1]);
  const opacity = Math.min(Math.max(pop, 0), 1);
  const TILE = 150;
  const ICON_PX = 108;

  const cells: { x: number; y: number; color: string }[] = [];
  def.rows.forEach((row, y) =>
    Array.from(row).forEach((ch, x) => {
      const col = PALETTE[ch];
      if (col && col !== "transparent") cells.push({ x, y, color: col });
    }),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity }}>
      <div
        style={{
          width: TILE,
          height: TILE,
          borderRadius: 16,
          backgroundColor: colors.surface,
          border: `2px solid ${colors.rule}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${scale})`,
        }}
      >
        <svg
          width={ICON_PX}
          height={ICON_PX}
          viewBox={`0 0 ${ICON_GRID} ${ICON_GRID}`}
          shapeRendering="crispEdges"
        >
          {cells.map((c, i) => (
            <rect key={i} x={c.x} y={c.y} width={1.02} height={1.02} fill={c.color} />
          ))}
        </svg>
      </div>
      <span
        style={{
          fontFamily: typography.family,
          fontSize: 28,
          fontWeight: typography.weight.medium,
          color: colors.textMuted,
        }}
      >
        {def.label}
      </span>
    </div>
  );
}

// 데이터 배열 → 픽셀 막대차트. 최댓값 막대는 앰버로 강조.
function PixelBarChart({ data, frame, fps }: { data: number[]; frame: number; fps: number }) {
  const maxH = Math.max(...data) + 1;
  const highlight = data.indexOf(Math.max(...data));
  const BAR_W = 2;
  const GAP = 1;
  const cols = data.length * (BAR_W + GAP) - GAP;
  const rows = maxH + 1; // 마지막 행은 baseline
  const CELL = 52;

  const rects: { x: number; y: number; w: number; color: string }[] = [];

  // baseline
  rects.push({ x: 0, y: maxH, w: cols, color: colors.rule });

  data.forEach((h, i) => {
    const startF = 12 + i * 5;
    const grown = interpolate(frame, [startF, startF + 18], [0, h], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const visH = Math.round(grown);
    const x = i * (BAR_W + GAP);
    const base = i === highlight ? colors.signal : colors.accent;
    for (let k = 0; k < visH; k++) {
      const y = maxH - 1 - k;
      // 맨 위 셀은 살짝 밝게(데이터 포인트 캡)
      const top = k === h - 1;
      rects.push({ x, y, w: BAR_W, color: top ? "#ffffff" : base });
    }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <svg
        width={cols * CELL}
        height={rows * CELL}
        viewBox={`0 0 ${cols} ${rows}`}
        shapeRendering="crispEdges"
      >
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1.02} fill={r.color} />
        ))}
      </svg>
      <span
        style={{
          fontFamily: typography.family,
          fontSize: 28,
          fontWeight: typography.weight.medium,
          color: colors.textMuted,
        }}
      >
        주간 활성 사용자
      </span>
    </div>
  );
}

export function PixelKit() {
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
      <div style={{ display: "flex", gap: 90 }}>
        {ICONS.map((def, i) => (
          <IconTile key={def.label} def={def} frame={frame} fps={fps} delay={i * 6} />
        ))}
      </div>

      <PixelBarChart data={[4, 6, 5, 9, 7]} frame={frame} fps={fps} />
    </AbsoluteFill>
  );
}
