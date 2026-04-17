import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SubVideo — Burn Subtitles Into Video",
  description:
    "Upload a video and SRT file, customize subtitle styling, and export with subtitles permanently burned in. All processing happens in your browser.",
  keywords: ["subtitle", "video", "burn", "srt", "wasm", "ffmpeg", "editor"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0a0a12]">
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "rgba(20, 20, 35, 0.95)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </body>
    </html>
  );
}
