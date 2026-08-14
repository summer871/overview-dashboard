# Executive Overview Dashboard / Remake Factor — Super-Detailed Handoff

**Prepared:** 2026-08-13, California time (`America/Los_Angeles`)  
**Repository:** `summer871/overview-dashboard`  
**Working branch:** `agent/v6.544-shared-table-platform-5118`  
**Branch head before this documentation commit:** `17b686ff6969aa283d254ac0b1f9b92242a4550d`  
**Current browser integration:** `RemakeRootAttributionBrowserIntegrationV1351.html` / v1.35.2  
**Scope of this commit:** documentation only. No dashboard logic, cache logic, Apps Script deployment, trigger, Script Property, or production behavior is changed by this file.

---

## 1. Current business problem

The Remake Factor dashboard is intended to answer **what original/underlying work was remade or adjusted**. The old/current root-attribution implementation safely avoids false attribution by mapping only exact confirmed root Product IDs and otherwise projecting review states such as:

- `Review - Ambiguous Root Product`
- `Review - Product Changed / No Exact Match`
- `Unresolved - Unconfirmed Root`

Those labels are attribution statuses, not real departments/products. They currently appear in Product / Product Group / Department reporting only so unresolved work remains visible instead of silently falling back to the wrong current product.

The business-rule work has now advanced beyond the original exact-root-only policy, especially for **adjustment events**. The goal is a deterministic layer that maps adjustment stand-ins to the nearest defensible historical product without changing remake-event counting.

---

## 2. Critical invariant — product line is authoritative for remake status

This must not regress.

- A product line is a remake only when **that product line** carries the remake flag/value.
- Do **not** propagate a case-level remake status to unrelated lines.
- A case is a Remake Case when it contains at least one remake-flagged product line.
- Remake Units = quantity of remake-flagged product lines only.
- Remake Discount = the recorded remake discount on each remake line.
- `Remake 0%` still counts as a remake event when the line is flagged.
- `remakeCaseID` is **not** used to decide whether a line is a remake.
- `remakeCaseID` is used for historical chain tracing / previous case / root case / product attribution.

Do not redefine event totals merely because product attribution changes.

---

## 3. Keep event, chain, attribution, and worker concepts separate

The data model must keep these distinct:

1. **Current remake case** — the case where the current event is recorded.
2. **Current remake product line** — exact flagged line on the current case.
3. **Event Type** — True Remake vs Adjustment.
4. **Adjustment Type** — e.g. Adjust Crown, Adjust Shade, Add Contact.
5. **Immediate previous case** — case directly referenced by `remakeCaseID`.
6. **Root case** — earliest confirmed case in the linked chain.
7. **Underlying/original product** — historical product actually being remade/adjusted.
8. **Underlying Product Group / Department / reporting family**.
9. **Responsible Ceramist/Technician** — future responsibility attribution that must align with historical product/case context.

Do not collapse these into a single generic product/case field.

---

## 4. Adjustment event classifier

Approved business rule for adjustment stand-in products:

- any product whose **product name contains `Adjust`**
- **Add Contact**

Examples:

- `Fixed - Adjust Crown` → Adjustment
- `Implant - Adjust Crown` → Adjustment
- `Fixed - Adjust Shade` → Adjustment
- `Implant - Adjust Shade` → Adjustment
- `Fixed - Add Contact` → Adjustment
- `Implant - Add Contact` → Adjustment

Important distinctions:

- `Adjust Shade` = Adjustment event.
- `Custom Shade` = a real product/service, not the adjustment stand-in.
- An Adjustment may be flagged as a remake in Magic Touch, but analytically it is not automatically a full remake of the stand-in service product.
- The Adjustment still needs attribution to the historical product that was actually adjusted.

Example:

`Fixed - Adjust Shade` → Event Type `Adjustment` → Adjustment Type `Adjust Shade` → underlying `Fixed - Zirfit Prime - Posterior Crown` → Product Group `Solid Zirconia` → Crown classification `Yes`.

