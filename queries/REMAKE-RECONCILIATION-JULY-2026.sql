-- Executive Overview Dashboard - Remake reconciliation
-- Audit period: July 1, 2026 through July 31, 2026
-- Source: customerprofiles.retention_data.products_all
-- Mode: READ ONLY. This script creates temporary tables only.
-- Output: ONE final result table, organized by section.

DECLARE audit_start_date DATE DEFAULT DATE '2026-07-01';
DECLARE audit_end_date DATE DEFAULT DATE '2026-08-01';

-- Verified July 2026 dashboard values captured from /dev.
-- Rates are percentage points: 7.8 means 7.8%, not 0.078.
DECLARE dashboard_total_cases FLOAT64 DEFAULT 2494;
DECLARE dashboard_remake_cases FLOAT64 DEFAULT 195;
DECLARE dashboard_case_rate_pct FLOAT64 DEFAULT 7.8;
DECLARE dashboard_total_units FLOAT64 DEFAULT 8290.3;
DECLARE dashboard_remake_units FLOAT64 DEFAULT 500.1;
DECLARE dashboard_unit_rate_pct FLOAT64 DEFAULT 6.0;
DECLARE dashboard_remake_discount FLOAT64 DEFAULT 56662;

CREATE TEMP TABLE raw_lines AS
SELECT
  Cases_InvoiceDate AS invoice_date,
  Cases_CustomerID AS customer_id,
  Customers_CustomerFullName AS customer_name,
  Cases_CaseNumber AS case_number,
  CONCAT(
    COALESCE(NULLIF(TRIM(Cases_CustomerID), ''), '<blank-customer>'),
    '|',
    COALESCE(CAST(Cases_CaseNumber AS STRING), '<missing-case-number>')
  ) AS audit_case_key,
  LOWER(TRIM(COALESCE(Cases_Status, ''))) AS normalized_status,
  IFNULL(Cases_IsAdjustment, FALSE) AS is_adjustment,
  IFNULL(Cases_IsDebitMemo, FALSE) AS is_debit_memo,
  IFNULL(Cases_IsFC, FALSE) AS is_finance_charge,
  TRIM(COALESCE(Cases_CreditDebitReason, '')) AS credit_debit_reason,
  CaseProducts_ProductID AS product_id,
  Products_Description AS product_description,
  Products_Department AS department,
  Products_Group AS product_group,
  CaseProducts_TeethNumbers AS product_teeth,
  COALESCE(CaseProducts_Quantity, 0) AS quantity,
  COALESCE(CaseProducts_UnitPrice, 0) AS unit_price,
  COALESCE(CaseProducts_TotalCharge, 0) AS product_total_charge,
  CaseProducts_Remake AS remake_value,
  LOWER(TRIM(COALESCE(CaseProducts_Remake, ''))) AS normalized_remake_value,
  CaseProducts_RemakeReason AS remake_reason,
  COALESCE(CaseProducts_RemakeDiscountRate, 0) AS remake_discount_rate,
  ABS(COALESCE(CaseProducts_RemakeDiscount, 0)) AS remake_discount,
  CASE
    WHEN TRIM(COALESCE(CaseProducts_Remake, '')) = '' THEN FALSE
    WHEN LOWER(TRIM(COALESCE(CaseProducts_Remake, ''))) IN
      ('n', 'no', 'false', '0', 'none', 'not a remake') THEN FALSE
    ELSE TRUE
  END AS is_remake
FROM `customerprofiles.retention_data.products_all`
WHERE Cases_InvoiceDate >= audit_start_date
  AND Cases_InvoiceDate < audit_end_date;

