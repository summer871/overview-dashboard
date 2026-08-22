# Executive Overview Dashboard - Metric Source of Truth and Audit Register

**Document type:** Living source of truth and audit register  
**Last source audit:** 2026-08-05  
**Verified code baseline:** `72813030bf0c2539a4ebadb8d4c75abacd98eef8` (`v6.629 simplify customer technician and column sizing UX`)  
**Runtime state:** Source pushed to Apps Script `/dev`; business acceptance and metric validation remain pending  
**Business approval:** Not yet complete  
**Companion specification:** `OVERVIEW-DASHBOARD-SHARED-FILTER-HEADER-SPEC.md`

## Purpose

This document is the durable reference for how the Remake and Turnaround Time dashboards currently source, pool, filter, calculate, compare, and display their metrics.

It has two jobs:

1. Explain the current implementation precisely enough that the calculations can be maintained, tested, and explained to an analytical business audience.
2. Keep unresolved business or technical questions visible instead of silently converting assumptions into approved definitions.

This document intentionally distinguishes:

- **Canonical rule** - an approved reporting or data rule from the current ClickUp runbooks.
- **Current implementation** - behavior confirmed in the code at the verified commit.
- **Open validation item** - behavior that still needs a data reconciliation, business decision, or source correction.

A metric is not considered business-approved merely because the code runs or the number renders.

## Source precedence

When sources conflict, use this order and record the conflict:

1. Explicit business definition approved by Summer.
2. Current ClickUp data/reporting runbook.
3. Current server-side cache builder.
4. Current browser-side aggregator and filter logic.
5. Visible label or tooltip.

A label never overrides the implemented numerator, denominator, grain, or inclusion rule.

## Current source map

| Area | Current source | Current grain | Primary implementation |
|---|---|---|---|
| Remake population | MagicTouch CRM API | Case-product line | `RemakeFactorCache.js` |
| Remake browser calculations | Browser-ready Remake cache | Case-product line, then distinct-case aggregation where required | `DashboardMainScript.html` |
| TAT population | MagicTouch CRM API monthly cache shards | Case-product line with case-level TAT fields repeated on each product line | `TatDashboardCache.js` |
| TAT browser calculations | Browser-ready TAT cache | Product-line rows, deduplicated to cases for case metrics | `TatDashboardControllerScript.html` |
| Technician responsibility | Durable Remake population plus Ceramist attribution sidecar | Remake product line with case-level responsibility | `CaeramistRemakeProfiler.js`, `CeramistIncrementalUpdater.js`, `DashboardMainScript.html` |
| Canonical net sales reference | BigQuery reporting runbook | Product line | `customerprofiles.retention_data.products_all` using `CaseProducts_TotalCharge` and canonical exclusions |

## Universal pooling rules

### Product rows and case rows are not interchangeable

Both active dashboards receive product-line fact rows. One case can therefore appear multiple times.

- **Units and product-line amounts** are additive at the product-line grain.
- **Cases** must be deduplicated before counting.
- **Case-level TAT values** must be read once per distinct case, not once per product line.
- A case can belong to more than one department, product, group, reason, or technician-related detail set.

### Group totals can overlap

A case with products in two departments can count once in each department's distinct-case total. Therefore:

- The sum of department case counts can exceed the company distinct-case count.
- The sum of product case counts can exceed the company distinct-case count.
- The same warning applies to any grouping where a case can contain multiple values.
- Unit totals remain additive when each underlying product line appears once.

The dashboard must not describe overlapping grouped case totals as partitions of the company case total unless the grouping rule explicitly assigns each case to one exclusive category.

### Current case identity

- Remake rows use the cached API `caseId` when available, with case number as a fallback.
- TAT browser aggregation uses `row.caseId || row.caseNumber`.
- Technician reconciliation uses the durable Remake population and the CRM remake-chain identifiers needed for prior/root-case attribution.

**Open validation item:** Confirm with representative source data that the cached `caseId` is globally stable across all included customers and years. If any environment supplies only a non-global case number, the fallback key must be strengthened before relying on it for company-wide distinct-case counts.

## Remake dashboard

### Population inclusion

#### Current implementation

A case is included in the Remake denominator only when it passes the charge-side production-case filter in `RemakeFactorCache.js`.

The cache requires a valid invoice date and excludes:

