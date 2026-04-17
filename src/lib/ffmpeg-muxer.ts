import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

/**
 * Load FFmpeg WASM for container muxing / re-encoding.
 * Uses single-threaded core.
 */
async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

/**
 * Set up progress tracking from FFmpeg logs.
 */
function setupProgress(ff: FFmpeg, onProgress: (pct: number) => void) {
  let duration = 0;
  ff.on("log", ({ message }) => {
    // Also log to console for debugging
    console.log("[FFmpeg]", message);

    const durMatch = message.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (durMatch) {
      duration =
        parseInt(durMatch[1]) * 3600 +
        parseInt(durMatch[2]) * 60 +
        parseInt(durMatch[3]) +
        parseInt(durMatch[4]) / 100;
    }

    const timeMatch = message.match(/time=\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (timeMatch && duration > 0) {
      const current =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 100;
      const pct = Math.min(10 + Math.round((current / duration) * 80), 90);
      onProgress(pct);
    }
  });
}

/**
 * Common encoding args for MPEG-4 Part 2 + AAC.
 * Uses the built-in mpeg4 encoder which is lightweight in WASM
 * and produces universally playable video on ALL devices (iOS, Android, PC, Mac).
 */
const ENCODE_ARGS = [
  "-c:v", "mpeg4",      // Built-in encoder, fast in WASM
  "-q:v", "4",           // Quality scale (1=best, 31=worst, 4=very good)
  "-pix_fmt", "yuv420p", // Universal pixel format
  "-c:a", "aac",         // AAC audio
  "-b:a", "128k",
];

/**
 * Convert a WebM blob to MP4 using FFmpeg WASM.
 * Re-encodes video to MPEG-4 + AAC for universal compatibility.
 */
export async function convertToMP4(
  webmBlob: Blob,
  onProgress: (pct: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg();

  const webmData = new Uint8Array(await webmBlob.arrayBuffer());
  await ff.writeFile("input.webm", webmData);

  onProgress(10);
  setupProgress(ff, onProgress);

  const ret = await ff.exec([
    "-i", "input.webm",
    ...ENCODE_ARGS,
    "-movflags", "+faststart",
    "output.mp4",
  ]);

  if (ret !== 0) {
    throw new Error(`FFmpeg MP4 conversion failed with exit code ${ret}`);
  }

  onProgress(90);

  const data = await ff.readFile("output.mp4");
  try {
    await ff.deleteFile("input.webm");
    await ff.deleteFile("output.mp4");
  } catch { /* ignore cleanup errors */ }

  onProgress(100);

  const mp4Data = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
  return new Blob([mp4Data as unknown as BlobPart], { type: "video/mp4" });
}

/**
 * Convert a WebM blob to MOV (QuickTime) using FFmpeg WASM.
 * Re-encodes to MPEG-4 + AAC in a QuickTime container for native Apple playback.
 */
export async function convertToMOV(
  webmBlob: Blob,
  onProgress: (pct: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg();

  const webmData = new Uint8Array(await webmBlob.arrayBuffer());
  await ff.writeFile("input.webm", webmData);

  onProgress(10);
  setupProgress(ff, onProgress);

  const ret = await ff.exec([
    "-i", "input.webm",
    ...ENCODE_ARGS,
    "-f", "mov",
    "output.mov",
  ]);

  if (ret !== 0) {
    throw new Error(`FFmpeg MOV conversion failed with exit code ${ret}`);
  }

  onProgress(90);

  const data = await ff.readFile("output.mov");
  try {
    await ff.deleteFile("input.webm");
    await ff.deleteFile("output.mov");
  } catch { /* ignore cleanup errors */ }

  onProgress(100);

  const movData = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
  return new Blob([movData as unknown as BlobPart], { type: "video/quicktime" });
}
