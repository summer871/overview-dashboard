# Executive Overview Dashboard - July 2026 Remake Reconciliation Guide

**Status:** Prepared for read-only audit  
**Audit period:** 2026-07-01 through 2026-07-31  
**Query:** `queries/REMAKE-RECONCILIATION-JULY-2026.sql`  
**Output contract:** One final BigQuery result table  
**Source:** `customerprofiles.retention_data.products_all`  
**Dashboard source:** MagicTouch CRM API cache

## Purpose

Reconcile the July 2026 Remake dashboard against an independent BigQuery calculation without requiring multiple BigQuery result tabs.

The query creates temporary tables for its calculations, but it emits exactly one final result table. Use the `section` column to move through the audit checks.

## Verified dashboard baseline

The query already contains the July 2026 values captured from `/dev`:

| Metric | Dashboard value |
|---|---:|
| Total Cases | 2,494 |
| Remake Cases | 195 |
| Case Rate | 7.8% |
| Total Units | 8,290.3 |
| Remake Units | 500.1 |
| Unit Rate | 6.0% |
| Remake Discount | $56,662 |
| Remake cache timestamp | Aug 5, 2026, 5:45 AM PDT |
| Footer version/build | v6.629 / CUSTOMER-TECH-TABLE-UX-70 |

The July selection included both comparison months (`Jul 25`, `Jul 26`), while the large KPI values represented July 2026 and the small comparison values represented July 2025.

## Why BigQuery may differ

The live dashboard reads a MagicTouch CRM API cache. This audit reads BigQuery. A mismatch does not automatically prove that the dashboard formula is wrong.

Possible causes include:

- Different source refresh times.
- Deleted-case handling available in the API but not represented in BigQuery.
- Product-line fields that differ between the API and the BigQuery load.
- Duplicate or missing product lines.
- A real classification, pooling, or denominator defect.

The controlling rule is: identify the row-level cause before changing a formula.

## How to run

1. Open `queries/REMAKE-RECONCILIATION-JULY-2026.sql`.
2. Copy the complete file into a new BigQuery query tab.
3. Run the entire script. Do not highlight only part of it.
4. No destination table is required.
5. The script is read-only against permanent data and creates only session-scoped temporary tables.
6. Wait for the final result grid.

BigQuery will show multiple statements as processed because the script creates temporary tables. That is expected. There should be only one final result grid to review.

## Final result columns

- `section_order`, `section`, and `row_order` organize the output.
- `item` names the metric, check, group, or example.
- `dashboard_value`, `bigquery_value`, `difference`, `unit`, and `status` are used for KPI reconciliation.
- `details` contains section-specific values and row-level evidence as JSON.

## Sections

### 01 Reconciliation

Seven rows compare the July dashboard KPIs to BigQuery:

- Total Cases.
- Remake Cases.
- Case Rate.
- Total Units.
- Remake Units.
- Unit Rate.
- Remake Discount.

Status values:

```text
MATCH
MISMATCH - RECONCILE ROWS BEFORE CHANGING FORMULAS
ENTER DASHBOARD VALUE
```

The rate and displayed-decimal metrics use tolerances that allow for dashboard rounding.

### 02 Population exclusions

Shows distinct cases, product lines, and units for:

- Included.
- Estimate.
- Sent for Try In.
- Adjustment.
- Debit memo.
- Finance charge.
- Populated credit/debit reason.
- Missing case-number audit key, if present.

### 03 Status distribution

Lists every normalized July case status and identifies whether it appears in the included population.

### 04 Remake classification values

Lists every distinct `CaseProducts_Remake` value and shows how the current implementation classifies it.

The current false list is:

```text
blank
N
No
False
0
None
Not a remake
```

Every other nonblank value is classified as a remake under the current cache helper.

### 05 Grouped metrics

Contains Department, Product Group, Product, Customer, and Remake Reason rows.

- `case_rate_pct` asks how remake-heavy the group is.
- `case_share_pct` asks how much of all selected remake cases the group contributes.
- `unit_rate_pct` asks how remake-heavy the group's units are.
- `unit_share_pct` asks how much of all selected remake units the group contributes.

Grouped case counts can overlap when one case contains more than one group value.

### 06 Overlap summary

Counts cases that contain multiple departments, product groups, products, or remake reasons.

### 07 Representative overlap cases

Provides up to 100 case examples with the department, product-group, product, and remake-reason arrays inside `details`.

### 08 Case-number collision check

The ideal result is no rows in this section.

Any row means case number alone is not unique across customers for July. The audit query therefore uses `Customers_CustomerID | Cases_CaseNumber` as its BigQuery case key.

### 09 Remake 0 percent examples

Provides up to 100 examples where the product line remains a remake even though the percentage or discount rate is zero.

### 10 Zero-dollar remake lines

Provides up to 100 remake product lines with zero product charge and zero remake discount. These still contribute remake quantity under the approved product-line rule.

### 11 Duplicate-signature review

Provides up to 200 repeated product-line signatures. These are review rows only and are not proof that the source should be deduplicated.

## What to send for review

A single CSV export of the final result table is sufficient.

Do not commit that CSV to GitHub because row-level sections can contain customer and case information.

At minimum, send screenshots or filtered CSV rows for:

- Section 01.
- Section 02.
- Section 04.
- Section 06.
- Section 08.
- Sections 09 and 10 if examples exist.

## Decision rule

Do not change dashboard code merely to force a BigQuery match.

For every mismatch, determine whether the cause is:

- Refresh timing.
- Source-system difference.
- Exclusion mismatch.
- Case-key mismatch.
- Product-line remake classification.
- Duplicate or missing source lines.
- Dashboard aggregation defect.
- BigQuery audit-query defect.

Only a proven defect authorizes a formula or source change.
