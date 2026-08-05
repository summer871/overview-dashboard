-- Executive Overview Dashboard - Remake reconciliation
-- Audit period: July 1, 2026 through July 31, 2026
-- Source: customerprofiles.retention_data.products_all
-- Mode: READ ONLY. This script creates temporary tables only.
--
-- Purpose
-- 1. Reproduce the current Remake dashboard inclusion and product-line remake rules.
-- 2. Calculate distinct-case metrics separately from additive product-line metrics.
-- 3. Expose exclusions, overlapping grouped case counts, classification values,
--    possible case-key collisions, and source rows that need manual review.
-- 4. Compare the BigQuery result to values copied from the July dashboard view.
--
-- Important source difference
-- The live dashboard is built from the MagicTouch CRM API. This query is an
-- independent BigQuery cross-check. A mismatch can be caused by refresh timing,
-- fields available only in the API, deleted-case handling, or a real formula/data
-- defect. Do not change a formula until the row-level difference is understood.

DECLARE audit_start_date DATE DEFAULT DATE '2026-07-01';
DECLARE audit_end_date DATE DEFAULT DATE '2026-08-01';

-- Enter the July dashboard values here after setting the dashboard to July 2026.
-- Enter rates as displayed percentages: for example, enter 3.3 for 3.3%, not 0.033.
-- Leave a value NULL when it is not displayed or has not yet been captured.
DECLARE dashboard_total_cases FLOAT64 DEFAULT NULL;
DECLARE dashboard_remake_cases FLOAT64 DEFAULT NULL;
DECLARE dashboard_case_rate_pct FLOAT64 DEFAULT NULL;
DECLARE dashboard_total_units FLOAT64 DEFAULT NULL;
DECLARE dashboard_remake_units FLOAT64 DEFAULT NULL;
DECLARE dashboard_unit_rate_pct FLOAT64 DEFAULT NULL;
DECLARE dashboard_remake_discount FLOAT64 DEFAULT NULL;

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
  Products_Category AS product_category,
  Products_Type AS product_type,
  Cases_TeethUSA AS case_teeth,
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

-- The dashboard applies case-level exclusions before product lines enter the
-- denominator. Aggregate repeated case fields first so no case is partially kept.
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
JOIN case_scope AS c
  USING (audit_case_key)
WHERE c.exclusion_reason = 'included';

CREATE TEMP TABLE included_case_flags AS
SELECT
  audit_case_key,
  ANY_VALUE(customer_id) AS customer_id,
  ANY_VALUE(customer_name) AS customer_name,
  ANY_VALUE(case_number) AS case_number,
  LOGICAL_OR(is_remake) AS is_remake_case,
  SUM(quantity) AS case_total_units,
  SUM(IF(is_remake, quantity, 0)) AS case_remake_units,
  SUM(IF(is_remake, remake_discount, 0)) AS case_remake_discount
FROM included_lines
GROUP BY audit_case_key;

CREATE TEMP TABLE audit_summary AS
SELECT
  audit_start_date AS audit_start_date,
  DATE_SUB(audit_end_date, INTERVAL 1 DAY) AS audit_end_date,
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
  ) AS unit_rate_pct,
  (SELECT COUNTIF(case_number IS NULL) FROM case_scope) AS cases_missing_case_number;

-- Result 1: overall July metrics.
SELECT
  audit_start_date,
  audit_end_date,
  source_product_lines,
  source_distinct_cases,
  included_product_lines,
  total_cases,
  remake_cases,
  ROUND(case_rate_pct, 4) AS case_rate_pct,
  ROUND(total_units, 4) AS total_units,
  ROUND(remake_units, 4) AS remake_units,
  ROUND(unit_rate_pct, 4) AS unit_rate_pct,
  ROUND(remake_discount, 2) AS remake_discount,
  cases_missing_case_number
FROM audit_summary;

-- Result 2: case-level inclusion/exclusion population.
SELECT
  exclusion_reason,
  COUNT(*) AS distinct_cases,
  SUM(product_line_count) AS product_lines,
  ROUND(SUM(source_units), 4) AS units
