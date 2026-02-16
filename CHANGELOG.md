# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0-beta] - 2026-02-16

### Added

#### Developer Experience
- **Console logging utility** (`src/core/utils/logger.ts`): Lightweight `logWarn`/`logError` wrappers with `[PK-Grapher]` prefix and structured context objects for DevTools debugging
- **Calculation warning deduplication**: PK calculator warnings (ka-ke fallback, metabolite ke fallback) are emitted once per accumulation cycle instead of per-timepoint
- **10 new logger unit tests** covering formatted messages, context passing, and argument omission

#### Quality
- **localStorage write protection**: `savePrescription`, `updatePrescription`, and `deletePrescription` now catch `QuotaExceededError` with structured error logging before re-throwing

### Fixed
- **Tmax field rejecting decimal values** (Task 32): Changed peak time input `step` from `0.1` to `0.01` so values like 3.75 hours are accepted
- **Numeric input step attributes** (Task 33): Updated half-life, uptake, metabolite half-life, and duration inputs to `step="0.01"` for consistent decimal precision
- **Silent import failures** (Task 34): Import error handling was already in place; removed incorrect task dependencies

### Changed
- Replaced bare `console.error` in `prescriptionStorage.ts` with structured `logError` call
- Added `logWarn`/`logError` calls to image export, GraphViewer chart creation, and ImportPrescriptions validation/save paths
- Test count increased from 724 to 734 (10 new logger tests)

## [0.6.0-beta] - 2026-02-15

### Added

#### Visualization
- **Pharmacokinetic summary timeline table**: New table below graph showing peak time, peak concentration, trough time, and trough concentration for each dose across the simulation window
- **Dark mode support for GraphViewer**: Full dark mode theming for graph background, gridlines, axis labels, and legend text
- **Navigation tab styling**: Proper sizing, active state indicator, and dark mode support for tab navigation

#### Testing
- Tests verifying graph curve extends to near-zero concentration (validates curve rendering completeness)

### Fixed
- **PK summary table clock times off by ~8 hours**: Corrected time offset calculation in milestone clock-time display
- **Dark mode text readability in Saved Prescriptions**: Fixed contrast issues for prescription list items
- **Clock X-axis offset**: Fixed time alignment when using clock-time display mode
- **App layout width**: Widened app layout for better graph visibility
- **White-on-white graph controls in dark mode**: Fixed unreadable graph control buttons/text
- **Graph line ending prematurely**: Curve now extends to near-zero concentration instead of cutting off early
- **Peak (Tmax) ka derivation**: Corrected absorption rate constant calculation to properly use peak time parameter

### Changed
- Test count increased from 675 to 724 (49 new tests)
- Rebuilt dist with latest source changes

## [0.5.0-alpha] - 2026-02-15

### Added

#### Desktop Application (Task 22, 23)
- **Tauri v2 desktop app packaging**: Native cross-platform desktop application
  - macOS universal binary (.app, 9.1 MB) with Apple Silicon support
  - Windows builds (MSI + NSIS installers)
  - Linux builds (deb + AppImage)
  - 15-30x smaller than Electron equivalent
  - Native arm64 performance on Apple Silicon
- **GitHub Actions release workflow**: Automated cross-platform builds
  - Matrix strategy for macOS, Windows, and Linux
  - Automatic artifact uploads to GitHub releases
  - Triggered on release publish

#### Features
- **Clock time X-axis display mode** (Task 19): Toggle between hours and clock time (HH:MM) display
  - Time formatting utilities with comprehensive tests
  - Multi-day range support with intelligent tick labels
  - Accessible toggle with aria-labels
- **Auto-extend timeframe** (Task 15): Intelligent automatic graph duration
  - Automatic calculation based on prescription half-lives
  - Dynamic slider range (24-168 hours) based on prescription characteristics
  - Manual override toggle for custom durations
  - Support for multiple prescriptions (uses maximum duration)
  - Edge case handling for extreme half-lives
  - 15 comprehensive integration tests
