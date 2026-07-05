"use client";

import React, { useReducer, useCallback, useRef, useState, useEffect } from "react";
import { Header } from "@/components/header";
import { UploadZone } from "@/components/upload-zone";
import { VideoPreview, VideoPreviewHandle } from "@/components/video-preview";
import { StyleControls } from "@/components/style-controls";

import { SubtitleEditor } from "@/components/subtitle-editor";
import { ErrorBoundary } from "@/components/error-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SubtitleCue,
  SubtitleStyle,
  ExportSettings,
  DEFAULT_STYLE,
  DEFAULT_EXPORT_SETTINGS,
} from "@/types";
import { parseSRT } from "@/lib/srt-parser";
import { toast } from "sonner";
import { extractYoutubeId } from "@/lib/utils";

// ── State management ──────────────────────────────────────────────
interface AppState {
  videoFile: File | null;
  youtubeId: string | null;
  srtFile: File | null;
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  exportSettings: ExportSettings;
  isProcessing: boolean;
  isSidebarOpen: boolean;
  pastSubtitles: SubtitleCue[][];
  futureSubtitles: SubtitleCue[][];
}

type AppAction =
  | { type: "SET_VIDEO"; file: File | null }
  | { type: "SET_YOUTUBE"; id: string | null }
  | { type: "SET_SRT"; file: File | null; subtitles: SubtitleCue[] }
  | { type: "SET_SUBTITLES"; subtitles: SubtitleCue[] }
  | { type: "SET_STYLE"; style: SubtitleStyle }
  | { type: "SET_EXPORT_SETTINGS"; settings: ExportSettings }
  | { type: "SET_PROCESSING"; value: boolean }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "CLEAR_SRT" }
  | { type: "UNDO_SUBTITLES" }
  | { type: "REDO_SUBTITLES" }
  | { type: "PUSH_SUBTITLES_HISTORY"; subtitlesBefore: SubtitleCue[] };

const initialState: AppState = {
  videoFile: null,
  youtubeId: null,
  srtFile: null,
  subtitles: [],
  style: DEFAULT_STYLE,
  exportSettings: DEFAULT_EXPORT_SETTINGS,
  isProcessing: false,
  isSidebarOpen: true,
  pastSubtitles: [],
  futureSubtitles: [],
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_VIDEO":
      return { ...state, videoFile: action.file, youtubeId: null };
    case "SET_YOUTUBE":
      return { ...state, youtubeId: action.id, videoFile: null };

    case "SET_SRT":
      return {
        ...state,
        srtFile: action.file,
        subtitles: action.subtitles,
        pastSubtitles: [],
        futureSubtitles: [],
      };
    case "SET_SUBTITLES":
      return { ...state, subtitles: action.subtitles };
    case "SET_STYLE":
      return { ...state, style: action.style };
    case "SET_EXPORT_SETTINGS":
      return { ...state, exportSettings: action.settings };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.value };
    case "TOGGLE_SIDEBAR":
      return { ...state, isSidebarOpen: !state.isSidebarOpen };
    case "CLEAR_SRT":
      return {
        ...state,
        srtFile: null,
        subtitles: [],
        pastSubtitles: [],
        futureSubtitles: [],
      };
    case "PUSH_SUBTITLES_HISTORY":
      return {
        ...state,
        pastSubtitles: [...state.pastSubtitles, action.subtitlesBefore],
        futureSubtitles: [],
      };
    case "UNDO_SUBTITLES": {
      if (state.pastSubtitles.length === 0) return state;
      const newPast = [...state.pastSubtitles];
      const previous = newPast.pop()!;
      return {
        ...state,
        pastSubtitles: newPast,
        futureSubtitles: [...state.futureSubtitles, state.subtitles],
        subtitles: previous,
      };
    }
    case "REDO_SUBTITLES": {
      if (state.futureSubtitles.length === 0) return state;
      const newFuture = [...state.futureSubtitles];
      const next = newFuture.pop()!;
      return {
        ...state,
        pastSubtitles: [...state.pastSubtitles, state.subtitles],
        futureSubtitles: newFuture,
        subtitles: next,
      };
    }
    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────
