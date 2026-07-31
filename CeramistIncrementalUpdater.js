/**
 * Ceramist incremental maintenance
 * Version: v7.8.0
 * Last confirmed: 2026-07-31
 *
 * Durable model:
 *   1. A one-time Colab/Python seed creates the complete historical sidecar.
 *   2. The normal Remake cache refresh replaces only its configured open month(s).
 *   3. This updater replaces only those same month(s) in the Ceramist sidecar.
 *   4. Closed historical rows and previously confirmed CRM chain records are reused.
 *
 * This file does not perform a full historical walk. The canonical legacy entry
 * point refreshCeramistCaseLevelResponsibilityNightlyV75 delegates here so the
 * existing nightly trigger and dashboard Refresh button keep one stable server API.
 */

const ceramistIncrementalVersionV780 = 'CeramistIncremental v7.8.0';
const ceramistIncrementalCacheVersionV780 = 'CeramistRemakeCache v0.6.0';
const ceramistIncrementalResponsibilityVersionV780 = 'case-level-v7.8.0';
const ceramistIncrementalMaintenanceModelV780 = 'historical-seed-plus-open-month-upsert-v7.8.0';
const ceramistHistoricalSeedVersionV780 = 'ceramist-colab-seed-v1.0.0';
const ceramistIncrementalChainLookupVersionV780 = 'crm-remakeCaseID-seed-plus-incremental-v7.8.0';
const ceramistIncrementalMaxApiCallsPropertyV780 = 'MT_CERAMIST_INCREMENTAL_MAX_API_CALLS';
const ceramistIncrementalDefaultMaxApiCallsV780 = 25;
const ceramistIncrementalMaxChainDepthV780 = 8;
const ceramistIncrementalLockWaitMsV780 = 30000;

/**
 * Stable entry point for the nightly trigger and the dashboard's combined
 * Remake + Ceramist refresh flow.
 */
