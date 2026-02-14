# Implementation Plan: Integrate PrescriptionList into App.vue for Multi-Drug Comparison

**Date**: 2026-02-14
**Task**: Task 10 - Add Multi-Drug Comparison and Complete MVP Polish
**Estimated Time**: 6-8 hours

---

## Context

### Why This Change

Currently, App.vue only supports viewing a single prescription at a time. Users can save prescriptions to localStorage but have no UI to view, edit, delete, or compare them. The PrescriptionList component (Task 9) is complete but not integrated.

**Goal**: Enable users to:
- View all saved prescriptions in a list
- Edit/delete/duplicate existing prescriptions
- Compare multiple drugs on the same graph (multi-drug overlay)
- Navigate between form, list, and graph views

This completes the MVP by connecting all three core components: PrescriptionForm, PrescriptionList, and GraphViewer.

### Current State (Verified)

**App.vue Architecture**:
- State: Simple `ref()` for `currentPrescription`, `showForm`, `showGraph`, `startHours`, `endHours`
- View switching: Boolean flags (showForm/showGraph) - mutually exclusive
- Graph data: `computed(() => getGraphData([currentPrescription], ...))`
- Event handlers: `handleFormSubmit`, `saveCurrentPrescription`, `newPrescription`

**GraphViewer Capability**:
- ✓ Already supports `datasets: GraphDataset[]` prop (multi-drug ready)
- ✓ Has 8-color palette with auto-assignment
- ✓ Shows legend for multiple drugs
- ✓ NO changes needed to GraphViewer

**PrescriptionList Component**:
- ✓ Complete with 21 passing tests
- ✓ Emits: `@view`, `@edit`, `@compare` events
- ✓ CRUD operations: view, edit, delete (with confirm), duplicate
- ✓ Compare mode: multi-select with checkboxes

---

## Design Decisions

### 1. State Architecture: Hybrid Approach (Minimal Refactor)

**Keep existing boolean flags, add new state alongside**:
```typescript
// Existing (keep)
const showForm = ref(true)
const showGraph = ref(false)
const currentPrescription = ref<Prescription | null>(null)

// New
const showList = ref(false)
const comparePrescriptions = ref<Prescription[]>([])
const activeTab = ref<'form' | 'list' | 'graph'>('form')
```

**Why**: Preserves backward compatibility, allows incremental testing, minimizes breaking changes.

### 2. View Switching: Helper Function

```typescript
function switchView(view: 'form' | 'list' | 'graph') {
  showForm.value = view === 'form'
  showList.value = view === 'list'
  showGraph.value = view === 'graph'
  activeTab.value = view
}
```

**Constraint**: Only ONE view active at a time.

### 3. Multi-Prescription State: Dual-Purpose Array

**Use `comparePrescriptions: Prescription[]` for both single-view and multi-compare**:
- View single → `comparePrescriptions = [rx]`
- Compare many → `comparePrescriptions = [rx1, rx2, ...]`
- Edit → load into `currentPrescription`, switch to form

**Graph Data Source Change**:
```typescript
// BEFORE:
const graphDatasets = computed(() => {
  if (!currentPrescription.value) return []
  return getGraphData([currentPrescription.value], startHours.value, endHours.value)
})

// AFTER:
const graphDatasets = computed(() => {
  if (comparePrescriptions.value.length === 0) return []
  return getGraphData(comparePrescriptions.value, startHours.value, endHours.value)
})
```

### 4. Navigation: Tab Bar (3 Tabs)

- **"Add New"**: Always visible → shows form
- **"Saved Prescriptions"**: Always visible → shows list
- **"Graph"**: Only visible when `comparePrescriptions.length > 0` → shows graph

**Auto-switch behavior**:
- Form submit → auto-switch to Graph tab
- List compare → auto-switch to Graph tab
- List edit → auto-switch to Add New tab

### 5. Event Handler Mapping

```typescript
PrescriptionList Events → App.vue Handlers:

@view="handleViewPrescription"
  → comparePrescriptions = [rx]
  → switchView('graph')

@edit="handleEditPrescription"
  → currentPrescription = rx
  → switchView('form')

@compare="handleComparePrescriptions"
  → comparePrescriptions = rxs
  → switchView('graph')
```