---

## 5. Separate Remake vs Adjustment KPI concept

Current approved direction:

- **Remake Case:** at least one remake-flagged real-product line exists.
- **Adjustment Case:** adjustment line(s) exist, but no flagged real-product line makes the case a true-remake case.
- If a case contains both a flagged real-product line and adjustment line(s), the headline case remains **Remake Case** so the same case is not double-counted in both headline case populations.
- Adjustment units/dollars can still be tracked independently at line level.

Potential dashboard measures:

- Remake Cases
- Adjustment Cases
- Remake Case Rate
- Adjustment Case Rate
- Remake Units
- Adjustment Units
- Remake Discount
- Adjustment Discount

This is a business/design direction only. Production implementation is not yet authorized.

---

## 6. Canonical Crown classification

**Do not use product-description keywords to decide whether something is a Crown.** This was explicitly corrected during review.

Crown reporting is Product Group + Department based.

Approved Crown Product Groups:

- `Emax`
- `Solid Zirconia`
- `Layered Zirconia`
- `Gold Crown`
- `PFM`
- `Temp Crown`

Department rule:

> **Anything in Department = `Alloy` is NOT Crown**, regardless of Product Group.

Conceptually:

```text
Crown =
  Department != Alloy
  AND Product Group in (
    Emax,
    Solid Zirconia,
    Layered Zirconia,
    Gold Crown,
    PFM,
    Temp Crown
  )
```

Do not exclude a product from Crown merely because its description says Bridge, Veneer, Wing, Pontic, Connector, etc. Product-name keyword narrowing was explicitly rejected. Those products remain classified according to their Product Group, subject to the Alloy exclusion.

Future goal: use this canonical classifier for a `Crowns Only` dashboard filter.

---

## 7. Adjustment attribution must prefer nearest prior qualifying product

Major rule change discovered during manual case review:

For **Adjustment** events, do not automatically jump to the terminal root case.

Preferred logic:

1. Start with the **immediate previous case** in the `remakeCaseID` chain.
2. Look for the best defensible underlying product there.
3. Prefer the **nearest prior qualifying product** the adjustment could logically be acting on.
4. Only walk farther back if the immediate previous case cannot provide a defensible mapping.

This is intentionally different from true-remake root/original-product analysis.

### Confirmed precedent — case 385404

Current:
- `Fixed - Adjust Crown`
- `Implant - Adjust Crown`

Chain:
- `385404 -> 380860 -> 378566`

The terminal root `378566` only showed a Fixed crown, which originally made the Implant adjustment appear conflicting. The immediate previous case `380860` contained both:

- Fixed Fuzion Layered Zirconia Anterior Crown
- Implant Fuzion Layered Zirconia Anterior Crown

Therefore:

- Fixed adjustment → nearest prior Fixed crown
- Implant adjustment → nearest prior Implant crown

**385404 is resolved using nearest-prior logic.**

---

## 8. Adjustment Department mismatch may be a data-entry error

A current Adjustment Department mismatch does not automatically mean the historical product is unclassifiable.

### Confirmed precedent — case 374409

Current flagged line:
- `Fixed - Adjust Shade`

Historical product:
- `Implant - Fuzion Layered Zirconia - Anterior Crown`

Manual case review concluded the wrong adjustment stand-in was selected; it should have been `Implant - Adjust Shade`.

Decision:
- Attribution = Resolved
- Underlying Department = Implant
- Underlying Product Group = Layered Zirconia
- Adjustment Type = Adjust Shade
- Add data-quality flag such as `Adjustment Department Mismatch / Wrong Adjustment Product Selected`

This precedent may resolve additional cases when product/teeth evidence is clear.

---

## 9. Underlying product does not have to be Crown

Do not force every Adjustment to a Crown.

### Confirmed precedent — cases 374468 and 375256

Current event:
- `Implant - Adjust Crown`

Historical products include:
- `Implant - Custom Tissue Former`
- `Implant - Doctor's Analog`
- `Implant - Soft Tissue Model`

