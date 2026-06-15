import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, typography } from "../theme/index.js";
import { GLYPH_H, GLYPH_W, PIXEL_FONT } from "./pixel-font.js";

type Props = {
  // 영어 대문자/숫자/기호 (자동 대문자화). 미지원 글자(소문자·한글)는 공백으로 표시.
  label: string;
  // 라벨 아래 한글 등 부연 (Noto Sans KR)
  subtitle?: string;
  // 블록 색. 배열의 첫 색만 사용(코히런트 단색). 미지정 시 레트로 레드/오렌지.
  accentColors?: string[];
  // 글자별 타이핑 간격(프레임).
  letterStaggerFrames?: number;
  // 글자 높이(px). 셀 크기 = pixelSize / 7. 가로 넘치면 자동 축소.
  pixelSize?: number;
};

const BG = "#070608";
// 레트로 워치 레드/오렌지 (레퍼런스 결).
const DEFAULT_BLOCK = "#d6452e";

// 픽셀 블록 타이틀. 채널 인트로 / 섹션 디바이더용.
// 글자를 5×7 비트맵 매트릭스 → 칸(타일) 격자로 렌더. 각 타일은 밝은 프레임 + 어두운 안쪽
// = embossed/recessed (레퍼런스의 "concentric inset"). 좌→우 타이핑 빌드 + 깜빡이는 블록 커서.
// ⚠ 3D 깊이는 drop-shadow(... 0 ...) = blur radius 0 (가우시안 없음). 칸은 SVG <rect>.
//   짧은 타이틀에 한정해 칸 수가 bounded → 비용 moderate(디졸브류 per-frame 가우시안 cliff 아님).
export function PixelTitle({
  label,
  subtitle,
  accentColors,
  letterStaggerFrames = 5,
  pixelSize = 210,
}: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const base = (accentColors && accentColors[0]) || DEFAULT_BLOCK;
  const faceLight = lightenHex(base, 0.34); // 타일 바깥 프레임(밝음 → 돋움)
  const faceCenter = darkenHex(base, 0.72); // 타일 안쪽(어두움 → 들어감)
  const extrude = darkenHex(base, 0.4); // 3D 압출 그림자

  const chars = Array.from(label.toUpperCase());

  // 셀 크기: pixelSize=글자 높이 → CELL=pixelSize/GLYPH_H. 한 줄 폭이 넘치면 축소.
  // 글자당 advance = GLYPH_W 칸 + 1칸 gap.
  const AVAIL_WIDTH = 1920 - 140 * 2;
  const advanceCols =
    chars.length > 0 ? chars.length * GLYPH_W + (chars.length - 1) : GLYPH_W;
  const targetCell = Math.round(pixelSize / GLYPH_H);
  const fitCell = Math.floor(AVAIL_WIDTH / advanceCols);
  const CELL = Math.max(6, Math.min(targetCell, fitCell));

  const charFrames = Math.max(1, letterStaggerFrames);
  // 좌→우 타이핑: 미타이핑 글자는 폭을 차지하지 않음.
  const typedCount = Math.max(
    0,
    Math.min(chars.length, Math.floor(frame / charFrames) + 1),
  );

  // 타이핑 중엔 0.5초 주기 깜빡임, 완료 후 잠깐 머물다 페이드아웃(깔끔한 엔드).
  const blinkPeriod = Math.max(1, Math.round(fps * 0.5));
  const cursorOn = Math.floor(frame / blinkPeriod) % 2 === 0;
  const typingEndFrame = chars.length * charFrames;
  const cursorOpacity =
    frame < typingEndFrame
      ? cursorOn
        ? 1
        : 0
      : interpolate(frame - typingEndFrame, [10, 24], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const subtitleStart = typingEndFrame + 16;
  const subtitleOpacity = interpolate(
    frame,
    [subtitleStart, subtitleStart + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const subtitleRise = interpolate(
    frame,
    [subtitleStart, subtitleStart + 20],
    [16, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // 3D 압출 — 전체 타이틀에 blur 0 drop-shadow 3겹(가우시안 없음, 우하향 계단 압출).
  const depth = Math.max(2, Math.round(CELL * 0.26));
  const extrudeFilter = `drop-shadow(${depth}px ${depth}px 0 ${extrude}) drop-shadow(${depth}px ${depth}px 0 ${extrude}) drop-shadow(${depth}px ${depth}px 0 ${extrude})`;

  // 타일 기하 — 칸 안에서 바깥 프레임(밝음) + 안쪽 사각(어두움) = embossed.
  const TILE = CELL * 0.84;
  const TILE_PAD = CELL * 0.08;
  const INNER = CELL * 0.4;
  const INNER_PAD = CELL * 0.3;
  const gW = GLYPH_W * CELL;
  const gH = GLYPH_H * CELL;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 140px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: Math.round(CELL * 0.7),
          filter: extrudeFilter,
        }}
      >
        {chars.slice(0, typedCount).map((ch, i) => {
          // 막 타이핑된 글자 4f "스탬프" 정착 (위에서 내려앉음 + 살짝 큼, blur 없음).
          const sinceTyped = frame - i * charFrames;
          const settle = interpolate(sinceTyped, [0, 4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const settleScale = 1 + (1 - settle) * 0.12;
          const settleDrop = (1 - settle) * -CELL * 0.5;

          const matrix = PIXEL_FONT[ch];
          if (!matrix) {
            // 미지원 글자 → 폭만 차지(공백처럼).
            return (
              <span key={i} style={{ display: "block", width: gW, height: gH }} />
            );
          }

          const tiles: React.ReactElement[] = [];
          for (let r = 0; r < GLYPH_H; r++) {
            const row = matrix[r] ?? "";
            for (let c = 0; c < GLYPH_W; c++) {
              if (row[c] !== "1") continue;
              const x = c * CELL;
              const y = r * CELL;
              tiles.push(
                <rect
                  key={`o${r}-${c}`}
                  x={x + TILE_PAD}
                  y={y + TILE_PAD}
                  width={TILE}
                  height={TILE}
                  fill={faceLight}
                />,
              );
              tiles.push(
                <rect
                  key={`n${r}-${c}`}
                  x={x + INNER_PAD}
                  y={y + INNER_PAD}
                  width={INNER}
                  height={INNER}
                  fill={faceCenter}
                />,
              );
            }
          }

          return (
            <svg
              key={i}
              width={gW}
              height={gH}
              viewBox={`0 0 ${gW} ${gH}`}
              shapeRendering="crispEdges"
              style={{
                display: "block",
                transform: `translateY(${settleDrop}px) scale(${settleScale})`,
                transformOrigin: "center bottom",
              }}
            >
              {tiles}
            </svg>
          );
        })}

        {/* 타이핑 커서 — 타일 스타일 블록(밝은 프레임 + 어두운 안쪽), 깜빡임/페이드. */}
        <div
          style={{
            position: "relative",
            width: 3 * CELL,
            height: gH,
            opacity: cursorOpacity,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: TILE_PAD,
              backgroundColor: faceLight,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: Math.round(CELL * 0.55),
              backgroundColor: faceCenter,
            }}
          />
        </div>
      </div>

      {subtitle ? (
        <div
          style={{
            marginTop: 80,
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

function darkenHex(hex: string, factor: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = Math.round(parseInt(m[1]!, 16) * factor);
  const g = Math.round(parseInt(m[2]!, 16) * factor);
  const b = Math.round(parseInt(m[3]!, 16) * factor);
  return `rgb(${r},${g},${b})`;
}

// factor: 0(원색)~1(흰색)로 향하는 비율.
function lightenHex(hex: string, factor: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * factor);
  const r = mix(parseInt(m[1]!, 16));
  const g = mix(parseInt(m[2]!, 16));
  const b = mix(parseInt(m[3]!, 16));
  return `rgb(${r},${g},${b})`;
}
