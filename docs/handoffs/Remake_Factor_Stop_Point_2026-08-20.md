# Remake Factor — Stop Point — 2026-08-20

This is a continuation of `docs/handoffs/Remake_Factor_Super_Detailed_Handoff_2026-08-13.md`. It records the manual-review decisions and source verification completed after that handoff so the next session can resume without restarting discovery.

## Current status
No new production attribution logic has been authorized or deployed. The current work remains manual rule validation before any rerun of the full ambiguous population. The remaining cases should be reviewed in batches rather than one at a time.

## Completed manual decision — 390678
Live read-only MagicTouch SSMS confirmed the complete chain:

`390678 -> 387940 -> END`

There is no third/earlier linked case and no Implant crown anywhere in that linked chain.

Current case 390678:
- `SI35AS` — Implant - Adjust Shade — Department Implant — Group Service — qty 1 — remake flagged — reason Adjust Shade.
- `DMF2FA` — Fixed - Digital Model - Full Arch — Department Fixed — Group Printed Model — qty 1 — remake flagged — reason Adjust Shade.

Historical case 387940:
- `EMAXF1ACL` — Fixed - Emax - Anterior Crown, Layered — Department Fixed — Group Emax — qty 1.
- `DMF2FA` — Fixed - Digital Model - Full Arch — Department Fixed — Group Printed Model — qty 1.
- `RemakeCaseID` is null on 387940.

Manual business decision:
- Classification: `Unclassified`.
- Note: `Wrong department adjustment.`
- Preserve this exact user decision rather than auto-resolving it.

Review workbook native Google Sheet `13zTYzEolA5IbcM8MOmQIuCI7Au7wls8sbq9Qw5Ew2ms` was updated and verified:
- `All 806 Cases` row 564 -> `Unclassified`; note appended with `Wrong department adjustment.`
- `Ambiguous Root (764)` row 680 -> same decision/note.

Historical SSMS evidence job ID: `7c957ca7-5297-4813-9512-f5c80c505608`.

## Completed manual decision — 387583
Live read-only MagicTouch SSMS confirmed the complete chain:

`387583 -> 385067 -> END`

There is no additional linked case before 385067.

Current case 387583:
- `SF34AS` — Fixed - Adjust Shade — teeth `24,25` — qty 2 — remake flagged — reason Adjust Shade.
- `SI35AS` — Implant - Adjust Shade — teeth `23,26` — qty 2 — remake flagged — reason Adjust Shade.
- `ISSTM` — Implant - Soft Tissue Model — qty 1 — remake flagged — reason Adjust Shade.
- `IPDA` — Implant - Doctor's Analog — qty 2.

Historical case 385067:
- `LZI1AC` — Implant - Fuzion Layered Zirconia - Anterior Crown — teeth `23,26` — qty 2.
- `LZACP` — Implant - Fuzion Layered Zirconia - Anterior Crown - Pontic — teeth `24,25` — qty 2.
- `IPI3SA` — Implant - Straumann Abutment — qty 2.
- `DMI2FAM` — Implant - Digital Model - Full Arch — qty 1.
- `IPA` — Implant - Analog — qty 2.
- `SI1CS` — Implant - Custom Shade — qty 4.
- `SISR` — Implant - Screw Retained Implant Hybrid — qty 2.
- `RemakeCaseID` is null on 385067.

All teeth `23,24,25,26` belong to Implant Layered Zirconia work. The current Fixed Adjust Shade on teeth `24,25` is not associated to the correct historical product/department.

Manual business decision:
- Classification: `Unclassified`.
- Note: `Incorrect product for 2-unit adjustment; not associated correctly.`
- Preserve this exact user decision rather than auto-resolving the adjustment lines.

Review workbook native Google Sheet `13zTYzEolA5IbcM8MOmQIuCI7Au7wls8sbq9Qw5Ew2ms` was updated and verified:
- `All 806 Cases` row 457 -> `Unclassified`; note appended with `Incorrect product for 2-unit adjustment; not associated correctly.`
- `Ambiguous Root (764)` row 391 -> same decision/note.

