import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

/**
 * Load and initialize FFmpeg WASM.
 * Uses single-threaded core from unpkg CDN.
 */
export async function loadFFmpeg(
  onLog?: (msg: string) => void
): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on("log", ({ message }) => {
      onLog(message);
    });
  }

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      "application/wasm"
    ),
  });

  return ffmpeg;
}

/**
 * Burn subtitles into a video file using FFmpeg WASM.
 *
 * @param videoFile - The original video File object
 * @param assContent - The generated .ass subtitle file content
 * @param fontData - Poppins font file as Uint8Array
 * @param onProgress - Progress callback (0-100)
 * @param onLog - Log callback for debugging
 * @returns Uint8Array of the output mp4 file
 */
export async function burnSubtitles(
  videoFile: File,
  assContent: string,
  fontData: Uint8Array | null,
  onProgress: (progress: number) => void,
  onLog?: (msg: string) => void
): Promise<Uint8Array> {
  const ff = await loadFFmpeg(onLog);

  // Write video to virtual FS
  const videoData = await fetchFile(videoFile);
  await ff.writeFile("input.mp4", videoData);

  // Write ASS file to virtual FS
  const encoder = new TextEncoder();
  await ff.writeFile("subs.ass", encoder.encode(assContent));

    // Write dynamic font to virtual FS
    if (fontData) {
      try {
        await ff.createDir("/fonts");
      } catch {
        // directory may already exist
      }
      // fontconfig specifically scans for .ttf or .otf extensions in fontsdir. 
      // even if it's a woff2 payload, we must name it .ttf for it to get scanned!
      await ff.writeFile("/fonts/custom-font.ttf", fontData);
    }

  // Parse duration from logs for progress tracking
  let duration = 0;
  const prevHandler = ff.on("log", ({ message }) => {
    // Try to extract duration
    const durMatch = message.match(
      /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/
    );
    if (durMatch) {
      duration =
        parseInt(durMatch[1]) * 3600 +
        parseInt(durMatch[2]) * 60 +
        parseInt(durMatch[3]) +
        parseInt(durMatch[4]) / 100;
    }

    // Try to extract current time for progress
    const timeMatch = message.match(
      /time=\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/
    );
    if (timeMatch && duration > 0) {
      const current =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 100;
      const pct = Math.min(Math.round((current / duration) * 100), 99);
      onProgress(pct);
    }
  });

  // Build filter string
  const filter = fontData
    ? `ass=subs.ass:fontsdir=/fonts`
    : `ass=subs.ass`;

  try {
    await ff.exec([
      "-i",
      "input.mp4",
      "-vf",
      filter,
      "-c:a",
      "copy",
      "-preset",
      "ultrafast",
      "output.mp4",
    ]);

    onProgress(100);

    // Read output file
    const data = await ff.readFile("output.mp4");

    // Clean up virtual FS
    try {
      await ff.deleteFile("input.mp4");
      await ff.deleteFile("subs.ass");
      await ff.deleteFile("output.mp4");
    } catch {
      // ignore cleanup errors
    }

    if (data instanceof Uint8Array) {
      return data;
    }
    // If it's a string for some reason, encode it
    return encoder.encode(data as string);
  } catch (error) {
    throw new Error(
      `FFmpeg processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if FFmpeg is loaded and ready.
 */
export function isFFmpegLoaded(): boolean {
  return ffmpeg !== null && ffmpeg.loaded;
}
