# Executive Overview Dashboard - Shared Filter and Header Platform Specification

**Document type:** Living architecture and UX specification  
**Created:** 2026-08-05  
**Verified code baseline:** `72813030bf0c2539a4ebadb8d4c75abacd98eef8`  
**Implementation status:** Specification only; no application code changed by this document  
**Companion source of truth:** `OVERVIEW-DASHBOARD-METRIC-SOURCE-OF-TRUTH.md`

## Purpose

Remake and Turnaround Time should feel like two pages in one product, not two separately built dashboards.

They should share:

- The same header structure.
- The same spacing and visual language.
- The same dropdown interaction model.
- The same search, reset, active-filter, keyboard, persistence, and responsive behavior.
- The same capability-registration concept used by the shared table platform.

They should not be forced to expose the same filters or actions.

Each page opts into the capabilities it actually supports. A shared implementation renders only the capabilities declared by that page.

## Core architecture rule

There must be one authoritative shared header/filter platform.

A page definition supplies configuration and adapters. It does not create a second dropdown system, settings panel, saved-view implementation, responsive toolbar, or persistence layer.

This follows the same model as shared tables:

- Shared platform owns behavior and presentation.
- Page definition declares capabilities.
- Page adapter maps shared actions to page-specific data and state.
- Unsupported capabilities are absent, not disabled placeholders.

## Current-state problems confirmed in source

### Separate construction paths

- Remake filter controls are built inside the large Remake page implementation.
- Remake saved views/settings are implemented in `RemakeResponsiveScript.html` and styled in `RemakeResponsiveStyles.html`.
- TAT creates its own filter host and dropdown markup inside `TatDashboardControllerScript.html`.
- TAT also creates a separate Settings button and panel.

These paths reuse some class names but do not share one behavior owner.

### Settings means different things

#### Remake

The desktop settings button opens a saved-view manager containing:

- Save current filter snapshot.
- Apply/update/rename/delete saved views.
- Open default.
- Reset default.

Its accessible title is currently `Settings, saved views, and defaults`.

#### TAT

The Settings button opens a `TAT view` panel that currently contains only a note saying the distribution is shown as percent of eligible cases.

This is not the same capability and should not use the same generic Settings concept.

### Filter inventories drift

The current source exposes:

| Filter | Remake | TAT current source | Target decision |
|---|---:|---:|---|
| Year | Yes | Yes | Shared capability, page opted in |
| Department | Yes | Yes | Shared capability, page opted in |
| Product | Yes | Yes | Shared capability, page opted in |
| Product Group | Yes | Yes | Shared capability, page opted in |
| Customer | Yes | Yes | Shared capability, page opted in |
| Remake Reason | Yes | Yes | Remake only; TAT opts out |

The shared platform must not infer available filters from another page or from visible markup. The page definition is authoritative.

### Remake saved-view completeness defect

The active Remake filter metadata includes Product Group, but the current saved-view helper snapshots only Year, Department, Product, Customer, and Reason.

A shared preset implementation must derive its snapshot fields from the page capability definition so an enabled filter cannot be silently omitted.

## Terminology

Use these product terms consistently:

- **Filter header:** The complete shared top control surface for one dashboard page.
- **Filter dropdown:** A multi-select control for one dimension.
- **Active filter:** A selected value or cross-filter currently limiting the page population.
- **Saved filter preset:** A named snapshot of the page's enabled filter values and exclusions.
- **Page options:** Optional page-level display or behavior preferences that are not filter presets.
- **Capability:** A registered feature that a page may enable or omit.

Do not use one generic `Settings` label for saved filter presets and unrelated display notes.

## Proposed ownership

### New shared owner

Create one shared module, provisionally named:

- `SharedDashboardFilterHeader.html`

The exact version suffix should follow the repository's current release conventions when implemented.

This module owns:

- Header shell and spacing.
- Filter-button and dropdown rendering.
- Dropdown positioning.
- Search within a filter.
- Select all, none, visible, and reset behavior.
- Active-filter summary and chips.
- Global filter search when enabled.
- Saved filter presets when enabled.
- Page options button/panel when enabled.
- Header reset action.
- Responsive/compact presentation.
- Keyboard and focus behavior.
- Persistence namespace and migrations.
- Shared header audit API.

### Page definitions

Remake and TAT definitions declare their capabilities and order.

Provisionally:

- `RemakeDashboardDefinitionV6548.html`
- `TatDashboardDefinitionV6547.html`

The definition should remain declarative. It should not contain DOM-building logic.

### Page adapters

Adapters provide page-specific functions such as:

- Read filter options.
- Read selected values and exclusions.
- Apply a filter state.
- Reset one filter.
- Reset all page filters.
- Return active-filter chips.
- Apply a global-search selection.
- Read/write cross-filter state when the page elects to expose it.
- Refresh the page after state changes.

