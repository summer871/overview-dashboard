# Executive Overview Dashboard — Issue Log

Status: **CURRENT**
Effective: **2026-08-24**
ClickUp mirror: document `8cqqtzn-2817`, page `8cqqtzn-7777` — `Overview Dashboard — Issue Log — Current`

## Permanent issue-recording rule

Every Executive Overview Dashboard issue discovered during cleanup, development, testing, deployment, or handoff must be recorded in **both this Git issue log and the ClickUp issue log**. This includes open defects, regressions, process/handoff failures, and resolved issues.

Each entry should preserve, when known: issue ID, date, status, symptom, root cause, ownership/file involved, fix or resolution, version/build, code commit, Git/Apps Script synchronization state, `/dev` verification result, production state, and remaining follow-up.

Do not rely on chat history alone as the issue record.

---

## OD-001 — Technician master/detail stacked vertically

**Date:** 2026-08-24  
**Status:** VERIFIED ON `/dev` — improved/fixed for the observed layout defect; overall dashboard cleanup continues  
**Area:** Remake → Technicians  
**Version:** `v6.668`  
**Build:** `AI-CLEANUP-TECH-TABLE-PATH-OWNERSHIP-1`  
**Code commit:** `e1a4b1bf273f938406e8949af64a548be5fe5fca`  
**Branch:** `agent/ai-readable-cleanup-v6.650-2026-08-23`

### Symptom

The Technician master/detail workspace rendered vertically instead of as the intended two-column desktop layout. The Responsible worker table and selected-worker detail/breakdown were stacking rather than remaining left/right.

### Root cause

`SharedDashboardTablePlatformV6586.html` → `prepareCardLayoutV6588(surface)` treated every ancestor between the actual table host and `.remakeCard` as a table-owned layout-path node. It therefore claimed the Technician structural layout containers and applied inline `!important` flex-column geometry to nodes whose layout is owned by the Technician master/detail component.

The structural nodes being incorrectly claimed were:

- `.technicianMasterDetailV6667`
- `.technicianMasterPanelV6667`
- `.technicianDetailPanelV6667`

That table-path ownership defeated the canonical Technician grid layout.

### Fix

In `SharedDashboardTablePlatformV6586.html`:

- Added `structuralLayoutOwnerSelectorV6668` for the three Technician structural containers.
- Added `tablePathOwnsNodeV6668(node)` so expanded table-path traversal does not claim those structural layout owners.
- Kept the existing collapsed-path behavior deliberately unchanged.
- Kept `clearSurfacePathV6588(surface)` as the cleanup mechanism so stale inline path geometry is removed before the surface is rebuilt.
- Did not add another layout owner, timer, observer, global workaround, or CSS pile-on.
- Preserved the actual table host as the table sizing/resize owner, including saved widths, colgroup behavior, drag resize, double-click fit, and overflow handling.

`SharedFooter.html` was bumped in the same release to `v6.668` / `AI-CLEANUP-TECH-TABLE-PATH-OWNERSHIP-1`.

### Verification

- Git/GitHub source verified at commit `e1a4b1bf273f938406e8949af64a548be5fe5fca`.
- Same v6.668 source pushed to Apps Script HEAD with `clasp.cmd --user work push`.
- Production was not changed.
- Real-data `/dev` footer showed `UI: v6.668` and `Build: AI-CLEANUP-TECH-TABLE-PATH-OWNERSHIP-1`.
- `/dev` screenshot showed Responsible worker on the left and selected-worker Product breakdown on the right again.
- Summer described the result as **better**. Treat this as verification of the observed stacking fix, not as final acceptance of the entire dashboard cleanup.

### Remaining follow-up

Continue cleanup/regression QA from v6.668. Do not create another speculative layout fix unless a remaining `/dev` defect is observed.

---

## OD-002 — PowerShell clipboard/error wrapper was not paste-safe

**Date:** 2026-08-24  
**Status:** PROCESS RULE CORRECTED; future command blocks must be syntax-checked before delivery  
**Area:** AI → Windows PowerShell deployment/diagnostic handoff  
**Dashboard code impact:** None

### Symptom

A PowerShell handoff successfully completed the Git + clasp source synchronization, but the surrounding diagnostic wrapper produced interactive-shell errors such as:

- `finally is not recognized...`
- `else is not recognized...`

The transcript/clipboard approach could also miss the final terminal exception because `Stop-Transcript` happened before all final shell diagnostics were emitted.

### Root cause

The wrapper depended on multiline interactive parsing of structural keywords (`try` / `catch` / `finally` and later `if` / `else`) in a way that was fragile when pasted/executed in the existing PowerShell session. It also relied on transcript timing rather than capturing the completed command output streams as the clipboard source.

### Resolution / permanent handoff rule

- Syntax-check every PowerShell command block before sending it to Summer.
- Prefer paste-safe command structures; do not send orphanable/separately parsed `else`, `catch`, or `finally` constructs.
- Capture the actual command output/error streams into a file and copy that completed text to the clipboard only after the command body finishes.
- Use full-stream capture such as `*>&1 | Tee-Object` or an equally safe tested pattern when appropriate.
- Preserve the backup text file in `%TEMP%` when command diagnostics are being returned to ChatGPT.
- Do not ask for screenshots when text diagnostics can be pasted or uploaded.
- Never include commands that expose passwords, OAuth tokens, `.clasprc.json`, Script Property values, private keys, or other secrets.

### Verification note

The wrapper syntax failure did **not** invalidate the v6.668 dashboard handoff itself. The command output had already reached the explicit v6.668 completion markers showing Git/GitHub verified/pushed, Apps Script HEAD pushed with clasp, and production unchanged.

### Remaining follow-up

The next user-run PowerShell block must use a syntax-checked, paste-safe clipboard/error-capture pattern before it is sent.
