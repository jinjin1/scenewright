import { AbsoluteFill, Img, staticFile } from "remotion";
import { z } from "zod";

// "Transformed Thumbnail.html" (Claude Design 핸드오프)의 픽셀 재현.
// Episode 파이프라인과 무관한 독립 커버 썸네일.
// 렌더: npx remotion still src/remotion/thumbnail-index.tsx TransformedThumbnail \
//   <out.png> --public-dir=<photo dir> --scale=2 --props='{"imageSrc":"team-celebrate.png"}'
//
// 디자인 토큰 (원본 :root 그대로)
const C = {
  bg: "#0B0C0E",
  coral: "#FF5A36",
  coralDeep: "#E6431F",
  cream: "#F4EEE6",
  muted: "#8B919B",
  line: "rgba(255,255,255,.10)",
} as const;

const FONT_KR = '"Noto Sans KR", system-ui, sans-serif';
const FONT_DISPLAY = '"Archivo", system-ui, sans-serif';
const FONT_MONO = '"Space Mono", monospace';

export const TransformedThumbnailPropsSchema = z.object({
  // staticFile 상대 경로(public-dir 기준) 또는 http URL
  imageSrc: z.string(),
  eyebrowLabel: z.string().default("BOOK REVIEW"),
  eyebrowAuthor: z.string().default("마티 케이건"),
  // 큰 제목 줄. accent=true면 coral.
  titleLines: z
    .array(z.object({ text: z.string(), accent: z.boolean().default(false) }))
    .default([
      { text: "프로덕트", accent: false },
      { text: "오퍼레이팅 모델", accent: false },
      { text: "이란?", accent: true },
    ]),
  bookPill: z.string().default("트랜스폼드"),
  bookPillSuffix: z.string().default("리뷰"),
  // 북카드 (우상단)
  bookMeta: z.string().default("SVPG · Book"),
  // 영문 제목 — ­(soft hyphen)로 184px 폭 안에서 줄바꿈 유도
  bookEnTitle: z.string().default("TRANS­FORMED"),
  bookKoTitle: z.string().default("트랜스폼드"),
  bookAuthor: z.string().default("Marty Cagan"),
  // 우하단 마이크로 라벨 — accent 부분만 coral
  tagText: z.string().default("PRODUCT OPERATING"),
  tagAccent: z.string().default("MODEL"),
});

export type TransformedThumbnailProps = z.infer<
  typeof TransformedThumbnailPropsSchema
>;

function resolveSrc(src: string): string {
  return /^https?:\/\//.test(src) ? src : staticFile(src);
}

