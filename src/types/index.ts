export interface SubtitleCue {
  index: number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

export interface SubtitleStyle {
  fontSize: number;       // 16-72
  fontColor: string;      // hex color e.g. "#ffffff"
  bgEnabled: boolean;
  bgColor: string;        // hex color e.g. "#000000"
  bgOpacity: number;      // 0-100
  positionY: number;      // 0-100 (percentage from top, 90 = near bottom)
  paddingX: number;       // Horizontal padding
  paddingY: number;       // Vertical padding
  maxWidth: number;       // Percentage (10-100) Max line length
  fontFamily: string;     // Google Font Family
}

export const AVAILABLE_FONTS = [
  "Poppins",
  "Roboto",
  "Montserrat",
  "Inter",
  "Bebas Neue",
  "EB Garamond",
  "Tinos",
  "Amiri",
  "Cairo"
];

export interface ExportState {
  status: "idle" | "loading" | "processing" | "done" | "error";
  progress: number;       // 0-100
  downloadUrl: string | null;
  error: string | null;
  fileSize: number | null; // bytes
}

export const DEFAULT_STYLE: SubtitleStyle = {
  fontSize: 28,
  fontColor: "#ffffff",
  bgEnabled: true,
  bgColor: "#000000",
  bgOpacity: 60,
  positionY: 88,
  paddingX: 16,
  paddingY: 4,
  maxWidth: 85,
  fontFamily: "Poppins",
};