Business decision:
- `Implant - Custom Tissue Former` is not Crown, but it is a legitimate final product.
- There apparently was no dedicated `Adjust Abutment`-type stand-in, so `Implant - Adjust Crown` was used as the adjustment service code.

Decision for both cases:
- Event Type = Adjustment
- Underlying Product = `Implant - Custom Tissue Former`
- Department = Implant
- Product Group = Implant Part
- Crown = No
- Attribution = Resolved

---

## 10. Intentionally Can't Classify for now

These are not normal errors; they are intentionally left unresolved until the business definition is finalized.

### Diagnostic Wax-Up

`Fixed - Diagnostic Wax-Up` is effectively a crown made in wax, but it can represent either a digital or hand-waxed workflow. Current data does not reliably separate the two.

Cases:
- `377708`
- `378842`
- `378847`
- `380316`

Status: **Can't Classify — Diagnostic Wax-Up**.

### Digital Design

`Fixed - Digital Design` is effectively a digital crown in this context, but classification is intentionally deferred for now.

Case:
- `385236`

Status: **Can't Classify — Digital Design**.

---

## 11. Cases already manually resolved

### 374468
- Adjustment: Implant - Adjust Crown
- Underlying final product: Implant - Custom Tissue Former
- Product Group: Implant Part
- Department: Implant
- Crown: No
- Status: Resolved

### 375256
- Same logic as 374468
- Underlying final product: Implant - Custom Tissue Former
- Status: Resolved

### 374409
- Current: Fixed - Adjust Shade
- Historical: Implant Fuzion Layered Zirconia Anterior Crown
- Wrong adjustment Department stand-in was selected
- Treat intended stand-in as Implant - Adjust Shade
- Status: Resolved with department-mismatch data-quality flag

### 385404
- Current: Fixed Adjust Crown + Implant Adjust Crown
- Chain: 385404 -> 380860 -> 378566
- Immediate previous 380860 contains both Fixed and Implant Layered Zirconia crowns
- Map each Adjustment to the same-department crown on 380860
- Status: Resolved using nearest-prior logic

---

## 12. Active manual review queue — six cases

Do not restart from all 764 ambiguous cases. Continue these cases one by one.

### 12.1 Case 387583 — strong exact-teeth evidence, likely resolvable

Current flagged lines:
- `Fixed - Adjust Shade`, teeth `24,25`, qty 2
- `Implant - Adjust Shade`, teeth `23,26`, qty 2

Immediate previous/source case: `385067`

Historical exact-teeth evidence:
- `Implant - Fuzion Layered Zirconia - Anterior Crown` (`LZI1AC`) → teeth `23,26`
- `Implant - Fuzion Layered Zirconia - Anterior Crown - Pontic` (`LZACP`) → teeth `24,25`

Strong candidate mapping:
- current Implant Adjust Shade teeth 23,26 → Implant Anterior Crown teeth 23,26
- current Fixed Adjust Shade teeth 24,25 → Implant Anterior Crown - Pontic teeth 24,25

Interpretation:
- the Fixed adjustment line appears to be another wrong-department adjustment stand-in, analogous to 374409.

Likely resolution pending user confirmation:
- Implant adjustment → Implant anterior crown
- Fixed adjustment → Implant anterior crown pontic
- add wrong-adjustment-department audit flag to the Fixed adjustment line

### 12.2 Case 390678 — likely wrong adjustment Department

Current:
- `Implant - Adjust Shade`

Historical case `387940`:
- `Fixed - Emax - Anterior Crown, Layered`
- `Fixed - Digital Model - Full Arch`

Only clear Crown-group product:
- Fixed Emax Anterior Crown, Layered

Problem:
- current adjustment Department = Implant
- historical crown Department = Fixed

This looks analogous to 374409 and may simply be the wrong adjustment stand-in. Do not auto-resolve until business review confirms it.

### 12.3 Case 380182 — possible one-to-many quantity reconciliation