function refreshCeramistIncrementalNightlyV780(options) {
  const opts = options || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(ceramistIncrementalLockWaitMsV780)) {
    throw new Error('Another Ceramist incremental refresh is already running.');
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const fileId = String(props.getProperty(ceramistRemakeCacheFileIdPropertyV7) || '').trim();
    if (!fileId) {
      throw new Error('Missing Script Property: ' + ceramistRemakeCacheFileIdPropertyV7);
    }

    const file = DriveApp.getFileById(fileId);
    const payload = ceramistIncrementalReadJsonFileV780(file);
    if (!payload || payload.ok !== true || !Array.isArray(payload.rows)) {
      throw new Error('The Ceramist Drive cache is missing, invalid, or not ready.');
    }

    const seedVersion = String(payload.historicalSeedVersion || '').trim();
    if (seedVersion !== ceramistHistoricalSeedVersionV780) {
      return {
        ok: false,
        requiresHistoricalSeed: true,
        version: ceramistIncrementalVersionV780,
        historicalSeedVersion: seedVersion,
        requiredHistoricalSeedVersion: ceramistHistoricalSeedVersionV780,
        rowsPreserved: payload.rows.length,
        message: 'The complete Colab historical seed must be installed before incremental Ceramist maintenance can write the cache.'
      };
    }

    const remakeSource = ceramistIncrementalReadRemakeOpenMonthsV780(opts, props);
    if (!remakeSource.ok) return remakeSource;

    const refreshedMonths = remakeSource.months;
    const monthSet = {};
    refreshedMonths.forEach(function(month) { monthSet[month] = true; });

    const existingRows = payload.rows.filter(function(row) {
      return row && typeof row === 'object';
    }).map(function(row) {
      return Object.assign({}, row);
    });
    const preservedRows = existingRows.filter(function(row) {
      return !monthSet[ceramistIncrementalMonthV780(row)];
    });
    const previousOpenRows = existingRows.filter(function(row) {
      return !!monthSet[ceramistIncrementalMonthV780(row)];
    });

    const openRows = remakeSource.rows.filter(function(row) {
      return row && typeof row === 'object';
    });
    const openRemakeRows = openRows.filter(ceramistIncrementalIsRemakeV780);

    const chainIndex = ceramistIncrementalBuildChainIndexV780(payload.chainIndex, existingRows, openRows);
    const apiContext = ceramistIncrementalCreateApiContextV780(props, opts, chainIndex);
    const previousBuckets = ceramistIncrementalBuildRowBucketsV780(previousOpenRows);
    const rebuiltRows = [];

    openRemakeRows.forEach(function(mainRow) {
      const previousRow = ceramistIncrementalTakePreviousRowV780(previousBuckets, mainRow);
      const nextRow = typeof ceramistBuildCompletePopulationRowV77_ === 'function'
        ? ceramistBuildCompletePopulationRowV77_(mainRow, previousRow)
        : ceramistIncrementalBuildRowV780(mainRow, previousRow);

      nextRow.populationVersion = ceramistHistoricalSeedVersionV780;
      nextRow.historicalSeedVersion = ceramistHistoricalSeedVersionV780;
      nextRow.maintenanceModel = ceramistIncrementalMaintenanceModelV780;
      nextRow.incrementalVersion = ceramistIncrementalVersionV780;
      nextRow.incrementalUpdatedAt = new Date().toISOString();
      nextRow.incrementalSourceMonth = ceramistIncrementalMonthV780(mainRow);
      rebuiltRows.push(nextRow);
    });

    const rowsByCase = ceramistIncrementalRowsByCaseV780(rebuiltRows);
    const chainStats = {
      incrementalCases: Object.keys(rowsByCase).length,
      incrementalReusedConfirmedChains: 0,
      incrementalResolvedChains: 0,
      incrementalConfirmedUnlinkedCases: 0,
      incrementalDeferredChains: 0,
      incrementalChainErrors: 0
    };

    Object.keys(rowsByCase).sort(function(a, b) {
      return Number(b) - Number(a);
    }).forEach(function(caseNumber) {
      const caseRows = rowsByCase[caseNumber];
      const reusable = ceramistIncrementalReusableChainV780(caseRows);
      const chain = reusable || ceramistIncrementalResolveChainV780(caseRows[0], chainIndex, apiContext);

      if (reusable) chainStats.incrementalReusedConfirmedChains++;
      if (chain.status === 'resolved') chainStats.incrementalResolvedChains++;
      else if (chain.status === 'unlinked') chainStats.incrementalConfirmedUnlinkedCases++;
      else if (chain.status === 'deferred') chainStats.incrementalDeferredChains++;
      else chainStats.incrementalChainErrors++;

      caseRows.forEach(function(row) {
        ceramistIncrementalApplyChainV780(row, chain);
        ceramistIncrementalHydrateInvoiceNotesV780(row, chainIndex);
      });
    });

    // BigQuery is queried only for the current/root/previous cases represented by
    // the refreshed open month rows, never for the complete historical sidecar.
    ceramistApplyCaseLevelResponsibilityV74_(rebuiltRows);

    // Only unresolved open-month cases may need fresh note evidence. Historical
    // note evidence comes from the Colab seed; this limited fallback is for new
    // or changed chains in the refreshed month(s).
    ceramistIncrementalHydrateMissingNoteEvidenceV780(rebuiltRows, chainIndex, apiContext);

    // Map raw task-user IDs and apply the existing strict invoice-note backup.
    // This is idempotent; getCeramistRemakeAnalysisData applies the same display
    // mapping to a copy during reads.
    ceramistApplyTaskUserBadgeNamesV72_(rebuiltRows);

    const mergedRows = preservedRows.concat(rebuiltRows);
    const refreshedAt = new Date().toISOString();
    const responsibilityStats = ceramistBuildResponsibilityStatsV75_(mergedRows);

    payload.ok = true;
    payload.version = ceramistIncrementalCacheVersionV780;
    payload.responsibilityVersion = ceramistIncrementalResponsibilityVersionV780;
    payload.populationVersion = ceramistHistoricalSeedVersionV780;
    payload.historicalSeedVersion = ceramistHistoricalSeedVersionV780;
    payload.maintenanceVersion = ceramistIncrementalVersionV780;
    payload.maintenanceModel = ceramistIncrementalMaintenanceModelV780;
    payload.caseLevelRefreshedAt = refreshedAt;
    payload.source = 'One-time Colab historical seed + Remake open-month incremental upsert + BigQuery CERAMICS responsibility';
    payload.message = 'Ceramist cache updated only for the same open month(s) refreshed by the Remake cache.';
    payload.rows = mergedRows;
    payload.chainIndex = {
      version: ceramistIncrementalChainLookupVersionV780,
      updatedAt: refreshedAt,
      byCaseId: chainIndex
    };
    payload.stats = Object.assign({}, payload.stats || {}, responsibilityStats, chainStats, {
      historicalSeedVersion: ceramistHistoricalSeedVersionV780,
      maintenanceVersion: ceramistIncrementalVersionV780,
      maintenanceModel: ceramistIncrementalMaintenanceModelV780,
      incrementalRefreshedMonths: refreshedMonths,
      incrementalPreviousOpenRows: previousOpenRows.length,
      incrementalRemakeSourceRows: openRows.length,
      incrementalRemakeRows: openRemakeRows.length,
      incrementalRebuiltRows: rebuiltRows.length,
      incrementalPreservedClosedRows: preservedRows.length,
      incrementalMergedRows: mergedRows.length,
      incrementalApiCalls: apiContext.calls,
      incrementalApiCallLimit: apiContext.maxCalls,
      incrementalApiErrors: apiContext.errors.slice(0, 25),
      remakeCacheGeneratedAt: remakeSource.generatedAt || '',
      remakeCacheIndexFileId: remakeSource.indexFileId || ''
    });

    file.setContent(JSON.stringify(payload));

    return {
      ok: true,
      version: ceramistIncrementalVersionV780,
      historicalSeedVersion: ceramistHistoricalSeedVersionV780,
      maintenanceModel: ceramistIncrementalMaintenanceModelV780,
      fileId: fileId,
      refreshedAt: refreshedAt,
      refreshedMonths: refreshedMonths,
      previousOpenRows: previousOpenRows.length,
      rebuiltRows: rebuiltRows.length,
      preservedClosedRows: preservedRows.length,
      mergedRows: mergedRows.length,
      apiCalls: apiContext.calls,
      apiCallLimit: apiContext.maxCalls,
      chainStats: chainStats,
      stats: payload.stats
    };
  } finally {
    lock.releaseLock();
  }
}

