# CSS Selector Dependency Map

Generated: 2026-07-24T19:12:51.287Z

## Scope and safety

- Analysis only. No dashboard source file is modified by the analyzer.
- The cascade is reconstructed from `Index.html` and each `includeDashboardFile(...)` call in its actual template position.
- The complete selector inventory is in `SELECTOR_DEPENDENCY_MAP.csv` and `SELECTOR_DEPENDENCY_MAP.json`.
- "Likely obsolete" means no static ID/class token reference was found; dynamic runtime construction can produce false positives.
- Movement risk is a review aid, not authorization to move or delete a selector.

## Summary

- Root source files hashed: 16
- Template includes: 10
- Style blocks: 32
- Parsed selector occurrences: 3039
- Unique selector/context groups: 2115
- High movement-risk groups: 737
- Cross-file groups: 117
- Static-unreferenced review candidates: 62

### Ownership counts

| Ownership | Selector/context groups |
|---|---:|
| Overview | 652 |
| TAT | 84 |
| Remake | 487 |
| Shared | 892 |

## Template include order

| Order | Parent location | Included file | After closing HTML |
|---:|---|---|---|
| 1 | Index.html:137 | DashboardBaseStyles.html | No |
| 2 | Index.html:958 | DashboardSupportScript01.html | No |
| 3 | Index.html:1027 | DashboardSupportScript02.html | No |
| 4 | Index.html:2386 | DashboardSupportScript03.html | No |
| 5 | Index.html:2777 | RemakeResponsiveStyles.html | No |
| 6 | Index.html:3036 | DashboardSupportScript04.html | No |
| 7 | Index.html:4618 | UnifiedControlsStyles.html | Yes |
| 8 | Index.html:4619 | TatDashboardControllerScript.html | Yes |
| 9 | Index.html:4628 | TatRemakeAliasStyles.html | Yes |
| 10 | Index.html:4678 | SharedTopParityStyles.html | Yes |

## Stylesheet cascade order

| Style order | Source location | Style ID | Include order | After closing HTML |
|---:|---|---|---:|---|
| 1 | DashboardBaseStyles.html:1 | (none) | 1 | No |
| 2 | Index.html:139 | remakeV6285TargetedFixes | 0 | No |
| 3 | Index.html:150 | remakeV6286FinalChartState | 0 | No |
| 4 | Index.html:162 | remakeV6324CompactFilterBarStyles | 0 | No |
| 5 | Index.html:232 | workerDetailCrossfilterStylesV6370 | 0 | No |
| 6 | Index.html:241 | cdaRemakeTatBootStylesV6501 | 0 | No |
| 7 | Index.html:261 | cdaRemakeUsabilityV6503Styles | 0 | No |
| 8 | Index.html:428 | cdaRemakeUniversalResponsibilityV6504Styles | 0 | No |
| 9 | Index.html:1436 | remakeV6337StableTabFilterToolbarStyles | 0 | No |
| 10 | Index.html:1809 | remakeV6344CeramistReadableLayoutStyles | 0 | No |
| 11 | Index.html:2040 | remakeV6354ConsistentTableTypographyStyles | 0 | No |
| 12 | Index.html:2174 | remakeV6357TypographyAndColumnChooserStyles | 0 | No |
| 13 | Index.html:2400 | ceramistSectionScrollFixV6360 | 0 | No |
| 14 | Index.html:2435 | ceramistSelectedRowFreezeV6361 | 0 | No |
| 15 | Index.html:2602 | ceramistV6368CleanControlsDetailDrawerStyles | 0 | No |
| 16 | Index.html:2733 | (none) | 0 | No |
| 17 | RemakeResponsiveStyles.html:1 | remakeResponsiveV6382Styles | 5 | No |
| 18 | Index.html:2781 | remakeCompactControlsAndTableGeometryV6384 | 0 | No |
| 19 | Index.html:3040 | remakeDropdownSummaryV6387 | 0 | No |
| 20 | Index.html:3120 | remakeV6392TechnicianLeftColumnWidths | 0 | No |
| 21 | Index.html:3182 | remakeV6402PageReloadCollapseStyles | 0 | No |
| 22 | Index.html:3511 | remakeV6403KpiChooserStyles | 0 | No |
| 23 | Index.html:4005 | cdaAtomicStableStylesV6418 | 0 | No |
| 24 | Index.html:4113 | cdaSmoothAtomicPolishV6424 | 0 | No |
| 25 | Index.html:4484 | cdaRemakePillsOutsideKpiAreaV6428 | 0 | No |
| 26 | Index.html:4578 | remakeCompleteRowHoverStylesV6427 | 0 | No |
| 27 | UnifiedControlsStyles.html:1 | cdaRemakeTatUnifiedControlsV6509 | 7 | Yes |
| 28 | TatDashboardControllerScript.html:641 | (none) | 8 | Yes |
| 29 | TatRemakeAliasStyles.html:1 | cdaTatActualRemakeCssAliasV6512 | 9 | Yes |
| 30 | Index.html:4630 | cdaTatCompactPresentationV6513 | 0 | No |
| 31 | SharedTopParityStyles.html:1 | cdaSharedTopParityV6527Styles | 10 | Yes |
| 32 | Index.html:4681 | cdaTatDropdownTabRepairV6525 | 0 | No |