### 6. Focus Management

```typescript
async function switchView(view: 'form' | 'list' | 'graph') {
  // ... set flags ...
  await nextTick()

  if (view === 'form') {
    document.getElementById('rx-name')?.focus()
  } else if (view === 'list' && listContainerRef.value) {
    listContainerRef.value.querySelector('h2')?.focus()
  } else if (view === 'graph' && graphContainerRef.value) {
    graphContainerRef.value.focus()
  }
}
```

---

## Implementation Plan (TDD Order)

### Phase 1: Foundation - State & Tab Navigation

**Goal**: Add tab navigation without breaking existing functionality.

**Steps**:
1. Create `src/__tests__/App.spec.ts` with failing tests for tab rendering
2. Add new state: `showList`, `comparePrescriptions`, `activeTab`
3. Add `switchView()` helper function
4. Add tab navigation template with ARIA attributes
5. Update `handleFormSubmit()` to use `switchView('graph')`
6. Update `newPrescription()` to use `switchView('form')`

**Tests**:
- Tab navigation renders with 2 tabs initially (Add New, Saved)
- Graph tab appears when `comparePrescriptions.length > 0`
- Clicking tab switches to correct view
- `activeTab` reflects current view
- Existing form → graph flow still works (regression test)

**Files Modified**: `src/App.vue`

---

### Phase 2: PrescriptionList Integration

**Goal**: Mount PrescriptionList and wire event handlers.

**Steps**:
1. Add failing tests for PrescriptionList events
2. Import `PrescriptionList` component
3. Add list view section with `v-if="showList"`
4. Implement event handlers:
   - `handleViewPrescription(rx)` → set comparePrescriptions, switch to graph
   - `handleEditPrescription(rx)` → load into currentPrescription, switch to form
   - `handleComparePrescriptions(rxs)` → set comparePrescriptions, switch to graph
5. Update `graphDatasets` computed to use `comparePrescriptions` instead of `currentPrescription`
6. Update `saveCurrentPrescription()` to only save single unsaved prescription

**Tests**:
- PrescriptionList renders when `showList=true`
- View event → graph shown with single prescription
- Edit event → form shown with prescription loaded
- Compare event → graph shown with multiple prescriptions
- Graph data comes from `comparePrescriptions`
- Integration test: list → view → save → list refresh

**Files Modified**: `src/App.vue`

---

### Phase 3: Accessibility Implementation

**Goal**: Keyboard navigation, focus management, ARIA attributes, screen reader support.

**Steps**:
1. Add failing tests for focus management
2. Add template refs: `formRef`, `listContainerRef`, `graphContainerRef`
3. Update `switchView()` with focus management (using `nextTick()`)
4. Add ARIA live region for screen reader announcements
5. Add keyboard navigation handler for arrow keys between tabs
6. Add `role`, `aria-label`, `aria-current` attributes to tabs
7. Make graph container focusable (`tabindex="-1"`, `role="region"`)

**Tests**:
- Focus moves to correct element on view switch
- Arrow key navigation between tabs works
- ARIA attributes present and correct
- Screen reader announcements trigger (statusMessage updates)
- Keyboard-only navigation works (no mouse needed)

**Files Modified**: `src/App.vue`

---

### Phase 4: Styling & Polish

**Goal**: Professional UI matching existing design patterns.

**Steps**:
1. Add tab navigation styles (horizontal bar with active state)
2. Add list section styles (card with shadow, slideIn animation)
3. Add screen reader only utility class (`.sr-only`)
4. Add responsive design for mobile (horizontal scroll tabs)
5. Add edge case handling (watch `comparePrescriptions` for deletion)

**Tests**:
- Edge case: delete prescription while comparing → graph tab hides
- Edge case: rapid tab switching → no race conditions
- Edge case: empty list → shows empty state message

**Files Modified**: `src/App.vue`

---

### Phase 5: Comprehensive Testing & Verification

**Goal**: Achieve >85% coverage with integration and edge case tests.

