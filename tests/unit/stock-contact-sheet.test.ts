import { describe, expect, it } from "vitest";
import {
  renderContactSheet,
  type SheetManifest,
} from "../../src/pipeline/stock/contact-sheet.js";
import type { MediaResult } from "../../src/pipeline/stock/types.js";

function media(id: string, tags: string[], over: Partial<MediaResult> = {}): MediaResult {
  return {
    provider: "pexels",
    id,
    url: `https://example.test/${id}`,
    download_url: `https://cdn.example.test/${id}.jpg`,
    thumb_url: `https://cdn.example.test/${id}-thumb.jpg`,
    width: 1920,
    height: 1080,
    photographer: "p",
    photographer_url: "https://example.test/u/p",
    license_note: "test",
    tags,
    ...over,
  };
}

const manifest: SheetManifest = {
  generated_at: "2026-05-29T00:00:00.000Z",
  entries: [
    {
      shot_index: 0,
      shot_id: "shot-000",
      scene_id: "scene01",
      media_type: "photo",
      keywords: ["team meeting whiteboard"],
      provider: "pexels",
      local_paths: ["episodes/x/assets/stock/pexels-aaa.jpg"],
      attributions: [media("clean1", ["team", "meeting", "office"])],
    },
    {
      shot_index: 1,
      shot_id: "shot-001",
      scene_id: "scene02",
      media_type: "photo",
      keywords: ["phone mockup"],
      provider: "pixabay",
      local_paths: ["episodes/x/assets/stock/pixabay-bbb.jpg"],
      attributions: [media("blank1", ["smartphone", "mockup", "blank", "white"])],
    },
    {
      shot_index: 2,
      shot_id: "shot-002",
      scene_id: "scene03",
      media_type: "video",
      keywords: ["nonexistent keyword"],
      provider: null,
      local_paths: [],
      attributions: [],
    },
    {
      shot_index: 3,
      shot_id: "shot-003",
      scene_id: "scene04",
      media_type: "color",
      keywords: [],
      provider: null,
      local_paths: [],
      attributions: [],
    },
  ],
};

describe("renderContactSheet", () => {
  const html = renderContactSheet(manifest, "demo-slug");

  it("is a self-contained HTML document titled with the slug", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("demo-slug");
  });

  it("embeds remote thumbnails for stock assets", () => {
    expect(html).toContain("https://cdn.example.test/clean1-thumb.jpg");
  });

  it("flags blank/mockup assets with a warning badge", () => {
    expect(html).toContain("blank-ish");
  });

  it("flags shots that matched no media as missing", () => {
    expect(html).toContain("no media");
    expect(html).toContain("매치 0건");
  });

  it("summarizes counts (4 shots, 1 missing, 1 blank-ish)", () => {
    expect(html).toContain("<b>4</b> shots");
    expect(html).toContain("<b>1</b> missing");
    expect(html).toContain("<b>1</b> blank-ish");
  });

  it("escapes HTML in dynamic fields", () => {
    const evil: SheetManifest = {
      generated_at: "t",
      entries: [
        {
          shot_index: 0,
          shot_id: "shot-000",
          scene_id: "<script>alert(1)</script>",
          media_type: "color",
          keywords: [],
          provider: null,
          local_paths: [],
          attributions: [],
        },
      ],
    };
    const out = renderContactSheet(evil, "s");
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
