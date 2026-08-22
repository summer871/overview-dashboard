# Shared Filter Module Spec

**Date:** 2026-08-20  
**Status:** Proposed  
**Goal:** One reusable filter bar system that both Remake and TAT (and future tabs) instantiate with their own config.

## Design Principles

1. **Config-driven:** Each tab declares which filters it wants, in what order, with what labels
2. **Shared rendering:** One set of functions builds the dropdown UI, handles search, toggle, select-all, only, reset, visible-only
3. **Shared styling:** One CSS file (already mostly exists via the `.remakeDropdownButtonV6245` class family, just needs renaming)
4. **Tab-owned state:** Each tab owns its filter state object. The module reads/writes through a provided adapter, never owns the state directly
5. **Tab-owned data:** Each tab provides the option list (what appears in each dropdown). The module doesn't fetch data, it just renders what it's given

## Module API

```javascript
// SharedFilterBar.html exposes:
window.cdaSharedFilterBar = {
  version: 'v1.0',

  // Create a filter bar instance for a tab
  create(config) => FilterBarInstance,

  // Destroy an instance (cleanup listeners, DOM)
  destroy(instance)
};
```

## Config Shape

```javascript
const config = {
  // Unique key for this filter bar instance
  key: 'remake',  // or 'tat', 'wip', etc.

  // Where to mount the bar (CSS selector or element)
  mountTarget: '#remakeTabFilterHostV6337',

  // Filter definitions (order = display order)
  filters: [
    {
      key: 'year',
      label: 'Year',
      allLabel: 'All years',
      panelWidth: 300,        // optional, default 360
      position: 'left',       // 'left' | 'right' (dropdown anchor)
    },
    {
      key: 'department',
      label: 'Department',
      allLabel: 'All departments',
    },
    {
      key: 'product',
      label: 'Product',
      allLabel: 'All products',
    },
    {
      key: 'productGroup',    // TAT has this, Remake doesn't
      label: 'Group',
      allLabel: 'All groups',
    },
    {
      key: 'customer',
      label: 'Customer',
      allLabel: 'All customers',
      position: 'right',
      extras: ['activeOnly'],  // optional extra buttons in header
    },
    {
      key: 'reason',
      label: 'Reason',
      allLabel: 'All reasons',
      position: 'right',
    }
  ],

  // Adapter: the module calls these, tab implements them
  adapter: {
    // Return array of {key, label} for a filter type
    getOptions(filterKey) => [{key, label}],

    // Return current selection mode: 'ALL' | 'CUSTOM'
    getMode(filterKey) => string,

    // Return Set of selected keys
    getSelected(filterKey) => Set,

    // Called when user changes selection
    onSelectionChange(filterKey, selectedSet, mode) => void,

    // Called when user clicks "Only" on one option
    onExclusive(filterKey, key) => void,

    // Called when user clicks Reset on one filter
    onReset(filterKey) => void,

    // Called when user clicks global Reset All
    onResetAll() => void,

    // Return current search term (for restoring state)
    getSearch(filterKey) => string,

    // Called when search input changes
    onSearch(filterKey, term) => void,
  },

  // Optional features
  features: {
    globalSearch: true,       // fuzzy search across all filters
    dockInTabBar: true,       // move bar into tab row on wide screens
    dockBreakpoint: 1280,     // px threshold for docking
    pills: true,              // show active-filter pills
    visibleToggle: true,      // "Visible" checkbox in dropdown header
    undoRedo: false,          // Remake has this, TAT doesn't
    cacheActions: true,       // Reload/Refresh buttons
  }
};
```

## Instance Methods

```javascript
const instance = cdaSharedFilterBar.create(config);

// Force re-render all dropdowns (after data changes)
instance.render();

// Re-render one specific filter
instance.renderFilter('department');

// Open a specific dropdown programmatically
instance.open('department');

// Close all dropdowns
instance.closeAll();

// Update pills display
instance.renderPills();

// Get current pill data (for external rendering)
instance.getPills() => [{label, filterKey, clearAction}]

// Sync dock state (call on resize or tab switch)
instance.syncDock();

// Teardown
instance.destroy();
```

## How Remake Would Use It

