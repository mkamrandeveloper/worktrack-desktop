# WorkTrack Desktop Agent

A production-ready, cross-platform Electron desktop application that serves as the desktop companion for the WorkTrack employee productivity and time tracking system.

## 🚀 Features

- **Secure Authentication**: JWT + refresh token flow with encrypted local storage.
- **Accurate Timer Engine**: Drift-corrected background timer that persists across restarts.
- **Automated Screenshots**: Multi-monitor capture, Sharp compression, offline queuing.
- **Activity Monitoring**: Idle detection via native OS APIs (powerMonitor).
- **Real-Time Sync**: Socket.io integration for instant task updates and settings changes.
- **Offline Resilience**: Network interruption handles gracefully; pending API calls and screenshots are queued and replayed.
- **System Tray**: Minimizes to tray, dynamic timer tooltip, full context menu controls.
- **Auto-Updates**: Built-in silent updates via `electron-updater`.
- **Beautiful UI**: React 18, TailwindCSS, glassmorphism, animated timer rings.

## 🛠 Tech Stack

- **Framework**: Electron + Electron Builder
- **Language**: TypeScript (Strict Mode)
- **Frontend**: React 18 + Vite + TailwindCSS + Zustand
- **Backend Communication**: Axios + Socket.io-client
- **Local Storage**: electron-store (encrypted)
- **Image Processing**: screenshot-desktop + sharp
- **Logging**: winston + winston-daily-rotate-file

## 📦 Installation & Setup

1. **Install dependencies**
```bash
npm install
```

2. **Environment Variables**
Create a `.env` file in the root directory (copy `.env.example`):
```bash
cp .env.example .env
```
Ensure `API_BASE_URL` points to your WorkTrack backend.

## 💻 Development

Start the development server (runs Vite for renderer and tsc for main process concurrently):

```bash
npm run dev
```

> **Note:** The Vite dev server will start on `http://localhost:5173`, and the Electron app will launch shortly after.

## 🏗 Production Build

To build the application for production:

```bash
# Build for your current platform
npm run package

# Build specifically for Windows (.exe)
npm run package:win

# Build specifically for macOS (.dmg)
npm run package:mac

# Build specifically for Linux (.AppImage)
npm run package:linux
```

The output installers will be located in the `out/` directory.

## 🔒 Security Architecture

- **Context Isolation**: Enabled. The renderer process has NO direct access to Node.js or Electron APIs.
- **Preload Script**: Communication between renderer and main process happens exclusively via a strictly typed `window.worktrack` IPC bridge.
- **Content Security Policy**: Strict CSP applied to all windows, blocking remote scripts and iframes.
- **Encrypted Storage**: All sensitive data (JWTs, local state, queue items) are encrypted using AES-256 via `electron-store`.
- **Navigation Lock**: External links are forced to open in the user's default browser, preventing open-redirect attacks within the app shell.