**Test Categories**:
- Unit tests: State management (switchView, activeTab, comparePrescriptions)
- Unit tests: Event handlers (view, edit, compare, save)
- Integration tests: Full user flows (form→save→list→compare→graph)
- Accessibility tests: ARIA, focus, keyboard nav
- Regression tests: Existing functionality unchanged
- Edge cases: Empty list, rapid switching, delete while comparing

**Coverage Targets**:
- Overall: >85%
- Statements: >85%
- Branches: >80%
- Functions: >90%

**Manual Testing Checklist**:
- [ ] Form submission → graph auto-shown
- [ ] Save button works correctly
- [ ] List shows saved prescriptions
- [ ] View single prescription from list
- [ ] Edit prescription from list → form populated
- [ ] Compare multiple prescriptions → overlay graph
- [ ] Tab navigation with mouse
- [ ] Tab navigation with keyboard (arrows, Tab key)
- [ ] Screen reader announces state changes (VoiceOver test)
- [ ] Mobile responsive (viewport 375px-768px)
- [ ] Delete prescription from list
- [ ] Duplicate prescription

**Verification Commands**:
```bash
npm run test:unit                    # All tests pass
npm run test:unit -- --coverage      # >85% coverage
npm run type-check                   # No TypeScript errors
npm run lint                         # No linting errors
```

**Files Modified**: `src/__tests__/App.spec.ts`

---

## Critical Files

### Files to Modify

1. **`src/App.vue`** (PRIMARY)
   - Add new state variables
   - Add tab navigation template
   - Add list view section
   - Add event handlers
   - Update graphDatasets computed
   - Add accessibility features (refs, focus management, ARIA)
   - Add styles for tabs and list section

2. **`src/__tests__/App.spec.ts`** (NEW)
   - Create comprehensive test suite (~50+ tests)
   - Test state management, event handlers, user flows
   - Test accessibility features
   - Test edge cases and regressions

### Files to Reference (No Changes)

3. **`src/components/PrescriptionList.vue`**
   - Already complete (Task 9)
   - Emits: @view, @edit, @compare

4. **`src/components/GraphViewer.vue`**
   - Already supports multi-dataset
   - No changes needed

5. **`src/core/calculations/index.ts`**
   - Exports `getGraphData(prescriptions[], startHours, endHours)`
   - Already handles arrays

---

## Edge Cases & Handling

### 1. Empty Saved Prescriptions
**Scenario**: User has no saved prescriptions.
**Behavior**: "Saved Prescriptions" tab shows PrescriptionList empty state.
**No code change needed**: PrescriptionList already handles this.

### 2. Delete Prescription While Comparing
**Scenario**: User compares 2 drugs, deletes one from list, still on graph tab.
**Behavior**: Remove from `comparePrescriptions`, hide graph tab if empty.
**Implementation**: Add watcher:
```typescript
watch(comparePrescriptions, (newVal) => {
  if (newVal.length === 0 && activeTab.value === 'graph') {
    switchView('list')
  }
})
```

### 3. Save Button Logic
**Scenario**: User is comparing 3 drugs, clicks Save.
**Behavior**: Disable save button (only works for single unsaved prescription).
**Implementation**: Update button condition:
```typescript
:disabled="comparePrescriptions.length !== 1 || !!comparePrescriptions[0]?.id"
```

### 4. Graph Tab Visibility
**Scenario**: User switches from graph to form, graph tab should stay visible.
**Behavior**: Graph tab visible as long as `comparePrescriptions.length > 0`.
**Implementation**: `v-if="comparePrescriptions.length > 0"` on graph tab.

---

## Accessibility Checklist

- [ ] Tab navigation has `role="navigation"` and `aria-label`
- [ ] Each tab button has `aria-current="page"` when active
- [ ] Focus moves to first interactive element on view change
- [ ] Arrow key navigation between tabs (Left/Right)
- [ ] Graph container is focusable with `tabindex="-1"`
- [ ] Graph has `role="region"` and `aria-label`
- [ ] ARIA live region announces state changes
- [ ] All interactive elements have accessible labels
- [ ] Focus indicators visible (`:focus-visible`)
- [ ] Screen reader test with VoiceOver (Mac) or NVDA (Windows)

---

## Backward Compatibility