- Deleted cases.
- `Estimate` status.
- `Sent for Try In` / `Sent for Try-In` status.
- Adjustments.
- Debit memos.
- Finance charges.
- Rows/cases with a populated credit/debit reason.

The case query is date-bounded and the cache is refreshed in monthly/open-month slices.

#### Canonical reporting relationship

The current BigQuery runbook uses the same core exclusions for canonical net sales: estimate, adjustment, debit memo, and finance charge. It separately treats populated credit/debit-reason rows as credits rather than charges.

The Remake dashboard is not a net-sales report. Its inclusion rule is similar to the charge-side production population, but its visible `Remake Discount` metric is not canonical net sales.

### Remake classification

#### Approved and implemented rule

The product line is authoritative.

- A product line is a remake when that product line's remake field identifies it as a remake.
- A `Remake 0%` product line is still a remake.
- A zero-dollar service or stand-in line can still be a remake and contribute units.
- `remakeCaseID` does not determine whether a product line or case is a remake.
- `remakeCaseID` is used separately for tracing the original/root case in technician responsibility.

A case is a remake case when at least one included product line on that case is a remake. The case is counted once in the remake-case numerator.

### Remake metric definitions

| Visible concept | Grain | Numerator | Denominator | Current interpretation |
|---|---|---|---|---|
| Total Cases | Distinct case | Count of distinct included case IDs | None | Included production cases after current filters |
| Remake Cases | Distinct case | Distinct included cases with at least one remake product line | None | Each case counts once regardless of remake-line count |
| Case Rate | Distinct case | Remake Cases | Total Cases | Probability that an included case contains at least one remake line |
| Total Units / Sold Units | Product line | Sum of included line quantity | None | Quantity across all included product lines |
| Remake Units | Product line | Sum of quantity on remake product lines | None | Quantity from remake lines only |
| Unit Rate | Product line | Remake Units | Total Units | Share of included units that are remake units |
| Remake Discount | Product line | Sum of the recorded line-level `remakeDiscount`, displayed as a positive amount | None | Estimated revenue waived on remake product lines; not a case-level allocation and not canonical net sales |

### Rate versus share

The dashboard contains both **rates** and **shares**. They answer different questions.

#### Rate within a group

- **Case Rate** = the group's remake cases / the group's total cases.
- **Unit Rate** = the group's remake units / the group's total units.

These answer: "How remake-heavy is this group?"

#### Share of selected remake responsibility

Where responsibility/share columns are displayed:

- **Case Share** = the group's remake cases / all remake cases in the current selected denominator.
- **Unit Share** = the group's remake units / all remake units in the current selected denominator.
- **Discount Share** = the group's remake discount / all remake discount in the current selected denominator.

These answer: "How much of the selected remake population came from this group?"

A high share does not necessarily mean a high rate. A large department can contribute many remakes while still having a lower internal remake rate.

### Remake grouping behavior

The browser groups the already-filtered product-line rows, then recalculates each group's distinct cases, remake cases, units, remake units, discount, case rate, and unit rate.

- Department, product, product group, customer, reason, and technician views are calculated from the current filtered row population.
- Distinct cases are deduplicated within each group.
- A multi-product case may appear in multiple grouped case totals.
- Product-line units and discounts follow the product line into its group.

### Remake filter inventory at the audited commit

The active Remake filter metadata contains:

- Year.
- Department.
- Product.
- Product group.
- Customer.
- Reason.

The current saved-view helper captures year, department, product, customer, and reason, but omits product group.

**Open validation item / current defect:** A saved Remake filter preset is not a complete snapshot while product group is omitted. The shared-header implementation must capture every filter capability enabled for the page.

### Remake prior-year comparison

The Remake page can expose prior-year comparison columns on configured tables.

**Open validation items:**

- Reconcile current-year and prior-year date cutoffs against source cases for a representative month and YTD selection.
- Confirm that every prior-year table uses the same filter and cutoff contract as the current-year table.
- Confirm whether saved column widths intentionally persist separately when comparison columns are enabled.

### Remake discount wording guardrail

Use this explanation:

> Remake Discount is the sum of the recorded product-line remake discount for included remake lines. It estimates revenue waived because of remake handling. It is not a reconstructed case total, an allocation of case revenue, or canonical net sales.

Do not explain Remake Discount as `Cases_TotalCharge`, billed revenue, or net sales.

