"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  SubtitleCue,
  SubtitleStyle,
  ExportState,
  ExportSettings,
  DEFAULT_EXPORT_SETTINGS,
  ResolutionOption,
  AspectRatioOption,
  FormatOption,
} from "@/types";
import { toast } from "sonner";

interface ExportPanelProps {
  videoFile: File | null;
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  exportSettings: ExportSettings;
  onExportSettingsChange: (settings: ExportSettings) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ── Segmented button component ─────────────────────────────────────
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <div className="flex rounded-lg bg-white/5 p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200
            ${
              value === opt
                ? "bg-violet-600 text-white shadow-sm shadow-violet-500/20"
                : "text-white/40 hover:text-white/60 hover:bg-white/5"
            }`}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}

export function ExportPanel({
  videoFile,
  subtitles,
  style,
  exportSettings,
  onExportSettingsChange,
  disabled,
}: ExportPanelProps) {
  const [exportState, setExportState] = useState<ExportState>({
    status: "idle",
    progress: 0,
    downloadUrl: null,
    error: null,
    fileSize: null,
  });

  const canExport =
    videoFile && subtitles.length > 0 && exportState.status !== "processing" && exportState.status !== "muxing";

  const handleExport = useCallback(async () => {
    if (!videoFile || subtitles.length === 0) return;

    try {
      // Phase 1: Loading
      setExportState({
        status: "loading",
        progress: 0,
        downloadUrl: null,
        error: null,
        fileSize: null,
      });

      toast.info("Preparing export engine...", {
        description: "Setting up canvas renderer.",
      });

      // Dynamically import the canvas exporter
      const { exportWithCanvas } = await import("@/lib/canvas-exporter");

      // Phase 2: Processing
      setExportState((s) => ({ ...s, status: "processing" }));

      toast.info("Processing video...", {
        description: "Burning subtitles — the video will play at full speed.",
      });

      const blob = await exportWithCanvas(
        videoFile,
        subtitles,
        style,
        exportSettings,
        (progress) => {
          setExportState((s) => ({ ...s, progress }));
        },
        (msg) => {
          console.log("[CanvasExporter]", msg);
        }
      );

      // Phase 3: MP4 muxing (if selected)
      let finalBlob = blob;
      let fileExtension = "webm";

      if (exportSettings.format === "mp4") {
        setExportState((s) => ({ ...s, status: "muxing", progress: 0 }));

        toast.info("Converting to MP4...", {
          description: "Remuxing video container — almost done.",
        });

        const { convertToMP4 } = await import("@/lib/ffmpeg-muxer");
        finalBlob = await convertToMP4(blob, (progress) => {
          setExportState((s) => ({ ...s, progress }));
        });
        fileExtension = "mp4";
      }

      // Create download URL
      const url = URL.createObjectURL(finalBlob);

      setExportState({
        status: "done",
        progress: 100,
        downloadUrl: url,
        error: null,
        fileSize: finalBlob.size,
      });

      toast.success("Video exported successfully!", {
        description: `Output: ${formatSize(finalBlob.size)} (${fileExtension.toUpperCase()})`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred";
      setExportState({
        status: "error",
        progress: 0,
        downloadUrl: null,
        error: message,
        fileSize: null,
      });
      toast.error("Export failed", { description: message });
    }
  }, [videoFile, subtitles, style, exportSettings]);

  const handleDownload = useCallback(() => {
    if (exportState.downloadUrl) {
      const a = document.createElement("a");
      a.href = exportState.downloadUrl;
      const ext = exportSettings.format === "mp4" ? "mp4" : "webm";
      a.download = `subvideo_output_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [exportState.downloadUrl, exportSettings.format]);

  const handleReset = useCallback(() => {
    if (exportState.downloadUrl) {
      URL.revokeObjectURL(exportState.downloadUrl);
    }
    setExportState({
      status: "idle",
      progress: 0,
      downloadUrl: null,
      error: null,
      fileSize: null,
    });
  }, [exportState.downloadUrl]);

  const isIdle = exportState.status === "idle" || exportState.status === "error";

  return (
    <div className="space-y-4" id="export-panel">
      {/* ── Export Settings ─────────────────────────────────────── */}
      {isIdle && (
        <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold text-white/70 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Export Settings
          </h3>

          {/* Resolution */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Resolution</label>
            <SegmentedControl<ResolutionOption>
              options={["original", "1080p", "720p"]}
              value={exportSettings.resolution}
              onChange={(v) => onExportSettingsChange({ ...exportSettings, resolution: v })}
              labels={{ original: "Original", "1080p": "1080p", "720p": "720p" }}
            />
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Aspect Ratio</label>
            <SegmentedControl<AspectRatioOption>
              options={["16:9"]}
              value="16:9"
              onChange={() => {}}
              labels={{ "16:9": "16:9 (Exclusive)", "original": "", "9:16": "", "1:1": "" }}
            />
            <p className="text-[9px] text-white/20">
              Standard widescreen format (All exports restricted to 16:9)
            </p>
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Format</label>
            <SegmentedControl<FormatOption>
              options={["webm", "mp4"]}
              value={exportSettings.format}
              onChange={(v) => onExportSettingsChange({ ...exportSettings, format: v })}
              labels={{ webm: "WebM (Fast)", mp4: "MP4 (Universal)" }}
            />
            {exportSettings.format === "mp4" && (
              <p className="text-[9px] text-white/20">
                Requires additional processing step (~30MB engine download on first use)
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Export Button ───────────────────────────────────────── */}
      {isIdle && (
        <Button
          onClick={handleExport}
          disabled={!canExport || disabled}
          className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold
            hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-lg hover:shadow-violet-500/25
            transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed
            border-0 rounded-xl text-sm"
          id="export-button"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Burn Subtitles & Export
        </Button>
      )}

      {/* ── Loading state ──────────────────────────────────────── */}
      {exportState.status === "loading" && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            <div>
              <p className="text-sm font-medium text-white/80">Preparing export engine...</p>
              <p className="text-xs text-white/40">Setting up canvas renderer</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Processing state ───────────────────────────────────── */}
      {exportState.status === "processing" && (
        <div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">Rendering...</p>
            <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-violet-300">
              {exportState.progress}%
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300 ease-out"
              style={{ width: `${exportState.progress}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          </div>
          <p className="text-[11px] text-white/30">Burning subtitles onto video frames...</p>
        </div>
      )}

      {/* ── Muxing state ───────────────────────────────────────── */}
      {exportState.status === "muxing" && (
        <div className="space-y-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">Converting to MP4...</p>
            <span className="rounded-md bg-fuchsia-500/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-fuchsia-300">
              {exportState.progress}%
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all duration-300 ease-out"
              style={{ width: `${exportState.progress}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          </div>
          <p className="text-[11px] text-white/30">Remuxing video container to MP4...</p>
        </div>
      )}

      {/* ── Done state ─────────────────────────────────────────── */}
      {exportState.status === "done" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-sm font-semibold">Export Complete!</p>
            </div>
            {exportState.fileSize && (
              <p className="mt-1 text-xs text-white/40">
                Output: {formatSize(exportState.fileSize)} ({exportSettings.format.toUpperCase()})
              </p>
            )}
          </div>

          <Button
            onClick={handleDownload}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold
              transition-all duration-200 border-0 rounded-xl text-sm"
            id="download-button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Video
          </Button>

          <button
            onClick={handleReset}
            className="w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors py-1"
          >
            Export again with different settings
          </button>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────── */}
      {exportState.status === "error" && exportState.error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-red-400">{exportState.error}</p>
        </div>
      )}

      {/* ── Helper text ────────────────────────────────────────── */}
      {exportState.status === "idle" && !canExport && (
        <p className="text-center text-[11px] text-white/20">
          Upload both a video and SRT file to enable export
        </p>
      )}
    </div>
  );
}
