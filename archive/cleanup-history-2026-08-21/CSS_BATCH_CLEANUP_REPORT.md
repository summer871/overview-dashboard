# Validated CSS Batch Cleanup Report

- Scope: TAT dropdown controls only.
- Rules removed: 12
- Baseline SHA-256: `8d5ffa18e86276dda25fb85c444cb239efe592f0d9590ecd12a3a4071cfef894`
- Result SHA-256: `c2f29e8a7d1350be37875d1c92332b5e9ffbb0091988f1c7e0373e25f86e21de`
- Excluded intentionally: dropdown panel, dropdown header layout, visible-toggle alignment, charts, scripts, HTML, and Apps Script template expressions.

## Removed rules

1. `#tatTabFilterHostV6509 .remakeDropdownButtonV6245::after`
   - Earlier line: 41927
   - Properties preserved later: color, content, font-size, position, right, top, transform
   - Replacement line(s): 42869
2. `#tatTabFilterHostV6509 .remakeDropdownButtonV6245:hover, #tatTabFilterHostV6509 .remakeDropdownButtonV6245.active`
   - Earlier line: 41928
   - Properties preserved later: background, border-color
   - Replacement line(s): 42877
3. `#tatTabFilterHostV6509 .remakeDropdownButtonV6245.active`
   - Earlier line: 41930
   - Properties preserved later: box-shadow
   - Replacement line(s): 42881
4. `#tatTabFilterHostV6509 .remakeDropdownHeaderV6245 button`
   - Earlier line: 41948
   - Properties preserved later: background, border, border-radius, color, cursor, font, padding, white-space
   - Replacement line(s): 42906
5. `#tatTabFilterHostV6509 .remakeDropdownSearchV6245`
   - Earlier line: 41950
   - Properties preserved later: border, border-radius, color, font, height, margin, outline, padding, width
   - Replacement line(s): 42920
6. `#tatTabFilterHostV6509 .remakeDropdownSearchV6245:focus`
   - Earlier line: 41951
   - Properties preserved later: border-color, box-shadow
   - Replacement line(s): 42930
7. `#tatTabFilterHostV6509 .remakeDropdownListV6245`
   - Earlier line: 41952
   - Properties preserved later: max-height, overflow-y, scrollbar-gutter
   - Replacement line(s): 42933
8. `#tatTabFilterHostV6509 .remakeDropdownRowV6245`
   - Earlier line: 41953
   - Properties preserved later: align-items, border-bottom, cursor, display, gap, grid-template-columns, padding, user-select
   - Replacement line(s): 42937
9. `#tatTabFilterHostV6509 .remakeDropdownRowV6245:hover, #tatTabFilterHostV6509 .remakeDropdownRowV6245.active`
   - Earlier line: 41954
   - Properties preserved later: background
   - Replacement line(s): 42946
10. `#tatTabFilterHostV6509 .remakeDropdownRowV6245 input`
   - Earlier line: 41956
   - Properties preserved later: accent-color, height, pointer-events, width
   - Replacement line(s): 42947
11. `#tatTabFilterHostV6509 .remakeDropdownLabelV6245`
   - Earlier line: 41957
   - Properties preserved later: color, font, overflow, text-overflow, white-space
   - Replacement line(s): 42952
12. `#tatTabFilterHostV6509 .remakeDropdownOnlyV6245`
   - Earlier line: 41958
   - Properties preserved later: background, border, border-radius, color, cursor, font, padding
   - Replacement line(s): 42962

## Structural validation

- Marker counts unchanged: `(36, 36, 48, 48, 0, 4)`
- Every removed property has later exact-selector coverage with equal or stronger `!important` status.
