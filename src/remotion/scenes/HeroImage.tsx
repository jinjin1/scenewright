import { fitText, fitTextOnNLines } from "@remotion/layout-utils";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";
import type { HeroImageProps } from "../../schemas/script.js";
import { colors, motion, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { KenBurnsImage } from "./_KenBurnsImage.js";

// `src`/`durationInFrames`는 props 스키마에 없는 런타임 필드 — Episode가 stock 매니페스트와
// 그룹 길이를 보고 주입한다. src가 없으면(자산 0건) AmbientBg 위 텍스트로 폴백.
type Props = HeroImageProps & { src?: string; durationInFrames?: number };

const PAD = 160;
// 하단 번인 자막 바(화면 하단 ~240px)와 겹치지 않도록 텍스트 블록을 그 위로 올린다.
const CAPTION_SAFE = 280;
const CONTENT_WIDTH = 1920 - PAD * 2;
const TITLE_MAX = typography.size.display; // 144
const CAPTION_MAX = typography.size.subhead; // 48

function resolveMediaSrc(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return staticFile(src);
}

// 풀블리드 Ken Burns 이미지(또는 비디오) + 하단 좌측 제목/캡션 오버레이.
// 미디어를 배경이 아니라 *본문*으로 세우는 image-first 씬.
export function HeroImage({
  title,
  caption,
  eyebrow,
  kind = "photo",
  overlay = "bottom",
  fallback_color,
  src,
  durationInFrames = 300,
}: Props) {
  const frame = useCurrentFrame();
  const bg = fallback_color ?? colors.bg;

  const eyebrowOpacity = interpolate(frame, [0, motion.fadeInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleStart = motion.staggerStepFrames;
  const titleOpacity = interpolate(
    frame,
    [titleStart, titleStart + motion.riseFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const titleRise = interpolate(
    frame,
    [titleStart, titleStart + motion.riseFrames],
    [motion.riseDistance, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const captionStart = titleStart + motion.staggerStepFrames;
  const captionOpacity = interpolate(
    frame,
    [captionStart, captionStart + motion.fadeInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const titleSize = title
    ? Math.min(
        TITLE_MAX,
        fitText({
          text: title,
          withinWidth: CONTENT_WIDTH,
          fontFamily: typography.family,
          fontWeight: typography.weight.bold,
        }).fontSize,
      )
    : TITLE_MAX;

  const captionSize = caption
    ? fitTextOnNLines({
        text: caption,
        maxLines: 2,
        maxBoxWidth: CONTENT_WIDTH,
        fontFamily: typography.family,
        fontWeight: typography.weight.medium,
        maxFontSize: CAPTION_MAX,
      }).fontSize
    : CAPTION_MAX;

  const hasMedia = Boolean(src);

  const textBlock = (
    <div
      style={{
        position: "absolute",
        bottom: CAPTION_SAFE,
        left: PAD,
        right: PAD,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
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
            marginBottom: 24,
            opacity: eyebrowOpacity,
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      {title ? (
        <h1
          style={{
            fontFamily: typography.family,
            fontSize: titleSize,
            fontWeight: typography.weight.bold,
            letterSpacing: typography.letterSpacing.display,
            lineHeight: typography.lineHeightTight,
            color: colors.text,
            margin: 0,
            whiteSpace: "nowrap",
            textShadow: hasMedia ? "0 2px 24px rgba(0,0,0,0.6)" : undefined,
            opacity: titleOpacity,
            transform: `translateY(${titleRise}px)`,
          }}
        >
          {title}
        </h1>
      ) : null}
      {caption ? (
        <div
          style={{
            fontFamily: typography.family,
            fontSize: captionSize,
            color: hasMedia ? colors.text : colors.textMuted,
            lineHeight: typography.lineHeight,
            marginTop: 28,
            maxWidth: CONTENT_WIDTH,
            textShadow: hasMedia ? "0 2px 16px rgba(0,0,0,0.7)" : undefined,
            opacity: captionOpacity,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );

  if (!hasMedia) {
    // 자산 0건 — 텍스트 씬으로 우아하게 폴백.
    return (
      <AmbientBg tint="neutral">
        <AbsoluteFill>{textBlock}</AbsoluteFill>
      </AmbientBg>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {kind === "video" ? (
        <>
          <OffthreadVideo
            src={resolveMediaSrc(src!)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.55) 30%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <KenBurnsImage
          src={resolveMediaSrc(src!)}
          durationFrames={durationInFrames}
          direction="zoom-in"
          overlay={overlay}
        />
      )}
      {textBlock}
    </AbsoluteFill>
  );
}
