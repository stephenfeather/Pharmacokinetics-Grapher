# Implementation Plan: Create TaskMaster PRD from CLAUDE.md

## Context

The project has a comprehensive CLAUDE.md file that documents the entire Pharmacokinetics Grapher application for use with Claude Code. To integrate with the TaskMaster workflow system (located in `.taskmaster/`), we need to create a formal Product Requirements Document (PRD) that follows the TaskMaster template format.

This PRD will serve as the authoritative source for:
- Breaking down the project into discrete tasks
- Understanding the logical dependency chain for implementation
- Identifying MVP scope vs future enhancements
- Risk assessment and mitigation strategies

The transformation is straightforward: extract and reorganize content from CLAUDE.md into the structured PRD format defined in `.taskmaster/templates/example_prd.txt`.

## Approach

### 1. Create PRD File Structure

**File to create**: `.taskmaster/docs/prd.txt`

**Sections to include** (following template):

#### Context Section
- Extract from CLAUDE.md "Project Overview" and "Key Characteristics"
- Summarize the problem (medication visualization), target users (patients/caregivers), and value proposition (educational PK visualization)

#### Core Features
- Prescription input form (drug name, dose, frequency, timing, PK parameters)
- Pharmacokinetic calculations (one-compartment model, multi-dose accumulation)
- Graph visualization (Chart.js line charts with peak/trough curves)
- Prescription storage (localStorage for persistence)
- Prescription management (CRUD operations, comparison mode)

#### User Experience
- Primary persona: Patients/caregivers wanting to understand medication timing
- Key user flows:
  1. Add new prescription → input form → validate → calculate → visualize
  2. View saved prescriptions → select → display graph
  3. Compare multiple medications → multi-select → overlay graphs
- UI/UX: Clean scientific visualization, clear axis labels, educational disclaimers

#### Technical Architecture
- Frontend: Vue 3 + TypeScript + Vite
- Charting: Chart.js for scientific accuracy
- Storage: localStorage (IndexedDB fallback for future)
- Testing: Vitest + Vue Test Utils
- Code structure: Core domain (calculations) separated from UI (components)

Map to CLAUDE.md sections:
- Tech Stack → System components
- Prescription Model → Data models
- Architecture & Code Organization → Module structure

#### Development Roadmap

**Phase 1: Foundation & Core Calculations (MVP)**
- Set up Vue 3 + TypeScript + Vite project
- Implement data models (`Prescription`, `TimeSeriesPoint`, `GraphDataset`)
- Implement PK calculation engine (pure functions):
  - Single-dose concentration calculation
  - Multi-dose accumulation
  - Normalization to 0-1 scale
- Unit tests for calculations (known-value reference cases)
- Edge case handling (ka≈ke, zero dose, extreme half-lives)

**Phase 2: Basic UI (Minimal Viable Product)**
- `PrescriptionForm.vue`: Input form with validation
- Frequency picker (bid/tid/qid/q6h/q8h/q12h/once/custom)
- Time picker (HH:MM format, validates against frequency)
- Simple graph display (single prescription, basic Chart.js setup)
- localStorage persistence (save/load single prescription)

**Phase 3: Visualization & Multi-Drug Support**
- `GraphViewer.vue`: Full Chart.js integration
- Proper axis labels (time in hours, relative concentration 0-1)
- Multi-prescription overlay (distinct colors, legend)
- Custom timeframe selection (start/end times)
- Educational disclaimer overlay

**Phase 4: Prescription Management**
- `PrescriptionList.vue`: List saved prescriptions
- CRUD operations (edit, delete, duplicate)
- Quick preview mode
- Comparison mode (multi-select for overlay)

**Phase 5: Polish & Testing**
- Component tests for all Vue components
- Integration tests (form → calculation → graph)
- Regression test suite (JSON snapshots of reference curves)
- Linting + type checking in CI
- Production build optimization

**Future Enhancements** (post-MVP):
- Metabolite visualization (two-compartment model)
- Export graph as PNG/PDF
- Share prescription URL
- IndexedDB migration for large datasets
- Drug library with pre-filled PK parameters
- Mobile-responsive design improvements

#### Logical Dependency Chain

**Foundation First** (must be built sequentially):
1. **Data models** (`prescription.ts`) → Everything depends on type definitions
2. **PK calculation engine** (`pkCalculator.ts`, `concentrationCurve.ts`, `multiDoseProfile.ts`) → Core scientific logic, must be correct before UI
3. **Calculation tests** → Validate math before building UI on top

**Parallel Development** (can build concurrently after foundation):
- **PrescriptionForm.vue** (input) + **localStorage wrapper** (persistence)
- **GraphViewer.vue** (visualization) - can use mock data during development

**Integration** (after parallel components):
- Wire form → storage → graph pipeline
- Add PrescriptionList for management

**Polish** (final):
- Component tests
- Integration tests
- Visual refinement

**Critical Path**: Data models → PK calculations → PK tests → Form + Graph → Integration

**MVP Milestone**: After Phase 2 (foundation + basic UI), user can:
- Enter a prescription
- See the PK curve
- Save/load prescriptions

