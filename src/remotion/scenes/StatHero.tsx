import { fitTextOnNLines } from "@remotion/layout-utils";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, motion, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { useEntrance } from "./_anim.js";
import { useBurstParticle } from "./_burst.js";
import { CountUp } from "./_CountUp.js";

const CAPTION_BOX = 1400;
const BURST_COUNT = 14; // 8~20 권장 — 렌더 예산·다크 에디토리얼 절제
const BURST_COLORS = [colors.accent, colors.signal] as const; // 크림 + amber만

// 숫자 뒤 중앙에서 방사하는 파티클 버스트(스코어 reveal 악센트). burst prop이 true일 때만.
// 콘텐츠 AbsoluteFill보다 먼저 렌더 = 숫자 뒤에 깔린다. useBurstParticle은 순수 함수라 map 호출 OK.
function BurstLayer({ fireFrame }: { fireFrame: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}
    >
      <div style={{ position: "relative", width: 0, height: 0 }}>
        {Array.from({ length: BURST_COUNT }).map((_, i) => {
          const p = useBurstParticle(frame, fps, i, {
            delayFrames: fireFrame,
            count: BURST_COUNT,
            radius: 280,
          });
          if (p.opacity <= 0) return null;
          const size = i % 3 === 0 ? 18 : 11;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: "50%",
                background: BURST_COLORS[i % BURST_COLORS.length],
                opacity: p.opacity,
                transform: `scale(${p.scale})`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

type Props = {
  value: number;
  from?: number;
  decimals?: number;
  eyebrow?: string;
  caption?: string;
  // 숫자 앞 prefix(예: "$") — CountUp 내장 처리
  prefix?: string;
  // 숫자 뒤 suffix(예: "%", "x"). small일 경우 visually 더 작게.
  suffix?: string;
  suffixSize?: "match" | "small";
  // 카운트업이 걸리는 프레임 수. 기본 36 (1.2초)
  countDurationFrames?: number;
  // slot-machine scramble 효과 (랜덤 숫자 cycle → 자릿수 lock)
  scramble?: boolean;
  // 카운트업 착지 순간 숫자 뒤에서 파티클 stagger+spring 버스트(승자/정답 reveal 악센트).
  burst?: boolean;
};

// 거대 숫자 + 라벨 한 줄 + 부연 caption. explainer 영상에서 stat 1개를 강조하는 결.
// 숫자 320px (display 144의 2배 이상) — 화면 임팩트 강하게.
export function StatHero({
  value,
  from = 0,
  decimals = 0,
  eyebrow,
  caption,
  prefix = "",
  suffix = "",
  suffixSize = "small",
  countDurationFrames = 36,
  scramble = false,
  burst = false,
}: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // eyebrow·숫자는 fade(rise 0 — 숫자는 CountUp이 값 애니메이션 담당), caption은 gentle rise.
  const { opacity: eyebrowOpacity } = useEntrance(frame, fps, { rise: 0 });
  const numberStart = motion.staggerStepFrames * 2;
  const { opacity: numberOpacity } = useEntrance(frame, fps, {
    delayFrames: numberStart,
    rise: 0,
  });
  const captionStart = numberStart + countDurationFrames - 6;
  const { opacity: captionOpacity, translateY: captionRise } = useEntrance(frame, fps, {
    delayFrames: captionStart,
  });

  const captionSize = caption
    ? fitTextOnNLines({
        text: caption,
        maxLines: 2,
        maxBoxWidth: CAPTION_BOX,
        fontFamily: typography.family,
        fontWeight: typography.weight.regular,
        maxFontSize: typography.size.subhead,
      }).fontSize
    : typography.size.subhead;

  return (
    <AmbientBg tint="warm">
      {burst ? <BurstLayer fireFrame={numberStart + countDurationFrames - 4} /> : null}
      <AbsoluteFill
        style={{
          padding: "120px 160px",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
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
              marginBottom: 56,
              opacity: eyebrowOpacity,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            opacity: numberOpacity,
          }}
        >
          <CountUp
            from={from}
            to={value}
            delayFrames={numberStart}
            durationFrames={countDurationFrames}
            decimals={decimals}
            prefix={prefix}
            scramble={scramble}
            style={{
              fontSize: 320,
              fontWeight: typography.weight.black,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: colors.text,
            }}
          />
          {suffix ? (
            <span
              style={{
                fontFamily: typography.familyDisplay,
                fontSize: suffixSize === "small" ? 120 : 320,
                fontWeight: typography.weight.bold,
                lineHeight: 1,
                color: colors.signal,
                letterSpacing: "-0.02em",
              }}
            >
              {suffix}
            </span>
          ) : null}
        </div>
        {caption ? (
          <div
            style={{
              fontFamily: typography.family,
              fontSize: captionSize,
              color: colors.textMuted,
              lineHeight: typography.lineHeight,
              marginTop: 56,
              maxWidth: CAPTION_BOX,
              opacity: captionOpacity,
              transform: `translateY(${captionRise}px)`,
            }}
          >
            {caption}
          </div>
        ) : null}
      </AbsoluteFill>
    </AmbientBg>
  );
}
