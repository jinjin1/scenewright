import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, typography } from "../theme/index.js";

// 픽셀 로드맵 "여정" 맵 — 지그재그 stepping-stone 경로 + 마일스톤 노드 + 현재 위치 깃발.
// 보드게임/RPG 월드맵 결. milestones 배열만 바꾸면 다른 로드맵으로 교체.

type Milestone = { fx: number; fy: number; label: string };

const MILESTONES: Milestone[] = [
  { fx: 0.07, fy: 0.74, label: "발견" },
  { fx: 0.3, fy: 0.28, label: "정의" },
  { fx: 0.52, fy: 0.68, label: "설계" },
  { fx: 0.74, fy: 0.24, label: "개발" },
  { fx: 0.93, fy: 0.62, label: "출시" },
];

const W = 1600;
const H = 520;
const PROGRESS_TARGET = 0.62; // 전체 경로 중 진행률

export function PixelMap() {
  const frame = useCurrentFrame();
  useVideoConfig();

  const pts = MILESTONES.map((m) => ({ x: m.fx * W, y: m.fy * H, label: m.label }));

  // 폴리라인 누적 거리
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
        const f = (dist - acc) / segLen[i]!;
        return {
          x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * f,
          y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * f,
        };
      }
      acc += segLen[i]!;
    }
    return { x: pts[pts.length - 1]!.x, y: pts[pts.length - 1]!.y };
  };

  const progress = interpolate(frame, [10, 74], [0, PROGRESS_TARGET], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const travel = progress * total;

  // stepping stones
  const STEP = 38;
  const stones: { x: number; y: number; done: boolean }[] = [];
  for (let d = STEP / 2; d < total; d += STEP) {
    const p = pointAt(d);
    const nearNode = pts.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < 34);
    if (nearNode) continue;
    stones.push({ x: p.x, y: p.y, done: d <= travel });
  }

  const doneCount = pts.filter((_, i) => milestoneDist(i) <= travel + 1).length;
  const cur = pointAt(travel);

  // 글로우 펄스
  const pulse = 0.55 + 0.45 * Math.sin((frame / 18) * Math.PI);

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
        gap: 50,
      }}
    >
      <span
        style={{
          fontFamily: typography.family,
          fontSize: 44,
          fontWeight: typography.weight.bold,
          color: colors.text,
          letterSpacing: "0.02em",
        }}
      >
        제품 개발 여정
      </span>

      <div style={{ position: "relative", width: W, height: H }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">
          <defs>
            <filter id="mapglow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* stepping stones */}
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

          {/* milestone nodes */}
          {pts.map((m, i) => {
            const state = i < doneCount ? "done" : i === doneCount ? "current" : "todo";
            const fill =
              state === "done"
                ? colors.positive
                : state === "current"
                  ? colors.signal
                  : colors.elevated;
            const border = state === "todo" ? colors.textDim : fill;
            const S = 26;
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

          {/* 현재 위치 깃발 마커 */}
          <g opacity={pulse}>
            <rect
              x={Math.round(cur.x) - 14}
              y={Math.round(cur.y) - 14}
              width={28}
              height={28}
              fill={colors.signal}
              filter="url(#mapglow)"
            />
          </g>
          <rect x={Math.round(cur.x) - 2} y={Math.round(cur.y) - 64} width={4} height={64} fill={colors.accent} />
          <polygon
            points={`${cur.x + 2},${cur.y - 64} ${cur.x + 40},${cur.y - 54} ${cur.x + 2},${cur.y - 44}`}
            fill={colors.signal}
          />
          <rect x={Math.round(cur.x) - 12} y={Math.round(cur.y) - 12} width={24} height={24} fill={colors.signal} />
          <rect x={Math.round(cur.x) - 5} y={Math.round(cur.y) - 5} width={10} height={10} fill="#ffffff" />
        </svg>

        {/* 마일스톤 라벨 */}
        {pts.map((m, i) => {
          const state = i < doneCount ? "done" : i === doneCount ? "current" : "todo";
          const above = m.y >= H / 2;
          return (
            <span
              key={m.label}
              style={{
                position: "absolute",
                left: m.x,
                top: above ? m.y - 62 : m.y + 26,
                transform: "translateX(-50%)",
                fontFamily: typography.family,
                fontSize: 26,
                fontWeight: state === "current" ? typography.weight.bold : typography.weight.medium,
                color:
                  state === "todo"
                    ? colors.textDim
                    : state === "current"
                      ? colors.signal
                      : colors.text,
                whiteSpace: "nowrap",
              }}
            >
              {m.label}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
