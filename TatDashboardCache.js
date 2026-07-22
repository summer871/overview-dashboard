/**
 * TAT Dashboard Cache
 * Version: v3.1 monthly-shards + Products.department + data-quality browser-ready gzip
 *
 * Storage mirrors the proven Remake Factor pattern:
 * - one small Drive index
 * - one JSON shard per invoice month
 * - one compact dictionary-packed gzip for browser loading
 *
 * The dashboard never asks Apps Script to parse the full historical dataset in
 * one file. Historical months remain fixed; incremental refresh replaces only
 * the open month(s), then schedules a browser-ready rebuild.
 */

const tatDashboardConfig = {
  cacheFolderName: 'TAT Dashboard Cache',
  legacyCacheFileName: 'tatDashboardCache.json',
  indexFileName: 'tat_cache_index.json',
  shardPrefix: 'tat_cache_month_',
  browserReadyFileName: 'tat_browser_ready.json.gz',
  indexFileIdProperty: 'MT_TAT_CACHE_INDEX_FILE_ID',
  legacyFileIdProperty: 'MT_TAT_CACHE_FILE_ID',
  browserReadyFileIdProperty: 'MT_TAT_BROWSER_READY_FILE_ID',
  holidayOverrideProperty: 'MT_TAT_HOLIDAYS_JSON',
  cacheVersion: 'tat-dashboard-v3.1-products-department-sharded-quality-browser-ready',
  storageMode: 'monthlyDriveJsonShards',
  browserSchema: 'tat-browser-packed-v3',
  sourceSystem: 'MagicTouch CRM API',
  lookbackYears: 3,
  pageSize: 250,
  maxPagesPerChunk: 120,
  maxDetailFetches: 5000,
  mainDepartments: [
    'Advanced Prosthetics',
    'Fixed',
    'Implant',
    'Nightguard',
    'Removable'
  ],
  hardcodedHolidays: [
    '2024-01-01','2024-05-27','2024-07-04','2024-09-02','2024-11-28','2024-11-29','2024-12-25',
    '2025-01-01','2025-05-26','2025-07-04','2025-09-01','2025-11-27','2025-11-28','2025-12-25',
    '2026-01-01','2026-05-25','2026-07-03','2026-09-07','2026-11-26','2026-11-27','2026-12-25',
    '2027-01-01','2027-05-31','2027-07-05','2027-09-06','2027-11-25','2027-11-26','2027-12-24',
    '2028-01-03','2028-05-29','2028-07-04','2028-09-04','2028-11-23','2028-11-24','2028-12-25'
  ]
};

function refreshTatDashboardCache(options) {
  const requested = options || {};
  assertTatApiDependencies();

  const now = new Date();
  const currentYear = now.getFullYear();
  const priorYear = currentYear - 1;
  const configuredFirstYear = currentYear - Math.max(1, Number(requested.lookbackYears || tatDashboardConfig.lookbackYears)) + 1;
  const existingIndex = readTatDashboardCacheIndex();
  const hasExistingCache = !!(existingIndex && existingIndex.ok && existingIndex.shards);
  const existingIsSeeded = !!(hasExistingCache && existingIndex.config && existingIndex.config.seededExternally === true);

  if (requested.fullRebuild !== true && !existingIsSeeded && requested.allowUnseededIncremental !== true) {
    throw new Error('The TAT historical cache has not been verified as externally seeded. Convert or seed the monthly cache first, then run relinkTatDashboardCacheFiles() once.');
  }

  const incremental = requested.fullRebuild === true
    ? false
    : (requested.incremental !== false && hasExistingCache && (existingIsSeeded || requested.allowUnseededIncremental === true));
  const openRefreshMonths = Math.max(1, Number(requested.openRefreshMonths || 1));
  const refreshStartDate = incremental
    ? formatTatDate(new Date(currentYear, now.getMonth() - openRefreshMonths + 1, 1))
    : formatTatDate(new Date(configuredFirstYear, 0, 1));
  const endDate = formatTatDate(now);
  const firstYear = incremental && existingIndex.config && Number(existingIndex.config.firstYear)
    ? Number(existingIndex.config.firstYear)
    : configuredFirstYear;
  const props = PropertiesService.getScriptProperties();
  const holidays = getTatHolidaySet();

  const apiConfig = getRemakeFactorConfig(props, {
    startDate: refreshStartDate,
    endDate: endDate,
    lookbackMonths: incremental ? openRefreshMonths : Math.max(12, (currentYear - firstYear + 1) * 12),
    pageSize: Number(requested.pageSize || tatDashboardConfig.pageSize),
    maxPages: Number(requested.maxPages || tatDashboardConfig.maxPagesPerChunk),
    maxPagesPerChunk: Number(requested.maxPagesPerChunk || tatDashboardConfig.maxPagesPerChunk),
    maxDetailFetches: Number(requested.maxDetailFetches || tatDashboardConfig.maxDetailFetches),
    detailStrategy: 'all',
    additionalFields: 'caseProducts',
    chunkByMonth: true,
    fetchProductMap: true,
    fetchCustomerMap: true,
    useProductLookup: false,
    quickRefresh: incremental
  });

  const token = authenticateRemakeFactorApi(apiConfig);
  const caseResult = fetchRemakeFactorCases(apiConfig, token);
  const caseRows = Array.isArray(caseResult && caseResult.rows) ? caseResult.rows : [];
  const productMap = fetchRemakeFactorProductMap(apiConfig, token) || {};
  Object.keys(productMap).forEach(function(productId) {
    const upper = String(productId || '').toUpperCase();
    if (upper && !productMap[upper]) productMap[upper] = productMap[productId];
  });
  const customerMap = fetchRemakeFactorCustomerMap(apiConfig, token, caseRows) || {};
  const build = buildTatApiRows(caseRows, customerMap, productMap, holidays, {
    currentYear: currentYear,
    priorYear: priorYear,
    firstYear: firstYear,
    asOfDate: endDate
  });

  const generatedAt = new Date();
  const warnings = [].concat(
    (caseResult && caseResult.stats && caseResult.stats.warnings) || [],
    build.stats.warnings || []
  );
  if (!incremental) warnings.push('Full historical API rebuild completed. Future scheduled runs default to open-month incremental refresh.');

  const payload = {
    ok: true,
    cacheVersion: tatDashboardConfig.cacheVersion,
    sourceSystem: tatDashboardConfig.sourceSystem,
    generatedAtIso: generatedAt.toISOString(),
    generatedAtDisplay: Utilities.formatDate(generatedAt, Session.getScriptTimeZone(), 'M/d/yyyy h:mm:ss a'),
    refreshMode: incremental ? 'incremental-open-month' : 'full-historical',
    refreshStartDate: refreshStartDate,
    refreshEndDate: endDate,
    rowCounts: {
      sourceCasesThisRefresh: caseRows.length,
      refreshedFactRows: build.factRows.length,
      includedCasesThisRefresh: build.stats.totalIncludedCases,
      eligibleCasesThisRefresh: build.stats.eligibleCases,
      invalidCasesThisRefresh: build.invalidCases.length,
      missingHoldEndCasesThisRefresh: build.missingHoldEndCases.length,
      excludedCasesThisRefresh: build.stats.excludedCases
    },
    config: Object.assign({}, incremental && existingIndex && existingIndex.config ? existingIndex.config : {}, {
      currentYear: currentYear,
      priorYear: priorYear,
      firstYear: firstYear,
      defaultYears: [currentYear, priorYear],
      mainDepartments: tatDashboardConfig.mainDepartments.slice(),
      asOfDate: endDate,
      sameCutoffDay: true,
      dateInIsDayZero: true,
      completionDateRule: 'Shipment Date, otherwise Invoice Date',
      shipDateFallbackUsed: false,
      holidayMode: 'hardcoded centralized dates with optional MT_TAT_HOLIDAYS_JSON override',
      holidayDates: Object.keys(holidays).sort(),
      refreshMode: incremental ? 'incremental-open-month' : 'full-historical',
      refreshStartDate: refreshStartDate,
      seededExternally: incremental ? existingIsSeeded : true
    }),
    factRows: build.factRows,
    invalidCases: build.invalidCases,
    missingHoldEndCases: build.missingHoldEndCases,
    warnings: warnings
  };

  const index = writeTatDashboardShards(payload, {
    replaceAll: !incremental,
    monthKeys: listTatMonthKeys(refreshStartDate, endDate)
  });
  const scheduled = scheduleTatBrowserReadyRebuild();
  return {
    ok: true,
    version: tatDashboardConfig.cacheVersion,
    refreshMode: payload.refreshMode,
    refreshStartDate: refreshStartDate,
    generatedAtDisplay: payload.generatedAtDisplay,
    indexFileId: index.fileId || '',
    cachedMonths: index.months || [],
    totalRows: index.totalRows || 0,
    browserReadyRebuildScheduled: !!(scheduled && scheduled.ok),
    browserReadyRebuildMessage: scheduled && scheduled.message ? scheduled.message : '',
    warnings: warnings
  };
}

