# Release v0.5.0-alpha

**Release Date:** February 15, 2026
**Status:** First alpha pre-release
**Build Status:** ✅ 675/675 tests passing

---

## 🎉 Executive Summary

This is the **first public alpha release** of Pharmacokinetics Grapher, a cross-platform desktop application for visualizing medication concentration curves over time. Built with Vue 3, TypeScript, and Tauri v2, this release delivers a complete pharmacokinetic modeling tool that runs natively on macOS, Windows, and Linux.

All data stays on your device. No cloud sync, no accounts, no telemetry. Your prescription data is stored locally and never leaves your machine.

This alpha release is feature-complete for core pharmacokinetic visualization but is **not recommended for production medical use**. See "Educational Disclaimer" below.

---

## 🚀 What's New

### Desktop Application (Cross-Platform)

- **Native desktop app** powered by Tauri v2
  - macOS: Universal binary (Intel + Apple Silicon)
  - Windows: MSI and NSIS installers
  - Linux: AppImage and .deb packages
- **Lightweight native wrapper** (~5-10MB installed size)
- **No Node.js or Rust required** for end users
- **Local-only data storage** (no server, no cloud)

### Core Pharmacokinetic Modeling

- **One-compartment first-order absorption model** with scientifically accurate calculations
- **Multi-dose accumulation calculator** supporting steady-state visualization
- **Normalized relative concentration curves** (peak = 1.0 scale)
- **Special handling for edge cases** (ka ≈ ke fallback formula, extreme half-lives)
- **Time-to-peak (Tmax) calculation** from absorption/elimination kinetics

### Prescription Management

- **Full CRUD operations**: Create, read, update, delete prescriptions
- **Standard pharmacy frequency labels**: once daily, bid, tid, qid, q6h, q8h, q12h, custom
- **Dosing time picker** with HH:MM format (24-hour clock)
- **Comprehensive validation** for dose, half-life, peak, uptake parameters
- **localStorage persistence** with JSON import/export
- **Prescription comparison mode** (overlay multiple drugs on one graph)

### Visualization Features

- **Chart.js-powered graphs** with accurate scientific rendering
- **Auto-extending timeframe** (shows 10 half-lives or duration, whichever is longer)
- **Clock time display mode** (toggle between hours-since-dose and wall-clock time)
- **Interactive legend** (click to show/hide individual curves)
- **PNG export** with customizable filename
- **Dark mode optimized** (high-contrast labels and gridlines)

### Quality & Testing

- **675 passing tests** across 15 test files
- **Full TypeScript type safety** (strict mode, zero type errors)
- **ESLint + Prettier** code formatting
- **Vitest + Vue Test Utils** comprehensive component testing
- **Zero npm vulnerabilities** (clean `npm audit`)

---

## 📦 Installation & Downloads

### Download Binaries

