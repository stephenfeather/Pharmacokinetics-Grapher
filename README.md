# Pharmacokinetics Grapher

A Vue 3 + TypeScript application that visualizes medication concentration levels over time. Input prescription details and the app generates accurate line graphs showing peak and trough concentrations across your specified timeframe. Available as a web app or a standalone desktop application via Tauri.

**Your data stays on your device.** All prescription data is stored locally — in your browser's localStorage when using the web app, or on-disk within the desktop application. Nothing is sent to a server. There are no accounts, no cloud sync, and no telemetry. You own your data completely.

## Current Status

**Development Phase:** Feature Implementation (Tasks 1-7 Complete)

### Completed
- ✅ **Task 1-3**: Core PK calculation engine with multi-dose accumulation
- ✅ **Task 4**: Multi-dose accumulation calculator with steady-state support
- ✅ **Task 5**: localStorage prescription storage layer
- ✅ **Task 6**: PrescriptionForm component with validation and testing
- ✅ **Task 7**: GraphViewer component with Chart.js integration (22 unit tests)

### In Progress
- 🔄 **Task 8**: App.vue integration (wiring components together)

### Coming Soon
- Task 9: PrescriptionList component with comparison mode
- Enhanced UI/UX features

## Prerequisites

- **Node.js**: ^20.19.0 or >=22.12.0
- **npm**: Included with Node.js

Check your versions:
```bash
node --version
npm --version
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Pharmacokinetics-Grapher
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Development Server

Start the dev server (opens on http://localhost:5173):
```bash
npm run dev
```

The app will hot-reload as you make changes. Open your browser and navigate to the URL shown in the terminal.

### Production Build

Build for production:
```bash
npm run build
```

Preview the production build locally:
```bash
npm run preview
```

## Testing & Quality Checks

### Run All Tests
```bash
npm run test:unit
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Run Specific Test File
```bash
npm run test:unit -- src/components/__tests__/PrescriptionForm.spec.ts
```

### Type Checking
```bash
npm run type-check
```

### Linting & Code Formatting
```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format with Prettier
```

### Full Quality Check
Run all checks before committing:
```bash
npm run test:unit && npm run type-check && npm run lint
```

## How to Use

1. **Open the app** at http://localhost:5173
2. **Enter prescription details**:
   - Drug name (e.g., "Ibuprofen", "Amoxicillin")
   - Dose per administration (in mg or units)
   - Frequency (once daily, bid, tid, qid, every 6/8/12 hours, or custom)
   - Dosing times (what time of day you take it)
   - Half-life (from pharmacy insert)
   - Time to peak absorption (Tmax, from insert)
   - Absorption time (uptake)

3. **View the graph**: The app displays your medication's concentration curve over time, showing:
   - Peak concentration points (highest levels)
   - Trough concentration points (lowest levels)
   - Accumulation over multiple doses
   - Normalized relative concentration (0–1 scale)

4. **Save prescriptions**: Your entries are stored locally on your device and persist across sessions. In the browser, data lives in localStorage. In the desktop app, data is stored on-disk. No data ever leaves your machine.

## Project Structure

```
src/
├── core/                          # Calculation engine (no UI dependencies)
│   ├── calculations/
│   │   ├── pkCalculator.ts        # Core pharmacokinetics math
│   │   └── multiDoseProfile.ts    # Multi-dose accumulation
│   ├── models/
│   │   └── prescription.ts        # TypeScript types and validation
│   └── storage/
│       └── prescriptionStorage.ts # localStorage wrapper
├── components/
│   ├── PrescriptionForm.vue       # Input form for new prescriptions
│   ├── GraphViewer.vue            # Chart.js visualization
│   ├── __tests__/                 # Component tests (Vitest + Vue Test Utils)
│   └── ...
├── App.vue                        # Main application component
└── main.ts                        # Entry point
```

## Technology Stack

- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite
- **Charting**: Chart.js 4.x (for accurate scientific visualization)
- **Testing**: Vitest + Vue Test Utils
- **Linting**: ESLint (oxlint) + Prettier
- **Storage**: Local-only (browser localStorage for web; on-disk for desktop). No server, no accounts, no telemetry.
- **Desktop**: Tauri v2 (lightweight native wrapper for macOS/Windows/Linux)

## Pharmacokinetics Model

The app uses a **one-compartment first-order absorption model**:

```
C(t) = Dose × [ka/(ka - ke)] × (e^(-ke×t) - e^(-ka×t))
```

Where:
- `ka` = absorption rate constant (derived from uptake)
- `ke` = elimination rate constant (derived from half-life)
- `t` = time since dose

**Key Features**:
- Accurate multi-dose accumulation
- Normalized relative concentration curves (peak = 1.0)
- Handles steady-state patterns
- Special fallback for near-equal ka/ke cases

**Important**: This app visualizes approximate concentration curves for **educational and visualization purposes only**. It is not for medical dosing decisions. Actual drug levels vary by individual and require consultation with healthcare providers.

## Development Workflow

### Making Changes

1. **Write tests first** (TDD approach):
   ```bash
   npm run test:watch
   ```

2. **Implement the feature** in the appropriate file

3. **Verify quality**:
   ```bash
   npm run type-check && npm run lint && npm run test:unit
   ```

4. **Test in the dev server**:
   ```bash
   npm run dev
   ```

### Adding a New Feature

Example: Adding a new dosing frequency

1. Update types in `src/core/models/prescription.ts`
2. Write tests in relevant `__tests__/` file
3. Implement logic in `src/core/calculations/`
4. Update UI component in `src/components/`
5. Run full test suite and quality checks

## Troubleshooting

### Port Already in Use
If http://localhost:5173 is already in use, Vite will try the next port (5174, 5175, etc.). Check the terminal output for the actual URL.

### Node Version Issues
Ensure you're using Node ^20.19.0 or >=22.12.0:
```bash
node --version
```

### Dependencies Not Installed
If you see "module not found" errors:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Type Errors After Pulling Changes
Type definitions may need rebuilding:
```bash
npm run type-check
```

### Tests Failing
Ensure all dependencies are installed and up-to-date:
```bash
npm install
npm run test:unit
```

## Contributing

When contributing, please follow the development workflow:

1. Create a feature branch from `main`
2. Implement with tests (TDD)
3. Ensure all checks pass:
   ```bash
   npm run test:unit && npm run type-check && npm run lint
   ```
4. Create a pull request with a clear description

## License

This project is open source and available for educational purposes.

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

⚠️ **This app is for visualization and educational purposes only.**

This application demonstrates pharmacokinetic principles using simplified models. It is **not intended for medical dosing decisions**. Actual drug concentrations vary significantly based on individual factors (age, weight, liver/kidney function, food interactions, other medications, etc.).

Always follow prescriptions written by licensed healthcare providers and consult with a pharmacist for any medication questions.

## Acknowledgements

This project was built with assistance from AI tools:

- **Claude Opus 4.6** (Anthropic) — coding and implementation
- **Gemini** (Google) — planning collaboration and image generation
- **Codex GPT 5.2** (OpenAI) — planning collaboration
