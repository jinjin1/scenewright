import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, typography } from "../theme/index.js";

// 색 인덱스 → 실제 색. "."(공백)은 투명.
// 캐릭터를 교체하려면 PALETTE와 아래 매트릭스만 바꾸면 된다.
const PALETTE: Record<string, string> = {
  ".": "transparent",
  o: "#3d382e", // 외곽선 — 배경(#0a0a0a) 위로 읽히는 따뜻한 다크 톤
  b: colors.accent, // 본체 (크림)
  m: "#8f8a7e", // 메탈 음영 (그릴)
  e: "#070707", // 눈 스크린 (어둠)
  p: colors.signal, // 눈빛 (앰버) — emissive
  g: colors.positive, // 가슴 LED (그린) — emissive
};

// emissive 셀(자체 발광) — 글로우 레이어로 한 번 더 그린다.
const EMISSIVE = new Set(["p", "g"]);

// 눈 뜬 상태. 각 행은 같은 길이여야 한다(GRID_W로 검증).
const BODY_OPEN = [
  "......pp......",
  "......oo......",
  "...oooooooo...",
  "..obbbbbbbbo..",
  "..obeebbeebo..",
  "..obppbbppbo..",
  "..obbbbbbbbo..",
  "..obbmmmmbbo..",
  "...oooooooo...",
  "....obbbbo....",
  "..oooooooooo..",
  ".obbbbbbbbbbo.",
  ".obbbgggbbbbo.",
  ".obbbbbbbbbbo.",
  ".oooooooooooo.",
  "..obo....obo..",
  "..ooo....ooo..",
];

// 눈 감은 상태 — 눈 영역(4~5행)을 본체로 채우고 한 줄 다크 라인만 남긴다.
const BODY_BLINK = [...BODY_OPEN];
BODY_BLINK[4] = "..obbbbbbbbo..";
BODY_BLINK[5] = "..obeebbeebo..";

const GRID_W = BODY_OPEN[0]!.length;
const GRID_H = BODY_OPEN.length;

type Cell = { x: number; y: number; color: string; emissive: boolean };

function toCells(rows: string[]): Cell[] {
  const cells: Cell[] = [];
  rows.forEach((row, y) => {
    Array.from(row).forEach((ch, x) => {
      if (ch === "." || ch === undefined) return;
      const color = PALETTE[ch];
      if (!color || color === "transparent") return;
      cells.push({ x, y, color, emissive: EMISSIVE.has(ch) });
    });
  });
  return cells;
}

type Props = {
  // 화면 아래 라벨 (한글 가능)
  subtitle?: string;
  // 셀(픽셀) 한 변의 px. 캐릭터 크기를 결정.
  pixelScale?: number;
};

// 절차적 픽셀 캐릭터 — 외부 에셋·AI 0, 코드만으로 생성.
// idle bob(상하 부유) + 눈 깜빡임 + 안테나/LED 글로우. 채널 마스코트/디바이더용.
export function PixelCharacter({ subtitle, pixelScale = 34 }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // idle bob — 1.6초 주기로 ±0.5셀 부유
  const bobPeriod = fps * 1.6;
  const bob = Math.sin((frame / bobPeriod) * Math.PI * 2) * 0.5; // 단위: 셀
  // 착지 느낌의 가벼운 squash (아래로 갈 때 살짝 납작)
  const squash = 1 + Math.sin((frame / bobPeriod) * Math.PI * 2) * 0.03;

  // 눈 깜빡임 — 2.4초마다 6프레임 감김
  const blinkPeriod = Math.round(fps * 2.4);
  const sinceBlink = frame % blinkPeriod;
  const isBlinking = sinceBlink < 6;
  const cells = toCells(isBlinking ? BODY_BLINK : BODY_OPEN);

  // 안테나/LED 글로우 펄스
  const glowPulse = 0.6 + 0.4 * Math.sin((frame / (fps * 1.0)) * Math.PI * 2);

  const charW = GRID_W * pixelScale;
  const charH = GRID_H * pixelScale;

  // 그라운드 섀도 — 캐릭터가 떠오르면 작아지고 옅어진다.
  const lift = (bob + 0.5) / 1; // 0(아래)~1(위)
  const shadowScale = interpolate(lift, [0, 1], [1, 0.78]);
  const shadowOpacity = interpolate(lift, [0, 1], [0.45, 0.22]);

  const subtitleStart = 14;
  const subtitleOpacity = interpolate(
    frame,
    [subtitleStart, subtitleStart + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const subtitleRise = interpolate(
    frame,
    [subtitleStart, subtitleStart + 18],
    [16, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

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
      }}
    >
      <div
        style={{
          position: "relative",
          width: charW,
          height: charH + 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* 그라운드 섀도 */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            width: charW * 0.62 * shadowScale,
            height: pixelScale * 0.9,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, rgba(0,0,0,${shadowOpacity}) 0%, transparent 70%)`,
          }}
        />

        {/* 캐릭터 */}
        <svg
          width={charW}
          height={charH}
          viewBox={`0 0 ${GRID_W} ${GRID_H}`}
          shapeRendering="crispEdges"
          style={{
            transform: `translateY(${bob * pixelScale}px) scaleY(${squash})`,
            transformOrigin: "center bottom",
            overflow: "visible",
          }}
        >
          {/* 글로우 레이어 (emissive 셀을 블러로 한 번 더) */}
          <defs>
            <filter id="pixglow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
          </defs>
          <g filter="url(#pixglow)" opacity={glowPulse}>
            {cells
              .filter((c) => c.emissive)
              .map((c, i) => (
                <rect
                  key={`glow-${i}`}
                  x={c.x}
                  y={c.y}
                  width={1.02}
                  height={1.02}
                  fill={c.color}
                />
              ))}
          </g>
          {/* 샤프 레이어 */}
          {cells.map((c, i) => (
            <rect
              key={`cell-${i}`}
              x={c.x}
              y={c.y}
              width={1.02}
              height={1.02}
              fill={c.color}
            />
          ))}
        </svg>
      </div>

      {subtitle ? (
        <div
          style={{
            marginTop: 56,
            fontFamily: typography.family,
            fontSize: typography.size.subhead,
            fontWeight: typography.weight.medium,
            color: colors.textMuted,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleRise}px)`,
            maxWidth: 1400,
            textAlign: "center",
            lineHeight: typography.lineHeight,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
