import { fitTextOnNLines } from "@remotion/layout-utils";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { FlowDiagramProps } from "../../schemas/script.js";
import { colors, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { useDrawOn } from "./_draw.js";
import { SceneHeader } from "./_SceneHeader.js";

const W = 1920;
const H = 1080;
const PAD = 120;
const NODE_STAGGER = 12; // 노드 간 진입 간격(프레임)
const DRAW_FRAMES = 18; // 연결선 1개가 그려지는 시간
const ARROW = 16; // 화살촉 크기(px)

type Box = { left: number; top: number; w: number; h: number; cx: number; cy: number };
type Connector = { x1: number; y1: number; x2: number; y2: number; dir: "down" | "right" };

// orientation·노드 수에 따라 박스 위치와 연결선을 계산. SVG/div 공통 1920×1080 좌표계.
function computeLayout(
  orientation: "vertical" | "horizontal",
  n: number,
  headerH: number,
): { boxes: Box[]; connectors: Connector[]; boxW: number } {
  const top0 = PAD + headerH;
  const boxes: Box[] = [];

  if (orientation === "vertical") {
    const availH = H - top0 - PAD;
    const slotH = availH / n;
    const boxW = 780;
    const boxH = Math.min(slotH * 0.62, 180);
    const left = (W - boxW) / 2;
    for (let i = 0; i < n; i++) {
      const cy = top0 + slotH * (i + 0.5);
      boxes.push({ left, top: cy - boxH / 2, w: boxW, h: boxH, cx: W / 2, cy });
    }
  } else {
    const availW = W - PAD * 2;
    const slotW = availW / n;
    const boxW = Math.min(slotW * 0.78, 420);
    const boxH = 240;
    const availH = H - top0 - PAD;
    const cy = top0 + availH / 2;
    for (let i = 0; i < n; i++) {
      const cx = PAD + slotW * (i + 0.5);
      boxes.push({ left: cx - boxW / 2, top: cy - boxH / 2, w: boxW, h: boxH, cx, cy });
    }
  }

  const connectors: Connector[] = [];
  for (let i = 0; i < boxes.length - 1; i++) {
    const a = boxes[i]!;
    const b = boxes[i + 1]!;
    if (orientation === "vertical") {
      connectors.push({ x1: a.cx, y1: a.top + a.h, x2: b.cx, y2: b.top, dir: "down" });
    } else {
      connectors.push({ x1: a.left + a.w, y1: a.cy, x2: b.left, y2: b.cy, dir: "right" });
    }
  }
  return { boxes, connectors, boxW: boxes[0]?.w ?? 0 };
}

function arrowheadPoints(x: number, y: number, dir: "down" | "right"): string {
  if (dir === "down") {
    return `${x - ARROW * 0.7},${y - ARROW} ${x + ARROW * 0.7},${y - ARROW} ${x},${y}`;
  }
  return `${x - ARROW},${y - ARROW * 0.7} ${x - ARROW},${y + ARROW * 0.7} ${x},${y}`;
}

// 라벨 노드를 화살표로 연결하는 다이어그램. 화살표가 evolvePath로 그려지며 흐름을 만든다.
export function FlowDiagram({
  eyebrow,
  heading,
  orientation = "vertical",
  nodes,
  connector = "arrow",
  fallback_color,
}: FlowDiagramProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hasHeader = Boolean(eyebrow || heading);
  const headerH = hasHeader ? 170 : 0;
  const { boxes, connectors } = computeLayout(orientation, nodes.length, headerH);

  const labelMax = orientation === "vertical" ? 40 : 36;

  return (
    <AmbientBg tint="cool">
      <AbsoluteFill style={{ backgroundColor: fallback_color ?? "transparent" }}>
        <SceneHeader eyebrow={eyebrow} heading={heading} />

        {/* 연결선 레이어 — evolvePath로 그려지는 화살표. */}
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: "absolute", inset: 0 }}
        >
          {connectors.map((c, i) => {
            const pathD = `M ${c.x1} ${c.y1} L ${c.x2} ${c.y2}`;
            // 타깃 노드(i+1)가 등장한 직후 그려지기 시작.
            const start = (i + 1) * NODE_STAGGER + 4;
            const { strokeDasharray, strokeDashoffset, headProgress } = useDrawOn(
              frame,
              pathD,
              {
                delayFrames: start,
                drawFrames: DRAW_FRAMES,
                headLeadFrac: connector === "arrow" ? 0.2 : 0,
              },
            );
            const headOpacity = headProgress;
            return (
              <g key={i}>
                <path
                  d={pathD}
                  stroke={colors.accent}
                  strokeWidth={4}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                />
                {connector === "arrow" ? (
                  <polygon
                    points={arrowheadPoints(c.x2, c.y2, c.dir)}
                    fill={colors.accent}
                    opacity={headOpacity}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>

        {/* 노드 박스 — staggered spring 진입. */}
        {boxes.map((box, i) => {
          const node = nodes[i]!;
          const enter = spring({
            frame: frame - i * NODE_STAGGER,
            fps,
            durationInFrames: 16,
            config: { damping: 200 },
          });
          const scale = interpolate(enter, [0, 1], [0.9, 1]);
          const opacity = interpolate(enter, [0, 1], [0, 1]);
          const labelLines = box.h > 110 ? 2 : 1;
          const labelSize = fitTextOnNLines({
            text: node.label,
            maxLines: labelLines,
            maxBoxWidth: box.w - 56,
            fontFamily: typography.family,
            fontWeight: typography.weight.bold,
            maxFontSize: labelMax,
          }).fontSize;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: box.left,
                top: box.top,
                width: box.w,
                height: box.h,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "0 28px",
                boxSizing: "border-box",
                backgroundColor: colors.surface,
                border: `2px solid ${colors.rule}`,
                borderRadius: 16,
                boxShadow: "0 18px 50px rgba(0,0,0,0.4)",
                opacity,
                transform: `scale(${scale})`,
              }}
            >
              <div
                style={{
                  fontFamily: typography.family,
                  fontSize: labelSize,
                  fontWeight: typography.weight.bold,
                  color: colors.text,
                  lineHeight: typography.lineHeightTight,
                  textAlign: "center",
                }}
              >
                {node.label}
              </div>
              {node.sublabel ? (
                <div
                  style={{
                    fontFamily: typography.family,
                    fontSize: typography.size.caption,
                    color: colors.textMuted,
                    textAlign: "center",
                  }}
                >
                  {node.sublabel}
                </div>
              ) : null}
            </div>
          );
        })}
      </AbsoluteFill>
    </AmbientBg>
  );
}
