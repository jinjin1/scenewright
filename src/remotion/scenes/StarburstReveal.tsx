import { Starburst } from "@remotion/starburst";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { StarburstRevealProps } from "../../schemas/script.js";
import { colors, typography } from "../theme/index.js";
import { AmbientBg } from "./_AmbientBg.js";
import { useEntrance } from "./_anim.js";

// 스타버스트 리빌 — 중앙 헤드라인(**키워드·펀치라인**) 뒤에서 방사형 빛줄기가 차오르고 잦아드는
// reveal 악센트. @remotion/starburst(WebGL, 정적 패턴)를 frame으로 구동: 회전·스케일·불투명도를
// 손으로 입힌다. 톤 리스크 있음(광선=축하·"짠"·hype 기호) → **영상당 2개 하드캡**(lint:script
// starburst-cap). 훅 반전·챕터 키워드·결론 펀치 같은 가장 강한 1~2순간만.
//
// **수치·성과는 쓰지 말 것** — hype 광선이 수치의 권위·신뢰를 깎는다(심야 홈쇼핑 느낌). 숫자는
// StatHero(클린 거대 숫자 + CountUp)가 정답. lint `starburst-numeric-headline`이 숫자만 들어간
// headline을 경고. 즉 ReactionBeat과 같은 "감정 1순간" 슬롯이지 StatHero 대체재가 아니다.
//
// 세련 세팅(`dual` 컨셉, 육안 튜닝 — _experiments/StarburstRefine 비교에서 채택): **이중 레이어**로
// 깊이를 준다. (1) 가는 크림 빛줄기 72개(god-ray 결) + (2) 성긴 뮤트-앰버 광선 14개를 역회전·낮은
// 불투명도로 겹쳐 미세한 입체감. 직설적 레트로 선버스트(채도 높은 단색·하드 엣지·팝)를 피하고,
// 높은 smoothness(부드러운 빛줄기, CSS blur는 렌더비용이라 안 씀)·낮은 vignette(가장자리 검정
// 페이드)·**팝 대신 느린 호흡 모션**(ease 차오름 + 미세 스케일 1.0→1.06 + 아주 느린 회전)으로
// 다크 에디토리얼 톤 유지.
//
// 라이선스: @remotion/starburst는 Remotion License(개인/≤3인 무료). CC BY 같은 영상 내
// attribution 의무는 없음(이모지와 다름).

const CREAM = colors.accent; // #e8e3d6 — 크림/본. 주 빛줄기.
const MUTED_AMBER = "#c9962e"; // signal(#fbbf24)보다 채도·명도 낮춘 앰버. 보조 깊이 레이어.
const MAX_OPACITY = 0.22; // 광선 레이어 상한 — 헤드라인을 가리지 않게

export function StarburstReveal({ eyebrow, headline, caption }: StarburstRevealProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 느린 호흡: 팝 대신 ease로 차오르고(rise), 끝에서 잦아든다(fade). 한 순간의 악센트지만 우아하게.
  const rise = interpolate(frame, [0, fps * 1.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const burstOpacity =
    interpolate(
      frame,
      [0, fps * 0.6, fps * 2.0, fps * 2.8],
      [0, 1, 0.85, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ) * MAX_OPACITY;
  // 아주 느린 등속 회전(정적 패턴이라 직접 구동) + 미세 스케일 호흡(1.0→1.06).
  const rotation = interpolate(frame, [0, fps * 3], [0, 10]);
  const breathe = (0.9 + rise * 0.1) * (1 + 0.06 * rise);

  // 헤드라인·부연 진입 (gentle — 큰 텍스트 overshoot 0).
  const head = useEntrance(frame, fps, { delayFrames: 6, preset: "gentle", rise: 0 });
  const cap = useEntrance(frame, fps, { delayFrames: 18, preset: "gentle" });

  return (
    <AmbientBg tint="warm">
      {/* 이중 광선 레이어 — 헤드라인 뒤. 느린 호흡 + 페이드 인/아웃. */}
      <AbsoluteFill
        style={{
          opacity: burstOpacity,
          transform: `scale(${breathe})`,
          pointerEvents: "none",
        }}
      >
        {/* (1) 주 레이어 — 가는 크림 빛줄기(god-ray). */}
        <Starburst
          rays={72}
          colors={[CREAM, colors.bg]}
          rotation={rotation}
          smoothness={0.78}
          vignette={0.13}
        />
        {/* (2) 보조 레이어 — 성긴 뮤트-앰버 광선, 역회전·반투명으로 깊이. */}
        <AbsoluteFill style={{ opacity: 0.5 }}>
          <Starburst
            rays={14}
            colors={[MUTED_AMBER, colors.bg]}
            rotation={-rotation * 1.4}
            smoothness={0.6}
            vignette={0.1}
          />
        </AbsoluteFill>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          textAlign: "center",
          padding: "120px 160px",
        }}
      >
        {eyebrow ? (
          <div
            style={{
              fontFamily: `"Geist", ${typography.family}`,
              fontSize: typography.size.eyebrow,
              color: colors.signal,
              fontWeight: typography.weight.medium,
              letterSpacing: typography.letterSpacing.eyebrow,
              textTransform: "uppercase",
              marginBottom: 48,
              opacity: head.opacity,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h1
          style={{
            fontFamily: typography.familyDisplay,
            fontSize: typography.size.display,
            fontWeight: typography.weight.black,
            lineHeight: typography.lineHeightTight,
            letterSpacing: typography.letterSpacing.display,
            color: colors.text,
            margin: 0,
            opacity: head.opacity,
            transform: `scale(${0.96 + rise * 0.04})`,
            textShadow: "0 4px 40px rgba(0,0,0,0.6)",
          }}
        >
          {headline}
        </h1>
        {caption ? (
          <div
            style={{
              fontFamily: typography.family,
              fontSize: typography.size.subhead,
              color: colors.textMuted,
              lineHeight: typography.lineHeight,
              marginTop: 48,
              maxWidth: 1400,
              opacity: cap.opacity,
              transform: `translateY(${cap.translateY}px)`,
            }}
          >
            {caption}
          </div>
        ) : null}
      </AbsoluteFill>
    </AmbientBg>
  );
}