Current:
- `Fixed - Adjust Shade`
- adjustment qty = 5

Historical case `371041`:
- Fixed Fuzion Layered Zirconia Anterior Bridge — Layered Zirconia — qty 1
- Fixed Zirfit Wing — Solid Zirconia — qty 4
- Fixed Custom Shade — Service
- Fixed Stone Model — Printed Model

Under the approved Product Group Crown rule, both Layered Zirconia and Solid Zirconia qualify as Crown classification.

Numerical clue:
- current adjustment qty = 5
- historical qualifying Crown units = 1 + 4 = 5

Potential one-to-many mapping:
- 1 unit → Layered Zirconia
- 4 units → Solid Zirconia

Need exact teeth or another deterministic rule before production splitting.

### 12.4 Case 383214 — possible one-to-many quantity reconciliation

Current:
- `Fixed - Adjust Crown`
- qty = 3
- observed reason: Adjust Porcelain

Historical case `381267`:
- Fixed Emax Posterior Crown, Stained — Emax — qty 1
- Fixed Zirfit Prime Posterior Crown — Solid Zirconia — qty 2
- Fixed Stone Model

Numerical clue:
- current adjustment qty = 3
- historical Crown units = 1 + 2 = 3

Potential mapping:
- 1 unit → Emax
- 2 units → Solid Zirconia

Need exact teeth or explicit business approval before implementing one-to-many allocation.

### 12.5 Case 393112 — mixed true-remake + adjustment event

Current products include:
- `Fixed - Adjust Crown`
- `Fixed - Emax - Veneer`

The Emax Veneer is a real product line, not just a service stand-in.

Observed reason:
- Add porcelain

Historical case `391171` includes:
- Fixed Emax Veneer — Emax
- Fixed Fuzion Layered Zirconia Posterior Crown — Layered Zirconia
- Fixed Reconstruction - 7-11 Units Single Arch — Reconstruction
- Fixed Stone Model

Likely line-level interpretation to investigate:
1. Current Emax Veneer → historical Emax Veneer (true-remake line).
2. Current Adjust Crown → historical Layered Zirconia Posterior Crown (Adjustment line).

If supported, headline case remains **Remake Case** because a real product line is flagged, while the adjustment line is separately attributed.

### 12.6 Case 397050 — likely resolvable with historical tooth 13

Current:
- `Implant - Add Contact`
- tooth = `13`
- qty = 1
- reason = Add Mesial Contact

Historical case `391780` has at least:
- Implant Fuzion Layered Zirconia Posterior Crown — Layered Zirconia
- Implant Zirfit Prime Posterior Crown — Solid Zirconia

Need the historical teeth for those products.

Rule:
- if exactly one historical candidate owns tooth 13 → resolve Add Contact to that exact product
- if both/none match → keep review or use another approved deterministic rule

---

## 13. Current case-state summary

### Intentionally Can't Classify
- 377708 — Diagnostic Wax-Up
- 378842 — Diagnostic Wax-Up
- 378847 — Diagnostic Wax-Up
- 380316 — Diagnostic Wax-Up
- 385236 — Digital Design

### Resolved during manual review
- 374468 — Implant Custom Tissue Former
- 375256 — Implant Custom Tissue Former
- 374409 — Implant Layered Zirconia crown; wrong Fixed adjustment stand-in
- 385404 — nearest-prior Fixed/Implant crowns on 380860

### Needs active review
- 387583 — strong exact-teeth resolution candidate
- 390678 — likely wrong-department adjustment stand-in
- 380182 — possible one-to-many 1+4 mapping
- 383214 — possible one-to-many 1+2 mapping
- 393112 — mixed true-remake + adjustment
- 397050 — likely unique tooth-13 mapping if historical teeth confirm

---

## 14. Selective historical-case comparison cache — required architecture change

Explicit business requirement:

> The cache should verify whether the linked case exists in the cache. If it does not, selectively pull it for comparison purposes.

Required behavior:

