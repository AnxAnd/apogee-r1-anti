# Apogee R1 Anti

A visual task orchestration mini-app built for the **Rabbit R1** running on **rabbitOS**, developed in accordance with the official [rabbit-hmi-oss/creations-sdk](https://github.com/rabbit-hmi-oss/creations-sdk).

Modeled on the gravitational physics of the desktop **Apogee** project, **Apogee R1 Anti** simplifies the celestial canvas into a 240×282px portrait interface anchored by a glowing bottom **CORE** and 3 upward concentric orbital priority tracks.

---

## Hardware & rabbitOS SDK Integration

This project strictly adheres to the official `creations-sdk` specification:

1. **Fixed Viewport (240 × 282 px)**:
   - Optimized for the 2.88" screen with high-contrast rabbitOS Dark Mode typography and touch targets.
2. **Physical Scroll Wheel (`scrollUp` / `scrollDown`)**:
   - Rotating the wheel smoothly rotates and glides satellites along their curved orbital tracks with inertial damping.
3. **PTT Side Button (`sideClick` / `longPressStart`)**:
   - Single click: Quick action (opens Quick-Add modal or closes sheets).
   - Long press: Triggers the **R1 AI Copilot** to automatically generate 3 focus tasks for the active Core goal.
4. **Bulletproof Dual-Engine Persistence (`window.creationStorage.plain` + `localStorage`)**:
   - Multi-layered mirrored writes to both `window.creationStorage.plain` (official rabbitOS Creations SDK standard) and persistent `localStorage`.
   - Automatic state synchronization on `visibilitychange` (app backgrounding), `pagehide`, and explicit app drawer exit.
   - Protects user tasks and active core goals across device restarts and app relaunches.
5. **R1 AI Copilot (`PluginMessageHandler`)**:
   - Integrates with rabbitOS LLM channel (`useLLM: true`) to suggest and break down tasks.
6. **Clean Exit (`closeWebView`)**:
   - Safely flushes pending state saves to disk before exiting cleanly to the rabbitOS launcher.

---

## Visual Design & Architecture

- **Bottom Anchor (CORE)**: Radiant orange semi-circular dome displaying the active goal title centered in high-contrast typography. Tapping the dome opens the Core Sheet.
- **Gravitational Absorption & History**: Completed tasks collapse downwards into the Core with a burst celebration. Tapping the Core reveals all absorbed tasks, allowing you to review your accomplishments or **restore any task back to orbit** with a single tap.
- **ORBIT 1 (Focus)**: Inner golden arc for high-priority tasks (doing now).
- **ORBIT 2 (Up Next)**: Middle electric cyan arc for queued tasks (ready to start).
- **ORBIT 3 (Backlog)**: Outer purple arc for long-range tasks and idea hopper.
- **Touch Target Optimization**: Enlarged 68×44px hitboxes with device-normalized touch scaling for responsive, drift-free selection on the 240×282 display.

---

## Project Structure

```text
apogee-r1-anti/
├── index.html          # Main SPA shell (240x282 viewport with anti-caching meta)
├── css/
│   └── styles.css      # rabbitOS Dark Mode styling, bottom sheet & modal transitions
├── js/
│   ├── app.js          # Main application orchestrator & state manager
│   ├── canvas.js       # Orbital physics canvas & wheel/touch rotation engine
│   ├── hardware.js     # creations-sdk hardware listener bridge + desktop preview controls
│   ├── storage.js      # Multi-layered mirrored storage engine (plain + localStorage)
│   └── copilot.js      # PluginMessageHandler LLM bridge for AI task generation
├── assets/
│   ├── apogeer1ui.png  # Reference UI graphic
│   └── original.jpg    # Hand-drawn reference sketch
├── r1-install-qr.png   # Scannable PNG installation QR code (?build=5)
├── r1-install-qr.svg   # Vector SVG installation QR code (?build=5)
├── generate-qr.html    # Interactive QR code generator tool
└── README.md           # This document
```

---

## Desktop Preview & Testing

You can preview and test **Apogee R1 Anti** directly on your desktop before loading onto your R1:

1. Start any local web server in this folder, e.g.:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8080
   ```
2. Open `http://localhost:8080` in your browser.
3. **Desktop Simulator Controls**:
   - **Scroll Wheel**: Mouse scroll wheel spins the orbital satellites.
   - **Arrow Keys**: `Up`/`Down` or `k`/`j` simulate the hardware scroll wheel.
   - **PTT Button**: Press `P` or `Spacebar` to simulate clicking the physical side button.
   - **Touch Drag**: Click and drag across the canvas to manually rotate the orbital tracks.

---

## Live Deployment & Rabbit R1 Installation

### 🚀 Live URL
**`https://anxand.github.io/apogee-r1-anti/?build=5`**

### 📱 Quick Scan & Install
Point your Rabbit R1 camera at this QR code to install **Apogee R1 Anti**:

<p align="center">
  <img src="r1-install-qr.png" alt="Rabbit R1 Install QR Code" width="220" />
</p>

1. **Launch R1 Camera**: Double-click the physical PTT side button on your Rabbit R1.
2. **Scan**: Aim the camera at the QR code above (or open `generate-qr.html` in your browser).
3. **Install**: Tap the screen banner on the R1 to install **Apogee R1 Anti** directly into your rabbitOS Creations launcher.

---

## 🔒 Privacy & Data Sovereignty

Your data is completely private and never leaves your Rabbit R1 device:

- **100% Client-Side Architecture**: The entire application runs as a local Single Page Application within the rabbitOS Webview container.
- **Local Sandboxed Storage**: Task and goal data is saved directly into the R1's sandboxed `window.creationStorage.plain` and local web storage.
- **Zero Cloud Leakage**: GitHub Pages functions solely as a static asset host (HTML, CSS, JS). No server-side database exists, no APIs receive your data, and no telemetry, cookies, or tracking scripts are embedded.
- **Offline Capable**: Once loaded into rabbitOS cache, orbital task manipulation, creation, and note editing function entirely without internet connectivity.

