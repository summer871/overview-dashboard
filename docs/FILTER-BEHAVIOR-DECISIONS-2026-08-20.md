# Filter Behavior Decisions — 2026-08-20

**Decided by:** Summer Thomas  
**Context:** ClickUp Brain session reviewing dashboard architecture and filter UX

## Two distinct filtering behaviors

### Dropdown filters (top bar) = hard population filter

- When a dropdown selection is made, the entire dashboard (KPIs, chart, ALL tables) shows ONLY data matching that selection
- Everything else is excluded from the population
- This is a data cut, not a highlight

### Table/chart click = soft cross-filter (highlight/dim)

- When a user clicks a row in a table or a segment in a chart, non-matching items are greyed out but still visible
- The full context remains present
- This is focus/emphasis, not exclusion

## Linked inventory behavior (dropdowns only)

When one dropdown filter changes, other dropdowns auto-deselect options that would return zero rows:

- All options remain VISIBLE in every dropdown (nothing disappears)
- All options remain SELECTABLE (user can manually check anything)
- Options that have zero rows given the other active filters become UNCHECKED automatically
- The dashboard population updates based on what's checked
- This is standard filter behavior: a filter filters

### Example

Department = "Implant" selected:
- Open Product dropdown: every product still listed
- Products that exist in Implant cases remain checked
- Products that have zero Implant rows become unchecked (but still visible, still selectable)
- Dashboard shows only Implant + checked products

### What this is NOT

- NOT hiding/removing options from the list
- NOT showing greyed-out zero-count rows with special styling
- NOT a complex cascading system
- Just: when a filter narrows the population, other filters auto-deselect what's no longer in that population

## What this means for the shared filter module

1. When any filter selection changes, recalculate which options in OTHER filters have matching rows
2. Auto-deselect (uncheck) options in other filters that now have zero rows
3. Options stay in the list, stay selectable, just lose their checkmark
4. Table/chart cross-filtering is a completely separate system from dropdown filtering

## References

- Full filter spec: `docs/OVERVIEW-DASHBOARD-SHARED-FILTER-HEADER-SPEC.md`
- Shared filter module (WIP): `SharedFilterBar.html` + `SharedFilterBarStyles.html`
- Module spec: `docs/SHARED-FILTER-MODULE-SPEC.md`