function readTatDashboardCachePayload() {
  return readTatDashboardCacheIndex();
}

function mergeTatRowsByRefreshWindow(existingRows, refreshedRows, refreshStartDate) {
  const kept = (existingRows || []).filter(function(row) {
    const invoiceDate = normalizeTatDate(row && row.invoiceDate);
    return invoiceDate && invoiceDate < refreshStartDate;
  });
  return kept.concat(refreshedRows || []).sort(function(a, b) {
    return String(a.invoiceDate || '').localeCompare(String(b.invoiceDate || '')) ||
      String(a.caseNumber || a.caseId || '').localeCompare(String(b.caseNumber || b.caseId || '')) ||
      String(a.productsDepartment || '').localeCompare(String(b.productsDepartment || ''));
  });
}

function getTatDashboardData() {
  return getTatDashboardBrowserReadyData();
}

function buildTatApiRows(caseRows, customerMap, productMap, holidays, bounds) {
  const factRows = [];
  const invalidCases = [];
  const missingHoldEndCases = [];
  const stats = { eligibleCases: 0, invalidCases: 0, excludedCases: 0, totalIncludedCases: 0, warnings: [] };

  (caseRows || []).forEach(function(caseRow) {
    const invoiceDate = normalizeTatDate(firstTatValue(caseRow, ['invoiceDate','InvoiceDate','Cases_InvoiceDate']));
    if (!invoiceDate || !tatDateInSameCutoffScope(invoiceDate, bounds)) {
      stats.excludedCases++;
      return;
    }

    const exclusion = getTatCaseExclusionReason(caseRow);
    if (exclusion) {
      stats.excludedCases++;
      return;
    }

    const caseId = cleanTatText(firstTatValue(caseRow, ['caseID','caseId','CaseID','id'])) || cleanTatText(firstTatValue(caseRow, ['caseNumber','CaseNumber','Cases_CaseNumber']));
    const caseNumber = cleanTatText(firstTatValue(caseRow, ['caseNumber','CaseNumber','Cases_CaseNumber'])) || caseId;
    const customerId = cleanTatText(firstTatValue(caseRow, [
      'customerID','customerId','CustomerID','Customers_CustomerID','Cases_CustomerID'
    ])) || 'Unassigned customer ID';
    const customerInfo = customerMap[customerId] || {};
    const customerName = cleanTatText(
      customerInfo.customerDisplayName || customerInfo.customerName || customerInfo.practiceName ||
      firstTatValue(caseRow, ['customerDisplayName','customerName','customerFullName','Customers_CustomerFullName','practiceName','Customers_PracticeName'])
    ) || customerId;
    const customerActive = getTatCustomerActive(caseRow, customerInfo);
    const products = extractTatProductLines(caseRow);
    const productDetails = products.map(function(line, index) {
      const dimensions = getTatProductDimensions(caseRow, line, index, productMap);
      const quantity = getTatLineQuantity(line);
      const isRemake = isTatRemakeLine(line);
      return {
        line: line,
        dimensions: dimensions,
        quantity: quantity,
        isRemake: isRemake,
        remakeReason: isRemake ? getTatRemakeReason(line) : 'Not a remake'
      };
    });

    const dateIn = normalizeTatDate(firstTatValue(caseRow, ['dateIn','DateIn','Cases_DateIn']));
    const shipmentDate = normalizeTatDate(firstTatValue(caseRow, ['shipmentDate','ShipmentDate','Cases_ShipmentDate']));
    const completionDate = shipmentDate || invoiceDate;
    const dueDate = normalizeTatDate(firstTatValue(caseRow, ['dueDate','DueDate','Cases_DueDate']));
    const invalidReason = !dateIn
      ? 'Missing Date In'
      : (!completionDate ? 'Missing completion date' : (compareTatDates(completionDate, dateIn) < 0 ? 'Completion date is before Date In' : ''));
    const tatEligible = !invalidReason;

    let holdInfo = { holdBusinessDays: 0, holdStartCount: 0, holdEndCount: 0, missingHoldEndCount: 0, source: 'TAT not eligible' };
    let rawBusinessTatDays = null;
    let businessTatDays = null;
    let otpEligible = false;
    let onTimeToPromise = null;
    let daysLate = 0;
    if (tatEligible) {
      holdInfo = calculateTatHoldInfo(caseRow, holidays, dateIn, completionDate);
      rawBusinessTatDays = countTatBusinessDays(dateIn, completionDate, holidays);
      businessTatDays = Math.max(0, rawBusinessTatDays - holdInfo.holdBusinessDays);
      otpEligible = !!dueDate;
      onTimeToPromise = otpEligible ? compareTatDates(completionDate, dueDate) <= 0 : null;
      daysLate = otpEligible && compareTatDates(completionDate, dueDate) > 0
        ? countTatBusinessDays(dueDate, completionDate, holidays)
        : 0;
    }

    const date = parseTatLocalDate(invoiceDate);
    const totalUnits = productDetails.reduce(function(total, item) { return total + Number(item.quantity || 0); }, 0);
    const totalRemakeUnits = productDetails.reduce(function(total, item) { return total + (item.isRemake ? Number(item.quantity || 0) : 0); }, 0);
    const departments = uniqueTatValues(productDetails.map(function(item) { return item.dimensions.department; })).sort();

    productDetails.forEach(function(item) {
      const dimensions = item.dimensions;
      factRows.push({
        year: date.getFullYear(),
        monthNum: date.getMonth() + 1,
        monthLabel: getTatMonthLabel(date.getMonth() + 1),
        monthStart: formatTatDate(new Date(date.getFullYear(), date.getMonth(), 1)),
        invoiceDate: invoiceDate,
        dayOfMonth: date.getDate(),
        caseId: caseId,
        caseNumber: caseNumber,
        customerId: customerId,
        customerName: customerName,
        customerActive: customerActive,
        productsDepartment: dimensions.department,
        departmentSource: dimensions.departmentSource,
        isMainDepartment: tatDashboardConfig.mainDepartments.indexOf(dimensions.department) >= 0,
        productsGroup: dimensions.group,
        productsCategory: dimensions.category,
        productsType: dimensions.type,
        productsDescription: dimensions.description,
        productId: dimensions.productId,
        units: item.quantity,
        soldUnits: item.quantity,
        remakeUnits: item.isRemake ? item.quantity : 0,
        isRemake: item.isRemake,
        remakeReason: item.remakeReason,
        tatEligible: tatEligible,
        tatIssue: invalidReason,
        dateIn: dateIn || '',
        shipmentDate: shipmentDate || '',
        completionDate: completionDate || '',
        usedInvoiceDateFallback: !shipmentDate,
        dueDate: dueDate || '',
        rawBusinessTatDays: rawBusinessTatDays,
        holdBusinessDays: holdInfo.holdBusinessDays,
        businessTatDays: businessTatDays,
        holdStartCount: holdInfo.holdStartCount,
        holdEndCount: holdInfo.holdEndCount,
        missingHoldEndCount: holdInfo.missingHoldEndCount,
        holdSource: holdInfo.source,
        otpEligible: otpEligible,
        onTimeToPromise: onTimeToPromise,
        daysLate: daysLate
      });
    });

    if (!tatEligible) {
      invalidCases.push({
        year: date.getFullYear(),
        monthNum: date.getMonth() + 1,
        monthStart: formatTatDate(new Date(date.getFullYear(), date.getMonth(), 1)),
        caseId: caseId,
        caseNumber: caseNumber,
        customerId: customerId,
        customerName: customerName,
        invoiceDate: invoiceDate,
        dateIn: dateIn || '',
        shipmentDate: shipmentDate || '',
        completionDate: completionDate || '',
        departments: departments.join(', '),
        soldUnits: totalUnits,
        remakeUnits: totalRemakeUnits,
        reason: invalidReason
      });
      stats.invalidCases++;
    } else {
      stats.eligibleCases++;
    }

    if (tatEligible && holdInfo.missingHoldEndCount > 0) {
      missingHoldEndCases.push({
        year: date.getFullYear(),
        monthNum: date.getMonth() + 1,
        monthStart: formatTatDate(new Date(date.getFullYear(), date.getMonth(), 1)),
        caseId: caseId,
        caseNumber: caseNumber,
        customerId: customerId,
        customerName: customerName,
        invoiceDate: invoiceDate,
        dateIn: dateIn,
        completionDate: completionDate,
        departments: departments.join(', '),
        soldUnits: totalUnits,
        remakeUnits: totalRemakeUnits,
        businessTatDays: businessTatDays,
        holdStartCount: holdInfo.holdStartCount,
        holdEndCount: holdInfo.holdEndCount,
        missingHoldEndCount: holdInfo.missingHoldEndCount,
        holdSource: holdInfo.source
      });
    }
    stats.totalIncludedCases++;
  });

  factRows.sort(function(a, b) {
    return Number(a.year) - Number(b.year) || Number(a.monthNum) - Number(b.monthNum) ||
      String(a.invoiceDate).localeCompare(String(b.invoiceDate)) ||
      String(a.productsDepartment).localeCompare(String(b.productsDepartment)) ||
      String(a.caseNumber).localeCompare(String(b.caseNumber));
  });

  return { factRows: factRows, invalidCases: invalidCases, missingHoldEndCases: missingHoldEndCases, stats: stats };
}

