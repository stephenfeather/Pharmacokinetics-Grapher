# Release Notes: v1.0.0

**Release Date**: 2026-03-14

## Summary

The first stable release of Pharmacokinetics Grapher. This release graduates the project from beta with expanded dosing frequency support, drag-to-sort prescription management, CI/CD automation, and security hardening.

## What's New

### Expanded Dosing Frequencies
- **q3h** (every 3 hours): Supports medications requiring 8 daily doses with clinically appropriate default times
- **qd** (once daily): Explicit once-daily option alongside the existing 'once' label
- All frequency labels now provide standardized default dosing times, reducing manual time entry

### Drag-to-Sort Prescriptions
Saved prescriptions can now be reordered via drag-and-drop. Sort order persists across sessions via localStorage.

### Metabolite Model Improvements
Replaced `metaboliteConversionFraction` with `relativeMetaboliteLevel` (0.1-10.0 scale), providing clearer clinical semantics for metabolizer phenotype variations (e.g., 1.0 = normal, 3.0 = 3x higher metabolite levels).

### CI/CD Pipeline
- GitHub Actions workflow: automated tests, linting, type-checking, and production build on every push and PR
- Rust/sccache caching for faster Tauri desktop builds
- Build provenance attestation for release artifacts

### Security Hardening
- All dependency vulnerabilities resolved (npm audit: 0 findings)
- Tauri Content Security Policy set to restrictive defaults (previously disabled)
- Unused Vue scaffolding removed (reduced attack surface)
- `.env.local` patterns added to `.gitignore`

## Bug Fixes
- Fixed metabolite half-life import from nested JSON structure
- Fixed vuedraggable-es package resolution
- Fixed savePrescriptionOrder missing export
- Fixed CI lint failures from unused imports

## Quality

- **786 tests passing** (52 new since v0.7.0-beta)
- **0 TypeScript type errors**
- **0 lint errors** (OxLint + ESLint)
- **0 dependency vulnerabilities**
- Production build: 372 KB JS, 24 KB CSS (130 KB gzipped)

## Breaking Changes

None. This release is fully backward-compatible with prescriptions saved in v0.5.0-alpha through v0.7.0-beta.

## Known Limitations

- Simplified PK model (one-compartment, first-order absorption)
- Assumes complete absorption (F = 1.0)
- Metabolite visualization requires both `metaboliteLife` and `relativeMetaboliteLevel`
- Educational use only (not for medical dosing decisions)

## Commits Since v0.7.0-beta

- `bbf51ab` fix: remove unused FREQUENCY_MAP import to fix CI lint failure
- `33c3d70` build: rebuild dist with q3h and default times changes
- `7762b3c` chore: update taskmaster state and project config
- `a520aa5` build: update dist output files
- `32ef3cc` feat(ui): add drag-to-sort for saved prescriptions list
- `d28f769` docs: update CLAUDE.md frequency documentation with qd and q3h
- `2a71847` feat(model): add q3h frequency and standardized default dosing times
- `b66c325` docs: add screenshots of PK graph and timeline to README
- `9f82aab` docs: split README into user-facing README and DEVELOPER.md
- `6c4d4db` Add attestation action
- `a072144` fix(ci): run Warm Rust cache step without sccache
- `9ff1ac5` fix(storage): export savePrescriptionOrder for drag reorder persistence
- `d6665cd` fix(ci): add test script and fix savePrescriptionOrder import in storage spec
- `b11b66b` fix: vuedraggable-es resolution and prescriptionStorage test
- `2b085b6` Replace metaboliteConversionFraction with relativeMetaboliteLevel
- `236c585` Fix metabolite half-life import from nested JSON object structure
- `c0f7c36` Add 'qd' (once daily) as synonym for 'once' dosing frequency
- `87d3068` Add CI workflow and optimize release build caching

## Installation

**Web**: Serve the `dist/` directory with any static file server.

**Desktop**: Download platform-specific builds from the [Releases](https://github.com/stephenfeather/Pharmacokinetics-Grapher/releases) page.

## Contributors
- Stephen Feather
- Claude Opus 4.6 (AI pair programming)
