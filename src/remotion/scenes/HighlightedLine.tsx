import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, motion, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { useEntrance } from "./_anim.js";
import { KeywordHighlight } from "./_KeywordHighlight.js";

type Props = {
  text: string;
  highlights: string[];
  eyebrow?: string;
  variant?: "marker" | "underline";
  // 첫 highlight 시작 프레임 (default 28). 이후 키워드는 stepFrames씩 간격
  firstHighlightFrame?: number;
  highlightStepFrames?: number;
};

type Seg = { text: string; isHighlight: boolean; highlightIndex: number };

// 한 문장 + 키워드 강조. 키워드 위에 rough.js 형광펜이 좌→우로 그어지면서 narration의
// 흐름을 따라간다. explainer 영상에서 라인 카드(LineCard) 대체 — 정지 텍스트보다 시선을 잡는다.
export function HighlightedLine({
  text,
  highlights,
  eyebrow,
  variant = "marker",
  firstHighlightFrame = 28,
  highlightStepFrames = 18,
}: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const segments = parseSegments(text, highlights);

  // eyebrow는 fade만, 본문은 gentle rise. 형광펜(KeywordHighlight) 타이밍은 그대로.
  const { opacity: eyebrowOpacity } = useEntrance(frame, fps, { rise: 0 });
  const { opacity: textOpacity, translateY: textRise } = useEntrance(frame, fps, {
    delayFrames: motion.staggerStepFrames,
  });

  return (
    <AmbientBg tint="neutral">
      <AbsoluteFill
        style={{
          padding: "120px 160px",
          justifyContent: "center",
          color: colors.text,
        }}
      >
        {eyebrow ? (
          <div
            style={{
              fontFamily: `"Geist", ${typography.family}`,
              fontSize: typography.size.eyebrow,
              color: colors.accent,
              fontWeight: typography.weight.medium,
              letterSpacing: typography.letterSpacing.eyebrow,
              textTransform: "uppercase",
              marginBottom: 56,
              opacity: eyebrowOpacity,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: typography.family,
            fontSize: typography.size.heading,
            fontWeight: typography.weight.bold,
            letterSpacing: typography.letterSpacing.display,
            lineHeight: typography.lineHeightTight,
            color: colors.text,
            maxWidth: 1500,
            opacity: textOpacity,
            transform: `translateY(${textRise}px)`,
          }}
        >
          {segments.map((seg, i) => {
            if (!seg.isHighlight) {
              return <React.Fragment key={i}>{seg.text}</React.Fragment>;
            }
            const delay =
              firstHighlightFrame + seg.highlightIndex * highlightStepFrames;
            return (
              <KeywordHighlight
                key={i}
                text={seg.text}
                delayFrames={delay}
                variant={variant}
              />
            );
          })}
        </div>
      </AbsoluteFill>
    </AmbientBg>
  );
}

function parseSegments(text: string, highlights: string[]): Seg[] {
  const segments: Seg[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliest = -1;
    let earliestKw = -1;

    for (let i = 0; i < highlights.length; i++) {
      const kw = highlights[i];
      if (!kw) continue;
      const idx = remaining.indexOf(kw);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        earliestKw = i;
      }
    }

    if (earliest === -1) {
      segments.push({ text: remaining, isHighlight: false, highlightIndex: -1 });
      break;
    }

    if (earliest > 0) {
      segments.push({
        text: remaining.substring(0, earliest),
        isHighlight: false,
        highlightIndex: -1,
      });
    }

    const kw = highlights[earliestKw]!;
    segments.push({ text: kw, isHighlight: true, highlightIndex: earliestKw });
    remaining = remaining.substring(earliest + kw.length);
  }

  return segments;
}