FROM case_scope
GROUP BY exclusion_reason
ORDER BY
  CASE exclusion_reason
    WHEN 'included' THEN 1
    WHEN 'estimate' THEN 2
    WHEN 'sent for try in' THEN 3
    WHEN 'adjustment' THEN 4
    WHEN 'debit memo' THEN 5
    WHEN 'finance charge' THEN 6
    WHEN 'credit/debit reason' THEN 7
    ELSE 8
  END;

-- Result 3: source status distribution. This exposes statuses that the current
-- Remake rule does not exclude, such as BF Invoice or a differently spelled value.
SELECT
  status,
  COUNT(*) AS distinct_cases,
  COUNTIF(exclusion_reason = 'included') AS included_cases,
  COUNTIF(exclusion_reason != 'included') AS excluded_cases
FROM case_scope,
UNNEST(statuses) AS status
GROUP BY status
ORDER BY distinct_cases DESC, status;

-- Result 4: exact product-line remake classification values.
-- The dashboard treats every nonblank value as remake except its explicit false list.
SELECT
  COALESCE(NULLIF(TRIM(remake_value), ''), '(blank)') AS source_remake_value,
  is_remake,
  COUNT(*) AS product_lines,
  ROUND(SUM(quantity), 4) AS units,
  ROUND(SUM(IF(is_remake, remake_discount, 0)), 2) AS remake_discount
FROM included_lines
GROUP BY source_remake_value, is_remake
ORDER BY is_remake DESC, product_lines DESC, source_remake_value;