CREATE TEMP TABLE case_scope AS
WITH case_flags AS (
  SELECT
    audit_case_key,
    ANY_VALUE(customer_id) AS customer_id,
    ANY_VALUE(customer_name) AS customer_name,
    ANY_VALUE(case_number) AS case_number,
    ARRAY_AGG(DISTINCT normalized_status ORDER BY normalized_status) AS statuses,
    LOGICAL_OR(normalized_status = 'estimate') AS has_estimate,
    LOGICAL_OR(normalized_status IN ('sent for try in', 'sent for try-in')) AS has_sent_for_try_in,
    LOGICAL_OR(is_adjustment) AS has_adjustment,
    LOGICAL_OR(is_debit_memo) AS has_debit_memo,
    LOGICAL_OR(is_finance_charge) AS has_finance_charge,
    LOGICAL_OR(credit_debit_reason != '') AS has_credit_debit_reason,
    COUNT(*) AS product_line_count,
    SUM(quantity) AS source_units
  FROM raw_lines
  GROUP BY audit_case_key
)
SELECT
  *,
  CASE
    WHEN case_number IS NULL THEN 'audit key missing case number'
    WHEN has_estimate THEN 'estimate'
    WHEN has_sent_for_try_in THEN 'sent for try in'
    WHEN has_adjustment THEN 'adjustment'
    WHEN has_debit_memo THEN 'debit memo'
    WHEN has_finance_charge THEN 'finance charge'
    WHEN has_credit_debit_reason THEN 'credit/debit reason'
    ELSE 'included'
  END AS exclusion_reason
FROM case_flags;

CREATE TEMP TABLE included_lines AS
SELECT r.*
FROM raw_lines AS r
JOIN case_scope AS c USING (audit_case_key)
WHERE c.exclusion_reason = 'included';

CREATE TEMP TABLE included_case_flags AS
SELECT
  audit_case_key,
  LOGICAL_OR(is_remake) AS is_remake_case
FROM included_lines
GROUP BY audit_case_key;

CREATE TEMP TABLE audit_summary AS
SELECT
  (SELECT COUNT(*) FROM raw_lines) AS source_product_lines,
  (SELECT COUNT(*) FROM case_scope) AS source_distinct_cases,
  (SELECT COUNT(*) FROM included_lines) AS included_product_lines,
  (SELECT COUNT(*) FROM included_case_flags) AS total_cases,
  (SELECT COUNTIF(is_remake_case) FROM included_case_flags) AS remake_cases,
  (SELECT COALESCE(SUM(quantity), 0) FROM included_lines) AS total_units,
  (SELECT COALESCE(SUM(IF(is_remake, quantity, 0)), 0) FROM included_lines) AS remake_units,
  (SELECT COALESCE(SUM(IF(is_remake, remake_discount, 0)), 0) FROM included_lines) AS remake_discount,
  100 * SAFE_DIVIDE(
    (SELECT COUNTIF(is_remake_case) FROM included_case_flags),
    (SELECT COUNT(*) FROM included_case_flags)
  ) AS case_rate_pct,
  100 * SAFE_DIVIDE(
    (SELECT COALESCE(SUM(IF(is_remake, quantity, 0)), 0) FROM included_lines),
    (SELECT COALESCE(SUM(quantity), 0) FROM included_lines)
  ) AS unit_rate_pct;

CREATE TEMP TABLE dimension_lines AS
SELECT
  'Department' AS dimension,
  COALESCE(NULLIF(TRIM(department), ''), 'Not specified') AS dimension_value,
  audit_case_key,
  quantity,
  is_remake,
  remake_discount
FROM included_lines
UNION ALL
SELECT
  'Product Group',
  COALESCE(NULLIF(TRIM(product_group), ''), 'Not specified'),
  audit_case_key,
  quantity,
  is_remake,
  remake_discount
FROM included_lines
UNION ALL
SELECT
  'Product',
  CASE
    WHEN NULLIF(TRIM(product_id), '') IS NOT NULL
      AND NULLIF(TRIM(product_description), '') IS NOT NULL
      THEN CONCAT(TRIM(product_id), ' - ', TRIM(product_description))
    ELSE COALESCE(NULLIF(TRIM(product_description), ''), NULLIF(TRIM(product_id), ''), 'Not specified')
  END,
  audit_case_key,
  quantity,
  is_remake,
  remake_discount
