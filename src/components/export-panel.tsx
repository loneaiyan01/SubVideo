import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { formatSize } from "@/lib/utils";

interface ExportPanelProps {
  videoFile: File | null;
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  exportSettings: ExportSettings;
  onExportSettingsChange: (settings: ExportSettings) => void;
  disabled?: boolean;
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

  const [autoDownload, setAutoDownload] = useState(false);
  const [etr, setEtr] = useState<string | null>(null);
  const phaseStartTimeRef = useRef<number>(0);

  const canExport =
    videoFile && subtitles.length > 0 && exportState.status !== "processing" && exportState.status !== "muxing";

  const handleExport = useCallback(async () => {
    if (!videoFile || subtitles.length === 0) return;

    // Revoke previous export URL to prevent blob memory leak on re-export
    if (exportState.downloadUrl) {
      URL.revokeObjectURL(exportState.downloadUrl);
    }

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
      let exportWithCanvas;
      try {
        ({ exportWithCanvas } = await import("@/lib/canvas-exporter"));
      } catch {
        setExportState({
          status: "error",
          progress: 0,
          downloadUrl: null,
          error: "Failed to load export engine. Please refresh and try again.",
          fileSize: null,
        });
        return;
      }

      // Phase 2: Processing
      setExportState((s) => ({ ...s, status: "processing" }));
      phaseStartTimeRef.current = Date.now();
      setEtr(null);

      toast.info("Processing video...", {
        description: "Burning subtitles — processing at high speed.",
      });

      const blob = await exportWithCanvas(
        videoFile,
        subtitles,
        style,
        exportSettings,
        (progress) => {
          setExportState((s) => ({ ...s, progress }));
          const elapsed = (Date.now() - phaseStartTimeRef.current) / 1000;
          if (progress > 2 && elapsed > 1) {
            const rate = progress / elapsed;
            const remaining = 100 - progress;
            const remainingSecs = Math.round(remaining / rate);
            if (remainingSecs > 0) {
              setEtr(`~${remainingSecs}s remaining`);
            } else {
              setEtr("Finishing...");
            }
          }
        },
        (msg) => {
          console.log("[CanvasExporter]", msg);
        }
      );

      // Phase 3: MP4 muxing
      setExportState((s) => ({ ...s, status: "muxing", progress: 0 }));
      phaseStartTimeRef.current = Date.now();
      setEtr(null);

      toast.info("Converting to MP4...", {
        description: "Remuxing video container — almost done.",
      });

      let convertToMP4;
      try {
        ({ convertToMP4 } = await import("@/lib/ffmpeg-muxer"));
      } catch {
        setExportState({
          status: "error",
          progress: 0,
          downloadUrl: null,
          error: "Failed to load MP4 converter. Please refresh and try again.",
          fileSize: null,
        });
        return;
      }
      const finalBlob = await convertToMP4(blob, (progress) => {
        setExportState((s) => ({ ...s, progress }));
        const elapsed = (Date.now() - phaseStartTimeRef.current) / 1000;
        if (progress > 2 && elapsed > 1) {
          const rate = progress / elapsed;
          const remaining = 100 - progress;
          const remainingSecs = Math.round(remaining / rate);
          if (remainingSecs > 0) {
            setEtr(`~${remainingSecs}s remaining`);
          } else {
            setEtr("Finishing...");
          }
        }
      });
      const fileExtension = "mp4";

      // Create download URL
      const url = URL.createObjectURL(finalBlob);
      setEtr(null);

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

      if (autoDownload) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `subvideo_output_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
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
      setEtr(null);
      toast.error("Export failed", { description: message });
    }
  }, [videoFile, subtitles, style, exportSettings, exportState.downloadUrl, autoDownload]);

  const handleDownload = useCallback(() => {
    if (exportState.downloadUrl) {
      const a = document.createElement("a");
      a.href = exportState.downloadUrl;
      a.download = `subvideo_output_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [exportState.downloadUrl]);

  const handleReset = useCallback(() => {
    if (exportState.downloadUrl) {
      URL.revokeObjectURL(exportState.downloadUrl);
    }
    // Release FFmpeg WASM instance to free memory
    import("@/lib/ffmpeg-muxer").then(({ unloadFFmpeg }) => unloadFFmpeg()).catch(() => {});
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
              options={["original", "16:9", "9:16", "1:1"]}
              value={exportSettings.aspectRatio}
              onChange={(v) => onExportSettingsChange({ ...exportSettings, aspectRatio: v })}
              labels={{ original: "Original", "16:9": "16:9", "9:16": "9:16", "1:1": "1:1" }}
            />
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Format</label>
            <div className="flex rounded-lg bg-white/5 p-0.5">
              <div className="flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium bg-violet-600 text-white shadow-sm shadow-violet-500/20 text-center">
                MP4 (H.264/AAC)
              </div>
            </div>
          </div>

          {/* Auto-Download Toggle */}
          <div className="flex items-center justify-between border-t border-white/5 pt-3 select-none">
            <div>
              <label className="text-xs font-semibold text-white/70">Auto-Download</label>
              <p className="text-[9px] text-white/30">Trigger file download automatically when ready</p>
            </div>
            <Switch
              checked={autoDownload}
              onCheckedChange={setAutoDownload}
            />
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

      {/* ── Processing Visual Stepper ──────────────────────────── */}
      {!isIdle && exportState.status !== "done" && (
        <ExportStepper status={exportState.status} progress={exportState.progress} etr={etr} />
      )}

      {/* ── Finished State Metadata Summary Card ───────────────── */}
      {exportState.status === "done" && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3.5">
          <div className="flex items-center gap-2.5 text-emerald-400 select-none">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-xs font-bold tracking-wide uppercase">Export Completed!</p>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-left rounded-lg bg-black/20 p-3 border border-white/5">
            <div>
              <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">Format</span>
              <p className="text-xs font-bold text-white/80">MP4 (MPEG-4)</p>
            </div>
            <div>
              <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">Resolution</span>
              <p className="text-xs font-bold text-white/80">
                {exportSettings.resolution === "original" ? "Original Size" : 
                 exportSettings.resolution === "1080p" ? "1920 × 1080" : "1280 × 720"}
              </p>
            </div>
            <div className="mt-1">
              <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">Aspect Ratio</span>
              <p className="text-xs font-bold text-white/80">
                {exportSettings.aspectRatio === "original" ? "Original aspect" : exportSettings.aspectRatio}
              </p>
            </div>
            <div className="mt-1">
              <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">File Size</span>
              <p className="text-xs font-bold text-white/80">
                {exportState.fileSize ? formatSize(exportState.fileSize) : "N/A"}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleDownload}
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors border-0"
              id="download-button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Video
            </Button>
            <Button
              variant="secondary"
              onClick={handleReset}
              className="h-10 px-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-0 rounded-lg text-xs transition-colors"
            >
              Reset
            </Button>
          </div>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────── */}
      {exportState.status === "error" && exportState.error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex flex-col gap-3">
          <p className="text-xs text-red-400">{exportState.error}</p>
          <Button
            variant="secondary"
            onClick={handleReset}
            className="h-8 w-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-0 rounded-lg text-xs transition-colors"
          >
            Try Again
          </Button>
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

// ── Segmented Stepper Component ─────────────────────────────────────
function ExportStepper({ status, progress, etr }: { status: ExportState["status"]; progress: number; etr: string | null }) {
  const steps = [
    { name: "setup", label: "Setup" },
    { name: "render", label: "Render" },
    { name: "encode", label: "Encode" },
    { name: "ready", label: "Ready" }
  ];

  const getStepState = (name: "setup" | "render" | "encode" | "ready") => {
    const mapping = { idle: 0, loading: 1, processing: 2, muxing: 3, done: 4, error: -1 };
    const current = mapping[status] ?? 0;
    const target = { setup: 1, render: 2, encode: 3, ready: 4 }[name];
    
    if (current === -1) return "error";
    if (current >= target) return current === target && status !== "done" ? "active" : "completed";
    return "pending";
  };

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-4">
      {/* Steps nodes */}
      <div className="relative flex items-center justify-between">
        {/* Progress line background */}
        <div className="absolute left-3 right-3 top-[14px] h-[2px] -translate-y-1/2 bg-white/10 z-0" />
        {/* Active progress line fill */}
        <div 
          className="absolute left-3 top-[14px] h-[2px] -translate-y-1/2 bg-gradient-to-r from-violet-600 to-fuchsia-600 z-0 transition-all duration-300"
          style={{
            width: status === "done" ? "calc(100% - 24px)" : 
                   status === "muxing" ? "75%" : 
                   status === "processing" ? "50%" : 
                   status === "loading" ? "25%" : "0%"
          }}
        />

        {steps.map((step, idx) => {
          const state = getStepState(step.name as any);
          return (
            <div key={step.name} className="relative z-10 flex flex-col items-center gap-1.5 select-none">
              <div 
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold border transition-all duration-300
                  ${state === "completed" ? "bg-emerald-600 border-emerald-500 text-white shadow-sm shadow-emerald-500/20" : ""}
                  ${state === "active" ? "bg-violet-600 border-violet-500 text-white animate-pulse shadow-sm shadow-violet-500/25" : ""}
                  ${state === "pending" ? "bg-zinc-950 border-white/10 text-white/30" : ""}
                  ${state === "error" ? "bg-red-950 border-red-500 text-red-400" : ""}
                `}
              >
                {state === "completed" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : idx + 1}
              </div>
              <span className={`text-[9px] font-semibold tracking-wide uppercase transition-colors duration-300
                ${state === "completed" ? "text-emerald-400" : ""}
                ${state === "active" ? "text-violet-400" : ""}
                ${state === "pending" ? "text-white/20" : ""}
                ${state === "error" ? "text-red-400" : ""}
              `}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live info and sub-bar */}
      <div className="border-t border-white/5 pt-3 space-y-2 select-none">
        <div className="flex items-center justify-between text-[11px] h-4">
          <span className="text-white/70 font-semibold uppercase tracking-wider text-[10px]">
            {status === "loading" && "Initializing engine..."}
            {status === "processing" && "Burning Subtitle Frames..."}
            {status === "muxing" && "Remuxing Video Container..."}
            {status === "done" && "Ready to save!"}
          </span>
          <div className="flex items-center gap-2">
            {etr && (status === "processing" || status === "muxing") && (
              <span className="text-[10px] text-white/30 font-medium font-mono">{etr}</span>
            )}
            {(status === "processing" || status === "muxing") && (
              <span className="font-mono text-violet-400 font-bold bg-violet-500/10 px-1.5 py-0.5 rounded-md">
                {progress}%
              </span>
            )}
          </div>
        </div>

        {(status === "processing" || status === "muxing") && (
          <div className="relative h-1.5 overflow-hidden rounded-full bg-white/5 w-full">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-300 ease-out animate-pulse"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