This is the smallest usable product. Everything else is enhancement.

#### Risks and Mitigations

**Technical Risks**:

1. **PK Calculation Accuracy** (HIGH IMPACT)
   - Risk: Incorrect math → misleading graphs → user harm
   - Mitigation:
     - Use known-value reference cases from pharmacology textbooks
     - Implement regression test suite with golden values
     - Handle edge cases explicitly (ka≈ke fallback, zero dose, extreme values)
     - Prominent educational disclaimer

2. **Edge Case Instability** (MEDIUM IMPACT)
   - Risk: `ka ≈ ke` causes division-by-zero or numerical instability
   - Mitigation:
     - Implement fallback formula: `C(t) ≈ Dose × ka × t × e^(-ke×t)` when `|ka - ke| < 0.001`
     - Warn user if uptake ≈ halfLife
     - Comprehensive edge case tests

3. **Chart Rendering Performance** (LOW IMPACT)
   - Risk: Large datasets (weeks/months timeframe) slow down Chart.js
   - Mitigation:
     - Use 15-minute time steps (reasonable detail, efficient)
     - Lazy rendering for multiple prescriptions
     - Consider downsampling for very long timeframes

4. **Browser Storage Limits** (LOW IMPACT)
   - Risk: localStorage fills up (5-10MB limit)
   - Mitigation:
     - localStorage sufficient for typical use (~100 prescriptions)
     - Plan IndexedDB migration if needed
     - Show storage usage warning

**Scope Risks**:

1. **Feature Creep** (MEDIUM IMPACT)
   - Risk: Adding metabolite visualization, drug interactions, etc. delays MVP
   - Mitigation:
     - Strict MVP definition: single-drug, one-compartment model only
     - Document future enhancements separately
     - Get to working UI quickly (Phase 2 = MVP)

2. **Over-Engineering** (MEDIUM IMPACT)
   - Risk: Building complex state management (Pinia) when not needed
   - Mitigation:
     - Start with simple Vue `ref` + `provide/inject`
     - Only add Pinia if complexity justifies it
     - Follow YAGNI principle

**User Experience Risks**:

1. **Misinterpretation as Medical Advice** (HIGH IMPACT)
   - Risk: Users make dosing decisions based on app output
   - Mitigation:
     - Prominent disclaimer on every screen
     - "Educational purposes only" messaging
     - Explicit "not for medical decisions" warning
     - Use relative concentration (0-1), not absolute mg/L

#### Appendix

**Key Technical Specifications**:

- **PK Model**: One-compartment, first-order absorption, first-order elimination
- **Equation**: `C(t) = Dose × [ka/(ka - ke)] × (e^(-ke×t) - e^(-ka×t))`
- **Rate Constants**: `ka = 0.693/uptake`, `ke = 0.693/halfLife`
- **Normalization**: Final curve scaled to peak = 1.0
- **Time Resolution**: 15-minute intervals
- **Frequency Labels**: `once`, `bid`, `tid`, `qid`, `q6h`, `q8h`, `q12h`, `custom`

**Validation Rules** (from CLAUDE.md):
- Name: 1-100 characters
- Dose: 0.001 - 10000 (units)
- Half-life: 0.1 - 240 hours
- Peak (Tmax): 0.1 - 48 hours
- Uptake: 0.1 - 24 hours
- Times: HH:MM format, count must match frequency

**File Structure**:
```
src/
├── core/
│   ├── models/prescription.ts
│   ├── calculations/
│   │   ├── pkCalculator.ts
│   │   ├── concentrationCurve.ts
│   │   └── multiDoseProfile.ts
│   └── storage/prescriptionStorage.ts
├── components/
│   ├── PrescriptionForm.vue
│   ├── GraphViewer.vue
│   └── PrescriptionList.vue
├── App.vue
└── main.ts
```

**Testing Strategy**:
- Unit tests: PK calculations (high coverage)
- Component tests: Vue components (form validation, chart rendering)
- Regression tests: JSON snapshots of reference curves
- No E2E tests for MVP (manual browser testing sufficient)

**Development Workflow**:
1. TDD: Tests first for calculations
2. Implementation: Write feature code
3. Integration: Wire into UI
4. Manual testing: Verify in browser
5. Quality gates: tests pass, types pass, lint passes

## Critical Files

- **Source**: `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/CLAUDE.md` (read-only, reference)
- **Template**: `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/.taskmaster/templates/example_prd.txt` (read-only, format reference)
- **Target**: `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/.taskmaster/docs/prd.txt` (to be created)

## Verification

After creating the PRD:
1. Read `.taskmaster/docs/prd.txt` to verify structure
2. Compare against template to ensure all sections present
3. Verify content accurately reflects CLAUDE.md specifications
4. Check that roadmap phases are properly scoped and sequenced
5. Confirm logical dependency chain is clear and actionable

## Implementation Steps

1. **Create PRD file**: Write `.taskmaster/docs/prd.txt` with all sections
2. **Verify content**: Read the created file to ensure completeness
3. **Cross-check**: Compare against template structure and CLAUDE.md content

This is a straightforward documentation task with no code changes required.