FROM included_lines
UNION ALL
SELECT
  'Customer',
  CASE
    WHEN NULLIF(TRIM(customer_name), '') IS NOT NULL
      THEN CONCAT(TRIM(customer_name), ' (', COALESCE(NULLIF(TRIM(customer_id), ''), 'No ID'), ')')
    ELSE COALESCE(NULLIF(TRIM(customer_id), ''), 'Not specified')
  END,
  audit_case_key,
  quantity,
  is_remake,
  remake_discount
FROM included_lines
UNION ALL
SELECT
  'Remake Reason',
  CASE
    WHEN is_remake THEN COALESCE(NULLIF(TRIM(remake_reason), ''), 'Not specified')
    ELSE 'Not a remake'
  END,
  audit_case_key,
  quantity,
  is_remake,
  remake_discount
FROM included_lines;

CREATE TEMP TABLE dimension_summary AS
WITH case_metrics AS (
  SELECT
    dimension,
    dimension_value,
    COUNT(DISTINCT audit_case_key) AS total_cases,
    COUNT(DISTINCT IF(is_remake, audit_case_key, NULL)) AS remake_cases
  FROM dimension_lines
  GROUP BY dimension, dimension_value
),
line_metrics AS (
  SELECT
    dimension,
    dimension_value,
    SUM(quantity) AS total_units,
    SUM(IF(is_remake, quantity, 0)) AS remake_units,
    SUM(IF(is_remake, remake_discount, 0)) AS remake_discount
  FROM dimension_lines
  GROUP BY dimension, dimension_value
)
SELECT
  c.dimension,
  c.dimension_value,
  c.total_cases,
  c.remake_cases,
  100 * SAFE_DIVIDE(c.remake_cases, c.total_cases) AS case_rate_pct,
  l.total_units,
  l.remake_units,
  100 * SAFE_DIVIDE(l.remake_units, l.total_units) AS unit_rate_pct,
  l.remake_discount,
  100 * SAFE_DIVIDE(c.remake_cases, s.remake_cases) AS case_share_pct,
  100 * SAFE_DIVIDE(l.remake_units, s.remake_units) AS unit_share_pct,
  100 * SAFE_DIVIDE(l.remake_discount, s.remake_discount) AS discount_share_pct
FROM case_metrics AS c
JOIN line_metrics AS l USING (dimension, dimension_value)
CROSS JOIN audit_summary AS s;

CREATE TEMP TABLE case_dimension_profile AS
SELECT
  audit_case_key,
  ANY_VALUE(customer_id) AS customer_id,
  ANY_VALUE(customer_name) AS customer_name,
  ANY_VALUE(case_number) AS case_number,
  COUNT(DISTINCT COALESCE(NULLIF(TRIM(department), ''), 'Not specified')) AS department_count,
  COUNT(DISTINCT COALESCE(NULLIF(TRIM(product_group), ''), 'Not specified')) AS product_group_count,
  COUNT(DISTINCT COALESCE(NULLIF(TRIM(product_id), ''), NULLIF(TRIM(product_description), ''), 'Not specified')) AS product_count,
  COUNT(DISTINCT IF(is_remake, COALESCE(NULLIF(TRIM(remake_reason), ''), 'Not specified'), NULL)) AS remake_reason_count,
  ARRAY_AGG(DISTINCT COALESCE(NULLIF(TRIM(department), ''), 'Not specified') ORDER BY COALESCE(NULLIF(TRIM(department), ''), 'Not specified')) AS departments,
  ARRAY_AGG(DISTINCT COALESCE(NULLIF(TRIM(product_group), ''), 'Not specified') ORDER BY COALESCE(NULLIF(TRIM(product_group), ''), 'Not specified')) AS product_groups,
  ARRAY_AGG(DISTINCT COALESCE(NULLIF(TRIM(product_description), ''), NULLIF(TRIM(product_id), ''), 'Not specified') ORDER BY COALESCE(NULLIF(TRIM(product_description), ''), NULLIF(TRIM(product_id), ''), 'Not specified')) AS products,
  ARRAY_AGG(DISTINCT IF(is_remake, COALESCE(NULLIF(TRIM(remake_reason), ''), 'Not specified'), NULL) IGNORE NULLS) AS remake_reasons,
  LOGICAL_OR(is_remake) AS is_remake_case
