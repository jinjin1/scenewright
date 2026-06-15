import { fitTextOnNLines } from "@remotion/layout-utils";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { SplitVisualProps } from "../../schemas/script.js";
import { colors, motion, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { useEntrance } from "./_anim.js";
import { KenBurnsImage } from "./_KenBurnsImage.js";

// `src`/`durationInFrames`는 Episode가 주입하는 런타임 필드. src 없으면 텍스트 풀폭 폴백.
type Props = SplitVisualProps & { src?: string; durationInFrames?: number };

const PAD = 120;

function resolveMediaSrc(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return staticFile(src);
}

// 이미지 절반 + 텍스트 절반. 정의·설명을 그 사례 이미지와 나란히 세운다.
// items가 있으면 불릿 리스트, 없으면 body 문단. 미디어 0건이면 텍스트가 풀폭으로 폴백.
export function SplitVisual({
  heading,
  body,
  items,
  eyebrow,
  image_side = "right",
  kind = "photo",
  fallback_color,
  src,
  durationInFrames = 300,
}: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg = fallback_color ?? colors.bg;
  const hasMedia = Boolean(src);

  // 텍스트 컬럼 폭: 미디어 있으면 절반(960) - 좌우 패딩, 없으면 풀폭.
  const textColWidth = hasMedia ? 960 - PAD * 2 : 1920 - 160 * 2;

  const { opacity: eyebrowOpacity } = useEntrance(frame, fps, { rise: 0 });
  const headingStart = motion.staggerStepFrames;
  const { opacity: headingOpacity, translateY: headingRise } = useEntrance(frame, fps, {
    delayFrames: headingStart,
  });

  const headingSize = heading
    ? fitTextOnNLines({
        text: heading,
        maxLines: 2,
        maxBoxWidth: textColWidth,
        fontFamily: typography.family,
        fontWeight: typography.weight.bold,
        maxFontSize: typography.size.heading,
      }).fontSize
    : typography.size.heading;

  const bodySize = body
    ? fitTextOnNLines({
        text: body,
        maxLines: 6,
        maxBoxWidth: textColWidth,
        fontFamily: typography.family,
        fontWeight: typography.weight.regular,
        maxFontSize: typography.size.body,
      }).fontSize
    : typography.size.body;

  // 모든 항목을 같은 크기로: 가장 긴 항목이 2줄에 들어가는 폰트 사이즈로 통일.
  const itemIndent = 36;
  const longestItem =
    items && items.length > 0
      ? items.reduce((a, b) => (b.length > a.length ? b : a), items[0]!)
      : null;
  const itemSize = longestItem
    ? fitTextOnNLines({
        text: longestItem,
        maxLines: 2,
        maxBoxWidth: textColWidth - itemIndent,
        fontFamily: typography.family,
        fontWeight: typography.weight.medium,
        maxFontSize: typography.size.bullet,
      }).fontSize
    : typography.size.bullet;

  const textColumn = (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: hasMedia ? `${PAD}px ${PAD}px` : `${PAD}px 160px`,
        boxSizing: "border-box",
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
            marginBottom: 32,
            opacity: eyebrowOpacity,
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      {heading ? (
        <h2
          style={{
            fontFamily: typography.family,
            fontSize: headingSize,
            fontWeight: typography.weight.bold,
            letterSpacing: typography.letterSpacing.display,
            lineHeight: typography.lineHeightTight,
            color: colors.text,
            margin: 0,
            opacity: headingOpacity,
            transform: `translateY(${headingRise}px)`,
          }}
        >
          {heading}
        </h2>
      ) : null}
      {items && items.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: heading ? "40px 0 0 0" : 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {items.map((item, i) => {
            const itemStart = headingStart + (i + 1) * motion.staggerStepFrames;
            const { opacity: op, translateY: rise } = useEntrance(frame, fps, {
              delayFrames: itemStart,
              preset: "lively",
            });
            return (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "baseline",
                  opacity: op,
                  transform: `translateY(${rise}px)`,
                }}
              >
                <span style={{ color: colors.signal, fontSize: itemSize }}>·</span>
                <span
                  style={{
                    fontFamily: typography.family,
                    fontSize: itemSize,
                    fontWeight: typography.weight.medium,
                    color: colors.text,
                    lineHeight: typography.lineHeight,
                  }}
                >
                  {item}
                </span>
              </li>
            );
          })}
        </ul>
      ) : body ? (
        <div
          style={{
            fontFamily: typography.family,
            fontSize: bodySize,
            fontWeight: typography.weight.regular,
            color: colors.textMuted,
            lineHeight: typography.lineHeight,
            marginTop: heading ? 32 : 0,
            opacity: headingOpacity,
          }}
        >
          {body}
        </div>
      ) : null}
    </div>
  );

  if (!hasMedia) {
    return (
      <AmbientBg tint="neutral">
        <AbsoluteFill>{textColumn}</AbsoluteFill>
      </AmbientBg>
    );
  }

  const imageColumn = (
    <div style={{ width: 960, height: "100%", position: "relative" }}>
      {kind === "video" ? (
        <AbsoluteFill style={{ backgroundColor: bg }}>
          <OffthreadVideo
            src={resolveMediaSrc(src!)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      ) : (
        <KenBurnsImage
          src={resolveMediaSrc(src!)}
          durationFrames={durationInFrames}
          direction="zoom-in"
        />
      )}
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bg, flexDirection: "row" }}>
      {image_side === "left" ? (
        <>
          {imageColumn}
          {textColumn}
        </>
      ) : (
        <>
          {textColumn}
          {imageColumn}
        </>
      )}
    </AbsoluteFill>
  );
}
