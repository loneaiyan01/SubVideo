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
 */
export function getActiveCue(
  cues: SubtitleCue[],
  currentTime: number
): SubtitleCue | null {
  for (const cue of cues) {
    if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
      return cue;
    }
  }
  return null;
}
