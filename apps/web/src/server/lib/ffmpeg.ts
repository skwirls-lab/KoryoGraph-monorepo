import "server-only";
import { spawn } from "node:child_process";
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
