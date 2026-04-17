"use client";

import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { SubtitleCue } from "@/types";
import { serializeSRT } from "@/lib/srt-parser";

interface TimelineEditorProps {
  subtitles: SubtitleCue[];
  onUpdateSubtitles: (subtitles: SubtitleCue[]) => void;
  duration: number;         // total video duration in seconds
  currentTime: number;      // current playback position
  onSeek: (time: number) => void;
  disabled?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────
const TRACK_HEIGHT = 52;
const RULER_HEIGHT = 28;
const MIN_CUE_DURATION = 0.3;       // seconds
const SNAP_GRID = 0.1;              // snap to 100ms
const MIN_PX_PER_SEC = 20;
const MAX_PX_PER_SEC = 300;
const DEFAULT_PX_PER_SEC = 80;
const WAVEFORM_HEIGHT = 40;

// ── Helpers ──────────────────────────────────────────────────────────
function snapTime(t: number): number {
  return Math.round(t / SNAP_GRID) * SNAP_GRID;
}

function formatTimeRuler(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTimeFull(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

// ── Color palette for cue blocks ─────────────────────────────────────
const CUE_COLORS = [
  "rgba(139, 92, 246, 0.6)",   // violet
  "rgba(236, 72, 153, 0.6)",   // pink
  "rgba(59, 130, 246, 0.6)",   // blue
  "rgba(16, 185, 129, 0.6)",   // emerald
  "rgba(245, 158, 11, 0.6)",   // amber
  "rgba(99, 102, 241, 0.6)",   // indigo
];

export function TimelineEditor({
  subtitles,
  onUpdateSubtitles,
  duration,
  currentTime,
  onSeek,
  disabled,
}: TimelineEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  // Local state for fast dragging without re-rendering parent
  const [localSubtitles, setLocalSubtitles] = useState<SubtitleCue[]>(subtitles);

  // Sync local subtitles with parent, but ONLY when not dragging
  const [dragState, setDragState] = useState<{
    type: "move" | "resize-left" | "resize-right";
    cueIndex: number;
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  useEffect(() => {
    if (!dragState) {
      setLocalSubtitles(subtitles);
    }
  }, [subtitles, dragState]);

  const [editingCueIndex, setEditingCueIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [hoveredCue, setHoveredCue] = useState<number | null>(null);

  const timelineWidth = useMemo(() => Math.max(duration * pxPerSec, 600), [duration, pxPerSec]);

  // ── Auto-scroll playhead into view ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current || dragState) return;
    const playheadX = currentTime * pxPerSec;
    const container = containerRef.current;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;

    if (playheadX < viewLeft + 40 || playheadX > viewRight - 40) {
      container.scrollLeft = playheadX - container.clientWidth / 3;
    }
  }, [currentTime, pxPerSec, dragState]);

  // ── Scroll handler ─────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollLeft(containerRef.current.scrollLeft);
    }
  }, []);

