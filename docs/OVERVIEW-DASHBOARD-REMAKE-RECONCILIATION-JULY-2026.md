# Executive Overview Dashboard - July 2026 Remake Reconciliation Guide

**Status:** Prepared for read-only audit  
**Audit period:** 2026-07-01 through 2026-07-31  
**Query:** `queries/REMAKE-RECONCILIATION-JULY-2026.sql`  
**Source:** `customerprofiles.retention_data.products_all`  
**Dashboard source:** MagicTouch CRM API cache  
**Purpose:** Reconcile the July 2026 Remake dashboard against an independent BigQuery calculation before approving or changing any formula.

## Why this is an independent reconciliation

The live dashboard reads a MagicTouch CRM API cache. The audit query reads BigQuery. A mismatch does not automatically mean the dashboard formula is wrong.

Possible causes include:

- Different refresh times.
- A July source month that was not fully refreshed in one system.
- Deleted-case handling available in the API but not represented in BigQuery.
- Product-line fields that differ between the API and nightly BigQuery load.
- Duplicate or missing source lines.
- A real classification, pooling, or denominator defect.

The audit rule is: **identify the row-level cause before changing any formula.**

## What the query reproduces

The query mirrors the current Remake implementation as closely as the BigQuery schema allows:

- Product line is the authoritative grain for remake status, remake units, reason, and Remake Discount.
- A case is a remake case when at least one included product line is a remake.
- Cases are deduplicated for case counts and case rate.
- Units and Remake Discount are summed from product lines.
- `Remake 0%` remains a remake.
- A zero-dollar remake line still contributes its quantity.
- Current explicit false remake values are `N`, `No`, `False`, `0`, `None`, and `Not a remake` after normalization.
- Every other nonblank remake value is classified as a remake, matching the current cache helper.

The query applies the current charge-side case exclusions:

- Missing or out-of-period invoice date is outside the query population.
- Estimate.
- Sent for Try In / Sent for Try-In.
- Adjustment.
- Debit memo.
- Finance charge.
- Populated credit/debit reason.

## Important audit key choice

The dashboard normally uses the API case ID, with case number as a fallback. The BigQuery table exposes case number and customer ID but not the API case ID.

For this audit, the distinct-case key is:

```text
Customers_CustomerID | Cases_CaseNumber
```

The query also reports whether the same case number appears under multiple customers. This is part of open item `U-01` in the metric source-of-truth document.

## Before running

1. Confirm the dashboard footer is still `v6.629` / `CUSTOMER-TECH-TABLE-UX-70`.
2. Do not click Refresh on the dashboard during the reconciliation.
3. Record the Remake cache timestamp shown in the footer.
4. Confirm the BigQuery `products_all` load includes all of July 2026.
5. Use the same dashboard filters for every value captured:
   - Year: 2026.
   - Month: July only.
   - Department: All.
   - Product: All.
   - Product Group: All.
   - Customer: All.
   - Reason: All.
   - No active chart/table cross-filter.

## Step 1 - Capture dashboard values

In the dashboard, capture exactly these July 2026 values:

| Metric | Dashboard value |
|---|---:|
| Total Cases | |
| Remake Cases | |
| Case Rate | |
| Total Units | |
| Remake Units | |
| Unit Rate | |
| Remake Discount | |
| Remake cache timestamp | |

Enter rates as displayed percentages. Example: record `3.3%` as `3.3`, not `0.033`.

Take one screenshot that shows:

- July-only selection.
- All top filters.
- KPI values.
- Footer/cache timestamp.

## Step 2 - Open the query

After synchronizing GitHub, open:

```text
queries/REMAKE-RECONCILIATION-JULY-2026.sql
```

Copy the full file into a new BigQuery query tab.

The query is read-only. It creates session-scoped temporary tables and issues only `SELECT` statements against the permanent source table.

## Step 3 - Enter dashboard values

At the top of the query, replace the seven `NULL` values:

```sql
DECLARE dashboard_total_cases FLOAT64 DEFAULT NULL;
DECLARE dashboard_remake_cases FLOAT64 DEFAULT NULL;
DECLARE dashboard_case_rate_pct FLOAT64 DEFAULT NULL;
DECLARE dashboard_total_units FLOAT64 DEFAULT NULL;
DECLARE dashboard_remake_units FLOAT64 DEFAULT NULL;
DECLARE dashboard_unit_rate_pct FLOAT64 DEFAULT NULL;
DECLARE dashboard_remake_discount FLOAT64 DEFAULT NULL;
```

Example format only:

```sql
DECLARE dashboard_total_cases FLOAT64 DEFAULT 1325;
DECLARE dashboard_remake_cases FLOAT64 DEFAULT 44;
DECLARE dashboard_case_rate_pct FLOAT64 DEFAULT 3.3;
```

Do not use the example values unless they are the July-only dashboard values you captured.

## Step 4 - Run the full script

Run the complete script as a multi-statement query.

Expected permanent-table side effects:

```text
None
```

If BigQuery asks for script execution permission, approve the multi-statement query. Do not change the destination table settings; no destination table is required.

## Step 5 - Save the result tabs

The script produces twelve result sets.

### Result 1 - Overall July metrics

This is the independent BigQuery calculation:

- Total Cases.
- Remake Cases.
- Case Rate.
- Total Units.
- Remake Units.
- Unit Rate.
- Remake Discount.

### Result 2 - Inclusion and exclusions

