# Executive Overview Dashboard - Complete Feature Catalog and Acceptance Checklist

**Checkpoint:** v6.628  
**Build:** `STABLE-GRID-LIFECYCLE-69`  
**Checkpoint date:** 2026-08-03  
**Status:** Good working development checkpoint approved by Summer for GitHub preservation. Apps Script `/dev` is the reviewed environment. Production deployment is not included in this checkpoint.

## Documentation scope

This catalog documents the currently active Remake and Turnaround Time (TAT) dashboard experience at the v6.628 checkpoint. It was reconciled against:

- the shared declarative feature registry;
- the shared table module and table-surface platform;
- the Remake component definition;
- the TAT component definition and controller;
- the KPI, pop-out, toolbar, column-visibility, layout, and visual-fit modules;
- the exact v6.628 GitHub checkpoint.

The companion named-function inventory documents internal named functions by file. This catalog focuses on user-facing capabilities, persisted state, platform contracts, and regression expectations.

Hidden legacy Overview code and the under-construction Categorical area are not advertised as active v6.628 product features.

## Product purpose

The Executive Overview Dashboard is a browser-based Apps Script dashboard for leadership review of Remake and Turnaround Time performance. It combines operational KPIs, interactive charts, configurable filters, editable dashboard cards, detailed tables, exports, and saved personal presentation state in one shared platform.

## Active dashboard areas

### Remake dashboard

The active Remake page includes:

- Monthly Remake Comparison chart.
- Remake Reasons table.
- Departments table.
- Products table.
- Customers table.
- Technicians table, including configured detail content.
- Remake KPI and summary surfaces supplied by the current page.
- Prior-year comparison controls on configured Remake tables.
- Shared layout, table, export, pop-out, reset, and persistence behavior.

### TAT dashboard

The active TAT page includes:

- Monthly TAT Comparison chart.
- Department Summary table.
- TAT Performance card with persisted **Distribution** and **Promise** modes.
- Products table with persisted **Products** and **Groups** modes.
- Customers table.
- Data Quality & Coverage card and issue table.
- KPI strip with configurable visibility.
- Coverage summary, notices, and active-filter pills where supplied by current data.
- Shared layout, table, export, pop-out, reset, and persistence behavior.

## Shared component toolbar features

Features are enabled per component. A control may appear only where the component definition supports it.

- **Prior year** - toggles prior-year comparison on configured Remake tables.
- **Year** - opens a configured reporting-year control where a component exposes it.
- **Columns** - chooses visible table columns or configured chart series/content.
- **Column widths** - enables persisted shared column-width behavior.
- **Pop out** - opens the live component in a separate same-origin window and restores it safely.
- **Reset component** - clears the component-specific selection or returns chart/table state to its configured default.
- **More actions** - opens the component action menu.
- **Collapse/expand** - collapses or expands configured components.
- **Export current** - exports the current visible/filtered component view.
- **All data** - exports all matching data supported by the component adapter.

## Filtering, search, and cross-filtering

### Remake filters

The current Remake filtering system supports:

- Department filtering.
- Product filtering.
- Customer filtering.
- Reporting-year selection.
- YTD/MTD and month selection behavior supplied by the current page.
- Search within department, product, and customer dropdowns.
- Multi-select behavior.
- Select-all or visible-option bulk selection where configured.
- Main-department shortcut behavior.
- Clear/reset behavior scoped to the edited filter.
- Linked filter inventories so available departments, products, customers, years, and months reflect the other active selections.
- Active-filter chips with individual clear actions.
- Chart data-point and month selection where configured.
- Product/customer/table selections that participate in the page filter state.
- Undo and redo for filter-state changes, including keyboard shortcuts outside editable fields.

### TAT filters

The current TAT filtering system supports:

- Year.
- Department.
- Product.
- Product group.
- Customer.
- Remake reason.
- Search within each filter panel.
- Fuzzy global search across departments, products, groups, customers, and reasons.
- All, none, and visible-option selection controls.
- Multi-select and exclusive-selection behavior.
- Active-filter pills with individual clear actions.
- Reset-all TAT filters.
- Persisted filter/search state.

### TAT cross-filter state

TAT visual and table interactions may apply cross-filters for:

- selected months;
- TAT-day buckets;
- promise/late-performance bands;
- data-quality issue categories;
- selected department, product, product group, customer, or reason values.

Component reset clears the relevant selection without silently resetting unrelated filters.

## KPI and summary features

### TAT KPI chooser

The TAT KPI visibility chooser persists which cards are visible. Current configured KPI cards are:

- Average TAT.
- On Time to Promise.
- Average Days Late.
- Sold Units.
- Remake %.

### Coverage and status summaries

Where current data provides them, TAT displays:

- Total Cases.
- Total Units.
- TAT Eligible.
- Coverage percentage.
- Excluded Cases.
- Coverage notes.
- Data-quality issue summary.

The shared KPI chooser module can also support configured KPI strips on other dashboard tabs.

