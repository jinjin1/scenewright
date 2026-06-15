import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, motion, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { useEntrance } from "./_anim.js";

type Props = {
  heading?: string;
  items: string[];
  eyebrow?: string;
  // 항목별 시작 프레임 (narration cue 동기화용). 생략 시 evenly stagger.
  itemStartFrames?: number[];
  firstItemFrame?: number;
  itemStepFrames?: number;
};

// BulletList 대체. spring 진입 + 항목별 진입 시점 커스터마이즈 가능 (narration 타이밍에
// 맞춰 늦게 등장시킬 수 있음). hairline rule + Geist 번호 마커는 BulletList와 동일한 결.
export function ProgressiveList({
  heading,
  items,
  eyebrow,
  itemStartFrames,
  firstItemFrame = 22,
  itemStepFrames = 10,
}: Props) {
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
        {eyebrow ? (
          <div
            style={{
              fontFamily: `"Geist", ${typography.family}`,
              fontSize: typography.size.eyebrow,
              color: colors.accent,
              fontWeight: typography.weight.medium,
              letterSpacing: typography.letterSpacing.eyebrow,
              textTransform: "uppercase",
              marginBottom: 48,
              opacity: headingOpacity,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
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
            const startFrame =
              itemStartFrames?.[i] ?? firstItemFrame + i * itemStepFrames;
            const { opacity, translateY: ty } = useEntrance(frame, fps, {
              delayFrames: startFrame,
              preset: "lively",
            });
            const marker = String(i + 1).padStart(2, "0");
            const isLast = i === items.length - 1;
            return (
              <li
                key={i}
                style={{
                  opacity,
                  transform: `translateY(${ty}px)`,
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