This shows distinct cases, lines, and units by exclusion reason.

Review whether exclusions are plausible and whether an unexpected category is large.

### Result 3 - Status distribution

This lists every status observed in July.

Use it to identify statuses that the current Remake implementation does not explicitly exclude. A status appearing here is not automatically wrong; it is a business review item.

### Result 4 - Remake source values

This lists every distinct `CaseProducts_Remake` value and how the current implementation classifies it.

Review any value other than the known true/false forms. The current code treats unknown nonblank text as a remake.

### Result 5 - Grouped rates and shares

This calculates Department, Product Group, Product, Customer, and Remake Reason metrics using one shared rule.

Important distinction:

- `case_rate_pct` answers how remake-heavy the group is.
- `remake_case_share_pct` answers how much of the total remake population the group contributes.

### Result 6 - Overlap counts

This shows how many cases contain multiple departments, product groups, products, or remake reasons.

This is the proof for why grouped distinct-case counts are not always additive.

### Result 7 - Representative overlap cases

Use at least one row from this result in the business explanation.

Confirm from its product lines that one case can legitimately count in more than one group while still counting once in company Total Cases.

### Result 8 - Case-number collision test

Expected ideal result:

```text
Zero rows
```

Any row means case number alone is not unique across customers for July and cannot safely be used as the only company-wide distinct-case key in BigQuery.

### Result 9 - Remake 0% examples

Select at least one example and verify:

- Product-line remake field is affirmative.
- It contributes to Remake Cases and Remake Units.
- Its discount can be zero.

### Result 10 - Zero-dollar remake examples

Select at least one example and verify that it contributes remake quantity despite zero charge/discount dollars.

### Result 11 - Potential duplicate signatures

This is a review list only. Identical rows can be legitimate, especially when teeth or other hidden identifiers differ.

Do not deduplicate source rows based solely on this result.

### Result 12 - Dashboard reconciliation

Every entered metric receives one status:

```text
MATCH
MISMATCH - RECONCILE ROWS BEFORE CHANGING FORMULAS
ENTER DASHBOARD VALUE AND RERUN
```

Save this result first.

## Step 6 - Export audit evidence

Export these result tabs as CSV:

1. Result 1 - overall metrics.
2. Result 2 - exclusions.
3. Result 4 - remake values.
4. Result 6 - overlap counts.
5. Result 7 - representative overlap cases.
6. Result 8 - case-number collisions.
7. Result 9 - Remake 0% examples.
8. Result 10 - zero-dollar remake examples.
9. Result 12 - reconciliation status.

Use filenames beginning with:

```text
2026-07-remake-reconciliation-
```

Do not commit exported customer-level CSVs to GitHub. They can contain customer and case information.

## Step 7 - Interpret matches

A full match means:

- The July dashboard total population reconciles to BigQuery within the query tolerances.
- Product-line remake classification and aggregation appear consistent for the audited month.
- The result is still a one-month validation, not proof that every historical month is correct.

A full match does not close the prior-year comparison item. That requires a separate current/prior cutoff audit.

## Step 8 - Reconcile mismatches

Use this order:

1. Compare cache timestamp to BigQuery load timestamp.
2. Compare Result 2 exclusions.
3. Review Result 3 unexpected statuses.
4. Review Result 4 unknown remake values.
5. Check Result 8 case-number collisions.
6. Check Result 11 possible duplicated lines.
7. Compare representative case/product rows between dashboard export/API data and BigQuery.
8. Only after identifying the difference, decide whether the source, cache builder, browser aggregation, or documentation must change.

Do not make the dashboard equal BigQuery by forcing a formula change without proving which source is authoritative for the difference.

## Reconciliation record

Complete this section after running the audit.

### Execution details

| Item | Value |
|---|---|
| BigQuery execution date/time | |
| BigQuery job ID | |
| Dashboard footer version/build | |
| Remake cache timestamp | |
| BigQuery latest July invoice/load date | |
| Auditor | |

### Overall comparison

| Metric | Dashboard | BigQuery | Difference | Status |
|---|---:|---:|---:|---|
| Total Cases | | | | |
| Remake Cases | | | | |
| Case Rate | | | | |
| Total Units | | | | |
| Remake Units | | | | |
| Unit Rate | | | | |
| Remake Discount | | | | |

### Required examples

| Check | Case/customer/product reference | Finding |
|---|---|---|
| Multi-group overlap | | |
| Remake 0% | | |
| Zero-dollar remake line | | |
| Unknown remake source value, if any | | |
| Case-number collision, if any | | |

### Final status

Choose one:

```text
RECONCILED - JULY 2026
PARTIALLY RECONCILED - OPEN DIFFERENCES LISTED
NOT RECONCILED - DO NOT APPROVE METRICS
```

### Open differences

Record each difference with:

- Metric.
- Dashboard value.
- BigQuery value.
- Exact row-level cause, if identified.
- Source judged authoritative.
- Required code/data/documentation action.
- Approval state.

## After the audit

Once the results are reviewed:

1. Update `OVERVIEW-DASHBOARD-METRIC-SOURCE-OF-TRUTH.md` with the audit outcome.
2. Close only open items proven by the evidence.
3. Preserve unresolved differences in the open-items register.
4. Do not change application code unless the reconciliation identifies a confirmed defect.
5. Start the TAT July 2026 reconciliation only after the Remake population and pooling rules are understood.
