import { fitText, fitTextOnNLines } from "@remotion/layout-utils";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ScreenshotCalloutProps } from "../../schemas/script.js";
import { colors, motion, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";

// `src`/`durationInFrames`는 props 스키마에 없는 런타임 필드 — Episode가 stock/라이브러리
// 매니페스트와 그룹 길이를 보고 주입한다. src가 없으면 AmbientBg 위 텍스트로 폴백.
type Props = ScreenshotCalloutProps & { src?: string; durationInFrames?: number };

const PAD = 100;
const FRAME_W_MAX = 1920 - PAD * 2; // 1720
const TITLE_MAX = typography.size.heading; // 72
const CAPTION_MAX = typography.size.body; // 36
const BROWSER_BAR = 56;
const ANN_STEP = 12;

function resolveMediaSrc(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return staticFile(src);
}

function isVideoSrc(src: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);
}

// 실제 제품 UI 스크린샷을 프레임에 담고(브라우저/윈도우 크롬) 특정 영역을 주석으로
// 지목하는 씬. UI는 읽혀야 하므로 Ken Burns 없이 가벼운 scale-in만 쓴다.
export function ScreenshotCallout({
  eyebrow,
  title,
  caption,
  frame: frameStyle = "browser",
  fit = "contain",
  annotations,
  fallback_color,
  src,
  durationInFrames: _durationInFrames,
}: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg = fallback_color ?? colors.bg;
  const hasMedia = Boolean(src);

  // 헤더/캡션이 차지하는 세로 공간을 빼고 16:9 프레임을 가운데 맞춘다.
  const headerH = title || eyebrow ? 150 : 0;
  const captionH = caption ? 110 : 0;
  const availH = 1080 - PAD * 2 - headerH - captionH;
  const frameW = Math.min(FRAME_W_MAX, (availH * 16) / 9);
  const frameH = (frameW * 9) / 16;

  const enter = spring({ frame, fps, durationInFrames: 18, config: { damping: 200 } });
  const enterScale = interpolate(enter, [0, 1], [0.96, 1]);
  const enterOpacity = interpolate(enter, [0, 1], [0, 1]);

  const eyebrowOpacity = interpolate(frame, [0, motion.fadeInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const captionOpacity = interpolate(
    frame,
    [motion.staggerStepFrames, motion.staggerStepFrames + motion.fadeInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const titleSize = title
    ? Math.min(
        TITLE_MAX,
        fitText({
          text: title,
          withinWidth: frameW,
          fontFamily: typography.family,
          fontWeight: typography.weight.bold,
        }).fontSize,
      )
    : TITLE_MAX;

  const captionSize = caption
    ? fitTextOnNLines({
        text: caption,
        maxLines: 2,
        maxBoxWidth: frameW,
        fontFamily: typography.family,
        fontWeight: typography.weight.medium,
        maxFontSize: CAPTION_MAX,
      }).fontSize
    : CAPTION_MAX;

  const header =
    title || eyebrow ? (
      <div
        style={{
          width: frameW,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          marginBottom: 28,
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
              marginBottom: 14,
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
            }}
          >
            {title}
          </h1>
        ) : null}
      </div>
    ) : null;

  const captionBlock = caption ? (
    <div
      style={{
        width: frameW,
        marginTop: 28,
        fontFamily: typography.family,
        fontSize: captionSize,
        color: colors.textMuted,
        lineHeight: typography.lineHeight,
        opacity: captionOpacity,
      }}
    >
      {caption}
    </div>
  ) : null;

  if (!hasMedia) {
    // 자산 0건 — 텍스트 씬으로 우아하게 폴백 (이 씬의 본질은 스샷이지만 빈 화면은 피한다).
    return (
      <AmbientBg tint="neutral">
        <AbsoluteFill
          style={{
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: PAD,
          }}
        >
          {header}
          {captionBlock}
        </AbsoluteFill>
      </AmbientBg>
    );
  }

  const showBar = frameStyle === "browser";
  const showChrome = frameStyle !== "none";
  const imageH = showBar ? frameH - BROWSER_BAR : frameH;

  const media = isVideoSrc(src!) ? (
    <OffthreadVideo
      src={resolveMediaSrc(src!)}
      muted
      style={{ width: "100%", height: "100%", objectFit: fit }}
    />
  ) : (
    <Img
      src={resolveMediaSrc(src!)}
      style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }}
    />
  );

  return (
    <AmbientBg tint="neutral">
      <AbsoluteFill
        style={{
          backgroundColor: "transparent",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: PAD,
        }}
      >
        {header}
        <div
          style={{
            position: "relative",
            width: frameW,
            height: frameH,
            borderRadius: showChrome ? 14 : 6,
            overflow: "hidden",
            backgroundColor: colors.surface,
            border: showChrome ? `1px solid ${colors.rule}` : "none",
            boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
            opacity: enterOpacity,
            transform: `scale(${enterScale})`,
          }}
        >
          {showBar ? (
            <div
              style={{
                height: BROWSER_BAR,
                backgroundColor: colors.elevated,
                borderBottom: `1px solid ${colors.rule}`,
                display: "flex",
                alignItems: "center",
                paddingLeft: 22,
                gap: 11,
              }}
            >
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                <div
                  key={c}
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: "50%",
                    backgroundColor: c,
                    opacity: 0.9,
                  }}
                />
              ))}
            </div>
          ) : null}
          <div style={{ position: "relative", width: "100%", height: imageH }}>
            {media}
            {/* 주석 박스 — 정규화(0~1) 좌표를 이미지 영역 기준 %로. 16:9 스샷일 때 가장 정확. */}
            {(annotations ?? []).map((a, i) => {
              const start = motion.fadeInFrames + i * ANN_STEP;
              const o = interpolate(
                frame,
                [start, start + motion.fadeInFrames],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              const pop = interpolate(
                frame,
                [start, start + motion.bulletEnterFrames],
                [1.06, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              const labelStart = start + 6;
              const labelO = interpolate(
                frame,
                [labelStart, labelStart + motion.fadeInFrames],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              const nearTop = a.y < 0.18;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${a.x * 100}%`,
                    top: `${a.y * 100}%`,
                    width: `${a.w * 100}%`,
                    height: `${a.h * 100}%`,
                    border: `3px solid ${colors.signal}`,
                    borderRadius: 8,
                    boxShadow: `0 0 0 6px rgba(251,191,36,0.18)`,
                    opacity: o,
                    transform: `scale(${pop})`,
                  }}
                >
                  {a.label ? (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        [nearTop ? "top" : "bottom"]: "calc(100% + 10px)",
                        backgroundColor: colors.signal,
                        color: colors.bg,
                        fontFamily: typography.family,
                        fontSize: typography.size.caption,
                        fontWeight: typography.weight.bold,
                        padding: "6px 14px",
                        borderRadius: 8,
                        whiteSpace: "nowrap",
                        opacity: labelO,
                      }}
                    >
                      {a.label}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {captionBlock}
      </AbsoluteFill>
    </AmbientBg>
  );
}
