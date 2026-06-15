import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { typography } from "../theme/index.js";

type Props = {
  from?: number;
  to: number;
  delayFrames?: number;
  durationFrames?: number;
  // 정수 카운트면 천 단위 콤마, 소수점 카운트면 소수 자리 수
  decimals?: number;
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
  // slot-machine 효과 — 랜덤 숫자가 cycle하면서 자릿수가 좌→우로 점차 lock.
  // explainer 영상의 dramatic stat 공개 모먼트에 적합.
  scramble?: boolean;
};

// 숫자 카운트업. Geist tabular nums로 width 안 흔들리게.
// 기본 mode = easeOutCubic 부드러운 카운트.
// scramble mode = slot-machine처럼 랜덤 숫자 cycle 후 자릿수가 lock.
export function CountUp({
  from = 0,
  to,
  delayFrames = 0,
  durationFrames = 24,
  decimals = 0,
  format,
  prefix = "",
  suffix = "",
  style,
  scramble = false,
}: Props) {
  const frame = useCurrentFrame();
  const localFrame = frame - delayFrames;

  let formatted: string;

  if (scramble) {
    formatted = scrambleFormat({
      to,
      decimals,
      progress:
        localFrame < 0 ? 0 : Math.min(localFrame / durationFrames, 1),
      frame,
    });
  } else {
    const value = interpolate(
      localFrame,
      [0, durationFrames],
      [from, to],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
      },
    );

    if (format) {
      formatted = format(value);
    } else if (decimals === 0) {
      formatted = Math.round(value).toLocaleString("en-US");
    } else {
      formatted = value.toFixed(decimals);
    }
  }

  return (
    <span
      style={{
        fontFamily: typography.familyDisplay,
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// scramble: target 문자열의 자릿수를 좌→우로 점차 lock, 나머지는 매 프레임 random.
function scrambleFormat({
  to,
  decimals,
  progress,
  frame,
}: {
  to: number;
  decimals: number;
  progress: number;
  frame: number;
}): string {
  const targetStr =
    decimals === 0
      ? Math.round(to).toLocaleString("en-US")
      : to.toFixed(decimals);
  const digitCount = (targetStr.match(/\d/g) ?? []).length;
  // progress=1 직전에 모두 lock되도록 0.5 buffer 추가
  const lockedCount = Math.floor(progress * (digitCount + 0.5));

  let result = "";
  let digitIdx = 0;
  for (const ch of targetStr) {
    if (/\d/.test(ch)) {
      if (digitIdx < lockedCount) {
        result += ch;
      } else {
        const r = random(`cnt-${frame}-${digitIdx}`);
        result += Math.floor(r * 10).toString();
      }
      digitIdx += 1;
    } else {
      result += ch;
    }
  }
  return result;
}
