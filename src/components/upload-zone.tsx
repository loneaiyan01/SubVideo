"use client";

import React, { useCallback, useState, useRef } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatSize, extractYoutubeId } from "@/lib/utils";
import { ACCEPTED_VIDEO_TYPES } from "@/types";

interface UploadZoneProps {
  videoFile: File | null;
  youtubeId: string | null;
  srtFile: File | null;
  onVideoUpload: (file: File) => void;
  onYoutubeLoad: (id: string) => void;
  onSrtUpload: (file: File) => void;
  onVideoRemove: () => void;
  onYoutubeRemove: () => void;
  onSrtRemove: () => void;
  disabled?: boolean;
}

const SRT_EXTENSION = ".srt";



function DropZone({
  label,
  accept,
  icon,
  file,
  onFile,
  onRemove,
  disabled,
  sublabel,
  isCompact,
}: {
  label: string;
  accept: string;
  icon: React.ReactNode;
  file: File | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  sublabel: string;
  isCompact?: boolean;
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
    const isPasted = file.name === "pasted_subtitles.srt";
    return (
      <div className="group relative flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 h-full w-full transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-400 [&>svg]:w-5 [&>svg]:h-5">
            {isPasted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/>
              </svg>
            ) : icon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white/90">
              {isPasted 
                ? "Pasted Text Subtitles" 
                : label === "video file" 
                  ? "Video Uploaded" 
                  : file.name}
            </p>
            <p className="text-[10px] text-white/40">
              {isPasted ? "Successfully parsed text" : formatSize(file.size)}
            </p>
          </div>
        </div>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="shrink-0 rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/10 hover:text-red-400 disabled:opacity-50"
          aria-label={`Remove ${label}`}
        >
          <svg
            width="14"
            height="14"
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
        group relative cursor-pointer rounded-2xl border-2 border-dashed flex flex-col justify-center items-center h-full w-full
        transition-all duration-300 p-3
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
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className={`
          flex items-center justify-center rounded-xl transition-all duration-300
          ${isCompact ? "h-8 w-8 [&>svg]:w-4 [&>svg]:h-4" : "h-12 w-12 [&>svg]:w-6 [&>svg]:h-6"}
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
          <p className="text-xs font-semibold text-white/70">
            Drop {label} here
          </p>
          {!isCompact && <p className="mt-0.5 text-[10px] text-white/30">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}

export function UploadZone({
  videoFile,
  youtubeId,
  srtFile,
  onVideoUpload,
  onYoutubeLoad,
  onSrtUpload,
  onVideoRemove,
  onYoutubeRemove,
  onSrtRemove,
  disabled,
}: UploadZoneProps) {
  const [pastedSrt, setPastedSrt] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");

  const handlePasteSubmit = useCallback(() => {
    if (!pastedSrt.trim()) return;
    const blob = new Blob([pastedSrt], { type: "text/plain" });
    const file = new File([blob], "pasted_subtitles.srt", { type: "text/plain" });
    onSrtUpload(file);
    setPastedSrt("");
  }, [pastedSrt, onSrtUpload]);

  const handleYoutubeSubmit = useCallback(() => {
    const trimmed = youtubeInput.trim();
    if (!trimmed) return;
    const parsedId = extractYoutubeId(trimmed);
    if (parsedId) {
      onYoutubeLoad(parsedId);
      setYoutubeInput("");
    } else {
      toast.error("Invalid YouTube URL or Video ID", {
        description: "Please paste a valid YouTube video link or an 11-character video ID.",
      });
    }
  }, [youtubeInput, onYoutubeLoad]);

  const handleVideoFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
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
    <div className="grid gap-4 sm:grid-cols-2 items-stretch" id="upload-zone">
      <div className="h-[160px] flex flex-col justify-stretch">
        {videoFile ? (
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
        ) : youtubeId ? (
          <div className="group relative flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 h-full w-full transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400 [&>svg]:w-5 [&>svg]:h-5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white/90">
                  YouTube Video Loaded
                </p>
                <p className="text-[10px] text-white/40 truncate font-mono">
                  ID: {youtubeId}
                </p>
              </div>
            </div>
            <button
              onClick={onYoutubeRemove}
              disabled={disabled}
              className="shrink-0 rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/10 hover:text-red-400 disabled:opacity-50"
              aria-label="Remove YouTube video"
            >
              <svg
                width="14"
                height="14"
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
        ) : (
          <Tabs defaultValue="upload" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-2 bg-white/5 p-1 rounded-lg shrink-0 h-9">
              <TabsTrigger value="upload" className="rounded-md text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">Upload File</TabsTrigger>
              <TabsTrigger value="youtube" className="rounded-md text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">YouTube Link</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-0 flex-1 h-0">
              <DropZone
                label="video file"
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                icon={videoIcon}
                file={videoFile}
                onFile={handleVideoFile}
                onRemove={onVideoRemove}
                disabled={disabled}
                sublabel="MP4, WebM, MOV, or MKV"
                isCompact
              />
            </TabsContent>
            <TabsContent value="youtube" className="mt-0 flex-1 h-0 flex flex-col justify-stretch">
              <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-2 h-full justify-between">
                <div className="flex-1 flex flex-col justify-center px-1">
                  <input
                    type="text"
                    placeholder="Paste YouTube Link or Video ID..."
                    value={youtubeInput}
                    onChange={(e) => setYoutubeInput(e.target.value)}
                    disabled={disabled}
                    className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleYoutubeSubmit();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleYoutubeSubmit}
                  disabled={disabled || !youtubeInput.trim()}
                  className="w-full text-xs h-7 bg-violet-600 hover:bg-violet-500 text-white border-0 transition-colors shrink-0 rounded-md"
                >
                  Load YouTube Video
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <div className="h-[160px] flex flex-col justify-stretch">
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
          <Tabs defaultValue="paste" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-2 bg-white/5 p-1 rounded-lg shrink-0 h-9">
              <TabsTrigger value="upload" className="rounded-md text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">Upload .SRT File</TabsTrigger>
              <TabsTrigger value="paste" className="rounded-md text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">Paste Raw Text</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-0 flex-1 h-0">
              <DropZone
                label="SRT file"
                accept=".srt"
                icon={srtIcon}
                file={srtFile}
                onFile={handleSrtFile}
                onRemove={onSrtRemove}
                disabled={disabled}
                sublabel=".srt subtitle file"
                isCompact
              />
            </TabsContent>
            <TabsContent value="paste" className="mt-0 flex-1 h-0 flex flex-col justify-stretch">
              <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-2 h-full justify-between">
                <Textarea 
                  className="flex-1 resize-none bg-transparent border-0 text-[11px] p-1.5 leading-relaxed text-white/70 font-mono custom-scrollbar focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-hidden"
                  placeholder={"1\n00:00:00,000 --> 00:00:02,000\nPaste your subtitle text here..."}
                  value={pastedSrt}
                  onChange={(e) => setPastedSrt(e.target.value)}
                  disabled={disabled}
                />
                <Button 
                  onClick={handlePasteSubmit} 
                  disabled={disabled || !pastedSrt.trim()}
                  className="w-full text-xs h-7 bg-violet-600 hover:bg-violet-500 text-white border-0 transition-colors shrink-0 rounded-md"
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