function getTatCaseExclusionReason(caseRow) {
  if (!caseRow) return 'missing case';
  if (tatFlagTrue(firstTatValue(caseRow, ['deleted','Deleted','isDeleted','IsDeleted']))) return 'deleted';
  const status = cleanTatText(firstTatValue(caseRow, ['status','Status','Cases_Status'])).toLowerCase();
  if (['estimate','bf invoice','sent for tryin','sent for try in','sent for try-in'].indexOf(status) >= 0) return status;
  if (tatFlagTrue(firstTatValue(caseRow, ['isAdjustment','IsAdjustment','Cases_IsAdjustment']))) return 'adjustment';
  if (tatFlagTrue(firstTatValue(caseRow, ['isDebitMemo','IsDebitMemo','Cases_IsDebitMemo']))) return 'debit memo';
  if (tatFlagTrue(firstTatValue(caseRow, ['isFC','IsFC','Cases_IsFC']))) return 'finance charge';
  if (cleanTatText(firstTatValue(caseRow, ['creditDebitReason','CreditDebitReason','Cases_CreditDebitReason']))) return 'credit/debit row';
  return '';
}

function calculateTatHoldInfo(caseRow, holidays, dateIn, completionDate) {
  const events = extractTatHistoryEvents(caseRow).filter(function(event) {
    return event.date && compareTatDates(event.date, dateIn) >= 0 && compareTatDates(event.date, completionDate) <= 0;
  }).sort(function(a, b) { return compareTatDates(a.date, b.date); });

  const starts = events.filter(function(event) { return event.type === 'start'; });
  const ends = events.filter(function(event) { return event.type === 'end'; });
  let holdBusinessDays = 0;
  let holdEndCount = 0;
  let missingHoldEndCount = 0;
  let endCursor = 0;

  starts.forEach(function(start, startIndex) {
    const nextStart = starts[startIndex + 1];
    while (endCursor < ends.length && compareTatDates(ends[endCursor].date, start.date) <= 0) endCursor++;
    const end = endCursor < ends.length && (!nextStart || compareTatDates(ends[endCursor].date, nextStart.date) < 0)
      ? ends[endCursor]
      : null;
    if (!end) {
      missingHoldEndCount++;
      return;
    }
    holdEndCount++;
    holdBusinessDays += countTatBusinessDays(start.date, end.date, holidays);
    endCursor++;
  });

  return {
    holdBusinessDays: holdBusinessDays,
    holdStartCount: starts.length,
    holdEndCount: holdEndCount,
    missingHoldEndCount: missingHoldEndCount,
    source: events.length ? 'MagicTouch API case history' : 'No hold history returned by API'
  };
}