## Turnaround Time dashboard

### Population inclusion

#### Current implementation

The TAT cache starts from invoice-dated API cases and applies the same cutoff month/day across the years retained in the cache.

It excludes:

- Deleted cases.
- `Estimate` status.
- `BF Invoice` status.
- `Sent for Tryin`, `Sent for Try In`, or `Sent for Try-In` status.
- Adjustments.
- Debit memos.
- Finance charges.
- Rows/cases with a populated credit/debit reason.

The cache currently retains a rolling multi-year source population, while the browser controller's year options are hardcoded to 2025 and 2026.

**Open validation item / current defect:** Replace hardcoded browser years with configured/available years when the shared filter platform is implemented.

### TAT fact-row construction

The TAT cache creates one fact row per product line. Each row carries:

- Case identity and invoice date.
- Customer identity.
- Department, product group, category, type, product, and product ID.
- Sold units and remake units for that product line.
- Case-level TAT eligibility and case-level TAT values repeated on the product lines.
- Due-date and on-time-to-promise fields.
- Hold-history quality fields.
- Remake reason for remake product lines; `Not a remake` otherwise.

The browser must aggregate those rows to distinct cases before calculating case-based TAT metrics.

### TAT date rules

#### Completion date

- Use Shipment Date when present.
- Otherwise use Invoice Date.
- Each row records whether the invoice-date fallback was used.

**Open metadata defect:** The cache configuration currently records `shipDateFallbackUsed: false` even though individual rows can and do record `usedInvoiceDateFallback: true`. The row behavior is authoritative; the metadata label should be corrected or removed.

#### Eligibility

A case is TAT eligible when:

- Date In exists.
- Completion Date exists.
- Completion Date is not before Date In.

A missing due date does not make the case ineligible for Average TAT. It makes the case ineligible for On Time to Promise.

#### Business-day count

- Date In is day zero.
- Counting begins on the following calendar day.
- Weekends are excluded.
- Configured holidays are excluded.
- The end date is included when it is a business day.
- Raw Business TAT = business days from Date In to Completion Date.
- Business TAT = max(0, Raw Business TAT - matched hold business days).

#### Holds

- Hold events are taken from case history between Date In and Completion Date.
- A matched hold start/end pair contributes business days to the hold deduction.
- A hold start without a matching end is flagged as `Missing hold end` and is not silently extended to the completion date.

#### Days late

- A case is on time when Completion Date is on or before Due Date.
- Late days are business days from Due Date to Completion Date.
- Weekends and configured holidays are excluded.
- The current implementation does not subtract hold days from Days Late.

**Open business validation item:** Confirm whether promise lateness should remain independent of hold deductions or should use an adjusted promise date.

### TAT case aggregation

The browser `aggregateCases()` function deduplicates product-line rows by `caseId || caseNumber` and then:

- Sums sold units across the case's product lines.
- Sums remake units across the case's product lines.
- Retains one case-level TAT value.
- Builds sets of the case's departments, products, groups, and reasons.
- Carries case-level quality flags.

All case-based TAT metrics use this distinct-case array.

### TAT metric definitions

| Visible concept | Grain | Numerator / values | Denominator | Current interpretation |
|---|---|---|---|---|
| Cases | Distinct case | Count of distinct included cases | None | Included cases after active filters |
| Sold Units | Product line | Sum of line sold units | None | Included product-line quantity |
| Remake Units | Product line | Sum of line remake units | None | Remake product-line quantity inside the TAT population |
| Remake % | Product line | Remake Units | Sold Units | Unit remake rate, not remake-case rate |
| TAT Eligible Cases | Distinct case | Cases with valid Date In and Completion Date | None | Cases usable for Average/Median TAT |
| Coverage | Distinct case | TAT Eligible Cases | Included Cases | Share of included cases usable for TAT calculations |
| Average TAT | Distinct eligible case | Arithmetic mean of Business TAT Days | Eligible Cases | Each eligible case has equal weight; not unit-weighted |
| Median TAT | Distinct eligible case | Median of Business TAT Days | Eligible Cases | Each eligible case has equal weight |
| On Time to Promise | Distinct due-date-eligible case | Cases completed on/before Due Date | TAT-eligible cases with a Due Date | Cases without a Due Date are excluded from this denominator |
| Average Days Late | Distinct late case | Arithmetic mean of Days Late | Late cases only | On-time cases are not included as zeroes |
| 31+ Cases | Distinct eligible case | Eligible cases with rounded Business TAT >= 31 | None | Count used in distribution/detail outputs |

