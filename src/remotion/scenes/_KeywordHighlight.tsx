import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import rough from "roughjs";
import { colors } from "../theme/index.js";

type HighlightProps = {
  text: string;
  delayFrames?: number;
  durationFrames?: number;
  color?: string;
  // 강조 폼 — 형광펜(marker) vs 언더라인(underline)
  variant?: "marker" | "underline";
  // 형광펜 reveal 직후 미세 scale 펄스로 시선 한 번 더 잡기
  pulseAfterReveal?: boolean;
};

// 텍스트 span 뒤에 rough.js로 손그림 형광펜/언더라인을 그리고 좌→우로 reveal.
// Remotion news-article-headline-highlight 예시의 핵심 무브.
// 부모 컴포넌트가 delayFrames로 키워드별 진입 시점을 stagger한다.
export function KeywordHighlight({
  text,
  delayFrames = 0,
  durationFrames = 14,
  color = colors.signal,
  variant = "marker",
  pulseAfterReveal = false,
}: HighlightProps) {
  const frame = useCurrentFrame();
  const spanRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // 결정적 seed — Remotion은 프레임을 병렬 렌더하므로 Math.random()을 쓰면 프레임마다
  // 다른 hachure가 생성되어 형광펜이 "지글거린다(boiling)". text 기반 고정 seed로 모든
  // 프레임이 동일한 마커를 그리게 한다.
  const seed = Math.floor(random(`highlight-${text}`) * 1000) + 1;
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const filterId = useId();

  useLayoutEffect(() => {
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      setDims({ w: rect.width, h: rect.height });
    }
  }, [text]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || dims.w === 0) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = rough.svg(svg);
    if (variant === "marker") {
      const padX = 6;
      const padY = 4;
      const node = rc.rectangle(
        -padX,
        -padY,
        dims.w + padX * 2,
        dims.h + padY * 2,
        {
          fill: color,
          fillStyle: "hachure",
          // 더 촘촘하고 덜 거친 marker — gap 줄이고 weight 키워 더 채우고 roughness 낮춤.
          hachureGap: 2.5,
          hachureAngle: -8,
          fillWeight: 16,
          roughness: 1.3,
          stroke: "none",
          seed,
        },
      );
      svg.appendChild(node);
    } else {
      const y = dims.h - 4;
      const node = rc.line(0, y, dims.w, y, {
        stroke: color,
        strokeWidth: 8,
        roughness: 1.2,
        seed,
      });
      svg.appendChild(node);
    }
  }, [dims.w, dims.h, color, variant, seed]);

  const localFrame = frame - delayFrames;
  const revealProgress = interpolate(
    localFrame,
    [0, durationFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const svgWidth = dims.w + 20;
  const svgHeight = dims.h + 20;

  // 형광펜이 다 그어진 직후 1회 미세 scale 펄스
  let pulseScale = 1;
  if (pulseAfterReveal) {
    const pulseStart = delayFrames + durationFrames + 2;
    const pulseDur = 14;
    const elapsed = frame - pulseStart;
    if (elapsed >= 0 && elapsed < pulseDur) {
      pulseScale = 1 + Math.sin((elapsed / pulseDur) * Math.PI) * 0.04;
    }
  }

  return (
    <span
      ref={spanRef}
      style={{
        position: "relative",
        display: "inline-block",
        whiteSpace: "pre",
      }}
    >
      {dims.w > 0 ? (
        <svg
          ref={svgRef}
          style={{
            position: "absolute",
            top: -10,
            left: -10,
            width: svgWidth,
            height: svgHeight,
            pointerEvents: "none",
            mixBlendMode: "multiply",
            clipPath: `inset(0 ${(1 - revealProgress) * 100}% 0 0)`,
            zIndex: 0,
          }}
          viewBox={`-10 -10 ${svgWidth} ${svgHeight}`}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id={`marker-${filterId}`}>
              <feGaussianBlur stdDeviation="0.4" />
            </filter>
          </defs>
        </svg>
      ) : null}
      <span
        style={{
          position: "relative",
          zIndex: 1,
          display: "inline-block",
          transform: `scale(${pulseScale})`,
          transformOrigin: "center bottom",
        }}
      >
        {text}
      </span>
    </span>
  );
}