function extractTatHistoryEvents(caseRow) {
  const arrays = [];
  ['caseLogs','CaseLogs','caseLog','CaseLog','logs','Logs','statusHistory','StatusHistory','caseHistory','CaseHistory','events','Events','auditTrail','AuditTrail'].forEach(function(name) {
    if (Array.isArray(caseRow && caseRow[name])) arrays.push(caseRow[name]);
  });
  const rows = arrays.reduce(function(all, current) { return all.concat(current); }, []);
  return rows.map(function(row) {
    const description = cleanTatText(firstTatValue(row, ['description','Description','message','Message','details','Details','change','Change']));
    const status = cleanTatText(firstTatValue(row, ['status','Status','newStatus','NewStatus','toStatus','ToStatus']));
    const priorStatus = cleanTatText(firstTatValue(row, ['previousStatus','PreviousStatus','oldStatus','OldStatus','fromStatus','FromStatus']));
    const date = normalizeTatDate(firstTatValue(row, ['date','Date','eventDate','EventDate','createdDate','CreatedDate','timestamp','Timestamp','modifyDate','ModifyDate']));
    const lower = (description + ' ' + status + ' ' + priorStatus).toLowerCase();
    let type = '';
    if (/to\s+["']?on hold/.test(lower) || (status.toLowerCase() === 'on hold' && priorStatus.toLowerCase() !== 'on hold')) type = 'start';
    if (/from\s+["']?on hold/.test(lower) || (priorStatus.toLowerCase() === 'on hold' && status.toLowerCase() !== 'on hold')) type = 'end';
    return { date: date, type: type, description: description };
  }).filter(function(row) { return row.date && row.type; });
}

function countTatBusinessDays(startDate, endDate, holidays) {
  const start = parseTatLocalDate(startDate);
  const end = parseTatLocalDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  while (cursor <= end) {
    const key = formatTatDate(cursor);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6 && !holidays[key]) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function getTatHolidaySet() {
  const set = {};
  tatDashboardConfig.hardcodedHolidays.forEach(function(date) { set[date] = true; });
  const raw = PropertiesService.getScriptProperties().getProperty(tatDashboardConfig.holidayOverrideProperty);
  if (!raw) return set;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      Object.keys(set).forEach(function(key) { delete set[key]; });
      parsed.forEach(function(date) {
        const normalized = normalizeTatDate(date);
        if (normalized) set[normalized] = true;
      });
    }
  } catch (error) {
    throw new Error('MT_TAT_HOLIDAYS_JSON must be a JSON array of YYYY-MM-DD dates. ' + (error.message || error));
  }
  return set;
}

function extractTatProductLines(caseRow) {
  const candidates = [caseRow && caseRow.caseProducts, caseRow && caseRow.CaseProducts, caseRow && caseRow.products, caseRow && caseRow.Products];
  for (let i = 0; i < candidates.length; i++) if (Array.isArray(candidates[i]) && candidates[i].length) return candidates[i];
  return [{ productID: 'CASE', description: 'Case level', quantity: 0, remake: '' }];
}

function getTatProductDimensions(caseRow, line, index, productMap) {
  const nested = firstTatObject(line, ['product','Product','productModel','ProductModel','productDto']);
  const records = [line, nested, caseRow];
  const productId = cleanTatText(firstTatValueFromRecords(records, ['productID','ProductID','productId','ProductId','CaseProducts_ProductID','Products_ProductID'])) || ('CASE-' + index);
  const catalog = productMap || {};
  const productMeta = catalog[productId] || catalog[String(productId).toUpperCase()] || {};
  const description = cleanTatText(productMeta.productName || firstTatValueFromRecords(records, ['invoiceDescription','description','Description','productDescription','Products_Description','Products_AltDescription'])) || productId;
  const apiDepartment = cleanTatText(firstTatValue(productMeta, ['department','Department']));
  const lineDepartment = cleanTatText(firstTatValueFromRecords(records, ['department','Department','productsDepartment','Products_Department','productDepartment']));
  const taxDepartment = cleanTatText(firstTatValueFromRecords(records, ['taxDepartment','taxDept','tax_department']));
  const rawDepartment = apiDepartment || lineDepartment || taxDepartment;
  const rawGroup = cleanTatText(productMeta.group || firstTatValueFromRecords(records, ['group','Group','productsGroup','Products_Group','productGroup','taxGroup']));
  let department = rawDepartment;
  if (typeof normalizeRemakeFactorDepartment === 'function') department = normalizeRemakeFactorDepartment(rawDepartment);
  if (!department && typeof inferRemakeFactorDepartmentFromGroupOrCode === 'function') department = inferRemakeFactorDepartmentFromGroupOrCode(rawGroup);
  if (!department && typeof inferRemakeFactorDepartmentFromProductName === 'function') department = inferRemakeFactorDepartmentFromProductName(description);
  department = department || 'Unassigned';
  let group = rawGroup;
  if (typeof normalizeRemakeFactorProductGroup === 'function') group = normalizeRemakeFactorProductGroup(rawGroup, department);
  return {
    productId: productId,
    description: description,
    department: department,
    departmentSource: apiDepartment ? 'MagicTouch Products.department' : (lineDepartment ? 'case product department fallback' : (taxDepartment ? 'taxDepartment fallback' : 'inferred fallback')),
    group: group || department || 'Unassigned',
    category: cleanTatText(productMeta.category || firstTatValueFromRecords(records, ['category','Category','productsCategory','Products_Category','taxCategory'])) || 'Unassigned',
    type: cleanTatText(productMeta.type || firstTatValueFromRecords(records, ['type','Type','productsType','Products_Type','productType'])) || 'Unassigned'
  };
}

function getTatLineQuantity(line) {
  const value = firstTatNumber(line, ['quantity','Quantity','CaseProducts_Quantity','qty','Qty']);
  return value === null ? 0 : value;
}

function isTatRemakeLine(line) {
  const value = firstTatValue(line, ['remake','Remake','caseProductsRemake','CaseProducts_Remake','isRemake','IsRemake']);
  const normalized = cleanTatText(value).toLowerCase();
  if (!normalized || ['false','no','n','0','none','not a remake'].indexOf(normalized) >= 0) return false;
  return true;
}

function getTatRemakeReason(line) {
  return cleanTatText(firstTatValue(line, [
    'remakeReason','RemakeReason','caseProductsRemakeReason','CaseProducts_RemakeReason','reason','Reason'
  ])) || 'Not specified';
}

function getTatCustomerActive(caseRow, customerInfo) {
  const mapped = firstTatValue(customerInfo, ['customerActive','active','Customers_Active']);
  if (mapped !== '' && mapped !== null && mapped !== undefined) return !tatFlagFalse(mapped);
  const direct = firstTatValue(caseRow, ['customerActive','Customers_Active','active']);
  if (direct !== '' && direct !== null && direct !== undefined) return !tatFlagFalse(direct);
  return true;
}

function tatDateInSameCutoffScope(invoiceDate, bounds) {
  const date = parseTatLocalDate(invoiceDate);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < bounds.firstYear || date.getFullYear() > bounds.currentYear) return false;
  const asOf = parseTatLocalDate(bounds.asOfDate);
  if (date.getMonth() < asOf.getMonth()) return true;
  if (date.getMonth() > asOf.getMonth()) return false;
  return date.getDate() <= asOf.getDate();
}


function createDailyTatDashboardTrigger() {
  deleteTatDashboardTriggers();
  ScriptApp.newTrigger('refreshTatDashboardCache').timeBased().everyDays(1).atHour(6).nearMinute(20).create();
  ScriptApp.newTrigger('rebuildTatDashboardBrowserReadyCache').timeBased().everyDays(1).atHour(7).nearMinute(5).create();
  return 'Daily TAT shard refresh and browser-ready cache triggers created.';
}

function deleteTatDashboardTriggers() {
  const handlers = ['refreshTatDashboardCache', 'rebuildTatDashboardBrowserReadyCache', 'runTatBrowserReadyRebuildFollowUp'];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(trigger);
  });
  return 'TAT cache triggers removed.';
}

function getTatCacheFolder() {
  const iterator = DriveApp.getFoldersByName(tatDashboardConfig.cacheFolderName);
  return iterator.hasNext() ? iterator.next() : DriveApp.createFolder(tatDashboardConfig.cacheFolderName);
}

function getTatIndexFile(createIfMissing) {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty(tatDashboardConfig.indexFileIdProperty) || '';
  if (savedId) {
    try {
      const saved = DriveApp.getFileById(savedId);
      if (saved.getName() === tatDashboardConfig.indexFileName) return saved;
    } catch (error) {}
  }
  const folder = getTatCacheFolder();
  const files = folder.getFilesByName(tatDashboardConfig.indexFileName);
  if (files.hasNext()) {
    const found = files.next();
    props.setProperty(tatDashboardConfig.indexFileIdProperty, found.getId());
    return found;
  }
  if (!createIfMissing) return null;
  const emptyIndex = {
    ok: false,
    cacheVersion: tatDashboardConfig.cacheVersion,
    storageMode: tatDashboardConfig.storageMode,
    sourceSystem: tatDashboardConfig.sourceSystem,
    generatedAtIso: '',
    generatedAtDisplay: '',
    message: 'TAT cache index created. Seed or convert the historical cache.',
    months: [],
    shards: {},
    totalRows: 0,
    rowCounts: {},
    config: {},
    warnings: []
  };
  const created = folder.createFile(tatDashboardConfig.indexFileName, JSON.stringify(emptyIndex), MimeType.PLAIN_TEXT);
  props.setProperty(tatDashboardConfig.indexFileIdProperty, created.getId());
  return created;
}

