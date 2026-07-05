"use client";

import React, { useState, useEffect, useRef } from "react";
import { SubtitleCue, SubtitleTrack } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { serializeSRT, formatSrtTimestamp, parseSRT } from "@/lib/srt-parser";
import { toast } from "sonner";

interface SubtitleEditorProps {
  subtitles: SubtitleCue[];
  tracks: SubtitleTrack[];
  activeTrackId: string | null;
  onSelectTrack: (id: string) => void;
  onCopyTimings: (sourceTrackId: string, targetTrackId: string) => void;
  onRenameTrack?: (id: string, name: string) => void;
  onRemoveTrack?: (id: string) => void;
  onAddTrack?: (name: string, subtitles: SubtitleCue[]) => void;
  activeCueIndex: number | null;
  onSelectCueTime?: (time: number) => void;
  onAddSubtitle?: () => void;
  onDeleteSubtitle?: (cueIndex: number) => void;
  onUpdateSubtitles: (subtitles: SubtitleCue[]) => void;
  disabled?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPushHistory: (subsBefore: SubtitleCue[]) => void;
}

export function SubtitleEditor({
  subtitles,
  tracks,
  activeTrackId,
  onSelectTrack,
  onCopyTimings,
  onRenameTrack,
  onRemoveTrack,
  onAddTrack,
  activeCueIndex,
  onSelectCueTime,
  onAddSubtitle,
  onDeleteSubtitle,
  onUpdateSubtitles,
  disabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPushHistory,
}: SubtitleEditorProps) {
  const [shiftMs, setShiftMs] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [showReplacePanel, setShowReplacePanel] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copySourceId, setCopySourceId] = useState<string>("");

  useEffect(() => {
    const otherTracks = tracks.filter((t) => t.id !== activeTrackId);
    if (otherTracks.length > 0 && (!copySourceId || !otherTracks.some((t) => t.id === copySourceId))) {
      setCopySourceId(otherTracks[0].id);
    }
  }, [tracks, activeTrackId, copySourceId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialSubtitlesRef = useRef<SubtitleCue[] | null>(null);
  const sidebarFileInputRef = useRef<HTMLInputElement>(null);

  const handleSidebarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    onAddTrack?.(file.name, parsed);
    toast.success(`Loaded track: ${file.name}`);
    e.target.value = "";
  };

  const handleCreateEmptyTrack = () => {
    const name = `Track ${tracks.length + 1}.srt`;
    onAddTrack?.(name, []);
    toast.success(`Created empty track: ${name}`);
  };

  const filteredSubtitles = subtitles.filter((cue) =>
    cue.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const escaped = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    let count = 0;
    const newSubs = subtitles.map((cue) => {
      if (regex.test(cue.text)) {
        count++;
        const updatedText = cue.text.replace(regex, replaceQuery);
        return { ...cue, text: updatedText };
      }
      return cue;
    });

    if (count > 0) {
      onPushHistory(subtitles);
      onUpdateSubtitles(newSubs);
      toast.success(`Replaced instances in ${count} subtitle blocks`);
    } else {
      toast.warning("No matching text found to replace");
    }
  };

  useEffect(() => {
    if (activeCueIndex !== null && containerRef.current) {
      const activeCard = containerRef.current.querySelector(
        `[data-cue-index="${activeCueIndex}"]`
      );
      if (activeCard) {
        activeCard.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [activeCueIndex]);

  const handleCardClick = (e: React.MouseEvent, startTime: number) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("textarea") ||
      target.closest("input") ||
      target.closest(".relative.h-1.5") || // Slider tracks
      target.closest("span[role='slider']") // Slider handles
    ) {
      return;
    }
    onSelectCueTime?.(startTime);
  };

  const handleTextChange = (index: number, newText: string) => {
    const newSubs = subtitles.map((cue) =>
      cue.index === index ? { ...cue, text: newText } : cue
    );
    onUpdateSubtitles(newSubs);
  };

  const applySyncShift = () => {
    if (shiftMs === 0) return;
    const shiftSeconds = shiftMs / 1000;
    
    const newSubs = subtitles.map((cue) => ({
      ...cue,
      startTime: Math.max(0, cue.startTime + shiftSeconds),
      endTime: Math.max(0.1, cue.endTime + shiftSeconds),
    }));
    
    onPushHistory(subtitles);
    onUpdateSubtitles(newSubs);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    return `${mins}:${String(secs).padStart(2, "0")}.${tenths}s`;
  };

  const handleExportSRT = () => {
    if (subtitles.length === 0) return;
    const srtContent = serializeSRT(subtitles);
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles_${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col h-full gap-4 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {/* Track Manager at the top of the editor */}
      {tracks.length >= 1 && (
        <div className="flex flex-col gap-2 p-2 bg-white/5 rounded-xl border border-white/5 shrink-0">
          <div className="flex items-center justify-between pl-1">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider select-none">Subtitle Tracks</span>
            
            <div className="flex items-center gap-1.5">
              {/* File upload button */}
              <button
                onClick={() => sidebarFileInputRef.current?.click()}
                className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                title="Upload Another Subtitle File"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </button>
              <input
                ref={sidebarFileInputRef}
                type="file"
                accept=".srt"
                onChange={handleSidebarFileUpload}
                className="hidden"
              />

              {/* Create empty track button */}
              <button
                onClick={handleCreateEmptyTrack}
                className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                title="Create Empty Subtitle Track"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex gap-1.5 items-center">
            <select
              value={activeTrackId || ""}
              onChange={(e) => onSelectTrack(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer font-medium"
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id} className="bg-zinc-950 text-white text-xs">
                  {t.name}
                </option>
              ))}
            </select>

            {/* Quick action buttons for active track */}
            <button
              onClick={() => {
                if (activeTrackId) {
                  const track = tracks.find(t => t.id === activeTrackId);
                  if (track) {
                    const newName = window.prompt("Rename subtitle track:", track.name);
                    if (newName && newName.trim()) {
                      onRenameTrack?.(activeTrackId, newName.trim());
                    }
                  }
                }
              }}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Rename Active Track"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>

            <button
              onClick={() => {
                if (activeTrackId && confirm("Are you sure you want to delete this track?")) {
                  onRemoveTrack?.(activeTrackId);
                }
              }}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-red-400/70 hover:text-red-400 transition-colors"
              title="Delete Active Track"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Sleek Toolbar */}
      <div className="flex gap-2 items-center shrink-0">
        <div className="relative flex-1">
          <Input
            placeholder="Search subtitles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 bg-white/5 text-white border-white/10 text-xs pl-8 pr-7 focus-visible:ring-violet-500 rounded-lg"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-white/40 hover:text-white/70 text-[9px] rounded-full hover:bg-white/5 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            setShowReplacePanel(!showReplacePanel);
            setShowSyncPanel(false);
            setShowCopyPanel(false);
          }}
          className={`h-9 w-9 shrink-0 p-0 border-0 flex items-center justify-center rounded-lg transition-colors ${
            showReplacePanel ? "bg-violet-600 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
          title="Search & Replace"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
        </Button>

        <Button
          variant="secondary"
          onClick={() => {
            setShowSyncPanel(!showSyncPanel);
            setShowReplacePanel(false);
            setShowCopyPanel(false);
          }}
          className={`h-9 w-9 shrink-0 p-0 border-0 flex items-center justify-center rounded-lg transition-colors ${
            showSyncPanel ? "bg-violet-600 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
          title="Sync Fixer (Time Shift)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </Button>

        <Button
          variant="secondary"
          onClick={() => {
            setShowCopyPanel(!showCopyPanel);
            setShowReplacePanel(false);
            setShowSyncPanel(false);
          }}
          className={`h-9 w-9 shrink-0 p-0 border-0 flex items-center justify-center rounded-lg transition-colors ${
            showCopyPanel ? "bg-violet-600 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
          title="Copy Timings from Another Track"
          disabled={tracks.length < 2}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1M4 12V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4" />
            <polyline points="10 9 15 14 10 19" />
          </svg>
        </Button>

        <Button
          variant="secondary"
          onClick={onUndo}
          disabled={!canUndo}
          className="h-9 w-9 shrink-0 p-0 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Undo (Ctrl+Z)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </Button>

        <Button
          variant="secondary"
          onClick={onRedo}
          disabled={!canRedo}
          className="h-9 w-9 shrink-0 p-0 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Redo (Ctrl+Y)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
          </svg>
        </Button>

        <Button
          variant="secondary"
          onClick={handleExportSRT}
          disabled={subtitles.length === 0}
          className="h-9 w-9 shrink-0 p-0 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-0 flex items-center justify-center rounded-lg transition-colors"
          title="Download SRT"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </Button>
      </div>

      {/* Slide-down Replace Drawer */}
      {showReplacePanel && subtitles.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-200 shrink-0">
          <Input
            placeholder="Replace text with..."
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            className="h-8 flex-1 bg-black/20 text-white border-white/10 text-xs focus-visible:ring-violet-500 rounded-md"
          />
          <Button
            variant="secondary"
            className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0 transition-colors rounded-md font-semibold"
            onClick={handleReplaceAll}
            disabled={!searchQuery}
          >
            Replace All
          </Button>
        </div>
      )}

      {/* Slide-down Sync Drawer */}
      {showSyncPanel && subtitles.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex gap-2 items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200 shrink-0">
          <span className="text-[10px] text-white/40 shrink-0 font-medium">Shift Cues:</span>
          <Input 
            type="number" 
            placeholder="ms, e.g. 500 or -1000" 
            value={shiftMs || ""} 
            onChange={(e) => setShiftMs(Number(e.target.value))}
            className="h-8 flex-1 max-w-[140px] bg-black/20 text-white border-white/10 text-xs text-center focus-visible:ring-violet-500 rounded-md"
          />
          <Button 
            variant="secondary" 
            className="h-8 px-3 shrink-0 text-xs bg-white/10 hover:bg-white/20 text-white border-0 rounded-md transition-colors"
            onClick={applySyncShift}
          >
            Apply Shift
          </Button>
        </div>
      )}

      {/* Slide-down Copy Timings Drawer */}
      {showCopyPanel && tracks.length > 1 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Sync Timings</span>
            <span className="text-[9px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded font-semibold">Matches by index</span>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[9px] text-white/30 font-semibold pl-0.5">Copy Timings From:</label>
              <select
                value={copySourceId}
                onChange={(e) => setCopySourceId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer font-medium"
              >
                {tracks
                  .filter((t) => t.id !== activeTrackId)
                  .map((t) => (
                    <option key={t.id} value={t.id} className="bg-zinc-950 text-white">
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[9px] text-white/30 font-semibold pl-0.5">Apply to Active Track:</label>
              <div className="w-full bg-white/5 border border-white/5 rounded-md px-2 py-1.5 text-xs text-white/50 truncate font-semibold">
                {tracks.find((t) => t.id === activeTrackId)?.name || "Active Track"}
              </div>
            </div>
          </div>
          
          <Button
            variant="secondary"
            className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0 transition-colors rounded-md font-semibold"
            onClick={() => {
              const source = tracks.find(t => t.id === copySourceId);
              const target = tracks.find(t => t.id === activeTrackId);
              if (source && target) {
                if (source.subtitles.length !== target.subtitles.length) {
                  toast.warning("Line count mismatch", {
                    description: `Source has ${source.subtitles.length} lines, target has ${target.subtitles.length} lines. Timings will copy for the first ${Math.min(source.subtitles.length, target.subtitles.length)} lines.`,
                  });
                }
                onCopyTimings(copySourceId, activeTrackId!);
                toast.success(`Copied timings from "${source.name}" to "${target.name}"`);
                setShowCopyPanel(false);
              }
            }}
            disabled={!copySourceId}
          >
            Copy Timestamps
          </Button>
        </div>
      )}

      {/* Subtitles List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 min-h-[300px] max-h-[400px] lg:max-h-[60vh]">
        {filteredSubtitles.map((cue) => {
          const globalIndex = subtitles.findIndex(c => c.index === cue.index);
          const prevEndTime = globalIndex > 0 ? subtitles[globalIndex - 1].endTime : 0;
          const nextStartTime = globalIndex < subtitles.length - 1 ? subtitles[globalIndex + 1].startTime : cue.endTime + 5;
          const isActive = cue.index === activeCueIndex;
          return (
            <div 
              key={cue.index} 
              data-cue-index={cue.index}
              onClick={(e) => handleCardClick(e, cue.startTime)}
              className={`relative rounded-lg border p-3 hover:bg-white/[0.03] transition-all duration-300 cursor-pointer group ${
                isActive 
                  ? "border-violet-500 bg-violet-500/5 shadow-[0_0_12px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/30" 
                  : "border-white/5 bg-white/[0.01]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded-sm">
                    #{cue.index}
                  </span>
                  <span className="text-[10px] tabular-nums text-white/40 font-mono">
                    {formatTime(cue.startTime)} → {formatTime(cue.endTime)}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const startTimeStr = formatSrtTimestamp(cue.startTime);
                      const endTimeStr = formatSrtTimestamp(cue.endTime);
                      const textToCopy = `${startTimeStr} --> ${endTimeStr}\n${cue.text}`;
                      navigator.clipboard.writeText(textToCopy);
                      toast.success(`Copied subtitle #${cue.index} with timing`);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/20 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                    aria-label="Copy Subtitle with Timing"
                    title="Copy with Timing"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSubtitle?.(cue.index);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    aria-label="Delete Subtitle"
                    title="Delete Subtitle"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <Textarea
                className="resize-none min-h-[50px] text-sm bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:outline-hidden text-white/80 placeholder:text-white/20"
                value={cue.text}
                onChange={(e) => handleTextChange(cue.index, e.target.value)}
                onFocus={() => {
                  initialSubtitlesRef.current = subtitles;
                }}
                onBlur={() => {
                  if (initialSubtitlesRef.current) {
                    const initialCard = initialSubtitlesRef.current.find(c => c.index === cue.index);
                    if (initialCard && initialCard.text !== cue.text) {
                      onPushHistory(initialSubtitlesRef.current);
                    }
                    initialSubtitlesRef.current = null;
                  }
                }}
              />
              <div className="mt-4 px-2 select-none group/slider">
                <div className="flex justify-between text-[9px] text-white/20 mb-1.5 opacity-0 group-hover/slider:opacity-100 transition-opacity">
                  <span>Start (Trim)</span>
                  <span>End (Trim)</span>
                </div>
                <Slider
                  value={[cue.startTime, cue.endTime]}
                  min={Math.max(0, prevEndTime)}
                  max={nextStartTime}
                  step={0.1}
                  onValueChange={(val) => {
                    if (Array.isArray(val) && val.length === 2) {
                      const newSubs = subtitles.map(c => 
                        c.index === cue.index ? { ...cue, startTime: val[0], endTime: val[1] } : c
                      );
                      onUpdateSubtitles(newSubs);
                    }
                  }}
                  onPointerDown={() => {
                    initialSubtitlesRef.current = subtitles;
                  }}
                  onPointerUp={() => {
                    if (initialSubtitlesRef.current) {
                      const initialCard = initialSubtitlesRef.current.find(c => c.index === cue.index);
                      if (initialCard && (initialCard.startTime !== cue.startTime || initialCard.endTime !== cue.endTime)) {
                        onPushHistory(initialSubtitlesRef.current);
                      }
                      initialSubtitlesRef.current = null;
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>
          );
        })}

        {filteredSubtitles.length === 0 && searchQuery && (
          <div className="text-center py-10 text-white/30 text-xs">
            <p>No matching subtitles found for &quot;{searchQuery}&quot;</p>
          </div>
        )}

        {subtitles.length === 0 && (
          <div className="text-center py-20 text-white/30 text-sm">
            <p>Upload an SRT file to edit subtitles.</p>
          </div>
        )}

        {subtitles.length > 0 && (
          <Button
            variant="secondary"
            onClick={onAddSubtitle}
            className="w-full h-10 border border-dashed border-violet-500/30 bg-violet-500/5 text-violet-300 hover:bg-violet-500/10 hover:text-white transition-all text-xs font-semibold flex items-center justify-center gap-2 mt-4"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Subtitle Block at Playhead
          </Button>
        )}
      </div>
    </div>
  );
}