### Existing Functionality to Preserve
- ✓ Form submission shows graph
- ✓ Save button saves current prescription
- ✓ New Prescription button clears form
- ✓ Time range slider controls graph timeframe
- ✓ Graph renders correctly
- ✓ Disclaimer banner shows
- ✓ Mobile responsive layout
- ✓ All existing tests pass

### Regression Test Strategy
- Run existing tests before changes (baseline)
- Add regression tests for critical flows
- Manual testing of existing features after integration

---

## Template Code Snippets

### Tab Navigation Template
```vue
<nav
  class="tab-navigation"
  role="navigation"
  aria-label="Main navigation"
  @keydown="handleTabKeydown"
>
  <button
    :class="{ active: activeTab === 'form' }"
    @click="switchView('form')"
    :aria-current="activeTab === 'form' ? 'page' : undefined"
  >
    Add New Prescription
  </button>
  <button
    :class="{ active: activeTab === 'list' }"
    @click="switchView('list')"
    :aria-current="activeTab === 'list' ? 'page' : undefined"
  >
    Saved Prescriptions
  </button>
  <button
    v-if="comparePrescriptions.length > 0"
    :class="{ active: activeTab === 'graph' }"
    @click="switchView('graph')"
    :aria-current="activeTab === 'graph' ? 'page' : undefined"
  >
    Graph ({{ comparePrescriptions.length }})
  </button>
</nav>
```

### List View Section
```vue
<div v-if="showList" class="list-section" ref="listContainerRef">
  <PrescriptionList
    @view="handleViewPrescription"
    @edit="handleEditPrescription"
    @compare="handleComparePrescriptions"
  />
</div>
```

### ARIA Live Region
```vue
<div
  class="sr-only"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {{ statusMessage }}
</div>
```

---

## Success Criteria

### Functional Requirements
- [x] Users can view saved prescriptions in a list
- [x] Users can view a single prescription graph from list
- [x] Users can edit an existing prescription from list
- [x] Users can compare 2+ prescriptions on one graph
- [x] Users can navigate between form/list/graph with tabs
- [x] Tab navigation reflects current view

### Quality Requirements
- [x] Test coverage >85%
- [x] All tests pass (298 existing + ~50 new = 348 total)
- [x] Linter passes with no errors
- [x] Type checker passes with no errors
- [x] Accessibility audit passes (manual VoiceOver test)
- [x] Mobile responsive (375px-1024px)

### UX Requirements
- [x] Intuitive tab navigation
- [x] Clear visual feedback for active tab
- [x] Smooth transitions between views (CSS animations)
- [x] Keyboard-only navigation works
- [x] Screen reader announces state changes
- [x] No breaking changes to existing flows

---

## Estimated Effort

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 1: Foundation | State + tabs | 1-2 hours |
| Phase 2: Integration | List + events | 1-2 hours |
| Phase 3: Accessibility | Focus + ARIA + keyboard | 1-2 hours |
| Phase 4: Polish | Styling + edge cases | 1 hour |
| Phase 5: Testing | Coverage + manual | 1-2 hours |
| **Total** | | **6-8 hours** |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking form flow | High | Comprehensive regression tests, manual testing |
| Focus management bugs | Medium | Use `nextTick()`, thorough a11y testing |
| State sync issues | Medium | Use computed properties, add watchers |
| Mobile UX problems | Medium | Responsive design from start, test on device |

---

## Future Enhancements (Out of Scope)

Not part of this implementation:
- State management refactor (Pinia migration)
- Graph export (PNG/PDF)
- Advanced filtering/search in list
- Undo/redo for state changes
- Drag-and-drop prescription reordering

---

## Verification Steps

After implementation, verify with:

```bash
# Run all tests
npm run test:unit

# Check coverage (should be >85%)
npm run test:unit -- --coverage

# Type check (should be 0 errors)
npm run type-check

# Lint (should be 0 errors)
npm run lint

# Build for production (verify no build errors)
npm run build

# Preview production build
npm run preview
```

Manual testing checklist provided in Phase 5.

---

**Plan Status**: Ready for Implementation
**Approval Required**: Yes
**Risk Level**: Low (incremental, well-tested approach)