function readTatDashboardCacheIndex() {
  let file = getTatIndexFile(false);
  if (!file) {
    const relinked = relinkTatDashboardCacheFiles();
    file = relinked && relinked.indexFileId ? getTatIndexFile(false) : null;
  }
  if (!file) return null;
  try {
    const parsed = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    if (!parsed || parsed.storageMode !== tatDashboardConfig.storageMode) return null;
    parsed.fileId = file.getId();
    parsed.fileName = file.getName();
    parsed.fileUrl = file.getUrl();
    return parsed;
  } catch (error) {
    return {
      ok: false,
      cacheVersion: tatDashboardConfig.cacheVersion,
      storageMode: tatDashboardConfig.storageMode,
      message: 'TAT cache index could not be read: ' + compactTatError(error),
      months: [],
      shards: {},
      totalRows: 0,
      rowCounts: {},
      config: {},
      warnings: [compactTatError(error)]
    };
  }
}

function writeTatDashboardCacheIndex(index) {
  const file = getTatIndexFile(true);
  file.setContent(JSON.stringify(index));
  PropertiesService.getScriptProperties().setProperty(tatDashboardConfig.indexFileIdProperty, file.getId());
  index.fileId = file.getId();
  index.fileName = file.getName();
  index.fileUrl = file.getUrl();
  return index;
}

function getTatMonthKey(row) {
  const raw = cleanTatText(row && (row.monthStart || row.invoiceDate || ''));
  if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
  const year = Number(row && row.year || 0);
  const month = Number(row && row.monthNum || 0);
  return year && month ? year + '-' + String(month).padStart(2, '0') : 'unknown';
}

function groupTatRowsByMonth(rows) {
  const groups = {};
  (rows || []).forEach(function(row) {
    const monthKey = getTatMonthKey(row);
    if (!groups[monthKey]) groups[monthKey] = [];
    groups[monthKey].push(row);
  });
  return groups;
}

