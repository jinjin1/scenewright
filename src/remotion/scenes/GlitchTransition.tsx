import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { colors, typography } from "../theme/index.js";

type Props = {
  eyebrow?: string;
  label: string;
  // 0~1, 기본 0.7. 1에 가까울수록 RGB shift·slice 진폭 큼
  intensity?: number;
  // glitch burst가 활성인 프레임 수. 이후 깨끗하게 settle.
  burstFrames?: number;
};

// RGB 채널 분리 + horizontal slice displacement + 랜덤 flash + scanline.
// explainer 영상에서 섹션 사이 임팩트 transition 또는 "잘못된 방식"·"고장 난 시스템" 강조.
// 0.5~1초 짧게 사용 (영상당 1~2회 한정 — 과사용하면 산만).
export function GlitchTransition({
  eyebrow,
  label,
  intensity = 0.7,
  burstFrames = 24,
}: Props) {
  const frame = useCurrentFrame();
  const t = Math.min(frame / burstFrames, 1);
  const glitchActive = t < 1;
  const decay = Math.max(0, 1 - t);

  const shiftAmp = 14 * intensity * decay;
  const redX = glitchActive ? (random(`r-${frame}`) - 0.5) * shiftAmp * 2 : 0;
  const cyanX = glitchActive ? (random(`c-${frame}`) - 0.5) * shiftAmp * 2 : 0;
  const redY = glitchActive ? (random(`ry-${frame}`) - 0.5) * shiftAmp : 0;
  const cyanY = glitchActive ? (random(`cy-${frame}`) - 0.5) * shiftAmp : 0;

  // horizontal slice가 매 4프레임마다 50% 확률로 출현
  const sliceActive =
    glitchActive && random(`slice-${Math.floor(frame / 4)}`) > 0.45;
  const sliceY1 = random(`y1-${Math.floor(frame / 4)}`) * 80;
  const sliceY2 = sliceY1 + 6 + random(`h-${Math.floor(frame / 4)}`) * 14;
  const sliceShift =
    (random(`sh-${Math.floor(frame / 4)}`) - 0.5) * 80 * intensity;

  const flashOn = glitchActive && random(`flash-${frame}`) > 0.92;

  const contentStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "120px 160px",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: typography.family,
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.display,
    lineHeight: typography.lineHeightTight,
    maxWidth: 1500,
    margin: 0,
  };
  const eyebrowStyle: React.CSSProperties = {
    fontFamily: `"Geist", ${typography.family}`,
    fontSize: typography.size.eyebrow,
    fontWeight: typography.weight.medium,
    letterSpacing: typography.letterSpacing.eyebrow,
    textTransform: "uppercase",
    marginBottom: 40,
  };

  const renderContent = (color: string, eyebrowColor: string) => (
    <div style={{ ...contentStyle, color }}>
      {eyebrow ? (
        <div style={{ ...eyebrowStyle, color: eyebrowColor }}>{eyebrow}</div>
      ) : null}
      <h2 style={labelStyle}>{label}</h2>
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${cyanX}px, ${cyanY}px)`,
          mixBlendMode: "screen",
        }}
      >
        {renderContent("#00f0d4", "#00f0d4")}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${redX}px, ${redY}px)`,
          mixBlendMode: "screen",
        }}
      >
        {renderContent("#ff2a55", "#ff2a55")}
      </div>
      <div style={{ position: "absolute", inset: 0 }}>
        {renderContent(colors.text, colors.signal)}
      </div>

      {sliceActive ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: `polygon(0 ${sliceY1}%, 100% ${sliceY1}%, 100% ${sliceY2}%, 0 ${sliceY2}%)`,
            transform: `translateX(${sliceShift}px)`,
            color: colors.text,
          }}
        >
          {renderContent(colors.text, colors.signal)}
        </div>
      ) : null}

      {flashOn ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "white",
            opacity: 0.4,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 4px)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
}