FROM included_lines
GROUP BY audit_case_key;

CREATE TEMP TABLE final_audit AS
WITH
reconciliation AS (
  SELECT 1 AS row_order, 'Total Cases' AS item, dashboard_total_cases AS dashboard_value,
    CAST(total_cases AS FLOAT64) AS bigquery_value, 0.0 AS tolerance, 'count' AS unit FROM audit_summary
  UNION ALL SELECT 2, 'Remake Cases', dashboard_remake_cases, CAST(remake_cases AS FLOAT64), 0.0, 'count' FROM audit_summary
  UNION ALL SELECT 3, 'Case Rate', dashboard_case_rate_pct, case_rate_pct, 0.05, 'percentage points' FROM audit_summary
  UNION ALL SELECT 4, 'Total Units', dashboard_total_units, total_units, 0.05, 'units' FROM audit_summary
  UNION ALL SELECT 5, 'Remake Units', dashboard_remake_units, remake_units, 0.05, 'units' FROM audit_summary
  UNION ALL SELECT 6, 'Unit Rate', dashboard_unit_rate_pct, unit_rate_pct, 0.05, 'percentage points' FROM audit_summary
  UNION ALL SELECT 7, 'Remake Discount', dashboard_remake_discount, remake_discount, 0.50, 'dollars' FROM audit_summary
),
overlap_metrics AS (
  SELECT 1 AS row_order, 'Included cases' AS item, COUNT(*) AS value FROM case_dimension_profile
  UNION ALL SELECT 2, 'Multi-department cases', COUNTIF(department_count > 1) FROM case_dimension_profile
  UNION ALL SELECT 3, 'Multi-product-group cases', COUNTIF(product_group_count > 1) FROM case_dimension_profile
  UNION ALL SELECT 4, 'Multi-product cases', COUNTIF(product_count > 1) FROM case_dimension_profile
  UNION ALL SELECT 5, 'Multi-remake-reason cases', COUNTIF(remake_reason_count > 1) FROM case_dimension_profile
  UNION ALL SELECT 6, 'Multi-department remake cases', COUNTIF(is_remake_case AND department_count > 1) FROM case_dimension_profile
  UNION ALL SELECT 7, 'Multi-product remake cases', COUNTIF(is_remake_case AND product_count > 1) FROM case_dimension_profile
),
collisions AS (
  SELECT
    case_number,
    COUNT(DISTINCT COALESCE(NULLIF(TRIM(customer_id), ''), '<blank-customer>')) AS customer_count,
    ARRAY_AGG(DISTINCT COALESCE(NULLIF(TRIM(customer_id), ''), '<blank-customer>') ORDER BY COALESCE(NULLIF(TRIM(customer_id), ''), '<blank-customer>')) AS customer_ids
  FROM included_lines
  WHERE case_number IS NOT NULL
  GROUP BY case_number
  HAVING customer_count > 1
),
duplicates AS (
  SELECT
    audit_case_key,
    case_number,
    product_id,
    product_description,
    product_teeth,
    quantity,
    product_total_charge,
    remake_value,
    remake_reason,
    remake_discount,
    COUNT(*) AS identical_rows
  FROM included_lines
  GROUP BY audit_case_key, case_number, product_id, product_description, product_teeth,
    quantity, product_total_charge, remake_value, remake_reason, remake_discount
  HAVING identical_rows > 1
)
SELECT
  1 AS section_order,
  '01 Reconciliation' AS section,
  row_order,
  item,
  dashboard_value,
  bigquery_value,
  bigquery_value - dashboard_value AS difference,
  unit,
  CASE
    WHEN dashboard_value IS NULL THEN 'ENTER DASHBOARD VALUE'
    WHEN ABS(bigquery_value - dashboard_value) <= tolerance THEN 'MATCH'
    ELSE 'MISMATCH - RECONCILE ROWS BEFORE CHANGING FORMULAS'
  END AS status,
  TO_JSON_STRING(STRUCT(tolerance AS tolerance, unit AS tolerance_unit)) AS details
