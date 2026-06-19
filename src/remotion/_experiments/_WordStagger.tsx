import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  text: string;
  delayFrames?: number;
  staggerStepFrames?: number;
  // spring physics — damping 낮으면 더 통통 튐
  damping?: number;
  stiffness?: number;
  // 진입 거리 (px)
  riseDistance?: number;
  style?: React.CSSProperties;
};

// 문장을 단어로 split하고 한 단어씩 spring 진입. 강조하고 싶은 핵심 라인 (hook 등)에 사용.
// 모든 라인을 이걸로 처리하면 산만해지므로 절제해서 쓸 것.
export function WordStagger({
  text,
  delayFrames = 0,
  staggerStepFrames = 4,
  damping = 14,
  stiffness = 120,
  riseDistance = 16,
  style,
}: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = text.split(/(\s+)/);

  let visibleWordIndex = 0;
  return (
    <span style={style}>
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) {
          return <React.Fragment key={i}>{token}</React.Fragment>;
        }
        const wordIndex = visibleWordIndex++;
        const wordStart = delayFrames + wordIndex * staggerStepFrames;
        const progress = spring({
          frame: frame - wordStart,
          fps,
          config: { damping, mass: 0.6, stiffness },
        });
        const opacity = Math.min(Math.max(progress, 0), 1);
        const ty = (1 - opacity) * riseDistance;
        const scale = 0.94 + opacity * 0.06;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `translateY(${ty}px) scale(${scale})`,
              transformOrigin: "left bottom",
            }}
          >
            {token}
          </span>
        );
      })}
    </span>
  );
}
