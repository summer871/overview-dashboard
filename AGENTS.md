# Executive Overview Dashboard — Mandatory AI Working Rules

Status: **CURRENT**  
Effective: **2026-08-24**  
Repository: `summer871/overview-dashboard`  
Working/test branch: `agent/ai-readable-cleanup-v6.650-2026-08-23`  
Local project folder: `C:\AppsScript\Overview Dashboard`  
Apps Script ID: `19ep_9Khzq86AIdumIxVN9BfM6rMwG0cHlPaUr46CZy_xJ1ve6_CcHhmo`

These rules are the default operating contract for AI work on this repository. Read and apply them before proposing or executing dashboard changes.

## 1. This is a Shared Dashboard

Treat shared behavior as the architectural default across **all dashboard tabs**, including Remake, TAT, and future tabs.

Before making a tab-specific fix, determine whether the behavior belongs to the shared dashboard platform. Shared ownership is the default for common behavior such as:

- click/cross-filter state;
- KPI recalculation from active filters/selections;
- chart/table selection behavior;
- reset/clear behavior;
- shared table interactions;
- shared layout/sizing/persistence behavior where applicable;
- common toolbar/filter/header behavior.

Do **not** patch one tab independently when the correct owner is shared infrastructure. A tab-specific exception is allowed only when the metric or behavior is genuinely tab-specific and that exception is intentional.

## 2. Execute known work instead of re-arguing it

When Summer says `fix`, `continue`, `go`, `do it`, or equivalent and the exact scope is already established:

- proceed with the known authorized work;
- do not repeat long explanations of the plan;
- do not ask Summer to reconfirm details already established in the current workstream;
- do not stop after describing what should be done;
- keep progress messages short;
- after a test push, tell Summer **what changed** and **exactly what to look for on `/dev`**.

If a real material ambiguity affects destination, production, destructive behavior, or the requested feature itself, resolve that ambiguity. Otherwise, execute.

## 3. Every approved Apps Script source update uses one handoff block

For Executive Overview Dashboard test/HEAD changes, the normal handoff is **one PowerShell block** that performs the complete test-source workflow in one run:

1. verify the repository, branch, Apps Script ID, and allowed changed-file set;
2. apply or verify the approved source edits;
3. bump `SharedFooter.html` version/build when the source release uses those markers;
4. stage only intended Git files;
5. commit and push the authorized Git branch;
6. run `clasp.cmd --user work status`;
7. run `clasp.cmd --user work push` immediately in the same block;
8. capture complete output/errors and copy the final text to the Windows clipboard;
9. stop and direct Summer to the existing `/dev` URL for real-data validation.

Do **not** make Summer run a second manual Git/clasp command sequence after an approved handoff unless recovery from a specific failure truly requires it.

A docs-only Git update does not require an Apps Script push.

## 4. Git + Apps Script HEAD are a dual-push pair

For clasp-accessible dashboard source changes:

- Git/GitHub-only is incomplete.
- Apps Script HEAD-only is incomplete.
- The same approved source release must reach both.
- If only one side succeeds, state **NOT synchronized**, preserve the successful side, and repair only the failed side.
- Never claim synchronization without evidence from both paths.

**Never run `clasp pull` for this dashboard.**

Do not substitute GitHub Actions, Apps Script editor edits, Drive, `push-dashboard.*`, or another deployment mechanism unless Summer explicitly requests that alternate method.

## 5. `/dev` is the acceptance gate

Real-data `/dev` behavior is the final acceptance authority for dashboard UI behavior.

After every source push to Apps Script HEAD:

1. stop further cleanup/feature work;
2. have Summer check the footer UI version/build first;
3. give a short list of the exact behavior changed and the regressions most relevant to that change;
4. do not call the release validated until Summer confirms the real-data `/dev` result.

Production is separate. **Do not update production without Summer's explicit post-test production authorization.**

## 6. PowerShell handoffs must be paste-safe

Every PowerShell block sent to Summer must be syntax-checked for interactive paste behavior before delivery.

Mandatory rules:

- use one coherent outer script block when structural control flow is needed;
- do not send orphanable top-level `else`, `catch`, or `finally` constructs;
- do not use a transcript wrapper pattern that can detach `finally` in the interactive shell;
- native `git`/`clasp` stderr warning text is not itself a failure — determine native success from `$LASTEXITCODE`;
- flatten captured native command output; do not return nested arrays that stringify as `System.Object[]`;
- avoid helpers that both emit and re-return captured output in a way that duplicates the transcript;
- stop on a genuine nonzero native exit code;
- capture final output/errors to a file and copy completed text to the clipboard;
- never print or copy secrets, tokens, `.clasprc.json`, private keys, or Script Property values.

Known process failures are recorded in `docs/OVERVIEW-DASHBOARD-ISSUE-LOG.md` (OD-002, OD-004, OD-005). Do not repeat them.

## 7. Every dashboard issue is mirrored in Git and ClickUp

Every discovered dashboard defect, regression, deployment problem, or AI handoff/process failure must be recorded in both:

- Git: `docs/OVERVIEW-DASHBOARD-ISSUE-LOG.md`
- ClickUp: document `8cqqtzn-2817`, page `8cqqtzn-7777` — `Overview Dashboard — Issue Log — Current`

Use `OD-###` IDs and preserve status, root cause, ownership, fix, version/build, Git state, Apps Script HEAD state, `/dev` result, production state, and follow-up when known.

## 8. Cleanup must resume from the reverted-cleanup blueprint safely

The current cleanup is a controlled reapplication of the previous broad cleanup that had to be backed away from.

Use the old cleanup only as an architectural checklist/blueprint. Do not blindly replay stale modules or wholesale old commits.

For cleanup batches:

- extract **exact current code**;
- preserve exact behavior and load order;
- prefer small, reversible ownership-seam extractions;
- group only clearly independent low-risk leaves;
- do not mix behavior refactors with mechanical extraction;
- verify each batch on real-data `/dev` before continuing;
- keep shared lifecycle/state/layout ownership until later, after low-risk leaf runtimes are separated;
- stop when the remaining main runtime is genuinely coupled orchestration.

## 9. Communication standard for Summer

Keep dashboard work concise and action-oriented.

Before a governed write, emit the required short runbook preflight line. After that, execute rather than restating the same plan.

After a test push, report only what Summer needs next:

- version/build;
- what was edited;
- Git/GitHub state;
- Apps Script HEAD state;
- production state;
- the exact `/dev` checks.

Do not turn an established fix into a prolonged planning conversation.