import { readFileSync } from "node:fs";
import path from "node:path";
import type { Storyboard } from "../schemas/storyboard.js";

// Supertonic이 출력하는 PCM WAV 헤더에서 duration을 직접 계산.
// ffprobe 같은 외부 도구 의존 없이 RIFF/WAVE chunk를 순회한다.
// fmt chunk가 PCM이 아닐 경우 byte-rate를 계산 못 하면 throw.
export function probeWavDurationSec(buf: Buffer): number {
  if (buf.length < 44) throw new Error("WAV too short to contain header");
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("not a RIFF file");
  if (buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a WAVE file");

  let offset = 12;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let numChannels = 0;
  let dataSize = 0;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;

    if (chunkId === "fmt ") {
      numChannels = buf.readUInt16LE(payloadStart + 2);
      sampleRate = buf.readUInt32LE(payloadStart + 4);
      bitsPerSample = buf.readUInt16LE(payloadStart + 14);
    } else if (chunkId === "data") {
      dataSize = chunkSize;
      break;
    }

    // RIFF chunks pad odd sizes to even byte boundary.
    offset = payloadStart + chunkSize + (chunkSize % 2);
  }

  if (!sampleRate || !bitsPerSample || !numChannels || !dataSize) {
    throw new Error("WAV header missing fmt or data chunk");
  }

  const bytesPerSample = (bitsPerSample / 8) * numChannels;
  return dataSize / (sampleRate * bytesPerSample);
}

// storyboard의 각 shot.duration_sec를 실제 audio file duration으로 보정.
// 보정된 storyboard를 새 객체로 반환 (immutable). 호출자가 zod re-parse 후 저장.
export function reconcileStoryboard(
  storyboard: Storyboard,
  episodeDir: string,
): Storyboard {
  const reconciledShots = storyboard.shots.map((shot) => {
    const audioPath = path.join(episodeDir, shot.audio_ref);
    const buf = readFileSync(audioPath);
    const actual = probeWavDurationSec(buf);
    return { ...shot, duration_sec: Number(actual.toFixed(3)) };
  });
  return { ...storyboard, shots: reconciledShots };
}
