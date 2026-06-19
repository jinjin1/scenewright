import { AbsoluteFill, Img } from "remotion";
import { z } from "zod";
import { colors, typography } from "./theme/index.js";
import { resolveMediaSrc } from "./scenes/_media.js";

// 독립 썸네일 컴포지션 — Episode 파이프라인과 무관. 운영자가 고른 커버 이미지 위에
// 제목을 얹는다. `npx remotion still src/remotion/thumbnail-index.ts Thumbnail ...`로 렌더.
export const ThumbnailPropsSchema = z.object({
  imageSrc: z.string(), // staticFile 상대 경로 (public-dir 기준) 또는 http URL
  eyebrow: z.string().default(""),
  // 큰 제목 줄들. accent=true면 signal(앰버) 색으로 강조.
  lines: z
    .array(z.object({ text: z.string(), accent: z.boolean().default(false) }))
    .default([]),
  // 텍스트가 놓이는 쪽 — left면 좌측 다크 스크림.
  side: z.enum(["left", "right"]).default("left"),
});

export type ThumbnailProps = z.infer<typeof ThumbnailPropsSchema>;

export function Thumbnail({ imageSrc, eyebrow, lines, side }: ThumbnailProps) {
  const scrim =
    side === "left"
      ? "linear-gradient(to right, rgba(8,8,8,0.94) 0%, rgba(8,8,8,0.82) 34%, rgba(8,8,8,0.25) 62%, transparent 80%)"
      : "linear-gradient(to left, rgba(8,8,8,0.94) 0%, rgba(8,8,8,0.82) 34%, rgba(8,8,8,0.25) 62%, transparent 80%)";

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Img
        src={resolveMediaSrc(imageSrc)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* 가독성 스크림 + 바닥 보강 */}
      <AbsoluteFill style={{ background: scrim }} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(8,8,8,0.7) 0%, transparent 28%)",
        }}
      />

      <AbsoluteFill
        style={{
          flexDirection: "column",
          justifyContent: "center",
          alignItems: side === "left" ? "flex-start" : "flex-end",
          padding: "0 72px",
          textAlign: side === "left" ? "left" : "right",
        }}
      >
        {eyebrow ? (
          <div
            style={{
              fontFamily: `"Geist", ${typography.family}`,
              fontSize: 30,
              fontWeight: typography.weight.bold,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: colors.accent,
              marginBottom: 22,
              textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        {lines.map((ln, i) => (
          <div
            key={i}
            style={{
              fontFamily: typography.family,
              fontSize: 116,
              fontWeight: typography.weight.black,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
              color: ln.accent ? colors.signal : colors.text,
              textShadow: "0 4px 28px rgba(0,0,0,0.85)",
              maxWidth: 760,
            }}
          >
            {ln.text}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
