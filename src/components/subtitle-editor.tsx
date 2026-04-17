"use client";

import React, { useState } from "react";
import { SubtitleCue } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

interface SubtitleEditorProps {
  subtitles: SubtitleCue[];
  onUpdateSubtitles: (subtitles: SubtitleCue[]) => void;
  disabled?: boolean;
}

export function SubtitleEditor({
  subtitles,
  onUpdateSubtitles,
  disabled,
}: SubtitleEditorProps) {
  const [shiftMs, setShiftMs] = useState<number>(0);

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
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, "0")}s`;
  };

  return (
    <div className={`flex flex-col h-full gap-5 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {/* Time Shift Utility */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white/90 mb-2">Sync Fixer</h3>
        <p className="text-xs text-white/40 mb-3">
          Shift all subtitle timestamps forward or backward simultaneously.
        </p>
        <div className="flex gap-2">
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

      {/* Subtitles List */}
      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 min-h-[400px] max-h-[60vh]">
        {subtitles.map((cue, index) => {
          const prevEndTime = index > 0 ? subtitles[index - 1].endTime : 0;
          const nextStartTime = index < subtitles.length - 1 ? subtitles[index + 1].startTime : cue.endTime + 5;
          return (
            <div key={cue.index} className="relative rounded-lg border border-white/5 bg-white/[0.01] p-3 hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded-sm">
                  #{cue.index}
                </span>
                <span className="text-[10px] tabular-nums text-white/40 font-mono">
                  {formatTime(cue.startTime)} → {formatTime(cue.endTime)}
                </span>
              </div>
              <Textarea
                className="resize-none min-h-[50px] text-sm bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:outline-hidden text-white/80 placeholder:text-white/20"
                value={cue.text}
                onChange={(e) => handleTextChange(cue.index, e.target.value)}
              />
              <div className="mt-4 px-2 select-none group">
                <div className="flex justify-between text-[9px] text-white/20 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      const newSubs = [...subtitles];
                      newSubs[index] = { ...cue, startTime: val[0], endTime: val[1] };
                      onUpdateSubtitles(newSubs);
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>
          );
        })}

        {subtitles.length === 0 && (
          <div className="text-center py-20 text-white/30 text-sm">
            <p>Upload an SRT file to edit subtitles.</p>
          </div>
        )}
      </div>
    </div>
  );
}
