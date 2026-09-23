import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractKeyframes } from "./ffmpeg";

const clip = readFileSync(join(import.meta.dirname, "../../../../../tests/fixtures/video/clip-6s.mp4"));

describe("extractKeyframes", () => {
  it("reads the duration and returns evenly spaced JPEG frames, deterministically", async () => {
    const a = await extractKeyframes(clip, 6);
    expect(a.durationMs).toBeGreaterThanOrEqual(5900);
    expect(a.durationMs).toBeLessThanOrEqual(6100);
    expect(a.frames).toHaveLength(6);
    for (const f of a.frames) expect([f[0], f[1]]).toEqual([0xff, 0xd8]); // JPEG SOI
    const b = await extractKeyframes(clip, 6);
    expect(b.frames.map((f) => f.length)).toEqual(a.frames.map((f) => f.length));
  }, 60_000);

  it("refuses something that isn't a video", async () => {
    await expect(extractKeyframes(Buffer.from("not a video at all"), 2)).rejects.toThrow(/doesn't look like a video/);
  });
});
