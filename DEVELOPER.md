# Developer Guide

Development documentation for Pharmacokinetics Grapher. For an overview of the application and its features, see [README.md](README.md).

## Prerequisites

- **Node.js**: ^20.19.0 or >=22.12.0
- **npm**: Included with Node.js

Check your versions:
```bash
node --version
npm --version
```

For desktop builds, you also need the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/stephenfeather/Pharmacokinetics-Grapher.git
cd Pharmacokinetics-Grapher
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Web (Development Server)

```bash
npm run dev
```

Opens on http://localhost:5173 with hot-reload.

### Web (Production Build)

```bash
npm run build
npm run preview    # Preview locally
```

### Desktop (Tauri)

```bash
npm run tauri:dev              # Development with hot-reload
npm run tauri:build            # Production build for current platform
npm run tauri:build:mac        # macOS universal binary
npm run tauri:build:windows    # Windows (MSI + NSIS)
npm run tauri:build:linux      # Linux (deb + AppImage)
```

## Testing & Quality Checks

724 passing tests across 17 test files.

```bash
npm run test:unit                # Run all tests
npm run test:watch               # Watch mode for development
npm run test:unit -- path/to/test.spec.ts   # Run a specific test file
npm run type-check               # TypeScript type checking
npm run lint                     # ESLint (oxlint) + Prettier checks
npm run format                   # Format with Prettier
```

Full quality check before committing:
```bash
npm run test:unit && npm run type-check && npm run lint
```

## Project Structure

```
src/
├── core/                            # Calculation engine (no UI dependencies)
│   ├── calculations/
│   │   ├── pkCalculator.ts          # Core pharmacokinetics math
│   │   ├── multiDose.ts             # Multi-dose accumulation
│   │   └── pkMilestones.ts          # Peak/trough milestone detection
│   ├── models/
│   │   ├── prescription.ts          # TypeScript types and validation
│   │   └── pkSummary.ts             # Summary table data types
│   ├── storage/
│   │   └── prescriptionStorage.ts   # localStorage wrapper
│   ├── export/
│   │   └── imageExport.ts           # PNG export logic
│   └── utils/
│       └── timeFormat.ts            # Clock time formatting utilities
├── components/
│   ├── PrescriptionForm.vue         # Input form with validation
│   ├── GraphViewer.vue              # Chart.js visualization
│   ├── PrescriptionList.vue         # Saved prescriptions with CRUD + compare
│   ├── PkSummaryTable.vue           # Per-dose peak/trough table
│   ├── ImportPrescriptions.vue      # JSON import modal
│   └── __tests__/                   # Component tests (Vitest + Vue Test Utils)
├── App.vue                          # Main application (tab navigation, state)
└── main.ts                          # Entry point
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API) |
| Language | TypeScript (strict mode) |
| Build | Vite |
| Charting | Chart.js 4.x + chartjs-plugin-a11y-legend |
| Testing | Vitest + Vue Test Utils |
| Linting | ESLint + oxlint + Prettier |
| Storage | Browser localStorage (web) / on-disk (desktop) |
| Desktop | Tauri v2 |

## Development Workflow

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

## Troubleshooting

### Port Already in Use
Vite will try the next available port (5174, 5175, etc.). Check the terminal output for the actual URL.

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

### Tests Failing
Ensure all dependencies are installed and up-to-date:
```bash
npm install
npm run test:unit
```

## Contributing

1. Create a feature branch from `main`
2. Implement with tests (TDD)
3. Ensure all checks pass:
   ```bash
   npm run test:unit && npm run type-check && npm run lint
   ```
4. Create a pull request with a clear description
