# AI Code Map

**Purpose:** Give maintainers and AI agents one concise map of the currently active Remake + TAT dashboard source after the 2026-08-21/22 cleanup.

**Scope:** Repository structure and ownership only. This file is not an Apps Script runtime module.

## Protected baseline

The current partially-working Remake + TAT dashboard is the protected behavioral baseline. The old v6.628 checkpoint is recovery-only, not the target architecture.

Do not reintroduce paused Overview execution to restore old compatibility paths. Do not merge, push to Apps Script, or deploy production without explicit approval.

## Server entry point

`Code.js` is the Apps Script server/router entry point. Current presentation routing is Remake + TAT only.

`Index.html` is the browser composition root.

`DashboardMainScript.html` contains only:

```html
<script><?!= includeDashboardFile('RemakeMainRuntimeV6230') ?></script>
```

Paused Overview/legacy DashboardMain source is preserved under `archive/` and is excluded from Apps Script by `.claspignore`.

## Active Index composition

Load order is behavior-sensitive. Do not reorder modules merely for aesthetics.

### Head

1. `SharedDashboardLayoutEditorV6593.html`
2. `SharedDashboardTablePlatformV6586.html`
3. `SharedVisualFitControllerV6617.html`
4. `SharedFilterBarStyles.html`
5. `SharedFilterBar.html`
6. `DashboardFuzzySearch.html`
7. `DashboardBaseStyles.html`
8. `RemakeTailStyles.html`
9. `RemakeHeadPresentationStyles.html`
10. `SharedDashboardBootPresentation.html`
11. `RemakeUsabilityPresentation.html`

### Body / Remake shell

1. `DashboardShellMarkup.html`
2. `RemakeRootAttributionBrowserIntegrationV1351.html`
3. `DashboardMainScript.html`
4. `DashboardClientBootRuntime.html`
5. `DashboardShellNavigationRuntime.html`
6. `RemakeSharedFilterAdapterV6646.html`
7. `RemakePresentationControllerV6243.html`
8. `RemakeInteractionStabilityRuntimeV6249.html`
9. `RemakeTableMorphPresentationV6300.html`
10. `RemakeTableLayoutPresentationV6317.html`
11. `RemakeCeramistTablePresentation.html`
12. `RemakeColumnChooserRuntimeV6357.html`
13. `RemakeTableInteractionPresentation.html`
14. `RemakeResponsiveStyles.html`
15. `RemakeCompactControlsPresentation.html`
16. `RemakeResponsiveSavedViewsRuntimeV6382.html`
17. `RemakeFilterSummaryPresentation.html`
18. `RemakeSectionStateControllerV6402.html`
19. `RemakeKpiChooserV6403.html`
20. `SharedAtomicRenderingV6418.html`
21. `RemakeInteractionPolish.html`

### TAT / shared tail

These includes currently occur after the closing `</html>` in `Index.html`. That placement is historical but behavior-sensitive; do not move them without a deliberate runtime checkpoint.

1. `UnifiedControlsStyles.html`
2. `TatDashboardControllerScript.html`
3. `TatSharedFilterAdapterV6646.html`
4. `TatRemakeAliasStyles.html`
5. `TatCompactPresentation.html`
6. `SharedTopParityStyles.html`
7. `SharedTableStyles.html`
8. `SharedTableModule.html`
9. `TatDropdownRepairPresentation.html`
10. `SharedTopParityControllerV6527.html`
11. `SharedFooter.html`

## Remake runtime composition

`RemakeMainRuntimeV6230.html` is the semantic Remake parent. It assembles, in order:

1. `RemakeRuntimeCoreV6230.html`
2. `RemakeRuntimePresentationV6230.html`
3. `RemakeFilterRuntimeV6245.html`
4. `RemakeAnalyticsRuntimeV6281.html`
5. `RemakeCustomerTableRuntimeV6230.html`
6. `RemakeTechnicianCoreRuntimeV6342.html`
7. `RemakeTechnicianPopulationRuntimeV6569.html`
8. `RemakeCustomerChartRuntimeV6504.html`
9. `RemakeTransitionRuntimeV6300.html`
10. `RemakePopoutBridgeRuntimeV6339.html`
11. `RemakePopoutWindowRuntimeV6339.html`
12. `RemakePopoutControllerRuntimeV6339.html`
13. `RemakeCacheRuntimeV6388.html`
14. `startupOnceV6624()`

## Authoritative shared owners

Use one owner per responsibility. Do not create parallel lifecycle owners or fallback copies.

