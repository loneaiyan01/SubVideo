import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

/**
 * Load FFmpeg WASM for container muxing only.
 * Uses single-threaded core — no libass needed.
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
 * Convert a WebM blob to MP4 using FFmpeg WASM.
 * Attempts stream copy first (fast), falls back to re-encoding if needed.
 */
export async function convertToMP4(
  webmBlob: Blob,
  onProgress: (pct: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg();

  // Write WebM data to virtual FS
  const webmData = new Uint8Array(await webmBlob.arrayBuffer());
  await ff.writeFile("input.webm", webmData);

  onProgress(10);

  // Parse duration for progress tracking
  let duration = 0;
  ff.on("log", ({ message }) => {
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

  // Always re-encode to H.264 baseline + AAC for universal compatibility (especially iOS)
  const ret = await ff.exec([
    "-i", "input.webm",
    "-c:v", "libx264",
    "-profile:v", "baseline",
    "-level", "3.1",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "output.mp4",
  ]);

  if (ret !== 0) {
    throw new Error(`FFmpeg MP4 conversion failed with exit code ${ret}`);
  }

  onProgress(90);

  // Read output
  const data = await ff.readFile("output.mp4");

  // Clean up
  try {
    await ff.deleteFile("input.webm");
    await ff.deleteFile("output.mp4");
  } catch { /* ignore cleanup errors */ }

  onProgress(100);

  const mp4Data = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
  return new Blob([mp4Data as unknown as BlobPart], { type: "video/mp4" });
}