function refreshCeramistIncrementalNowV780() {
  return refreshCeramistIncrementalNightlyV780({ manual: true });
}

function getCeramistSeedConfigurationV780() {
  const props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    version: ceramistIncrementalVersionV780,
    requiredHistoricalSeedVersion: ceramistHistoricalSeedVersionV780,
    ceramistCacheFileId: String(props.getProperty(ceramistRemakeCacheFileIdPropertyV7) || '').trim(),
    remakeCacheIndexFileId: String(props.getProperty(remakeFactorCacheIndexFileIdPropertyV118) || '').trim(),
    taskUserBadgeSpreadsheetId: ceramistTaskUserBadgeSpreadsheetIdV71,
    bigQueryProjectId: ceramistProfileConfig.projectId,
    bigQueryDatasetId: ceramistProfileConfig.datasetId,
    bigQueryTaskTable: ceramistProfileConfig.taskTable,
    incrementalMaxApiCalls: Number(props.getProperty(ceramistIncrementalMaxApiCallsPropertyV780) || ceramistIncrementalDefaultMaxApiCallsV780),
    message: 'These non-secret IDs can be copied into the one-time Colab historical seed script.'
  };
}

function getCeramistIncrementalHealthV780() {
  const props = PropertiesService.getScriptProperties();
  const fileId = String(props.getProperty(ceramistRemakeCacheFileIdPropertyV7) || '').trim();
  if (!fileId) return { ok: false, version: ceramistIncrementalVersionV780, message: 'Ceramist cache file ID is not configured.' };
  try {
    const payload = ceramistIncrementalReadJsonFileV780(DriveApp.getFileById(fileId));
    return {
      ok: !!(payload && payload.ok),
      version: ceramistIncrementalVersionV780,
      cacheVersion: payload && payload.version || '',
      historicalSeedVersion: payload && payload.historicalSeedVersion || '',
      maintenanceVersion: payload && payload.maintenanceVersion || '',
      maintenanceModel: payload && payload.maintenanceModel || '',
      caseLevelRefreshedAt: payload && payload.caseLevelRefreshedAt || '',
      rowCount: payload && Array.isArray(payload.rows) ? payload.rows.length : 0,
      stats: payload && payload.stats || {}
    };
  } catch (error) {
    return { ok: false, version: ceramistIncrementalVersionV780, message: error && error.message ? error.message : String(error) };
  }
}

function ceramistIncrementalReadRemakeOpenMonthsV780(options, props) {
  const index = readRemakeFactorCacheIndexV118();
  if (!index || index.ok !== true || !index.shards) {
    return {
      ok: false,
      version: ceramistIncrementalVersionV780,
      message: index && index.message ? index.message : 'The Remake monthly cache index is not ready.'
    };
  }

  const requested = Array.isArray(options.months) ? options.months : [];
  const indexMonths = (index.dateRange && index.dateRange.refreshedMonths) ||
    (index.stats && index.stats.refreshedMonths) || [];
  let months = requested.length ? requested : (Array.isArray(indexMonths) ? indexMonths : []);

  if (!months.length) {
    const openMonths = Math.max(1, Number(
      options.openRefreshMonths ||
      props.getProperty('MT_REMAKE_OPEN_REFRESH_MONTHS') ||
      1
    ));
    const now = new Date();
    months = [];
    for (let offset = openMonths - 1; offset >= 0; offset--) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      months.push(date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'));
    }
  }

  months = Array.from(new Set(months.map(function(value) {
    return String(value || '').slice(0, 7);
  }).filter(function(value) {
    return /^\d{4}-\d{2}$/.test(value);
  }))).sort();

  const rows = [];
  const errors = [];
  months.forEach(function(month) {
    const shard = index.shards[month];
    if (!shard || !shard.fileId) {
      errors.push(month + ': Remake monthly shard is missing.');
      return;
    }
    try {
      const parsed = ceramistIncrementalReadJsonFileV780(DriveApp.getFileById(shard.fileId));
      const shardRows = parsed && (Array.isArray(parsed.rows) ? parsed.rows : parsed.detailRows);
      if (!Array.isArray(shardRows)) throw new Error('Shard rows are missing.');
      Array.prototype.push.apply(rows, shardRows);
    } catch (error) {
      errors.push(month + ': ' + (error && error.message ? error.message : String(error)));
    }
  });

  if (errors.length) {
    return {
      ok: false,
      version: ceramistIncrementalVersionV780,
      months: months,
      errors: errors,
      message: 'Ceramist incremental refresh stopped because one or more Remake open-month shards could not be read.'
    };
  }

  return {
    ok: true,
    months: months,
    rows: rows,
    generatedAt: index.generatedAt || '',
    indexFileId: String(props.getProperty(remakeFactorCacheIndexFileIdPropertyV118) || '').trim()
  };
}