function listTatMonthKeys(startDate, endDate) {
  const start = parseTatLocalDate(startDate);
  const end = parseTatLocalDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const result = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    result.push(cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0'));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

function getTatShardFile(monthKey, existingFileId) {
  if (existingFileId) {
    try { return DriveApp.getFileById(existingFileId); } catch (error) {}
  }
  const folder = getTatCacheFolder();
  const fileName = tatDashboardConfig.shardPrefix + String(monthKey).replace(/[^0-9A-Za-z_-]/g, '_') + '.json';
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) return files.next();
  return folder.createFile(fileName, JSON.stringify({ ok: false, month: monthKey, factRows: [] }), MimeType.PLAIN_TEXT);
}

function writeTatDashboardShards(payload, options) {
  const requested = options || {};
  const existing = readTatDashboardCacheIndex() || {
    ok: false,
    cacheVersion: tatDashboardConfig.cacheVersion,
    storageMode: tatDashboardConfig.storageMode,
    months: [],
    shards: {},
    totalRows: 0,
    rowCounts: {},
    config: {},
    warnings: []
  };
  const factGroups = groupTatRowsByMonth(payload.factRows || []);
  const invalidGroups = groupTatRowsByMonth(payload.invalidCases || []);
  const holdGroups = groupTatRowsByMonth(payload.missingHoldEndCases || []);
  const explicitMonths = Array.isArray(requested.monthKeys) ? requested.monthKeys : [];
  const writtenMonths = uniqueTatValues(Object.keys(factGroups).concat(Object.keys(invalidGroups), Object.keys(holdGroups), explicitMonths)).sort();
  const shards = requested.replaceAll ? {} : Object.assign({}, existing.shards || {});
  const generatedAt = payload.generatedAtIso || new Date().toISOString();

  writtenMonths.forEach(function(monthKey) {
    const prior = shards[monthKey] || {};
    const shardFile = getTatShardFile(monthKey, prior.fileId || '');
    const shardPayload = {
      ok: true,
      cacheVersion: tatDashboardConfig.cacheVersion,
      storageMode: tatDashboardConfig.storageMode,
      month: monthKey,
      generatedAtIso: generatedAt,
      sourceSystem: payload.sourceSystem || tatDashboardConfig.sourceSystem,
      rowCount: (factGroups[monthKey] || []).length,
      factRows: factGroups[monthKey] || [],
      invalidCases: invalidGroups[monthKey] || [],
      missingHoldEndCases: holdGroups[monthKey] || []
    };
    shardFile.setContent(JSON.stringify(shardPayload));
    shards[monthKey] = {
      month: monthKey,
      fileId: shardFile.getId(),
      fileName: shardFile.getName(),
      fileUrl: shardFile.getUrl(),
      fileSizeBytes: Number(shardFile.getSize() || 0),
      rowCount: shardPayload.rowCount,
      invalidCaseCount: shardPayload.invalidCases.length,
      missingHoldEndCaseCount: shardPayload.missingHoldEndCases.length,
      generatedAtIso: generatedAt
    };
  });

  const months = Object.keys(shards).sort();
  const totalRows = months.reduce(function(total, monthKey) {
    return total + Number(shards[monthKey] && shards[monthKey].rowCount || 0);
  }, 0);
  const index = {
    ok: !!payload.ok,
    cacheVersion: tatDashboardConfig.cacheVersion,
    storageMode: tatDashboardConfig.storageMode,
    sourceSystem: payload.sourceSystem || tatDashboardConfig.sourceSystem,
    generatedAtIso: generatedAt,
    generatedAtDisplay: payload.generatedAtDisplay || '',
    refreshMode: payload.refreshMode || '',
    refreshStartDate: payload.refreshStartDate || '',
    message: 'TAT cache stored as monthly Drive JSON shards.',
    months: months,
    shards: shards,
    totalRows: totalRows,
    rowCounts: Object.assign({}, existing.rowCounts || {}, payload.rowCounts || {}, { factRows: totalRows }),
    config: Object.assign({}, existing.config || {}, payload.config || {}),
    warnings: payload.warnings || [],
    browserReadyCache: existing.browserReadyCache || null
  };
  return writeTatDashboardCacheIndex(index);
}

function relinkTatDashboardCacheFiles() {
  const folder = getTatCacheFolder();
  const props = PropertiesService.getScriptProperties();
  const result = { ok: true, folderId: folder.getId(), folderUrl: folder.getUrl(), indexFileId: '', browserReadyFileId: '', shardCount: 0, messages: [] };
  const indexFiles = folder.getFilesByName(tatDashboardConfig.indexFileName);
  if (indexFiles.hasNext()) {
    const indexFile = indexFiles.next();
    props.setProperty(tatDashboardConfig.indexFileIdProperty, indexFile.getId());
    result.indexFileId = indexFile.getId();
    try {
      const index = JSON.parse(indexFile.getBlob().getDataAsString('UTF-8'));
      const shards = index.shards || {};
      Object.keys(shards).forEach(function(monthKey) {
        const entry = shards[monthKey] || {};
        if (entry.fileId) {
          try { DriveApp.getFileById(entry.fileId); result.shardCount++; return; } catch (error) {}
        }
        const files = folder.getFilesByName(entry.fileName || (tatDashboardConfig.shardPrefix + monthKey + '.json'));
        if (files.hasNext()) {
          const file = files.next();
          entry.fileId = file.getId();
          entry.fileName = file.getName();
          entry.fileUrl = file.getUrl();
          entry.fileSizeBytes = Number(file.getSize() || 0);
          result.shardCount++;
        }
      });
      const browser = index.browserReadyCache || {};
      const browserFiles = folder.getFilesByName(browser.fileName || tatDashboardConfig.browserReadyFileName);
      if (browserFiles.hasNext()) {
        const file = browserFiles.next();
        browser.fileId = file.getId();
        browser.fileName = file.getName();
        browser.fileUrl = file.getUrl();
        browser.fileSizeBytes = Number(file.getSize() || 0);
        index.browserReadyCache = browser;
        props.setProperty(tatDashboardConfig.browserReadyFileIdProperty, file.getId());
        result.browserReadyFileId = file.getId();
      }
      indexFile.setContent(JSON.stringify(index));
    } catch (error) {
      result.ok = false;
      result.messages.push('Index relink warning: ' + compactTatError(error));
    }
  } else {
    result.ok = false;
    result.messages.push('No ' + tatDashboardConfig.indexFileName + ' file was found in the TAT Dashboard Cache folder.');
  }
  return result;
}

function getTatDashboardBrowserReadyMeta() {
  let index = readTatDashboardCacheIndex();
  if (!index) {
    relinkTatDashboardCacheFiles();
    index = readTatDashboardCacheIndex();
  }
  if (!index || !index.ok) {
    return { ok: false, servable: false, fresh: false, message: index && index.message ? index.message : 'No TAT shard index is available.' };
  }
  let browser = index.browserReadyCache || {};
  let fileId = browser.fileId || PropertiesService.getScriptProperties().getProperty(tatDashboardConfig.browserReadyFileIdProperty) || '';
  if (!fileId) {
    const relinked = relinkTatDashboardCacheFiles();
    if (relinked.browserReadyFileId) {
      index = readTatDashboardCacheIndex();
      browser = index && index.browserReadyCache ? index.browserReadyCache : {};
      fileId = browser.fileId || relinked.browserReadyFileId;
    }
  }
  if (!fileId) {
    return {
      ok: false,
      servable: false,
      fresh: false,
      cacheVersion: tatDashboardConfig.cacheVersion,
      schema: tatDashboardConfig.browserSchema,
      message: 'The TAT browser-ready gzip has not been created. Run the converter or rebuildTatDashboardBrowserReadyCache().'
    };
  }
  try {
    const file = DriveApp.getFileById(fileId);
    const sourceGeneratedAt = browser.sourceGeneratedAt || '';
    const currentSourceGeneratedAt = index.generatedAtIso || '';
    const stale = !!(sourceGeneratedAt && currentSourceGeneratedAt && sourceGeneratedAt !== currentSourceGeneratedAt);
    const fileSizeBytes = Number(file.getSize() || browser.fileSizeBytes || 0);
    return {
      ok: true,
      servable: true,
      fresh: !stale,
      stale: stale,
      cacheVersion: tatDashboardConfig.cacheVersion,
      schema: tatDashboardConfig.browserSchema,
      encoding: 'gzip-base64',
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      fileSizeBytes: fileSizeBytes,
      rowCount: Number(browser.rowCount || index.totalRows || 0),
      sourceGeneratedAt: sourceGeneratedAt,
      currentSourceGeneratedAt: currentSourceGeneratedAt,
      builtAt: browser.builtAt || '',
      generatedAtDisplay: index.generatedAtDisplay || '',
      cacheToken: [sourceGeneratedAt, browser.builtAt || '', fileSizeBytes, Number(browser.rowCount || index.totalRows || 0)].join(':'),
      message: stale ? 'The saved TAT browser cache is available while a newer optimized copy is rebuilt.' : 'TAT browser-ready cache is available.'
    };
  } catch (error) {
    return { ok: false, servable: false, fresh: false, message: 'The TAT browser-ready file could not be opened: ' + compactTatError(error) };
  }
}

function getTatDashboardBrowserReadyData() {
  const meta = getTatDashboardBrowserReadyMeta();
  if (!meta.ok) return meta;
  try {
    const file = DriveApp.getFileById(meta.fileId);
    return Object.assign({}, meta, {
      ok: true,
      payloadBase64: Utilities.base64Encode(file.getBlob().getBytes())
    });
  } catch (error) {
    return Object.assign({}, meta, { ok: false, payloadBase64: '', message: 'The TAT browser-ready payload could not be transferred: ' + compactTatError(error) });
  }
}

function buildTatBrowserPackedPayload() {
  const index = readTatDashboardCacheIndex();
  if (!index || !index.ok) throw new Error('No valid TAT shard index is available.');
  const dictionaries = {
    customerIds: [], customerNames: [], departments: [], groups: [], descriptions: [], productIds: [],
    caseIds: [], caseNumbers: [], issues: [], dates: [], reasons: []
  };
  const maps = {};
  Object.keys(dictionaries).forEach(function(key) { maps[key] = {}; });
  function dictIndex(key, value) {
    const text = cleanTatText(value);
    if (Object.prototype.hasOwnProperty.call(maps[key], text)) return maps[key][text];
    const indexValue = dictionaries[key].length;
    dictionaries[key].push(text);
    maps[key][text] = indexValue;
    return indexValue;
  }
  const packedRows = [];
  const errors = [];
  let sawQualityFlags = false;
  (index.months || Object.keys(index.shards || {})).slice().sort().forEach(function(monthKey) {
    const shard = index.shards && index.shards[monthKey] ? index.shards[monthKey] : null;
    if (!shard) return;
    let fileId = shard.fileId || '';
    if (!fileId) {
      const files = getTatCacheFolder().getFilesByName(shard.fileName || (tatDashboardConfig.shardPrefix + monthKey + '.json'));
      if (files.hasNext()) fileId = files.next().getId();
    }
    if (!fileId) { errors.push(monthKey + ': missing shard file'); return; }
    try {
      const parsed = JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8'));
      const rows = parsed && Array.isArray(parsed.factRows) ? parsed.factRows : [];
      rows.forEach(function(row) {
        if (row.tatEligible !== undefined || row.tatIssue !== undefined) sawQualityFlags = true;
        const tatEligible = row.tatEligible !== false && !cleanTatText(row.tatIssue);
        const tatDays = tatEligible && row.businessTatDays !== null && row.businessTatDays !== undefined
          ? Number(row.businessTatDays)
          : -1;
        const rawTatDays = tatEligible && row.rawBusinessTatDays !== null && row.rawBusinessTatDays !== undefined
          ? Number(row.rawBusinessTatDays)
          : -1;
        packedRows.push([
          Number(row.year || 0),
          Number(row.monthNum || 0),
          Number(row.dayOfMonth || 0),
          dictIndex('caseIds', row.caseId || ''),
          dictIndex('caseNumbers', row.caseNumber || ''),
          dictIndex('customerIds', row.customerId || ''),
          dictIndex('customerNames', row.customerName || ''),
          row.customerActive === false ? 0 : 1,
          dictIndex('departments', row.productsDepartment || 'Unassigned'),
          dictIndex('groups', row.productsGroup || 'Unassigned'),
          dictIndex('descriptions', row.productsDescription || row.productId || ''),
          dictIndex('productIds', row.productId || ''),
          Number(row.soldUnits !== undefined ? row.soldUnits : row.units || 0),
          Number(row.remakeUnits || 0),
          tatEligible ? 1 : 0,
          tatDays,
          row.otpEligible ? 1 : 0,
          row.onTimeToPromise === null || row.onTimeToPromise === undefined ? -1 : (row.onTimeToPromise ? 1 : 0),
          Number(row.daysLate || 0),
          dictIndex('issues', row.tatIssue || ''),
          dictIndex('dates', row.dateIn || ''),
          dictIndex('dates', row.completionDate || row.shipmentDate || row.invoiceDate || ''),
          dictIndex('dates', row.dueDate || ''),
          row.usedInvoiceDateFallback ? 1 : 0,
          Number(row.missingHoldEndCount || 0),
          Number(row.holdBusinessDays || 0),
          rawTatDays,
          dictIndex('reasons', row.remakeReason || (row.isRemake ? 'Not specified' : 'Not a remake'))
        ]);
      });
    } catch (error) {
      errors.push(monthKey + ': ' + compactTatError(error));
    }
  });
  if (errors.length) throw new Error('TAT browser-ready build stopped because shards could not be read: ' + errors.join(' | '));
  if (!sawQualityFlags && Number(index.rowCounts && index.rowCounts.invalidCases || 0) > 0) {
    throw new Error('The current TAT shards predate the data-quality schema. Rebuild them from the saved Colab checkpoints before creating the v3 browser cache.');
  }
  return {
    ok: true,
    cacheVersion: tatDashboardConfig.cacheVersion,
    schema: tatDashboardConfig.browserSchema,
    encoding: 'dictionary-packed-json',
    generatedAtIso: index.generatedAtIso || '',
    generatedAtDisplay: index.generatedAtDisplay || '',
    sourceSystem: index.sourceSystem || tatDashboardConfig.sourceSystem,
    builtAt: new Date().toISOString(),
    config: {
      currentYear: index.config && index.config.currentYear || '',
      priorYear: index.config && index.config.priorYear || '',
      firstYear: index.config && index.config.firstYear || '',
      defaultYears: index.config && index.config.defaultYears || [],
      mainDepartments: index.config && index.config.mainDepartments || tatDashboardConfig.mainDepartments.slice(),
      asOfDate: index.config && index.config.asOfDate || '',
      seededExternally: !!(index.config && index.config.seededExternally),
      includesDataQualityPopulation: true,
      totalUnitsDefinition: 'All included invoice product-line quantity, matching the Remake base population',
      tatMetricDefinition: 'TAT metrics use only rows with tatEligible = true'
    },
    dictionaries: dictionaries,
    rows: packedRows
  };
}

function rebuildTatDashboardBrowserReadyCache() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { ok: false, message: 'Another TAT browser-ready rebuild is already running.' };
  try {
    const payload = buildTatBrowserPackedPayload();
    const jsonText = JSON.stringify(payload);
    const gzipBlob = Utilities.gzip(Utilities.newBlob(jsonText, 'application/json', 'tat_browser_ready.json'), tatDashboardConfig.browserReadyFileName);
    const folder = getTatCacheFolder();
    const props = PropertiesService.getScriptProperties();
    const oldId = props.getProperty(tatDashboardConfig.browserReadyFileIdProperty) || '';
    const file = folder.createFile(gzipBlob);
    props.setProperty(tatDashboardConfig.browserReadyFileIdProperty, file.getId());
    const index = readTatDashboardCacheIndex();
    index.browserReadyCache = {
      ok: true,
      cacheVersion: tatDashboardConfig.cacheVersion,
      schema: tatDashboardConfig.browserSchema,
      encoding: 'gzip-base64',
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      fileSizeBytes: Number(file.getSize() || 0),
      rowCount: payload.rows.length,
      sourceGeneratedAt: payload.generatedAtIso || '',
      builtAt: payload.builtAt || ''
    };
    writeTatDashboardCacheIndex(index);
    if (oldId && oldId !== file.getId()) {
      try { DriveApp.getFileById(oldId).setTrashed(true); } catch (error) {}
    }
    return {
      ok: true,
      message: 'TAT browser-ready gzip rebuilt.',
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileSizeBytes: Number(file.getSize() || 0),
      sourceJsonBytes: jsonText.length,
      rowCount: payload.rows.length,
      sourceGeneratedAt: payload.generatedAtIso || '',
      builtAt: payload.builtAt || ''
    };
  } finally {
    lock.releaseLock();
  }
}

