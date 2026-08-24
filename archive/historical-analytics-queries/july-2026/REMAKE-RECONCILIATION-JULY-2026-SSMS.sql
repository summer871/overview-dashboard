-- Executive Overview Dashboard - Live MagicTouch SSMS Remake reconciliation
-- Audit period: July 1, 2026 through July 31, 2026
-- Server: CDA-WUS3-SQL01.DLCPM
-- Database: DLCPM (production)
-- Mode: READ ONLY. Session-scoped temporary tables only.
-- Output: ONE final result grid.
--
-- Dashboard values captured from the July 2026 Remake dashboard:
-- Total Cases 2494 | Remake Cases 195 | Case Rate 7.8%
-- Total Units 8290.3 | Remake Units 500.1 | Unit Rate 6.0%
-- Remake Discount 56662
-- Dashboard Remake cache timestamp: 2026-08-05 05:45:00 PDT
--
-- The dashboard reads the MagicTouch CRM API cache. This query reads the live
-- MagicTouch production SQL database. A difference may reflect API contract or
-- cache timing and does not automatically prove either source is incorrect.
--
-- Remake classification is evaluated at dbo.CaseProducts product-line grain.
-- A case is a remake case when at least one included product line is a remake.
-- Department attribution stays with the product line that is marked as a remake.
--
-- The SSMS runbook does not name the direct-SQL remake-discount column. This
-- script safely discovers a numeric dbo.CaseProducts column whose name contains
-- both "remake" and "discount". If none exists, the Remake Discount result is
-- NULL with a clear schema status instead of guessing a field name.

USE [DLCPM];
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @AuditStartDate date = CONVERT(date, '20260701', 112);
DECLARE @AuditEndDate date = CONVERT(date, '20260801', 112);
DECLARE @DashboardCacheTimestamp datetimeoffset =
    CONVERT(datetimeoffset, '2026-08-05T05:45:00-07:00');
DECLARE @SsmsRunTimestamp datetimeoffset = SYSDATETIMEOFFSET();

DECLARE @DashboardTotalCases decimal(19,4) = 2494;
DECLARE @DashboardRemakeCases decimal(19,4) = 195;
DECLARE @DashboardCaseRatePct decimal(19,4) = 7.8;
DECLARE @DashboardTotalUnits decimal(19,4) = 8290.3;
DECLARE @DashboardRemakeUnits decimal(19,4) = 500.1;
DECLARE @DashboardUnitRatePct decimal(19,4) = 6.0;
DECLARE @DashboardRemakeDiscount decimal(19,4) = 56662;

DECLARE @RemakeDiscountColumn sysname;

SELECT TOP (1)
    @RemakeDiscountColumn = c.[name]
FROM sys.columns AS c
INNER JOIN sys.types AS t
    ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.CaseProducts')
  AND LOWER(c.[name]) LIKE N'%remake%'
  AND LOWER(c.[name]) LIKE N'%discount%'
  AND t.[name] IN
      (N'tinyint', N'smallint', N'int', N'bigint',
       N'decimal', N'numeric', N'money', N'smallmoney',
       N'float', N'real')
ORDER BY
    CASE
        WHEN c.[name] = N'RemakeDiscount' THEN 1
        WHEN c.[name] = N'RemakeDiscountAmount' THEN 2
        WHEN c.[name] = N'RemakeDiscountValue' THEN 3
        ELSE 4
    END,
    c.column_id;

DECLARE @RemakeDiscountExpression nvarchar(max) =
    CASE
        WHEN @RemakeDiscountColumn IS NULL
            THEN N'CAST(NULL AS decimal(19,4))'
        ELSE
            N'ABS(COALESCE(TRY_CONVERT(decimal(19,4), cp.'
            + QUOTENAME(@RemakeDiscountColumn)
            + N'), 0))'
    END;

CREATE TABLE #RawLines
(
    case_id nvarchar(128) NOT NULL,
    case_number nvarchar(128) NULL,
    invoice_date datetime NULL,
    department nvarchar(255) NOT NULL,
    product_id nvarchar(128) NULL,
    product_description nvarchar(500) NULL,
    quantity decimal(19,4) NOT NULL,
    remake_source_value nvarchar(255) NULL,
    is_remake bit NOT NULL,
    remake_discount decimal(19,4) NULL
);

