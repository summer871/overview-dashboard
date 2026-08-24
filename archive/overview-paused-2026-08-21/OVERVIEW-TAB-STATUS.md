# Overview Tab — Status: Saved / Disabled

**Date:** 2026-08-20  
**Decision:** Summer Thomas  
**Priority:** After Remake tab is complete

## Current state

Both Overview variants (Overview One and Overview Two) are fully built in `Index.html` but intentionally hidden at runtime by the v6.501 boot CSS in `#cdaRemakeTatBootStylesV6501`.

At runtime, only Remake Factor and TAT are visible.

## What exists

### Overview One (`#overviewOne`)
- Dense executive grid layout
- KPIs: Revenue, Customers, Units, Avg $/Unit, Rev/Customer (all with YoY comparison)
- Charts: Revenue Trend, Customer Count, Units Produced, Revenue/Customer, Avg Price/Unit
- Tables: Customer Movers (Losses/Gains/Top), Product Movers (Losses/Gains/Top)
- Filters: Departments, Products, Customers, Years (searchable multi-select dropdowns)
- Controls: Main/All Depts, YTD/MTD, Undo/Redo

### Overview Two (`#overviewTwo`)
- Command/insight layout with executive panel sidebar
- Revenue Trend hero chart
- Year Pace tile matrix
- Executive Snapshot KPI panel
- Management Readout (Explain Gap / Loss Watch / Growth Wins)
- Deep Dive panels (Gap Drivers, Customer Health, Dept Mix, Biggest Moves)
- Revenue Drivers table (Customers/Products/Categories/Departments)
- Small comparison charts: Customer Count, Units, Rev/Customer, Avg $/Unit

## Rules

- Do NOT delete Overview code from Index.html or DashboardBaseStyles.html
- Do NOT re-enable Overview until Remake tab work is complete
- When re-enabling: remove the boot CSS suppression and register in tab controller
- Data source: existing BigQuery `v_overview_dashboard_cache_source` + Drive cache
- Decision pending: keep One, keep Two, or merge best of both

## Suppression mechanism

```css
/* In Index.html, style #cdaRemakeTatBootStylesV6501 */
#tabOneBtn,
#overviewOne,
#overviewTwo,
#categoricalPage,
/* ... other hidden elements ... */
{ display:none !important; visibility:hidden !important; pointer-events:none !important; }
```

## Related

- ClickUp task: Dashboard - Re-enable and redesign Overview tab
- DashboardBaseStyles.html contains all Overview styling (v6.64+ for Overview Two, v6.68+ for Overview One)
- DashboardMainScript.html contains all Overview rendering logic
