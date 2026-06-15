import { describe, expect, it } from "vitest";
import { probeWavDurationSec } from "../../src/pipeline/reconcile.js";

// 주어진 파라미터로 valid PCM WAV header + dummy data를 만든다.
function makeWav({
  sampleRate,
  bitsPerSample,
  numChannels,
  dataBytes,
}: {
  sampleRate: number;
  bitsPerSample: number;
  numChannels: number;
  dataBytes: number;
}): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const fmtChunkSize = 16;
  const buf = Buffer.alloc(12 + 8 + fmtChunkSize + 8 + dataBytes);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");

  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(fmtChunkSize, 16);
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);

  return buf;
}

describe("probeWavDurationSec", () => {
  it("computes duration for 1s of 44.1kHz mono 16-bit PCM", () => {
    const buf = makeWav({
      sampleRate: 44100,
      bitsPerSample: 16,
      numChannels: 1,
      dataBytes: 44100 * 2,
    });
    expect(probeWavDurationSec(buf)).toBeCloseTo(1.0, 4);
  });

  it("computes duration for 2.5s of 24kHz mono 16-bit (Supertonic-like)", () => {
    const buf = makeWav({
      sampleRate: 24000,
      bitsPerSample: 16,
      numChannels: 1,
      dataBytes: Math.round(24000 * 2 * 2.5),
    });
    expect(probeWavDurationSec(buf)).toBeCloseTo(2.5, 4);
  });

  it("handles stereo correctly (channels divide dataBytes)", () => {
    const buf = makeWav({
      sampleRate: 48000,
      bitsPerSample: 16,
      numChannels: 2,
      dataBytes: 48000 * 2 * 2 * 3, // 3s
    });
    expect(probeWavDurationSec(buf)).toBeCloseTo(3.0, 4);
  });

  it("throws on non-RIFF buffer", () => {
    const buf = Buffer.alloc(100, 0);
    expect(() => probeWavDurationSec(buf)).toThrow(/RIFF/);
  });

  it("throws on too-short buffer", () => {
    expect(() => probeWavDurationSec(Buffer.alloc(20))).toThrow(/too short/);
  });
});