function ceramistIncrementalReadJsonFileV780(file) {
  const text = file.getBlob().getDataAsString('UTF-8');
  return text ? JSON.parse(text) : null;
}

function ceramistIncrementalMonthV780(row) {
  const value = String(row && (row.month || row.invoiceMonth || row.invoiceDate || row.Cases_InvoiceDate || '') || '').trim();
  if (/^\d{4}-\d{2}/.test(value)) return value.slice(0, 7);
  const parsed = value ? new Date(value) : null;
  if (!parsed || isNaN(parsed.getTime())) return '';
  return parsed.getFullYear() + '-' + String(parsed.getMonth() + 1).padStart(2, '0');
}

function ceramistIncrementalIsRemakeV780(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.isRemake === true) return true;
  return /^y(es)?$|^true$|^1$|^r$|^remake$/i.test(String(row.remakeFlag || row.remake || row.remakeValue || '').trim());
}

function ceramistIncrementalCaseNumberV780(row) {
  const values = [row && row.currentCaseNumber, row && row.remakeCaseNumber, row && row.caseNumber, row && row.caseNo, row && row.Cases_CaseNumber];
  for (let index = 0; index < values.length; index++) {
    const numberValue = Number(values[index] || 0);
    if (Number.isFinite(numberValue) && numberValue > 0) return String(Math.trunc(numberValue));
  }
  return '';
}

function ceramistIncrementalCaseIdV780(row) {
  return String(row && (row.caseId || row.caseID || row.currentCaseId || row.currentCaseID) || '').trim();
}

function ceramistIncrementalRemakeCaseIdV780(row) {
  return String(row && (row.remakeCaseId || row.remakeCaseID || row.RemakeCaseID) || '').trim();
}

function ceramistIncrementalProductV780(row) {
  return String(row && (
    row.currentProductId || row.currentProductID || row.remakeProductId || row.remakeProductID ||
    row.productId || row.productID || row.CaseProducts_ProductID || row.productKey || row.productName
  ) || '').trim().toUpperCase();
}

function ceramistIncrementalLineV780(row) {
  return String(row && (
    row.caseProductLineId || row.currentCaseProductLineId || row.currentCaseProductLineID ||
    row.caseProductId || row.currentCaseProductId || row.currentCaseProductID ||
    row.productLineId || row.lineId || row.lineID
  ) || '').trim();
}

function ceramistIncrementalBroadKeyV780(row) {
  const caseNumber = ceramistIncrementalCaseNumberV780(row);
  const product = ceramistIncrementalProductV780(row);
  return caseNumber && product ? caseNumber + '\u0001' + product : '';
}

function ceramistIncrementalExactKeyV780(row) {
  const broad = ceramistIncrementalBroadKeyV780(row);
  return broad ? broad + '\u0001' + ceramistIncrementalLineV780(row) : '';
}

function ceramistIncrementalBuildRowBucketsV780(rows) {
  const result = { exact: {}, broad: {}, claimed: {} };
  (rows || []).forEach(function(row, index) {
    const exact = ceramistIncrementalExactKeyV780(row);
    const broad = ceramistIncrementalBroadKeyV780(row);
    if (exact) {
      if (!result.exact[exact]) result.exact[exact] = [];
      result.exact[exact].push({ index: index, row: row });
    }
    if (broad) {
      if (!result.broad[broad]) result.broad[broad] = [];
      result.broad[broad].push({ index: index, row: row });
    }
  });
  return result;
}

function ceramistIncrementalTakePreviousRowV780(buckets, row) {
  function take(items) {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (buckets.claimed[item.index]) continue;
      buckets.claimed[item.index] = true;
      return item.row;
    }
    return null;
  }
  return take(buckets.exact[ceramistIncrementalExactKeyV780(row)] || []) ||
    take(buckets.broad[ceramistIncrementalBroadKeyV780(row)] || []);
}