Historical SSMS evidence job ID: `5d8e2f6c-1b7a-4e9f-9c32-6b8a0d3f7251`.

## New mapping evidence rule — historical tooth match
Historical tooth number is now a primary mapping signal for adjustment attribution.

For an adjustment/remake line:
1. Start with the immediate prior linked case.
2. Compare the current adjustment tooth number(s) with historical product-line tooth number(s).
3. If exactly one qualifying historical product owns the same tooth/set, treat that as strong direct evidence for attribution.
4. If current teeth deterministically span multiple historical products, a one-to-many split may be considered when exact tooth sets identify each product and quantities reconcile.
5. If two historical products claim the same tooth, or tooth data is missing/contradictory, move to other approved evidence or remain Unclassified/Review.

Current evidence priority:
1. Exact historical tooth match.
2. Exact Product ID / explicit product evidence.
3. Same Department + unique Product Group where defensible.
4. Quantity reconciliation.
5. Other deterministic evidence.

Do not use quantity alone to invent a one-to-many split when exact tooth data can be retrieved.

## Remaining four-case batch
Resume with one source pull for these four cases rather than separate discovery.

### 397050
Current:
- Implant - Add Contact (`SI39AC`).
- Tooth `13`, qty 1, reason Add Mesial Contact.
- Support line in review row includes Implant - Digital Model - Quadrant (`DMI1QM`).
- Review workbook shows 2 remake units and $28 remake discount across 2 source lines.

Cached linked/root case: `391780`.

Historical qualifying candidates:
- `LZI5PC` — Implant - Fuzion Layered Zirconia - Posterior Crown — Layered Zirconia.
- `ZIRPRIPC` — Implant - Zirfit Prime - Posterior Crown — Solid Zirconia.

Next check:
- Retrieve historical tooth numbers on both crown lines.
- If exactly one owns tooth `13`, map Add Contact to that product.
- If both/none own tooth 13, keep Review/Unclassified unless another approved rule resolves it.
- Verify the complete chain; cached data records 391780 as immediate previous/root but it has not received the same live end-of-chain verification as 390678 and 387583.

### 383214
Current:
- `SF33AC` — Fixed - Adjust Crown.
- Qty 3.
- Reason: Adjust Porcelain.

Cached linked/root case: `381267`.

Historical candidates:
- `EMAXF4PCS` — Fixed - Emax - Posterior Crown, Stained — Emax — qty 1.
- `ZIRPRF11PC` — Fixed - Zirfit Prime - Posterior Crown — Solid Zirconia — qty 2.
- `SMF` — Fixed - Stone Model.

Next check:
- Quantity reconciles: `3 = 1 Emax + 2 Solid Zirconia`.
- Retrieve current/historical teeth and complete chain.
- If exact teeth prove the 1+2 allocation, treat it as a defensible one-to-many adjustment mapping; do not rely on quantity alone.

### 380182
Current:
- `SF34AS` — Fixed - Adjust Shade.
- Qty 5.

Cached linked/root case: `371041`.

Historical candidates:
- `LZF2AB` — Fixed - Fuzion Layered Zirconia - Anterior Bridge — Layered Zirconia — qty 1.
- `ZIRF13W` — Fixed - Zirfit - Wing — Solid Zirconia — qty 4.
- `SF1CS` — Fixed - Custom Shade — Service.
- `SMF` — Fixed - Stone Model.

Classifier reminder:
- Layered Zirconia and Solid Zirconia are Crown groups under the approved Product Group + Department rule; Bridge/Wing wording does not disqualify them.

Next check:
- Quantity reconciles: `5 = 1 Layered Zirconia + 4 Solid Zirconia`.
- Retrieve current/historical teeth and complete chain.
- If exact teeth prove the 1+4 allocation, treat it as a defensible one-to-many adjustment mapping; do not rely on quantity alone.

