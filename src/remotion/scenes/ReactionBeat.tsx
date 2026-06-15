import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AnimatedEmoji } from "@remotion/animated-emoji";
import type { ReactionBeatProps } from "../../schemas/script.js";
import { colors, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { useEntrance } from "./_anim.js";

// 리액션 비트 — 단일 애니메이션 이모지(Tier2, @remotion/animated-emoji 비디오, transparent 합성,
// scale="0.5"=512²로 디코드 절감) + 헤드라인. 톤 리스크 높음(3D 만화) → **영상당 1개 하드캡**
// (lint:script animated-emoji-cap). 훅 펀치라인·결과 공개 등 가장 강한 1순간에만.
// 자산: public/<emoji>-0.5x.webm (remotion-dev/animated-emoji, CC BY 4.0 — /publish-kit attribution).

export function ReactionBeat({ eyebrow, headline, emoji }: ReactionBeatProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = useEntrance(frame, fps, { delayFrames: 6, preset: "gentle" });

  return (
    <AmbientBg tint="warm">
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* 내부에서 Loop+OffthreadVideo(transparent,muted). scale은 string. */}
        <AnimatedEmoji emoji={emoji} scale="0.5" style={{ width: 260, height: 260 }} />
        {eyebrow ? (
          <div
            style={{
              fontFamily: typography.familyDisplay,
              fontSize: typography.size.eyebrow,
              color: colors.signal,
              fontWeight: typography.weight.medium,
              letterSpacing: typography.letterSpacing.eyebrow,
              textTransform: "uppercase",
              opacity: head.opacity,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h1
          style={{
            fontFamily: typography.family,
            fontSize: typography.size.display,
            fontWeight: typography.weight.black,
            color: colors.text,
            margin: 0,
            textAlign: "center",
            opacity: head.opacity,
            transform: `translateY(${head.translateY}px)`,
          }}
        >
          {headline}
        </h1>
      </AbsoluteFill>
    </AmbientBg>
  );
}