### TAT grouping behavior

Department, product, product group, and customer summaries call the same metrics function on each group's rows.

- Cases are distinct within a group.
- Average TAT, median TAT, OTP, average days late, and coverage are case-based within the group.
- Units and remake units remain product-line sums.
- A case with multiple departments/products can appear in multiple group case totals.

### TAT filters and cross-filters at the audited commit

The current controller defines:

- Year.
- Department.
- Product.
- Product group.
- Customer.
- Reason.

It also applies cross-filters from selected months, TAT buckets, promise-performance bands, and data-quality issues.

All active top filters and cross-filters are applied before the metrics function runs.

#### Product-group source

The TAT controller currently attempts to resolve product groups from the normalized Remake rows, then falls back to the TAT row's existing group, then `Unassigned`.

**Open validation item / architecture concern:** Product-group classification should come from one authoritative shared product dimension rather than a browser-time dependency on the Remake page's loaded state.

#### Remake reason on TAT

The current controller includes a reason filter because each TAT product row carries `remakeReason`, including `Not a remake`.

**Target decision from Summer:** The shared header should not enable Remake Reason on TAT. The option is meaningful for Remake analysis but is not approved as a TAT header filter. This is a page capability decision, not a reason to fork the header implementation.

### TAT prior-year comparison

The cache enforces a same month/day cutoff across retained years. At the audited commit, the browser compares 2026 to 2025 and treats the selected/latest reporting year as current.

**Open validation items:**

- Replace hardcoded years with available/configured years.
- Reconcile a monthly and YTD sample to confirm the current and prior populations use the same filter/cross-filter rules.
- Confirm how a custom year selection containing more than one year should be represented; the current controller takes the maximum selected year as the reporting year.

## Technician / responsible-worker analysis

### Population source

The technician area does not create a separate remake definition. Its population is reconciled to the durable Remake Factor remake product-line population.

The Ceramist sidecar enriches that population with case-level responsibility and worker display metadata.

### Confirmed attribution rule

- Eligible task code is exactly `CERAMICS` after normalization.
- Task sequence is diagnostic metadata and does not determine eligibility.
- The worker is sourced from `CaseTasks_CompletedBy` and mapped to the worker display directory.
- Responsibility is resolved at the prior/root case level, not by requiring the new remake product to match the prior product.
- One distinct completed Ceramist worker resolves responsibility.
- Multiple distinct completed Ceramist workers remain unattributed/review.
- The root worker is the default.
- In a multi-chain remake, use the immediately previous worker when that single worker differs from the root worker.
- When the root has no completed Ceramist worker but the previous case has one, use the previous worker and retain the root-missing flag.

### Attribution completeness

The sidecar tracks attributed and unattributed rows and explicitly classifies conditions such as:

- Unlinked case.
- Multiple case-level workers.
- No case-level Ceramist worker.
- Population-chain pending/error.

Unattributed rows remain part of the remake population. They must not disappear from the denominator merely because responsibility could not be resolved.

### Technician metrics

- Technician remake cases are distinct remake cases assigned to that worker/group.
- Technician remake units are the remake product-line units assigned to that worker/group.
- Technician remake discount is the product-line remake discount assigned to that worker/group.
- Unit Share is the technician's remake units divided by the selected technician-population remake units.
- Responsibility totals should reconcile to attributed plus unattributed population totals.

**Open validation items:**

- Reconcile the current worker table to the full Remake population for at least one month.
- Confirm whether every product line on one remake case inherits the same case-level responsible worker.
- Confirm that case counts remain distinct when a sidecar contains more than one product row for the case.
- Confirm how non-Ceramist worker categories are intentionally displayed or excluded.

### Current BigQuery dependency to review

The Ceramist profiler currently references `customerprofiles.retention_data.tasks_all` and `products_all`. The current ClickUp BigQuery runbook identifies the canonical reporting source and rules separately.

Do not silently repoint this workflow. First verify that the required task-sequence, completed-by, product, and remake-chain fields exist and reconcile in the proposed canonical source.

## Filters and denominator behavior

The correct explanation for any dashboard number must identify the selected population first.

