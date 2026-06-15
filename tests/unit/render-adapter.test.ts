import { describe, expect, it } from "vitest";
import {
  buildCaptionsByShot,
  buildStockSrcByShotIndex,
  type RenderManifest,
} from "../../src/pipeline/render-adapter.js";
import { ScriptSchema } from "../../src/schemas/script.js";
import { StoryboardSchema } from "../../src/schemas/storyboard.js";

// Finding 1A (CRITICAL): cli/render.ts가 render.md의 인라인 어댑터를 PORT한다.
// 이 테스트가 PORT된 함수의 출력이 render.md 의사코드와 **동일**함을 회귀로 잠근다.
// (.claude/commands/render.md의 `stockSrcByShotIndex 어댑터` / `captions 어댑터` 절)

const SLUG = "demo";

// 4 shots. StockBg 2개(미디어 필요) + TitleCard 2개. audio_ref로 매핑한다.
const storyboard = StoryboardSchema.parse({
  meta: { fps: 30, width: 1920, height: 1080 },
  shots: [
    {
      scene_id: "scene01",
      audio_ref: "assets/audio/scene01-line01.wav",
      duration_sec: 2,
      broll_keywords: ["x"],
      component: "StockBg",
      props: { kind: "photo" },
    },
    {
      scene_id: "scene01",
      audio_ref: "assets/audio/scene01-line02.wav",
      duration_sec: 2,
      component: "TitleCard",
      props: { title: "t" },
    },
    {
      scene_id: "scene02",
      audio_ref: "assets/audio/scene02-line01.wav",
      duration_sec: 2,
      broll_keywords: ["y"],
      component: "StockBg",
      props: { kind: "photo" },
    },
    {
      scene_id: "scene02",
      audio_ref: "assets/audio/scene02-line02.wav",
      duration_sec: 2,
      broll_keywords: ["z"],
      component: "StockBg",
      props: { kind: "photo" },
    },
  ],
});

describe("buildStockSrcByShotIndex — parity with render.md pseudocode", () => {
  it("maps by audio_ref, strips the episodes/<slug>/ prefix, keeps multi-clip arrays", () => {
    const manifest: RenderManifest = {
      entries: [
        {
          audio_ref: "assets/audio/scene01-line01.wav",
          provider: "pexels",
          local_paths: [
            "episodes/demo/assets/stock/pexels-aaa.jpg",
            "episodes/demo/assets/stock/pexels-bbb.jpg",
          ],
        },
        // provider null(색 폴백) → skip.
        {
          audio_ref: "assets/audio/scene01-line02.wav",
          provider: null,
          local_paths: [],
        },
        // 라이브러리 자산도 local_paths가 채워진 일반 entry → 동일 처리.
        {
          audio_ref: "assets/audio/scene02-line01.wav",
          provider: "library",
          local_paths: ["episodes/demo/assets/stock/library-ccc.png"],
        },
        // 매칭 shot 없음(idx<0) → skip.
        {
          audio_ref: "assets/audio/ghost.wav",
          provider: "pexels",
          local_paths: ["episodes/demo/assets/stock/x.jpg"],
        },
        // provider는 있으나 local_paths 비었음 → skip.
        {
          audio_ref: "assets/audio/scene01-line01.wav",
          provider: "pexels",
          local_paths: [],
        },
      ],
    };

    expect(buildStockSrcByShotIndex(manifest, storyboard, SLUG)).toEqual({
      "0": ["assets/stock/pexels-aaa.jpg", "assets/stock/pexels-bbb.jpg"],
      "2": ["assets/stock/library-ccc.png"],
    });
  });

  it("strips only the matching slug prefix — foreign/relative paths pass through", () => {
    const manifest: RenderManifest = {
      entries: [
        {
          audio_ref: "assets/audio/scene02-line02.wav",
          provider: "pexels",
          local_paths: [
            "assets/stock/already-relative.jpg",
            "episodes/other/assets/stock/foreign.jpg",
            "episodes/demo/assets/stock/own.jpg",
          ],
        },
      ],
    };

    expect(buildStockSrcByShotIndex(manifest, storyboard, SLUG)).toEqual({
      "3": [
        "assets/stock/already-relative.jpg",
        "episodes/other/assets/stock/foreign.jpg",
        "assets/stock/own.jpg",
      ],
    });
  });

  it("returns {} for an empty manifest", () => {
    expect(buildStockSrcByShotIndex({ entries: [] }, storyboard, SLUG)).toEqual({});
  });

  // Codex #4: prefer the manifest's authoritative shot_index (robust to dup audio_ref).
  it("uses shot_index when present and consistent with the storyboard", () => {
    const manifest: RenderManifest = {
      entries: [
        {
          shot_index: 2,
          audio_ref: "assets/audio/scene02-line01.wav",
          provider: "pexels",
          local_paths: ["episodes/demo/assets/stock/p.jpg"],
        },
      ],
    };
    expect(buildStockSrcByShotIndex(manifest, storyboard, SLUG)).toEqual({
      "2": ["assets/stock/p.jpg"],
    });
  });

  it("falls back to audio_ref when shot_index is stale (out of range or mismatched)", () => {
    const manifest: RenderManifest = {
      entries: [
        // out of range → fall back to findIndex(audio_ref) → shot 0.
        {
          shot_index: 99,
          audio_ref: "assets/audio/scene01-line01.wav",
          provider: "pexels",
          local_paths: ["episodes/demo/assets/stock/a.jpg"],
        },
        // points at shot 0 but audio_ref is shot 2's → mismatch → fall back → shot 2.
        {
          shot_index: 0,
          audio_ref: "assets/audio/scene02-line01.wav",
          provider: "pexels",
          local_paths: ["episodes/demo/assets/stock/c.jpg"],
        },
      ],
    };
    expect(buildStockSrcByShotIndex(manifest, storyboard, SLUG)).toEqual({
      "0": ["assets/stock/a.jpg"],
      "2": ["assets/stock/c.jpg"],
    });
  });
});

describe("buildCaptionsByShot — parity with render.md pseudocode", () => {
  it("one cleaned caption per shot, matched by line id, missing → empty string", () => {
    const script = ScriptSchema.parse({
      lines: [
        // toCaption: 콤마+공백 → 공백, "..." → 공백, trim.
        { id: "scene01-line01", text: "안녕하세요, 반갑습니다..." },
        // em dash → 공백, 다중 공백 → 하나.
        { id: "scene01-line02", text: "두 번째 줄 — 강조" },
        { id: "scene02-line01", text: "세 번째 줄." },
        // scene02-line02 라인은 일부러 생략 → "".
      ],
    });

    // 인덱스 = shot 순서. audio_ref "assets/audio/<id>.wav" → id.
    expect(buildCaptionsByShot(storyboard, script)).toEqual([
      "안녕하세요 반갑습니다",
      "두 번째 줄 강조",
      "세 번째 줄.",
      "",
    ]);
  });

  it("returns all empty strings when no script line matches", () => {
    const script = ScriptSchema.parse({
      lines: [{ id: "unrelated", text: "no match" }],
    });
    expect(buildCaptionsByShot(storyboard, script)).toEqual(["", "", "", ""]);
  });
});