FROM reconciliation

UNION ALL
SELECT
  2,
  '02 Population exclusions',
  ROW_NUMBER() OVER (ORDER BY CASE exclusion_reason
    WHEN 'included' THEN 1 WHEN 'estimate' THEN 2 WHEN 'sent for try in' THEN 3
    WHEN 'adjustment' THEN 4 WHEN 'debit memo' THEN 5 WHEN 'finance charge' THEN 6
    WHEN 'credit/debit reason' THEN 7 ELSE 8 END),
  exclusion_reason,
  NULL,
  CAST(COUNT(*) AS FLOAT64),
  NULL,
  'distinct cases',
  IF(exclusion_reason = 'included', 'INCLUDED', 'EXCLUDED'),
  TO_JSON_STRING(STRUCT(SUM(product_line_count) AS product_lines, ROUND(SUM(source_units), 4) AS units))
FROM case_scope
GROUP BY exclusion_reason

UNION ALL
SELECT
  3,
  '03 Status distribution',
  ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, status),
  status,
  NULL,
  CAST(COUNT(*) AS FLOAT64),
  NULL,
  'distinct cases',
  IF(COUNTIF(exclusion_reason = 'included') > 0, 'PRESENT IN INCLUDED POPULATION', 'EXCLUDED ONLY'),
  TO_JSON_STRING(STRUCT(
    COUNTIF(exclusion_reason = 'included') AS included_cases,
    COUNTIF(exclusion_reason != 'included') AS excluded_cases
  ))
FROM case_scope, UNNEST(statuses) AS status
GROUP BY status

UNION ALL
SELECT
  4,
  '04 Remake classification values',
  ROW_NUMBER() OVER (ORDER BY is_remake DESC, COUNT(*) DESC, COALESCE(NULLIF(TRIM(remake_value), ''), '(blank)')),
  COALESCE(NULLIF(TRIM(remake_value), ''), '(blank)'),
  NULL,
  CAST(COUNT(*) AS FLOAT64),
  NULL,
  'product lines',
  IF(is_remake, 'CLASSIFIED AS REMAKE', 'CLASSIFIED AS NON-REMAKE'),
  TO_JSON_STRING(STRUCT(
    ROUND(SUM(quantity), 4) AS units,
    ROUND(SUM(IF(is_remake, remake_discount, 0)), 2) AS remake_discount
  ))
FROM included_lines
GROUP BY COALESCE(NULLIF(TRIM(remake_value), ''), '(blank)'), is_remake

UNION ALL
SELECT
  5,
  CONCAT('05 Grouped metrics - ', dimension),
  ROW_NUMBER() OVER (PARTITION BY dimension ORDER BY remake_cases DESC, remake_units DESC, dimension_value),
  dimension_value,
  NULL,
  NULL,
  NULL,
  'group metrics',
  'REVIEW RATE VS SHARE',
  TO_JSON_STRING(STRUCT(
    total_cases, remake_cases, ROUND(case_rate_pct, 4) AS case_rate_pct,
    ROUND(total_units, 4) AS total_units, ROUND(remake_units, 4) AS remake_units,
    ROUND(unit_rate_pct, 4) AS unit_rate_pct, ROUND(remake_discount, 2) AS remake_discount,
    ROUND(case_share_pct, 4) AS case_share_pct, ROUND(unit_share_pct, 4) AS unit_share_pct,
    ROUND(discount_share_pct, 4) AS discount_share_pct
  ))
FROM dimension_summary

UNION ALL
SELECT
  6,
  '06 Overlap summary',
  row_order,
  item,
  NULL,
  CAST(value AS FLOAT64),
  NULL,
  'cases',
  'INFORMATIONAL',
  TO_JSON_STRING(STRUCT('Grouped case counts are not always additive.' AS explanation))
FROM overlap_metrics

