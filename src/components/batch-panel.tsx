"use client";

import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SubtitleCue, SubtitleStyle, ExportSettings, BatchItem } from "@/types";
import { toast } from "sonner";

interface BatchPanelProps {
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  exportSettings: ExportSettings;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
];

export function BatchPanel({
  subtitles,
  style,
  exportSettings,
  disabled,
}: BatchPanelProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const canProcess = items.length > 0 && subtitles.length > 0 && !isProcessing;

  // ── Add files ─────────────────────────────────────────────────
  const handleFiles = useCallback((files: FileList) => {
    const newItems: BatchItem[] = [];
    for (const file of Array.from(files)) {
      if (!VIDEO_TYPES.includes(file.type)) continue;
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        videoFile: file,
        status: "queued",
        progress: 0,
        downloadUrl: null,
        fileSize: null,
        error: null,
      });
    }
    if (newItems.length === 0) {
      toast.error("No valid video files", {
        description: "Please upload MP4, WebM, MOV, or MKV files.",
      });
      return;
    }
    setItems((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} video(s) to queue`);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled || isProcessing) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, isProcessing, handleFiles]
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    items.forEach((item) => {
      if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
    });
    setItems([]);
  }, [items]);

  // ── Process queue ─────────────────────────────────────────────
  const processQueue = useCallback(async () => {
    if (!canProcess) return;
    setIsProcessing(true);
    abortRef.current = false;

    const { exportWithCanvas } = await import("@/lib/canvas-exporter");

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;
      const item = items[i];
      if (item.status === "done") continue;

      // Mark processing
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === i ? { ...it, status: "processing" as const, progress: 0, error: null } : it
        )
      );

      try {
        let blob = await exportWithCanvas(
          item.videoFile,
          subtitles,
          style,
          exportSettings,
          (progress) => {
            setItems((prev) =>
              prev.map((it, idx) => (idx === i ? { ...it, progress } : it))
            );
          }
        );

        // MP4 muxing if selected
        if (exportSettings.format === "mp4") {
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i ? { ...it, progress: 0 } : it
            )
          );
          const { convertToMP4 } = await import("@/lib/ffmpeg-muxer");
          blob = await convertToMP4(blob, (progress) => {
            setItems((prev) =>
              prev.map((it, idx) => (idx === i ? { ...it, progress } : it))
            );
          });
        }

        const url = URL.createObjectURL(blob);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: "done" as const, progress: 100, downloadUrl: url, fileSize: blob.size }
              : it
          )
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "error" as const, error: msg } : it
          )
        );
      }
    }

    setIsProcessing(false);
    if (!abortRef.current) {
      toast.success("Batch export complete!");
    }
  }, [canProcess, items, subtitles, style, exportSettings]);

  const cancelProcessing = useCallback(() => {
    abortRef.current = true;
    toast.info("Cancelling after current video...");
  }, []);

  const downloadItem = useCallback((item: BatchItem) => {
    if (!item.downloadUrl) return;
    const ext = exportSettings.format === "mp4" ? "mp4" : "webm";
    const baseName = item.videoFile.name.replace(/\.[^.]+$/, "");
    const a = document.createElement("a");
    a.href = item.downloadUrl;
    a.download = `${baseName}_subtitled.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [exportSettings.format]);

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <div className="space-y-4" id="batch-panel">
      <h3 className="text-xs font-semibold text-white/70 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-400">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 3H8l-2 4h12l-2-4z" />
        </svg>
        Batch Export
      </h3>

      {/* ── Drop zone ──────────────────────────────────────────── */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-200
          ${isProcessing ? "pointer-events-none opacity-40" : ""}
          border-white/10 bg-white/[0.01] hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        <p className="text-xs text-white/50">
          Drop multiple videos here
        </p>
        <p className="text-[10px] text-white/25 mt-1">
          Same subtitles + style applied to all
        </p>
      </div>

      {/* ── Queue list ─────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 transition-colors"
            >
              {/* Status icon */}
              <div className="shrink-0">
                {item.status === "queued" && (
                  <div className="h-3 w-3 rounded-full border border-white/20" />
                )}
                {item.status === "processing" && (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                )}
                {item.status === "done" && (
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                )}
                {item.status === "error" && (
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-white/70 truncate font-medium">
                  {item.videoFile.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-white/30">
                    {formatSize(item.videoFile.size)}
                  </span>
                  {item.status === "processing" && (
                    <span className="text-[9px] text-violet-300 tabular-nums">{item.progress}%</span>
                  )}
                  {item.status === "done" && item.fileSize && (
                    <span className="text-[9px] text-emerald-400">→ {formatSize(item.fileSize)}</span>
                  )}
                  {item.status === "error" && (
                    <span className="text-[9px] text-red-400 truncate">{item.error}</span>
                  )}
                </div>
                {/* Progress bar */}
                {item.status === "processing" && (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {item.status === "done" && (
                  <button
                    onClick={() => downloadItem(item)}
                    className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Download"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                )}
                {!isProcessing && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="rounded-md p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Summary + actions ──────────────────────────────────── */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span>
              {items.length} video{items.length > 1 ? "s" : ""}
              {doneCount > 0 && ` · ${doneCount} done`}
              {errorCount > 0 && ` · ${errorCount} failed`}
            </span>
            {!isProcessing && (
              <button onClick={clearAll} className="text-white/20 hover:text-red-400 transition-colors">
                Clear all
              </button>
            )}
          </div>

          {!isProcessing ? (
            <Button
              onClick={processQueue}
              disabled={!canProcess || disabled}
              className="w-full h-10 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-semibold
                hover:from-fuchsia-500 hover:to-pink-500 hover:shadow-lg hover:shadow-fuchsia-500/25
                transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed
                border-0 rounded-xl text-xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Process All ({items.filter((i) => i.status !== "done").length} remaining)
            </Button>
          ) : (
            <Button
              onClick={cancelProcessing}
              className="w-full h-10 bg-red-600/20 text-red-400 font-semibold border border-red-500/20
                hover:bg-red-600/30 transition-all duration-200 rounded-xl text-xs"
            >
              Cancel Batch
            </Button>
          )}

          {subtitles.length === 0 && (
            <p className="text-center text-[10px] text-amber-400/60">
              Load subtitles first to enable batch export
            </p>
          )}
        </div>
      )}
    </div>
  );
}
