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

---

## OD-003 — Shared Dashboard click/cross-filter does not recalculate Remake KPIs

**Date:** 2026-08-24
**Status:** VERIFIED ON `/dev`
**Area:** Shared Dashboard interaction contract — cross-filter → KPI recalculation
**Version:** `v6.670`
**Build:** `AI-SHARED-CROSSFILTER-KPI-SYNC-1`
**Code commit:** `b2bcccb614b3b3cade7957cfe8fe3458ae43440d`
**Branch:** `agent/ai-readable-cleanup-v6.650-2026-08-23`

### Symptom

Clicking a Remake table value changed the click/cross-filter selection and table presentation, but the KPI strip could remain at the pre-click values.

### Root cause

The Remake row-filter engine already applies `crossFilterValuesV6634(...)` to department, product, product group, customer, and reason.

The KPI comparison cache did not include those cross-filter values in `comparisonFilterSignatureV6301()`, so `comparisonPackV6301()` could reuse a stale KPI result after a table or chart click.

TAT already recalculates its KPI comparison through its active cross-filter state. Shared Dashboard behavior requires the same interaction contract across tabs unless a documented metric-specific exception applies.

### Fix

Added all supported Remake click/cross-filter dimensions to the KPI comparison-cache signature:

- department
- product
- productGroup
- customer
- reason

No KPI formula or denominator rule was changed. Existing Reason behavior remains intact: reason filters narrow the remake numerator without shrinking the established Total Cases denominator.

### Verification

- Git/GitHub contains the v6.670 source at code commit `b2bcccb614b3b3cade7957cfe8fe3458ae43440d`.
- Apps Script HEAD was pushed from the same local source set; the subsequent handoff reported `Script is already up to date.`
- Summer verified the real-data `/dev` behavior and reported `v6.670 good` on 2026-08-24.
- Production was not changed.

### Acceptance

- Remake click/cross-filter selections now recalculate the KPI strip as intended.
- Clearing the selection restores the prior KPI scope.
- Existing Reason denominator semantics remain unchanged.
- Shared-dashboard cross-filter behavior remains the architectural default across tabs.

### Remaining follow-up

Resume the controlled cleanup from the verified v6.670 baseline. Do not reopen OD-003 unless a real `/dev` regression is observed.

---

## OD-004 — PowerShell native stderr warning was treated as a terminating failure

**Date:** 2026-08-24
**Status:** PROCESS FIXED
**Area:** AI → Windows PowerShell deployment/diagnostic handoff
**Dashboard code impact:** None

### Symptom

During the v6.670 OD-003 handoff, `git diff --check` emitted the normal Git warning `LF will be replaced by CRLF the next time Git touches it` for the issue-log Markdown file. PowerShell treated that stderr warning as a terminating `NativeCommandError`, stopped the wrapper, and reported `CHATGPT_RUN_FAILED=true` even though the native Git warning itself did not establish a failed Git exit code.

### Root cause

The wrapper used `$ErrorActionPreference = 'Stop'` around native Git commands. In that PowerShell environment, native stderr output was surfaced as PowerShell error records, so harmless warning text could terminate the script before `$LASTEXITCODE` was evaluated.

### Resolution / permanent handoff rule

For native executables such as `git` and `clasp`, capture stderr into the output stream and determine success from `$LASTEXITCODE`, not from the presence of warning text. Keep PowerShell/.NET failures terminating, but do not let informational native stderr warnings become false deployment failures.

Production was untouched.

---

## OD-005 — PowerShell capture wrapper returned nested array as branch name

**Date:** 2026-08-24
**Status:** PROCESS FIXED
**Area:** PowerShell deployment handoff
**Dashboard code impact:** None

The v6.670 handoff stopped with `Wrong branch: System.Object[]` because native command output was returned as a nested PowerShell array.

The wrapper was corrected to flatten native output before reading single-value results such as the Git branch name.

Production was untouched.

---

## OD-006 — v6.671 extracted module contained a blank line at EOF

**Date:** 2026-08-24
**Status:** PROCESS FIXED
**Area:** AI → PowerShell cleanup/deployment handoff
**Version:** `v6.671`
**Build:** `AI-CLEANUP-POPOUT-CONTROLLER-RUNTIME-1`
**Dashboard behavior impact:** None

### Symptom

The v6.671 mechanical popout-controller extraction completed successfully, but `git diff --cached --check` stopped the handoff with `RemakePopoutControllerRuntimeV6339.html:36: new blank line at EOF.`

### Root cause

The exact extraction boundary intentionally stopped immediately before `slimDataV6230`, but the separator whitespace between the two source regions was included at the end of the newly created module. Git correctly rejected that new EOF blank line during the staged diff safety check.

### Resolution / permanent handoff rule

For a newly extracted runtime module, preserve the exact implementation and source order but normalize trailing separator whitespace so the new file ends with exactly one final newline before staging. Continue to require `git diff --cached --check` before every commit.

The original v6.671 run stopped before commit, Git push, clasp push, or production deployment. The recovery resumes from the already-extracted local source rather than repeating the extraction.

Production remained untouched.
