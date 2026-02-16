# Release v0.6.0-beta

**Release Date:** February 15, 2026
**Status:** Beta pre-release
**Build Status:** 724/724 tests passing

---

## Summary

This beta release adds a pharmacokinetic summary timeline table, comprehensive dark mode support for all graph components, and fixes several bugs related to time calculations and visual rendering. The test suite has grown from 675 to 724 tests, and the version advances from alpha to beta reflecting improved stability.

---

## What's New

### Pharmacokinetic Summary Timeline Table

A new table is displayed below the graph showing key pharmacokinetic milestones for each dose in the simulation window:

- **Peak time** and **peak concentration** for each dose
- **Trough time** and **trough concentration** for each dose
- Clock-time display when clock mode is active
- Automatically updates when prescriptions or timeframe change

### Dark Mode for GraphViewer

The graph component now fully supports dark mode:

- Dark background for chart area
- Light-colored axis labels, tick marks, and gridlines
- Properly contrasted legend text
- Graph control buttons readable in both themes

### Navigation Tab Styling

- Proper tab sizing with visual active state indicator
- Dark mode compatible styling
- Consistent with overall application theming

---

## Bug Fixes

| Fix | Details |
|-----|---------|
| **PK summary table clock times** | Fixed ~8 hour offset in milestone time display |
| **Saved Prescriptions readability** | Fixed dark mode text contrast in prescription list |
| **Clock X-axis offset** | Corrected time alignment in clock-time display mode |
| **App layout width** | Widened layout for better graph visibility |
| **Graph controls contrast** | Fixed white-on-white text in dark mode |
| **Graph line cutoff** | Curve now extends to near-zero concentration |
| **Peak (Tmax) ka derivation** | Corrected absorption rate constant calculation |

---

## Quality Metrics

| Metric | v0.5.0-alpha | v0.6.0-beta |
|--------|-------------|-------------|
| Tests passing | 675 | 724 (+49) |
| Test files | 15 | 17 (+2) |
| TypeScript errors | 0 | 0 |
| ESLint errors | 0 | 0 |
| npm vulnerabilities | 0 | 0 |
| Build size (JS gzipped) | 108 KB | 110 KB |

---

## Security Assessment

A full security audit was performed for this release:

- **Risk Level:** LOW
- **npm audit:** 0 vulnerabilities
- **Secrets:** None found in source
- **XSS vectors:** None (no v-html, no eval, no innerHTML)
- **Production dependencies:** 3 (vue, chart.js, chartjs-plugin-a11y-legend)

**Advisory:** Tauri CSP is set to `null` (disabled). A restrictive CSP policy should be applied before v1.0 stable release.

---

## Breaking Changes

None. This release is fully backward-compatible with v0.5.0-alpha. Existing localStorage prescription data will continue to work without migration.

---

## Installation

Download platform-specific builds from the [Releases](https://github.com/stephenfeather/Pharmacokinetics-Grapher/releases/tag/v0.6.0-beta) page.

| Platform | File |
|----------|------|
| **macOS** | `Pharmacokinetics-Grapher_0.6.0-beta_universal.dmg` |
| **Windows** | `Pharmacokinetics-Grapher_0.6.0-beta_x64_en-US.msi` |
| **Linux** | `pharmacokinetics-grapher_0.6.0-beta_amd64.AppImage` |

---

## Known Limitations

- Simplified one-compartment PK model (complete absorption, linear kinetics)
- Educational use only (not for medical dosing decisions)
- Metabolite curves informational only (not used in calculations)
- No multi-language support yet

---

## What's Next

- **v0.7.0-beta**: Metabolite curve visualization with active metabolite modeling
- **v0.8.0-beta**: Multi-language support (Spanish, French, German)
- **v1.0.0**: First stable release

---

## Contributors

- Stephen Feather ([@stephenfeather](https://github.com/stephenfeather))
- Claude Opus 4.6 (Anthropic) -- coding and implementation

---

**Educational Use Disclaimer:** This software is provided for educational and visualization purposes only. It is not intended for medical dosing decisions or clinical use. Always consult licensed healthcare providers for prescription medication guidance.
