import { fitTextOnNLines } from "@remotion/layout-utils";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TitleCardProps } from "../../schemas/script.js";
import { colors, motion, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { useEntrance } from "./_anim.js";

const TITLE_BOX = 1500;
const SUBTITLE_BOX = 1400;

// Cover slide. display(144) 사이즈 타이틀 + uppercase eyebrow + muted subtitle.
// Staggered entry: eyebrow → title → subtitle.
// 좌하단 hairline rule이 시각 앵커.
export function TitleCard({ title, subtitle, eyebrow }: TitleCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 스태거 진입: eyebrow(+hairline rule) → title → subtitle. 제목/큰 텍스트는 gentle(무 overshoot).
  const { opacity: eyebrowOpacity } = useEntrance(frame, fps, { rise: 0 });
  const titleStart = motion.staggerStepFrames * 2;
  const { opacity: titleOpacity, translateY: titleRise } = useEntrance(frame, fps, {
    delayFrames: titleStart,
  });
  const subtitleStart = titleStart + motion.staggerStepFrames * 2;
  const { opacity: subtitleOpacity, translateY: subtitleRise } = useEntrance(frame, fps, {
    delayFrames: subtitleStart,
  });

  // 긴 제목이 화면 밖으로 넘치지 않게 — display 상한 두고 2줄 안에 들어오게 축소.
  const titleSize = fitTextOnNLines({
    text: title,
    maxLines: 2,
    maxBoxWidth: TITLE_BOX,
    fontFamily: typography.family,
    fontWeight: typography.weight.bold,
    maxFontSize: typography.size.display,
  }).fontSize;
  const subtitleSize = subtitle
    ? fitTextOnNLines({
        text: subtitle,
        maxLines: 3,
        maxBoxWidth: SUBTITLE_BOX,
        fontFamily: typography.family,
        fontWeight: typography.weight.regular,
        maxFontSize: typography.size.subhead,
      }).fontSize
    : typography.size.subhead;

  return (
    <AmbientBg tint="warm">
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
              marginBottom: 40,
              opacity: eyebrowOpacity,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h1
          style={{
            fontFamily: typography.family,
            fontSize: titleSize,
            fontWeight: typography.weight.bold,
            letterSpacing: typography.letterSpacing.display,
            lineHeight: typography.lineHeightTight,
            margin: 0,
            maxWidth: TITLE_BOX,
            opacity: titleOpacity,
            transform: `translateY(${titleRise}px)`,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <div
            style={{
              fontFamily: typography.family,
              fontSize: subtitleSize,
              color: colors.textMuted,
              lineHeight: typography.lineHeight,
              marginTop: 40,
              maxWidth: SUBTITLE_BOX,
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleRise}px)`,
            }}
          >
            {subtitle}
          </div>
        ) : null}
        <div
          style={{
            position: "absolute",
            bottom: 120,
            left: 160,
            width: 80,
            height: 2,
            backgroundColor: colors.rule,
            opacity: eyebrowOpacity,
          }}
        />
      </AbsoluteFill>
    </AmbientBg>
  );
}