-- Build one generic dimension population so every grouped output uses the same
-- numerator/denominator rules.
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
    ELSE COALESCE(
      NULLIF(TRIM(product_description), ''),
      NULLIF(TRIM(product_id), ''),
      'Not specified'
    )
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
      THEN CONCAT(
        TRIM(customer_name),
        ' (',
        COALESCE(NULLIF(TRIM(customer_id), ''), 'No ID'),
        ')'
      )
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
WITH dimension_case_flags AS (
  SELECT
    dimension,
    dimension_value,
    audit_case_key,
    LOGICAL_OR(is_remake) AS is_remake_case
  FROM dimension_lines
  GROUP BY dimension, dimension_value, audit_case_key
),
dimension_case_metrics AS (
  SELECT
    dimension,
    dimension_value,
    COUNT(*) AS total_cases,
    COUNTIF(is_remake_case) AS remake_cases
  FROM dimension_case_flags
  GROUP BY dimension, dimension_value
),
dimension_line_metrics AS (
  SELECT
    dimension,
    dimension_value,
    SUM(quantity) AS total_units,
    SUM(IF(is_remake, quantity, 0)) AS remake_units,
    SUM(IF(is_remake, remake_discount, 0)) AS remake_discount
  FROM dimension_lines
  GROUP BY dimension, dimension_value
),
overall AS (
  SELECT * FROM audit_summary
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
  100 * SAFE_DIVIDE(c.remake_cases, overall.remake_cases) AS remake_case_share_pct,
  100 * SAFE_DIVIDE(l.remake_units, overall.remake_units) AS remake_unit_share_pct,
  100 * SAFE_DIVIDE(l.remake_discount, overall.remake_discount) AS remake_discount_share_pct
FROM dimension_case_metrics AS c
JOIN dimension_line_metrics AS l
  USING (dimension, dimension_value)
CROSS JOIN overall;

-- Result 5: grouped rates and shares.
-- Case shares can exceed 100% when summed across an overlapping dimension because
-- one multi-value case can count once in more than one group.
SELECT
  dimension,
  dimension_value,
  total_cases,
  remake_cases,
  ROUND(case_rate_pct, 4) AS case_rate_pct,
  ROUND(total_units, 4) AS total_units,
  ROUND(remake_units, 4) AS remake_units,
  ROUND(unit_rate_pct, 4) AS unit_rate_pct,
  ROUND(remake_discount, 2) AS remake_discount,
  ROUND(remake_case_share_pct, 4) AS remake_case_share_pct,
  ROUND(remake_unit_share_pct, 4) AS remake_unit_share_pct,
  ROUND(remake_discount_share_pct, 4) AS remake_discount_share_pct
FROM dimension_summary
ORDER BY dimension, remake_cases DESC, remake_units DESC, dimension_value;

CREATE TEMP TABLE case_dimension_profile AS
SELECT
  audit_case_key,
  ANY_VALUE(customer_id) AS customer_id,
  ANY_VALUE(customer_name) AS customer_name,
  ANY_VALUE(case_number) AS case_number,
  COUNT(DISTINCT COALESCE(NULLIF(TRIM(department), ''), 'Not specified')) AS department_count,
  COUNT(DISTINCT COALESCE(NULLIF(TRIM(product_group), ''), 'Not specified')) AS product_group_count,
  COUNT(DISTINCT COALESCE(NULLIF(TRIM(product_id), ''), NULLIF(TRIM(product_description), ''), 'Not specified')) AS product_count,
  COUNT(DISTINCT CASE
    WHEN is_remake THEN COALESCE(NULLIF(TRIM(remake_reason), ''), 'Not specified')
    ELSE NULL
  END) AS remake_reason_count,
  ARRAY_AGG(DISTINCT COALESCE(NULLIF(TRIM(department), ''), 'Not specified') ORDER BY COALESCE(NULLIF(TRIM(department), ''), 'Not specified')) AS departments,
  ARRAY_AGG(DISTINCT COALESCE(NULLIF(TRIM(product_group), ''), 'Not specified') ORDER BY COALESCE(NULLIF(TRIM(product_group), ''), 'Not specified')) AS product_groups,
  ARRAY_AGG(DISTINCT COALESCE(NULLIF(TRIM(product_description), ''), NULLIF(TRIM(product_id), ''), 'Not specified') ORDER BY COALESCE(NULLIF(TRIM(product_description), ''), NULLIF(TRIM(product_id), ''), 'Not specified')) AS products,
  ARRAY_AGG(DISTINCT CASE
    WHEN is_remake THEN COALESCE(NULLIF(TRIM(remake_reason), ''), 'Not specified')
    ELSE NULL
  END IGNORE NULLS ORDER BY CASE
    WHEN is_remake THEN COALESCE(NULLIF(TRIM(remake_reason), ''), 'Not specified')
    ELSE NULL
  END) AS remake_reasons,
  LOGICAL_OR(is_remake) AS is_remake_case
FROM included_lines
GROUP BY audit_case_key;

-- Result 6: how often grouped case counts overlap.
SELECT
  COUNT(*) AS included_cases,
  COUNTIF(department_count > 1) AS multi_department_cases,
  COUNTIF(product_group_count > 1) AS multi_product_group_cases,
  COUNTIF(product_count > 1) AS multi_product_cases,
  COUNTIF(remake_reason_count > 1) AS multi_remake_reason_cases,
  COUNTIF(is_remake_case AND department_count > 1) AS multi_department_remake_cases,
  COUNTIF(is_remake_case AND product_count > 1) AS multi_product_remake_cases
FROM case_dimension_profile;

-- Result 7: representative overlapping cases for explanation and spot checks.
SELECT
  audit_case_key,
  customer_id,
  customer_name,
  case_number,
  is_remake_case,
  department_count,
  departments,
  product_group_count,
  product_groups,
  product_count,
  products,
  remake_reason_count,
  remake_reasons
FROM case_dimension_profile
WHERE department_count > 1
   OR product_group_count > 1
   OR product_count > 1
   OR remake_reason_count > 1
ORDER BY is_remake_case DESC, department_count DESC, product_count DESC, audit_case_key
LIMIT 100;

-- Result 8: determine whether case number alone is globally unique in this month.
-- The audit case key intentionally uses Customer ID + Case Number until this is proven.
SELECT
  case_number,
  COUNT(DISTINCT COALESCE(NULLIF(TRIM(customer_id), ''), '<blank-customer>')) AS customer_count,
  ARRAY_AGG(DISTINCT COALESCE(NULLIF(TRIM(customer_id), ''), '<blank-customer>') ORDER BY COALESCE(NULLIF(TRIM(customer_id), ''), '<blank-customer>') LIMIT 20) AS customer_ids
FROM included_lines
WHERE case_number IS NOT NULL
GROUP BY case_number
HAVING customer_count > 1
ORDER BY customer_count DESC, case_number;

-- Result 9: Remake 0% examples. A zero percentage remains a remake when the
-- product-line remake value is affirmative/nonblank under the current rule.
SELECT
  invoice_date,
  audit_case_key,
  customer_id,
  customer_name,
  case_number,
  product_id,
  product_description,
  quantity,
  remake_value,
  remake_discount_rate,
  remake_discount,
  product_total_charge
FROM included_lines
WHERE is_remake
  AND (
    ABS(remake_discount_rate) < 0.000001
    OR REGEXP_CONTAINS(normalized_remake_value, r'(^|[^0-9])0(?:\.0+)?\s*%')
  )
ORDER BY case_number, product_id, product_description
LIMIT 100;

-- Result 10: zero-dollar remake-line examples. These still contribute remake
-- case and unit counts when the line remake value is affirmative.
SELECT
  invoice_date,
  audit_case_key,
  customer_id,
  customer_name,
  case_number,
  product_id,
  product_description,
  product_teeth,
  quantity,
  remake_value,
  remake_reason,
  remake_discount_rate,
  remake_discount,
  unit_price,
  product_total_charge
FROM included_lines
WHERE is_remake
  AND ABS(remake_discount) < 0.005
  AND ABS(product_total_charge) < 0.005
ORDER BY case_number, product_id, product_description
LIMIT 100;

-- Result 11: potential duplicate product-line signatures.
-- Identical signatures can be legitimate; this is a review list, not a deletion rule.
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
  COUNT(*) AS identical_signature_rows
FROM included_lines
GROUP BY
  audit_case_key,
  case_number,
  product_id,
  product_description,
  product_teeth,
  quantity,
  product_total_charge,
  remake_value,
  remake_reason,
  remake_discount
HAVING identical_signature_rows > 1
ORDER BY identical_signature_rows DESC, audit_case_key, product_id
LIMIT 200;

-- Result 12: dashboard-versus-BigQuery reconciliation.
-- Re-run after entering the dashboard values in the DECLARE section above.
WITH source AS (
  SELECT * FROM audit_summary
), reconciliation AS (
  SELECT 'Total Cases' AS metric, dashboard_total_cases AS dashboard_value, CAST(total_cases AS FLOAT64) AS bigquery_value, 0.0 AS tolerance, 'count' AS unit FROM source
  UNION ALL
  SELECT 'Remake Cases', dashboard_remake_cases, CAST(remake_cases AS FLOAT64), 0.0, 'count' FROM source
  UNION ALL
  SELECT 'Case Rate', dashboard_case_rate_pct, case_rate_pct, 0.01, 'percentage points' FROM source
  UNION ALL
  SELECT 'Total Units', dashboard_total_units, total_units, 0.001, 'units' FROM source
  UNION ALL
  SELECT 'Remake Units', dashboard_remake_units, remake_units, 0.001, 'units' FROM source
  UNION ALL
  SELECT 'Unit Rate', dashboard_unit_rate_pct, unit_rate_pct, 0.01, 'percentage points' FROM source
  UNION ALL
  SELECT 'Remake Discount', dashboard_remake_discount, remake_discount, 0.01, 'dollars' FROM source
)
SELECT
  metric,
  dashboard_value,
  ROUND(bigquery_value, IF(unit = 'dollars', 2, 4)) AS bigquery_value,
  ROUND(bigquery_value - dashboard_value, IF(unit = 'dollars', 2, 4)) AS bigquery_minus_dashboard,
  unit,
  CASE
    WHEN dashboard_value IS NULL THEN 'ENTER DASHBOARD VALUE AND RERUN'
    WHEN ABS(bigquery_value - dashboard_value) <= tolerance THEN 'MATCH'
    ELSE 'MISMATCH - RECONCILE ROWS BEFORE CHANGING FORMULAS'
  END AS audit_status
FROM reconciliation
ORDER BY
  CASE metric
    WHEN 'Total Cases' THEN 1
    WHEN 'Remake Cases' THEN 2
    WHEN 'Case Rate' THEN 3
    WHEN 'Total Units' THEN 4
    WHEN 'Remake Units' THEN 5
    WHEN 'Unit Rate' THEN 6
    WHEN 'Remake Discount' THEN 7
    ELSE 8
  END;