export default function Home() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { videoFile, youtubeId, srtFile, subtitles, style, exportSettings, isProcessing, isSidebarOpen, pastSubtitles, futureSubtitles } = state;

  const [activeCueIndex, setActiveCueIndex] = useState<number | null>(null);
  const videoPreviewRef = useRef<VideoPreviewHandle>(null);

  const [showUpload, setShowUpload] = useState(true);
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);

  // Auto-collapse upload zone once both files are uploaded for the first time
  useEffect(() => {
    if ((videoFile || youtubeId) && subtitles.length > 0) {
      if (!hasAutoCollapsed) {
        setShowUpload(false);
        setHasAutoCollapsed(true);
      }
    } else {
      setHasAutoCollapsed(false);
      setShowUpload(true);
    }
  }, [videoFile, youtubeId, subtitles.length, hasAutoCollapsed]);

  // Load from localStorage on client-side mount
  useEffect(() => {
    const savedSubtitles = localStorage.getItem("subvideo_subtitles");
    const savedStyle = localStorage.getItem("subvideo_style");
    const savedExportSettings = localStorage.getItem("subvideo_export_settings");
    const savedYoutubeId = localStorage.getItem("subvideo_youtube_id");

    if (savedSubtitles) {
      try {
        const parsed = JSON.parse(savedSubtitles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          dispatch({ type: "SET_SUBTITLES", subtitles: parsed });
        }
      } catch (e) {
        console.error("Failed to parse saved subtitles", e);
      }
    }

    if (savedStyle) {
      try {
        const parsed = JSON.parse(savedStyle);
        dispatch({ type: "SET_STYLE", style: parsed });
      } catch (e) {
        console.error("Failed to parse saved style", e);
      }
    }

    if (savedExportSettings) {
      try {
        const parsed = JSON.parse(savedExportSettings);
        dispatch({ type: "SET_EXPORT_SETTINGS", settings: parsed });
      } catch (e) {
        console.error("Failed to parse saved export settings", e);
      }
    }

    if (savedYoutubeId) {
      const validatedId = extractYoutubeId(savedYoutubeId);
      if (validatedId) {
        dispatch({ type: "SET_YOUTUBE", id: validatedId });
      } else {
        localStorage.removeItem("subvideo_youtube_id");
      }
    }
  }, []);

  // Debounced auto-save for subtitles
  useEffect(() => {
    if (subtitles.length === 0) {
      localStorage.removeItem("subvideo_subtitles");
      return;
    }
    const timer = setTimeout(() => {
      localStorage.setItem("subvideo_subtitles", JSON.stringify(subtitles));
    }, 1000);
    return () => clearTimeout(timer);
  }, [subtitles]);

  // Auto-save styling
  useEffect(() => {
    localStorage.setItem("subvideo_style", JSON.stringify(style));
  }, [style]);

  // Auto-save export settings
  useEffect(() => {
    localStorage.setItem("subvideo_export_settings", JSON.stringify(exportSettings));
  }, [exportSettings]);

  // Auto-save youtubeId
  useEffect(() => {
    if (youtubeId) {
      localStorage.setItem("subvideo_youtube_id", youtubeId);
    } else {
      localStorage.removeItem("subvideo_youtube_id");
    }
  }, [youtubeId]);

  // Keyboard shortcuts listener for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) return; // Let native browser undo/redo work when typing inside inputs

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            dispatch({ type: "REDO_SUBTITLES" });
          } else {
            dispatch({ type: "UNDO_SUBTITLES" });
          }
        } else if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          dispatch({ type: "REDO_SUBTITLES" });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleActiveCueChange = useCallback((index: number | null) => {
    setActiveCueIndex(index);
  }, []);

  const handleSelectCueTime = useCallback((time: number) => {
    videoPreviewRef.current?.seekTo(time);
  }, []);

  const handleAddSubtitle = useCallback(() => {
    dispatch({ type: "PUSH_SUBTITLES_HISTORY", subtitlesBefore: subtitles });
    const time = videoPreviewRef.current?.getCurrentTime() ?? 0;
    
    const newCue: SubtitleCue = {
      index: subtitles.length + 1,
      startTime: time,
      endTime: time + 2.0,
      text: "New subtitle...",
    };
    
    const updated = [...subtitles, newCue].sort((a, b) => a.startTime - b.startTime);
    const reindexed = updated.map((cue, idx) => ({
      ...cue,
      index: idx + 1,
    }));
    
    dispatch({ type: "SET_SUBTITLES", subtitles: reindexed });
    toast.success("Added new subtitle block at playhead");
  }, [subtitles]);

  const handleDeleteSubtitle = useCallback((cueIndex: number) => {
    dispatch({ type: "PUSH_SUBTITLES_HISTORY", subtitlesBefore: subtitles });
    const updated = subtitles.filter(cue => cue.index !== cueIndex);
    const reindexed = updated.map((cue, idx) => ({
      ...cue,
      index: idx + 1,
    }));
    
    dispatch({ type: "SET_SUBTITLES", subtitles: reindexed });
    toast.success("Deleted subtitle block");
  }, [subtitles]);

  const handleVideoUpload = useCallback((file: File) => {
    dispatch({ type: "SET_VIDEO", file });
  }, []);

  const handleYoutubeLoad = useCallback((id: string) => {
    dispatch({ type: "SET_YOUTUBE", id });
  }, []);

  const handleYoutubeRemove = useCallback(() => {
    dispatch({ type: "SET_YOUTUBE", id: null });
  }, []);

  const handleSrtUpload = useCallback(async (file: File) => {
    // Guard against unreasonably large SRT files (>5MB is suspicious)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("SRT file too large", {
        description: "Subtitle files should typically be under 1MB.",
      });
      return;
    }
    const text = await file.text();
    const parsed = parseSRT(text);
    if (parsed.length === 0) {
      toast.warning("No subtitles found", {
        description: "The file may not be a valid SRT format.",
      });
    }
    dispatch({ type: "SET_SRT", file, subtitles: parsed });
  }, []);

  const handleVideoRemove = useCallback(() => {
    dispatch({ type: "SET_VIDEO", file: null });
  }, []);

  const handleSrtRemove = useCallback(() => {
    dispatch({ type: "CLEAR_SRT" });
  }, []);

  const hasFiles = videoFile !== null || youtubeId !== null || subtitles.length > 0;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-[500px] w-[600px] rounded-full bg-violet-600/[0.04] blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[500px] rounded-full bg-fuchsia-600/[0.03] blur-[100px]" />
      </div>

      <Header />

      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 sm:gap-6 p-2 sm:p-6 overflow-x-hidden">
        {/* ── Upload section ─────────────────────────────────────── */}
        <section>
          {showUpload ? (
            <div className="relative">
              {(videoFile || youtubeId) && subtitles.length > 0 && (
                <div className="absolute right-3 top-3 z-20">
                  <button
                    onClick={() => setShowUpload(false)}
                    className="flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1.5 text-[10px] font-medium text-white/50 border border-white/10 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    Collapse
                  </button>
                </div>
              )}
              <UploadZone
                videoFile={videoFile}
                youtubeId={youtubeId}
                srtFile={srtFile}
                onVideoUpload={handleVideoUpload}
                onYoutubeLoad={handleYoutubeLoad}
                onSrtUpload={handleSrtUpload}
                onVideoRemove={handleVideoRemove}
                onYoutubeRemove={handleYoutubeRemove}
                onSrtRemove={handleSrtRemove}
                disabled={isProcessing}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.01] px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-7 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/10 shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Files Loaded
                </div>
                <span className="text-xs text-white/50 truncate font-medium">
                  {videoFile ? videoFile.name : youtubeId ? `YouTube Video (${youtubeId})` : "Video"} · {subtitles.length} Subtitles
                </span>
              </div>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
                Manage Files
              </button>
            </div>
          )}
        </section>

        {/* ── Main content area ──────────────────────────────────── */}
        {hasFiles && (
          <>
            <section className={`flex flex-1 flex-col gap-4 sm:gap-6 ${isSidebarOpen ? 'lg:flex-row' : 'lg:flex-col'}`}>
              {/* Video Preview - takes 70% on desktop */}
              <div className="flex-1 lg:flex-[7]">
                <div className="lg:sticky lg:top-6">
                  <ErrorBoundary>
                    <VideoPreview
                      ref={videoPreviewRef}
                      videoFile={videoFile}
                      youtubeId={youtubeId}
                      subtitles={subtitles}
                      style={style}
                      aspectRatio={exportSettings.aspectRatio}
                      onActiveCueChange={handleActiveCueChange}
                    />
                  </ErrorBoundary>
                  {subtitles.length > 0 && (
                    <div className="mt-3 flex items-center justify-between text-xs text-white/30">
                      <div className="flex items-center gap-2">
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
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        {subtitles.length} subtitles loaded
                      </div>
                      <button
                        onClick={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        {isSidebarOpen ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
                            Hide Editor Menu
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
                            Show Editor Menu
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar - Subtitles & Editor Tools */}
              {isSidebarOpen && (
                <aside className="w-full shrink-0 lg:w-[350px]">
                  <div className="lg:sticky lg:top-6 space-y-6 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5 sm:p-5 backdrop-blur-sm">
                    <Tabs defaultValue="subtitles" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 bg-white/5 p-1 rounded-lg">
                        <TabsTrigger value="subtitles" className="rounded-md text-[10px] sm:text-[11px] px-1 sm:px-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                          Subtitles
                        </TabsTrigger>
                        <TabsTrigger value="styles" className="rounded-md text-[10px] sm:text-[11px] px-1 sm:px-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                          Styling
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="subtitles" className="mt-0">
                        <ErrorBoundary>
                          <SubtitleEditor
                            subtitles={subtitles}
                            activeCueIndex={activeCueIndex}
                            onSelectCueTime={handleSelectCueTime}
                            onAddSubtitle={handleAddSubtitle}
                            onDeleteSubtitle={handleDeleteSubtitle}
                            onUpdateSubtitles={(subs) => dispatch({ type: "SET_SUBTITLES", subtitles: subs })}
                            disabled={isProcessing}
                            canUndo={pastSubtitles.length > 0}
                            canRedo={futureSubtitles.length > 0}
                            onUndo={() => dispatch({ type: "UNDO_SUBTITLES" })}
                            onRedo={() => dispatch({ type: "REDO_SUBTITLES" })}
                            onPushHistory={(subsBefore) => dispatch({ type: "PUSH_SUBTITLES_HISTORY", subtitlesBefore: subsBefore })}
                          />
                        </ErrorBoundary>
                      </TabsContent>

                      <TabsContent value="styles" className="mt-0">
                        <ErrorBoundary>
                          <StyleControls
                            style={style}
                            onStyleChange={(s) => dispatch({ type: "SET_STYLE", style: s })}
                            disabled={isProcessing}
                          />
                        </ErrorBoundary>
                      </TabsContent>


                    </Tabs>
                  </div>
                </aside>
              )}
            </section>


          </>
        )}

        {/* ── Empty state ────────────────────────────────────────── */}
        {!hasFiles && (
          <div className="flex flex-1 items-center justify-center py-10 sm:py-20">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/10">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-violet-400/50"
                >
                  <rect
                    x="2"
                    y="2"
                    width="20"
                    height="20"
                    rx="2.18"
                    ry="2.18"
                  />
                  <line x1="7" y1="2" x2="7" y2="22" />
                  <line x1="17" y1="2" x2="17" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="2" y1="7" x2="7" y2="7" />
                  <line x1="2" y1="17" x2="7" y2="17" />
                  <line x1="17" y1="7" x2="22" y2="7" />
                  <line x1="17" y1="17" x2="22" y2="17" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white/60">
                Get started
              </h2>
              <p className="mt-2 max-w-md text-sm text-white/30">
                Upload a video and subtitle file above to start customizing and
                burning subtitles into your video.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {["100% Client-side", "No upload to servers", "Free & private"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 text-xs text-white/30"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
