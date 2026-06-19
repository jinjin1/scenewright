import { staticFile } from "remotion";

// http(s) URL은 그대로 통과, 그 외 상대 경로는 staticFile(public-dir 기준)로 해석.
// 모든 미디어 씬(StockBg/SplitVisual/HeroImage/ScreenshotCallout)과 썸네일이 공유하는 단일 소스.
export function resolveMediaSrc(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return staticFile(src);
}
