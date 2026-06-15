import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { BulletListProps } from "../../schemas/script.js";
import { colors, motion, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { useEntrance } from "./_anim.js";

// 3~7개 항목 나열. 항목별 번호 마커(01·02·03) — Geist family로 또렷한 영문 숫자.
// hairline rule이 항목을 시각적으로 묶고, rise+fade가 stagger되어 진입.
export function BulletList({ heading, items }: BulletListProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { opacity: headingOpacity, translateY: headingRise } = useEntrance(frame, fps, {});

  return (
    <AmbientBg tint="neutral">
      <AbsoluteFill
        style={{
          padding: "120px 160px",
          justifyContent: "center",
          color: colors.text,
        }}
      >
        {heading ? (
          <h2
            style={{
              fontFamily: typography.family,
              fontSize: typography.size.heading,
              fontWeight: typography.weight.bold,
              letterSpacing: typography.letterSpacing.display,
              lineHeight: typography.lineHeightTight,
              margin: 0,
              marginBottom: 72,
              color: colors.text,
              maxWidth: 1500,
              opacity: headingOpacity,
              transform: `translateY(${headingRise}px)`,
            }}
          >
            {heading}
          </h2>
        ) : null}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item, i) => {
            const enterStart =
              motion.staggerStepFrames * 2 + i * motion.staggerStepFrames;
            const { opacity, translateY } = useEntrance(frame, fps, {
              delayFrames: enterStart,
              preset: "lively",
            });
            const marker = String(i + 1).padStart(2, "0");
            const isLast = i === items.length - 1;
            return (
              <li
                key={i}
                style={{
                  opacity,
                  transform: `translateY(${translateY}px)`,
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: 48,
                  alignItems: "baseline",
                  padding: "28px 0",
                  borderBottom: isLast ? "none" : `1px solid ${colors.rule}`,
                }}
              >
                <span
                  style={{
                    fontFamily: `"Geist", ${typography.family}`,
                    fontSize: typography.size.eyebrow,
                    fontWeight: typography.weight.medium,
                    color: colors.textDim,
                    letterSpacing: "0.05em",
                  }}
                >
                  {marker}
                </span>
                <span
                  style={{
                    fontFamily: typography.family,
                    fontSize: typography.size.bullet,
                    fontWeight: typography.weight.medium,
                    lineHeight: typography.lineHeight,
                    color: colors.text,
                  }}
                >
                  {item}
                </span>
              </li>
            );
          })}
        </ul>
      </AbsoluteFill>
    </AmbientBg>
  );
}
