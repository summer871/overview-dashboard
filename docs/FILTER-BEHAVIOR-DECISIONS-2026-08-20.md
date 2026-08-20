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

When one dropdown filter changes, other dropdowns update their **counts** to reflect the current population:

- All options remain visible in every dropdown (nothing is hidden)
- All options remain checkable (user stays in control)
- Each option row shows its count based on the current filtered population from OTHER active filters
- Zero-count options appear visually softer but are NOT hidden and NOT auto-deselected
- The user manually controls what's selected; the system never auto-deselects on their behalf

### Example

Department = "Implant" selected:
- Open Product dropdown: every product still listed
- `Fuzion Layered Zirconia PC: 47` (has Implant cases)
- `Emax Posterior Crown Stained: 0` (no Implant cases, but still visible and checkable)
- User can still select the Emax product if they want (maybe for comparison)

## What this means for the shared filter module

1. The adapter's `getOptions(filterKey)` must accept context about other active filters and return counts per option
2. The rendering must show counts and visually dim zero-count options without hiding them
3. Selection state is never auto-mutated by population changes
4. Table/chart cross-filtering is a completely separate system from dropdown filtering

## References

- Full filter spec: `docs/OVERVIEW-DASHBOARD-SHARED-FILTER-HEADER-SPEC.md`
- Shared filter module (WIP): `SharedFilterBar.html` + `SharedFilterBarStyles.html`
- Module spec: `docs/SHARED-FILTER-MODULE-SPEC.md`
