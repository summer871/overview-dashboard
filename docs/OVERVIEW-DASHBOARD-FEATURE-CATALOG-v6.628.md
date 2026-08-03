# Executive Overview Dashboard - Feature Catalog and Acceptance Checklist

**Checkpoint:** v6.628
**Build:** `STABLE-GRID-LIFECYCLE-69`
**Checkpoint date:** 2026-08-03
**Status:** Good working development checkpoint approved by Summer for GitHub preservation. Apps Script `/dev` is the reviewed environment. Production deployment is not included in this checkpoint.

## Product purpose

The Executive Overview Dashboard is a browser-based Apps Script dashboard for leadership review of Remake and Turnaround Time (TAT) performance. It combines operational KPIs, editable dashboard cards, charts, and data tables in one shared platform.

## User-facing dashboard areas

### Remake dashboard

- Remake KPIs and summary cards.
- Remake charts and supporting detail tables.
- Sortable and resizable table columns.
- Shared layout editing and saved personal geometry.
- Shared chart and table visual fitting.

### TAT dashboard

- TAT KPIs and summary cards.
- Performance, customer, promise, product, distribution, department, and data-quality surfaces where configured by the current dashboard definition.
- Shared sorting, sizing, scrolling, and saved layout behavior.
- Shared chart and table visual fitting.

## Layout-editing features

- Edit mode for dashboard cards.
- Move cards across rows and upward.
- Eight edge/corner resize handles.
- Collision-aware placement and deterministic reflow.
- Collapse and expand cards.
- Saved card position, size, order, and collapse state.
- Reset Layout intentionally restores defaults.
- Saved geometry replaces defaults for existing cards.
- New cards use defaults without resetting existing personalized cards.
- Charts and tables fit inside saved card boxes without owning outer card geometry.

## Table and grid features

- Shared table platform across Remake and TAT.
- Sort ascending and descending while preserving table editing controls.
- Stable table header during sort; row updates do not destroy the interactive header.
- Spreadsheet-style column divider resizing.
- Adjacent-pair resizing: moving one divider changes only the two columns it separates.
- Fixed combined width for the adjacent pair.
- Standard columns fill the visible table viewport.
- Optional/extended comparison columns may create controlled horizontal scrolling.
- Sticky table headers where supported by the shared table host.
- Right-click column sizing menu.
- Keyboard-accessible column resizing where supported by the current interaction layer.
- Persistent widths keyed by stable table and column IDs.
- Saved widths survive refresh, sorting, filtering, tab switching, collapse/expand, and browser resizing.

## Column sizing commands

- **Fit this column to content** - sizes one selected column.
- **Compact columns (fit headers)** - keeps short/numeric columns compact and lets the primary descriptive column use remaining space.
- **Fit standard columns to width** - partitions the visible viewport among standard columns.
- **Fit visible cell contents** - measures visible displayed values.
- **Reset widths** - intentionally deletes saved width state and restores defaults.

## Tab and loading lifecycle

- Remake and TAT use one tab-activation owner.
- Each page is prepared before reveal.
- Warm tab switches reuse prepared surfaces.
- Saved card geometry and table widths are applied before the page is shown.
- No global page-opacity or blank-dashboard loading gate.
- TAT local cache is read and rendered once per activation path.
- Ordinary row and chart mutations do not trigger whole-document width scans.

## Chart behavior

- Shared chart internal sizing controller.
- Charts redraw or fit after completed card resizing.
- Chart fitting cannot overwrite saved outer card geometry.
- Saved expanded card height is clamped to the shared visual minimum when needed.

## Shared platform ownership

| Responsibility | Current owner |
|---|---|
| Tab activation and reveal | `TatDashboardControllerScript.html` |
| Saved card geometry | `SharedDashboardLayoutEditorV6593.html` |
| Table shell and row rendering | `SharedTableModule.html` |
| Column state, sizing, persistence, and interactions | `SharedDashboardTablePlatformV6586.html` |
| Chart internal sizing | `SharedVisualFitControllerV6617.html` |
| Remake page registration | `RemakeDashboardBootstrapV6548.html` |
| TAT page registration | `TatDashboardBootstrapV6547.html` |
| Visible release identity | `SharedFooter.html` |

## Checkpoint acceptance checklist

Use this checklist whenever future work changes the dashboard platform.

### Release identity

- [ ] `/dev` footer shows the expected UI version and build label.
- [ ] Exact source files match the tested package.
- [ ] GitHub and Apps Script deployment states are reported separately.

### Loading and first frame

- [ ] Remake is usable promptly after refresh.
- [ ] TAT is usable promptly after refresh.
- [ ] No long blank dashboard area.
- [ ] No default-to-saved card movement after the first visible frame.
- [ ] No default-to-saved column movement after the first visible frame.

### Tab switching

- [ ] Ten `Remake -> TAT -> Remake` cycles preserve card geometry.
- [ ] Ten cycles preserve table-width signatures.
- [ ] Editing controls remain available.
- [ ] No page rebuild or repeated blanking is visible.

### Sorting and table editing

- [ ] Sort ascending without losing resize handles.
- [ ] Sort descending without losing resize handles.
- [ ] Header context menu remains available after sorting.
- [ ] Sort changes row order only; widths remain unchanged.

### Adjacent column resizing

- [ ] Only the two adjacent columns change.
- [ ] Their changes are equal and opposite.
- [ ] Unrelated columns remain unchanged.
- [ ] Standard-table total width remains fixed.
- [ ] Divider movement remains smooth until a minimum width is reached.

### Persistence

- [ ] Manual widths survive three refreshes.
- [ ] Widths survive sorting and filtering.
- [ ] Widths survive collapse and expand.
- [ ] Widths survive browser resize.
- [ ] Saved card layout survives refresh and tab switching.

### Sizing modes

- [ ] Compact mode keeps numeric/right-side columns narrow.
- [ ] Fit-to-width fills the standard viewport without a gap.
- [ ] Visible-content fit measures displayed values.
- [ ] Optional columns do not renormalize standard columns.

### Charts and card geometry

- [ ] Charts fit inside their cards.
- [ ] Charts do not change saved outer card geometry.
- [ ] Expanded cards do not restore below their required visual minimum.

## Known checkpoint notes

- This checkpoint is a good working stopping point, not a claim that all future enhancement goals are complete.
- Loading performance should continue to be monitored with real data.
- Production deployment requires a separate explicit decision.
- Future platform work should preserve the ownership model and acceptance checklist above.

## Future Power BI-style direction

These remain architectural goals rather than guaranteed v6.628 features:

- Multi-select cards.
- Align and distribute tools.
- Exact X/Y/W/H controls.
- Selection pane.
- Lock, hide, group, and duplicate.
- Named layouts/bookmarks.
- Reader personalization.
- Natural-language dashboard questions and answers.