function ceramistIncrementalBuildRowV780(mainRow, previousRow) {
  const row = previousRow ? Object.assign({}, previousRow) : {};
  const caseNumber = ceramistIncrementalCaseNumberV780(mainRow);
  row.month = ceramistIncrementalMonthV780(mainRow);
  row.year = Number(mainRow.year || (row.month ? row.month.slice(0, 4) : 0)) || '';
  row.invoiceDate = String(mainRow.invoiceDate || row.invoiceDate || '').trim();
  row.caseId = ceramistIncrementalCaseIdV780(mainRow) || ceramistIncrementalCaseIdV780(row);
  row.caseNumber = caseNumber;
  row.currentCaseNumber = caseNumber;
  row.remakeCaseNumber = caseNumber;
  row.remakeCaseId = ceramistIncrementalRemakeCaseIdV780(mainRow) || ceramistIncrementalRemakeCaseIdV780(row);
  row.remakeCaseID = row.remakeCaseId;
  row.caseProductLineId = ceramistIncrementalLineV780(mainRow) || ceramistIncrementalLineV780(row);
  row.customerId = String(mainRow.customerId || mainRow.customerKey || row.customerId || '').trim();
  row.customerName = String(mainRow.customerName || mainRow.customerDisplayName || row.customerName || row.customerId || 'Unknown customer').trim();
  row.customerDisplayName = String(mainRow.customerDisplayName || mainRow.customerDisplayLabel || row.customerDisplayName || row.customerName).trim();
  row.practiceName = String(mainRow.practiceName || row.practiceName || '').trim();
  row.customerActive = mainRow.customerActive === false ? false : true;
  row.department = String(mainRow.department || row.department || 'Unassigned').trim() || 'Unassigned';
  row.productId = String(mainRow.productId || mainRow.productKey || row.productId || '').trim();
  row.currentProductId = row.productId;
  row.productKey = String(mainRow.productKey || row.productKey || row.productId || mainRow.productName || '').trim();
  row.productName = String(mainRow.productName || row.productName || row.productId || 'Unknown product').trim();
  row.productGroup = String(mainRow.productGroup || row.productGroup || 'Unassigned').trim() || 'Unassigned';
  row.remakeReason = String(mainRow.remakeReason || row.remakeReason || 'Not specified').trim() || 'Not specified';
  row.quantity = Number(mainRow.quantity !== undefined ? mainRow.quantity : (mainRow.units !== undefined ? mainRow.units : row.quantity || 0)) || 0;
  row.units = row.quantity;
  row.isRemake = true;
  row.remakeUnits = Number(mainRow.remakeUnits !== undefined ? mainRow.remakeUnits : row.quantity) || 0;
  row.remakeDiscount = Math.abs(Number(mainRow.remakeDiscount !== undefined ? mainRow.remakeDiscount : row.remakeDiscount || 0) || 0);
  row.currentProductCeramicsEligible = true;
  row.currentProductCeramicsEligibilityReason = 'Included from the complete Remake Factor population';
  return row;
}

function ceramistIncrementalRowsByCaseV780(rows) {
  const result = {};
  (rows || []).forEach(function(row) {
    const caseNumber = ceramistIncrementalCaseNumberV780(row);
    if (!caseNumber) return;
    if (!result[caseNumber]) result[caseNumber] = [];
    result[caseNumber].push(row);
  });
  return result;
}

function ceramistIncrementalBuildChainIndexV780(source, sidecarRows, remakeRows) {
  const sourceMap = source && source.byCaseId && typeof source.byCaseId === 'object' ? source.byCaseId : (source && typeof source === 'object' ? source : {});
  const index = {};
  Object.keys(sourceMap).forEach(function(key) {
    const record = sourceMap[key];
    if (record && typeof record === 'object') index[String(key).toLowerCase()] = Object.assign({}, record);
  });

  (sidecarRows || []).forEach(function(row) {
    const currentId = ceramistIncrementalCaseIdV780(row);
    const currentNumber = ceramistIncrementalCaseNumberV780(row);
    const ids = Array.isArray(row.chainCaseIds) ? row.chainCaseIds.slice() : [];
    const numbers = Array.isArray(row.chainCaseNumbers) ? row.chainCaseNumbers.slice() : [];
    if (currentId) {
      ceramistIncrementalMergeChainRecordV780(index, {
        caseId: currentId,
        caseNumber: currentNumber,
        remakeCaseId: ids[0] || ceramistIncrementalRemakeCaseIdV780(row),
        terminalConfirmed: row.populationChainStatus === 'unlinked' && row.populationChainConfirmed === true,
        checkedAt: row.populationChainCheckedAt || '',
        invoiceNote: row.currentInvoiceNote || '',
        invoiceNoteTechNumbers: row.currentInvoiceNoteTechNumbers || []
      });
    }
    ids.forEach(function(caseId, position) {
      ceramistIncrementalMergeChainRecordV780(index, {
        caseId: caseId,
        caseNumber: numbers[position] || '',
        remakeCaseId: ids[position + 1] || '',
        terminalConfirmed: position === ids.length - 1 && row.populationChainConfirmed === true,
        checkedAt: row.populationChainCheckedAt || '',
        invoiceNote: position === 0 ? (row.previousInvoiceNote || '') : (position === ids.length - 1 ? (row.rootInvoiceNote || '') : ''),
        invoiceNoteTechNumbers: position === 0 ? (row.previousInvoiceNoteTechNumbers || []) : (position === ids.length - 1 ? (row.rootInvoiceNoteTechNumbers || []) : [])
      });
    });
  });

  (remakeRows || []).forEach(function(row) {
    const caseId = ceramistIncrementalCaseIdV780(row);
    if (!caseId) return;
    ceramistIncrementalMergeChainRecordV780(index, {
      caseId: caseId,
      caseNumber: ceramistIncrementalCaseNumberV780(row),
      remakeCaseId: ceramistIncrementalRemakeCaseIdV780(row),
      terminalConfirmed: false,
      checkedAt: ''
    });
  });

  return index;
}

