import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { colors } from "../theme/index.js";

type Line = {
  kind: "prompt" | "output" | "comment";
  text: string;
};

type Props = {
  lines: Line[];
  // 라인별 시작 프레임 커스텀. 생략 시 자동 stagger (이전 라인 타이핑 끝나고 +12f).
  perLineStartFrames?: number[];
  // 프레임당 표시되는 문자 수. 기본 1.5 (빠른 타이핑)
  charsPerFrame?: number;
  // 색 톤 — phosphor 색감
  tone?: "amber" | "green" | "white";
  // 창 제목
  windowTitle?: string;
};

// 빈티지 CRT 터미널. explainer 영상에서 SQL/CLI/로그/명령어 출력 보여줄 때 사용.
// scanline + phosphor glow + 미세 CRT 휨 + 랜덤 flicker로 retro 결.
export function TerminalCard({
  lines,
  perLineStartFrames,
  charsPerFrame = 1.5,
  tone = "amber",
  windowTitle = "terminal",
}: Props) {
  const frame = useCurrentFrame();

  const toneFg = {
    amber: "#fbbf24",
    green: "#10b981",
    white: "#f5f5f5",
  }[tone];
  const toneGlow = {
    amber: "rgba(251,191,36,0.45)",
    green: "rgba(16,185,129,0.45)",
    white: "rgba(245,245,245,0.45)",
  }[tone];

  // 라인별 누적 시작 프레임 계산
  const lineStartFrames: number[] = [];
  let cursor = 8;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const custom = perLineStartFrames?.[i];
    const start = custom ?? cursor;
    lineStartFrames.push(start);
    cursor = start + Math.ceil(line.text.length / charsPerFrame) + 14;
  }

  // 랜덤 flicker — 매 3프레임마다 0.95+ random일 때만 발생
  const flickerSeed = Math.floor(frame / 3);
  const flickerOn = random(`flicker-${flickerSeed}`) > 0.95;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        padding: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "88%",
          height: "82%",
          position: "relative",
          backgroundColor: "#070707",
          border: `1px solid #1f1f1f`,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow:
            "0 0 100px rgba(0,0,0,0.85), inset 0 0 120px rgba(0,0,0,0.7)",
          transform: "perspective(2800px) rotateX(0.9deg)",
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            padding: "14px 28px",
            backgroundColor: "#0f0f0f",
            borderBottom: `1px solid #1a1a1a`,
            fontFamily: '"Geist Mono", monospace',
            fontSize: 20,
            color: colors.textMuted,
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span style={{ display: "flex", gap: 8 }}>
            <span style={dot("#3a3a3a")} />
            <span style={dot("#3a3a3a")} />
            <span style={dot("#3a3a3a")} />
          </span>
          <span style={{ flex: 1, textAlign: "center" }}>{windowTitle}</span>
          <span style={{ width: 60 }} />
        </div>

        <div
          style={{
            padding: "40px 56px",
            fontFamily: '"Geist Mono", monospace',
            fontSize: 32,
            lineHeight: 1.55,
            color: toneFg,
            textShadow: `0 0 10px ${toneGlow}, 0 0 2px ${toneGlow}`,
            height: "calc(100% - 50px)",
            overflow: "hidden",
          }}
        >
          {lines.map((line, i) => {
            const startFrame = lineStartFrames[i] ?? 0;
            const elapsed = frame - startFrame;
            if (elapsed < 0) return null;
            const charsShown = Math.min(
              Math.floor(elapsed * charsPerFrame),
              line.text.length,
            );
            const displayText = line.text.substring(0, charsShown);
            const isComplete = charsShown >= line.text.length;
            const isLastLine = i === lines.length - 1;
            const showCursor = !isComplete || isLastLine;
            const isCursorVisible = Math.floor(frame / 14) % 2 === 0;
            const prefix =
              line.kind === "prompt" ? "$ " : line.kind === "comment" ? "# " : "";
            const prefixColor =
              line.kind === "comment" ? colors.textMuted : colors.textMuted;
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                {prefix ? (
                  <span style={{ color: prefixColor }}>{prefix}</span>
                ) : null}
                <span
                  style={{
                    color:
                      line.kind === "comment" ? colors.textMuted : toneFg,
                    opacity: line.kind === "comment" ? 0.7 : 1,
                  }}
                >
                  {displayText}
                </span>
                {showCursor && isCursorVisible ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: "0.55em",
                      height: "1.05em",
                      backgroundColor: toneFg,
                      marginLeft: 4,
                      verticalAlign: "text-bottom",
                      boxShadow: `0 0 12px ${toneGlow}`,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.20) 0px, rgba(0,0,0,0.20) 2px, transparent 2px, transparent 4px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.7) 100%)",
            pointerEvents: "none",
          }}
        />
        {flickerOn ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "white",
              opacity: 0.06,
              mixBlendMode: "overlay",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

function dot(color: string): React.CSSProperties {
  return {
    width: 12,
    height: 12,
    borderRadius: "50%",
    backgroundColor: color,
    display: "inline-block",
  };
}