## Highest movement-risk selectors

| Selector | Context | Ownership | First definition | Occurrences | Files | Specificity | Reasons |
|---|---|---|---|---:|---:|---|---|
| `th` | (default) | Shared | DashboardBaseStyles.html:367 | 10 | 2 | 0-0-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `body` | (default) | Shared | DashboardBaseStyles.html:28 | 9 | 3 | 0-0-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `td` | (default) | Shared | DashboardBaseStyles.html:384 | 5 | 2 | 0-0-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatTabFilterHostV6509 .remakeCacheActionBarV6338 .remakeButton` | (default) | Shared | UnifiedControlsStyles.html:87 | 4 | 3 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatTabFilterHostV6509 .remakeDropdownHeaderV6245` | (default) | Shared | UnifiedControlsStyles.html:65 | 4 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337` | (default) | Shared | Index.html:1439 | 3 | 3 | 1-0-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337 .remakeCacheActionBarV6338 .remakeButton` | (default) | Shared | Index.html:1653 | 3 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337 .remakeDropdownHeaderV6245` | (default) | Shared | Index.html:1534 | 3 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337 .remakeDropdownHeaderV6245 button` | (default) | Shared | Index.html:1542 | 3 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatDashboardPageV6509.cleanRemakeV6230 .tatKpisV6509` | (default) | Shared | TatRemakeAliasStyles.html:1363 | 3 | 3 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatTabFilterHostV6509` | (default) | Shared | UnifiedControlsStyles.html:3 | 3 | 3 | 1-0-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatTabFilterHostV6509 .remakeDropdownHeaderV6245 button` | (default) | Shared | TatRemakeAliasStyles.html:149 | 3 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `table` | (default) | Shared | DashboardBaseStyles.html:361 | 3 | 2 | 0-0-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeCompactToolbarV6382 .remakeCompactToolV6382 svg` | (default) | Shared | Index.html:2785 | 2 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337 [data-filter-kind="customer"]` | (default) | Shared | UnifiedControlsStyles.html:56 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337 [data-filter-kind="department"]` | (default) | Shared | UnifiedControlsStyles.html:50 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337 [data-filter-kind="product"]` | (default) | Shared | UnifiedControlsStyles.html:52 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337 [data-filter-kind="productGroup"]` | (default) | Shared | UnifiedControlsStyles.html:54 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337 [data-filter-kind="reason"]` | (default) | Shared | UnifiedControlsStyles.html:58 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatTabFilterHostV6509 [data-filter-kind="customer"]` | (default) | Shared | UnifiedControlsStyles.html:56 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatTabFilterHostV6509 [data-filter-kind="department"]` | (default) | Shared | UnifiedControlsStyles.html:50 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatTabFilterHostV6509 [data-filter-kind="product"]` | (default) | Shared | UnifiedControlsStyles.html:52 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatTabFilterHostV6509 [data-filter-kind="productGroup"]` | (default) | Shared | UnifiedControlsStyles.html:54 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#tatTabFilterHostV6509 [data-filter-kind="reason"]` | (default) | Shared | UnifiedControlsStyles.html:58 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML; same selector appears in multiple at-rule contexts |
| `#remakeTabFilterHostV6337 .remakeDropdownButtonV6245.active` | (default) | Shared | Index.html:1506 | 4 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownButtonV6245.active` | (default) | Shared | TatRemakeAliasStyles.html:120 | 4 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownCountV6245` | (default) | Shared | UnifiedControlsStyles.html:77 | 4 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownPanelV6245` | (default) | Shared | UnifiedControlsStyles.html:60 | 4 | 4 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownPanelV6245.open` | (default) | Shared | UnifiedControlsStyles.html:64 | 4 | 4 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeTabToolButtonV6337` | (default) | Shared | UnifiedControlsStyles.html:79 | 4 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownCountV6245` | (default) | Shared | Index.html:1552 | 3 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeFilter` | (default) | Shared | Index.html:1471 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeFilterBarV6230` | (default) | Shared | Index.html:1458 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeTabToolButtonV6337` | (default) | Shared | Index.html:1622 | 3 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatDashboardPageV6509.cleanRemakeV6230 .tatKpiStageV6509` | (default) | Shared | TatRemakeAliasStyles.html:1362 | 3 | 3 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeCacheActionBarV6338` | (default) | Shared | UnifiedControlsStyles.html:86 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeCacheActionBarV6338 .remakeButton.secondary` | (default) | Shared | UnifiedControlsStyles.html:88 | 3 | 3 | 1-3-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownEmptyV6245` | (default) | Shared | UnifiedControlsStyles.html:78 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownListV6245` | (default) | Shared | TatRemakeAliasStyles.html:176 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownSearchV6245` | (default) | Shared | TatRemakeAliasStyles.html:163 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeFilter` | (default) | Shared | UnifiedControlsStyles.html:33 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeFilterBarV6230` | (default) | Shared | UnifiedControlsStyles.html:20 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeTabResetV6337` | (default) | Shared | UnifiedControlsStyles.html:85 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeTabSearchProxyV6337` | (default) | Shared | UnifiedControlsStyles.html:82 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeTabSearchProxyV6337 svg` | (default) | Shared | UnifiedControlsStyles.html:83 | 3 | 3 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeTabToolButtonV6337:hover` | (default) | Shared | UnifiedControlsStyles.html:80 | 3 | 3 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeTabToolButtonV6337[aria-expanded="true"]` | (default) | Shared | UnifiedControlsStyles.html:80 | 3 | 3 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509[hidden]` | (default) | Shared | UnifiedControlsStyles.html:17 | 3 | 3 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeCacheActionBarV6338` | (default) | Shared | Index.html:1646 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeCacheActionBarV6338 .remakeButton.secondary` | (default) | Shared | Index.html:1670 | 2 | 2 | 1-3-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeCacheActionIconV6338` | (default) | Shared | Index.html:1677 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownButtonV6245::after` | (default) | Shared | Index.html:1497 | 2 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownButtonV6245:hover` | (default) | Shared | Index.html:1506 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownEmptyV6245` | (default) | Shared | Index.html:1617 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownLabelV6245` | (default) | Shared | Index.html:1596 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownListV6245` | (default) | Shared | Index.html:1573 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownMetaV6245` | (default) | Shared | Index.html:1603 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownOnlyV6245` | (default) | Shared | Index.html:1608 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownPanelV6245` | (default) | Shared | Index.html:1514 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownPanelV6245.open` | (default) | Shared | Index.html:1533 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownRowV6245` | (default) | Shared | Index.html:1578 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownRowV6245 input` | (default) | Shared | Index.html:1590 | 2 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownRowV6245:hover` | (default) | Shared | Index.html:1588 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownRowV6245.active` | (default) | Shared | Index.html:1588 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownSearchV6245` | (default) | Shared | Index.html:1558 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeDropdownSearchV6245:focus` | (default) | Shared | Index.html:1569 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeTabResetV6337` | (default) | Shared | Index.html:1645 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeTabSearchProxyV6337` | (default) | Shared | Index.html:1643 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeTabSearchProxyV6337 svg` | (default) | Shared | Index.html:1644 | 2 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeTabToolButtonV6337:hover` | (default) | Shared | Index.html:1637 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeTabToolButtonV6337[aria-expanded="true"]` | (default) | Shared | Index.html:1637 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeVisibleToggleV6502:has(input:checked)` | (default) | Shared | Index.html:300 | 2 | 2 | 1-2-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 .remakeVisibleToggleV6502:has(input:indeterminate)` | (default) | Shared | Index.html:300 | 2 | 2 | 1-2-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 [data-filter-kind="year"]` | (default) | Shared | UnifiedControlsStyles.html:48 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 [data-filter-kind="year"] .remakeDropdownPanelV6245` | (default) | Shared | Index.html:1530 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337 #remakeTabViewsV6382 svg` | (default) | Shared | Index.html:2785 | 2 | 2 | 2-0-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#remakeTabFilterHostV6337[hidden]` | (default) | Shared | Index.html:1438 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatDashboardPageV6509` | (default) | Shared | UnifiedControlsStyles.html:121 | 2 | 2 | 1-0-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatDashboardPageV6509.cleanRemakeV6230 .tatKpiV6509` | (default) | Shared | Index.html:4633 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeCacheActionIconV6338` | (default) | Shared | TatRemakeAliasStyles.html:262 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownButtonV6245::after` | (default) | Shared | TatRemakeAliasStyles.html:112 | 2 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownButtonV6245:hover` | (default) | Shared | TatRemakeAliasStyles.html:120 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownLabelV6245` | (default) | Shared | TatRemakeAliasStyles.html:195 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownMetaV6245` | (default) | Shared | TatRemakeAliasStyles.html:201 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownOnlyV6245` | (default) | Shared | TatRemakeAliasStyles.html:205 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownRowV6245` | (default) | Shared | TatRemakeAliasStyles.html:180 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownRowV6245 input` | (default) | Shared | TatRemakeAliasStyles.html:190 | 2 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownRowV6245:hover` | (default) | Shared | TatRemakeAliasStyles.html:189 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownRowV6245.active` | (default) | Shared | TatRemakeAliasStyles.html:189 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeDropdownSearchV6245:focus` | (default) | Shared | TatRemakeAliasStyles.html:173 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeVisibleToggleV6502` | (default) | Shared | UnifiedControlsStyles.html:69 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeVisibleToggleV6502 input` | (default) | Shared | UnifiedControlsStyles.html:74 | 2 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeVisibleToggleV6502:has(input:checked)` | (default) | Shared | UnifiedControlsStyles.html:75 | 2 | 2 | 1-2-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .remakeVisibleToggleV6502:has(input:indeterminate)` | (default) | Shared | UnifiedControlsStyles.html:75 | 2 | 2 | 1-2-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 .tatSettingsButtonV6509 svg` | (default) | Shared | UnifiedControlsStyles.html:83 | 2 | 2 | 1-1-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 [data-filter-kind="year"]` | (default) | Shared | UnifiedControlsStyles.html:48 | 2 | 2 | 1-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `#tatTabFilterHostV6509 [data-filter-kind="year"] .remakeDropdownPanelV6245` | (default) | Shared | TatRemakeAliasStyles.html:141 | 2 | 2 | 1-2-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; loaded after closing HTML |
| `:root` | (default) | Shared | DashboardBaseStyles.html:2 | 5 | 2 | 0-1-0 | repeated selector; cross-file cascade; shared or cross-dashboard ownership; loaded after closing HTML |
| `html` | (default) | Shared | DashboardBaseStyles.html:1207 | 5 | 2 | 0-0-1 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; same selector appears in multiple at-rule contexts |
| `.managerTabs` | (default) | Shared | DashboardBaseStyles.html:4433 | 4 | 2 | 0-1-0 | repeated selector; cross-file cascade; uses !important; shared or cross-dashboard ownership; same selector appears in multiple at-rule contexts |