1. Trace `remakeCaseID` to immediate previous/root cases as needed.
2. Check the primary Remake cache for the required historical case.
3. Also check a persistent historical comparison sidecar/cache.
4. If the case is in neither, selectively fetch **only that case** from Magic Touch / source API.
5. If that fetched case links farther backward and more history is required, repeat only for the required linked case(s).
6. Persist the retrieved comparison case so it is not repeatedly fetched on every load/build.
7. Historical comparison-only cases must **never** enter current dashboard totals, denominators, current case counts, current units, current revenue, current remake rates, etc.
8. They exist only to support historical attribution/comparison.

Minimum fields the sidecar should retain:
- case ID / case number
- `remakeCaseID` / chain link information
- date fields needed for audit
- product ID
- product description
- Product Group
- Department
- quantity
- teeth
- enough metadata to make deterministic historical comparisons

Do not solve old-case misses by indefinitely expanding the main dashboard population backward in time.

---

## 15. Future Ceramist / Technician support — required TODO

The historical comparison retrieval must later support Ceramist/Technician responsibility.

Design requirement:
- make the comparison-sidecar structure extensible so historical Ceramist/Technician fields can be retained for responsibility attribution later.
- do not redesign the current product work around Ceramist prematurely.
- do not build the sidecar in a way that prevents Ceramist/Tech enrichment later.
- comparison-only cases remain excluded from dashboard totals even after worker fields are added.

This TODO must be retained in project tracking.

---

## 16. Original live review population / diagnostic artifacts

Exact 2026 YTD population previously recovered from the active browser-ready Remake cache:

- Review - Ambiguous Root Product: 764 cases
- Review - Product Changed / No Exact Match: 27 cases
- Unresolved - Unconfirmed Root: 15 cases
- Total unique review cases: 806
- Remake Units: 1,340.43
- Remake Discount: $47,405.50
- Unsafe fallback: 0

Generated review artifacts included:
- `Remake_Attribution_Review_Cases_2026_YTD.xlsx`
- `Remake_Attribution_Review_Cases_2026_YTD.csv`
- `Ambiguous_Root_Remake_Product_Review.xlsx`
- `Ambiguous_Root_Remake_Product_List.csv`

These were diagnostic/review artifacts only; they did not change production.

### Important: old 406 / 79 / 19 diagnostic is not final

An earlier intermediate read-only diagnostic found:
- 504 ambiguous cases with at least one adjustment line
- 406 exactly-one-Crown-root candidates
- 79 multiple-Crown-root candidates
- 19 zero-Crown-root candidates
- 260 ambiguous cases without adjustment lines

Do not use those counts as final production counts. They predate the final Alloy exclusion and nearest-prior adjustment logic. Rerun the population under the current rules before publishing final counts.

---

## 17. Active browser-ready cache / current attribution implementation

Active browser-ready cache:
- Drive file ID: `1N5ojKr0So44MPtj3rp6BW4mjT-c6vwJr`
- file: `remake_factor_browser_cache.json.gz`
- approximately 121,246 rows at the activated build
- root attribution enabled
- unsafe fallback = 0

Current integration behavior remains the old safe policy:
- exact confirmed root Product ID → map
- otherwise explicit review/unresolved status
- never silently fall back to current remake product
- never silently use unsafe previous/root substitution

Known status codes include:
- `REVIEW_AMBIGUOUS_ROOT_PRODUCT`
- `REVIEW_NON_EXACT_SINGLE_ROOT`
- `UNRESOLVED_UNCONFIRMED_ROOT`

The business rules in this handoff define the **next** attribution layer; they have not yet been implemented in production source.

---

## 18. Future UI direction

Review/unresolved labels should not continue masquerading as actual Department/Product/Product Group values long term.

Preferred direction after attribution rules are approved:
- valid Department/Product/Product Group tables contain real dimensions
- add a separate Attribution Review / Can't Classify area
- review table can show:
  - current case
  - current flagged line
  - event type / adjustment type
  - current department
  - immediate previous case
  - root case
  - historical candidate products
  - mapping method/status
  - data-quality flag
  - units
  - remake discount

