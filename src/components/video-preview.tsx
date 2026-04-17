"use client";

import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { SubtitleCue, SubtitleStyle, AspectRatioOption, ASPECT_RATIO_MAP } from "@/types";
import { getActiveCue } from "@/lib/srt-parser";

interface VideoPreviewProps {
  videoFile: File | null;
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  aspectRatio: AspectRatioOption;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

export interface VideoPreviewHandle {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const VideoPreview = forwardRef<VideoPreviewHandle, VideoPreviewProps>(
  function VideoPreview(
    { videoFile, subtitles, style, aspectRatio, onTimeUpdate, onDurationChange },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Format font name for Google Fonts API
    const googleFontName = style.fontFamily.replace(/\s+/g, "+");
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Expose imperative methods to parent
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      getDuration: () => videoRef.current?.duration ?? 0,
    }));

    // Create object URL for video
    useEffect(() => {
      if (videoFile) {
        const url = URL.createObjectURL(videoFile);
        setVideoUrl(url);
        return () => URL.revokeObjectURL(url);
      } else {
        setVideoUrl(null);
      }
    }, [videoFile]);

    // Track current time and find active subtitle
    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);
        setActiveCue(getActiveCue(subtitles, time));
        onTimeUpdate?.(time);
      }
    }, [subtitles, onTimeUpdate]);

    const handleLoadedMetadata = useCallback(() => {
      if (videoRef.current) {
        const dur = videoRef.current.duration;
        setDuration(dur);
        onDurationChange?.(dur);
      }
    }, [onDurationChange]);

    const togglePlay = useCallback(() => {
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play();
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    }, []);

    const handleSeek = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (videoRef.current && duration > 0) {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pct = x / rect.width;
          videoRef.current.currentTime = pct * duration;
        }
      },
      [duration]
    );

    const formatTime = (t: number) => {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${m}:${String(s).padStart(2, "0")}`;
    };

    // ── Aspect ratio crop overlay calculation ────────────────────
    const targetRatio = ASPECT_RATIO_MAP[aspectRatio];
    const showCropOverlay = targetRatio !== null && videoRef.current;

    // Subtitle overlay style
    const overlayStyle: React.CSSProperties = {
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      top: `${style.positionY}%`,
      fontSize: `${style.fontSize}px`,
      color: style.fontColor,
      fontFamily: `"${style.fontFamily}", sans-serif`,
      fontWeight: 700,
      textAlign: "center",
      padding: style.bgEnabled ? `${style.paddingY}px ${style.paddingX}px` : "0",
      borderRadius: style.bgEnabled ? "6px" : "0",
      backgroundColor: style.bgEnabled
        ? `${style.bgColor}${Math.round((style.bgOpacity / 100) * 255)
            .toString(16)
            .padStart(2, "0")}`
        : "transparent",
      textShadow: !style.bgEnabled
        ? "0 2px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)"
        : "none",
      width: `${style.maxWidth}%`,
      lineHeight: 1.3,
      whiteSpace: "pre-line",
      pointerEvents: "none",
      zIndex: 10,
      transition: "all 0.15s ease",
    };

    if (!videoUrl) {
      return (
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="flex flex-col items-center gap-3 text-white/20">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <p className="text-sm">Upload a video to preview</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-hidden bg-black/40 rounded-xl border border-white/5">
        {/* Inject dynamic Google Font */}
        <link
          href={`https://fonts.googleapis.com/css2?family=${googleFontName}:wght@400;700&display=swap`}
          rel="stylesheet"
        />
        {/* Video container */}
        <div className="relative aspect-video w-full bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            className="h-full w-full object-contain"
            playsInline
            crossOrigin="anonymous"
          />

          {/* ── Aspect ratio crop overlay ───────────────────────── */}
          {showCropOverlay && targetRatio && (
            <CropOverlay ratio={targetRatio} />
          )}

          {/* Subtitle overlay */}
          {activeCue && (
            <div style={overlayStyle}>
              {activeCue.text}
            </div>
          )}

          {/* Play/pause overlay */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-transparent transition-all group"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm
                transition-all duration-200 ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
              )}
            </div>
          </button>

          {/* Aspect ratio badge */}
          {aspectRatio !== "original" && (
            <div className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white/70 backdrop-blur-sm border border-white/10">
              {aspectRatio}
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div className="flex items-center gap-3 border-t border-white/5 bg-white/[0.02] px-4 py-2.5">
          <button
            onClick={togglePlay}
            className="shrink-0 text-white/60 transition-colors hover:text-white"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            )}
          </button>

          <span className="shrink-0 text-xs tabular-nums text-white/40">
            {formatTime(currentTime)}
          </span>

          {/* Seek bar */}
          <div
            className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/10 group"
            onClick={handleSeek}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
              style={{
                width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
              }}
            />
            {/* Subtitle markers */}
            {subtitles.map((cue) => (
              <div
                key={cue.index}
                className="absolute top-full mt-0.5 h-0.5 rounded-full bg-violet-400/40"
                style={{
                  left: duration > 0 ? `${(cue.startTime / duration) * 100}%` : "0%",
                  width:
                    duration > 0
                      ? `${((cue.endTime - cue.startTime) / duration) * 100}%`
                      : "0%",
                }}
              />
            ))}
          </div>

          <span className="shrink-0 text-xs tabular-nums text-white/40">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    );
  }
);

// ── Crop overlay component ───────────────────────────────────────────
function CropOverlay({ ratio }: { ratio: number }) {
  // Renders dark bars over the areas that will be cropped
  // The video container is aspect-video (16:9 = 1.778)
  const containerRatio = 16 / 9;

  if (ratio > containerRatio) {
    // Target is wider than container — crop top/bottom
    const visibleHeight = (containerRatio / ratio) * 100;
    const barHeight = (100 - visibleHeight) / 2;
    return (
      <>
        <div
          className="absolute left-0 right-0 top-0 bg-black/70 pointer-events-none z-5 transition-all duration-300"
          style={{ height: `${barHeight}%` }}
        />
        <div
          className="absolute left-0 right-0 bottom-0 bg-black/70 pointer-events-none z-5 transition-all duration-300"
          style={{ height: `${barHeight}%` }}
        />
        {/* Border lines showing crop area */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-white/20 pointer-events-none z-5"
          style={{ top: `${barHeight}%` }}
        />
        <div
          className="absolute left-0 right-0 border-b border-dashed border-white/20 pointer-events-none z-5"
          style={{ bottom: `${barHeight}%` }}
        />
      </>
    );
  } else {
    // Target is taller than container — crop left/right
    const visibleWidth = (ratio / containerRatio) * 100;
    const barWidth = (100 - visibleWidth) / 2;
    return (
      <>
        <div
          className="absolute left-0 top-0 bottom-0 bg-black/70 pointer-events-none z-5 transition-all duration-300"
          style={{ width: `${barWidth}%` }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 bg-black/70 pointer-events-none z-5 transition-all duration-300"
          style={{ width: `${barWidth}%` }}
        />
        {/* Border lines */}
        <div
          className="absolute top-0 bottom-0 border-l border-dashed border-white/20 pointer-events-none z-5"
          style={{ left: `${barWidth}%` }}
        />
        <div
          className="absolute top-0 bottom-0 border-r border-dashed border-white/20 pointer-events-none z-5"
          style={{ right: `${barWidth}%` }}
        />
      </>
    );
  }
}
