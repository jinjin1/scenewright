import "./fonts.js";
import { Composition } from "remotion";
import { Episode, EpisodePropsSchema } from "./compositions/Episode.js";
import { calculateTotalFrames } from "./compositions/utils.js";

// Placeholder props — 운영자가 `remotion preview` 또는 `remotion render` 시
// --props 또는 inputProps로 실제 storyboard.json을 주입한다.
// calculateMetadata가 inputProps의 storyboard로 길이를 다시 계산.
const placeholderProps = EpisodePropsSchema.parse({
  storyboard: {
    meta: { fps: 30, width: 1920, height: 1080 },
    shots: [
      {
        scene_id: "scene01",
        audio_ref: "assets/audio/scene01-line01.wav",
        duration_sec: 3,
        broll_keywords: [],
        component: "TitleCard",
        props: {
          title: "Walking Skeleton",
          subtitle: "Episode composition placeholder",
          eyebrow: "Preview",
        },
      },
    ],
  },
});

export const Root = () => {
  return (
    <Composition
      id="Episode"
      component={Episode}
      defaultProps={placeholderProps}
      durationInFrames={calculateTotalFrames(placeholderProps.storyboard)}
      fps={placeholderProps.storyboard.meta.fps}
      width={placeholderProps.storyboard.meta.width}
      height={placeholderProps.storyboard.meta.height}
      calculateMetadata={({ props }) => ({
        durationInFrames: calculateTotalFrames(props.storyboard),
      })}
    />
  );
};
