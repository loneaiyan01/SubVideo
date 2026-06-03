import { describe, it, expect } from "vitest";
import { parseSRT, getActiveCue } from "../srt-parser";
import { SubtitleCue } from "@/types";

// ── parseSRT ──────────────────────────────────────────────────────────

describe("parseSRT", () => {
  it("parses a well-formed SRT string", () => {
    const srt = `1
00:00:01,000 --> 00:00:03,500
Hello world

2
00:00:04,000 --> 00:00:06,000
Second line
`;
    const cues = parseSRT(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({
      index: 1,
      startTime: 1.0,
      endTime: 3.5,
      text: "Hello world",
    });
    expect(cues[1]).toMatchObject({
      index: 2,
      startTime: 4.0,
      endTime: 6.0,
      text: "Second line",
    });
  });

  it("handles multi-line subtitle text", () => {
    const srt = `1
00:00:00,000 --> 00:00:02,000
Line one
Line two
`;
    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Line one\nLine two");
  });

  it("returns empty array for empty input", () => {
    expect(parseSRT("")).toEqual([]);
  });

  it("returns empty array for garbage input", () => {
    expect(parseSRT("not a valid srt file at all")).toEqual([]);
  });

  it("handles Windows-style CRLF line endings", () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n\r\n";
    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello");
  });

  it("parses timestamps with hours correctly", () => {
    const srt = `1
01:30:00,500 --> 01:30:05,250
Long video subtitle
`;
    const cues = parseSRT(srt);
    expect(cues[0].startTime).toBeCloseTo(5400.5);
    expect(cues[0].endTime).toBeCloseTo(5405.25);
  });
});

// ── getActiveCue ──────────────────────────────────────────────────────

describe("getActiveCue", () => {
  const cues: SubtitleCue[] = [
    { index: 1, startTime: 1.0, endTime: 3.0, text: "First" },
    { index: 2, startTime: 5.0, endTime: 7.0, text: "Second" },
    { index: 3, startTime: 10.0, endTime: 12.0, text: "Third" },
  ];

  it("returns null for empty cue array", () => {
    expect(getActiveCue([], 5.0)).toBeNull();
  });

  it("returns null when time is before all cues", () => {
    expect(getActiveCue(cues, 0.5)).toBeNull();
  });

  it("returns null when time is between cues (gap)", () => {
    expect(getActiveCue(cues, 4.0)).toBeNull();
  });

  it("returns null when time is after all cues", () => {
    expect(getActiveCue(cues, 15.0)).toBeNull();
  });

  it("returns correct cue at start boundary", () => {
    const result = getActiveCue(cues, 1.0);
    expect(result?.text).toBe("First");
  });

  it("returns correct cue at end boundary", () => {
    const result = getActiveCue(cues, 3.0);
    expect(result?.text).toBe("First");
  });

  it("returns correct cue in the middle of range", () => {
    const result = getActiveCue(cues, 6.0);
    expect(result?.text).toBe("Second");
  });

  it("returns the last cue when time is within it", () => {
    const result = getActiveCue(cues, 11.0);
    expect(result?.text).toBe("Third");
  });
});
