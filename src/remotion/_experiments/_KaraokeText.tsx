import React from "react";
import {
  interpolate,
  interpolateColors,
  useCurrentFrame,
} from "remotion";
import { colors } from "../theme/index.js";

type Props = {
  text: string;
  // 각 단어가 active로 전환되는 시작 프레임. 길이는 text의 word 개수 이하여도 OK
  // (모자란 단어들은 끝까지 dim 유지).
  wordStartFrames: number[];
  dimColor?: string;
  activeColor?: string;
  transitionFrames?: number;
  style?: React.CSSProperties;
};

// 라인 전체가 dim으로 표시되고, narration 진행에 따라 각 단어가 bright로 전환.
// 일반 captions와 달리 강조 색 변화가 narration 타이밍에 정확히 동기화 — 시청자가
// "지금 narrator가 어디 읽고 있는지"를 무의식적으로 따라감.
export function KaraokeText({
  text,
  wordStartFrames,
  dimColor = colors.textDim,
  activeColor = colors.text,
  transitionFrames = 8,
  style,
}: Props) {
  const frame = useCurrentFrame();
  const tokens = text.split(/(\s+)/);

  let wordIndex = 0;
  return (
    <span style={style}>
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) {
          return <React.Fragment key={i}>{token}</React.Fragment>;
        }
        const myIndex = wordIndex++;
        const startFrame = wordStartFrames[myIndex];
        if (startFrame === undefined) {
          return (
            <span key={i} style={{ color: dimColor }}>
              {token}
            </span>
          );
        }
        const progress = interpolate(
          frame,
          [startFrame, startFrame + transitionFrames],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const color = interpolateColors(progress, [0, 1], [dimColor, activeColor]);
        return (
          <span key={i} style={{ color }}>
            {token}
          </span>
        );
      })}
    </span>
  );
}