## Layout-editing features

- Dashboard edit mode.
- Move cards across rows and upward.
- Eight edge/corner resize handles.
- Collision-aware placement.
- Deterministic reflow.
- Collapse and expand cards.
- Saved card position.
- Saved card width and height.
- Saved card order.
- Saved collapse state.
- Reset Layout intentionally restores defaults.
- Saved geometry replaces defaults for existing cards.
- Newly introduced cards can use defaults without resetting existing personalized cards.
- Charts and tables fit inside saved card boxes without owning outer card geometry.
- Expanded saved cards are protected from restoring below required visual minimums.

## Table and grid features

The shared table system supports, where configured:

- Shared table platform across Remake and TAT.
- Stable table shells and interactive headers.
- Sort ascending and descending.
- Sort-state persistence.
- Row rerendering without destroying the interactive header.
- Spreadsheet-style column divider resizing.
- Adjacent-pair resizing: moving one divider changes only the two columns it separates.
- Fixed combined width for the adjacent pair.
- Declared minimum widths.
- Standard columns filling the visible table viewport.
- Optional/extended comparison columns creating controlled horizontal scrolling.
- Sticky headers in the bounded shared table host.
- Right-click column sizing menu.
- Keyboard-accessible column resizing where supported by the interaction layer.
- Persistent exact widths keyed by stable table and column IDs.
- Persistent column visibility.
- Shared column chooser.
- Prevention of hiding the final visible column.
- Row selection and multi-selection where configured.
- Selected-row pinning at the top of the visible table.
- Child/detail rows where configured.
- Totals rows where configured.
- Empty-state messages.
- Numeric, percentage, currency, count, decimal, and day formatting.
- Per-table row limits configured by the table definition.
- CSV export.

Saved widths are expected to survive refresh, sorting, filtering, tab switching, collapse/expand, and browser resizing.

## Column sizing commands

The shared right-click sizing menu supports:

- **Fit this column to content** - sizes one selected column.
- **Compact columns (fit headers)** - keeps short/numeric columns compact and lets the primary descriptive column use remaining space.
- **Fit standard columns to width** - partitions the visible viewport among standard columns.
- **Fit visible cell contents** - measures currently displayed values.
- **Reset widths** - intentionally deletes saved width state and restores configured defaults.

These commands are distinct. Compact/header sizing is not the same operation as measuring full visible cell content.

## Chart behavior

- Browser-side Chart.js rendering.
- Interactive hover and tooltip behavior supplied by current chart definitions.
- Click-to-filter or highlight behavior where configured.
- Monthly and comparative chart modes supplied by the active dashboard definitions.
- Internal chart fitting after card resize.
- Chart redraw/fit against the final saved card box.
- Chart fitting cannot overwrite saved outer card geometry.
- Export of visible chart data to CSV through the shared feature runtime.
- Live component pop-out where the component supports it.

## Component pop-out behavior

- Opens the actual live dashboard component in a separate same-origin window.
- Preserves bounded shared table-surface behavior.
- Applies configured column visibility and width behavior in the detached window.
- Restores the component safely when the pop-out session ends.
- Keeps pop-out state separate from the saved outer dashboard layout.

## Export behavior

Exports are component-aware and may include:

- Current visible/filtered table rows.
- All matching data supported by the adapter.
- Visible chart labels and datasets.
- Monthly summary data.
- Promise-performance rows.
- TAT-distribution rows.
- Detailed matching TAT records.

CSV output uses UTF-8-compatible browser downloads and escapes commas, quotes, and line breaks.

## Tab and loading lifecycle

- Remake and TAT use one tab-activation owner.
- Each page is registered or constructed once.
- Saved card geometry and table widths are applied before reveal.
- Warm tab switches reuse prepared surfaces.
- No global page-opacity or blank-dashboard loading gate.
- TAT browser cache is read and rendered once per activation path.
- Ordinary row and chart mutations do not trigger whole-document width scans.
- Targeted resize observation is used for affected table hosts.
- Data arrival must not restore default widths or default card geometry.

## Persistence and personalization

The v6.628 experience persists user state in browser storage where configured, including:

- Card position, dimensions, order, and collapse state.
- Table widths.
- Table column visibility.
- Table sort state.
- KPI visibility.
- TAT Product/Group mode.
- TAT Distribution/Promise mode.
- TAT filter/search/cross-filter state.
- Remake filter-state snapshots used by undo/redo during the session.

Reset actions are intentional state changes. Routine loading, sorting, filtering, and tab switching must not delete unrelated personalized state.

## Accessibility and interaction details

- Toolbar controls include titles and ARIA labels.
- Toggle controls expose pressed/expanded state.
- Column chooser and action menus use popover/dialog/menu semantics where configured.
- Collapse controls expose expanded state.
- Keyboard column resizing is supported by the shared interaction layer where configured.
- Filter undo/redo supports `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl/Cmd+Y` outside editable fields.
- Truncated primary labels receive full-value titles in configured TAT tables.