UNION ALL
SELECT
  7,
  '07 Representative overlap cases',
  ROW_NUMBER() OVER (ORDER BY is_remake_case DESC, department_count DESC, product_count DESC, audit_case_key),
  audit_case_key,
  NULL,
  NULL,
  NULL,
  'case',
  IF(is_remake_case, 'REMAKE CASE', 'NON-REMAKE CASE'),
  TO_JSON_STRING(STRUCT(
    customer_id, customer_name, case_number, departments, product_groups, products, remake_reasons
  ))
FROM case_dimension_profile
WHERE department_count > 1 OR product_group_count > 1 OR product_count > 1 OR remake_reason_count > 1
QUALIFY ROW_NUMBER() OVER (ORDER BY is_remake_case DESC, department_count DESC, product_count DESC, audit_case_key) <= 100

UNION ALL
SELECT
  8,
  '08 Case-number collision check',
  ROW_NUMBER() OVER (ORDER BY customer_count DESC, case_number),
  CAST(case_number AS STRING),
  NULL,
  CAST(customer_count AS FLOAT64),
  NULL,
  'customers',
  'REVIEW - CASE NUMBER ALONE IS NOT UNIQUE',
  TO_JSON_STRING(STRUCT(customer_ids))
FROM collisions

UNION ALL
SELECT
  9,
  '09 Remake 0 percent examples',
  ROW_NUMBER() OVER (ORDER BY case_number, product_id, product_description),
  audit_case_key,
  NULL,
  NULL,
  NULL,
  'product line',
  'CLASSIFIED AS REMAKE',
  TO_JSON_STRING(STRUCT(
    invoice_date, customer_id, customer_name, case_number, product_id, product_description,
    quantity, remake_value, remake_discount_rate, remake_discount, product_total_charge
  ))
FROM included_lines
WHERE is_remake
  AND (ABS(remake_discount_rate) < 0.000001
    OR REGEXP_CONTAINS(normalized_remake_value, r'(^|[^0-9])0(?:\.0+)?\s*%'))
QUALIFY ROW_NUMBER() OVER (ORDER BY case_number, product_id, product_description) <= 100

UNION ALL
SELECT
  10,
  '10 Zero-dollar remake lines',
  ROW_NUMBER() OVER (ORDER BY case_number, product_id, product_description),
  audit_case_key,
  NULL,
  NULL,
  NULL,
  'product line',
  'COUNTS AS REMAKE UNITS',
  TO_JSON_STRING(STRUCT(
    invoice_date, customer_id, customer_name, case_number, product_id, product_description,
    product_teeth, quantity, remake_value, remake_reason, remake_discount_rate,
    remake_discount, unit_price, product_total_charge
  ))
FROM included_lines
WHERE is_remake AND ABS(remake_discount) < 0.005 AND ABS(product_total_charge) < 0.005
QUALIFY ROW_NUMBER() OVER (ORDER BY case_number, product_id, product_description) <= 100

UNION ALL
SELECT
  11,
  '11 Duplicate-signature review',
  ROW_NUMBER() OVER (ORDER BY identical_rows DESC, audit_case_key, product_id),
  audit_case_key,
  NULL,
  CAST(identical_rows AS FLOAT64),
  NULL,
  'identical rows',
  'REVIEW ONLY - DO NOT AUTO-DEDUPLICATE',
  TO_JSON_STRING(STRUCT(
    case_number, product_id, product_description, product_teeth, quantity,
    product_total_charge, remake_value, remake_reason, remake_discount
  ))
FROM duplicates
QUALIFY ROW_NUMBER() OVER (ORDER BY identical_rows DESC, audit_case_key, product_id) <= 200;

-- ONE AND ONLY ONE RESULT TABLE.
SELECT
  section_order,
  section,
  row_order,
  item,
  ROUND(dashboard_value, 4) AS dashboard_value,
  ROUND(bigquery_value, 4) AS bigquery_value,
  ROUND(difference, 4) AS difference,
  unit,
  status,
  details
FROM final_audit
ORDER BY section_order, section, row_order, item;
