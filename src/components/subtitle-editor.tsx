"use client";

import React, { useState, useEffect, useRef } from "react";
import { SubtitleCue } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { serializeSRT } from "@/lib/srt-parser";
import { toast } from "sonner";

interface SubtitleEditorProps {
  subtitles: SubtitleCue[];
  activeCueIndex: number | null;
  onSelectCueTime?: (time: number) => void;
  onAddSubtitle?: () => void;
  onDeleteSubtitle?: (cueIndex: number) => void;
  onUpdateSubtitles: (subtitles: SubtitleCue[]) => void;
  disabled?: boolean;
}

export function SubtitleEditor({
  subtitles,
  activeCueIndex,
  onSelectCueTime,
  onAddSubtitle,
  onDeleteSubtitle,
  onUpdateSubtitles,
  disabled,
}: SubtitleEditorProps) {
  const [shiftMs, setShiftMs] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div className={`flex flex-col h-full gap-5 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {/* Utilities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Time Shift Utility */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-white/90 mb-2">Sync Fixer</h3>
          <p className="text-xs text-white/40 mb-3 flex-1">
            Shift all subtitle timestamps forward or backward simultaneously.
          </p>
          <div className="flex gap-2 mt-auto">
            <Input 
              type="number" 
              placeholder="e.g. 500 or -1000" 
              value={shiftMs || ""} 
              onChange={(e) => setShiftMs(Number(e.target.value))}
              className="h-9 bg-black/20 text-white border-white/10 text-xs"
            />
            <Button 
              variant="secondary" 
              className="h-9 w-24 shrink-0 text-xs bg-white/10 hover:bg-white/20 text-white border-0"
              onClick={applySyncShift}
            >
              Shift (ms)
            </Button>
          </div>
        </div>

        {/* Export Subtitles Utility */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-white/90 mb-2">Export Subtitles</h3>
          <p className="text-xs text-white/40 mb-3 flex-1">
            Download the modified subtitles directly as an SRT file.
          </p>
          <Button 
            variant="secondary" 
            className="h-9 w-full text-xs bg-white/10 hover:bg-white/20 text-white border-0 mt-auto flex gap-2 items-center justify-center transition-colors"
            onClick={handleExportSRT}
            disabled={subtitles.length === 0}
            title="Download SRT"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Download .SRT
          </Button>
        </div>
      </div>

      {/* Search & Replace Utility */}
      {subtitles.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/90">Search & Replace</h3>
            {searchQuery && (
              <span className="text-[10px] text-violet-400 font-medium font-mono">
                {filteredSubtitles.length} matches
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Input
                placeholder="Search word..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 bg-black/20 text-white border-white/10 text-xs pr-7 focus-visible:ring-violet-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-white/40 hover:text-white/70 text-[9px] rounded-full hover:bg-white/5 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Replace..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="h-8 bg-black/20 text-white border-white/10 text-xs focus-visible:ring-violet-500"
              />
              <Button
                variant="secondary"
                className="h-8 px-2 shrink-0 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0 transition-colors"
                onClick={handleReplaceAll}
                disabled={!searchQuery}
              >
                Replace
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Subtitles List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 min-h-[400px] max-h-[60vh]">
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
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSubtitle?.(cue.index);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  aria-label="Delete Subtitle"
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
              <Textarea
                className="resize-none min-h-[50px] text-sm bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:outline-hidden text-white/80 placeholder:text-white/20"
                value={cue.text}
                onChange={(e) => handleTextChange(cue.index, e.target.value)}
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
                  className="w-full"
                />
              </div>
            </div>
          );
        })}

        {filteredSubtitles.length === 0 && searchQuery && (
          <div className="text-center py-10 text-white/30 text-xs">
            <p>No matching subtitles found for "{searchQuery}"</p>
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
