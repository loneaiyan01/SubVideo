"use client";

import React from "react";
import { SubtitleStyle, AVAILABLE_FONTS } from "@/types";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface StyleControlsProps {
  style: SubtitleStyle;
  onStyleChange: (style: SubtitleStyle) => void;
  disabled?: boolean;
}

export function StyleControls({
  style,
  onStyleChange,
  disabled,
}: StyleControlsProps) {
  const update = (partial: Partial<SubtitleStyle>) => {
    onStyleChange({ ...style, ...partial });
  };

  return (
    <div
      className={`space-y-6 ${disabled ? "pointer-events-none opacity-50" : ""}`}
      id="style-controls"
    >
      {/* Section header */}
      <div>
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-violet-400"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Subtitle Styling
        </h2>
        <p className="mt-1 text-xs text-white/30">
          Customize how your subtitles look
        </p>
      </div>

      <Separator className="bg-white/5" />

      {/* Font Selection */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-white/60">Typography (Font)</Label>
        <div className="relative">
          <select
            value={style.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value })}
            className="w-full appearance-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 cursor-pointer"
            disabled={disabled}
          >
            {AVAILABLE_FONTS.map(font => (
              <option key={font} value={font} className="bg-zinc-900">{font}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white/50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-white/60">Font Size</Label>
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs tabular-nums text-white/50">
            {style.fontSize}px
          </span>
        </div>
        <Slider
          value={[style.fontSize]}
          onValueChange={(val) => update({ fontSize: Array.isArray(val) ? val[0] : val })}
          min={16}
          max={72}
          step={1}
          className="w-full"
        />
      </div>

      {/* Font Color */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-white/60">Font Color</Label>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="color"
              value={style.fontColor}
              onChange={(e) => update({ fontColor: e.target.value })}
              className="h-9 w-9 cursor-pointer appearance-none rounded-lg border border-white/10 bg-transparent p-0.5"
            />
          </div>
          <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-mono text-white/40 uppercase">
            {style.fontColor}
          </span>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* Background Toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-medium text-white/60">
              Background Box
            </Label>
            <p className="text-[10px] text-white/25">
              Add a background behind text
            </p>
          </div>
          <Switch
            checked={style.bgEnabled}
            onCheckedChange={(checked) => update({ bgEnabled: checked })}
          />
        </div>

        {style.bgEnabled && (
          <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            {/* Background Color */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/50">Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={style.bgColor}
                  onChange={(e) => update({ bgColor: e.target.value })}
                  className="h-8 w-8 cursor-pointer appearance-none rounded-lg border border-white/10 bg-transparent p-0.5"
                />
                <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-mono text-white/40 uppercase">
                  {style.bgColor}
                </span>
              </div>
            </div>

            {/* Background Opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-white/50">
                  Opacity
                </Label>
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs tabular-nums text-white/40">
                  {style.bgOpacity}%
                </span>
              </div>
              <Slider
                value={[style.bgOpacity]}
                onValueChange={(val) => update({ bgOpacity: Array.isArray(val) ? val[0] : val })}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <Separator className="bg-white/5 my-2" />

            {/* Horizontal Padding */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-white/50">Padding X (Horizontal)</Label>
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs tabular-nums text-white/40">
                  {style.paddingX}px
                </span>
              </div>
              <Slider
                value={[style.paddingX]}
                onValueChange={(val) => update({ paddingX: Array.isArray(val) ? val[0] : val })}
                min={0}
                max={60}
                step={2}
              />
            </div>

            {/* Vertical Padding */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-white/50">Padding Y (Vertical)</Label>
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs tabular-nums text-white/40">
                  {style.paddingY}px
                </span>
              </div>
              <Slider
                value={[style.paddingY]}
                onValueChange={(val) => update({ paddingY: Array.isArray(val) ? val[0] : val })}
                min={0}
                max={40}
                step={2}
              />
            </div>
          </div>
        )}
      </div>

      <Separator className="bg-white/5" />

      {/* Vertical Position */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-medium text-white/60">
              Vertical Position
            </Label>
            <p className="text-[10px] text-white/25">
              Where subtitles sit on screen
            </p>
          </div>
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs tabular-nums text-white/50">
            {style.positionY}%
          </span>
        </div>
        <Slider
          value={[style.positionY]}
          onValueChange={(val) => update({ positionY: Array.isArray(val) ? val[0] : val })}
          min={10}
          max={95}
          step={1}
        />
        <div className="flex justify-between text-[10px] text-white/20">
          <span>Top</span>
          <span>Bottom</span>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* Max Width (Line Length) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-medium text-white/60">
              Horizontal Box Width
            </Label>
            <p className="text-[10px] text-white/25">
              Stretches the box border to border
            </p>
          </div>
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs tabular-nums text-white/50">
            {style.maxWidth}%
          </span>
        </div>
        <Slider
          value={[style.maxWidth]}
          onValueChange={(val) => update({ maxWidth: Array.isArray(val) ? val[0] : val })}
          min={10}
          max={100}
          step={1}
        />
        <div className="flex justify-between text-[10px] text-white/20">
          <span>Squeezed</span>
          <span>Wide</span>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* Preview indicator */}
      <div className="rounded-xl bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 border border-violet-500/10 p-3">
        <p className="text-[11px] text-white/40 text-center">
          ✨ Changes apply to the preview in real-time
        </p>
      </div>
    </div>
  );
}