  // ── Zoom (mousewheel + ctrl) ───────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setPxPerSec((prev) => {
          const factor = e.deltaY < 0 ? 1.15 : 0.87;
          return Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, prev * factor));
        });
      }
    },
    []
  );

  // ── Click on track = seek ──────────────────────────────────────
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || dragState || editingCueIndex !== null) return;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
      const time = Math.max(0, Math.min(duration, x / pxPerSec));
      onSeek(time);
    },
    [disabled, dragState, editingCueIndex, duration, pxPerSec, onSeek]
  );

  // ── Drag handlers ──────────────────────────────────────────────
  const startDrag = useCallback(
    (e: React.MouseEvent, type: "move" | "resize-left" | "resize-right", idx: number) => {
      e.stopPropagation();
      if (disabled) return;
      const cue = localSubtitles[idx];
      setDragState({
        type,
        cueIndex: idx,
        startX: e.clientX,
        origStart: cue.startTime,
        origEnd: cue.endTime,
      });
    },
    [disabled, localSubtitles]
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dt = dx / pxPerSec;
      setLocalSubtitles((prev) => {
        const newSubs = [...prev];
        const cue = { ...newSubs[dragState.cueIndex] };

        if (dragState.type === "move") {
          const dur = dragState.origEnd - dragState.origStart;
          let newStart = snapTime(dragState.origStart + dt);
          newStart = Math.max(0, Math.min(duration - dur, newStart));
          cue.startTime = newStart;
          cue.endTime = newStart + dur;
        } else if (dragState.type === "resize-left") {
          cue.startTime = snapTime(
            Math.max(0, Math.min(dragState.origEnd - MIN_CUE_DURATION, dragState.origStart + dt))
          );
        } else if (dragState.type === "resize-right") {
          cue.endTime = snapTime(
            Math.max(dragState.origStart + MIN_CUE_DURATION, Math.min(duration, dragState.origEnd + dt))
          );
        }

        newSubs[dragState.cueIndex] = cue;
        return newSubs;
      });
    };

    const handleMouseUp = () => {
      // Flush local state to parent
      setLocalSubtitles((currentSubs) => {
        // Sort subs strictly when dragged to prevent overlap/indexing issues
        const sorted = [...currentSubs].sort((a, b) => a.startTime - b.startTime);
        
        // Re-index so they remain sequential
        const rebuilt = sorted.map((s, i) => ({ ...s, index: i + 1 }));
        
        onUpdateSubtitles(rebuilt);
        return rebuilt;
      });
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, pxPerSec, duration, onUpdateSubtitles]);

  // ── Add new subtitle ───────────────────────────────────────────
  const addSubtitle = useCallback(() => {
    const newIndex = localSubtitles.length > 0 ? Math.max(...localSubtitles.map((c) => c.index)) + 1 : 1;
    const start = snapTime(currentTime);
    const end = snapTime(Math.min(start + 2, duration));
    const newCue: SubtitleCue = {
      index: newIndex,
      startTime: start,
      endTime: end,
      text: "New subtitle",
    };
    onUpdateSubtitles([...localSubtitles, newCue].sort((a, b) => a.startTime - b.startTime));
  }, [localSubtitles, currentTime, duration, onUpdateSubtitles]);

  // ── Delete subtitle ────────────────────────────────────────────
  const deleteSubtitle = useCallback(
    (idx: number) => {
      onUpdateSubtitles(localSubtitles.filter((_, i) => i !== idx));
    },
    [localSubtitles, onUpdateSubtitles]
  );

  // ── Inline editing ─────────────────────────────────────────────
  const startEditing = useCallback(
    (idx: number) => {
      setEditingCueIndex(idx);
      setEditText(localSubtitles[idx].text);
    },
    [localSubtitles]
  );

  const commitEdit = useCallback(() => {
    if (editingCueIndex === null) return;
    const newSubs = [...localSubtitles];
    newSubs[editingCueIndex] = { ...newSubs[editingCueIndex], text: editText };
    onUpdateSubtitles(newSubs);
    setEditingCueIndex(null);
  }, [editingCueIndex, editText, localSubtitles, onUpdateSubtitles]);

  // ── Export SRT ───────────────────────────────────────────────
  const exportSRT = useCallback(() => {
    if (localSubtitles.length === 0) return;
    const srtData = serializeSRT(localSubtitles);
    const blob = new Blob([srtData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles_${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [subtitles]);

  // ── Ruler tick marks ───────────────────────────────────────────
  const rulerTicks = useMemo(() => {
    const ticks: { time: number; major: boolean }[] = [];
    // Pick interval based on zoom
    let interval = 1;
    if (pxPerSec < 30) interval = 10;
    else if (pxPerSec < 60) interval = 5;
    else if (pxPerSec < 120) interval = 2;
    else interval = 1;

    for (let t = 0; t <= duration; t += interval) {
      ticks.push({ time: t, major: true });
    }
    // Minor ticks
    const minorInterval = interval / 2;
    if (pxPerSec > 40) {
      for (let t = minorInterval; t <= duration; t += interval) {
        ticks.push({ time: t, major: false });
      }
    }
    return ticks;
  }, [duration, pxPerSec]);

  if (duration <= 0) {
    return (
      <div className="timeline-empty rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-white/30">Upload a video to use the timeline editor</p>
      </div>
    );
  }

  return (
    <div className={`timeline-editor rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.01] px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={addSubtitle}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-600/30"
            title="Add subtitle at current position"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Subtitle
          </button>
          <button
            onClick={exportSRT}
            disabled={subtitles.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download subtitles as SRT file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export SRT
          </button>
          <span className="text-[10px] tabular-nums text-white/30 font-mono pl-2 border-l border-white/10">
            {formatTimeFull(currentTime)} / {formatTimeFull(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/20">Zoom</span>
          <input
            type="range"
            min={MIN_PX_PER_SEC}
            max={MAX_PX_PER_SEC}
            value={pxPerSec}
            onChange={(e) => setPxPerSec(Number(e.target.value))}
            className="h-1 w-20 appearance-none rounded-full bg-white/10 accent-violet-500"
          />
          <span className="text-[10px] text-white/30 tabular-nums w-10 text-right">
            {subtitles.length} cues
          </span>
        </div>
      </div>

      {/* ── Scrollable timeline area ────────────────────────────── */}
      <div
        ref={containerRef}
        className="timeline-scroll relative overflow-x-auto overflow-y-hidden"
        onScroll={handleScroll}
        onWheel={handleWheel}
        style={{ cursor: dragState ? "grabbing" : "default" }}
      >
        <div style={{ width: timelineWidth, position: "relative" }}>
          {/* ── Ruler ───────────────────────────────────────────── */}
          <div className="timeline-ruler sticky top-0 z-20 border-b border-white/5 bg-[#0d0d1a]/90 backdrop-blur-sm" style={{ height: RULER_HEIGHT }}>
            {rulerTicks.map((tick, i) => (
              <div
                key={i}
                className="absolute top-0"
                style={{ left: tick.time * pxPerSec }}
              >
                <div
                  className={`${tick.major ? "h-3 bg-white/20" : "h-2 bg-white/8"}`}
                  style={{ width: 1 }}
                />
                {tick.major && (
                  <span className="absolute top-3 -translate-x-1/2 text-[9px] tabular-nums text-white/25 select-none">
                    {formatTimeRuler(tick.time)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ── Waveform placeholder (visual bg) ────────────────── */}
          <div
            className="absolute left-0 right-0 pointer-events-none opacity-30"
            style={{ top: RULER_HEIGHT, height: WAVEFORM_HEIGHT }}
          >
            <svg width="100%" height="100%" preserveAspectRatio="none" className="text-violet-500/30">
              <defs>
                <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Simulated waveform bars */}
              {Array.from({ length: Math.floor(timelineWidth / 3) }).map((_, i) => {
                const h = 5 + Math.random() * (WAVEFORM_HEIGHT - 10);
                return (
                  <rect
                    key={i}
                    x={i * 3}
                    y={(WAVEFORM_HEIGHT - h) / 2}
                    width={2}
                    height={h}
                    fill="url(#waveGrad)"
                    rx={1}
                  />
                );
              })}
            </svg>
          </div>

          {/* ── Subtitle track ──────────────────────────────────── */}
          <div
            ref={trackRef}
            className="relative"
            style={{ height: TRACK_HEIGHT + WAVEFORM_HEIGHT + 16, paddingTop: RULER_HEIGHT + WAVEFORM_HEIGHT }}
            onClick={handleTrackClick}
          >
            {localSubtitles.map((cue, idx) => {
              const left = cue.startTime * pxPerSec;
              const width = Math.max((cue.endTime - cue.startTime) * pxPerSec, 8);
              const color = CUE_COLORS[idx % CUE_COLORS.length];
              const isEditing = editingCueIndex === idx;
              const isHovered = hoveredCue === idx;

              return (
                <div
                  key={cue.index}
                  className={`absolute rounded-md border transition-all duration-100 group select-none
                    ${isEditing ? "border-violet-400 ring-1 ring-violet-400/30 z-10" : "border-white/10 hover:border-white/25"}
                    ${dragState?.cueIndex === idx ? "z-20 shadow-lg shadow-violet-500/20" : ""}
                  `}
                  style={{
                    left,
                    width,
                    top: 4,
                    height: TRACK_HEIGHT - 8,
                    background: color,
                    backdropFilter: "blur(4px)",
                  }}
                  onMouseEnter={() => setHoveredCue(idx)}
                  onMouseLeave={() => setHoveredCue(null)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEditing(idx);
                  }}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 rounded-l-md"
                    onMouseDown={(e) => startDrag(e, "resize-left", idx)}
                  />

                  {/* Center drag area */}
                  <div
                    className="absolute inset-0 mx-2 cursor-grab active:cursor-grabbing flex items-center overflow-hidden"
                    onMouseDown={(e) => startDrag(e, "move", idx)}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") setEditingCueIndex(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full bg-transparent text-[10px] text-white font-medium outline-none px-1"
                      />
                    ) : (
                      <span className="text-[10px] text-white/90 font-medium truncate px-1 leading-tight">
                        {cue.text}
                      </span>
                    )}
                  </div>

                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 rounded-r-md"
                    onMouseDown={(e) => startDrag(e, "resize-right", idx)}
                  />

                  {/* Delete button */}
                  {isHovered && !isEditing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSubtitle(idx);
                      }}
                      className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[8px] shadow-md transition-transform hover:scale-110 z-30"
                    >
                      ✕
                    </button>
                  )}

                  {/* Timing tooltip */}
                  {(isHovered || dragState?.cueIndex === idx) && !isEditing && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[8px] tabular-nums text-white/70 z-30 backdrop-blur-sm">
                      {formatTimeFull(cue.startTime)} → {formatTimeFull(cue.endTime)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Playhead ──────────────────────────────────────── */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{ left: currentTime * pxPerSec }}
            >
              {/* Playhead marker triangle */}
              <div className="absolute -top-[2px] -translate-x-1/2">
                <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500" />
              </div>
              <div className="absolute top-0 bottom-0 w-[1.5px] -translate-x-1/2 bg-red-500/80" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Help text ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.01] px-4 py-1.5">
        <div className="flex items-center gap-4 text-[9px] text-white/20">
          <span>Click track to seek</span>
          <span>Drag edges to resize</span>
          <span>Double-click to edit text</span>
          <span>Ctrl+Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
}
