import { SubtitleCue } from "@/types";

/**
 * Parse a timestamp string like "00:01:23,456" into seconds.
 */
function parseTimestamp(ts: string): number {
  const match = ts.trim().match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return 0;
  const [, hours, minutes, seconds, millis] = match;
  return (
    parseInt(hours, 10) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseInt(seconds, 10) +
    parseInt(millis, 10) / 1000
  );
}

/**
 * Parse an SRT file content string into an array of SubtitleCue objects.
 */
export function parseSRT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];

  // Normalize line endings and split by double newlines (block separator)
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const indexLine = lines[0].trim();
    const timeLine = lines[1].trim();
    const textLines = lines.slice(2);

    const index = parseInt(indexLine, 10);
    if (isNaN(index)) continue;

    // Parse timestamp line: "00:00:01,000 --> 00:00:04,000"
    const timeMatch = timeLine.match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!timeMatch) continue;

    const startTime = parseTimestamp(timeMatch[1]);
    const endTime = parseTimestamp(timeMatch[2]);

    // Join text lines, strip HTML tags
    const text = textLines
      .join("\n")
      .replace(/<[^>]*>/g, "")
      .trim();

    if (text) {
      cues.push({ index, startTime, endTime, text });
    }
  }

  return cues;
}

/**
 * Find the active subtitle cue for a given time in seconds.
 * Uses binary search for O(log n) performance — important since this
 * is called ~60 times/sec during playback and every frame during export.
 */
export function getActiveCue(
  cues: SubtitleCue[],
  currentTime: number
): SubtitleCue | null {
  if (cues.length === 0) return null;

  // Binary search for the last cue whose startTime <= currentTime
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (cues[mid].startTime <= currentTime) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Check if the found cue's time range includes currentTime
  if (high >= 0 && currentTime >= cues[high].startTime && currentTime <= cues[high].endTime) {
    return cues[high];
  }

  return null;
}

/**
 * Format timestamp in seconds back to SRT format "HH:MM:SS,mmm".
 */
export function formatSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Serialize an array of SubtitleCue objects back into an SRT string.
 */
export function serializeSRT(cues: SubtitleCue[]): string {
  return cues
    .map((cue, i) => {
      const index = i + 1; // force sequential index
      const start = formatSrtTimestamp(cue.startTime);
      const end = formatSrtTimestamp(cue.endTime);
      return `${index}\n${start} --> ${end}\n${cue.text}`;
    })
    .join("\n\n") + "\n";
}