The shared platform must not reach into private page variables by guessing IDs or field names.

## Proposed registration contract

Illustrative only; final names should match the existing registry conventions.

```javascript
window.cdaDashboardFilterHeader.registerPage({
  pageKey: 'remake',
  hostId: 'remakeTabFilterHostV6337',
  filters: [
    { key: 'year', label: 'Year', allLabel: 'All years' },
    { key: 'department', label: 'Department', allLabel: 'All departments' },
    { key: 'product', label: 'Product', allLabel: 'All products' },
    { key: 'productGroup', label: 'Group', allLabel: 'All groups' },
    { key: 'customer', label: 'Customer', allLabel: 'All customers' },
    { key: 'reason', label: 'Remake reason', allLabel: 'All remake reasons' }
  ],
  capabilities: {
    globalSearch: true,
    savedFilterPresets: true,
    pageOptions: false,
    resetAll: true,
    reloadCache: true,
    refreshCache: true
  },
  adapter: remakeFilterHeaderAdapter
});
```

```javascript
window.cdaDashboardFilterHeader.registerPage({
  pageKey: 'tat',
  hostId: 'tatTabFilterHostV6509',
  filters: [
    { key: 'year', label: 'Year', allLabel: 'All years' },
    { key: 'department', label: 'Department', allLabel: 'All departments' },
    { key: 'product', label: 'Product', allLabel: 'All products' },
    { key: 'productGroup', label: 'Group', allLabel: 'All groups' },
    { key: 'customer', label: 'Customer', allLabel: 'All customers' }
  ],
  capabilities: {
    globalSearch: true,
    savedFilterPresets: true,
    pageOptions: false,
    resetAll: true,
    reloadCache: true,
    refreshCache: true
  },
  adapter: tatFilterHeaderAdapter
});
```

The key requirement is not the exact object shape. It is that the filter list and optional actions come from one declarative capability record.

## Default page capability decisions

### Remake

Enable:

- Year.
- Department.
- Product.
- Product Group.
- Customer.
- Remake Reason.
- Global filter search.
- Saved filter presets.
- Reset all.
- Reload cache.
- Refresh cache.

Do not create a separate generic Settings panel unless Remake later has real page options distinct from saved presets.

The saved-preset action should be labeled clearly, for example:

- `Saved filters`
- `Filter presets`

Do not label it only `Settings`.

### TAT

Enable:

- Year.
- Department.
- Product.
- Product Group.
- Customer.
- Global filter search.
- Saved filter presets.
- Reset all.
- Reload cache.
- Refresh cache.

Do not enable:

- Remake Reason.
- A generic Settings button whose only content is explanatory text.

The current distribution note should move to one of these locations:

- The distribution card subtitle.
- A tooltip/help affordance owned by that component.
- The metric source-of-truth documentation.

It is not a page-level setting.

## Saved filter presets

Saved presets should use one shared implementation for both pages.

### Snapshot contents

A preset must contain:

- Schema version.
- Page key.
- Every enabled top filter.
- Include/exclude state where supported.
- The filter mode (`ALL`, `CUSTOM`, `NONE`, or the shared equivalent).
- Optional active cross-filters only when the page definition explicitly opts into saving them.
- Created and updated timestamps.

The platform must derive snapshot fields from the page registration. No hardcoded list may omit an enabled filter.

### What presets must not contain by default

Unless separately approved, a saved filter preset does not include:

- Card layout.
- Column widths/order/visibility.
- Sort state.
- KPI visibility.
- Chart mode.
- Cache freshness or data payload.

Those states already have separate owners and persistence boundaries.

### Default behavior

Support two optional defaults only when the page enables them:

- **Open default:** Preset automatically applied when the page is initialized for the user.
- **Reset default:** Preset applied when the user chooses Reset All instead of returning to unrestricted filters.

The UI must describe these behaviors plainly. Defaults are personal browser state unless a future authenticated/shared-preference service is deliberately introduced.

### Migration

When the shared platform replaces the Remake saved-view implementation:

- Read and migrate `cdaRemakeFactorSavedViews.v6382` once.
- Add the omitted Product Group field as unrestricted when migrating an older snapshot.
- Preserve existing names and timestamps where possible.
- Record a migration version so it is not repeated.
- Do not delete the old storage key until the migrated state is validated.

For TAT:

- Existing `cdaTatViewState.v6509` is current filter state, not a named preset collection.
- Preserve current selected filters during migration.
- Do not mislabel current state as a saved preset.

## Filter behavior contract

Every filter dropdown should behave the same on both pages.

### Trigger button

- Same height, radius, typography, caret, padding, and selected-state treatment.
- Label shows `All ...` when unrestricted.
- One selected value shows its label.
- Multiple values show a concise count.
- Zero selected values visibly communicates `None` rather than appearing unrestricted.
- `aria-expanded`, `aria-controls`, and `aria-haspopup` are maintained.

