import { SubtitleCue, SubtitleStyle } from "@/types";

/**
 * Convert a hex color like "#RRGGBB" to ASS color format "&HAABBGGRR"
 * ASS uses AABBGGRR with alpha 00 = opaque, FF = transparent.
 */
function hexToASS(hex: string, alpha: number = 0): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  const a = Math.round((1 - alpha / 100) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `&H${a}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
}

/**
 * Format seconds to ASS timestamp "H:MM:SS.cc" (centiseconds)
 */
function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Generate a complete .ass file from subtitle cues and styling options.
 * Uses Poppins as the font family.
 */
export function generateASS(
  cues: SubtitleCue[],
  style: SubtitleStyle,
  videoWidth: number = 1920,
  videoHeight: number = 1080
): string {
  const primaryColor = hexToASS(style.fontColor, 0);
  const outlineColor = "&H40000000"; // semi-transparent black outline
  const shadowColor = "&H40000000";

  // Background: use BorderStyle 3 (opaque box) when bg is enabled
  const bgAlpha = style.bgEnabled ? style.bgOpacity : 0;
  const backColor = hexToASS(style.bgColor, bgAlpha);
  const borderStyle = style.bgEnabled ? 3 : 1;
  
  // Background box padding uses Outline in ASS
  // ASS doesn't support independent X/Y padding natively, so we average it
  const outline = style.bgEnabled ? Math.round((style.paddingX + style.paddingY) * 0.7) : 2;

  // MarginV: convert positionY percentage to pixel margin from bottom
  // positionY 90 = 10% from bottom = 0.1 * videoHeight
  const marginV = Math.round(((100 - style.positionY) / 100) * videoHeight);

  // Margin L/R: derived from maxWidth. If maxWidth is 80%, margin is 10% on each side
  const marginLR = Math.round((videoWidth * (100 - style.maxWidth) / 100) / 2);

  const scriptInfo = `[Script Info]
Title: SubVideo Export
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
`;

  const styles = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${style.fontSize},${primaryColor},&H000000FF,${outlineColor},${backColor},0,0,0,0,100,100,0,0,${borderStyle},${outline},0,2,${marginLR},${marginLR},${marginV},1
`;

  const events = `[Fonts]

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${cues
  .map((cue) => {
    // Replace newlines in text with \N for ASS line breaks
    const text = cue.text.replace(/\n/g, "\\N");
    return `Dialogue: 0,${formatASSTime(cue.startTime)},${formatASSTime(cue.endTime)},Default,,0,0,0,,${text}`;
  })
  .join("\n")}
`;

  return scriptInfo + "\n" + styles + "\n" + events;
}
