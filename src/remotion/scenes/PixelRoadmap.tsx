import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { PixelRoadmapProps } from "../../schemas/script.js";
import { colors, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { SceneHeader } from "./_SceneHeader.js";

const W = 1600;
const H = 460;

// 픽셀 로드맵 "여정" 맵 — 지그재그 경로 + 마일스톤 + 현재 위치 깃발. 위치는 개수에서 자동 계산.
export function PixelRoadmap({ eyebrow, heading, milestones, currentIndex, fallback_color }: PixelRoadmapProps) {
  const frame = useCurrentFrame();
  const n = milestones.length;
  const cur = currentIndex; // 스키마 refine이 0 <= currentIndex < n 보장

  const padX = 100;
  const availW = W - padX * 2;
  const pts = milestones.map((m, i) => ({
    x: n === 1 ? W / 2 : padX + (availW * i) / (n - 1),
    y: i % 2 === 0 ? 0.7 * H : 0.26 * H,
    label: m.label,
  }));

  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    segLen.push(len);
    total += len;
  }
  const milestoneDist = (i: number) => segLen.slice(0, i).reduce((a, b) => a + b, 0);
  const pointAt = (dist: number) => {
    let acc = 0;
    for (let i = 0; i < segLen.length; i++) {
      if (dist <= acc + segLen[i]!) {
        const f = segLen[i]! === 0 ? 0 : (dist - acc) / segLen[i]!;
        return { x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * f, y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * f };
      }
      acc += segLen[i]!;
    }
    return { x: pts[pts.length - 1]!.x, y: pts[pts.length - 1]!.y };
  };

  const travel = interpolate(frame, [6, 38], [0, milestoneDist(cur)], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const STEP = 38;
  const stones: { x: number; y: number; done: boolean }[] = [];
  for (let d = STEP / 2; d < total; d += STEP) {
    const p = pointAt(d);
    if (pts.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < 36)) continue;
    stones.push({ x: p.x, y: p.y, done: d <= travel });
  }

  const flag = pts[cur]!;
  const pulse = 0.55 + 0.45 * Math.sin((frame / 18) * Math.PI);

  return (
    <AmbientBg tint="cool">
      <AbsoluteFill style={{ backgroundColor: fallback_color ?? "transparent" }}>
        <SceneHeader eyebrow={eyebrow} heading={heading} />
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: W, height: H }}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">
              {stones.map((s, i) => (
                <rect
                  key={i}
                  x={Math.round(s.x) - 5}
                  y={Math.round(s.y) - 5}
                  width={10}
                  height={10}
                  fill={s.done ? colors.positive : colors.rule}
                />
              ))}
              {pts.map((m, i) => {
                const state = i < cur ? "done" : i === cur ? "current" : "todo";
                const fill = state === "done" ? colors.positive : state === "current" ? colors.signal : colors.elevated;
                const border = state === "todo" ? colors.textDim : fill;
                const S = 28;
                const x = Math.round(m.x) - S / 2;
                const y = Math.round(m.y) - S / 2;
                return (
                  <g key={m.label}>
                    <rect x={x - 3} y={y - 3} width={S + 6} height={S + 6} fill={colors.bg} />
                    <rect x={x} y={y} width={S} height={S} fill={border} />
                    <rect x={x + 4} y={y + 4} width={S - 8} height={S - 8} fill={fill} />
                    {state !== "todo" ? (
                      <rect x={x + S / 2 - 4} y={y + S / 2 - 4} width={8} height={8} fill="#ffffff" />
                    ) : null}
                  </g>
                );
              })}
              {/* 현재 마일스톤 깃발 — 정적 halo(반투명 레이어). feGaussianBlur(프레임마다 래스터) 미사용. */}
              <g opacity={pulse}>
                <rect x={Math.round(flag.x) - 28} y={Math.round(flag.y) - 28} width={56} height={56} fill={colors.signal} opacity={0.12} />
                <rect x={Math.round(flag.x) - 20} y={Math.round(flag.y) - 20} width={40} height={40} fill={colors.signal} opacity={0.2} />
              </g>
              <rect x={Math.round(flag.x) - 2} y={Math.round(flag.y) - 70} width={4} height={56} fill={colors.accent} />
              <polygon
                points={`${flag.x + 2},${flag.y - 70} ${flag.x + 40},${flag.y - 60} ${flag.x + 2},${flag.y - 50}`}
                fill={colors.signal}
              />
            </svg>
            {pts.map((m, i) => {
              const state = i < cur ? "done" : i === cur ? "current" : "todo";
              const above = m.y >= H / 2;
              return (
                <span
                  key={m.label}
                  style={{
                    position: "absolute",
                    left: m.x,
                    top: above ? m.y - 64 : m.y + 28,
                    transform: "translateX(-50%)",
                    fontFamily: typography.family,
                    fontSize: typography.size.eyebrow,
                    fontWeight: state === "current" ? typography.weight.bold : typography.weight.medium,
                    color: state === "todo" ? colors.textDim : state === "current" ? colors.signal : colors.text,
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.label}
                </span>
              );
            })}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AmbientBg>
  );
}
