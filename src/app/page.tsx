"use client";

import React, { useState, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { UploadZone } from "@/components/upload-zone";
import { VideoPreview, VideoPreviewHandle } from "@/components/video-preview";
import { StyleControls } from "@/components/style-controls";
import { ExportPanel } from "@/components/export-panel";
import { BatchPanel } from "@/components/batch-panel";
import { SubtitleEditor } from "@/components/subtitle-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SubtitleCue,
  SubtitleStyle,
  ExportSettings,
  DEFAULT_STYLE,
  DEFAULT_EXPORT_SETTINGS,
} from "@/types";
import { parseSRT } from "@/lib/srt-parser";

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);



  const handleVideoUpload = useCallback((file: File) => {
    setVideoFile(file);
  }, []);

  const handleSrtUpload = useCallback(async (file: File) => {
    setSrtFile(file);
    const text = await file.text();
    const parsed = parseSRT(text);
    setSubtitles(parsed);
  }, []);

  const handleVideoRemove = useCallback(() => {
    setVideoFile(null);
  }, []);

  const handleSrtRemove = useCallback(() => {
    setSrtFile(null);
    setSubtitles([]);
  }, []);

  const hasFiles = videoFile !== null || srtFile !== null;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-[500px] w-[600px] rounded-full bg-violet-600/[0.04] blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[500px] rounded-full bg-fuchsia-600/[0.03] blur-[100px]" />
      </div>

      <Header />

      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 sm:gap-6 p-3.5 sm:p-6 overflow-x-hidden">
        {/* ── Upload section ─────────────────────────────────────── */}
        <section>
          <UploadZone
            videoFile={videoFile}
            srtFile={srtFile}
            onVideoUpload={handleVideoUpload}
            onSrtUpload={handleSrtUpload}
            onVideoRemove={handleVideoRemove}
            onSrtRemove={handleSrtRemove}
            disabled={isProcessing}
          />
        </section>

        {/* ── Main content area ──────────────────────────────────── */}
        {hasFiles && (
          <>
            <section className={`flex flex-1 flex-col gap-6 ${isSidebarOpen ? 'lg:flex-row' : 'lg:flex-col'}`}>
              {/* Video Preview - takes 70% on desktop */}
              <div className="flex-1 lg:flex-[7]">
                <div className="sticky top-6">
                  <VideoPreview
                    videoFile={videoFile}
                    subtitles={subtitles}
                    style={style}
                    aspectRatio={exportSettings.aspectRatio}
                  />
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
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
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
                  <div className="sticky top-6 space-y-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-sm">
                    <Tabs defaultValue="subtitles" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5 p-1 rounded-lg">
                        <TabsTrigger value="subtitles" className="rounded-md text-[11px] data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                          Subtitles
                        </TabsTrigger>
                        <TabsTrigger value="editor" className="rounded-md text-[11px] data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                          Editor Tools
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="subtitles" className="mt-0">
                        <SubtitleEditor
                          subtitles={subtitles}
                          onUpdateSubtitles={setSubtitles}
                          disabled={isProcessing}
                        />
                      </TabsContent>

                      <TabsContent value="editor" className="mt-0">
                        <Tabs defaultValue="styles" className="w-full">
                          <TabsList className="grid w-full grid-cols-3 mb-6 bg-white/5 p-1 rounded-lg">
                            <TabsTrigger value="styles" className="rounded-md text-[11px] data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                              Styling
                            </TabsTrigger>
                            <TabsTrigger value="export" className="rounded-md text-[11px] data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                              Export
                            </TabsTrigger>
                            <TabsTrigger value="batch" className="rounded-md text-[11px] data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                              Batch
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="styles" className="mt-0">
                            <StyleControls
                              style={style}
                              onStyleChange={setStyle}
                              disabled={isProcessing}
                            />
                          </TabsContent>

                          <TabsContent value="export" className="mt-0">
                            <ExportPanel
                              videoFile={videoFile}
                              subtitles={subtitles}
                              style={style}
                              exportSettings={exportSettings}
                              onExportSettingsChange={setExportSettings}
                              disabled={isProcessing}
                            />
                          </TabsContent>

                          <TabsContent value="batch" className="mt-0">
                            <BatchPanel
                              subtitles={subtitles}
                              style={style}
                              exportSettings={exportSettings}
                              disabled={isProcessing}
                            />
                          </TabsContent>
                        </Tabs>
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
          <div className="flex flex-1 items-center justify-center py-20">
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