Do not implement this UI change without separate authorization.

---

## 19. True Remake vs Adjustment chain policy

Current direction:

```text
if Event Type = Adjustment:
    walk backward from immediate previous case
    choose nearest defensible underlying product
    stop once mapped
else if Event Type = True Remake:
    use approved root/original-product attribution rule
```

Do not apply a single root-only policy blindly to both event types.

---

## 20. Open one-to-many mapping question

When a single adjustment line covers multiple historical products, do not invent precision, but do not force ambiguity when deterministic evidence proves a one-to-many mapping.

Evidence hierarchy to evaluate:
1. exact teeth
2. exact Product ID
3. same Department + unique Product Group
4. quantity/unit reconciliation
5. other explicit case evidence

Key examples:
- 380182 — qty 5 vs historical 1 Layered Zirconia + 4 Solid Zirconia
- 383214 — qty 3 vs historical 1 Emax + 2 Solid Zirconia

---

## 21. Candidate future audit statuses

Potential status taxonomy:
- Resolved - Exact Product
- Resolved - Exact Teeth
- Resolved - Nearest Prior Product
- Resolved - Wrong Adjustment Department
- Resolved - One-to-Many Exact Teeth
- Resolved - Non-Crown Final Product
- Can't Classify - Diagnostic Wax-Up
- Can't Classify - Digital Design
- Review - Multiple Historical Products
- Review - Historical Case Missing / Pending Selective Pull
- Unresolved - Chain Not Confirmed

These are design candidates, not implemented schema.

---

## 22. Historical-case misses are not automatically permanent unresolved cases

If a linked previous/root case is missing from the primary browser cache:
- mark it as pending historical comparison retrieval
- selectively fetch the required case
- retain it in the comparison sidecar
- rerun attribution

Do not label it permanently unresolved merely because it is outside the current main-cache window.

---

## 23. August repair / historical backfill — do not rerun

August-only repair already completed successfully. Known result:
- August rows: 2,147 → 2,329
- 175 remake rows
- 138 exact
- 36 ambiguous
- 1 non-exact single root
- 0 unresolved
- 0 unsafe
- 172 / 600 API calls
- shard file ID preserved
- historical closed shards unchanged

Historical Jan 2025-Aug 2026 backfill also completed.

Do **not** rerun without fresh explicit authorization.

Dangerous / do-not-rerun operations include:
- `runRemakeFactorRootProductAttributionActivationStepV1350()` casually
- historical backfill
- generic month rebuild without explicit attribution handling
- temporary August repair runner again
- `refreshRemakeFactorRootActivationMonthV1350('2026-08', true)` again

Temporary runner:
- `RemakeFactorAugust2026RepairRunnerV1351.js`
- `runAugust2026RootAttributionRepairV1351()`
- already executed once
- do not execute again

---

## 24. API budget / runtime

Known:
- browser-ready rebuild uses 0 root-attribution Magic Touch API calls
- August repair used 172 / 600
- 600 calls was a one-time repair ceiling, not a desired recurring target
- source defaults were around 160 calls / 120,000 ms
- controlled activation helper used 600 calls / 180,000 ms

Do not increase caps casually.

Selective historical retrieval should be narrow and persist results so old cases are not refetched repeatedly.

---

## 25. Time-zone requirement

All human-facing and operational timestamps should use:

`America/Los_Angeles`

PST/PDT must change automatically. Raw UTC may remain internally where required, but user-facing/report/log output should be converted to California time.

---

## 26. Clipboard behavior for user-run diagnostics

Browser/PowerShell diagnostics that ask the user to paste results back should attempt to copy the final result to clipboard non-fatally.

Browser:

```js
try {
  if (typeof copy === 'function') {
    copy(final);
  } else {
    await navigator.clipboard.writeText(final);
  }
} catch (e) {
  console.warn('Clipboard copy failed; result is printed above.', e);
}
```

