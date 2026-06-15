import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import type { StockBgProps } from "../../schemas/script.js";
import { colors } from "../theme/index.js";
import { KenBurnsImage } from "./_KenBurnsImage.js";

// 한 visual 그룹을 채우는 B-roll 컷 세그먼트. Episode 컴포지션이 stock 매니페스트와
// shot duration을 보고 분해해서 주입한다. `from`/`durationInFrames`는 그룹 시작 기준.
export type StockSegmentInput = {
  src: string;
  from: number;
  durationInFrames: number;
};

// `segments`는 props 스키마에 없는 런타임 필드 — Episode가 주입한다.
// 0건이면 Episode가 LineCard로 폴백하므로 여기 오면 최소 1개는 있다.
type Props = StockBgProps & { segments?: StockSegmentInput[] };

// 사진 컷마다 다른 Ken Burns 방향을 돌려 "같은 무드 다른 움직임"을 준다.
const KEN_BURNS_DIRS = ["zoom-in", "pan-right", "zoom-out", "pan-left"] as const;

function resolveMediaSrc(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return staticFile(src);
}

// 컷 진입 시 짧은 fade-in으로 하드컷의 거슬림을 덜어준다 (세그먼트 로컬 프레임 기준).
function ClipFade({
  durationInFrames,
  children,
}: {
  durationInFrames: number;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const fade = Math.min(8, Math.floor(durationInFrames / 2));
  const opacity =
    fade > 0
      ? interpolate(frame, [0, fade], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

function Clip({
  kind,
  src,
  durationInFrames,
  index,
  bg,
}: {
  kind: StockBgProps["kind"];
  src: string;
  durationInFrames: number;
  index: number;
  bg: string;
}) {
  const resolved = resolveMediaSrc(src);

  if (kind === "video") {
    return (
      <AbsoluteFill style={{ backgroundColor: bg }}>
        <ClipFade durationInFrames={durationInFrames}>
          <OffthreadVideo
            src={resolved}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </ClipFade>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <ClipFade durationInFrames={durationInFrames}>
        <KenBurnsImage
          src={resolved}
          durationFrames={durationInFrames}
          direction={KEN_BURNS_DIRS[index % KEN_BURNS_DIRS.length]}
        />
      </ClipFade>
    </AbsoluteFill>
  );
}

export function StockBg({ kind, fallback_color, segments }: Props) {
  const bg = fallback_color ?? colors.bg;

  if (!segments || segments.length === 0) {
    // color kind이거나 자산 0건 — 단색. (사진/비디오 0건은 Episode가 LineCard로 처리)
    return <AbsoluteFill style={{ backgroundColor: bg }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {segments.map((seg, i) => (
        <Sequence
          key={`seg-${i}`}
          from={seg.from}
          durationInFrames={Math.max(1, seg.durationInFrames)}
        >
          <Clip
            kind={kind}
            src={seg.src}
            durationInFrames={Math.max(1, seg.durationInFrames)}
            index={i}
            bg={bg}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
