import { describe, expect, it } from "vitest";

import { encodeWav, WAV_SAMPLE_RATE } from "@/components/callGuard/utils/wav";

const ascii = (view: DataView, offset: number, length: number) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));

describe("encodeWav", () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2]);
  const buffer = encodeWav(samples);
  const view = new DataView(buffer);

  it("is a 44-byte header plus 2 bytes per sample", () => {
    expect(buffer.byteLength).toBe(44 + samples.length * 2);
  });

  it("writes a PCM mono 16 kHz 16-bit RIFF/WAVE header", () => {
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2);
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(WAV_SAMPLE_RATE);
    expect(view.getUint32(28, true)).toBe(WAV_SAMPLE_RATE * 2);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
  });

  it("stores samples as little-endian Int16 and clamps out-of-range values", () => {
    const pcm = Array.from({ length: samples.length }, (_, i) => view.getInt16(44 + i * 2, true));
    expect(pcm).toEqual([0, 16384, -16384, 32767, -32768, 32767, -32768]);
  });

  it("handles an empty recording", () => {
    expect(encodeWav(new Float32Array(0)).byteLength).toBe(44);
  });
});
