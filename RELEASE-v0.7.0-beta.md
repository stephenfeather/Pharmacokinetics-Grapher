# Release Notes: v0.7.0-beta

**Release Date**: 2026-02-16

## Summary

This release adds developer-facing console logging for debugging, fixes decimal input handling across the prescription form, and hardens localStorage write operations with proper error handling.

## What's New

### Console Logging Utility
A lightweight logger (`src/core/utils/logger.ts`) now provides `logWarn` and `logError` functions with a `[PK-Grapher]` prefix and optional structured context objects. These render as expandable objects in browser DevTools, making it easy to diagnose issues without adding UI noise.

Logging has been added to:
- localStorage parse/write failures
- PK calculator ka-ke fallback formula activation
- Image export failures
- Chart.js initialization errors
- Prescription import validation and save failures

### localStorage Write Protection
The three `localStorage.setItem()` calls in `prescriptionStorage.ts` that previously had no error handling are now wrapped in try/catch blocks. On `QuotaExceededError`, the error is logged with context and re-thrown so callers can handle it.

## Bug Fixes

- **Tmax field rejecting decimal values** (Task 32): The peak time input `step` attribute was `0.1`, preventing values like `3.75`. Changed to `step="0.01"`.
- **Other numeric inputs similarly restricted** (Task 33): Half-life, uptake, metabolite half-life, and duration inputs also updated to `step="0.01"`.
- **Import error handling** (Task 34): Confirmed that user-facing error messages were already in place for failed imports. Removed incorrect task dependencies that blocked this item.

## Quality

- **734 tests passing** (10 new logger tests)
- **0 TypeScript type errors**
- **0 lint errors** (oxlint + ESLint)

## Commits Since v0.6.0-beta

- `67127a7` Add console logging for errors and warnings
- `91e4d5c` Fix Tmax field rejecting decimal values like 3.75
- `ff7ca39` Add step attribute tests for remaining numeric inputs

## Contributors
- Stephen Feather
- Claude Opus 4.6 (AI pair programming)