| Responsibility | Authoritative owner |
|---|---|
| Tab switching / TAT activation | `TatDashboardControllerScript.html` |
| Saved card geometry / layout editor | `SharedDashboardLayoutEditorV6593.html` |
| Table shell, rows, totals, selection, sort | `SharedTableModule.html` |
| Column state, sizing, persistence, interactions | `SharedDashboardTablePlatformV6586.html` |
| Column visibility | `SharedDashboardColumnsV6548.html` |
| Shared feature routing | `SharedDashboardFeatureRuntimeV6579.html` |
| Toolbar | `SharedDashboardToolbarV6548.html` |
| KPI visibility | `SharedDashboardKpiV6547.html` |
| Popout | `SharedDashboardPopoutV6548.html` |
| Chart sizing / visual fit | `SharedVisualFitControllerV6617.html` |
| Release identity | `SharedFooter.html` |
| Shared filter UI | `SharedFilterBar.html` + `SharedFilterBarStyles.html` |

## CI-only compatibility fixtures

The following files are intentionally retained at repository root because current validation scripts read them directly. Do not assume they are active browser composition solely because they are at root.

- `SharedDashboardRegistryV6547.html`
- `SharedDashboardRendererV6547.html`
- `RemakeDashboardBootstrapV6548.html`
- `TatDashboardBootstrapV6547.html`
- `TatDashboardAdapterV6547.html`
- `TatDashboardLayoutV6563.html`
- `TatProductTableV6562.html`
- `TatTableWidthsV6563.html`

Before moving any of these, update the relevant validator intentionally and preserve the contract strength.

## Archive boundary

`archive/` is historical / paused source, not active deployable source. `.claspignore` excludes the entire archive.

Important archive groups include:

- retired paused Overview / legacy DashboardMain runtime
- inactive v6.544-v6.562 shared-platform scaffold
- stale selector dependency reports
- obsolete local preview harness
- old cleanup reports
- obsolete `refactor/flatten-index` push helper
- historical v6.544 component migration registry

`scripts/audit-dashboard-components.js` intentionally excludes `archive/` so component inventories describe active source rather than history.

## Protected runtime invariants

- Do not add a second tab/lifecycle owner or timer-based polling owner.
- Do not replace an interactive table header during sort.
- Data arrival and scrollbar changes must not overwrite saved column widths.
- Preserve current Remake and TAT filters, saved state, selection, sorting, and layout behavior unless the change explicitly targets them.
- TAT currently installs the final `switchTab` owner and routes non-TAT requests to Remake.
- TAT directly initializes Remake data for the no-legacy-router path; do not reintroduce the retired generic Overview router.
- `/dev` behavior overrides assumptions from static validators.
- No opacity/readiness gates as a substitute for correct lifecycle ownership.

## Active modules above review threshold

Target semantic module size is **<= 75 KB**. Files at or above ~100 KB require structural review before further growth.

| File | Approx. size | Current responsibility / review note |
|---|---:|---|
| `SharedDashboardLayoutEditorV6593.html` | 173.6 KB | Saved layout/editor platform; split only along proven ownership seams. |
| `SharedDashboardTablePlatformV6586.html` | 113.7 KB | Column sizing/state/persistence/interactions; preserve width lifecycle exactly. |
| `DashboardBaseStyles.html` | 102.5 KB | Large active style owner; future extraction must preserve CSS order/cascade exactly. |
| `TatDashboardControllerScript.html` | 100.7 KB | TAT state/render/navigation/tab owner. A render-only seam has been identified but not yet extracted. |

A candidate TAT split is the contiguous render block beginning at `destroyChart(name)` and ending after `renderAll()`. Any extraction must be deterministically reconstructed and proven byte-for-byte equivalent before it is accepted.

## Validation entry points

Primary cleanup validation:

- `scripts/validate-cleanup-checkpoint.js`
- `scripts/validate-dashboard-main-composition.js`
- `scripts/test-dashboard-runtime-contracts.js`
- `scripts/validate-dashboard-platform.js`

Repository component inventory:

- `npm run audit:components`
- implemented by `scripts/audit-dashboard-components.js`

Do not weaken validators merely to make a cleanup pass. Update an assertion only when the corresponding authoritative owner/path intentionally changes.

## Naming direction

Prefer semantic filenames that describe ownership and responsibility. Avoid new generic names such as `DashboardSupportScript05` or `DashboardSupportScript06`.

`RemakePresentationControllerV6243.html` is now the active semantic owner for the historical v6.243 presentation-controller blob. The generic `DashboardSupportScript01.html` alias has been retired; preserve this semantic name and current load order unless ownership deliberately changes.