## Cross-file selector groups

| Selector | Context | Ownership | Files | First definition | Later overrides |
|---|---|---|---|---|---|
| `th` | (default) | Shared | DashboardBaseStyles.html; TatDashboardControllerScript.html | DashboardBaseStyles.html:367 | DashboardBaseStyles.html:674; DashboardBaseStyles.html:902; DashboardBaseStyles.html:1073; DashboardBaseStyles.html:1152; DashboardBaseStyles.html:1422; DashboardBaseStyles.html:1627; DashboardBaseStyles.html:1824; TatDashboardControllerScript.html:641; TatDashboardControllerScript.html:641 |
| `body` | (default) | Shared | DashboardBaseStyles.html; TatDashboardControllerScript.html; Index.html | DashboardBaseStyles.html:28 | DashboardBaseStyles.html:534; DashboardBaseStyles.html:820; DashboardBaseStyles.html:1107; DashboardBaseStyles.html:1207; DashboardBaseStyles.html:1480; DashboardBaseStyles.html:1673; TatDashboardControllerScript.html:641; Index.html:4682 |
| `td` | (default) | Shared | DashboardBaseStyles.html; TatDashboardControllerScript.html | DashboardBaseStyles.html:384 | DashboardBaseStyles.html:1435; DashboardBaseStyles.html:1635; DashboardBaseStyles.html:1832; TatDashboardControllerScript.html:641 |
| `#tatTabFilterHostV6509 .remakeCacheActionBarV6338 .remakeButton` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:87 | TatRemakeAliasStyles.html:242; SharedTopParityStyles.html:217; SharedTopParityStyles.html:251 |
| `#tatTabFilterHostV6509 .remakeDropdownHeaderV6245` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:65 | TatRemakeAliasStyles.html:142; TatRemakeAliasStyles.html:1067; SharedTopParityStyles.html:141 |
| `#remakeTabFilterHostV6337` | (default) | Shared | Index.html; UnifiedControlsStyles.html; SharedTopParityStyles.html | Index.html:1439 | UnifiedControlsStyles.html:3; SharedTopParityStyles.html:8 |
| `#remakeTabFilterHostV6337 .remakeCacheActionBarV6338 .remakeButton` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1653 | SharedTopParityStyles.html:217; SharedTopParityStyles.html:251 |
| `#remakeTabFilterHostV6337 .remakeDropdownHeaderV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1534 | Index.html:3041; SharedTopParityStyles.html:141 |
| `#remakeTabFilterHostV6337 .remakeDropdownHeaderV6245 button` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1542 | Index.html:3053; SharedTopParityStyles.html:180 |
| `#tatDashboardPageV6509.cleanRemakeV6230 .tatKpisV6509` | (default) | Shared | TatRemakeAliasStyles.html; Index.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:1363 | Index.html:4632; SharedTopParityStyles.html:272 |
| `#tatTabFilterHostV6509` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:3 | TatRemakeAliasStyles.html:66; SharedTopParityStyles.html:8 |
| `#tatTabFilterHostV6509 .remakeDropdownHeaderV6245 button` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:149 | TatRemakeAliasStyles.html:1077; SharedTopParityStyles.html:180 |
| `table` | (default) | Shared | DashboardBaseStyles.html; TatDashboardControllerScript.html | DashboardBaseStyles.html:361 | DashboardBaseStyles.html:1430; TatDashboardControllerScript.html:641 |
| `#remakeCompactToolbarV6382 .remakeCompactToolV6382 svg` | (default) | Shared | Index.html; TatRemakeAliasStyles.html | Index.html:2785 | TatRemakeAliasStyles.html:950 |
| `#remakeTabFilterHostV6337 [data-filter-kind="customer"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:56 | SharedTopParityStyles.html:70 |
| `#remakeTabFilterHostV6337 [data-filter-kind="department"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:50 | SharedTopParityStyles.html:64 |
| `#remakeTabFilterHostV6337 [data-filter-kind="product"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:52 | SharedTopParityStyles.html:66 |
| `#remakeTabFilterHostV6337 [data-filter-kind="productGroup"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:54 | SharedTopParityStyles.html:68 |
| `#remakeTabFilterHostV6337 [data-filter-kind="reason"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:58 | SharedTopParityStyles.html:72 |
| `#tatTabFilterHostV6509 [data-filter-kind="customer"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:56 | SharedTopParityStyles.html:70 |
| `#tatTabFilterHostV6509 [data-filter-kind="department"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:50 | SharedTopParityStyles.html:64 |
| `#tatTabFilterHostV6509 [data-filter-kind="product"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:52 | SharedTopParityStyles.html:66 |
| `#tatTabFilterHostV6509 [data-filter-kind="productGroup"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:54 | SharedTopParityStyles.html:68 |
| `#tatTabFilterHostV6509 [data-filter-kind="reason"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:58 | SharedTopParityStyles.html:72 |
| `#remakeTabFilterHostV6337 .remakeDropdownButtonV6245.active` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1506 | Index.html:1511; SharedTopParityStyles.html:108; SharedTopParityStyles.html:115 |
| `#tatTabFilterHostV6509 .remakeDropdownButtonV6245.active` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:120 | TatRemakeAliasStyles.html:124; SharedTopParityStyles.html:108; SharedTopParityStyles.html:115 |
| `#tatTabFilterHostV6509 .remakeDropdownCountV6245` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:77 | TatRemakeAliasStyles.html:158; TatRemakeAliasStyles.html:1081; SharedTopParityStyles.html:184 |
| `#tatTabFilterHostV6509 .remakeDropdownPanelV6245` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html; Index.html | UnifiedControlsStyles.html:60 | TatRemakeAliasStyles.html:126; SharedTopParityStyles.html:121; Index.html:4685 |
| `#tatTabFilterHostV6509 .remakeDropdownPanelV6245.open` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html; Index.html | UnifiedControlsStyles.html:64 | TatRemakeAliasStyles.html:142; SharedTopParityStyles.html:138; Index.html:4695 |
| `#tatTabFilterHostV6509 .remakeTabToolButtonV6337` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:79 | TatRemakeAliasStyles.html:217; SharedTopParityStyles.html:217; SharedTopParityStyles.html:233 |
| `#remakeTabFilterHostV6337 .remakeDropdownCountV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1552 | Index.html:3059; SharedTopParityStyles.html:184 |
| `#remakeTabFilterHostV6337 .remakeFilter` | (default) | Shared | Index.html; UnifiedControlsStyles.html; SharedTopParityStyles.html | Index.html:1471 | UnifiedControlsStyles.html:33; SharedTopParityStyles.html:44 |
| `#remakeTabFilterHostV6337 .remakeFilterBarV6230` | (default) | Shared | Index.html; UnifiedControlsStyles.html; SharedTopParityStyles.html | Index.html:1458 | UnifiedControlsStyles.html:20; SharedTopParityStyles.html:28 |
| `#remakeTabFilterHostV6337 .remakeTabToolButtonV6337` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1622 | SharedTopParityStyles.html:217; SharedTopParityStyles.html:233 |
| `#tatDashboardPageV6509.cleanRemakeV6230 .tatKpiStageV6509` | (default) | Shared | TatRemakeAliasStyles.html; Index.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:1362 | Index.html:4631; SharedTopParityStyles.html:259 |
| `#tatTabFilterHostV6509 .remakeCacheActionBarV6338` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:86 | TatRemakeAliasStyles.html:236; SharedTopParityStyles.html:249 |
| `#tatTabFilterHostV6509 .remakeCacheActionBarV6338 .remakeButton.secondary` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:88 | TatRemakeAliasStyles.html:258; SharedTopParityStyles.html:253 |
| `#tatTabFilterHostV6509 .remakeDropdownEmptyV6245` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:78 | TatRemakeAliasStyles.html:213; SharedTopParityStyles.html:214 |
| `#tatTabFilterHostV6509 .remakeDropdownListV6245` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html; Index.html | TatRemakeAliasStyles.html:176 | SharedTopParityStyles.html:194; Index.html:4696 |
| `#tatTabFilterHostV6509 .remakeDropdownSearchV6245` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html; Index.html | TatRemakeAliasStyles.html:163 | SharedTopParityStyles.html:188; Index.html:4697 |
| `#tatTabFilterHostV6509 .remakeFilter` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:33 | TatRemakeAliasStyles.html:90; SharedTopParityStyles.html:44 |
| `#tatTabFilterHostV6509 .remakeFilterBarV6230` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:20 | TatRemakeAliasStyles.html:78; SharedTopParityStyles.html:28 |
| `#tatTabFilterHostV6509 .remakeTabResetV6337` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:85 | TatRemakeAliasStyles.html:236; SharedTopParityStyles.html:247 |
| `#tatTabFilterHostV6509 .remakeTabSearchProxyV6337` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:82 | TatRemakeAliasStyles.html:236; SharedTopParityStyles.html:241 |
| `#tatTabFilterHostV6509 .remakeTabSearchProxyV6337 svg` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:83 | TatRemakeAliasStyles.html:236; SharedTopParityStyles.html:243 |
| `#tatTabFilterHostV6509 .remakeTabToolButtonV6337:hover` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:80 | TatRemakeAliasStyles.html:231; SharedTopParityStyles.html:237 |
| `#tatTabFilterHostV6509 .remakeTabToolButtonV6337[aria-expanded="true"]` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:80 | TatRemakeAliasStyles.html:231; SharedTopParityStyles.html:237 |
| `#tatTabFilterHostV6509[hidden]` | (default) | Shared | UnifiedControlsStyles.html; TatRemakeAliasStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:17 | TatRemakeAliasStyles.html:66; SharedTopParityStyles.html:25 |
| `#remakeTabFilterHostV6337 .remakeCacheActionBarV6338` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1646 | SharedTopParityStyles.html:249 |
| `#remakeTabFilterHostV6337 .remakeCacheActionBarV6338 .remakeButton.secondary` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1670 | SharedTopParityStyles.html:253 |
| `#remakeTabFilterHostV6337 .remakeCacheActionIconV6338` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1677 | SharedTopParityStyles.html:255 |
| `#remakeTabFilterHostV6337 .remakeDropdownButtonV6245::after` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1497 | SharedTopParityStyles.html:98 |
| `#remakeTabFilterHostV6337 .remakeDropdownButtonV6245:hover` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1506 | SharedTopParityStyles.html:108 |
| `#remakeTabFilterHostV6337 .remakeDropdownEmptyV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1617 | SharedTopParityStyles.html:214 |
| `#remakeTabFilterHostV6337 .remakeDropdownLabelV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1596 | SharedTopParityStyles.html:208 |
| `#remakeTabFilterHostV6337 .remakeDropdownListV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1573 | SharedTopParityStyles.html:194 |
| `#remakeTabFilterHostV6337 .remakeDropdownMetaV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1603 | SharedTopParityStyles.html:210 |
| `#remakeTabFilterHostV6337 .remakeDropdownOnlyV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1608 | SharedTopParityStyles.html:212 |
| `#remakeTabFilterHostV6337 .remakeDropdownPanelV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1514 | SharedTopParityStyles.html:121 |
| `#remakeTabFilterHostV6337 .remakeDropdownPanelV6245.open` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1533 | SharedTopParityStyles.html:138 |
| `#remakeTabFilterHostV6337 .remakeDropdownRowV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1578 | SharedTopParityStyles.html:198 |
| `#remakeTabFilterHostV6337 .remakeDropdownRowV6245 input` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1590 | SharedTopParityStyles.html:206 |
| `#remakeTabFilterHostV6337 .remakeDropdownRowV6245:hover` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1588 | SharedTopParityStyles.html:202 |
| `#remakeTabFilterHostV6337 .remakeDropdownRowV6245.active` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1588 | SharedTopParityStyles.html:202 |
| `#remakeTabFilterHostV6337 .remakeDropdownSearchV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1558 | SharedTopParityStyles.html:188 |
| `#remakeTabFilterHostV6337 .remakeDropdownSearchV6245:focus` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1569 | SharedTopParityStyles.html:192 |
| `#remakeTabFilterHostV6337 .remakeTabResetV6337` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1645 | SharedTopParityStyles.html:247 |
| `#remakeTabFilterHostV6337 .remakeTabSearchProxyV6337` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1643 | SharedTopParityStyles.html:241 |
| `#remakeTabFilterHostV6337 .remakeTabSearchProxyV6337 svg` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1644 | SharedTopParityStyles.html:243 |
| `#remakeTabFilterHostV6337 .remakeTabToolButtonV6337:hover` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1637 | SharedTopParityStyles.html:237 |
| `#remakeTabFilterHostV6337 .remakeTabToolButtonV6337[aria-expanded="true"]` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1637 | SharedTopParityStyles.html:237 |
| `#remakeTabFilterHostV6337 .remakeVisibleToggleV6502:has(input:checked)` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:300 | SharedTopParityStyles.html:174 |
| `#remakeTabFilterHostV6337 .remakeVisibleToggleV6502:has(input:indeterminate)` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:300 | SharedTopParityStyles.html:174 |
| `#remakeTabFilterHostV6337 [data-filter-kind="year"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:48 | SharedTopParityStyles.html:62 |
| `#remakeTabFilterHostV6337 [data-filter-kind="year"] .remakeDropdownPanelV6245` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1530 | SharedTopParityStyles.html:136 |
| `#remakeTabFilterHostV6337 #remakeTabViewsV6382 svg` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:2785 | SharedTopParityStyles.html:243 |
| `#remakeTabFilterHostV6337[hidden]` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:1438 | SharedTopParityStyles.html:25 |
| `#tatDashboardPageV6509` | (default) | Shared | UnifiedControlsStyles.html; Index.html | UnifiedControlsStyles.html:121 | Index.html:4684 |
| `#tatDashboardPageV6509.cleanRemakeV6230 .tatKpiV6509` | (default) | Shared | Index.html; SharedTopParityStyles.html | Index.html:4633 | SharedTopParityStyles.html:284 |
| `#tatTabFilterHostV6509 .remakeCacheActionIconV6338` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:262 | SharedTopParityStyles.html:255 |
| `#tatTabFilterHostV6509 .remakeDropdownButtonV6245::after` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:112 | SharedTopParityStyles.html:98 |
| `#tatTabFilterHostV6509 .remakeDropdownButtonV6245:hover` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:120 | SharedTopParityStyles.html:108 |
| `#tatTabFilterHostV6509 .remakeDropdownLabelV6245` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:195 | SharedTopParityStyles.html:208 |
| `#tatTabFilterHostV6509 .remakeDropdownMetaV6245` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:201 | SharedTopParityStyles.html:210 |
| `#tatTabFilterHostV6509 .remakeDropdownOnlyV6245` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:205 | SharedTopParityStyles.html:212 |
| `#tatTabFilterHostV6509 .remakeDropdownRowV6245` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:180 | SharedTopParityStyles.html:198 |
| `#tatTabFilterHostV6509 .remakeDropdownRowV6245 input` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:190 | SharedTopParityStyles.html:206 |
| `#tatTabFilterHostV6509 .remakeDropdownRowV6245:hover` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:189 | SharedTopParityStyles.html:202 |
| `#tatTabFilterHostV6509 .remakeDropdownRowV6245.active` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:189 | SharedTopParityStyles.html:202 |
| `#tatTabFilterHostV6509 .remakeDropdownSearchV6245:focus` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:173 | SharedTopParityStyles.html:192 |
| `#tatTabFilterHostV6509 .remakeVisibleToggleV6502` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:69 | SharedTopParityStyles.html:152 |
| `#tatTabFilterHostV6509 .remakeVisibleToggleV6502 input` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:74 | SharedTopParityStyles.html:170 |
| `#tatTabFilterHostV6509 .remakeVisibleToggleV6502:has(input:checked)` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:75 | SharedTopParityStyles.html:174 |
| `#tatTabFilterHostV6509 .remakeVisibleToggleV6502:has(input:indeterminate)` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:75 | SharedTopParityStyles.html:174 |
| `#tatTabFilterHostV6509 .tatSettingsButtonV6509 svg` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:83 | SharedTopParityStyles.html:243 |
| `#tatTabFilterHostV6509 [data-filter-kind="year"]` | (default) | Shared | UnifiedControlsStyles.html; SharedTopParityStyles.html | UnifiedControlsStyles.html:48 | SharedTopParityStyles.html:62 |
| `#tatTabFilterHostV6509 [data-filter-kind="year"] .remakeDropdownPanelV6245` | (default) | Shared | TatRemakeAliasStyles.html; SharedTopParityStyles.html | TatRemakeAliasStyles.html:141 | SharedTopParityStyles.html:136 |
| `:root` | (default) | Shared | DashboardBaseStyles.html; SharedTopParityStyles.html | DashboardBaseStyles.html:2 | DashboardBaseStyles.html:519; DashboardBaseStyles.html:806; DashboardBaseStyles.html:1661; SharedTopParityStyles.html:2 |
| `html` | (default) | Shared | DashboardBaseStyles.html; Index.html | DashboardBaseStyles.html:1207 | DashboardBaseStyles.html:1480; DashboardBaseStyles.html:1673; Index.html:4006; Index.html:4682 |
| `.managerTabs` | (default) | Shared | DashboardBaseStyles.html; Index.html | DashboardBaseStyles.html:4433 | DashboardBaseStyles.html:4690; DashboardBaseStyles.html:5423; Index.html:4683 |