function runTatBrowserReadyRebuildFollowUp() {
  deleteTatBrowserReadyFollowUpTriggers();
  return rebuildTatDashboardBrowserReadyCache();
}

function deleteTatBrowserReadyFollowUpTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runTatBrowserReadyRebuildFollowUp') ScriptApp.deleteTrigger(trigger);
  });
}

function scheduleTatBrowserReadyRebuild() {
  const existing = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'runTatBrowserReadyRebuildFollowUp';
  });
  if (existing.length) return { ok: true, message: 'A TAT browser-ready rebuild is already scheduled.' };
  ScriptApp.newTrigger('runTatBrowserReadyRebuildFollowUp').timeBased().after(60 * 1000).create();
  return { ok: true, message: 'TAT browser-ready rebuild scheduled.' };
}

function ensureTatDashboardBrowserReadyCacheCurrent() {
  const meta = getTatDashboardBrowserReadyMeta();
  if (meta.ok && !meta.stale) return Object.assign({}, meta, { rebuildScheduled: false, message: 'The TAT browser-ready cache is current.' });
  const scheduled = scheduleTatBrowserReadyRebuild();
  return Object.assign({}, meta || {}, { ok: true, rebuildScheduled: true, message: scheduled.message });
}

function getTatDashboardStatus() {
  const index = readTatDashboardCacheIndex();
  const browser = getTatDashboardBrowserReadyMeta();
  return {
    ok: !!(index && index.ok),
    version: tatDashboardConfig.cacheVersion,
    storageMode: tatDashboardConfig.storageMode,
    folderName: tatDashboardConfig.cacheFolderName,
    indexFileId: index && index.fileId || '',
    indexFileUrl: index && index.fileUrl || '',
    generatedAtIso: index && index.generatedAtIso || '',
    generatedAtDisplay: index && index.generatedAtDisplay || '',
    months: index && index.months || [],
    shardCount: index && index.shards ? Object.keys(index.shards).length : 0,
    totalRows: index && index.totalRows || 0,
    rowCounts: index && index.rowCounts || {},
    config: index && index.config || {},
    browserReady: browser,
    legacySingleFileStillPresent: hasLegacyTatSingleFile()
  };
}

function testTatDashboardCacheShape() {
  const index = readTatDashboardCacheIndex();
  if (!index || !index.ok) throw new Error('No valid TAT shard index exists.');
  const firstMonth = (index.months || [])[0];
  if (!firstMonth) throw new Error('The TAT shard index contains no months.');
  const shard = index.shards[firstMonth];
  const file = DriveApp.getFileById(shard.fileId);
  const parsed = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  if (!Array.isArray(parsed.factRows)) throw new Error('The first TAT shard does not contain factRows.');
  return { ok: true, month: firstMonth, rowCount: parsed.factRows.length, browserReady: getTatDashboardBrowserReadyMeta() };
}

function debugTatDashboardCacheHealth() {
  return getTatDashboardStatus();
}

function hasLegacyTatSingleFile() {
  const folder = getTatCacheFolder();
  const files = folder.getFilesByName(tatDashboardConfig.legacyCacheFileName);
  return files.hasNext();
}

function compactTatError(error) {
  return cleanTatText(error && error.message ? error.message : error);
}

