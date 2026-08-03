# Executive Overview Dashboard - Architecture and Function Ownership

**Checkpoint:** v6.628 (`STABLE-GRID-LIFECYCLE-69`)
**Purpose:** Preserve the current working ownership model and provide a maintenance reference for future changes.

## Core rule

Each platform responsibility must have one authoritative owner. A future change should extend the existing owner instead of adding another lifecycle controller over it.

## Runtime ownership map

### `TatDashboardControllerScript.html`

Owns shared tab activation and reveal coordination:

- Prepares the target page.
- Coordinates saved-layout hydration.
- Coordinates table preparation.
- Coordinates visual fitting.
- Reveals the target page.
- Reuses prepared Remake and TAT surfaces on later switches.

Primary lifecycle entry points documented by the v6.628 ownership matrix:

- `preparePageV6627()`
- `revealPageV6627()`
- `activateRemake()`
- `activateTat()`

### `SharedDashboardLayoutEditorV6593.html`

Owns saved dashboard-card geometry:

- Edit mode.
- Dragging and eight-handle resizing.
- Collision handling and reflow.
- Collapse/expand layout behavior.
- Saved position, dimensions, order, and collapse state.
- Pre-show hydration.
- Visual minimum-height protection.

Primary activation contract:

- `preparePageForActivationV6627()`
- `commitPageActivationV6627()`

### `SharedTableModule.html`

Owns table shell and data-row rendering:

- Table markup and stable header shell.
- Row and totals rendering.
- Sort metadata and displayed row ordering.
- Dispatch of table-render lifecycle events.
- Sorting must update row sections without replacing the interactive header.

Primary documented renderer:

- `renderV6540()`

### `SharedDashboardTablePlatformV6586.html`

Owns universal table column behavior:

- Stable table and column IDs.
- Width-state persistence.
- Adjacent-pair divider resizing.
- Compact/header sizing.
- Standard viewport sizing.
- Visible-cell-content sizing.
- Context menu and delegated interactions.
- Per-host resize observation.
- Standard versus extended column behavior.
- Saved-width hydration.

### `SharedVisualFitControllerV6617.html`

Owns internal visual fitting:

- Chart fit/update after card resizing.
- Internal table/chart fit against final card boxes.
- No authority to change saved outer card geometry.

### Page registration and definitions

- `RemakeDashboardBootstrapV6548.html` registers the Remake page.
- `TatDashboardBootstrapV6547.html` registers the TAT page.
- Dashboard definition, adapter, registry, renderer, and component files describe available cards and surfaces.

### `SharedFooter.html`

Owns the visible release identity and cache/status footer:

- UI version.
- Build label.
- Remake and technician cache/status timestamps where available.

## Lifecycle contracts

### Initial page load

1. Construct or register the page once.
2. Read saved card and column state.
3. Apply saved state while the page is inactive.
4. Reveal the page.
5. Run one internal fit against final boxes.
6. Render/update data without restoring defaults.

### Tab switch

1. Identify the target page.
2. Prepare saved geometry and widths if needed.
3. Reuse the mounted page.
4. Reveal it.
5. Do not run default builders or whole-document table scans.

### Sort

1. Change sort state.
2. Reorder displayed rows.
3. Replace/update row sections only.
4. Preserve the stable header, interactions, widths, visibility, and column order.

### Column resize

1. A divider owns the columns directly to its left and right.
2. Apply equal and opposite width deltas.
3. Stop at declared minimum widths.
4. Persist the resulting exact width map.
5. Leave unrelated columns unchanged.

### Browser/card resize

1. Observe the affected host/card.
2. Recalculate only the affected internal viewport/visual.
3. Preserve saved outer card geometry.
4. Preserve user-edited width intent.

## State boundaries

Keep these states independent:

- Card layout state.
- Column width/order/visibility/sizing-mode state.
- Sort state.
- Filter state.
- Data/cache state.
- Chart rendering state.

Changing one state must not silently reset another.

## Files intentionally removed from active ownership

- `SharedDashboardColumnWidthsV6581.html` - superseded duplicate width owner.
- `SharedDashboardFirstPaintGateV6618.html` - obsolete paint gate.
- `SharedDashboardFirstPaintGateV6619.html` - obsolete paint gate.
- `SharedDashboardProgressivePaintV6620.html` - obsolete paint controller.
- `SharedDashboardImmediatePaintV6621.html` - obsolete paint controller.

Historical release validators for v6.624, v6.626, and v6.627 are removed at this checkpoint. The active release validator is:

- `scripts/validate-v6.628-stable-grid-lifecycle.js`

## Maintenance rules

- Do not introduce a second owner for tab activation, saved layout, table widths, or chart sizing.
- Do not hide platform problems with opacity gates, timers, or readiness polling.
- Do not rebuild a dashboard page on every tab click.
- Do not replace an interactive header during sorting.
- Do not infer optional columns only from displayed header text; use stable metadata.
- Do not let data rows or scrollbar appearance overwrite saved widths.
- Do not reset saved layout during routine testing.
- Real `/dev` behavior overrides fixture results.
- Update `SharedFooter.html` in the same release as code changes.
- Never run `scripts/update-footer-version.js`.
- Never run `clasp pull` for this project.

## Generated function inventory

The companion file `OVERVIEW-DASHBOARD-NAMED-FUNCTION-INVENTORY-v6.628.md` is generated from the exact local `.html` and `.js` source files at checkpoint time. It lists named function declarations and named function/arrow assignments by file. Anonymous callbacks are intentionally excluded because they do not provide stable maintenance identifiers.