function ceramistIncrementalMergeChainRecordV780(index, incoming) {
  const caseId = String(incoming && incoming.caseId || '').trim();
  if (!caseId) return;
  const key = caseId.toLowerCase();
  const current = index[key] || {};
  const incomingNext = String(incoming.remakeCaseId || '').trim();
  const currentNext = String(current.remakeCaseId || '').trim();
  const incomingTerminal = incoming.terminalConfirmed === true;
  const currentTerminal = current.terminalConfirmed === true;
  index[key] = Object.assign({}, current, incoming, {
    caseId: caseId,
    caseNumber: String(incoming.caseNumber || current.caseNumber || '').trim(),
    remakeCaseId: incomingNext || currentNext,
    terminalConfirmed: incomingTerminal || (currentTerminal && !incomingNext),
    invoiceNote: String(incoming.invoiceNote || current.invoiceNote || '').trim(),
    invoiceNoteTechNumbers: ceramistIncrementalUniqueStringsV780(incoming.invoiceNoteTechNumbers || current.invoiceNoteTechNumbers || [])
  });
}

function ceramistIncrementalCreateApiContextV780(props, options, chainIndex) {
  return {
    props: props,
    config: null,
    token: '',
    calls: 0,
    maxCalls: Math.max(0, Number(options.maxApiCalls || props.getProperty(ceramistIncrementalMaxApiCallsPropertyV780) || ceramistIncrementalDefaultMaxApiCallsV780)),
    errors: [],
    chainIndex: chainIndex
  };
}

function ceramistIncrementalEnsureApiV780(context) {
  if (context.config && context.token) return true;
  if (context.calls >= context.maxCalls) return false;
  try {
    context.config = getRemakeFactorConfig(context.props, {
      quickRefresh: true,
      lookbackMonths: 1,
      pageSize: 1,
      maxPages: 1,
      maxDetailFetches: 0,
      detailStrategy: 'none',
      chunkByMonth: false,
      fetchProductMap: false,
      fetchCustomerMap: false
    });
    context.token = authenticateRemakeFactorApi(context.config);
    return true;
  } catch (error) {
    context.errors.push('Authentication: ' + (error && error.message ? error.message : String(error)));
    return false;
  }
}

function ceramistIncrementalFetchCaseV780(caseId, context, forceRefresh) {
  const cleanId = String(caseId || '').trim();
  if (!cleanId) return { status: 'error', record: null, reason: 'Missing CRM caseID.' };
  const key = cleanId.toLowerCase();
  const existing = context.chainIndex[key];
  if (!forceRefresh && existing && existing.caseNumber && (existing.remakeCaseId || existing.terminalConfirmed === true)) {
    return { status: 'ok', record: existing };
  }
  if (context.calls >= context.maxCalls) {
    return { status: 'deferred', record: existing || null, reason: 'Incremental API call limit reached.' };
  }
  if (!ceramistIncrementalEnsureApiV780(context)) {
    return context.calls >= context.maxCalls
      ? { status: 'deferred', record: existing || null, reason: 'Incremental API call limit reached.' }
      : { status: 'error', record: existing || null, reason: 'MagicTouch authentication failed.' };
  }
  try {
    context.calls++;
    const detail = fetchRemakeFactorCaseDetail(context.config, context.token, cleanId) || {};
    const hasLinkField = Object.keys(detail).some(function(name) { return /^remakeCaseID$/i.test(name); });
    const record = {
      caseId: cleanId,
      caseNumber: String(detail.caseNumber || detail.caseNo || '').trim(),
      remakeCaseId: String(detail.remakeCaseID || detail.remakeCaseId || detail.RemakeCaseID || '').trim(),
      terminalConfirmed: hasLinkField && !String(detail.remakeCaseID || detail.remakeCaseId || detail.RemakeCaseID || '').trim(),
      checkedAt: new Date().toISOString(),
      invoiceNote: ceramistIncrementalExtractInvoiceNoteV780(detail).note,
      invoiceNoteTechNumbers: ceramistIncrementalExtractInvoiceNoteV780(detail).techNumbers
    };
    if (!record.caseNumber) {
      return { status: 'error', record: record, reason: 'CRM case detail did not contain a numeric case number.' };
    }
    if (!hasLinkField) {
      return { status: 'error', record: record, reason: 'CRM case detail did not expose remakeCaseID.' };
    }
    ceramistIncrementalMergeChainRecordV780(context.chainIndex, record);
    return { status: 'ok', record: context.chainIndex[key] };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    context.errors.push(cleanId + ': ' + message);
    return { status: 'error', record: existing || null, reason: message };
  }
}

function ceramistIncrementalReusableChainV780(caseRows) {
  const row = (caseRows || []).find(function(item) {
    return item && item.populationChainConfirmed === true &&
      (Number(item.chainDepth || 0) > 0 || String(item.populationChainStatus || '') === 'unlinked');
  });
  if (!row) return null;
  const currentNext = ceramistIncrementalRemakeCaseIdV780(row);
  const ids = Array.isArray(row.chainCaseIds) ? row.chainCaseIds.slice() : [];
  if (currentNext && ids.length && String(ids[0]).toLowerCase() !== currentNext.toLowerCase()) return null;
  if (!currentNext && String(row.populationChainStatus || '') !== 'unlinked') return null;
  return {
    status: Number(row.chainDepth || 0) > 0 ? 'resolved' : 'unlinked',
    confirmed: true,
    chainDepth: Number(row.chainDepth || 0),
    previousCaseNumber: row.previousCaseNumber || '',
    rootCaseNumber: row.rootCaseNumber || '',
    previousCaseId: row.previousCaseId || '',
    rootCaseId: row.rootCaseId || '',
    chainCaseNumbers: Array.isArray(row.chainCaseNumbers) ? row.chainCaseNumbers.slice() : [],
    chainCaseIds: ids,
    reason: 'Confirmed historical seed chain reused.',
    checkedAt: row.populationChainCheckedAt || '',
    lookupVersion: ceramistIncrementalChainLookupVersionV780
  };
}

