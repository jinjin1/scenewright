import { describe, expect, it, vi } from "vitest";
import { searchStock } from "../../src/pipeline/stock/index.js";
import type { MediaResult, StockProvider } from "../../src/pipeline/stock/types.js";

function fakeResult(provider: MediaResult["provider"], id: string): MediaResult {
  return {
    provider,
    id,
    url: `https://example.test/${provider}/${id}`,
    download_url: `https://cdn.example.test/${provider}/${id}.jpg`,
    thumb_url: `https://cdn.example.test/${provider}/${id}-thumb.jpg`,
    width: 1920,
    height: 1080,
    photographer: `${provider}-photog-${id}`,
    photographer_url: `https://example.test/u/${provider}-photog-${id}`,
    license_note: `${provider} license`,
  };
}

interface FakeOpts {
  name: MediaResult["provider"];
  photos?: MediaResult[];
  videos?: MediaResult[];
  // when true, omit the corresponding method entirely (mirrors Unsplash's missing video API)
  noPhotos?: boolean;
  noVideos?: boolean;
}

function fakeProvider(opts: FakeOpts) {
  const photoSpy = vi.fn(async () => opts.photos ?? []);
  const videoSpy = vi.fn(async () => opts.videos ?? []);
  const provider: StockProvider = { name: opts.name };
  if (!opts.noPhotos) provider.searchPhotos = photoSpy;
  if (!opts.noVideos) provider.searchVideos = videoSpy;
  return { provider, photoSpy, videoSpy };
}

describe("searchStock cascade — photos", () => {
  it("returns the first Unsplash hit and short-circuits other providers", async () => {
    const u = fakeProvider({ name: "unsplash", photos: [fakeResult("unsplash", "u1")] });
    const p = fakeProvider({ name: "pexels", photos: [fakeResult("pexels", "p1")] });
    const x = fakeProvider({ name: "pixabay", photos: [fakeResult("pixabay", "x1")] });

    const result = await searchStock("startup office", "photo", {
      photoOrder: [u.provider, p.provider, x.provider],
    });

    expect(result?.provider).toBe("unsplash");
    expect(result?.id).toBe("u1");
    expect(u.photoSpy).toHaveBeenCalledOnce();
    expect(p.photoSpy).not.toHaveBeenCalled();
    expect(x.photoSpy).not.toHaveBeenCalled();
  });

  it("falls through to Pexels when Unsplash is empty", async () => {
    const u = fakeProvider({ name: "unsplash", photos: [] });
    const p = fakeProvider({ name: "pexels", photos: [fakeResult("pexels", "p2")] });
    const x = fakeProvider({ name: "pixabay", photos: [fakeResult("pixabay", "x2")] });

    const result = await searchStock("team meeting", "photo", {
      photoOrder: [u.provider, p.provider, x.provider],
    });

    expect(result?.provider).toBe("pexels");
    expect(u.photoSpy).toHaveBeenCalledOnce();
    expect(p.photoSpy).toHaveBeenCalledOnce();
    expect(x.photoSpy).not.toHaveBeenCalled();
  });

  it("falls through to Pixabay when Unsplash and Pexels are empty", async () => {
    const u = fakeProvider({ name: "unsplash", photos: [] });
    const p = fakeProvider({ name: "pexels", photos: [] });
    const x = fakeProvider({ name: "pixabay", photos: [fakeResult("pixabay", "x3")] });

    const result = await searchStock("data dashboard", "photo", {
      photoOrder: [u.provider, p.provider, x.provider],
    });

    expect(result?.provider).toBe("pixabay");
    expect(x.photoSpy).toHaveBeenCalledOnce();
  });

  it("returns null when every provider is empty", async () => {
    const u = fakeProvider({ name: "unsplash", photos: [] });
    const p = fakeProvider({ name: "pexels", photos: [] });
    const x = fakeProvider({ name: "pixabay", photos: [] });

    const result = await searchStock("obscure keyword", "photo", {
      photoOrder: [u.provider, p.provider, x.provider],
    });

    expect(result).toBeNull();
  });

  it("skips providers that omit searchPhotos entirely", async () => {
    const u = fakeProvider({ name: "unsplash", noPhotos: true });
    const p = fakeProvider({ name: "pexels", photos: [fakeResult("pexels", "p4")] });

    const result = await searchStock("anything", "photo", {
      photoOrder: [u.provider, p.provider],
    });

    expect(result?.provider).toBe("pexels");
    expect(u.photoSpy).not.toHaveBeenCalled();
    expect(p.photoSpy).toHaveBeenCalledOnce();
  });
});

describe("searchStock cascade — videos", () => {
  it("queries Pexels first and skips Unsplash entirely", async () => {
    // Even if an Unsplash provider is in the override list, it has no searchVideos.
    const u = fakeProvider({ name: "unsplash", noVideos: true });
    const p = fakeProvider({ name: "pexels", videos: [fakeResult("pexels", "pv1")] });
    const x = fakeProvider({ name: "pixabay", videos: [fakeResult("pixabay", "xv1")] });

    const result = await searchStock("city skyline", "video", {
      videoOrder: [p.provider, x.provider],
    });

    expect(result?.provider).toBe("pexels");
    expect(u.videoSpy).not.toHaveBeenCalled();
    expect(p.videoSpy).toHaveBeenCalledOnce();
    expect(x.videoSpy).not.toHaveBeenCalled();
  });

  it("falls through to Pixabay video when Pexels is empty", async () => {
    const p = fakeProvider({ name: "pexels", videos: [] });
    const x = fakeProvider({ name: "pixabay", videos: [fakeResult("pixabay", "xv2")] });

    const result = await searchStock("nature shot", "video", {
      videoOrder: [p.provider, x.provider],
    });

    expect(result?.provider).toBe("pixabay");
  });

  it("returns null when both video providers are empty", async () => {
    const p = fakeProvider({ name: "pexels", videos: [] });
    const x = fakeProvider({ name: "pixabay", videos: [] });

    const result = await searchStock("missing", "video", {
      videoOrder: [p.provider, x.provider],
    });

    expect(result).toBeNull();
  });
});