PowerShell:
- store final output in `$final`
- print it
- last command: `Set-Clipboard -Value $final`
- do not print anything after the clipboard command

---

## 27. Local / Apps Script environment

- Local repo: `C:\AppsScript\Overview Dashboard`
- Apps Script scriptId: `19ep_9Khzq86AIdumIxVN9BfM6rMwG0cHlPaUr46CZy_xJ1ve6_CcHhmo`
- clasp profile: `work`
- Git: `C:\Program Files\Git\cmd\git.exe`
- clasp: `C:\Users\user\AppData\Roaming\npm\clasp.cmd`
- shell: Windows PowerShell 5.1 / .NET Framework

PowerShell constraints:
- no `[System.IO.Path]::GetRelativePath()`
- AST parse nontrivial scripts first
- check PowerShell 5.1 compatibility
- avoid stderr/stdout merge for parsed Git lists
- beware `"$name:"`; use `$($name):`

---

## 28. Governance / safety boundary

The user has approved this **documentation update**, not implementation of the new attribution logic.

Before future governed source writes:
- read current destination/source first
- state the proposed change
- define verification
- preserve outgoing source
- obtain authorization for material behavior changes
- write
- read back / verify

Do not without explicit authorization:
- deploy production
- merge main
- run `clasp push`
- reset browser storage
- change triggers / Script Properties
- rerun historical backfill or August repair
- use destructive Git operations
- switch to a materially different implementation approach after a failure

---

## 29. Recommended continuation order

Do not restart from all 764 ambiguous cases.

Continue manual rule validation in this order:

1. **390678** — decide whether Implant Adjust Shade is a wrong stand-in for the Fixed Emax crown, analogous to 374409.
2. **387583** — review exact-teeth evidence and confirm resolution / wrong-department flag.
3. **397050** — find historical tooth 13 on case 391780; resolve if unique.
4. **383214** — determine whether qty 3 can split 1 Emax + 2 Solid Zirconia.
5. **380182** — determine whether qty 5 can split 1 Layered Zirconia + 4 Solid Zirconia.
6. **393112** — validate mixed event: Emax Veneer true remake + Adjust Crown attributed separately.

After those cases, decide whether the deterministic rules are strong enough to rerun the full ambiguous population.

---

## 30. Do not regress to these rejected assumptions

Do **not**:
- define Crown by the word `crown` in Product Description
- include any Alloy Department product in Crown
- treat Adjust Shade as a normal full-remake product
- treat Custom Shade as an Adjustment
- use case-level remake status on every product line
- force every Adjustment directly to terminal root
- assume Department mismatch is automatically unclassifiable
- assume underlying product must be Crown
- mark historical-cache misses permanently unresolved without selective retrieval
- add comparison-only historical cases to current totals/denominators
- rerun August repair/backfill
- implement the new logic without authorization

---

## 31. Preserve these principles

- Product-line remake flag remains authoritative.
- Event type and underlying product are separate concepts.
- Adjustment attribution prefers nearest prior defensible product.
- Exact teeth are high-value deterministic mapping evidence.
- Wrong adjustment Department may be a data-entry issue when historical evidence is clear.
- Underlying product may be a non-Crown final product.
- Crown classification = approved Product Groups, excluding all Alloy Department.
- No keyword-based Crown classifier.
- Missing historical cases should be selectively retrieved and cached in a comparison sidecar.
- Comparison sidecar must never change current event totals/denominators.
- Comparison sidecar should be extensible for future Ceramist/Technician fields.
- Diagnostic Wax-Up and Digital Design currently belong in deliberate Can't Classify states.
- No production implementation without explicit authorization.

---

## 32. One-sentence current status

The existing root-only policy safely exposed ambiguity; current work is proving a smarter deterministic attribution layer where adjustment stand-ins map to the nearest defensible historical product using chain position, Product Group/Department, exact teeth, quantity reconciliation, and explicit data-quality exceptions, while preserving product-line remake counting and current dashboard totals.
