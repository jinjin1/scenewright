import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { DecisionMatrixProps } from "../../schemas/script.js";
import { colors, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { EmojiMark } from "./_EmojiMark.js";
import { useEntrance } from "./_anim.js";

// 판정/의사결정 매트릭스 — 각 행을 의미 마커 이모지(Tier1 정적 Twemoji SVG)로 판정.
// 이모지는 "의미의 구두점"(판정·리스크·추세)일 때만. 행마다 staggered 진입, 마커는 행 텍스트보다
// 살짝 뒤에 톡. 화면 한·영 병기(ko + en?), 내레이션엔 이모지 없음(TTS).

const STEP = 12; // 행 간 stagger 프레임

export function DecisionMatrix({ eyebrow, title, rows }: DecisionMatrixProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eb = useEntrance(frame, fps, { preset: "gentle", rise: 8 });
  const tt = useEntrance(frame, fps, { delayFrames: 4, preset: "gentle" });

  return (
    <AmbientBg tint="neutral">
      <AbsoluteFill
        style={{ justifyContent: "center", paddingLeft: 200, paddingRight: 200 }}
      >
        {eyebrow ? (
          <div
            style={{
              fontFamily: typography.familyDisplay,
              fontSize: typography.size.eyebrow,
              color: colors.accent,
              fontWeight: typography.weight.medium,
              letterSpacing: typography.letterSpacing.eyebrow,
              textTransform: "uppercase",
              opacity: eb.opacity,
              transform: `translateY(${eb.translateY}px)`,
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        <h1
          style={{
            fontFamily: typography.family,
            fontSize: typography.size.title,
            fontWeight: typography.weight.bold,
            letterSpacing: typography.letterSpacing.display,
            lineHeight: typography.lineHeightTight,
            color: colors.text,
            margin: "20px 0 64px",
            opacity: tt.opacity,
            transform: `translateY(${tt.translateY}px)`,
          }}
        >
          {title}
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {rows.map((row, i) => {
            const rowStart = 12 + i * STEP;
            const a = useEntrance(frame, fps, {
              delayFrames: rowStart,
              preset: "lively",
            });
            return (
              <div
                key={`${i}-${row.ko}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 32,
                  opacity: a.opacity,
                  transform: `translateY(${a.translateY}px)`,
                }}
              >
                {/* 마커는 행 텍스트보다 살짝 뒤에 톡 — delayFrames +6 */}
                <EmojiMark emoji={row.verdict} size={72} delayFrames={rowStart + 6} />
                <span
                  style={{
                    fontFamily: typography.family,
                    fontSize: typography.size.heading,
                    fontWeight: typography.weight.bold,
                    color: colors.text,
                  }}
                >
                  {row.ko}
                </span>
                {row.en ? (
                  <span
                    style={{
                      fontFamily: typography.familyDisplay,
                      fontSize: typography.size.subhead,
                      fontWeight: typography.weight.regular,
                      color: colors.textMuted,
                    }}
                  >
                    {row.en}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AmbientBg>
  );
}