### 393112
Mixed-event case.

Current evidence:
- Fixed - Adjust Crown (`SF33AC`) — ambiguous adjustment line in review workbook.
- Fixed - Emax - Veneer (`EMAXF7V`) — real product line, not an adjustment stand-in.
- Observed reason: Add porcelain.

Cached linked/root case: `391171`.

Historical products:
- `EMAXF7V` — Fixed - Emax - Veneer — Emax.
- `LZF5PC` — Fixed - Fuzion Layered Zirconia - Posterior Crown — Layered Zirconia.
- `RF600711` — Fixed - Reconstruction - 7-11 Units Single Arch — Reconstruction.
- `SMF` — Fixed - Stone Model.

Likely interpretation to verify:
1. Current Emax Veneer -> historical Emax Veneer = true-remake line.
2. Current Adjust Crown -> historical Layered Zirconia Posterior Crown = Adjustment line.
3. If supported, headline case remains Remake Case because a real product line is flagged; line-level adjustment is tracked separately.

Next check:
- Retrieve full current/historical line details, exact teeth, and complete chain before confirming the adjustment mapping.

## Next source action when work resumes
Run one read-only MagicTouch batch query for:

`397050, 383214, 380182, 393112`

Return the complete `RemakeCaseID` chain and product lines for every chain level, including at minimum:
- ChainDepth.
- CaseNumber / CaseID / next linked case ID.
- ProductID.
- Department.
- Product Group.
- Product Description.
- TeethNumbers.
- Quantity.
- Product-line remake flag.
- RemakeReason.
- IsImplant when useful.

Use the current approved MagicTouch AI Ad Hoc Runner workflow. Do not repeat the earlier direct `_MagicTouchQueryJobs` insertion method used for the two historical verification jobs. The current governed submission path is Runner/GitHub RequestID dispatch, with the durable queue used as audit/result evidence.

For generic one-off analysis, current default result destination is `MagicTouch Quick Queries` (`1p2Smx1kSlL6-6rQiIhnaEQjIV6maHH2FOos_PEAaa54`), tab `Latest Result`, unless the live runbook or user selects another destination.

Explicit run/execute authorization is still required at execution time.

## Review workbook references
Active editable native Google Sheet copy used for manual decisions:
- Spreadsheet ID `13zTYzEolA5IbcM8MOmQIuCI7Au7wls8sbq9Qw5Ew2ms`.
- Tabs include Summary, All 806 Cases, Ambiguous Root (764), Product Changed (27), Unconfirmed Root (15).

Original Office workbook:
- `Remake_Attribution_Review_Cases_2026_YTD.xlsx` — Drive ID `1IbB8pNmX62ci_liRs7nWiQRg8hFqENWF`.

## Safety / do not do
- Do not implement new attribution logic in production from these manual decisions alone.
- Do not rerun August repair or historical backfill.
- Do not rerun the full ambiguous population yet.
- Do not deploy production, run `clasp push`, merge to main, change triggers/Script Properties, or reset browser storage from this handoff.
- Keep product-line remake flag authoritative.
- Keep Adjust / Add Contact classified as Adjustment; Custom Shade remains a real service/product.
- Use nearest-prior logic for adjustments.
- Use Product Group + Department for Crown classification; never description keywords.
- Preserve the user-selected Unclassified decisions for 390678 and 387583.

## Resume point
Completed in this manual review pass:
- `390678` — Unclassified — Wrong department adjustment.
- `387583` — Unclassified — Incorrect product for 2-unit adjustment; not associated correctly.

Resume with one batch source pull for:
- `397050`
- `383214`
- `380182`
- `393112`

Primary new test: use exact historical tooth numbers to identify the correct underlying product(s) before falling back to quantity-only evidence.

This file is documentation-only and does not change dashboard logic, Apps Script runtime behavior, cache logic, triggers, Script Properties, or production deployment.