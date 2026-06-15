import React from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";
import { colors } from "../theme/index.js";

type Direction = "zoom-in" | "zoom-out" | "pan-right" | "pan-left";
type Overlay = "none" | "bottom" | "left" | "full";

type Props = {
  src: string;
  // burn 효과가 펼쳐질 프레임 수 — 호출자가 Sequence duration을 전달
  durationFrames: number;
  direction?: Direction;
  // 텍스트가 위에 올라갈 때 가독성 위한 다크 그라디언트 마스크
  overlay?: Overlay;
  // 최대 스케일 (기본 1.08). 더 강하게 줌하려면 키움
  maxScale?: number;
  style?: React.CSSProperties;
};

// 모든 정지 이미지에 슬로우 줌·팬을 적용해 "살아있는 화면"으로 만든다.
// explainer 영상에서 stock photo·UI screenshot·인물 사진을 정지로 두면 즉시 retention 깨짐.
export function KenBurnsImage({
  src,
  durationFrames,
  direction = "zoom-in",
  overlay = "none",
  maxScale = 1.08,
  style,
}: Props) {
  const frame = useCurrentFrame();
  const t = Math.min(Math.max(frame / Math.max(durationFrames, 1), 0), 1);

  let scale = 1;
  let tx = 0;
  let ty = 0;

  switch (direction) {
    case "zoom-in":
      scale = interpolate(t, [0, 1], [1.0, maxScale]);
      break;
    case "zoom-out":
      scale = interpolate(t, [0, 1], [maxScale, 1.0]);
      break;
    case "pan-right":
      scale = maxScale;
      tx = interpolate(t, [0, 1], [-2.5, 2.5]);
      break;
    case "pan-left":
      scale = maxScale;
      tx = interpolate(t, [0, 1], [2.5, -2.5]);
      break;
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: colors.bg,
        ...style,
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
          transformOrigin: "center",
        }}
      />
      {overlay !== "none" ? <OverlayMask kind={overlay} /> : null}
    </div>
  );
}

function OverlayMask({ kind }: { kind: "bottom" | "left" | "full" }) {
  const gradient = {
    bottom:
      "linear-gradient(to top, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.65) 30%, transparent 70%)",
    left: "linear-gradient(to right, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.65) 40%, transparent 80%)",
    full: "linear-gradient(135deg, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.55) 100%)",
  }[kind];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: gradient,
        pointerEvents: "none",
      }}
    />
  );
}