function assertTatApiDependencies() {
  const missing = [];
  if (typeof getRemakeFactorConfig !== 'function') missing.push('getRemakeFactorConfig');
  if (typeof authenticateRemakeFactorApi !== 'function') missing.push('authenticateRemakeFactorApi');
  if (typeof fetchRemakeFactorCases !== 'function') missing.push('fetchRemakeFactorCases');
  if (typeof fetchRemakeFactorCustomerMap !== 'function') missing.push('fetchRemakeFactorCustomerMap');
  if (typeof fetchRemakeFactorProductMap !== 'function') missing.push('fetchRemakeFactorProductMap');
  if (missing.length) throw new Error('Missing shared MagicTouch API functions from RemakeFactorCache.gs: ' + missing.join(', '));
}

function firstTatValue(obj, names) {
  if (!obj) return '';
  for (let i = 0; i < names.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(obj, names[i])) continue;
    const value = obj[names[i]];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
}
function firstTatObject(obj, names) {
  if (!obj) return {};
  for (let i = 0; i < names.length; i++) {
    const value = obj[names[i]];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return {};
}
function firstTatValueFromRecords(records, names) {
  for (let i = 0; i < records.length; i++) {
    const value = firstTatValue(records[i], names);
    if (value !== '') return value;
  }
  return '';
}
function firstTatNumber(obj, names) {
  if (!obj) return null;
  for (let i = 0; i < names.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(obj, names[i])) continue;
    const raw = obj[names[i]];
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    const value = Number(String(raw).replace(/[$,]/g, ''));
    if (Number.isFinite(value)) return value;
  }
  return null;
}
function cleanTatText(value) { return String(value === null || value === undefined ? '' : value).trim(); }
function tatFlagTrue(value) { return value === true || ['true','1','yes','y'].indexOf(cleanTatText(value).toLowerCase()) >= 0; }
function tatFlagFalse(value) { return value === false || ['false','0','no','n'].indexOf(cleanTatText(value).toLowerCase()) >= 0; }
function normalizeTatDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[1] + '-' + match[2] + '-' + match[3];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatTatDate(date);
}
function parseTatLocalDate(value) {
  const normalized = normalizeTatDate(value);
  if (!normalized) return new Date(NaN);
  const parts = normalized.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function compareTatDates(a, b) {
  const left = normalizeTatDate(a);
  const right = normalizeTatDate(b);
  if (!left || !right) return 0;
  return left < right ? -1 : (left > right ? 1 : 0);
}
function formatTatDate(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
function getTatMonthLabel(month) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month) - 1] || ''; }
function uniqueTatValues(values) {
  const seen = {};
  return (values || []).filter(function(value) {
    const key = cleanTatText(value);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}



/**
 * One-time department migration for existing TAT monthly shards.
 * Fetches the MagicTouch product catalog once, rewrites fact-row departments,
 * re-rolls case-level department labels used by quality tables, and schedules a
 * browser-ready gzip rebuild. No case pull is performed.
 */
function migrateTatDepartmentsFromProductsApi() {
  assertTatApiDependencies();
  const props = PropertiesService.getScriptProperties();
  const config = getRemakeFactorConfig(props, { fetchProductMap: true, useProductLookup: false });
  const token = authenticateRemakeFactorApi(config);
  const productMap = fetchRemakeFactorProductMap(config, token) || {};
  const productMapUpper = {};
  Object.keys(productMap).forEach(function(productId) {
    productMapUpper[String(productId).toUpperCase()] = productMap[productId];
  });
  const index = readTatDashboardCacheIndex();
  if (!index || !index.ok) throw new Error('No valid TAT monthly shard index is available.');
  let scannedRows = 0;
  let mappedRows = 0;
  let changedRows = 0;
  const unmapped = {};
  const generatedAt = new Date().toISOString();

  (index.months || Object.keys(index.shards || {})).slice().sort().forEach(function(monthKey) {
    const shard = index.shards && index.shards[monthKey] ? index.shards[monthKey] : null;
    if (!shard || !shard.fileId) return;
    const file = DriveApp.getFileById(shard.fileId);
    const parsed = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    const rows = parsed && Array.isArray(parsed.factRows) ? parsed.factRows : [];
    const caseDepartments = {};
    rows.forEach(function(row) {
      scannedRows++;
      const productId = cleanTatText(row.productId || '');
      const product = productMap[productId] || productMapUpper[productId.toUpperCase()] || null;
      const apiDepartment = cleanTatText(product && product.department || '');
      let normalized = apiDepartment;
      if (normalized && typeof normalizeRemakeFactorDepartment === 'function') normalized = normalizeRemakeFactorDepartment(normalized);
      if (!normalized) {
        if (productId) unmapped[productId] = true;
      } else {
        mappedRows++;
        if (cleanTatText(row.productsDepartment) !== normalized || cleanTatText(row.departmentSource) !== 'MagicTouch Products.department') {
          row.productsDepartment = normalized;
          row.departmentSource = 'MagicTouch Products.department';
          row.isMainDepartment = tatDashboardConfig.mainDepartments.indexOf(normalized) >= 0;
          if (typeof normalizeRemakeFactorProductGroup === 'function') row.productsGroup = normalizeRemakeFactorProductGroup(row.productsGroup || '', normalized);
          changedRows++;
        }
      }
      const caseKey = cleanTatText(row.caseId || row.caseNumber || '');
      if (caseKey) {
        if (!caseDepartments[caseKey]) caseDepartments[caseKey] = {};
        caseDepartments[caseKey][row.productsDepartment || 'Unassigned'] = true;
      }
    });
    function rerollDepartments(items) {
      (items || []).forEach(function(item) {
        const caseKey = cleanTatText(item.caseId || item.caseNumber || '');
        const values = caseDepartments[caseKey] ? Object.keys(caseDepartments[caseKey]).sort() : [];
        if (values.length) item.departments = values.join(', ');
      });
    }
    rerollDepartments(parsed.invalidCases);
    rerollDepartments(parsed.missingHoldEndCases);
    parsed.factRows = rows;
    parsed.generatedAtIso = generatedAt;
    parsed.departmentSource = 'MagicTouch Products.department';
    file.setContent(JSON.stringify(parsed));
    shard.generatedAtIso = generatedAt;
    shard.departmentSource = 'MagicTouch Products.department';
    shard.fileSizeBytes = Number(file.getSize() || 0);
  });

  index.generatedAtIso = generatedAt;
  index.message = 'TAT departments migrated from MagicTouch Products.department.';
  index.config = Object.assign({}, index.config || {}, {
    departmentSource: 'MagicTouch Products.department',
    departmentMigrationAt: generatedAt
  });
  index.rowCounts = Object.assign({}, index.rowCounts || {}, {
    departmentMigrationScannedRows: scannedRows,
    departmentMigrationMappedRows: mappedRows,
    departmentMigrationChangedRows: changedRows,
    departmentMigrationUnmappedProductCount: Object.keys(unmapped).length
  });
  writeTatDashboardCacheIndex(index);
  const scheduled = scheduleTatBrowserReadyRebuild();
  return {
    ok: true,
    source: 'MagicTouch /api/Products/QueryProducts department',
    scannedRows: scannedRows,
    mappedRows: mappedRows,
    changedRows: changedRows,
    unmappedProductCount: Object.keys(unmapped).length,
    browserReadyRebuildScheduled: !!(scheduled && scheduled.ok),
    message: 'TAT monthly shards now use Products.department. The browser-ready cache rebuild was scheduled.'
  };
}