function ceramistIncrementalResolveChainV780(row, chainIndex, apiContext) {
  const currentId = ceramistIncrementalCaseIdV780(row);
  let nextId = ceramistIncrementalRemakeCaseIdV780(row);
  if (!currentId) return ceramistIncrementalEmptyChainV780('error', 'The current remake row has no CRM caseID.', false);

  if (!nextId) {
    const currentFetch = ceramistIncrementalFetchCaseV780(currentId, apiContext);
    if (currentFetch.status !== 'ok') {
      return ceramistIncrementalEmptyChainV780(currentFetch.status, currentFetch.reason, false);
    }
    nextId = String(currentFetch.record.remakeCaseId || '').trim();
    if (!nextId && currentFetch.record.terminalConfirmed === true) {
      return ceramistIncrementalEmptyChainV780('unlinked', 'CRM case detail explicitly confirmed a blank remakeCaseID.', true);
    }
  }

  const seen = {};
  const caseIds = [];
  const caseNumbers = [];
  let previousCaseId = '';
  let previousCaseNumber = '';
  let rootCaseId = '';
  let rootCaseNumber = '';

  while (nextId && caseIds.length < ceramistIncrementalMaxChainDepthV780) {
    const cleanId = String(nextId || '').trim();
    const key = cleanId.toLowerCase();
    if (!cleanId || seen[key]) {
      return ceramistIncrementalChainResultV780('error', false, caseIds, caseNumbers, 'A remakeCaseID cycle was detected.');
    }
    seen[key] = true;

    const fetched = ceramistIncrementalFetchCaseV780(cleanId, apiContext);
    if (fetched.status !== 'ok') {
      return ceramistIncrementalChainResultV780(fetched.status, false, caseIds, caseNumbers, fetched.reason);
    }
    const record = fetched.record || {};
    const numberValue = Number(record.caseNumber || 0);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return ceramistIncrementalChainResultV780('error', false, caseIds, caseNumbers, 'A linked CRM case did not contain a numeric case number.');
    }

    caseIds.push(cleanId);
    caseNumbers.push(Math.trunc(numberValue));
    if (!previousCaseId) {
      previousCaseId = cleanId;
      previousCaseNumber = Math.trunc(numberValue);
    }
    rootCaseId = cleanId;
    rootCaseNumber = Math.trunc(numberValue);

    nextId = String(record.remakeCaseId || '').trim();
    if (!nextId) {
      if (record.terminalConfirmed !== true) {
        return ceramistIncrementalChainResultV780('error', false, caseIds, caseNumbers, 'The terminal CRM case has not been explicitly confirmed.');
      }
      break;
    }
  }

  if (nextId) return ceramistIncrementalChainResultV780('error', false, caseIds, caseNumbers, 'The remake chain exceeded the safe depth limit.');
  if (!caseIds.length) return ceramistIncrementalEmptyChainV780('unlinked', 'CRM case detail explicitly confirmed no remakeCaseID.', true);

  return {
    status: 'resolved',
    confirmed: true,
    chainDepth: caseIds.length,
    previousCaseNumber: previousCaseNumber,
    rootCaseNumber: rootCaseNumber,
    previousCaseId: previousCaseId,
    rootCaseId: rootCaseId,
    chainCaseNumbers: caseNumbers,
    chainCaseIds: caseIds,
    reason: 'CRM remakeCaseID chain resolved from the historical seed/index with limited incremental fallback calls.',
    checkedAt: new Date().toISOString(),
    lookupVersion: ceramistIncrementalChainLookupVersionV780
  };
}

function ceramistIncrementalChainResultV780(status, confirmed, caseIds, caseNumbers, reason) {
  return {
    status: status,
    confirmed: confirmed === true,
    chainDepth: caseIds.length,
    previousCaseNumber: caseNumbers[0] || '',
    rootCaseNumber: caseNumbers.length ? caseNumbers[caseNumbers.length - 1] : '',
    previousCaseId: caseIds[0] || '',
    rootCaseId: caseIds.length ? caseIds[caseIds.length - 1] : '',
    chainCaseNumbers: caseNumbers.slice(),
    chainCaseIds: caseIds.slice(),
    reason: reason || '',
    checkedAt: new Date().toISOString(),
    lookupVersion: ceramistIncrementalChainLookupVersionV780
  };
}

