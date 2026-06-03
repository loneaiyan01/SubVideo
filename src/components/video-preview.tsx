"use client";

import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { SubtitleCue, SubtitleStyle, AspectRatioOption, ASPECT_RATIO_MAP } from "@/types";
import { getActiveCue } from "@/lib/srt-parser";

export interface VideoPreviewHandle {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
}

interface VideoPreviewProps {
  videoFile: File | null;
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  aspectRatio: AspectRatioOption;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onActiveCueChange?: (index: number | null) => void;
}



export const VideoPreview = forwardRef<VideoPreviewHandle, VideoPreviewProps>(
  function VideoPreview({ videoFile, subtitles, style, aspectRatio, onActiveCueChange }: VideoPreviewProps, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastActiveCueIndexRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
          const active = getActiveCue(subtitles, time);
          setActiveCue(active);
          
          const currentIdx = active ? active.index : null;
          if (currentIdx !== lastActiveCueIndexRef.current) {
            lastActiveCueIndexRef.current = currentIdx;
            onActiveCueChange?.(currentIdx);
          }
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime ?? 0;
      },
    }));

    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);

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

    // Synchronize playback rate
    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
      }
    }, [playbackRate, videoUrl]);

    // Sync fullscreen state
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(document.fullscreenElement === containerRef.current);
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      };
    }, []);

    // Track current time and find active subtitle
    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);
        const cue = getActiveCue(subtitles, time);
        setActiveCue(cue);
        
        const currentIdx = cue ? cue.index : null;
        if (currentIdx !== lastActiveCueIndexRef.current) {
          lastActiveCueIndexRef.current = currentIdx;
          onActiveCueChange?.(currentIdx);
        }
      }
    }, [subtitles, onActiveCueChange]);

    const handleLoadedMetadata = useCallback(() => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
        videoRef.current.playbackRate = playbackRate;
      }
    }, [playbackRate]);

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

    const toggleFullscreen = useCallback(() => {
      if (!containerRef.current) return;

      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen().catch((err) => {
          console.error(`Error attempting to exit fullscreen: ${err.message}`);
        });
      }
    }, []);

    const handleMouseMove = useCallback(() => {
      if (!isFullscreen) {
        setShowControls(true);
        return;
      }
      // Throttle: if a hide-timeout is already scheduled, controls are
      // already visible — skip the re-render and let the timer run.
      if (controlsTimeoutRef.current) return;

      setShowControls(true);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        controlsTimeoutRef.current = null;
      }, 2000);
    }, [isFullscreen]);

    useEffect(() => {
      if (isFullscreen) {
        window.addEventListener("mousemove", handleMouseMove);
        handleMouseMove();
      } else {
        window.removeEventListener("mousemove", handleMouseMove);
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      }
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      };
    }, [isFullscreen, handleMouseMove]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (!videoRef.current || !videoUrl) return;

        // Skip if user is typing in inputs or textareas
        const active = document.activeElement as HTMLElement | null;
        if (
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable)
        ) {
          return;
        }

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
        }
      },
      [duration, videoUrl]
    );

    useEffect(() => {
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [handleKeyDown]);

    const formatTime = (t: number) => {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${m}:${String(s).padStart(2, "0")}`;
    };

    // ── Aspect ratio crop overlay calculation ────────────────────
    const targetRatio = ASPECT_RATIO_MAP[aspectRatio];
    const containerRatio = 16 / 9;
    let topOffset = 0;
    let visibleHeight = 100;

    if (targetRatio && targetRatio > containerRatio) {
      // Target is wider than 16:9 — black bars top/bottom
      visibleHeight = (containerRatio / targetRatio) * 100;
      topOffset = (100 - visibleHeight) / 2;
    }

    const actualTop = topOffset + (style.positionY / 100) * visibleHeight;
    const showCropOverlay = targetRatio !== null && videoRef.current;

    // Subtitle overlay style
    const overlayStyle: React.CSSProperties = {
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      top: `${actualTop}%`,
      fontSize: `${(style.fontSize / 1080) * 100}cqh`,
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
      transition: "all 0.1s ease",
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
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className={`flex flex-col overflow-hidden bg-black/40 rounded-xl border border-white/5 transition-all duration-300 ${
          isFullscreen
            ? "fixed inset-0 z-50 w-screen h-screen bg-black rounded-none border-none"
            : "h-full"
        } ${isFullscreen && !showControls ? "cursor-none" : ""}`}
      >
        {/* Video container */}
        <div
          style={{ containerType: "size" }}
          className={`relative bg-black mx-auto overflow-hidden transition-all duration-300 ${
            isFullscreen
              ? "flex-1 w-full max-h-none flex items-center justify-center"
              : "aspect-video w-full max-h-[500px]"
          }`}
        >
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
            className={`absolute inset-0 flex items-center justify-center bg-transparent transition-all group ${
              isFullscreen && !showControls ? "pointer-events-none" : ""
            }`}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm
                transition-all duration-200 ${
                  isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                } ${isFullscreen && !showControls ? "hidden" : ""}`}
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
            <div
              className={`absolute top-3 right-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white/70 backdrop-blur-sm border border-white/10 transition-opacity duration-300 ${
                isFullscreen && !showControls ? "opacity-0" : "opacity-100"
              }`}
            >
              {aspectRatio}
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div
          className={`flex items-center gap-1.5 sm:gap-3 border-t border-white/5 bg-white/[0.02] px-2 py-2 sm:px-4 sm:py-2.5 transition-all duration-300 ${
            isFullscreen && !showControls
              ? "opacity-0 translate-y-2 pointer-events-none"
              : "opacity-100 translate-y-0"
          }`}
        >
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

          <span className="shrink-0 text-[10px] sm:text-xs tabular-nums text-white/40">
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
            {/* Only render subtitle markers for manageable cue counts to avoid DOM thrash */}
            {subtitles.length <= 200 && subtitles.map((cue) => (
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

          <span className="shrink-0 text-[10px] sm:text-xs tabular-nums text-white/40">
            {formatTime(duration)}
          </span>

          {/* Playback speed selector */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-0.5 sm:gap-1 rounded-lg bg-white/5 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white border border-white/10"
              aria-label="Playback speed"
            >
              <span>{playbackRate.toFixed(1)}x</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-200 ${showSpeedMenu ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {showSpeedMenu && (
              <>
                {/* Backdrop click blocker to close the menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSpeedMenu(false)}
                />
                <div className="absolute bottom-full right-0 mb-2 w-20 rounded-lg border border-white/10 bg-zinc-950/95 backdrop-blur-md p-1 shadow-xl z-20 flex flex-col gap-0.5">
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => {
                        setPlaybackRate(rate);
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full text-left rounded-md px-2 py-1 text-xs transition-colors ${
                        playbackRate === rate
                          ? "bg-violet-600 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {rate.toFixed(2).replace(/\.00$/, "")}x
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="shrink-0 text-white/60 transition-colors hover:text-white p-1 rounded-lg hover:bg-white/5"
            aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
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