## Static-unreferenced review candidates

| Selector | Context | Ownership | First definition | Occurrences | Risk |
|---|---|---|---|---:|---|
| `.bigKpi` | @media (max-width: 900px) | Shared | DashboardBaseStyles.html:2256 | 1 | High |
| `.filterPanel` | @media (max-width: 900px) | Shared | DashboardBaseStyles.html:2252 | 1 | High |
| `.tatGlobalResultsV6509` | (default) | Shared | UnifiedControlsStyles.html:95 | 1 | High |
| `.tatSettingsChoicesV6509` | (default) | Shared | UnifiedControlsStyles.html:102 | 1 | High |
| `.tatSettingsChoicesV6509 button` | (default) | Shared | UnifiedControlsStyles.html:103 | 1 | High |
| `.tatSettingsV6509` | (default) | Shared | UnifiedControlsStyles.html:100 | 1 | High |
| `.tatSettingsV6509 h4` | (default) | Shared | UnifiedControlsStyles.html:101 | 1 | High |
| `.twoGrid` | @media (max-width: 900px) | Shared | DashboardBaseStyles.html:2244 | 1 | High |
| `.twoShell` | @media (max-width: 900px) | Shared | DashboardBaseStyles.html:2244 | 1 | High |
| `.bigKpi` | (default) | Shared | DashboardBaseStyles.html:444 | 1 | Medium |
| `.bigKpi` | @media (max-width: 1150px) | Shared | DashboardBaseStyles.html:499 | 1 | Medium |
| `.bigKpis` | (default) | Shared | DashboardBaseStyles.html:437 | 1 | Medium |
| `.bigKpis` | @media (max-width: 1150px) | Shared | DashboardBaseStyles.html:505 | 1 | Medium |
| `.filterPanel` | (default) | Shared | DashboardBaseStyles.html:202 | 1 | Medium |
| `.filterPanel` | @media (max-width: 1150px) | Shared | DashboardBaseStyles.html:499 | 1 | Medium |
| `.twoGrid` | (default) | Shared | DashboardBaseStyles.html:463 | 1 | Medium |
| `.twoGrid` | @media (max-width: 1150px) | Shared | DashboardBaseStyles.html:492 | 1 | Medium |
| `.twoShell` | (default) | Shared | DashboardBaseStyles.html:418 | 1 | Medium |
| `.twoShell` | @media (max-width: 1150px) | Shared | DashboardBaseStyles.html:492 | 1 | Medium |
| `.o2LeftRail` | @media (max-width: 820px) | Overview | DashboardBaseStyles.html:3453 | 2 | Medium |
| `.componentMenuSortBlock` | (default) | Shared | DashboardBaseStyles.html:2689 | 1 | Medium |
| `.filterBlock` | (default) | Shared | DashboardBaseStyles.html:222 | 1 | Medium |
| `.mainTwo` | (default) | Shared | DashboardBaseStyles.html:433 | 1 | Medium |
| `.optionGroupHeader` | (default) | Shared | DashboardBaseStyles.html:2032 | 1 | Medium |
| `.sideTwo` | (default) | Shared | DashboardBaseStyles.html:426 | 1 | Medium |
| `.twoCard` | (default) | Shared | DashboardBaseStyles.html:473 | 1 | Medium |
| `.remakeColumnChooserLockV6357` | (default) | Remake | Index.html:2344 | 1 | Low |
| `.remakeKpiChooserHintV6403` | (default) | Remake | Index.html:3606 | 1 | Low |
| `.o2ChartBox` | (default) | Overview | DashboardBaseStyles.html:3424 | 1 | Low |
| `.o2ChartBox` | @media (max-width: 820px) | Overview | DashboardBaseStyles.html:3457 | 1 | Low |
| `.o2LeftRail` | (default) | Overview | DashboardBaseStyles.html:3332 | 1 | Low |
| `.o2MainPane` | (default) | Overview | DashboardBaseStyles.html:3332 | 1 | Low |
| `.o2MainPane` | @media (max-width: 820px) | Overview | DashboardBaseStyles.html:3453 | 1 | Low |
| `.o2RightPane` | (default) | Overview | DashboardBaseStyles.html:3332 | 1 | Low |
| `.o2RightPane` | @media (max-width: 1250px) | Overview | DashboardBaseStyles.html:3447 | 1 | Low |
| `.o2RightPane` | @media (max-width: 820px) | Overview | DashboardBaseStyles.html:3453 | 1 | Low |
| `.o2Summary` | (default) | Overview | DashboardBaseStyles.html:3340 | 1 | Low |
| `.o2Summary` | @media (max-width: 1250px) | Overview | DashboardBaseStyles.html:3448 | 1 | Low |
| `.o2Summary` | @media (max-width: 820px) | Overview | DashboardBaseStyles.html:3455 | 1 | Low |
| `.o2TableWrap` | (default) | Overview | DashboardBaseStyles.html:3425 | 1 | Low |
| `.o2TableWrap` | @media (max-width: 820px) | Overview | DashboardBaseStyles.html:3458 | 1 | Low |
| `.o2TopControls` | (default) | Overview | DashboardBaseStyles.html:3323 | 1 | Low |
| `.o2TopControls` | @media (max-width: 820px) | Overview | DashboardBaseStyles.html:3453 | 1 | Low |
| `.o2YearScoreBox` | (default) | Overview | DashboardBaseStyles.html:3364 | 1 | Low |
| `.o2YearScoreBox` | @media (max-width: 1250px) | Overview | DashboardBaseStyles.html:3449 | 1 | Low |
| `.customerActiveOnlyHint` | (default) | Overview | DashboardBaseStyles.html:7420 | 1 | Low |
| `.o2ChartCard` | (default) | Overview | DashboardBaseStyles.html:3422 | 1 | Low |
| `.o2ChartHeader` | (default) | Overview | DashboardBaseStyles.html:3423 | 1 | Low |
| `.o2DropBox` | (default) | Overview | DashboardBaseStyles.html:3408 | 1 | Low |
| `.o2RailBody` | (default) | Overview | DashboardBaseStyles.html:3395 | 1 | Low |
| `.o2RailBox` | (default) | Overview | DashboardBaseStyles.html:3377 | 1 | Low |
| `.o2RailHeader` | (default) | Overview | DashboardBaseStyles.html:3386 | 1 | Low |
| `.o2RailRow` | (default) | Overview | DashboardBaseStyles.html:3396 | 1 | Low |
| `.o2RailRow input` | (default) | Overview | DashboardBaseStyles.html:3406 | 1 | Low |
| `.o2RailRow:hover` | (default) | Overview | DashboardBaseStyles.html:3405 | 1 | Low |
| `.o2SparkBox` | (default) | Overview | DashboardBaseStyles.html:3421 | 1 | Low |
| `.o2SparkCard` | (default) | Overview | DashboardBaseStyles.html:3420 | 1 | Low |
| `.o2Truncate` | (default) | Overview | DashboardBaseStyles.html:3444 | 1 | Low |
| `.remakeDirectionalNote` | (default) | Remake | DashboardBaseStyles.html:8632 | 1 | Low |
| `.remakeEyebrow` | (default) | Remake | DashboardBaseStyles.html:8406 | 1 | Low |
| `.remakeSubtitle` | (default) | Remake | DashboardBaseStyles.html:8418 | 1 | Low |
| `.remakeViewSectionLabelV6382` | (default) | Remake | RemakeResponsiveStyles.html:150 | 1 | Low |

## Next gate

Choose one small selector group with one clear owner, no cross-dashboard reuse, no cross-file cascade, and no late-document dependency. Validate its exact source and visual behavior before any extraction.
