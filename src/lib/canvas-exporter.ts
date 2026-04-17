import { SubtitleCue, SubtitleStyle } from "@/types";
import { getActiveCue } from "@/lib/srt-parser";

/**
 * Canvas-based subtitle burner.
 *
 * Plays the video off-screen, composites each frame + subtitle text onto a
 * <canvas>, records the canvas with MediaRecorder, and returns the final
 * video as a Blob.
 *
 * This avoids needing FFmpeg WASM subtitle filters (libass), which are not
 * included in the standard @ffmpeg/core ESM build.
 */
export async function exportWithCanvas(
  videoFile: File,
  subtitles: SubtitleCue[],
  style: SubtitleStyle,
  onProgress: (pct: number) => void,
  onLog?: (msg: string) => void
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    // ── 1. Create off-screen video element ──────────────────────────
    const video = document.createElement("video");
    video.muted = true;          // Safari requires muted for auto-play
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;

    // ── 2. Wait for metadata ────────────────────────────────────────
    video.addEventListener("loadedmetadata", async () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const duration = video.duration;

      if (!vw || !vh || !duration || !isFinite(duration)) {
        URL.revokeObjectURL(videoUrl);
        reject(new Error("Could not read video dimensions or duration."));
        return;
      }

      onLog?.(`Video: ${vw}×${vh}, duration=${duration.toFixed(2)}s`);

      // ── 3. Canvas setup ─────────────────────────────────────────
      const canvas = document.createElement("canvas");
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d")!;

      // ── 4. Capture audio via Web Audio ──────────────────────────
      // We need a *separate* unmuted video for audio capture
      const audioVideo = document.createElement("video");
      audioVideo.src = videoUrl;
      audioVideo.playsInline = true;
      audioVideo.preload = "auto";
      audioVideo.muted = false;   // must be unmuted to capture audio
      audioVideo.crossOrigin = "anonymous";

      let audioStream: MediaStream | null = null;
      let audioCtx: AudioContext | null = null;
      let audioSource: MediaElementAudioSourceNode | null = null;
      let audioDest: MediaStreamAudioDestinationNode | null = null;

      try {
        audioCtx = new AudioContext();
        audioSource = audioCtx.createMediaElementSource(audioVideo);
        audioDest = audioCtx.createMediaStreamAudioDestination();
        audioSource.connect(audioDest);
        // Don't connect to speakers — we just need the stream
        audioStream = audioDest.stream;
      } catch (e) {
        onLog?.(`Audio capture not available: ${e}`);
        // Continue without audio
      }

      // ── 5. MediaRecorder setup ──────────────────────────────────
      const canvasStream = canvas.captureStream(30);  // 30 fps

      // Merge audio if available
      if (audioStream) {
        for (const track of audioStream.getAudioTracks()) {
          canvasStream.addTrack(track);
        }
      }

      // Pick best available codec
      let mimeType = "video/webm;codecs=vp9,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8,opus";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }

      onLog?.(`Recording with mimeType: ${mimeType}`);

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        URL.revokeObjectURL(videoUrl);
        audioCtx?.close().catch(() => {});
        const finalBlob = new Blob(chunks, { type: mimeType.split(";")[0] });
        onLog?.(`Export complete — ${(finalBlob.size / 1024 / 1024).toFixed(1)} MB`);
        resolve(finalBlob);
      };

      recorder.onerror = (e) => {
        URL.revokeObjectURL(videoUrl);
        audioCtx?.close().catch(() => {});
        reject(new Error(`MediaRecorder error: ${(e as ErrorEvent).message || "unknown"}`));
      };

      // ── 6. Render loop ──────────────────────────────────────────
      let animFrame: number;

      function drawFrame() {
        if (video.ended || video.paused) return;

        // Draw video frame
        ctx.drawImage(video, 0, 0, vw, vh);

        // Draw subtitle overlay
        const cue = getActiveCue(subtitles, video.currentTime);
        if (cue) {
          drawSubtitle(ctx, cue.text, style, vw, vh);
        }

        // Report progress
        const pct = Math.min(Math.round((video.currentTime / duration) * 100), 99);
        onProgress(pct);

        animFrame = requestAnimationFrame(drawFrame);
      }

      video.addEventListener("ended", () => {
        cancelAnimationFrame(animFrame);
        // Draw one more frame to flush
        ctx.drawImage(video, 0, 0, vw, vh);
        onProgress(100);
        recorder.stop();
        audioVideo.pause();
      });

      // Start everything
      recorder.start(100); // collect data every 100ms

      try {
        // Start both videos simultaneously
        video.currentTime = 0;
        audioVideo.currentTime = 0;
        await video.play();
        try {
          await audioVideo.play();
        } catch {
          onLog?.("Audio playback blocked — exporting without audio");
        }
        drawFrame();
      } catch (err) {
        reject(new Error(`Could not play video: ${err instanceof Error ? err.message : String(err)}`));
      }
    });

    video.addEventListener("error", () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error("Failed to load video file."));
    });
  });
}

/**
 * Draw styled subtitle text on the canvas, matching the SubtitleStyle config.
 */
function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
  canvasW: number,
  canvasH: number
) {
  const fontSize = Math.round((style.fontSize / 1080) * canvasH);
  ctx.font = `bold ${fontSize}px "${style.fontFamily}", "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const maxTextWidth = (style.maxWidth / 100) * canvasW;
  const lines = wrapText(ctx, text, maxTextWidth);

  const lineHeight = fontSize * 1.35;
  const blockHeight = lines.length * lineHeight;

  const x = canvasW / 2;
  const y = (style.positionY / 100) * canvasH;

  // Draw background box
  if (style.bgEnabled) {
    const padX = style.paddingX;
    const padY = style.paddingY;

    // Measure widest line
    let widest = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > widest) widest = w;
    }

    const alpha = Math.round((style.bgOpacity / 100) * 255);
    const bgColorWithAlpha = style.bgColor + alpha.toString(16).padStart(2, "0");

    ctx.fillStyle = bgColorWithAlpha;
    roundRect(
      ctx,
      x - widest / 2 - padX,
      y - padY,
      widest + padX * 2,
      blockHeight + padY * 2,
      6
    );
  }

  // Draw text with shadow/outline for readability
  for (let i = 0; i < lines.length; i++) {
    const ly = y + i * lineHeight;

    if (!style.bgEnabled) {
      // Text shadow for readability when no background
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillText(lines[i], x + 2, ly + 2, maxTextWidth);
    }

    // Text outline
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = Math.max(2, fontSize * 0.08);
    ctx.lineJoin = "round";
    ctx.strokeText(lines[i], x, ly, maxTextWidth);

    // Main text
    ctx.fillStyle = style.fontColor;
    ctx.fillText(lines[i], x, ly, maxTextWidth);
  }
}

/**
 * Word-wrap text to fit within maxWidth.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  // Respect explicit newlines in the subtitle text
  const paragraphs = text.split("\n");
  const result: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) result.push(currentLine);
  }

  return result.length ? result : [""];
}

/**
 * Draw a filled rounded rectangle.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
