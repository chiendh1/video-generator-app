# ESL Podcast Video Generator

A desktop app (Electron + React) that takes a transcript and audio file, displays a synchronized 1920×1080 visual player, and records the result as a `.webm` video ready for YouTube.

---

## Setup

```sh
npm install
npm run dev       # start in development mode (hot reload)
```

## Build

```sh
npm run build:mac
npm run build:win
npm run build:linux
```

---

## Convert to MP4

The recorder outputs `.webm` (VP9 + Opus). To convert to H.264 MP4:

```sh
ffmpeg -i episode.webm -c:v copy -c:a aac output.mp4
```

Or re-encode for maximum compatibility:

```sh
ffmpeg -i episode.webm -c:v libx264 -crf 18 -preset slow -c:a aac output.mp4
```

---

## Transcript Formats

### Bracket format

```
[00:00:01.000] Speaker A: Hello, welcome to the show!
[00:00:05.500] Speaker B: Thanks for having me.
[00:00:09.200] Speaker A: Let's get started.
```

### SRT format

```
1
00:00:01,000 --> 00:00:05,000
Hello, welcome to the show!

2
00:00:05,500 --> 00:00:09,000
Thanks for having me.
```

---

## Recording

1. Fill in episode details on the Setup screen and click **Start Player**.
2. Press **Space** to play/pause audio.
3. Click **Record** (top-right corner) to start capturing window + audio.
4. Click **Stop Recording** — a save dialog prompts for a filename.

> The app window must be visible and unobstructed during recording.

---

## Project Structure

```
src/
├── main/           — Electron main process (BrowserWindow, IPC handlers)
├── preload/        — contextBridge: window.api.getSources / saveVideo
└── renderer/src/
    ├── App.tsx
    ├── types.ts
    ├── utils/transcript.ts       — SRT + bracket-format parser
    ├── hooks/
    │   ├── useTranscriptSync.ts
    │   └── useRecorder.ts
    ├── screens/SetupScreen/
    ├── screens/PlayerScreen/
    ├── components/BackgroundCanvas/
    ├── components/Waveform/
    ├── components/Nameplate/
    ├── components/TranscriptPanel/
    ├── components/ProgressBar/
    ├── components/RecordButton/
    └── styles/global.css
```
