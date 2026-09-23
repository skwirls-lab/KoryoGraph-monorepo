import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

/** Run ffmpeg with stdin → stdout (binary in, binary out). */
export function ffmpeg(args: string[], input: Buffer, timeoutMs = 120_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg isn't available on this server."));
    const p = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", ...args], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timed out")); }, timeoutMs);
    p.stdout.on("data", (d: Buffer) => out.push(d));
    p.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => { clearTimeout(timer); if (code === 0) resolve(Buffer.concat(out)); else reject(new Error(`ffmpeg exited ${code}: ${err.slice(0, 300)}`)); });
    p.stdin.on("error", () => undefined);
    p.stdin.end(input);
  });
}

/** Any browser recording (webm/ogg/m4a/wav) → mono 16 kHz MP3 for speech models. */
export const toSpeechMp3 = (audio: Buffer) => ffmpeg(["-i", "pipe:0", "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-f", "mp3", "pipe:1"], audio);

/** Run ffmpeg on a file; resolves stdout and stderr (ffmpeg prints stream info to stderr). */
function ffmpegFile(args: string[], timeoutMs = 60_000): Promise<{ out: Buffer; err: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg isn't available on this server."));
    const p = spawn(ffmpegPath, ["-hide_banner", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timed out")); }, timeoutMs);
    p.stdout.on("data", (d: Buffer) => out.push(d));
    p.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => { clearTimeout(timer); resolve({ out: Buffer.concat(out), err, code }); });
  });
}

/**
 * A video clip → its duration and `count` evenly spaced JPEG keyframes (≤ 640 px wide). Phone MP4s often keep
 * their index at the end, so the clip is written to a temp file (seekable) rather than piped.
 */
export async function extractKeyframes(video: Buffer, count = 6): Promise<{ durationMs: number; frames: Buffer[] }> {
  const dir = await mkdtemp(join(tmpdir(), "kg-clip-"));
  const file = join(dir, "clip");
  try {
    await writeFile(file, video);
    const probe = await ffmpegFile(["-i", file]);
    const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(probe.err);
    if (!m || !/Stream #\d+:\d+.*Video:/.test(probe.err)) throw new Error("That file doesn't look like a video we can read.");
    const durationMs = Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
    const frames: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      const at = ((durationMs / 1000) * (i + 0.5)) / count;
      const r = await ffmpegFile(["-loglevel", "error", "-ss", at.toFixed(3), "-i", file, "-frames:v", "1", "-vf", "scale='min(640,iw)':-2", "-q:v", "4", "-f", "image2", "-c:v", "mjpeg", "pipe:1"]);
      if (r.code !== 0 || !r.out.length) throw new Error(`Couldn't read a frame from the clip${r.err ? `: ${r.err.slice(0, 200)}` : ""}.`);
      frames.push(r.out);
    }
    return { durationMs, frames };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