function ceramistIncrementalEmptyChainV780(status, reason, confirmed) {
  return ceramistIncrementalChainResultV780(status, confirmed, [], [], reason);
}

function ceramistIncrementalApplyChainV780(row, chain) {
  row.chainDepth = Number(chain && chain.chainDepth || 0);
  row.multiChain = row.chainDepth > 1;
  row.previousCaseNumber = chain && chain.previousCaseNumber || '';
  row.rootCaseNumber = chain && chain.rootCaseNumber || '';
  row.previousCaseId = chain && chain.previousCaseId || '';
  row.rootCaseId = chain && chain.rootCaseId || '';
  row.chainCaseNumbers = chain && Array.isArray(chain.chainCaseNumbers) ? chain.chainCaseNumbers.slice() : [];
  row.chainCaseIds = chain && Array.isArray(chain.chainCaseIds) ? chain.chainCaseIds.slice() : [];
  row.populationChainStatus = chain && chain.status || 'error';
  row.populationChainConfirmed = !!(chain && chain.confirmed === true);
  row.populationChainLookupVersion = ceramistIncrementalChainLookupVersionV780;
  row.populationChainCheckedAt = chain && chain.checkedAt || new Date().toISOString();
  row.populationChainReason = chain && chain.reason || '';
}



function ceramistIncrementalHydrateMissingNoteEvidenceV780(rows, chainIndex, apiContext) {
  const requested = {};
  (rows || []).forEach(function(row) {
    if (!row || String(row.attributionStatus || '') === 'attributed') return;
    [String(row.previousCaseId || '').trim(), String(row.rootCaseId || '').trim()].forEach(function(caseId) {
      if (!caseId) return;
      const record = chainIndex[caseId.toLowerCase()] || {};
      const hasEvidence = String(record.invoiceNote || '').trim() ||
        (Array.isArray(record.invoiceNoteTechNumbers) && record.invoiceNoteTechNumbers.length);
      if (!hasEvidence) requested[caseId] = true;
    });
  });

  Object.keys(requested).forEach(function(caseId) {
    const fetched = ceramistIncrementalFetchCaseV780(caseId, apiContext, true);
    if (fetched.status !== 'ok') return;
  });

  (rows || []).forEach(function(row) {
    ceramistIncrementalHydrateInvoiceNotesV780(row, chainIndex);
  });
}

function ceramistIncrementalHydrateInvoiceNotesV780(row, chainIndex) {
  const pairs = [
    ['current', ceramistIncrementalCaseIdV780(row)],
    ['previous', String(row.previousCaseId || '').trim()],
    ['root', String(row.rootCaseId || '').trim()]
  ];
  pairs.forEach(function(pair) {
    const prefix = pair[0];
    const id = pair[1];
    if (!id) return;
    const record = chainIndex[id.toLowerCase()];
    if (!record) return;
    const noteField = prefix + 'InvoiceNote';
    const numbersField = prefix + 'InvoiceNoteTechNumbers';
    if (!String(row[noteField] || '').trim() && record.invoiceNote) row[noteField] = record.invoiceNote;
    if ((!Array.isArray(row[numbersField]) || !row[numbersField].length) && Array.isArray(record.invoiceNoteTechNumbers)) {
      row[numbersField] = record.invoiceNoteTechNumbers.slice();
    }
  });
}

function ceramistIncrementalExtractInvoiceNoteV780(detail) {
  const notes = Array.isArray(detail && detail.notes) ? detail.notes : [];
  const hits = [];
  const numbers = [];
  notes.forEach(function(note) {
    const value = note && typeof note === 'object' ? note : { text: note };
    const label = [value.type, value.noteType, value.subject, value.title, value.category].map(function(item) {
      return String(item || '').trim();
    }).filter(Boolean).join(' | ');
    const text = [value.note, value.notes, value.text, value.body, value.description, value.message, value.comments].map(function(item) {
      return String(item || '').trim();
    }).filter(Boolean).join(' ');
    const combined = (label ? label + ' | ' : '') + text;
    if (!combined) return;

    const found = [];
    const patterns = [
      /\btech(?:nician)?(?:\s*(?:number|no\.?|#))?\s*[:\-]?\s*(\d{1,6})\b/gi,
      /\bcompleted\s+by\s+(?:tech(?:nician)?\s*)?#?\s*(\d{1,6})\b/gi
    ];
    patterns.forEach(function(pattern) {
      let match;
      while ((match = pattern.exec(combined)) !== null) found.push(match[1]);
    });
    if (!found.length) return;
    if (!/invoice|complete|completed|tech/i.test(combined)) return;
    hits.push(combined);
    Array.prototype.push.apply(numbers, found);
  });
  return {
    note: hits.join('\n').slice(0, 4000),
    techNumbers: ceramistIncrementalUniqueStringsV780(numbers)
  };
}

function ceramistIncrementalUniqueStringsV780(values) {
  const source = Array.isArray(values) ? values : (values === null || values === undefined || values === '' ? [] : [values]);
  const seen = {};
  return source.map(function(value) { return String(value || '').trim(); }).filter(function(value) {
    if (!value || seen[value]) return false;
    seen[value] = true;
    return true;
  });
}
