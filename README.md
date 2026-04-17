# SubVideo — Professional Client-Side Subtitle Burner

SubVideo is a high-performance, privacy-first web application designed to burn subtitles directly into your videos. Processing happens 100% in your browser—your videos never leave your device.

## 🚀 Key Features

- **Privacy First**: All video processing and subtitle burning is done locally using WebAssembly (FFmpeg.wasm). No servers involved.
- **Pro Styling**: Full control over font families (Google Fonts), sizes, weights, backgrounds, and positioning.
- **Universal Export**: Export to High-Quality MP4 (H.264) or WebM with optimized compatibility for all devices (including mobile Safari).
- **Vertical Video Support**: Automatic handling of 9:16 (TikTok/Reels), 1:1, and 16:9 aspect ratios.
- **Batch Processing**: Burn multiple videos with the same styling in one click.
- **Real-time Preview**: Adaptive canvas-based preview that accurately represents the final export.
- **SRT Sync Utility**: Built-in "Sync Fixer" to shift all subtitle timings simultaneously.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Engine**: FFmpeg.wasm (WebAssembly)
- **Styling**: Tailwind CSS & Lucide Icons
- **Rendering**: HTML5 Canvas API
- **UI Components**: Shadcn UI & Radix Primitives

## 📦 Getting Started

1. Clone the repository: `git clone https://github.com/loneaiyan01/SubVideo.git`
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Build for production: `npm run build`

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## 📄 License

MIT License - Copyright (c) 2026 SubVideo
