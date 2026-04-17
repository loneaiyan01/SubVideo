"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SubtitleCue, SubtitleStyle, ExportState } from "@/types";
import { toast } from "sonner";

interface ExportPanelProps {
  videoFile: File | null;
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function ExportPanel({
  videoFile,
  subtitles,
  style,
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
    videoFile && subtitles.length > 0 && exportState.status !== "processing";

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

      // Dynamically import the canvas exporter (code-split)
      const { exportWithCanvas } = await import("@/lib/canvas-exporter");

      // Phase 2: Processing
      setExportState((s) => ({ ...s, status: "processing" }));

      toast.info("Processing video...", {
        description: "Burning subtitles — the video will play at full speed in the background.",
      });

      const blob = await exportWithCanvas(
        videoFile,
        subtitles,
        style,
        (progress) => {
          setExportState((s) => ({ ...s, progress }));
        },
        (msg) => {
          console.log("[CanvasExporter]", msg);
        }
      );

      // Create download URL
      const url = URL.createObjectURL(blob);

      setExportState({
        status: "done",
        progress: 100,
        downloadUrl: url,
        error: null,
        fileSize: blob.size,
      });

      toast.success("Video exported successfully!", {
        description: `Output size: ${formatSize(blob.size)}`,
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
  }, [videoFile, subtitles, style]);

  const handleDownload = useCallback(() => {
    if (exportState.downloadUrl) {
      const a = document.createElement("a");
      a.href = exportState.downloadUrl;
      // Canvas exporter produces WebM
      a.download = `subvideo_output_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [exportState.downloadUrl]);

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

  return (
    <div className="space-y-4" id="export-panel">
      {/* Export Button */}
      {exportState.status === "idle" || exportState.status === "error" ? (
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
      ) : null}

      {/* Loading state */}
      {exportState.status === "loading" && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            <div>
              <p className="text-sm font-medium text-white/80">
                Preparing export engine...
              </p>
              <p className="text-xs text-white/40">
                Setting up canvas renderer
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing state with progress */}
      {exportState.status === "processing" && (
        <div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">Processing...</p>
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
          <p className="text-[11px] text-white/30">
            Rendering subtitles onto video frames...
          </p>
        </div>
      )}

      {/* Done state */}
      {exportState.status === "done" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-sm font-semibold">Export Complete!</p>
            </div>
            {exportState.fileSize && (
              <p className="mt-1 text-xs text-white/40">
                Output: {formatSize(exportState.fileSize)}
              </p>
            )}
          </div>

          <Button
            onClick={handleDownload}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold
              transition-all duration-200 border-0 rounded-xl text-sm"
            id="download-button"
          >
            <svg
              width="16"
              height="16"
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

      {/* Error state */}
      {exportState.status === "error" && exportState.error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-red-400">{exportState.error}</p>
        </div>
      )}

      {/* Helper text */}
      {exportState.status === "idle" && !canExport && (
        <p className="text-center text-[11px] text-white/20">
          Upload both a video and SRT file to enable export
        </p>
      )}
    </div>
  );
}
