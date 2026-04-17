"use client";

import React from "react";

export function Header() {
  return (
    <header className="relative z-10 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3">

          <div>
            <h1 className="bg-gradient-to-r from-white via-violet-200 to-fuchsia-200 bg-clip-text text-lg sm:text-xl font-bold tracking-tight text-transparent">
              SubVideo
            </h1>
            <p className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
              Subtitle Burner
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Client-side processing
          </div>
        </div>
      </div>
    </header>
  );
}
