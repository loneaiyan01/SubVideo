"use client";

import React, { useCallback, useState, useRef } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface UploadZoneProps {
  videoFile: File | null;
  srtFile: File | null;
  onVideoUpload: (file: File) => void;
  onSrtUpload: (file: File) => void;
  onVideoRemove: () => void;
  onSrtRemove: () => void;
  disabled?: boolean;
}

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
];
const SRT_EXTENSION = ".srt";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function DropZone({
  label,
  accept,
  icon,
  file,
  onFile,
  onRemove,
  disabled,
  sublabel,
}: {
  label: string;
  accept: string;
  icon: React.ReactNode;
  file: File | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  sublabel: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (disabled) return;

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) onFile(droppedFile);
    },
    [onFile, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) onFile(selectedFile);
      // Reset input so re-selecting same file works
      e.target.value = "";
    },
    [onFile]
  );

  if (file) {
    return (
      <div className="group relative flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05]">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-400">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white/90">
            {file.name}
          </p>
          <p className="text-xs text-white/40">{formatSize(file.size)}</p>
        </div>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="shrink-0 rounded-lg p-2 text-white/30 transition-colors hover:bg-white/10 hover:text-red-400 disabled:opacity-50"
          aria-label={`Remove ${label}`}
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
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        group relative cursor-pointer rounded-2xl border-2 border-dashed p-6
        transition-all duration-300
        ${
          dragOver
            ? "border-violet-400 bg-violet-500/10 shadow-[0_0_30px_rgba(139,92,246,0.15)]"
            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
        }
        ${disabled ? "pointer-events-none opacity-40" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className={`
          flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300
          ${
            dragOver
              ? "bg-violet-500/30 text-violet-300 scale-110"
              : "bg-white/5 text-white/30 group-hover:bg-white/10 group-hover:text-white/50"
          }
        `}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-white/70">
            Drop {label} here
          </p>
          <p className="mt-1 text-xs text-white/30">{sublabel}</p>
        </div>
      </div>
    </div>
  );
}

export function UploadZone({
  videoFile,
  srtFile,
  onVideoUpload,
  onSrtUpload,
  onVideoRemove,
  onSrtRemove,
  disabled,
}: UploadZoneProps) {
  const [pastedSrt, setPastedSrt] = useState("");

  const handlePasteSubmit = useCallback(() => {
    if (!pastedSrt.trim()) return;
    const blob = new Blob([pastedSrt], { type: "text/plain" });
    const file = new File([blob], "pasted_subtitles.srt", { type: "text/plain" });
    onSrtUpload(file);
    setPastedSrt("");
  }, [pastedSrt, onSrtUpload]);

  const handleVideoFile = useCallback(
    (file: File) => {
      if (!VIDEO_TYPES.includes(file.type)) {
        toast.error("Invalid video format", {
          description: "Please upload MP4, WebM, MOV, or MKV files.",
        });
        return;
      }
      if (file.size > 200 * 1024 * 1024) {
        toast.warning("Large file detected", {
          description:
            "Files over 200MB may be slow to process in the browser.",
        });
      }
      onVideoUpload(file);
    },
    [onVideoUpload]
  );

  const handleSrtFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(SRT_EXTENSION)) {
        toast.error("Invalid subtitle format", {
          description: "Please upload an .srt subtitle file.",
        });
        return;
      }
      onSrtUpload(file);
    },
    [onSrtUpload]
  );

  const videoIcon = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );

  const srtIcon = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2" id="upload-zone">
      <div className="h-full">
        <DropZone
          label="video file"
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
          icon={videoIcon}
          file={videoFile}
          onFile={handleVideoFile}
          onRemove={onVideoRemove}
          disabled={disabled}
          sublabel="MP4, WebM, MOV, or MKV"
        />
      </div>

      <div className="h-full">
        {srtFile ? (
          <DropZone
            label="SRT file"
            accept=".srt"
            icon={srtIcon}
            file={srtFile}
            onFile={handleSrtFile}
            onRemove={onSrtRemove}
            disabled={disabled}
            sublabel=".srt subtitle file"
          />
        ) : (
          <Tabs defaultValue="upload" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-2 bg-white/5 p-1 rounded-lg">
              <TabsTrigger value="upload" className="rounded-md text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">Upload .SRT File</TabsTrigger>
              <TabsTrigger value="paste" className="rounded-md text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">Paste Raw Text</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-0 flex-1">
              <DropZone
                label="SRT file"
                accept=".srt"
                icon={srtIcon}
                file={srtFile}
                onFile={handleSrtFile}
                onRemove={onSrtRemove}
                disabled={disabled}
                sublabel=".srt subtitle file"
              />
            </TabsContent>
            <TabsContent value="paste" className="mt-0 h-[196px] sm:h-[166px]">
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-3 h-full">
                <Textarea 
                  className="flex-1 resize-none bg-black/40 border-white/10 text-[11px] p-2 leading-relaxed text-white/70 font-mono custom-scrollbar"
                  placeholder={"1\n00:00:00,000 --> 00:00:02,000\nPaste your subtitle text here..."}
                  value={pastedSrt}
                  onChange={(e) => setPastedSrt(e.target.value)}
                  disabled={disabled}
                />
                <Button 
                  onClick={handlePasteSubmit} 
                  disabled={disabled || !pastedSrt.trim()}
                  className="w-full text-xs h-8 bg-violet-600 hover:bg-violet-500 text-white border-0 transition-colors shrink-0"
                >
                  Parse Subtitles
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