export function TransformedThumbnail({
  imageSrc,
  eyebrowLabel,
  eyebrowAuthor,
  titleLines,
  bookPill,
  bookPillSuffix,
  bookMeta,
  bookEnTitle,
  bookKoTitle,
  bookAuthor,
  tagText,
  tagAccent,
}: TransformedThumbnailProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      {/* ---------- photo, full bleed ---------- */}
      <AbsoluteFill style={{ zIndex: 1 }}>
        <Img
          src={resolveSrc(imageSrc)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "70% 30%",
            transform: "scale(1.2)",
            transformOrigin: "82% 42%",
            filter: "contrast(1.05) saturate(1.08) brightness(1.16)",
          }}
        />
        {/* dark wash: 좌측 패널은 솔리드, 우측 사진은 빠르게 클리어 */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(95deg,
                ${C.bg} 0%,
                ${C.bg} 25%,
                rgba(11,12,14,.74) 37%,
                rgba(11,12,14,.26) 49%,
                rgba(11,12,14,0) 60%,
                rgba(11,12,14,0) 100%),
              linear-gradient(0deg, rgba(11,12,14,.34) 0%, transparent 20%)`,
          }}
        />
      </AbsoluteFill>

      {/* faint engineering grid on the dark side */}
      <AbsoluteFill
        style={{
          zIndex: 2,
          opacity: 0.5,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px),
            linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage:
            "linear-gradient(90deg, #000 0%, #000 34%, transparent 56%)",
          WebkitMaskImage:
            "linear-gradient(90deg, #000 0%, #000 34%, transparent 56%)",
        }}
      />

      {/* ---------- text block ---------- */}
      <div
        style={{
          position: "absolute",
          zIndex: 5,
          left: 72,
          top: 0,
          bottom: 0,
          width: 660,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: FONT_MONO,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.muted,
            marginBottom: 26,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: C.coral,
              boxShadow: `0 0 16px ${C.coral}`,
            }}
          />
          {/* 원본 &nbsp; 거동 보존: 공백을 non-breaking space로 */}
          {eyebrowLabel.replace(/ /g, "\u00A0")}
          <span style={{ opacity: 0.4 }}>·</span>
          <b style={{ color: C.cream, fontWeight: 700 }}>
            {eyebrowAuthor.replace(/ /g, "\u00A0")}
          </b>
        </div>

        {/* title */}
        <h1
          style={{
            position: "relative",
            margin: 0,
            paddingLeft: 26,
            color: C.cream,
            fontFamily: FONT_KR,
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: "-0.035em",
            textShadow: "0 2px 28px rgba(11,12,14,.6)",
          }}
        >
          {/* coral bar (::before) */}
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 6,
              bottom: 8,
              width: 7,
              background: C.coral,
              boxShadow: "0 0 24px rgba(255,90,54,.55)",
            }}
          />
          {titleLines.map((ln, i) => (
            <span
              key={i}
              style={{
                display: "block",
                fontSize: 84,
                color: ln.accent ? C.coral : C.cream,
              }}
            >
              {ln.text}
            </span>
          ))}
        </h1>

        {/* sub line / book reference */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 40,
            marginLeft: 26,
          }}
        >
          <span style={{ width: 38, height: 2, background: C.coral }} />
          <span
            style={{
              fontFamily: FONT_KR,
              fontWeight: 700,
              fontSize: 26,
              color: C.cream,
              letterSpacing: "-0.01em",
            }}
          >
            <span
              style={{
                background: C.coral,
                color: "#1a0a06",
                fontWeight: 900,
                padding: "3px 12px 5px",
                borderRadius: 4,
              }}
            >
              {bookPill}
            </span>{" "}
            {bookPillSuffix}
          </span>
        </div>
      </div>

      {/* ---------- book card, top-right ---------- */}
      <div
        style={{
          position: "absolute",
          zIndex: 6,
          right: 46,
          top: 46,
          width: 184,
          height: 250,
          background: `linear-gradient(160deg, ${C.coral} 0%, ${C.coralDeep} 100%)`,
          borderRadius: 6,
          boxShadow:
            "0 24px 50px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.18)",
          transform: "rotate(4deg)",
          padding: "22px 20px",
          display: "flex",
          flexDirection: "column",
          color: "#fff",
          overflow: "hidden",
        }}
      >
        {/* spine shadow (::before) */}
        <span
          style={{
            position: "absolute",
            left: 12,
            top: 0,
            bottom: 0,
            width: 6,
            background: "rgba(0,0,0,.18)",
          }}
        />
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          {bookMeta}
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: 33,
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
            marginTop: "auto",
          }}
        >
          {bookEnTitle}
        </div>
        <div
          style={{
            fontFamily: FONT_KR,
            fontWeight: 900,
            fontSize: 22,
            marginTop: 8,
            letterSpacing: "-0.02em",
          }}
        >
          {bookKoTitle}
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,.3)",
            opacity: 0.92,
          }}
        >
          {bookAuthor}
        </div>
      </div>

      {/* bottom-right micro label */}
      <div
        style={{
          position: "absolute",
          zIndex: 6,
          right: 34,
          bottom: 28,
          fontFamily: FONT_MONO,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(244,238,230,.78)",
          textShadow: "0 2px 12px rgba(0,0,0,.8)",
        }}
      >
        {tagText} <span style={{ color: C.coral }}>{tagAccent}</span>
      </div>
    </AbsoluteFill>
  );
}
