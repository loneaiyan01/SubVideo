import { SubtitleCue, SubtitleStyle, ExportSettings, RESOLUTION_MAP, ASPECT_RATIO_MAP } from "@/types";
import { getActiveCue } from "@/lib/srt-parser";

/**
 * Canvas-based subtitle burner with resolution/aspect ratio support.
 */
export async function exportWithCanvas(
  videoFile: File,
  subtitles: SubtitleCue[],
  style: SubtitleStyle,
  settings: ExportSettings,
  onProgress: (pct: number) => void,
  onLog?: (msg: string) => void
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;

    video.addEventListener("loadedmetadata", async () => {
      const srcW = video.videoWidth;
      const srcH = video.videoHeight;
      const duration = video.duration;

      if (!srcW || !srcH || !duration || !isFinite(duration)) {
        URL.revokeObjectURL(videoUrl);
        reject(new Error("Could not read video dimensions or duration."));
        return;
      }

      onLog?.(`Source: ${srcW}×${srcH}, duration=${duration.toFixed(2)}s`);

      // ── Calculate output dimensions ────────────────────────────
      const { canvasW, canvasH, cropX, cropY, cropW, cropH } = calculateDimensions(
        srcW, srcH, settings
      );

      onLog?.(`Output: ${canvasW}×${canvasH}, crop: (${cropX},${cropY}) ${cropW}×${cropH}`);

      // ── Canvas setup ───────────────────────────────────────────
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;

      // ── Audio capture ──────────────────────────────────────────
      const audioVideo = document.createElement("video");
      audioVideo.src = videoUrl;
      audioVideo.playsInline = true;
      audioVideo.preload = "auto";
      audioVideo.muted = false;
      audioVideo.crossOrigin = "anonymous";

      let audioStream: MediaStream | null = null;
      let audioCtx: AudioContext | null = null;

      try {
        audioCtx = new AudioContext();
        const audioSource = audioCtx.createMediaElementSource(audioVideo);
        const audioDest = audioCtx.createMediaStreamDestination();
        audioSource.connect(audioDest);
        audioStream = audioDest.stream;
      } catch (e) {
        onLog?.(`Audio capture not available: ${e}`);
      }

      // ── MediaRecorder setup ────────────────────────────────────
      const canvasStream = canvas.captureStream(30);

      if (audioStream) {
        for (const track of audioStream.getAudioTracks()) {
          canvasStream.addTrack(track);
        }
      }

      let mimeType = "video/webm;codecs=vp9,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8,opus";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }

      onLog?.(`Recording: ${mimeType}`);

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

      // ── Render loop ────────────────────────────────────────────
      let animFrame: number;

      function drawFrame() {
        if (video.ended || video.paused) return;

        // Draw cropped & scaled video frame
        ctx.drawImage(
          video,
          cropX, cropY, cropW, cropH,  // source crop
          0, 0, canvasW, canvasH        // destination
        );

        // Draw subtitle overlay
        const cue = getActiveCue(subtitles, video.currentTime);
        if (cue) {
          drawSubtitle(ctx, cue.text, style, canvasW, canvasH);
        }

        const pct = Math.min(Math.round((video.currentTime / duration) * 100), 99);
        onProgress(pct);

        animFrame = requestAnimationFrame(drawFrame);
      }

      video.addEventListener("ended", () => {
        cancelAnimationFrame(animFrame);
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvasW, canvasH);
        onProgress(100);
        recorder.stop();
        audioVideo.pause();
      });

      recorder.start(100);

      try {
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

// ── Dimension calculation ────────────────────────────────────────────

interface DimensionResult {
  canvasW: number;
  canvasH: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

function calculateDimensions(
  srcW: number,
  srcH: number,
  settings: ExportSettings
): DimensionResult {
  const targetRatio = ASPECT_RATIO_MAP[settings.aspectRatio];
  const targetRes = RESOLUTION_MAP[settings.resolution];

  // Step 1: Calculate crop region based on aspect ratio
  let cropX = 0;
  let cropY = 0;
  let cropW = srcW;
  let cropH = srcH;

  if (targetRatio !== null) {
    const srcRatio = srcW / srcH;
    if (targetRatio > srcRatio) {
      // Crop top/bottom (target is wider)
      cropH = Math.round(srcW / targetRatio);
      cropY = Math.round((srcH - cropH) / 2);
    } else {
      // Crop left/right (target is taller)
      cropW = Math.round(srcH * targetRatio);
      cropX = Math.round((srcW - cropW) / 2);
    }
  }

  // Step 2: Calculate output dimensions based on resolution
  let canvasW = cropW;
  let canvasH = cropH;

  if (targetRes) {
    // If target is vertical, swap resolution boundaries for better quality
    let tw = targetRes.w;
    let th = targetRes.h;
    if (targetRatio !== null && targetRatio < 1) {
      tw = targetRes.h;
      th = targetRes.w;
    }

    // Scale to fit within target resolution boundaries, maintaining aspect
    const cropRatio = cropW / cropH;
    if (cropRatio > tw / th) {
      canvasW = tw;
      canvasH = Math.round(tw / cropRatio);
    } else {
      canvasH = th;
      canvasW = Math.round(th * cropRatio);
    }
    // Ensure even dimensions for codec compatibility
    canvasW = canvasW % 2 === 0 ? canvasW : canvasW + 1;
    canvasH = canvasH % 2 === 0 ? canvasH : canvasH + 1;
  }

  return { canvasW, canvasH, cropX, cropY, cropW, cropH };
}

// ── Subtitle drawing ─────────────────────────────────────────────────

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

  if (style.bgEnabled) {
    const padX = style.paddingX;
    const padY = style.paddingY;

    let widest = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > widest) widest = w;
    }

    const alpha = Math.round((style.bgOpacity / 100) * 255);
    const bgColorWithAlpha = style.bgColor + alpha.toString(16).padStart(2, "0");

    ctx.fillStyle = bgColorWithAlpha;
    roundRect(ctx, x - widest / 2 - padX, y - padY, widest + padX * 2, blockHeight + padY * 2, 6);
  }

  for (let i = 0; i < lines.length; i++) {
    const ly = y + i * lineHeight;

    if (!style.bgEnabled) {
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillText(lines[i], x + 2, ly + 2, maxTextWidth);
    }

    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = Math.max(2, fontSize * 0.08);
    ctx.lineJoin = "round";
    ctx.strokeText(lines[i], x, ly, maxTextWidth);

    ctx.fillStyle = style.fontColor;
    ctx.fillText(lines[i], x, ly, maxTextWidth);
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