```javascript
// In Remake's startup:
const remakeFilterBar = cdaSharedFilterBar.create({
  key: 'remake',
  mountTarget: '#remakeTabFilterHostV6337',
  filters: [
    {key: 'year', label: 'Year', allLabel: 'All years', panelWidth: 300},
    {key: 'department', label: 'Department', allLabel: 'All departments'},
    {key: 'product', label: 'Product', allLabel: 'All products'},
    {key: 'customer', label: 'Customer', allLabel: 'All customers', position: 'right', extras: ['activeOnly']},
    {key: 'reason', label: 'Reason', allLabel: 'All reasons', position: 'right'},
  ],
  adapter: {
    getOptions(key) { return remakeFilterOptions(key); },
    getMode(key) { return remakeFilterState.modes[key]; },
    getSelected(key) { return remakeFilterState.selected[key]; },
    onSelectionChange(key, set, mode) {
      remakeFilterState.selected[key] = set;
      remakeFilterState.modes[key] = mode;
      applyRemakeFactorFilters();
    },
    onExclusive(key, value) { onlyRemakeOption(key, value); },
    onReset(key) { resetRemakeFilter(key); },
    onResetAll() { clearRemakeFilterV6230('all'); },
    getSearch(key) { return remakeFilterState.searches[key] || ''; },
    onSearch(key, term) { remakeFilterState.searches[key] = term; },
  },
  features: {
    globalSearch: true,
    dockInTabBar: true,
    pills: true,
    visibleToggle: true,
    undoRedo: true,
    cacheActions: true,
  }
});
```

## How TAT Would Use It

```javascript
// In TAT's startup:
const tatFilterBar = cdaSharedFilterBar.create({
  key: 'tat',
  mountTarget: '#tatTabFilterHostV6509',
  filters: [
    {key: 'year', label: 'Year', allLabel: 'All years', panelWidth: 300},
    {key: 'department', label: 'Department', allLabel: 'All departments'},
    {key: 'product', label: 'Product', allLabel: 'All products'},
    {key: 'productGroup', label: 'Group', allLabel: 'All groups'},
    {key: 'customer', label: 'Customer', allLabel: 'All customers', position: 'right'},
    {key: 'reason', label: 'Reason', allLabel: 'All reasons', position: 'right'},
  ],
  adapter: {
    getOptions(key) { return tatOptionList(key); },
    getMode(key) { return state.modes[key]; },
    getSelected(key) { return state.selected[key]; },
    onSelectionChange(key, set, mode) {
      state.selected[key] = set;
      state.modes[key] = mode;
      renderAll();
    },
    onExclusive(key, value) { onlyTatOptionV6509(key, value); },
    onReset(key) { resetTatFilterV6509(key); },
    onResetAll() { resetTatAllV6509(); },
    getSearch(key) { return state.searches[key] || ''; },
    onSearch(key, term) { state.searches[key] = term; },
  },
  features: {
    globalSearch: true,
    dockInTabBar: true,
    pills: true,
    visibleToggle: true,
    undoRedo: false,
    cacheActions: true,
  }
});
```

## Implementation Plan

### Phase 1: Extract (non-breaking)
1. Create `SharedFilterBar.html` with the shared rendering + interaction logic
2. Create `SharedFilterBarStyles.html` with the CSS (rename from `remakeDropdown*` to `cdaFilter*` classes)
3. Keep old class names as aliases initially so nothing breaks

### Phase 2: Wire Remake
4. Replace Remake's inline filter markup generation with `cdaSharedFilterBar.create()`
5. Remake's adapter delegates to existing state/render functions
6. Verify identical behavior: search, multi-select, only, pills, dock, undo/redo

### Phase 3: Wire TAT
7. Replace TAT's `filterMarkup()` + all `toggleTatDropdownV6509`/`searchTatFilterV6509`/etc with `cdaSharedFilterBar.create()`
8. TAT's adapter delegates to its existing state/render
9. Remove ~200 lines of duplicated filter logic from TatDashboardControllerScript.html

### Phase 4: Cleanup
10. Remove old Remake-specific filter rendering code
11. Remove CSS class aliases once nothing references the old names
12. Delete dead filter code from DashboardMainScript.html

## What Stays Tab-Specific

- Which filters appear and in what order
- The data source for each filter's options
- What happens when a filter changes (each tab's own render/state cycle)
- Undo/redo (Remake has it, TAT doesn't)
- Cross-filter behavior (TAT has month/bucket/lateBand cross-filters that aren't filter-bar dropdowns)
- Extra header buttons (e.g. Remake's "Active only" on customers)

## What Becomes Shared

- Dropdown markup generation
- Search/fuzzy matching within a dropdown
- Multi-select toggle/only/select-all/clear/none/visible
- Dropdown positioning (fixed, viewport-aware)
- Pill rendering
- Docking into tab bar on wide screens
- Global search panel
- Keyboard handling (Escape to close)
- Click-outside-to-close
- Count display ("5 of 12 visible selected")
- All CSS styling

## File Size Estimate

- `SharedFilterBar.html`: ~15-20KB (logic)
- `SharedFilterBarStyles.html`: ~8-10KB (CSS)
- Net reduction from Remake + TAT: ~25-30KB removed from each

## Risk

Low. The two implementations already look and behave identically (by design). The adapter pattern means neither Remake nor TAT's internal state management changes. It's a rendering/interaction refactor, not a behavior change.
