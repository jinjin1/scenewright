import { noise2D } from "@remotion/noise";
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { colors, motion } from "../theme/index.js";
import grainSrc from "../assets/grain.png";

// 노이즈 공간에서 샘플링하는 원의 반지름 — 한 loop당 변화량을 조절.
const NOISE_RADIUS = 1.4;

type Tint = "neutral" | "warm" | "cool";

// 모든 redesigned 씬이 공통으로 감싸는 배경 레이어.
// 1) 느린 그라디언트 mesh drift — 12s loop, 시청자가 의식 못 할 정도
// 2) 정적 grain 텍스처 오버레이 — 정지 화면이 "필름" 느낌
// 두 요소가 합쳐져 Peter Yang 결의 "살아있는 정지 슬라이드"를 만든다.
//
// 렌더 비용 위생(둘 다 "매 프레임 GPU 래스터라이즈" 회피):
// - grain: feTurbulence 대신 미리 만든 PNG 타일(한 번 디코드).
// - mesh glow: blur(60px) 대신 넓은 falloff radial-gradient(블러 자체가 불필요).
//   blur는 프레임당 비용이 커 렌더 병목 원인이었다 — gradient는 본질적으로
//   부드러워 blur 없이 동일한 결을 낸다. drift도 layout 유발 top/left 대신
//   compositor-only transform으로.
export function AmbientBg({
  children,
  tint = "neutral",
}: {
  children?: React.ReactNode;
  tint?: Tint;
}) {
  const frame = useCurrentFrame();
  const t = (frame % motion.ambientLoopFrames) / motion.ambientLoopFrames;
  const angle = t * Math.PI * 2;

  // 노이즈를 원(closed loop)을 따라 샘플 → 12s loop가 seamless하면서도 sinusoid보다
  // 유기적인 drift. blob/축마다 다른 seed로 독립적으로 움직이게.
  const nx = Math.cos(angle) * NOISE_RADIUS;
  const ny = Math.sin(angle) * NOISE_RADIUS;
  const dx1 = noise2D("ambient-dx1", nx, ny) * motion.ambientDriftPx;
  const dy1 = noise2D("ambient-dy1", nx, ny) * motion.ambientDriftPx;
  const dx2 = noise2D("ambient-dx2", nx, ny) * motion.ambientDriftPx;
  const dy2 = noise2D("ambient-dy2", nx, ny) * motion.ambientDriftPx;

  const palette: Record<Tint, [string, string]> = {
    neutral: ["rgba(232,227,214,0.05)", "rgba(82,82,82,0.10)"],
    warm: ["rgba(251,191,36,0.06)", "rgba(232,227,214,0.05)"],
    cool: ["rgba(16,185,129,0.05)", "rgba(82,82,82,0.10)"],
  };
  const [tintA, tintB] = palette[tint];

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-20%",
          width: "75%",
          height: "75%",
          background: `radial-gradient(circle at 50% 50%, ${tintA} 0%, ${tintA} 18%, transparent 72%)`,
          transform: `translate(${dx1}px, ${dy1}px)`,
          willChange: "transform",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          right: "-20%",
          width: "65%",
          height: "65%",
          background: `radial-gradient(circle at 50% 50%, ${tintB} 0%, ${tintB} 18%, transparent 72%)`,
          transform: `translate(${dx2}px, ${dy2}px)`,
          willChange: "transform",
        }}
      />
      {/* 숨은 Img로 grain 로드를 Remotion이 기다리게 한 뒤, 타일 배경으로 사용(첫 프레임 깜빡임 방지). */}
      <Img src={grainSrc} style={{ display: "none" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${grainSrc})`,
          backgroundRepeat: "repeat",
          backgroundSize: "512px 512px",
          opacity: 0.05,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />
      {children}
    </AbsoluteFill>
  );
}