DECLARE @ExtractionSql nvarchar(max) = N'
INSERT INTO #RawLines
(
    case_id, case_number, invoice_date, department, product_id,
    product_description, quantity, remake_source_value, is_remake,
    remake_discount
)
SELECT
    CONVERT(nvarchar(128), c.CaseID),
    CONVERT(nvarchar(128), c.CaseNumber),
    c.InvoiceDate,
    COALESCE(
        NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), p.Department))), N''''),
        N''Not specified''
    ),
    CONVERT(nvarchar(128), cp.ProductID),
    CONVERT(nvarchar(500), p.Description),
    COALESCE(TRY_CONVERT(decimal(19,4), cp.Quantity), 0),
    NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), cp.Remake))), N''''),
    CONVERT(bit,
        CASE
            WHEN NULLIF(
                LTRIM(RTRIM(CONVERT(nvarchar(255), cp.Remake))),
                N''''
            ) IS NULL THEN 0
            WHEN LOWER(LTRIM(RTRIM(CONVERT(nvarchar(255), cp.Remake)))) IN
                (N''n'', N''no'', N''false'', N''0'',
                 N''none'', N''not a remake'') THEN 0
            ELSE 1
        END
    ),
    ' + @RemakeDiscountExpression + N'
FROM dbo.Cases AS c
INNER JOIN dbo.CaseProducts AS cp
    ON cp.CaseID = c.CaseID
LEFT JOIN dbo.Products AS p
    ON p.ProductID = cp.ProductID
WHERE c.InvoiceDate >= @StartDate
  AND c.InvoiceDate < @EndDate
  AND ISNULL(c.Deleted, 0) = 0
  AND LOWER(LTRIM(RTRIM(COALESCE(
        CONVERT(nvarchar(255), c.Status), N''''
      )))) NOT IN
      (N''estimate'', N''sent for try in'', N''sent for try-in'')
  AND ISNULL(c.IsAdjustment, 0) = 0
  AND ISNULL(c.IsDebitMemo, 0) = 0
  AND ISNULL(c.IsFC, 0) = 0
  AND NULLIF(
        LTRIM(RTRIM(COALESCE(
            CONVERT(nvarchar(255), c.CreditDebitReason), N''''
        ))), N''''
      ) IS NULL;
';

EXEC sys.sp_executesql
    @ExtractionSql,
    N'@StartDate date, @EndDate date',
    @StartDate = @AuditStartDate,
    @EndDate = @AuditEndDate;

CREATE TABLE #CaseFlags
(
    case_id nvarchar(128) NOT NULL PRIMARY KEY,
    is_remake_case bit NOT NULL
);

INSERT INTO #CaseFlags (case_id, is_remake_case)
SELECT
    case_id,
    CONVERT(bit, MAX(CONVERT(int, is_remake)))
FROM #RawLines
GROUP BY case_id;

CREATE TABLE #CaseDepartments
(
    case_id nvarchar(128) NOT NULL,
    department nvarchar(255) NOT NULL,
    department_is_remake bit NOT NULL,
    total_units decimal(19,4) NOT NULL,
    remake_units decimal(19,4) NOT NULL,
    remake_discount decimal(19,4) NULL,
    PRIMARY KEY (case_id, department)
);

INSERT INTO #CaseDepartments
(
    case_id, department, department_is_remake,
    total_units, remake_units, remake_discount
)
SELECT
    case_id,
    department,
    CONVERT(bit, MAX(CONVERT(int, is_remake))),
    SUM(quantity),
    SUM(CASE WHEN is_remake = 1 THEN quantity ELSE 0 END),
    CASE
        WHEN @RemakeDiscountColumn IS NULL THEN NULL
        ELSE SUM(CASE WHEN is_remake = 1
                      THEN COALESCE(remake_discount, 0)
                      ELSE 0 END)
    END
FROM #RawLines
GROUP BY case_id, department;

CREATE TABLE #CaseDepartmentProfile
(
    case_id nvarchar(128) NOT NULL PRIMARY KEY,
    department_count int NOT NULL,
    remake_department_count int NOT NULL,
    non_remake_department_count int NOT NULL
);

INSERT INTO #CaseDepartmentProfile
(
    case_id, department_count,
    remake_department_count, non_remake_department_count
)
SELECT
    case_id,
    COUNT(*),
    SUM(CASE WHEN department_is_remake = 1 THEN 1 ELSE 0 END),
    SUM(CASE WHEN department_is_remake = 0 THEN 1 ELSE 0 END)
FROM #CaseDepartments
GROUP BY case_id;

DECLARE @SsmsTotalCases decimal(19,4) =
    COALESCE((SELECT CONVERT(decimal(19,4), COUNT_BIG(*))
              FROM #CaseFlags), 0);
DECLARE @SsmsRemakeCases decimal(19,4) =
    COALESCE((SELECT CONVERT(decimal(19,4), COUNT_BIG(*))
              FROM #CaseFlags
              WHERE is_remake_case = 1), 0);
DECLARE @SsmsTotalUnits decimal(19,4) =
    COALESCE((SELECT SUM(quantity) FROM #RawLines), 0);
DECLARE @SsmsRemakeUnits decimal(19,4) =
    COALESCE((SELECT SUM(CASE WHEN is_remake = 1
                             THEN quantity ELSE 0 END)
              FROM #RawLines), 0);
DECLARE @SsmsRemakeDiscount decimal(19,4) =
    CASE
        WHEN @RemakeDiscountColumn IS NULL THEN NULL
        ELSE COALESCE((SELECT SUM(CASE WHEN is_remake = 1
                                      THEN COALESCE(remake_discount, 0)
                                      ELSE 0 END)
                       FROM #RawLines), 0)
    END;
DECLARE @SsmsCaseRatePct decimal(19,4) =
    CONVERT(decimal(19,4),
        100.0 * @SsmsRemakeCases / NULLIF(@SsmsTotalCases, 0));
DECLARE @SsmsUnitRatePct decimal(19,4) =
    CONVERT(decimal(19,4),
        100.0 * @SsmsRemakeUnits / NULLIF(@SsmsTotalUnits, 0));

DECLARE @MultiDepartmentCases decimal(19,4) =
    COALESCE((SELECT CONVERT(decimal(19,4), COUNT_BIG(*))
              FROM #CaseDepartmentProfile
              WHERE department_count > 1), 0);
DECLARE @MultiDepartmentRemakeCases decimal(19,4) =
    COALESCE((SELECT CONVERT(decimal(19,4), COUNT_BIG(*))
              FROM #CaseDepartmentProfile AS p
              INNER JOIN #CaseFlags AS c
                  ON c.case_id = p.case_id
              WHERE p.department_count > 1
                AND c.is_remake_case = 1), 0);
DECLARE @MixedDepartmentRemakeCases decimal(19,4) =
    COALESCE((SELECT CONVERT(decimal(19,4), COUNT_BIG(*))
              FROM #CaseDepartmentProfile
              WHERE department_count > 1
                AND remake_department_count > 0
                AND non_remake_department_count > 0), 0);
DECLARE @NonRemakeDepartmentPairsOnRemakeCases decimal(19,4) =
    COALESCE((SELECT CONVERT(decimal(19,4), COUNT_BIG(*))
              FROM #CaseDepartments AS d
              INNER JOIN #CaseFlags AS c
                  ON c.case_id = d.case_id
              WHERE c.is_remake_case = 1
                AND d.department_is_remake = 0), 0);

DECLARE @DiscountNote nvarchar(4000) =
    CASE
        WHEN @RemakeDiscountColumn IS NULL
            THEN N'No numeric dbo.CaseProducts column containing both '
               + N'"remake" and "discount" was found.'
        ELSE N'Detected dbo.CaseProducts.'
             + QUOTENAME(@RemakeDiscountColumn)
    END;

DECLARE @Results TABLE
(
    section_order int NOT NULL,
    section nvarchar(100) NOT NULL,
    row_order int NOT NULL,
    item nvarchar(200) NOT NULL,
    dashboard_value decimal(19,4) NULL,
    ssms_value decimal(19,4) NULL,
    difference decimal(19,4) NULL,
    unit nvarchar(100) NOT NULL,
    status nvarchar(250) NOT NULL,
    details nvarchar(4000) NULL
);

INSERT INTO @Results
(
    section_order, section, row_order, item,
    dashboard_value, ssms_value, difference,
    unit, status, details
)
SELECT
    1,
    N'01 KPI reconciliation',
    m.row_order,
    m.item,
    m.dashboard_value,
    m.ssms_value,
    m.ssms_value - m.dashboard_value,
    m.unit,
    CASE
        WHEN m.ssms_value IS NULL THEN N'SCHEMA CHECK NEEDED'
        WHEN ABS(m.ssms_value - m.dashboard_value) <= m.tolerance
            THEN N'MATCH'
        ELSE N'DIFFERENCE - REVIEW API CACHE TIMING OR CONTRACT'
    END,
    CASE
        WHEN m.item = N'Remake Discount' THEN @DiscountNote
        ELSE N'Live SSMS uses dbo.Cases + dbo.CaseProducts. '
             + N'Dashboard uses the MagicTouch CRM API cache.'
    END
FROM
(
    VALUES
        (1, N'Total Cases', @DashboardTotalCases,
         @SsmsTotalCases, CONVERT(decimal(19,4), 0), N'count'),
        (2, N'Remake Cases', @DashboardRemakeCases,
         @SsmsRemakeCases, CONVERT(decimal(19,4), 0), N'count'),
        (3, N'Case Rate', @DashboardCaseRatePct,
         @SsmsCaseRatePct, CONVERT(decimal(19,4), 0.05),
         N'percentage points'),
        (4, N'Total Units', @DashboardTotalUnits,
         @SsmsTotalUnits, CONVERT(decimal(19,4), 0.05), N'units'),
        (5, N'Remake Units', @DashboardRemakeUnits,
         @SsmsRemakeUnits, CONVERT(decimal(19,4), 0.05), N'units'),
        (6, N'Unit Rate', @DashboardUnitRatePct,
         @SsmsUnitRatePct, CONVERT(decimal(19,4), 0.05),
         N'percentage points'),
        (7, N'Remake Discount', @DashboardRemakeDiscount,
         @SsmsRemakeDiscount, CONVERT(decimal(19,4), 0.50), N'dollars')
) AS m
(
    row_order, item, dashboard_value,
    ssms_value, tolerance, unit
);

INSERT INTO @Results
(
    section_order, section, row_order, item,
    dashboard_value, ssms_value, difference,
    unit, status, details
)
VALUES
(
    2, N'02 Product-line attribution checks', 1,
    N'Multi-department included cases', NULL, @MultiDepartmentCases, NULL,
    N'cases', N'INFORMATIONAL',
    N'One distinct case may legitimately appear in multiple department totals.'
),
(
    2, N'02 Product-line attribution checks', 2,
    N'Multi-department remake cases', NULL, @MultiDepartmentRemakeCases, NULL,
    N'cases', N'INFORMATIONAL',
    N'Cases with more than one department and at least one remake product line.'
),
(
    2, N'02 Product-line attribution checks', 3,
    N'Mixed remake/non-remake department cases', NULL,
    @MixedDepartmentRemakeCases, NULL,
    N'cases', N'EXPECTED',
    N'These cases contain at least one remake department and at least one '
    + N'non-remake department.'
),
(
    2, N'02 Product-line attribution checks', 4,
    N'Non-remake department pairs on remake cases', NULL,
    @NonRemakeDepartmentPairsOnRemakeCases, NULL,
    N'case-department pairs', N'EXPECTED - NOT FLAGGED AS REMAKE',
    N'The overall case is a remake, but these departments contain no remake '
    + N'product line and remain outside that department''s remake numerator.'
);

-- ONE AND ONLY ONE RESULT GRID.
SELECT
    r.section_order,
    r.section,
    r.row_order,
    r.item,
    r.dashboard_value,
    r.ssms_value,
    r.difference,
    r.unit,
    r.status,
    r.details,
    @DashboardCacheTimestamp AS dashboard_cache_timestamp,
    @SsmsRunTimestamp AS ssms_run_timestamp,
    @RemakeDiscountColumn AS detected_remake_discount_column
FROM @Results AS r
ORDER BY r.section_order, r.row_order, r.item;
