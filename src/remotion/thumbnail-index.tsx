import "./fonts-thumbnail.js";
import { Composition, registerRoot } from "remotion";
import { Thumbnail, ThumbnailPropsSchema } from "./Thumbnail.js";
import {
  TransformedThumbnail,
  TransformedThumbnailPropsSchema,
} from "./TransformedThumbnail.js";

// Episode와 분리된 썸네일 전용 엔트리 (Root.tsx를 안 건드림).
// 렌더: npx remotion still src/remotion/thumbnail-index.tsx <id> <out.png> \
//   --public-dir=<photo dir> --scale=2 --props=<json>
const ThumbnailRoot = () => (
  <>
    <Composition
      id="Thumbnail"
      component={Thumbnail}
      schema={ThumbnailPropsSchema}
      durationInFrames={1}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{
        imageSrc: "",
        eyebrow: "맘 테스트 · THE MOM TEST",
        lines: [
          { text: "엄마도 거짓말", accent: false },
          { text: "못 하는 질문법", accent: true },
        ],
        side: "left" as const,
      }}
    />

    {/* "Transformed Thumbnail.html" 디자인 핸드오프의 픽셀 재현 */}
    <Composition
      id="TransformedThumbnail"
      component={TransformedThumbnail}
      schema={TransformedThumbnailPropsSchema}
      durationInFrames={1}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{
        imageSrc: "team-celebrate.png",
        eyebrowLabel: "BOOK REVIEW",
        eyebrowAuthor: "마티 케이건",
        titleLines: [
          { text: "프로덕트", accent: false },
          { text: "오퍼레이팅 모델", accent: false },
          { text: "이란?", accent: true },
        ],
        bookPill: "트랜스폼드",
        bookPillSuffix: "리뷰",
        bookMeta: "SVPG · Book",
        bookEnTitle: "TRANS­FORMED",
        bookKoTitle: "트랜스폼드",
        bookAuthor: "Marty Cagan",
        tagText: "PRODUCT OPERATING",
        tagAccent: "MODEL",
      }}
    />
  </>
);

registerRoot(ThumbnailRoot);