## Responsive behavior

- Two-column TAT composition on wider displays.
- Single-column TAT composition below the configured responsive breakpoint.
- Cards and shared table hosts use bounded overflow rather than pushing outside the saved card boundary.
- Standard columns target the available viewport.
- Optional columns use controlled horizontal scrolling.
- Pop-out windows maintain a bounded table surface.

## Footer and operational status

The shared footer owns:

- Visible UI version.
- Build label.
- Remake and technician/TAT cache or status timestamps where available.

The footer is the first identity check during `/dev` acceptance testing.

## Shared platform ownership

| Responsibility | Current owner |
|---|---|
| Tab activation and reveal | `TatDashboardControllerScript.html` |
| Saved card geometry | `SharedDashboardLayoutEditorV6593.html` |
| Table shell, rows, totals, selection, and sort metadata | `SharedTableModule.html` |
| Column state, sizing, persistence, and interactions | `SharedDashboardTablePlatformV6586.html` |
| Column visibility chooser | `SharedDashboardColumnsV6548.html` and managed-table APIs |
| Shared component feature routing | `SharedDashboardFeatureRuntimeV6579.html` |
| Toolbar presentation and event dispatch | `SharedDashboardToolbarV6548.html` |
| KPI visibility chooser | `SharedDashboardKpiV6547.html` |
| Live component pop-out | `SharedDashboardPopoutV6548.html` and isolation service |
| Chart internal sizing | `SharedVisualFitControllerV6617.html` |
| Remake page registration | `RemakeDashboardBootstrapV6548.html` |
| Remake component definition | `RemakeDashboardDefinitionV6548.html` |
| TAT page registration | `TatDashboardBootstrapV6547.html` |
| TAT component definition | `TatDashboardDefinitionV6547.html` |
| Visible release identity | `SharedFooter.html` |

## Checkpoint acceptance checklist

Use this checklist whenever future work changes the dashboard platform or a user-facing feature.

### Release identity

- [ ] `/dev` footer shows the expected UI version and build label.
- [ ] Exact source files match the tested package/commit.
- [ ] GitHub, Apps Script head, and production states are reported separately.

### Loading and first frame

- [ ] Remake becomes usable promptly after refresh.
- [ ] TAT becomes usable promptly after refresh.
- [ ] No long globally blank dashboard.
- [ ] No default-to-saved card movement after the first visible frame.
- [ ] No default-to-saved column movement after the first visible frame.

### Filters, search, and KPI state

- [ ] Remake dropdown search works for configured dimensions.
- [ ] TAT per-filter search works.
- [ ] TAT global fuzzy search finds matching filter options.
- [ ] Multi-select, all/none/visible, and reset behavior remain scoped correctly.
- [ ] Active-filter pills clear only their represented state.
- [ ] KPI visibility survives refresh.
- [ ] Filter resets do not delete unrelated layout or width state.

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
- [ ] Selected rows remain selected/pinned where configured.
- [ ] Column visibility survives rerendering.

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
- [ ] Column visibility and sort state survive refresh.
- [ ] TAT Product/Group and Distribution/Promise modes survive refresh.

### Sizing modes

- [ ] Compact mode keeps numeric/right-side columns narrow.
- [ ] Fit-to-width fills the standard viewport without a gap.
- [ ] Visible-content fit measures displayed values.
- [ ] Optional columns do not renormalize standard columns.

### Component actions

- [ ] Pop-out opens the live component and restores it safely.
- [ ] Export current reflects the current component view.
- [ ] All-data export reflects all matching data supported by the adapter.
- [ ] Reset clears only the intended component state.
- [ ] Collapse/expand preserves saved state.

### Charts and card geometry

- [ ] Charts render and retain hover/tooltips.
- [ ] Configured chart clicks apply the intended filter/highlight.
- [ ] Charts fit inside their cards.
- [ ] Charts do not change saved outer card geometry.
- [ ] Expanded cards do not restore below required visual minimums.

### Data quality and coverage

- [ ] TAT coverage values render when data is available.
- [ ] Data-quality issue summary and table remain filterable.
- [ ] Issue cross-filtering can be cleared without resetting unrelated state.

## Known checkpoint notes

- This checkpoint is a good working stopping point, not a claim that all future enhancement goals are complete.
- Loading performance should continue to be monitored with real data.
- Production deployment requires a separate explicit decision.
- Future platform work must preserve the ownership model and acceptance checklist.
- Real-data Apps Script `/dev` behavior overrides fixture or static-validator results.

## Future Power BI-style direction

These remain architectural goals rather than guaranteed v6.628 features:

- Multi-select dashboard cards.
- Align and distribute tools.
- Exact X/Y/W/H controls.
- Selection pane.
- Lock, hide, group, and duplicate cards.
- Named layouts/bookmarks.
- Reader personalization beyond current saved state.
- Natural-language dashboard questions and answers.