1. Start with the page's included source population.
2. Apply the page's enabled top filters.
3. Apply active chart/table cross-filters.
4. Deduplicate to cases only for case-grain metrics.
5. Sum product lines only for additive units/amounts.
6. Calculate the numerator and denominator from that same filtered population unless a metric explicitly documents a broader denominator.

Resetting one state category must not silently reset another:

- Filter state.
- Cross-filter state.
- Saved filter presets.
- Card layout.
- Table widths/visibility/sort.
- KPI visibility.
- Chart mode.
- Cache/data state.

## Plain-language metric glossary

### Remake Case Rate

> Of the included production cases, what percentage had at least one remake product line? Each case counts once.

### Remake Unit Rate

> Of the included product units, what percentage came from remake product lines?

### Remake Case Share

> Of all remake cases in the current selected population, what percentage belongs to this department, product, customer, reason, or worker group?

### Remake Discount

> The recorded product-line remake discount on included remake lines, added together as a positive waived-revenue amount.

### Average TAT

> The average hold-adjusted business-day turnaround across distinct eligible cases. Each case has equal weight.

### On Time to Promise

> Of TAT-eligible cases with a due date, the percentage completed on or before that due date.

### Average Days Late

> Among cases that were late, the average number of business days after the due date. On-time cases are not averaged as zero.

### TAT Coverage

> The percentage of included cases with enough valid date information to calculate turnaround time.

## Required reconciliation tests before business approval

### Remake

- Select one closed month and reconcile included distinct cases to source.
- Reconcile remake cases by identifying at least one remake product line per case.
- Reconcile total units and remake units from product lines.
- Reconcile Remake Discount to recorded line values, including a 0% remake and a zero-dollar line.
- Reconcile one multi-product/multi-department case to prove grouped case overlap.
- Reconcile one current/prior comparison with the exact same filters and cutoff.

### TAT

- Reconcile included cases after every exclusion.
- Reconcile Date In day-zero behavior.
- Reconcile a weekend and holiday crossing.
- Reconcile a matched hold interval.
- Reconcile a missing-hold-end case.
- Reconcile shipment-date completion and invoice-date fallback.
- Reconcile OTP with and without a due date.
- Reconcile Average Days Late using late cases only.
- Reconcile one multi-department case to prove grouped case overlap.
- Reconcile the same month/day cutoff across current and prior years.

### Technician responsibility

- Reconcile one single-worker root case.
- Reconcile one previous-case override in a multi-chain remake.
- Reconcile one root-missing/previous-worker case.
- Reconcile one multiple-worker review case.
- Reconcile attributed plus unattributed totals to the full Remake population.

## Known open items register

| ID | Area | Open item | Required disposition |
|---|---|---|---|
| M-01 | Remake | Saved filter preset omits Product Group | Fix in shared header/preset platform |
| M-02 | Remake | Prior-year cutoff and filter parity need data reconciliation | Validate with monthly and YTD samples |
| T-01 | TAT | Browser years are hardcoded to 2025/2026 | Derive from available/configured years |
| T-02 | TAT | Product group can depend on loaded Remake browser state | Move to authoritative shared product dimension |
| T-03 | TAT | Cache metadata says shipment fallback is unused while rows can use it | Correct metadata contract |
| T-04 | TAT | Hold adjustment is not applied to Days Late | Confirm business intent |
| T-05 | TAT | Remake Reason is currently enabled as a filter | Disable for TAT in page capability definition |
| T-06 | TAT | Multi-year custom selection collapses to maximum selected year | Define intended year-selection behavior |
| C-01 | Technician | Current BigQuery project/dataset dependency needs canonical-source review | Reconcile required fields before any migration |
| C-02 | Technician | Full-population worker reconciliation needs sample validation | Validate attributed and unattributed totals |
| U-01 | Universal | API case ID fallback to case number needs uniqueness confirmation | Validate across customers and years |

## Change-control rule

Any future change to a metric, source, inclusion rule, pooling key, date rule, denominator, comparison rule, or attribution rule must update this document in the same Git commit as the code change.

Each change entry must state:

- Previous rule.
- New rule.
- Business reason.
- Source fields.
- Grain.
- Numerator.
- Denominator.
- Filter behavior.
- Reconciliation evidence.
- Approval state.

Do not close an open item merely because the interface looks correct. Close it only after the source and displayed result reconcile.