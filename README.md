# Pharmacokinetics Grapher

A Vue 3 + TypeScript application that visualizes medication concentration levels over time. Input prescription details and the app generates accurate line graphs showing peak and trough concentrations across your specified timeframe. Available as a web app or a standalone desktop application via Tauri.

![Pharmacokinetics Grapher desktop app](tauri-desktop-app-featured.jpg)

**Your data stays on your device.** All prescription data is stored locally — in your browser's localStorage when using the web app, or on-disk within the desktop application. Nothing is sent to a server. There are no accounts, no cloud sync, and no telemetry. You own your data completely.

## Features

- **Pharmacokinetic curve visualization** — one-compartment first-order absorption model with multi-dose accumulation
- **Prescription management** — create, edit, delete, duplicate, and import prescriptions (JSON)
- **Multi-drug comparison** — overlay multiple medications on a single graph
- **PK summary table** — peak time, peak concentration, trough time, and trough concentration for each dose
- **Auto-extending timeframe** — intelligent graph duration based on half-lives (24–2520 hours), with manual override
- **Clock time X-axis** — toggle between elapsed hours and wall-clock time (HH:MM) display
- **Downloadable graphs** — export as PNG images
- **Dark mode** — full dark mode support with WCAG AA contrast compliance
- **Keyboard-accessible navigation** — tab-based navigation with aria-labels
- **Desktop app** — native cross-platform builds via Tauri v2 (macOS, Windows, Linux)
- **Metabolite visualization** — optional display of active metabolite concentration curves (work in progress, parameters being refined)
- **Privacy-first** — zero network requests, no accounts, no telemetry

## Installation

Download the latest release for your platform from the [Releases page](https://github.com/stephenfeather/Pharmacokinetics-Grapher/releases):

| Platform | Download |
|----------|----------|
| **macOS** | `.dmg` (universal binary — works on Intel and Apple Silicon) |
| **Windows** | `.exe` installer |
| **Linux** | `.AppImage` or `.deb` |

Open the downloaded file and follow your platform's standard install process.

> For building from source or contributing, see [DEVELOPER.md](DEVELOPER.md).

## How to Use

1. **Open the app** in your browser or launch the desktop application
2. **Enter prescription details**:
   - Drug name (e.g., "Ibuprofen", "Amoxicillin")
   - Dose per administration (in mg or units)
   - Frequency (once daily, bid, tid, qid, every 6/8/12 hours, or custom)
   - Dosing times (what time of day you take it)
   - Half-life (from pharmacy insert)
   - Time to peak absorption (Tmax, from insert)
   - Absorption time (uptake)
3. **View the graph** showing:
   - Peak and trough concentration points
   - Accumulation over multiple doses
   - Normalized relative concentration (0–1 scale)
   - PK summary table with per-dose milestones
4. **Save and compare**: Save prescriptions locally and overlay multiple drugs on the same graph
5. **Export**: Download graphs as PNG images

## Pharmacokinetics Model

The app uses a **one-compartment first-order absorption model**:

```
C(t) = Dose × [ka/(ka - ke)] × (e^(-ke×t) - e^(-ka×t))
```

Where:
- `ka` = absorption rate constant (derived from uptake time)
- `ke` = elimination rate constant (derived from half-life)
- `t` = time since dose

Multi-dose accumulation sums contributions from each scheduled dose, then normalizes the total curve so the highest concentration point = 1.0. Steady-state patterns emerge after approximately 5 half-lives.

A fallback formula (`C(t) = Dose × ka × t × e^(-ke×t)`) is used when ka and ke are nearly equal (`|ka - ke| < 0.001`), avoiding numerical instability.

### Metabolite Curves (Work in Progress)

For drugs with active metabolites, the app supports an optional sequential metabolism model using a one-compartment parent-to-metabolite conversion. Metabolite curves are displayed as dashed lines alongside the parent drug curve. This feature is **actively being developed** — metabolite parameters (conversion fraction, elimination half-life) and their visualization are still being refined and may change between releases.

**Important**: This app visualizes approximate concentration curves for **educational and visualization purposes only**. It is not for medical dosing decisions.

## Privacy & Data Storage

All data created in Pharmacokinetics Grapher stays on your device:

| Platform | Where data lives | How to clear it |
|----------|-----------------|-----------------|
| **Web app** (browser) | Browser `localStorage` under the app's origin | Clear site data in browser settings, or use the app's delete functions |
| **Desktop app** (Tauri) | App data directory on your local filesystem | Uninstall the app, or delete its data folder |

- **No server communication.** The app makes zero network requests. It runs entirely client-side.
- **No accounts or sign-in.** There is nothing to register for.
- **No analytics or telemetry.** No usage data is collected or transmitted.
- **Portable.** Your prescriptions live where you run the app. If you clear your browser data or uninstall the desktop app, the data is gone.

## Educational Disclaimer

**This app is for visualization and educational purposes only.**

This application demonstrates pharmacokinetic principles using simplified models. It is **not intended for medical dosing decisions**. Actual drug concentrations vary significantly based on individual factors (age, weight, liver/kidney function, food interactions, other medications, etc.).

Always follow prescriptions written by licensed healthcare providers and consult with a pharmacist for any medication questions.

## License

This project is open source and available for educational purposes.

## Acknowledgements

This project was built with assistance from AI tools:

- **Claude Opus 4.6** (Anthropic) — coding and implementation
- **Gemini** (Google) — planning collaboration and image generation
- **Codex GPT 5.2** (OpenAI) — planning collaboration