- **Medication duration input** (Task 16): User-specified timeframe for visualization
- **Graph legend** (Task 11): Display medication names with color coding
- **Downloadable graphs** (Task 12): Export graphs as PNG images
- **Prescription import** (Task 13): JSON import modal for bulk prescription loading
- **Tab navigation** (Task 10): Keyboard-accessible navigation between form, list, and graph
  - Phase 1: Tab state management
  - Phase 2: PrescriptionList integration
  - Phase 3: Full accessibility implementation
  - Phase 4: Styling and polish with edge cases
- **Prescription list CRUD** (Task 9): Complete prescription management
  - Create, read, update, delete prescriptions
  - Compare mode to overlay multiple medications
  - Comprehensive testing

#### Core Functionality (Tasks 2-8)
- **Prescription data models** (Task 2): TypeScript interfaces with validation
- **Single-dose PK calculator** (Task 3): One-compartment first-order absorption model
- **Multi-dose accumulation** (Task 4): Steady-state calculations
- **localStorage persistence** (Task 5): Client-side data storage
- **PrescriptionForm component** (Task 6): Comprehensive input form with tests
- **GraphViewer component** (Task 7): Chart.js visualization
- **App integration** (Task 8): Form, calculations, and graph working together

#### Developer Experience
- README with developer setup guide and current status
- Core application directory structure for PK logic
- TypeScript strict mode for enhanced type safety
- Oxlint configuration for src/ directory linting
- Chart.js for accurate scientific visualization

### Fixed

#### Desktop Application
- Add tauri npm script for GitHub Actions workflow compatibility

#### Form & UI
- **Form duration field revert on edit** (Task 21): Fixed two-part issue
  - Added watcher on `initial` prop to update form fields when editing different prescriptions
  - Fixed App.vue to call `updatePrescription` instead of creating duplicates
  - Added `:initial` prop binding to PrescriptionForm
  - 2 new integration tests to verify fix
- **Dark mode label contrast** (Task 20): Improved readability
  - Safari compatibility with explicit color values
  - Pure white (#ffffff) labels in dark mode
  - Light grey (#b0b0b0) field hints
  - Warning yellow for educational disclaimer
  - WCAG AA contrast compliance
- **Import link contrast**: Dark mode styling (#60a5fa bright blue, #93c5fd hover)
- **Prescription import JSON submission** (Task 13): Fixed event chain

### Security
- **Privacy-first architecture**: Local-only data storage emphasized in README
  - No backend API or external data transmission
  - All prescription data stored in browser localStorage
  - Educational disclaimer clarified

### Changed
- Updated README to emphasize local-only data storage and privacy

## [1.0.0-test] - 2026-02-15
- Test release tag (not a production release)

---

## Release Notes: v0.5.0-alpha

This is the first alpha pre-release of Pharmacokinetics Grapher, featuring a complete Vue 3 + TypeScript web application now packaged as a native desktop app via Tauri v2.

### Highlights

**Desktop Application**:
- Native cross-platform builds (macOS, Windows, Linux)
- 9.1 MB macOS universal binary (15-30x smaller than Electron)
- Apple Silicon arm64 native performance
- Automated GitHub Actions release workflow

**Core Functionality**:
- One-compartment pharmacokinetic modeling
- Multi-dose accumulation with steady-state visualization
- Prescription management (CRUD + compare mode)
- Intelligent auto-extending timeframe (24-168 hours)
- Clock time display mode for multi-day ranges
- Downloadable PNG graphs

**Quality**:
- 675 passing unit tests
- TypeScript strict mode
- Accessibility features (keyboard navigation, aria-labels)
- Dark mode support with WCAG AA contrast compliance

### Known Limitations (Alpha)
- Simplified PK model (one-compartment, first-order absorption)
- Assumes complete absorption (F = 1.0)
- Metabolites displayed but not used in calculations
- Educational use only (not for medical dosing decisions)

### Installation
Download platform-specific builds from the [Releases](https://github.com/yourusername/Pharmacokinetics-Grapher/releases) page.

### Contributors
- Stephen Feather
- Claude Opus 4.6 (AI pair programming)
- Claude Haiku 4.5 (AI pair programming)