### Dropdown panel

- Same header layout and spacing.
- Same search field.
- Same actions and order.
- Same checkbox/row treatment.
- Same maximum height and internal scrolling.
- Same empty-state treatment.
- Same positioning and viewport collision handling.

### Standard actions

Use one consistent set:

- `All`
- `None`
- `Visible` when search is active and bulk visible selection is supported.
- `Reset` only when it has a meaning distinct from All, such as restoring a preset/default.

Avoid a checkbox labeled `Visible` when its behavior is not immediately understandable. Prefer explicit text such as `Select visible` / `Clear visible` if that is the actual operation.

### Search

- Search filters the option list; it does not silently change the selected population.
- Bulk visible actions apply only to the currently visible search results.
- Clearing search restores the complete option list without changing selections.
- Search terms are not persisted unless explicitly required.

### Linked inventories

A page adapter may return option inventories constrained by other active filters.

The shared platform should display:

- Available options.
- Selected options that are temporarily unavailable because of another filter, without silently deleting them.
- A clear indication when a selection yields no rows.

### Reset

- Reset one filter affects only that filter.
- Reset All affects only page filter/cross-filter state defined by the adapter.
- Reset All must not reset card layout, column state, KPI visibility, or cache data.
- When a Reset Default is configured, the action label or confirmation must make that behavior clear.

## Global filter search

When enabled, global search is a shared capability.

- It searches only the page's enabled filter dimensions.
- Remake search may include Remake Reason.
- TAT search must not return Remake Reason after TAT opts out.
- Results show the dimension label and option label.
- Selecting a result adds or applies that filter through the adapter.
- The platform must not hardcode a list such as department/product/group/customer/reason independently of registration.

## Active-filter presentation

Both pages should use one active-filter chip system.

Each chip identifies:

- Dimension or cross-filter type.
- Selected label.
- Clear action.

Requirements:

- Same visual design and spacing.
- Keyboard-reachable clear button.
- Clearing one chip changes only that filter.
- Large multi-selections may collapse to a summary chip with a count.
- Page-specific cross-filters can participate through the adapter without the shared platform understanding their calculation.

## Header actions

Header actions are capabilities, not permanent slots.

Possible capabilities:

- Global search.
- Saved filter presets.
- Page options.
- Reset all.
- Reload cached data.
- Refresh/rebuild cached data.

Rules:

- Same capability uses the same icon, label, tooltip, and behavior on every page.
- Different capabilities do not share one ambiguous icon.
- Missing capability leaves no empty placeholder.
- Actions should appear in a stable order defined by the shared platform.

Recommended order:

1. Filter dropdowns.
2. Global search.
3. Saved filter presets.
4. Optional page options.
5. Reset all.
6. Reload cache.
7. Refresh cache.

## Page options

A Page Options panel is separate from saved filter presets.

It should exist only when a page has real user-configurable page-level behavior that is not already owned by a card or shared feature module.

Examples that may qualify in the future:

- A page-wide unit/case display preference.
- A page-wide comparison policy.
- A page-wide treatment explicitly approved as user-selectable.

Examples that do not qualify:

- Static explanatory text.
- Card-specific display mode already owned by that card.
- Table columns, widths, or sorting.
- Dashboard card layout.
- KPI visibility.

At the audited commit, TAT's distribution-percent note does not justify a Page Options panel.

## Visual specification

The goal is seamless transition between Remake and TAT.

### Shared dimensions

- One header height contract.
- One filter-control height.
- One gap scale.
- One panel radius and border.
- One font family and size scale.
- One icon size.
- One focus ring.
- One selected/accent treatment.
- One compact breakpoint strategy.

### Layout

- Desktop header should remain one coherent toolbar with wrapping only when required.
- Dropdown controls should not vary unpredictably in width because of page-specific CSS.
- Use defined min/max widths by filter type or one consistent responsive flex rule.
- Utility actions align consistently at the end of the header.
- Active-filter chips occupy one shared secondary row when present.

### Responsive behavior

The current Remake compact path is a separate responsive toolbar while TAT uses its own host behavior. Replace this with one shared compact presentation.

At narrow widths:

- Keep the page tabs visible.
- Provide one Filters action that opens the shared filter sheet/panel.
- Show search, saved presets, reset, reload, and refresh according to capabilities.
- Use the same mobile panel for both pages.
- Page-specific filters are generated from registration.

## Persistence boundaries

Use separate namespaces for:

- Current page filter state.
- Saved filter presets.
- Shared header UI state, such as last open panel if worth persisting.

Do not combine these with:

- Card layout state.
- Table state.
- KPI state.
- Cache state.

Suggested conceptual keys:

- `cdaDashboardFilterHeader.current.<schema>.<pageKey>`
- `cdaDashboardFilterHeader.presets.<schema>.<pageKey>`
- `cdaDashboardFilterHeader.preferences.<schema>`

Exact versioned keys should be selected during implementation and documented in the release.

## Accessibility contract

- All triggers are real buttons.
- Every dropdown has a label and controlled panel relationship.
- Keyboard users can open, search, select, bulk-select, reset, and close.
- Escape closes the active panel and restores focus to its trigger.
- Focus is trapped only for modal/sheet behavior, not ordinary desktop popovers.
- Selected state is communicated by text/ARIA, not color alone.
- Icon-only actions have stable accessible labels.

## Adapter contract requirements

Each adapter should expose explicit methods rather than shared code reading page internals.

Conceptually:

```javascript
{
  getOptions(filterKey),
  getFilterState(filterKey),
  setFilterState(filterKey, state),
  resetFilter(filterKey),
  resetAllFilters(),
  getActiveChips(),
  clearChip(chip),
  searchAll(term),
  applySearchResult(result),
  serializePreset(),
  applyPreset(snapshot),
  refreshView()
}
```

The final names may differ. The important rule is explicit page integration.

## Audit API

The shared platform should expose a read-only audit object reporting:

- Version and release.
- Registered pages.
- Enabled filter keys by page.
- Enabled actions by page.
- Current persistence schema.
- Whether every enabled filter is included in preset serialization.
- Duplicate host/controller detection.
- Current open panel and owner.

This helps prevent future drift without adding another behavior owner.

## Implementation sequence

1. Document and freeze current Remake and TAT filter semantics.
2. Add the shared platform and declarative registration without removing legacy paths.
3. Build adapters for current page state.
4. Validate shared rendering against the current filter results.
5. Migrate Remake current state and saved presets.
6. Migrate TAT current state.
7. Disable TAT Remake Reason through its registration.
8. Remove the current TAT Settings note panel.
9. Replace the Remake saved-view controller with the shared preset capability.
10. Replace both responsive header paths with the shared compact mode.
11. Remove legacy owners only after real-data `/dev` acceptance.

Do not create a permanent compatibility layer that leaves two active owners.

## Acceptance checklist

### Cross-page visual parity

- Switching Remake to TAT does not change header height unexpectedly.
- Filter buttons use the same styling, spacing, caret, and focus behavior.
- Dropdown panels have the same structure and dimensions.
- Search and utility actions remain in the same relative position.
- Compact/mobile controls use the same component.

### Capability correctness

- Remake displays Remake Reason.
- TAT does not display or search Remake Reason.
- A page with a capability disabled has no button, panel, shortcut, or empty placeholder for it.
- Registration order controls filter order.

### Presets

- Remake and TAT can both opt into shared saved filter presets.
- Every enabled filter is serialized.
- Remake Product Group is preserved.
- Applying a preset produces the same filtered rows as manually selecting those values.
- Presets do not alter layout/table/KPI state.
- Existing Remake saved views migrate safely.

### State isolation

- Resetting one filter does not reset unrelated filters.
- Reset All does not reset layout or tables.
- Switching pages preserves each page's state independently.
- Reloading data retains valid selections and surfaces invalid/stale selections clearly.

### Data correctness

- Header changes do not alter metric definitions.
- Each page's filtered population matches the pre-migration implementation for equivalent selections.
- TAT removal of Remake Reason is intentional and documented, not a calculation regression.
- Current/prior comparison populations retain their existing page-specific rules until separately changed and approved.

### Accessibility and responsive QA

- Full keyboard flow works.
- Escape and focus return work.
- Screen-reader labels describe actual capabilities.
- Desktop, tablet, and compact layouts are verified on `/dev` with real data.

## Open design decisions

| ID | Decision | Current recommendation |
|---|---|---|
| H-01 | Final user-facing name for saved presets | `Saved filters` or `Filter presets`, not generic `Settings` |
| H-02 | Whether TAT presets include cross-filters | Default no; opt in only after deliberate approval |
| H-03 | Whether Reset All applies a personal reset default | Supported capability, but label behavior clearly |
| H-04 | Exact desktop widths for filter buttons | Define in shared tokens after reviewing real labels |
| H-05 | Global search result maximum and grouping | Shared grouped results by enabled dimension |
| H-06 | Whether cache actions belong inside the filter platform or adjacent shared header actions | Same header owner; separate capability adapters |
| H-07 | Whether Page Options is needed at all in the first shared release | No, unless a genuine page-level option is identified |

## Change-control rule

Any change to page filter inventory, filter semantics, preset contents, reset behavior, global search scope, header actions, or persistence must update this specification in the same commit.

Application code must not add a page-specific filter control directly when the shared platform can express it as a capability.