Download the appropriate installer for your operating system from the [release assets](https://github.com/stephenfeather/Pharmacokinetics-Grapher/releases/tag/v0.5.0-alpha):

| Platform | File Type | Description |
|----------|-----------|-------------|
| **macOS** | `.dmg` | Universal binary (Intel + Apple Silicon) |
| **Windows** | `.msi` or `.exe` | MSI installer or NSIS setup wizard |
| **Linux** | `.AppImage` or `.deb` | Portable AppImage or Debian package |

### Supported Platforms

- **macOS**: 10.15 (Catalina) or later
- **Windows**: Windows 10 (64-bit) or later
- **Linux**: Ubuntu 22.04 or equivalent (with WebKit2GTK 4.1)

### Installation Instructions

**macOS:**
1. Download `Pharmacokinetics-Grapher_0.5.0-alpha_universal.dmg`
2. Open the DMG file
3. Drag "Pharmacokinetics Grapher" to Applications
4. Launch from Applications folder

**Windows:**
1. Download `Pharmacokinetics-Grapher_0.5.0-alpha_x64_en-US.msi` (or `.exe`)
2. Run the installer
3. Follow setup wizard prompts
4. Launch from Start Menu

**Linux:**
1. Download `pharmacokinetics-grapher_0.5.0-alpha_amd64.AppImage` (or `.deb`)
2. For AppImage: `chmod +x *.AppImage && ./pharmacokinetics-grapher_*.AppImage`
3. For .deb: `sudo dpkg -i pharmacokinetics-grapher_*.deb`

---

## ⚠️ Known Limitations

### Alpha Status

This is an **alpha release**. While the core functionality is stable and well-tested, you may encounter:

- UI polish issues (rough edges, inconsistent spacing)
- Edge case bugs in complex dosing scenarios
- Performance issues with very long simulation timeframes (>100 days)

### Simplified Pharmacokinetic Model

The app uses a **one-compartment first-order absorption model** with these assumptions:

- **Linear kinetics** (no saturation at high doses)
- **Complete absorption** (bioavailability F = 1.0)
- **Uniform distribution** (single compartment)
- **No drug-drug interactions**
- **No active metabolites** (metaboliteLife field is informational only)

Real-world pharmacokinetics can involve:
- Multi-compartment distribution
- Non-linear kinetics (saturation)
- Partial absorption
- Active metabolites
- Food/drug interactions

### Educational Use Only

**This app is for visualization and educational purposes only.**

Outputs show **normalized relative concentration curves** based on user-selected representative values from pharmacy insert ranges. The app does **not** calculate absolute mg/L concentrations (would require patient-specific volume of distribution and exact pharmacokinetic parameters).

**Not for medical dosing decisions.** Actual drug levels vary significantly by individual factors (age, weight, liver/kidney function, genetics, food, other medications). Always follow prescriptions written by licensed healthcare providers.

---

## 🔧 Breaking Changes

None (first release).

---

## 🎯 Getting Started

### Quick Start Guide

1. **Download and install** the app for your platform (see Installation above)
2. **Launch the app** from your Applications folder / Start Menu / app launcher
3. **Add a prescription**:
   - Click "Add New Prescription"
   - Enter drug name (e.g., "Ibuprofen")
   - Enter dose (e.g., "400" mg)
   - Select frequency (e.g., "bid" for twice daily)
   - Set dosing times (e.g., "09:00" and "21:00")
   - Enter half-life from pharmacy insert (e.g., "2" hours)
   - Enter time to peak (Tmax) from insert (e.g., "1.5" hours)
   - Enter absorption time (uptake) from insert (e.g., "1" hour)
4. **View the graph**: The app displays peak/trough concentration curves over time
5. **Compare prescriptions**: Select multiple prescriptions to overlay curves
6. **Export**: Click "Export PNG" to save the graph as an image

### Understanding the Graph

- **X-axis**: Time in hours since first dose (or clock time if toggled)
- **Y-axis**: Relative concentration (0–1 scale, normalized to peak = 1.0)
- **Peaks**: Maximum concentration shortly after each dose
- **Troughs**: Minimum concentration just before next dose
- **Steady-state**: Pattern stabilizes after ~5 half-lives

### Where is My Data Stored?

All prescription data is stored **locally on your device**:

- **No server communication** (app makes zero network requests)
- **No accounts or sign-in** (nothing to register for)
- **No analytics or telemetry** (no usage data collected)

| Platform | Storage Location |
|----------|-----------------|
| macOS | `~/Library/Application Support/com.pkgrapher.graphapp/` |
| Windows | `%APPDATA%\com.pkgrapher.graphapp\` |
| Linux | `~/.local/share/com.pkgrapher.graphapp/` |

To clear data: uninstall the app or delete the data folder.

---

## 📋 Feature Summary

### Implemented in v0.5.0-alpha (23 Tasks)

| Feature | Description |
|---------|-------------|
| **PK Calculator** | Single-dose concentration calculation with ka/ke kinetics |
| **Multi-dose Accumulation** | Steady-state modeling with repeated dosing |
| **Prescription Storage** | localStorage persistence with JSON import/export |
| **Prescription Form** | Input validation, frequency picker, time selector |
| **Graph Viewer** | Chart.js visualization with interactive legend |
| **Prescription List** | CRUD operations, comparison mode, duplicate |
| **Tab Navigation** | Switch between "Add New" and "My Prescriptions" |
| **Accessibility** | Keyboard navigation, ARIA labels, a11y-tested legend |
| **PNG Export** | Save graph as image with custom filename |
| **Auto-extend Timeframe** | Dynamic calculation (10 half-lives or duration) |
| **Duration Input** | Set custom simulation timeframe |
| **Clock Time Display** | Toggle X-axis between hours and wall-clock time |
| **Dark Mode Fixes** | High-contrast labels for dark color schemes |
| **Form Edit Fix** | Duration field no longer reverts on edit submission |
| **Desktop Packaging** | Tauri v2 cross-platform native builds |
| **CI/CD Release** | GitHub Actions workflow for automated builds |

---

## 🛠️ Development Stats

- **Total commits**: 46 (42 feature + 4 infrastructure)
- **Test coverage**: 675 tests passing (15 test files)
- **Code quality**: Zero TypeScript errors, zero ESLint errors, zero npm vulnerabilities
- **Build size**: 336KB total (108KB JS + 3.8KB CSS, gzipped)
- **Development duration**: ~6 weeks (December 2025 – February 2026)

---

## 🐛 Support & Feedback

### Reporting Issues

Found a bug or unexpected behavior? Please [open an issue](https://github.com/stephenfeather/Pharmacokinetics-Grapher/issues) with:

1. **Platform and version** (macOS 15, Windows 11, Ubuntu 22.04, etc.)
2. **Steps to reproduce** the issue
3. **Expected behavior** vs. actual behavior
4. **Screenshots** if applicable
5. **Prescription parameters** you entered (drug name, dose, half-life, etc.)

### Feature Requests

Have an idea for improvement? Open a feature request issue with:

- **Use case**: What problem does it solve?
- **Proposed solution**: How would it work?
- **Alternatives**: What workarounds exist today?

### Limitations to Keep in Mind

This app is for **educational visualization only**. Feature requests for:

- Absolute concentration calculations (mg/L)
- Patient-specific dosing recommendations
- Multi-compartment modeling
- Non-linear kinetics
- Drug interaction prediction

...are **out of scope** for this project. The app deliberately uses simplified models to avoid creating a false sense of medical precision.

---

## 👥 Contributors

**Lead Developer**: Stephen Feather ([@stephenfeather](https://github.com/stephenfeather))

**AI Assistance**:
- Claude Opus 4.6 (Anthropic) — coding and implementation
- Gemini (Google) — planning and image generation
- Codex GPT 5.2 (OpenAI) — planning collaboration

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) file for details.

**Educational Use Disclaimer**: This software is provided for educational and visualization purposes only. It is not intended for medical dosing decisions or clinical use. Always consult licensed healthcare providers for prescription medication guidance.

---

## 🔮 What's Next

Planned for future releases:

- **v0.6.0-beta**: UI/UX polish, improved validation error messages, keyboard shortcuts
- **v0.7.0-beta**: Metabolite curve visualization (active metabolites with separate half-lives)
- **v0.8.0-beta**: Multi-language support (Spanish, French, German)
- **v1.0.0**: First stable release (production-ready for educational use)

See the [project roadmap](https://github.com/stephenfeather/Pharmacokinetics-Grapher/issues) for detailed planning.

---

## 🙏 Acknowledgements

This project builds on the work of many open-source contributors:

- **Vue.js** team for the reactive framework
- **Tauri** team for the lightweight desktop wrapper
- **Chart.js** maintainers for accurate scientific charting
- **Vitest** team for fast, modern testing
- **TypeScript** team for type safety

Thank you to all the open-source maintainers who make projects like this possible.

---

**Download v0.5.0-alpha**: [GitHub Releases](https://github.com/stephenfeather/Pharmacokinetics-Grapher/releases/tag/v0.5.0-alpha)

**Source Code**: [GitHub Repository](https://github.com/stephenfeather/Pharmacokinetics-Grapher)

**Documentation**: See [CLAUDE.md](CLAUDE.md) for development details
