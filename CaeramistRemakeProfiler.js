/**
 * Ceramist Remake Analysis - BigQuery profiler
 *
 * File: CeramistRemakeProfiler.gs
 * Version: 7.8.2
 * Last confirmed: 2026-07-31
 * Purpose: CERAMICS attribution diagnostics plus a lightweight Drive-cache reader for the dashboard preview.
 *
 * Schema correction retained from v3:
 *   CaseProducts_TeethNumbers belongs to products_all, not tasks_all.
 *   The verified tasks_all attribution grain available here is
 *   case + product + task sequence. No teeth-level attribution is inferred.
 *
 * Logging correction in v4:
 *   profileCeramistCompactAttribution() returns only the decision-ready
 *   sections so Apps Script does not truncate the result.
 *
 * CRM remake-link correction in v6:
 *   profileRemakeLinkedCase() checks CaseModel.remakeCaseID against one known
 *   remake chain. Generic linkedToCaseID fields are shown only for comparison;
 *   they are a separate relationship and are not used for remake attribution.
 *
 * The profile* functions are diagnostic-only and never change dashboard data.
 * getCeramistRemakeAnalysisData() is now a read-only Drive-cache endpoint. It
 * never queries BigQuery during a dashboard load. A daily time trigger runs
 * refreshCeramistCaseLevelResponsibilityNightlyV75() after the nightly BigQuery
 * refresh and writes the case-level responsibility result into the separate
 * Ceramist Drive cache once per day. v7.6 adds a lightweight metadata endpoint
 * so the browser can reuse its IndexedDB worker cache without downloading and
 * parsing the 7 MB Drive payload on every page refresh. v7.7 reconciles the
 * Ceramist sidecar to the complete durable Remake Factor population before
 * calculating responsibility. Missing cases are no longer silently excluded.
 * v7.8 delegates normal maintenance to a historical-seed plus open-month upsert workflow. The complete historical chain is built once in Colab; nightly and dashboard refreshes replace only the same open month(s) refreshed by the Remake cache. v7.8.1 keeps current remake cases whose CRM detail omits remakeCaseID in the complete population as Unattributed with an accurate unconfirmed-link reason instead of treating them as a fatal chain error.
 *
 * v7.8.2 restores direct case-detail InvoiceNotes aliases and, when an
 * invoice note lists multiple tech numbers, selects the worker only when
 * exactly one mapped technician is a Ceramist.
 *
 * Confirmed attribution rule in v7:
 *   UPPER(TRIM(CaseTasks_Task)) = CERAMICS
 *   CaseTasks_Sequence is diagnostic metadata only and never filters eligibility.
 *   ceramist = CaseTasks_CompletedBy
 *
 * Confirmed remake-chain rule in v7.4:
 *   - Responsibility is resolved at the prior/root CASE level.
 *   - The product on the new remake does not need to match the prior product.
 *   - One distinct completed CERAMICS worker on the case resolves responsibility.
 *   - Multiple distinct completed CERAMICS workers remain unattributed/review.
 *   - Default to the root worker; on a multi-chain remake, use the immediately
 *     previous worker when that single worker differs from the root worker.
 *   - When the root has no completed CERAMICS worker but the previous case has
 *     one, attribute to the previous worker and retain a root-missing flag.
 */

const ceramistRemakeCacheFileIdPropertyV7 = 'MT_CERAMIST_REMAKE_CACHE_FILE_ID';
const ceramistRemakeCacheVersionV7 = 'CeramistRemakeCache v0.6.0';
const ceramistTaskUserBadgeSpreadsheetIdV71 = '1XrJctG1-0RGhKCV6w2jK4esoaahmc7Ji7MjQhZo-nBY';
const ceramistTaskUserBadgeSheetNameV71 = 'Task User Badges';
const ceramistTaskUserBadgeCacheKeyV72 = 'ceramistTaskUserBadgeLookup.v72';
const ceramistLegacyTechSheetNameV72 = 'Tech Numbers';
const ceramistLookupAlertRecipientV72 = 'summer@caldentalarts.com';
const ceramistLookupAlertCacheKeyV72 = 'ceramistTaskUserBadgeAlert.v72';
const ceramistNightlyRefreshFunctionV75 = 'refreshCeramistCaseLevelResponsibilityNightlyV75';
const ceramistNightlyRefreshHourV75 = 22;
const ceramistNightlyRefreshMinuteV75 = 45;
const ceramistNightlyRefreshTimeZoneV75 = 'America/Los_Angeles';
const ceramistNightlyRefreshLockWaitMsV75 = 30000;
const ceramistResponsibilityVersionV75 = 'case-level-v7.8.2';
const ceramistBrowserCacheMetaVersionV76 = 'ceramist-browser-meta-v7.6.0';
const ceramistPopulationVersionV77 = 'complete-remake-population-v7.7.1';
const ceramistPopulationChainLookupVersionV771 = 'crm-remakeCaseID-confirmed-v7.7.1';
const ceramistPopulationMaxApiCallsPropertyV77 = 'MT_CERAMIST_POPULATION_MAX_API_CALLS';
const ceramistPopulationDefaultMaxApiCallsV77 = 160;
const ceramistPopulationMaxChainDepthV77 = 8;

const ceramistProfileConfig = {
  projectId: 'customerprofiles',
  datasetId: 'retention_data',
  taskTable: 'tasks_all',
  productTable: 'products_all',
  location: 'US',
  lookbackDays: 365,
  taskCode: 'CERAMICS',
  sampleLimit: 12
};

/**
 * Lightweight browser-cache metadata endpoint.
 *
 * This checks Drive modified timestamps and file size only. It does not read or
 * parse the Ceramist JSON payload, query BigQuery, or rewrite any cache. The
 * frontend compares cacheToken with the token saved in IndexedDB and downloads
 * the full worker payload only when the nightly cache or badge lookup changed.
 */
function getCeramistRemakeAnalysisCacheMeta() {
  const props = PropertiesService.getScriptProperties();
  const fileId = String(props.getProperty(ceramistRemakeCacheFileIdPropertyV7) || '').trim();
  if (!fileId) {
    return {
      ok: false,
      metaVersion: ceramistBrowserCacheMetaVersionV76,
      cacheToken: '',
      driveUpdatedAt: '',
      badgeUpdatedAt: '',
      fileSizeBytes: 0,
      message: 'Ceramist analysis preview is not configured.'
    };
  }

  try {
    const file = DriveApp.getFileById(fileId);
    return Object.assign({
      ok: true,
      metaVersion: ceramistBrowserCacheMetaVersionV76,
      version: ceramistRemakeCacheVersionV7,
      message: ''
    }, ceramistBuildBrowserCacheMetaV76_(file));
  } catch (error) {
    return {
      ok: false,
      metaVersion: ceramistBrowserCacheMetaVersionV76,
      cacheToken: '',
      driveUpdatedAt: '',
      badgeUpdatedAt: '',
      fileSizeBytes: 0,
      message: 'Ceramist cache metadata read failed: ' + (error && error.message ? error.message : String(error))
    };
  }
}

function ceramistBuildBrowserCacheMetaV76_(cacheFile) {
  const driveUpdated = cacheFile.getLastUpdated();
  const driveUpdatedMs = driveUpdated ? driveUpdated.getTime() : 0;
  const fileSizeBytes = Number(cacheFile.getSize() || 0);
  let badgeUpdated = null;
  let badgeUpdatedMs = 0;
  try {
    const badgeFile = DriveApp.getFileById(ceramistTaskUserBadgeSpreadsheetIdV71);
    badgeUpdated = badgeFile.getLastUpdated();
    badgeUpdatedMs = badgeUpdated ? badgeUpdated.getTime() : 0;
  } catch (ignore) {}

  return {
    cacheToken: [driveUpdatedMs, fileSizeBytes, badgeUpdatedMs].join(':'),
    driveUpdatedAt: driveUpdated ? driveUpdated.toISOString() : '',
    badgeUpdatedAt: badgeUpdated ? badgeUpdated.toISOString() : '',
    fileSizeBytes: fileSizeBytes
  };
}

/**
 * Dashboard endpoint.
 *
 * This function intentionally reads only the separate Drive cache. It does not
 * query BigQuery and it does not rewrite the cache. The nightly trigger updates
 * case-level CERAMICS responsibility once per day after the BigQuery refresh.
 */
function getCeramistRemakeAnalysisData() {
  const props = PropertiesService.getScriptProperties();
  const fileId = String(props.getProperty(ceramistRemakeCacheFileIdPropertyV7) || '').trim();
  if (!fileId) {
    return {
      ok: false,
      version: ceramistRemakeCacheVersionV7,
      generatedAt: '',
      caseLevelRefreshedAt: '',
      cacheToken: '',
      driveUpdatedAt: '',
      badgeUpdatedAt: '',
      rows: [],
      message: 'Ceramist analysis preview is not configured. Set MT_CERAMIST_REMAKE_CACHE_FILE_ID after running the one-time Colab builder.'
    };
  }

  try {
    const file = DriveApp.getFileById(fileId);
    const browserMeta = ceramistBuildBrowserCacheMetaV76_(file);
    const text = file.getBlob().getDataAsString('UTF-8');
    const payload = text ? JSON.parse(text) : null;
    if (!payload || payload.ok !== true || !Array.isArray(payload.rows)) {
      return {
        ok: false,
        version: ceramistRemakeCacheVersionV7,
        generatedAt: payload && payload.generatedAt || '',
        caseLevelRefreshedAt: payload && payload.caseLevelRefreshedAt || '',
        cacheToken: browserMeta.cacheToken || '',
        driveUpdatedAt: browserMeta.driveUpdatedAt || '',
        badgeUpdatedAt: browserMeta.badgeUpdatedAt || '',
        rows: [],
        message: payload && payload.message || 'The Ceramist analysis cache is not ready.'
      };
    }

    const rows = payload.rows.map(function(row) {
      return row && typeof row === 'object' ? Object.assign({}, row) : row;
    });

    return {
      ok: true,
      version: payload.version || ceramistRemakeCacheVersionV7,
      responsibilityVersion: payload.responsibilityVersion || '',
      populationVersion: payload.populationVersion || '',
      generatedAt: payload.generatedAt || '',
      caseLevelRefreshedAt: payload.caseLevelRefreshedAt || '',
      cacheToken: browserMeta.cacheToken || '',
      driveUpdatedAt: browserMeta.driveUpdatedAt || '',
      badgeUpdatedAt: browserMeta.badgeUpdatedAt || '',
      source: payload.source || 'Nightly Ceramist attribution cache',
      message: payload.message || '',
      stats: payload.stats || {},
      rows: ceramistApplyTaskUserBadgeNamesV72_(rows)
    };
  } catch (error) {
    return {
      ok: false,
      version: ceramistRemakeCacheVersionV7,
      generatedAt: '',
      caseLevelRefreshedAt: '',
      cacheToken: '',
      driveUpdatedAt: '',
      badgeUpdatedAt: '',
      rows: [],
      message: 'Ceramist analysis cache read failed: ' + (error && error.message ? error.message : String(error))
    };
  }
}

/**
 * Nightly cache refresh.
 *
 * This is the only dashboard function in this file that refreshes case-level
 * responsibility from BigQuery. The installed trigger runs around 10:45 PM
 * Pacific, after the user's nightly BigQuery upload. Apps Script time triggers
 * are approximate and can run within a short window around the requested time.
 */
function refreshCeramistCaseLevelResponsibilityNightlyV75() {
  return refreshCeramistIncrementalNightlyV780();
}

/**
 * Run once from the Apps Script editor to install the daily trigger.
 * Existing triggers for this same handler are removed first, so running the
 * installer again does not create duplicates.
 */
function installCeramistNightlyRefreshTriggerV75() {
  removeCeramistNightlyRefreshTriggerV75();

  const trigger = ScriptApp.newTrigger(ceramistNightlyRefreshFunctionV75)
    .timeBased()
    .atHour(ceramistNightlyRefreshHourV75)
    .nearMinute(ceramistNightlyRefreshMinuteV75)
    .everyDays(1)
    .inTimezone(ceramistNightlyRefreshTimeZoneV75)
    .create();

  return {
    ok: true,
    handler: trigger.getHandlerFunction(),
    timeZone: ceramistNightlyRefreshTimeZoneV75,
    approximateTime: '10:45 PM daily'
  };
}

function removeCeramistNightlyRefreshTriggerV75() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() !== ceramistNightlyRefreshFunctionV75) return;
    ScriptApp.deleteTrigger(trigger);
    removed++;
  });
  return { ok: true, removed: removed };
}

function ceramistBuildResponsibilityStatsV75_(rows) {
  const result = {
    caseLevelRows: 0,
    caseLevelAttributedRows: 0,
    caseLevelUnattributedRows: 0,
    caseLevelUnlinkedRows: 0,
    caseLevelMultipleWorkerRows: 0,
    caseLevelNoWorkerRows: 0,
    caseLevelPopulationPendingRows: 0,
    caseLevelPopulationErrorRows: 0,
    caseLevelAttributionPct: 0
  };

  (rows || []).forEach(function(row) {
    if (!row || typeof row !== 'object') return;
    result.caseLevelRows++;
    if (String(row.attributionStatus || '') === 'attributed') {
      result.caseLevelAttributedRows++;
    } else {
      result.caseLevelUnattributedRows++;
    }

    const basis = String(row.attributionBasis || '');
    if (basis === 'unlinked') result.caseLevelUnlinkedRows++;
    if (basis === 'multiple_case_level_workers') result.caseLevelMultipleWorkerRows++;
    if (basis === 'no_case_level_ceramics_worker') result.caseLevelNoWorkerRows++;
    if (basis === 'population_chain_pending') result.caseLevelPopulationPendingRows++;
    if (basis === 'population_chain_error') result.caseLevelPopulationErrorRows++;
  });

  result.caseLevelAttributionPct = result.caseLevelRows
    ? Math.round((result.caseLevelAttributedRows / result.caseLevelRows) * 10000) / 100
    : 0;
  return result;
}




/**
 * v7.7 complete-population reconciliation.
 *
 * The legacy Drive sidecar was originally built from a narrower eligible-row
 * population. This function makes the durable Remake Factor monthly shards the
 * population source of truth, reuses any existing rich sidecar row, and creates
 * a minimal row for every remaining remake product. Missing CRM remake links are
 * resolved incrementally through the documented API with a configurable call
 * cap so the nightly job remains safe and repeatable.
 */
function ceramistReconcileCompleteRemakePopulationV77_(existingRows) {
  const existing = Array.isArray(existingRows) ? existingRows.filter(function(row) {
    return row && typeof row === 'object';
  }) : [];
  const remakePayload = readRemakeFactorCache();
  const allMainRows = remakePayload && Array.isArray(remakePayload.detailRows)
    ? remakePayload.detailRows.filter(function(row) { return row && typeof row === 'object'; })
    : [];
  const mainRemakeRows = allMainRows.filter(function(row) {
    return row.isRemake === true || /^y$/i.test(String(row.remakeFlag || ''));
  });

  if (!remakePayload || remakePayload.ok !== true || !mainRemakeRows.length) {
    return {
      rows: existing,
      stats: {
        populationVersion: ceramistPopulationVersionV77,
        populationSourceReady: false,
        populationSourceMessage: remakePayload && remakePayload.message || 'The durable Remake Factor population is not ready.',
        populationExistingRows: existing.length,
        populationMainRemakeRows: mainRemakeRows.length,
        populationRowsAfterReconciliation: existing.length
      }
    };
  }

  const exactBuckets = {};
  const broadBuckets = {};
  const existingChainByCase = {};
  existing.forEach(function(row, index) {
    ceramistPopulationPushV77_(exactBuckets, ceramistPopulationExactKeyV77_(row), { index: index, row: row });
    ceramistPopulationPushV77_(broadBuckets, ceramistPopulationBroadKeyV77_(row), { index: index, row: row });
    const caseNumber = ceramistPopulationCaseNumberV77_(row);
    const chainStatus = String(row.populationChainStatus || '');
    const chainLookupCurrent = String(row.populationChainLookupVersion || '') === ceramistPopulationChainLookupVersionV771;
    const confirmedUnlinked = chainStatus === 'unlinked' && row.populationChainConfirmed === true && chainLookupCurrent;
    const resolvedChain = Number(row.chainDepth || 0) > 0 &&
      (Number(row.previousCaseNumber || 0) > 0 || Number(row.rootCaseNumber || 0) > 0);
    if (caseNumber && !existingChainByCase[caseNumber] && (resolvedChain || confirmedUnlinked)) {
      existingChainByCase[caseNumber] = row;
    }
  });
  const claimed = {};

  const mainCaseById = {};
  const mainRowsByCase = {};
  allMainRows.forEach(function(row) {
    const caseNumber = ceramistPopulationCaseNumberV77_(row);
    const caseId = ceramistPopulationCaseIdV77_(row);
    if (caseId) {
      const key = caseId.toLowerCase();
      const current = mainCaseById[key] || {};
      mainCaseById[key] = {
        caseId: caseId,
        caseNumber: caseNumber || current.caseNumber || '',
        remakeCaseId: ceramistPopulationRemakeCaseIdV77_(row) || current.remakeCaseId || '',
        remakeCaseIdFieldPresent: ceramistPopulationHasRemakeCaseFieldV77_(row) || current.remakeCaseIdFieldPresent === true,
        isRemakeCase: current.isRemakeCase === true || row.isRemake === true || /^y$/i.test(String(row.remakeFlag || '')),
        invoiceDate: ceramistPopulationTextV77_(row.invoiceDate || current.invoiceDate)
      };
    }
    if (caseNumber) {
      if (!mainRowsByCase[caseNumber]) mainRowsByCase[caseNumber] = [];
      mainRowsByCase[caseNumber].push(row);
    }
  });

  const reconciled = [];
  let reusedRows = 0;
  let synthesizedRows = 0;
  mainRemakeRows.forEach(function(mainRow) {
    let matched = ceramistPopulationTakeV77_(exactBuckets, ceramistPopulationExactKeyV77_(mainRow), claimed);
    if (!matched) matched = ceramistPopulationTakeV77_(broadBuckets, ceramistPopulationBroadKeyV77_(mainRow), claimed);
    if (matched) reusedRows++;
    else synthesizedRows++;
    reconciled.push(ceramistBuildCompletePopulationRowV77_(mainRow, matched));
  });

  const rowsByCase = {};
  reconciled.forEach(function(row) {
    const caseNumber = ceramistPopulationCaseNumberV77_(row);
    if (!caseNumber) return;
    if (!rowsByCase[caseNumber]) rowsByCase[caseNumber] = [];
    rowsByCase[caseNumber].push(row);
  });

  const props = PropertiesService.getScriptProperties();
  const maxApiCalls = Math.max(0, Number(props.getProperty(ceramistPopulationMaxApiCallsPropertyV77) || ceramistPopulationDefaultMaxApiCallsV77));
  const apiContext = {
    cfg: null,
    token: '',
    calls: 0,
    maxCalls: maxApiCalls,
    detailById: {},
    errors: []
  };
  const chainStats = {
    populationCases: Object.keys(rowsByCase).length,
    populationCasesWithExistingChain: 0,
    populationChainResolvedCases: 0,
    populationUnlinkedCases: 0,
    populationDeferredCases: 0,
    populationChainErrorCases: 0
  };

  Object.keys(rowsByCase).sort(function(a, b) {
    const aDate = ceramistPopulationTextV77_(rowsByCase[a][0] && rowsByCase[a][0].invoiceDate);
    const bDate = ceramistPopulationTextV77_(rowsByCase[b][0] && rowsByCase[b][0].invoiceDate);
    return bDate.localeCompare(aDate) || Number(b) - Number(a);
  }).forEach(function(caseNumber) {
    const caseRows = rowsByCase[caseNumber];
    const existingChainRow = existingChainByCase[caseNumber] || caseRows.find(function(row) {
      return Number(row.chainDepth || 0) > 0 && (Number(row.previousCaseNumber || 0) > 0 || Number(row.rootCaseNumber || 0) > 0);
    });
    let chain;
    if (existingChainRow) {
      chainStats.populationCasesWithExistingChain++;
      chain = ceramistPopulationChainFromRowV77_(existingChainRow);
    } else {
      chain = ceramistResolveRemakeChainV77_(caseRows[0], mainCaseById, apiContext);
    }

    if (chain.status === 'resolved') chainStats.populationChainResolvedCases++;
    else if (chain.status === 'unlinked') chainStats.populationUnlinkedCases++;
    else if (chain.status === 'deferred') chainStats.populationDeferredCases++;
    else chainStats.populationChainErrorCases++;

    caseRows.forEach(function(row) {
      ceramistApplyPopulationChainV77_(row, chain);
    });
  });

  return {
    rows: reconciled,
    stats: Object.assign({
      populationVersion: ceramistPopulationVersionV77,
      populationSourceReady: true,
      populationSourceGeneratedAt: remakePayload.generatedAt || '',
      populationExistingRows: existing.length,
      populationMainRemakeRows: mainRemakeRows.length,
      populationMainRemakeCases: Object.keys(mainRowsByCase).filter(function(caseNumber) {
        return mainRowsByCase[caseNumber].some(function(row) { return row.isRemake === true || /^y$/i.test(String(row.remakeFlag || '')); });
      }).length,
      populationReusedRows: reusedRows,
      populationSynthesizedRows: synthesizedRows,
      populationRowsAfterReconciliation: reconciled.length,
      populationApiCalls: apiContext.calls,
      populationApiCallLimit: apiContext.maxCalls,
      populationApiErrors: apiContext.errors.slice(0, 25)
    }, chainStats)
  };
}

function ceramistPopulationTextV77_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function ceramistPopulationCaseNumberV77_(row) {
  const candidates = [
    row && row.currentCaseNumber,
    row && row.remakeCaseNumber,
    row && row.caseNumber,
    row && row.caseNo,
    row && row.Cases_CaseNumber
  ];
  for (let index = 0; index < candidates.length; index++) {
    const numberValue = Number(candidates[index] || 0);
    if (Number.isFinite(numberValue) && numberValue > 0) return String(Math.trunc(numberValue));
  }
  return '';
}

function ceramistPopulationCaseIdV77_(row) {
  return ceramistPopulationTextV77_(row && (row.caseId || row.caseID || row.currentCaseId || row.currentCaseID));
}

function ceramistPopulationRemakeCaseIdV77_(row) {
  const value = row && typeof row === 'object' ? row : {};
  const direct = ceramistPopulationTextV77_(value.remakeCaseId || value.remakeCaseID || value.RemakeCaseID);
  if (direct) return direct;
  const ids = ceramistRemakeCaseIds_(value);
  return ids.length ? ids[0] : '';
}

function ceramistPopulationHasRemakeCaseFieldV77_(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.remakeCaseIdFieldPresent === true) return true;
  return Object.keys(row).some(function(key) { return /^remakeCaseID$/i.test(key); });
}

function ceramistPopulationProductV77_(row) {
  return ceramistPopulationTextV77_(row && (
    row.currentProductId || row.currentProductID || row.remakeProductId || row.remakeProductID ||
    row.productId || row.productID || row.CaseProducts_ProductID || row.productKey || row.productName
  )).toUpperCase();
}

function ceramistPopulationLineV77_(row) {
  return ceramistPopulationTextV77_(row && (
    row.caseProductLineId || row.currentCaseProductLineId || row.currentCaseProductLineID ||
    row.caseProductId || row.currentCaseProductId || row.currentCaseProductID ||
    row.productLineId || row.lineId || row.lineID
  ));
}

function ceramistPopulationBroadKeyV77_(row) {
  const caseNumber = ceramistPopulationCaseNumberV77_(row);
  const product = ceramistPopulationProductV77_(row);
  return caseNumber && product ? caseNumber + '\u0001' + product : '';
}

function ceramistPopulationExactKeyV77_(row) {
  const broad = ceramistPopulationBroadKeyV77_(row);
  if (!broad) return '';
  return broad + '\u0001' + ceramistPopulationLineV77_(row);
}

function ceramistPopulationPushV77_(map, key, item) {
  if (!key) return;
  if (!map[key]) map[key] = [];
  map[key].push(item);
}

function ceramistPopulationTakeV77_(map, key, claimed) {
  const items = key && map[key] ? map[key] : [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (claimed[item.index]) continue;
    claimed[item.index] = true;
    return item.row;
  }
  return null;
}

function ceramistBuildCompletePopulationRowV77_(mainRow, existingRow) {
  const row = existingRow ? Object.assign({}, existingRow) : {};
  const caseNumber = ceramistPopulationCaseNumberV77_(mainRow);
  const caseId = ceramistPopulationCaseIdV77_(mainRow);
  const productId = ceramistPopulationTextV77_(mainRow.productId || mainRow.productKey);
  const productName = ceramistPopulationTextV77_(mainRow.productName || productId || 'Unknown product');
  const customerId = ceramistPopulationTextV77_(mainRow.customerId || mainRow.customerKey);
  const customerName = ceramistPopulationTextV77_(mainRow.customerName || mainRow.customerDisplayName || customerId || 'Unknown customer');

  row.month = ceramistPopulationTextV77_(mainRow.month || row.month);
  row.year = Number(mainRow.year || row.year || 0) || '';
  row.invoiceDate = ceramistPopulationTextV77_(mainRow.invoiceDate || row.invoiceDate);
  row.caseId = caseId || ceramistPopulationCaseIdV77_(row);
  row.caseNumber = caseNumber || ceramistPopulationCaseNumberV77_(row);
  row.currentCaseNumber = caseNumber || ceramistPopulationCaseNumberV77_(row);
  row.remakeCaseNumber = caseNumber || ceramistPopulationCaseNumberV77_(row);
  row.remakeCaseIdFieldPresent = ceramistPopulationHasRemakeCaseFieldV77_(mainRow) || ceramistPopulationHasRemakeCaseFieldV77_(row);
  row.remakeCaseId = ceramistPopulationRemakeCaseIdV77_(mainRow) || ceramistPopulationRemakeCaseIdV77_(row);
  row.remakeCaseID = row.remakeCaseId;
  row.caseProductLineId = ceramistPopulationLineV77_(mainRow) || ceramistPopulationLineV77_(row);
  row.customerId = customerId || ceramistPopulationTextV77_(row.customerId);
  row.customerKey = customerId || ceramistPopulationTextV77_(row.customerKey || row.customerId);
  row.customerName = customerName;
  row.customerDisplayName = ceramistPopulationTextV77_(mainRow.customerDisplayName || mainRow.customerDisplayLabel || row.customerDisplayName || customerName);
  row.practiceName = ceramistPopulationTextV77_(mainRow.practiceName || row.practiceName);
  row.customerActive = mainRow.customerActive === false ? false : true;
  row.department = ceramistPopulationTextV77_(mainRow.department || row.department || 'Unassigned') || 'Unassigned';
  row.productId = productId || ceramistPopulationTextV77_(row.productId);
  row.currentProductId = productId || ceramistPopulationTextV77_(row.currentProductId || row.productId);
  row.productKey = ceramistPopulationTextV77_(mainRow.productKey || row.productKey || productId || productName);
  row.productName = productName;
  row.productGroup = ceramistPopulationTextV77_(mainRow.productGroup || row.productGroup || 'Unassigned') || 'Unassigned';
  row.remakeReason = ceramistPopulationTextV77_(mainRow.remakeReason || row.remakeReason || 'Not specified') || 'Not specified';
  row.quantity = Number(mainRow.quantity !== undefined ? mainRow.quantity : (mainRow.units !== undefined ? mainRow.units : row.quantity || 0)) || 0;
  row.units = row.quantity;
  row.isRemake = true;
  row.remakeUnits = Number(mainRow.remakeUnits !== undefined ? mainRow.remakeUnits : row.quantity) || 0;
  row.remakeDiscount = Math.abs(Number(mainRow.remakeDiscount !== undefined ? mainRow.remakeDiscount : row.remakeDiscount || 0) || 0);
  row.currentProductCeramicsEligible = true;
  row.currentProductCeramicsEligibilityReason = 'Included from the complete Remake Factor population';
  row.populationVersion = ceramistPopulationVersionV77;
  row.populationSource = existingRow ? 'existing_sidecar_plus_remake_population' : 'remake_factor_population';
  row.populationSynthesized = !existingRow;
  return row;
}

function ceramistPopulationChainFromRowV77_(row) {
  const depth = Math.max(0, Number(row.chainDepth || 0));
  const confirmedUnlinked = depth <= 0 &&
    String(row.populationChainStatus || '') === 'unlinked' &&
    row.populationChainConfirmed === true &&
    String(row.populationChainLookupVersion || '') === ceramistPopulationChainLookupVersionV771;
  return {
    status: depth > 0 ? 'resolved' : (confirmedUnlinked ? 'unlinked' : 'error'),
    confirmed: depth > 0 || confirmedUnlinked,
    chainDepth: depth,
    previousCaseNumber: Number(row.previousCaseNumber || 0) || '',
    rootCaseNumber: Number(row.rootCaseNumber || 0) || '',
    previousCaseId: ceramistPopulationTextV77_(row.previousCaseId || row.previousCaseID),
    rootCaseId: ceramistPopulationTextV77_(row.rootCaseId || row.rootCaseID),
    chainCaseNumbers: Array.isArray(row.chainCaseNumbers) ? row.chainCaseNumbers.slice() : [],
    chainCaseIds: Array.isArray(row.chainCaseIds) ? row.chainCaseIds.slice() : [],
    lookupVersion: ceramistPopulationChainLookupVersionV771,
    checkedAt: ceramistPopulationTextV77_(row.populationChainCheckedAt),
    reason: depth > 0 ? 'existing_sidecar_chain' : 'existing_confirmed_unlinked_case'
  };
}

function ceramistEnsurePopulationApiV77_(context) {
  if (context.cfg && context.token) return true;
  if (context.calls >= context.maxCalls) return false;
  try {
    const props = PropertiesService.getScriptProperties();
    context.cfg = getRemakeFactorConfig(props, {
      quickRefresh: true,
      lookbackMonths: 24,
      pageSize: 25,
      maxPages: 1,
      maxDetailFetches: 0,
      detailStrategy: 'none',
      chunkByMonth: false,
      fetchProductMap: false,
      fetchCustomerMap: false
    });
    context.token = authenticateRemakeFactorApi(context.cfg);
    return true;
  } catch (error) {
    context.errors.push('Authentication: ' + (error && error.message ? error.message : String(error)));
    return false;
  }
}

function ceramistFetchPopulationCaseDetailV77_(caseId, context) {
  const cleanId = ceramistPopulationTextV77_(caseId);
  if (!cleanId) return { status: 'missing_id', detail: null };
  const key = cleanId.toLowerCase();
  if (context.detailById[key]) return { status: 'ok', detail: context.detailById[key] };
  if (context.calls >= context.maxCalls) return { status: 'deferred', detail: null };
  if (!ceramistEnsurePopulationApiV77_(context)) {
    return context.calls >= context.maxCalls
      ? { status: 'deferred', detail: null }
      : { status: 'error', detail: null };
  }
  try {
    context.calls++;
    const detail = fetchRemakeFactorCaseDetail(context.cfg, context.token, cleanId);
    context.detailById[key] = detail || {};
    return { status: 'ok', detail: detail || {} };
  } catch (error) {
    context.errors.push(cleanId + ': ' + (error && error.message ? error.message : String(error)));
    return { status: 'error', detail: null };
  }
}

function ceramistResolveRemakeChainV77_(row, mainCaseById, apiContext) {
  const currentCaseId = ceramistPopulationCaseIdV77_(row);
  let nextId = ceramistPopulationRemakeCaseIdV77_(row);

  if (!nextId) {
    if (!currentCaseId) {
      return ceramistPopulationEmptyChainV77_(
        'error',
        'The current remake row does not contain a CRM caseID, so remakeCaseID cannot be confirmed.',
        false
      );
    }

    // QueryCases can expose the remakeCaseID field while leaving its value blank.
    // That blank is not authoritative. Confirm through the same case-detail path
    // used by profileRemakeLinkedCase() before declaring the case unlinked.
    const currentFetch = ceramistFetchPopulationCaseDetailV77_(currentCaseId, apiContext);
    if (currentFetch.status === 'deferred') {
      return ceramistPopulationEmptyChainV77_(
        'deferred',
        'API call limit reached before the current case remakeCaseID could be confirmed.',
        false
      );
    }
    if (currentFetch.status !== 'ok') {
      return ceramistPopulationEmptyChainV77_(
        'error',
        'The current case detail could not be read from the CRM API.',
        false
      );
    }

    const currentDetail = currentFetch.detail || {};
    if (!ceramistPopulationHasRemakeCaseFieldV77_(currentDetail)) {
      return ceramistPopulationEmptyChainV77_(
        'error',
        'The CRM case detail did not expose remakeCaseID, so an unlinked result cannot be confirmed.',
        false
      );
    }

    nextId = ceramistPopulationRemakeCaseIdV77_(currentDetail);
    if (!nextId) {
      return ceramistPopulationEmptyChainV77_(
        'unlinked',
        'The CRM case detail explicitly confirmed a blank remakeCaseID.',
        true
      );
    }
  }

  const seen = {};
  const chainCaseNumbers = [];
  const chainCaseIds = [];
  let previousCaseNumber = '';
  let previousCaseId = '';
  let rootCaseNumber = '';
  let rootCaseId = '';
  let depth = 0;

  while (nextId && depth < ceramistPopulationMaxChainDepthV77) {
    const cleanId = ceramistPopulationTextV77_(nextId);
    const key = cleanId.toLowerCase();
    if (!cleanId || seen[key]) {
      return {
        status: 'error',
        confirmed: false,
        chainDepth: depth,
        previousCaseNumber: previousCaseNumber,
        rootCaseNumber: rootCaseNumber,
        previousCaseId: previousCaseId,
        rootCaseId: rootCaseId,
        chainCaseNumbers: chainCaseNumbers,
        chainCaseIds: chainCaseIds,
        lookupVersion: ceramistPopulationChainLookupVersionV771,
        checkedAt: new Date().toISOString(),
        reason: 'A remakeCaseID cycle was detected.'
      };
    }
    seen[key] = true;

    const indexed = mainCaseById[key] || null;
    const indexedNextId = ceramistPopulationRemakeCaseIdV77_(indexed);
    let detail = indexed;
    let fetched = { status: 'not_needed', detail: null };

    // A nonblank indexed link can safely continue the chain. A blank indexed
    // link is never treated as terminal because QueryCases may omit the actual
    // value; fetch case detail to confirm the terminal root explicitly.
    if (!indexed || !indexed.caseNumber || !indexedNextId) {
      fetched = ceramistFetchPopulationCaseDetailV77_(cleanId, apiContext);
      if (fetched.status === 'deferred') {
        return {
          status: 'deferred',
          confirmed: false,
          chainDepth: depth,
          previousCaseNumber: previousCaseNumber,
          rootCaseNumber: rootCaseNumber,
          previousCaseId: previousCaseId,
          rootCaseId: rootCaseId,
          chainCaseNumbers: chainCaseNumbers,
          chainCaseIds: chainCaseIds,
          lookupVersion: ceramistPopulationChainLookupVersionV771,
          checkedAt: new Date().toISOString(),
          reason: 'API call limit reached before the full remake chain was confirmed.'
        };
      }
      if (fetched.status !== 'ok') {
        return {
          status: 'error',
          confirmed: false,
          chainDepth: depth,
          previousCaseNumber: previousCaseNumber,
          rootCaseNumber: rootCaseNumber,
          previousCaseId: previousCaseId,
          rootCaseId: rootCaseId,
          chainCaseNumbers: chainCaseNumbers,
          chainCaseIds: chainCaseIds,
          lookupVersion: ceramistPopulationChainLookupVersionV771,
          checkedAt: new Date().toISOString(),
          reason: 'A linked remake case could not be read from the CRM API.'
        };
      }
      detail = Object.assign({}, indexed || {}, fetched.detail || {});
    }

    const linkedCaseNumber = Number(detail && (detail.caseNumber || detail.caseNo) || 0);
    if (!Number.isFinite(linkedCaseNumber) || linkedCaseNumber <= 0) {
      return {
        status: 'error',
        confirmed: false,
        chainDepth: depth,
        previousCaseNumber: previousCaseNumber,
        rootCaseNumber: rootCaseNumber,
        previousCaseId: previousCaseId,
        rootCaseId: rootCaseId,
        chainCaseNumbers: chainCaseNumbers,
        chainCaseIds: chainCaseIds,
        lookupVersion: ceramistPopulationChainLookupVersionV771,
        checkedAt: new Date().toISOString(),
        reason: 'A linked remake case did not contain a numeric case number.'
      };
    }

    if (!ceramistPopulationHasRemakeCaseFieldV77_(detail)) {
      return {
        status: 'error',
        confirmed: false,
        chainDepth: depth,
        previousCaseNumber: previousCaseNumber,
        rootCaseNumber: rootCaseNumber,
        previousCaseId: previousCaseId,
        rootCaseId: rootCaseId,
        chainCaseNumbers: chainCaseNumbers,
        chainCaseIds: chainCaseIds,
        lookupVersion: ceramistPopulationChainLookupVersionV771,
        checkedAt: new Date().toISOString(),
        reason: 'A linked CRM case detail did not expose remakeCaseID, so the chain endpoint could not be confirmed.'
      };
    }

    depth++;
    chainCaseIds.push(cleanId);
    chainCaseNumbers.push(Math.trunc(linkedCaseNumber));
    if (!previousCaseNumber) {
      previousCaseNumber = Math.trunc(linkedCaseNumber);
      previousCaseId = cleanId;
    }
    rootCaseNumber = Math.trunc(linkedCaseNumber);
    rootCaseId = cleanId;
    nextId = ceramistPopulationRemakeCaseIdV77_(detail);
  }

  if (nextId) {
    return {
      status: 'error',
      confirmed: false,
      chainDepth: depth,
      previousCaseNumber: previousCaseNumber,
      rootCaseNumber: rootCaseNumber,
      previousCaseId: previousCaseId,
      rootCaseId: rootCaseId,
      chainCaseNumbers: chainCaseNumbers,
      chainCaseIds: chainCaseIds,
      lookupVersion: ceramistPopulationChainLookupVersionV771,
      checkedAt: new Date().toISOString(),
      reason: 'The remake chain exceeded the safe depth limit.'
    };
  }

  return {
    status: 'resolved',
    confirmed: true,
    chainDepth: depth,
    previousCaseNumber: previousCaseNumber,
    rootCaseNumber: rootCaseNumber,
    previousCaseId: previousCaseId,
    rootCaseId: rootCaseId,
    chainCaseNumbers: chainCaseNumbers,
    chainCaseIds: chainCaseIds,
    lookupVersion: ceramistPopulationChainLookupVersionV771,
    checkedAt: new Date().toISOString(),
    reason: 'CRM remakeCaseID chain resolved and its terminal case was confirmed.'
  };
}

function ceramistPopulationEmptyChainV77_(status, reason, confirmed) {
  return {
    status: status,
    confirmed: confirmed === true,
    chainDepth: 0,
    previousCaseNumber: '',
    rootCaseNumber: '',
    previousCaseId: '',
    rootCaseId: '',
    chainCaseNumbers: [],
    chainCaseIds: [],
    lookupVersion: ceramistPopulationChainLookupVersionV771,
    checkedAt: new Date().toISOString(),
    reason: reason || ''
  };
}

function ceramistApplyPopulationChainV77_(row, chain) {
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
  row.populationChainLookupVersion = chain && chain.lookupVersion || ceramistPopulationChainLookupVersionV771;
  row.populationChainCheckedAt = chain && chain.checkedAt || new Date().toISOString();
  row.populationChainReason = chain && chain.reason || '';
}

/**
 * v7.4 case-level responsibility refresh.
 *
 * The current remake product remains whatever line qualified for the Ceramist
 * dashboard. Responsibility is different: it comes from the completed
 * CERAMICS worker on the prior/root CASE, regardless of the product ID on the
 * new remake line.
 *
 * A case resolves only when there is exactly one distinct nonblank completed
 * worker across all of its completed CERAMICS rows. Repeated rows and multiple
 * products by that same worker are valid. Multiple distinct workers remain a
 * review condition and are never guessed.
 */
function ceramistApplyCaseLevelResponsibilityV74_(rows) {
  const caseNumbers = [];
  const seen = {};

  (rows || []).forEach(function(row) {
    if (!row || typeof row !== 'object') return;
    [row.currentCaseNumber || row.remakeCaseNumber || row.caseNumber, row.rootCaseNumber, row.previousCaseNumber].forEach(function(value) {
      const numberValue = Number(value || 0);
      if (!Number.isFinite(numberValue) || numberValue <= 0 || seen[numberValue]) return;
      seen[numberValue] = true;
      caseNumbers.push(Math.trunc(numberValue));
    });
  });

  if (!caseNumbers.length) return rows;
  const caseMap = ceramistLoadCaseLevelWorkersV74_(caseNumbers);

  (rows || []).forEach(function(row) {
    if (!row || typeof row !== 'object') return;
    const chainDepth = Number(row.chainDepth || 0);
    const current = ceramistCaseResolutionV74_(caseMap, row.currentCaseNumber || row.remakeCaseNumber || row.caseNumber);
    const root = ceramistCaseResolutionV74_(caseMap, row.rootCaseNumber);
    const previous = ceramistCaseResolutionV74_(caseMap, row.previousCaseNumber);

    ceramistWriteCaseResolutionV74_(row, 'current', current);
    ceramistWriteCaseResolutionV74_(row, 'root', root);
    ceramistWriteCaseResolutionV74_(row, 'previous', previous);

    let chosen = null;
    let basis = '';

    if (chainDepth > 0 && root.status === 'resolved') {
      if (chainDepth > 1 && previous.status === 'resolved' && previous.worker !== root.worker) {
        chosen = previous;
        basis = 'previous_case_level_differs_from_root';
      } else {
        chosen = root;
        basis = 'root_case_level';
      }
    } else if (
      chainDepth > 0 &&
      previous.status === 'resolved' &&
      (root.status === 'missing_ceramics' || root.status === 'missing_completed_by')
    ) {
      chosen = previous;
      basis = 'previous_case_level_root_missing';
    }

    if (chosen) {
      row.responsibleCeramist = chosen.worker;
      row.responsibleCeramistDisplay = chosen.worker;
      row.responsibleTechnicianNumber = '';
      row.responsibleTechnicianType = '';
      row.attributionStatus = 'attributed';
      row.attributionBasis = basis;
      row.invoiceNoteUsedForAttribution = false;
    } else {
      row.responsibleCeramist = '[Unattributed]';
      row.responsibleCeramistDisplay = '[Unattributed]';
      row.responsibleTechnicianNumber = '';
      row.responsibleTechnicianType = '';
      row.attributionStatus = 'unattributed';
      const chainStatus = String(row.populationChainStatus || '');
      if (chainStatus === 'deferred') {
        row.attributionBasis = 'population_chain_pending';
        row.attributionReason = row.populationChainReason || 'The remake chain is queued for the next cache refresh.';
      } else if (chainStatus === 'unlinked_unconfirmed') {
        row.attributionBasis = 'remake_case_id_unavailable';
        row.attributionReason = row.populationChainReason || 'CRM did not expose remakeCaseID, so the original/root case could not be confirmed.';
      } else if (chainStatus === 'error') {
        row.attributionBasis = 'population_chain_error';
        row.attributionReason = row.populationChainReason || 'The remake chain could not be resolved.';
      } else if (chainStatus === 'unlinked' && row.populationChainConfirmed === true) {
        row.attributionBasis = 'unlinked';
        row.attributionReason = row.populationChainReason || 'The CRM case detail explicitly confirmed no remakeCaseID.';
      } else if (chainDepth <= 0) {
        row.attributionBasis = 'population_chain_error';
        row.attributionReason = row.populationChainReason || 'The remake chain was not confirmed.';
      } else if (root.status === 'multiple_workers' || previous.status === 'multiple_workers') {
        row.attributionBasis = 'multiple_case_level_workers';
      } else {
        row.attributionBasis = 'no_case_level_ceramics_worker';
      }
    }

    row.previousDiffersFromRoot = !!(
      root.status === 'resolved' &&
      previous.status === 'resolved' &&
      root.worker !== previous.worker
    );
    row.caseLevelResponsibilityApplied = true;
  });

  return rows;
}

function ceramistLoadCaseLevelWorkersV74_(caseNumbers) {
  const unique = Array.from(new Set((caseNumbers || []).map(function(value) {
    return Math.trunc(Number(value || 0));
  }).filter(function(value) {
    return Number.isFinite(value) && value > 0;
  }))).sort(function(a, b) { return a - b; });

  const map = {};
  if (!unique.length) return map;

  const batchSize = 2500;
  for (let offset = 0; offset < unique.length; offset += batchSize) {
    const batch = unique.slice(offset, offset + batchSize);
    const sql = `
WITH completed AS (
  SELECT
    SAFE_CAST(Cases_CaseNumber AS INT64) AS case_number,
    NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), '') AS worker,
    SAFE_CAST(CaseTasks_Sequence AS INT64) AS task_sequence,
    NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), '') AS product_id
  FROM \`${ceramistProfileConfig.projectId}.${ceramistProfileConfig.datasetId}.${ceramistProfileConfig.taskTable}\`
  WHERE SAFE_CAST(Cases_CaseNumber AS INT64) IN (${batch.join(',')})
    AND CaseTasks_CompleteDate IS NOT NULL
    AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = '${ceramistSqlLiteral_(ceramistProfileConfig.taskCode)}'
)
SELECT
  case_number,
  COUNT(*) AS completed_rows,
  COUNT(DISTINCT worker) AS distinct_workers,
  COUNTIF(worker IS NULL) AS missing_worker_rows,
  TO_JSON_STRING(ARRAY_AGG(DISTINCT worker IGNORE NULLS ORDER BY worker)) AS workers_json,
  TO_JSON_STRING(ARRAY_AGG(DISTINCT task_sequence IGNORE NULLS ORDER BY task_sequence)) AS sequences_json,
  TO_JSON_STRING(ARRAY_AGG(DISTINCT product_id IGNORE NULLS ORDER BY product_id)) AS product_ids_json
FROM completed
GROUP BY case_number
ORDER BY case_number
`;

    ceramistRunBigQuery_(sql, ceramistProfileConfig).forEach(function(result) {
      const caseNumber = Number(result.case_number || 0);
      if (!caseNumber) return;
      const workers = ceramistParseJsonArrayV74_(result.workers_json).map(String).filter(Boolean);
      const status = workers.length === 1
        ? 'resolved'
        : (workers.length > 1 ? 'multiple_workers' : 'missing_completed_by');
      map[caseNumber] = {
        caseNumber: caseNumber,
        status: status,
        worker: workers.length === 1 ? workers[0] : '',
        workers: workers,
        completedRows: Number(result.completed_rows || 0),
        missingWorkerRows: Number(result.missing_worker_rows || 0),
        sequences: ceramistParseJsonArrayV74_(result.sequences_json),
        productIds: ceramistParseJsonArrayV74_(result.product_ids_json)
      };
    });
  }

  return map;
}

function ceramistParseJsonArrayV74_(value) {
  if (Array.isArray(value)) return value;
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text || text === 'null') return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function ceramistCaseResolutionV74_(caseMap, caseNumberValue) {
  const caseNumber = Math.trunc(Number(caseNumberValue || 0));
  if (!Number.isFinite(caseNumber) || caseNumber <= 0) {
    return {
      caseNumber: '',
      status: 'unlinked',
      worker: '',
      workers: [],
      sequences: [],
      productIds: [],
      completedRows: 0
    };
  }
  return caseMap[caseNumber] || {
    caseNumber: caseNumber,
    status: 'missing_ceramics',
    worker: '',
    workers: [],
    sequences: [],
    productIds: [],
    completedRows: 0
  };
}

function ceramistWriteCaseResolutionV74_(row, prefix, resolution) {
  const cap = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  const status = String(resolution && resolution.status || 'missing_ceramics');
  const worker = String(resolution && resolution.worker || '').trim();
  const workers = Array.isArray(resolution && resolution.workers) ? resolution.workers.slice() : [];

  row[prefix + 'Ceramist'] = worker;
  row[prefix + 'CeramistDisplay'] = worker;
  row[prefix + 'CeramistCandidates'] = workers;
  row[prefix + 'CeramistStatus'] = status;
  row[prefix + 'CeramicsMissing'] = status === 'missing_ceramics' || status === 'missing_completed_by';
  row[prefix + 'MultipleCeramists'] = status === 'multiple_workers';
  row[prefix + 'ProductUnmatched'] = false;
  row[prefix + 'MatchMethod'] = status === 'resolved' ? 'case_level_ceramics' : '';
  row[prefix + 'MatchedProductId'] = '';
  row[prefix + 'Sequences'] = Array.isArray(resolution && resolution.sequences) ? resolution.sequences.slice() : [];
  row[prefix + 'CaseCeramicsProductIds'] = Array.isArray(resolution && resolution.productIds) ? resolution.productIds.slice() : [];
  row[prefix + 'CaseCompletedCeramicsRows'] = Number(resolution && resolution.completedRows || 0);

  // Compatibility with fields used by older dashboard filters.
  if (cap === 'Root') row.rootCeramicsMissing = row.rootCeramicsMissing === true;
  if (cap === 'Previous') row.previousCeramicsMissing = row.previousCeramicsMissing === true;
}

/**
 * Resolve raw task-user IDs through the hidden Task User Badges sheet.
 *
 * Primary source:
 *   Task User Badges!A:D
 *   A = Tech #, B = Technician Name, C = Technician Type, D = Task User ID
 *
 * Fallback source:
 *   Tech Numbers!A:C
 *
 * When the primary sheet is missing an ID or technician number needed by a
 * cache row, the existing display/name data is retained and the legacy Tech
 * Numbers sheet is used when a technician number or exact name is available.
 * Missing lookup values are emailed to summer@caldentalarts.com. The same
 * alert signature is suppressed for six hours to prevent repeated emails on
 * every dashboard load.
 */
function ceramistApplyTaskUserBadgeNamesV72_(rows) {
  const lookup = ceramistGetTaskUserBadgeLookupV72_();
  const missing = {
    taskUserIds: {},
    technicianNumbers: {}
  };

  (rows || []).forEach(function(row) {
    if (!row || typeof row !== 'object') return;
    ceramistApplyWorkerDisplayV72_(row, 'responsibleCeramist', 'responsibleCeramistDisplay', lookup, missing);
    ceramistApplyWorkerDisplayV72_(row, 'currentCeramist', 'currentCeramistDisplay', lookup, missing);
    ceramistApplyWorkerDisplayV72_(row, 'previousCeramist', 'previousCeramistDisplay', lookup, missing);
    ceramistApplyWorkerDisplayV72_(row, 'rootCeramist', 'rootCeramistDisplay', lookup, missing);
    ceramistApplyInvoiceNoteCompletionV73_(row, lookup, missing);
    ceramistFinalizeWorkerCategoriesV73_(row);
  });

  ceramistSendLookupAlertV72_(missing);
  return rows;
}

function ceramistApplyWorkerDisplayV72_(row, idField, displayField, lookup, missing) {
  const workerId = String(row[idField] || '').trim();
  if (!workerId || workerId === '[Unattributed]') return;

  const primary = lookup.byId[workerId.toLowerCase()];
  if (primary && primary.name) {
    ceramistSetWorkerMetadataV73_(row, idField, displayField, primary, workerId);
    return;
  }

  missing.taskUserIds[workerId] = true;

  const techFieldCandidates = [
    idField.replace('Ceramist', 'TechnicianNumber'),
    idField.replace('Ceramist', 'TechNumber'),
    idField + 'TechnicianNumber',
    idField + 'TechNumber'
  ];
  let techNumber = '';
  techFieldCandidates.some(function(fieldName) {
    const value = String(row[fieldName] || '').trim();
    if (!value) return false;
    techNumber = value;
    return true;
  });

  if (techNumber) {
    const primaryByTech = lookup.byTech[techNumber];
    if (primaryByTech && primaryByTech.name) {
      ceramistSetWorkerMetadataV73_(row, idField, displayField, primaryByTech, workerId);
      return;
    }
    missing.technicianNumbers[techNumber] = true;
    const legacyByTech = lookup.legacyByTech[techNumber];
    if (legacyByTech && legacyByTech.name) {
      ceramistSetWorkerMetadataV73_(row, idField, displayField, legacyByTech, workerId);
      return;
    }
  }

  const existingDisplay = String(row[displayField] || '').trim();
  if (existingDisplay) {
    const legacyByName = lookup.legacyByName[existingDisplay.toLowerCase()];
    if (legacyByName && legacyByName.name) {
      ceramistSetWorkerMetadataV73_(row, idField, displayField, legacyByName, workerId);
    }
  }
}

function ceramistSetWorkerMetadataV73_(row, idField, displayField, record, fallbackId) {
  const cleanName = String(record && record.name || '').trim();
  const cleanType = String(record && record.technicianType || '').trim();
  const cleanTech = String(record && record.techNumber || '').trim();
  const cleanTaskUserId = String(record && record.taskUserId || fallbackId || '').trim();
  if (cleanName) row[displayField] = cleanName;
  if (cleanType) row[idField + 'TechnicianType'] = cleanType;
  if (cleanTech) row[idField + 'TechnicianNumber'] = cleanTech;
  if (cleanTaskUserId && (!row[idField] || row[idField] === '[Unattributed]')) row[idField] = cleanTaskUserId;
}

function ceramistNormalizeTechNumbersV73_(value) {
  const values = Array.isArray(value) ? value : (value === null || value === undefined || value === '' ? [] : [value]);
  const seen = {};
  const result = [];
  values.forEach(function(item) {
    const clean = String(item || '').trim().replace(/^TECH\s*#?\s*/i, '');
    const numbers = clean.match(/\d{1,6}/g) || [];
    numbers.forEach(function(number) {
      if (!number || seen[number]) return;
      seen[number] = true;
      result.push(number);
    });
  });
  return result;
}

function ceramistLookupTechRecordV73_(techNumber, lookup, missing) {
  const clean = String(techNumber || '').trim();
  if (!clean) return null;
  const record = lookup.byTech[clean] || lookup.legacyByTech[clean] || null;
  if (!record) missing.technicianNumbers[clean] = true;
  return record;
}

function ceramistNoteWorkerV73_(row, prefix, lookup, missing) {
  const numbers = ceramistNormalizeTechNumbersV73_(row[prefix + 'InvoiceNoteTechNumbers']);
  if (!numbers.length) return null;

  const candidates = numbers.map(function(techNumber) {
    const record = ceramistLookupTechRecordV73_(techNumber, lookup, missing);
    return record && record.name ? {
      techNumber: techNumber,
      record: record
    } : null;
  }).filter(Boolean);

  let chosen = null;
  if (numbers.length === 1) {
    chosen = candidates.length ? candidates[0] : null;
  } else {
    const ceramistCandidates = candidates.filter(function(candidate) {
      return /^ceramist$/i.test(String(candidate.record.technicianType || '').trim());
    });
    chosen = ceramistCandidates.length === 1 ? ceramistCandidates[0] : null;
  }

  if (!chosen) return null;
  return {
    source: prefix,
    techNumber: chosen.techNumber,
    record: chosen.record,
    note: String(row[prefix + 'InvoiceNote'] || '').trim()
  };
}

function ceramistWorkerIdentityV73_(item) {
  if (!item || !item.record) return '';
  return String(item.record.taskUserId || item.record.techNumber || item.record.name || '').trim().toLowerCase();
}

function ceramistApplyNoteWorkerToFieldV73_(row, item, idField, displayField) {
  if (!item || !item.record) return;
  const workerKey = String(item.record.taskUserId || ('TECH#' + item.techNumber)).trim();
  row[idField] = workerKey;
  row[displayField] = String(item.record.name || workerKey).trim();
  row[idField + 'TechnicianType'] = String(item.record.technicianType || '').trim();
  row[idField + 'TechnicianNumber'] = String(item.techNumber || item.record.techNumber || '').trim();
  row[idField + 'Source'] = 'invoice_note';
}

function ceramistApplyInvoiceNoteCompletionV73_(row, lookup, missing) {
  const root = ceramistNoteWorkerV73_(row, 'root', lookup, missing);
  const previous = ceramistNoteWorkerV73_(row, 'previous', lookup, missing);
  const current = ceramistNoteWorkerV73_(row, 'current', lookup, missing);

  if ((!row.currentCeramist || row.currentCeramist === '[Unattributed]') && current) {
    ceramistApplyNoteWorkerToFieldV73_(row, current, 'currentCeramist', 'currentCeramistDisplay');
    row.currentCompletedViaInvoiceNote = true;
  }

  const alreadyAttributed = String(row.attributionStatus || '') === 'attributed' &&
    String(row.responsibleCeramist || '').trim() &&
    String(row.responsibleCeramist || '').trim() !== '[Unattributed]';
  if (alreadyAttributed) return;

  let chosen = null;
  if (root && previous) {
    const differs = ceramistWorkerIdentityV73_(root) !== ceramistWorkerIdentityV73_(previous);
    chosen = Number(row.chainDepth || 0) > 1 && differs ? previous : root;
  } else {
    chosen = previous || root;
  }
  if (!chosen) return;

  ceramistApplyNoteWorkerToFieldV73_(row, chosen, 'responsibleCeramist', 'responsibleCeramistDisplay');
  row.responsibleCompletedViaInvoiceNote = true;
  row.invoiceNoteCompletionAccepted = true;
  row.invoiceNoteTechEvidence = true;
  row.attributionStatus = 'attributed';
  row.attributionBasis = chosen.source + '_invoice_note_tech_completed';

  if (chosen.source === 'root') {
    row.rootCeramicsMissing = false;
    row.rootCompletedViaInvoiceNote = true;
    ceramistApplyNoteWorkerToFieldV73_(row, chosen, 'rootCeramist', 'rootCeramistDisplay');
  }
  if (chosen.source === 'previous') {
    row.previousCeramicsMissing = false;
    row.previousCompletedViaInvoiceNote = true;
    ceramistApplyNoteWorkerToFieldV73_(row, chosen, 'previousCeramist', 'previousCeramistDisplay');
  }
}

function ceramistIsTryInV73_(row) {
  const values = [
    row && row.caseStatus,
    row && row.status,
    row && row.Cases_Status,
    row && row.currentCaseStatus,
    row && row.currentStatus,
    row && row.invoiceDateTryIn,
    row && row.Cases_InvoiceDateTryIn,
    row && row.currentInvoiceDateTryIn,
    row && row.tryInStatus,
    row && row.isTryIn
  ];
  return values.some(function(value) {
    if (value === true) return true;
    return /try\s*-?\s*in|invoice[^a-z0-9]*for[^a-z0-9]*try/i.test(String(value || ''));
  });
}

function ceramistWorkerCategoryV73_(type, tryIn, unattributed) {
  if (unattributed) return 'Unattributed';
  const clean = String(type || '').trim();
  if (/^ceramist$/i.test(clean)) return 'Ceramist';
  if (tryIn) return 'Technician - Try-in';
  return clean ? 'Technician - Review' : 'Worker type missing';
}

function ceramistFinalizeWorkerCategoriesV73_(row) {
  const responsible = String(row.responsibleCeramist || '').trim();
  const unattributed = !responsible || responsible === '[Unattributed]' || String(row.attributionStatus || '') !== 'attributed';
  const tryIn = ceramistIsTryInV73_(row);
  const responsibleType = String(row.responsibleCeramistTechnicianType || row.responsibleWorkerType || '').trim();
  const currentType = String(row.currentCeramistTechnicianType || row.currentWorkerType || '').trim();
  row.isTryInContext = tryIn;
  row.responsibleWorkerType = responsibleType;
  row.responsibleWorkerCategory = ceramistWorkerCategoryV73_(responsibleType, tryIn, unattributed);
  row.responsibleWorkerSection = unattributed ? 'Unattributed' : (/^ceramist$/i.test(responsibleType) ? 'Ceramists' : 'Technicians / Try-ins');
  row.currentWorkerType = currentType;
  row.currentWorkerCategory = ceramistWorkerCategoryV73_(currentType, tryIn, !String(row.currentCeramist || '').trim());
}

function ceramistGetTaskUserBadgeLookupV72_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(ceramistTaskUserBadgeCacheKeyV72);
  if (cached) {
    try { return JSON.parse(cached); } catch (ignore) {}
  }

  const lookup = {
    byId: {},
    byTech: {},
    legacyByTech: {},
    legacyByName: {}
  };

  try {
    const spreadsheet = SpreadsheetApp.openById(ceramistTaskUserBadgeSpreadsheetIdV71);
    const primarySheet = spreadsheet.getSheetByName(ceramistTaskUserBadgeSheetNameV71);
    const legacySheet = spreadsheet.getSheetByName(ceramistLegacyTechSheetNameV72);

    if (primarySheet && primarySheet.getLastRow() >= 2) {
      const values = primarySheet.getRange(2, 1, primarySheet.getLastRow() - 1, 4).getDisplayValues();
      values.forEach(function(row) {
        const techNumber = String(row[0] || '').trim();
        const name = String(row[1] || '').trim();
        const technicianType = String(row[2] || '').trim();
        const taskUserId = String(row[3] || '').trim();
        const record = {
          name: name,
          techNumber: techNumber,
          technicianType: technicianType,
          taskUserId: taskUserId,
          source: ceramistTaskUserBadgeSheetNameV71
        };
        if (taskUserId) lookup.byId[taskUserId.toLowerCase()] = record;
        if (techNumber) lookup.byTech[techNumber] = record;
      });
    }

    if (legacySheet && legacySheet.getLastRow() >= 2) {
      const legacyValues = legacySheet.getRange(2, 1, legacySheet.getLastRow() - 1, 3).getDisplayValues();
      legacyValues.forEach(function(row) {
        const techNumber = String(row[0] || '').trim();
        const name = String(row[1] || '').trim();
        const technicianType = String(row[2] || '').trim();
        const record = {
          name: name,
          techNumber: techNumber,
          technicianType: technicianType,
          source: ceramistLegacyTechSheetNameV72
        };
        if (techNumber) lookup.legacyByTech[techNumber] = record;
        if (name) lookup.legacyByName[name.toLowerCase()] = record;
      });
    }

    cache.put(ceramistTaskUserBadgeCacheKeyV72, JSON.stringify(lookup), 21600);
  } catch (error) {
    ceramistSendLookupReadFailureV72_(error);
  }

  return lookup;
}

function ceramistSendLookupAlertV72_(missing) {
  const missingIds = Object.keys(missing.taskUserIds || {}).sort();
  const missingTechNumbers = Object.keys(missing.technicianNumbers || {}).sort();
  if (!missingIds.length && !missingTechNumbers.length) return;

  const signature = JSON.stringify({ ids: missingIds, techNumbers: missingTechNumbers });
  const cache = CacheService.getScriptCache();
  if (cache.get(ceramistLookupAlertCacheKeyV72) === signature) return;

  const body = [
    'The Ceramist dashboard could not fully resolve one or more task users from the hidden Task User Badges tab.',
    '',
    'Missing Task User IDs:',
    missingIds.length ? missingIds.join('\n') : '(none)',
    '',
    'Missing technician numbers:',
    missingTechNumbers.length ? missingTechNumbers.join('\n') : '(none)',
    '',
    'Fallback source checked: Tech Numbers',
    'Spreadsheet: CDA Prices and Stuff',
    'Generated: ' + new Date().toISOString()
  ].join('\n');

  try {
    MailApp.sendEmail({
      to: ceramistLookupAlertRecipientV72,
      subject: 'Ceramist task-user lookup needs review',
      body: body
    });
    cache.put(ceramistLookupAlertCacheKeyV72, signature, 21600);
  } catch (error) {
    console.log('Ceramist lookup alert email failed: ' + (error && error.message ? error.message : String(error)));
  }
}

function ceramistSendLookupReadFailureV72_(error) {
  const message = error && error.message ? error.message : String(error);
  const signature = 'read-failure:' + message;
  const cache = CacheService.getScriptCache();
  if (cache.get(ceramistLookupAlertCacheKeyV72) === signature) return;

  try {
    MailApp.sendEmail({
      to: ceramistLookupAlertRecipientV72,
      subject: 'Ceramist lookup sheet could not be read',
      body: [
        'The Ceramist dashboard could not read Task User Badges and/or Tech Numbers.',
        '',
        'Error:',
        message,
        '',
        'Generated: ' + new Date().toISOString()
      ].join('\n')
    });
    cache.put(ceramistLookupAlertCacheKeyV72, signature, 21600);
  } catch (mailError) {
    console.log('Ceramist lookup read-failure email failed: ' + (mailError && mailError.message ? mailError.message : String(mailError)));
  }
}

function debugCeramistRemakeAnalysisCache() {
  const result = getCeramistRemakeAnalysisData();
  const rows = result && Array.isArray(result.rows) ? result.rows : [];
  const summary = {
    ok: !!(result && result.ok),
    version: result && result.version || ceramistRemakeCacheVersionV7,
    generatedAt: result && result.generatedAt || '',
    rowCount: rows.length,
    attributedRows: rows.filter(function(row) { return String(row.attributionStatus || '') === 'attributed'; }).length,
    multiChainRows: rows.filter(function(row) { return row.multiChain === true; }).length,
    rootCeramicsMissingRows: rows.filter(function(row) { return row.rootCeramicsMissing === true; }).length,
    message: result && result.message || '',
    stats: result && result.stats || {}
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function profileCeramistTaskCoverage(options) {
  const cfg = Object.assign({}, ceramistProfileConfig, options || {});
  const result = {
    ok: true,
    generatedAt: new Date().toISOString(),
    diagnosticOnly: true,
    rule: {
      taskCode: cfg.taskCode,
      sequenceRule: 'all sequences',
      ceramistField: 'CaseTasks_CompletedBy',
      attributionTarget: 'root case, with approved immediate-previous override for multi-chain remakes'
    },
    schemaCandidates: ceramistRunBigQuery_(ceramistSchemaSql_(cfg), cfg),
    taskInventory: ceramistRunBigQuery_(ceramistTaskInventorySql_(cfg), cfg),
    ceramistSummary: ceramistRunBigQuery_(ceramistSummarySql_(cfg), cfg),
    multipleCeramistCases: ceramistRunBigQuery_(ceramistAmbiguitySql_(cfg), cfg),
    notes: [
      'The exact CERAMICS task is included across every sequence.',
      'CaseTasks_Sequence is retained only to explain workflow history and repeated task rows.',
      'OPAQUE and FINISH are intentionally excluded.',
      'Attribution defaults to the root CERAMICS worker; the approved multi-chain exception uses the immediately previous worker only when different from root.',
      'Do not publish rankings until missing and multiple-ceramist coverage is reviewed.'
    ]
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Second-pass diagnostic. Run this after profileCeramistTaskCoverage().
 * It validates the verified tasks_all case + product + sequence grain and
 * compares every observed CERAMICS sequence without returning a large case list.
 */
function profileCeramistProductAttribution(options) {
  const cfg = Object.assign({}, ceramistProfileConfig, options || {});
  const result = {
    ok: true,
    generatedAt: new Date().toISOString(),
    diagnosticOnly: true,
    purpose: 'Validate all-sequence CERAMICS coverage and product-level attribution before building remake rates.',
    productsSchemaCandidates: ceramistRunBigQuery_(ceramistProductsSchemaSql_(cfg), cfg),
    sequenceByWorkflow: ceramistRunBigQuery_(ceramistSequenceWorkflowSql_(cfg), cfg),
    attributionQuality: ceramistRunBigQuery_(ceramistAttributionQualitySql_(cfg), cfg),
    sequenceOverlap: ceramistRunBigQuery_(ceramistSequenceOverlapSql_(cfg), cfg),
    multipleWorkerSamples: ceramistRunBigQuery_(ceramistMultipleWorkerSamplesSql_(cfg), cfg),
    notes: [
      'The verified tasks_all attribution grain is case + product + task sequence, not case alone.',
      'CaseProducts_TeethNumbers exists in products_all only and is not inferred onto task rows.',
      'Repeated CERAMICS rows by the same worker are not automatically duplicates.',
      'Sequence never determines whether a CERAMICS row is eligible.',
      'No dashboard or cache data is changed by this diagnostic.'
    ]
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Compact follow-up for Apps Script's log-size limit.
 * Run this after the schema and workflow output has been reviewed.
 */
function profileCeramistCompactAttribution(options) {
  const cfg = Object.assign({}, ceramistProfileConfig, options || {});
  const result = {
    ok: true,
    generatedAt: new Date().toISOString(),
    diagnosticOnly: true,
    purpose: 'Return only the decision-ready CERAMICS attribution checks.',
    sequenceSummary: ceramistRunBigQuery_(ceramistSequenceSummarySql_(cfg), cfg),
    attributionQuality: ceramistRunBigQuery_(ceramistAttributionQualitySql_(cfg), cfg),
    sequenceOverlap: ceramistRunBigQuery_(ceramistSequenceOverlapSql_(cfg), cfg),
    multipleWorkerSamples: ceramistRunBigQuery_(ceramistMultipleWorkerSamplesSql_(cfg), cfg),
    notes: [
      'Exact task filter: CERAMICS only; department and sequence are not substitutes or eligibility filters.',
      'Source task rows remain counted; repeated rows are not silently deleted.',
      'Final attribution-quality grain: case + product across all CERAMICS sequences.',
      'No dashboard or cache data is changed by this diagnostic.'
    ]
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Verifies whether the CRM API remakeCaseID field identifies the immediate
 * original case. The default known chain is 375669 -> 373892.
 *
 * This function reads the API only. It does not write the remake cache.
 */
function profileRemakeLinkedCase(options) {
  const opts = options || {};
  const targetCaseNumber = Number(opts.caseNumber || 375669);
  const expectedImmediateOriginalCaseNumber = Number(opts.expectedImmediateOriginalCaseNumber || 373892);
  const props = PropertiesService.getScriptProperties();
  const cfg = getRemakeFactorConfig(props, {
    quickRefresh: true,
    lookbackMonths: 12,
    pageSize: 25,
    maxPages: 1,
    maxDetailFetches: 0,
    detailStrategy: 'none',
    chunkByMonth: false,
    fetchProductMap: false,
    fetchCustomerMap: false
  });
  const token = authenticateRemakeFactorApi(cfg);
  const queryCandidates = [
    'caseNumber == ' + targetCaseNumber,
    'caseNumber = ' + targetCaseNumber
  ];
  const queryErrors = [];
  let queryUsed = '';
  let caseRow = null;

  for (let index = 0; index < queryCandidates.length && !caseRow; index++) {
    const query = queryCandidates[index];
    const url = cfg.baseUrl + '/api/Cases/QueryCases?' + toRemakeFactorQueryString({
      page: 1,
      pageSize: 25,
      orderBy: 'caseNumber',
      additionalFields: 'caseProducts',
      query: query
    });

    try {
      const response = remakeFactorFetchJson(url, {
        method: 'get',
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
      });
      const rows = extractRemakeFactorRows(response.body);
      caseRow = rows.find(function(row) {
        return Number(row.caseNumber || row.caseNo || 0) === targetCaseNumber;
      }) || null;
      if (caseRow) queryUsed = query;
    } catch (error) {
      queryErrors.push({
        query: query,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  if (!caseRow) {
    const notFound = {
      ok: false,
      diagnosticOnly: true,
      targetCaseNumber: targetCaseNumber,
      message: 'The targeted case was not returned by the tested QueryCases filters.',
      queryErrors: queryErrors
    };
    console.log(JSON.stringify(notFound, null, 2));
    return notFound;
  }

  const caseId = String(caseRow.caseID || caseRow.caseId || caseRow.id || '').trim();
  const detail = caseId ? fetchRemakeFactorCaseDetail(cfg, token, caseId) : caseRow;
  const snapshots = {
    queryRow: ceramistLinkedCaseSnapshot_(caseRow),
    detailRow: ceramistLinkedCaseSnapshot_(detail)
  };
  const remakeCaseIds = ceramistRemakeCaseIds_(caseRow)
    .concat(ceramistRemakeCaseIds_(detail))
    .filter(function(value, index, values) {
      return value && values.indexOf(value) === index && value !== caseId;
    });

  const remakeLinkedCases = remakeCaseIds.map(function(remakeCaseId) {
    try {
      const linkedDetail = fetchRemakeFactorCaseDetail(cfg, token, remakeCaseId);
      return ceramistLinkedCaseSnapshot_(linkedDetail);
    } catch (error) {
      return {
        caseID: remakeCaseId,
        fetchError: error && error.message ? error.message : String(error)
      };
    }
  });
  const linkedCaseNumbers = remakeLinkedCases
    .map(function(row) { return Number(row.caseNumber || 0); })
    .filter(function(value) { return value > 0; });

  const result = {
    ok: true,
    generatedAt: new Date().toISOString(),
    diagnosticOnly: true,
    targetCaseNumber: targetCaseNumber,
    expectedImmediateOriginalCaseNumber: expectedImmediateOriginalCaseNumber,
    queryUsed: queryUsed,
    queryErrors: queryErrors,
    relationshipFieldUsed: 'remakeCaseID',
    target: snapshots,
    remakeLinkedCases: remakeLinkedCases,
    matchesExpectedImmediateOriginal: linkedCaseNumbers.indexOf(expectedImmediateOriginalCaseNumber) >= 0,
    notes: [
      'The API schema defines remakeCaseID separately from linkedToCaseID and linkedToCaseID2.',
      'Only remakeCaseID is followed for remake-to-original attribution in this diagnostic.',
      'A true result proves the API remakeCaseID field can replace a separate SQL Server case-link feed.',
      'The ceramist still comes from BigQuery tasks_all using the exact CERAMICS task across all sequences.',
      'No dashboard or cache data is changed by this diagnostic.'
    ]
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function ceramistLinkedCaseSnapshot_(row) {
  const value = row && typeof row === 'object' ? row : {};
  const snapshot = {
    caseID: value.caseID || value.caseId || value.id || '',
    caseNumber: value.caseNumber || value.caseNo || '',
    remake: value.remake || '',
    remakeReason: value.remakeReason || '',
    remakeCaseID: ceramistCaseRelationshipValue_(value, 'remakeCaseID'),
    linkedToCaseID: ceramistCaseRelationshipValue_(value, 'linkedToCaseID'),
    linkedToCaseID2: ceramistCaseRelationshipValue_(value, 'linkedToCaseID2')
  };

  Object.keys(value).forEach(function(key) {
    if (/(?:remake.*case.*id|link)/i.test(key)) snapshot[key] = value[key];
  });
  return snapshot;
}

function ceramistRemakeCaseIds_(row) {
  const value = row && typeof row === 'object' ? row : {};
  return Object.keys(value)
    .filter(function(key) {
      return /^remakeCaseID$/i.test(key);
    })
    .map(function(key) { return String(value[key] || '').trim(); })
    .filter(function(remakeCaseId) { return !!remakeCaseId; });
}

function ceramistCaseRelationshipValue_(row, fieldName) {
  const value = row && typeof row === 'object' ? row : {};
  const matchingKey = Object.keys(value).find(function(key) {
    return key.toLowerCase() === String(fieldName || '').toLowerCase();
  });
  return matchingKey ? value[matchingKey] : null;
}

function ceramistProductsSchemaSql_(cfg) {
  return `
SELECT
  column_name,
  data_type
FROM \`${cfg.projectId}.${cfg.datasetId}.INFORMATION_SCHEMA.COLUMNS\`
WHERE table_name = '${ceramistSqlLiteral_(cfg.productTable)}'
  AND REGEXP_CONTAINS(
    LOWER(column_name),
    r'(caseid|casenumber|remake|productid|teeth|quantity|department|invoicedate|totalcharge)'
  )
ORDER BY ordinal_position
`;
}

function ceramistSequenceWorkflowSql_(cfg) {
  return `
SELECT
  CAST(CaseTasks_Sequence AS INT64) AS task_sequence,
  COALESCE(NULLIF(TRIM(CAST(CaseTasks_Department AS STRING)), ''), '[Missing department]') AS task_department,
  COALESCE(NULLIF(TRIM(CAST(CaseProducts_ProductionMethod AS STRING)), ''), '[Missing production method]') AS production_method,
  COUNT(*) AS completed_rows,
  COUNT(DISTINCT Cases_CaseNumber) AS completed_cases,
  COUNT(DISTINCT NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), '')) AS distinct_products,
  COUNT(DISTINCT NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), '')) AS distinct_workers,
  MIN(DATE(CaseTasks_CompleteDate)) AS first_completion_date,
  MAX(DATE(CaseTasks_CompleteDate)) AS last_completion_date
FROM \`${cfg.projectId}.${cfg.datasetId}.${cfg.taskTable}\`
WHERE CaseTasks_CompleteDate IS NOT NULL
  AND DATE(CaseTasks_CompleteDate) >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL ${Number(cfg.lookbackDays)} DAY)
  AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = '${ceramistSqlLiteral_(cfg.taskCode)}'
GROUP BY task_sequence, task_department, production_method
ORDER BY task_sequence, completed_cases DESC, task_department, production_method
`;
}

function ceramistSequenceSummarySql_(cfg) {
  return `
SELECT
  CAST(CaseTasks_Sequence AS INT64) AS task_sequence,
  COUNT(*) AS completed_rows,
  COUNT(DISTINCT Cases_CaseNumber) AS completed_cases,
  COUNT(DISTINCT NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), '')) AS distinct_products,
  COUNT(DISTINCT NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), '')) AS distinct_workers,
  MIN(DATE(CaseTasks_CompleteDate)) AS first_completion_date,
  MAX(DATE(CaseTasks_CompleteDate)) AS last_completion_date
FROM \`${cfg.projectId}.${cfg.datasetId}.${cfg.taskTable}\`
WHERE CaseTasks_CompleteDate IS NOT NULL
  AND DATE(CaseTasks_CompleteDate) >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL ${Number(cfg.lookbackDays)} DAY)
  AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = '${ceramistSqlLiteral_(cfg.taskCode)}'
GROUP BY task_sequence
ORDER BY task_sequence
`;
}

function ceramistAttributionQualitySql_(cfg) {
  return `
WITH task_rows AS (
  SELECT
    Cases_CaseNumber,
    COALESCE(NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), ''), '[Missing product]') AS product_id,
    CAST(CaseTasks_Sequence AS INT64) AS task_sequence,
    NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), '') AS ceramist
  FROM \`${cfg.projectId}.${cfg.datasetId}.${cfg.taskTable}\`
  WHERE CaseTasks_CompleteDate IS NOT NULL
    AND DATE(CaseTasks_CompleteDate) >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL ${Number(cfg.lookbackDays)} DAY)
    AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = '${ceramistSqlLiteral_(cfg.taskCode)}'
),
product_tasks AS (
  SELECT
    Cases_CaseNumber,
    product_id,
    COUNT(*) AS task_rows,
    COUNT(DISTINCT task_sequence) AS distinct_sequences,
    COUNT(DISTINCT ceramist) AS distinct_ceramists,
    COUNTIF(ceramist IS NULL) AS missing_ceramist_rows
  FROM task_rows
  GROUP BY Cases_CaseNumber, product_id
)
SELECT
  '${ceramistSqlLiteral_(cfg.taskCode)}' AS task_code,
  COUNT(*) AS case_product_groups,
  COUNTIF(distinct_ceramists = 1 AND missing_ceramist_rows = 0) AS single_ceramist_groups,
  COUNTIF(distinct_ceramists > 1) AS multiple_ceramist_groups,
  COUNTIF(missing_ceramist_rows > 0) AS missing_ceramist_groups,
  COUNTIF(distinct_sequences > 1) AS multiple_sequence_groups,
  SUM(task_rows) AS source_task_rows,
  ROUND(100 * SAFE_DIVIDE(COUNTIF(distinct_ceramists = 1 AND missing_ceramist_rows = 0), COUNT(*)), 2) AS single_ceramist_pct
FROM product_tasks
`;
}

function ceramistSequenceOverlapSql_(cfg) {
  return `
WITH product_sequences AS (
  SELECT
    Cases_CaseNumber,
    COALESCE(NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), ''), '[Missing product]') AS product_id,
    COUNT(DISTINCT CAST(CaseTasks_Sequence AS INT64)) AS distinct_sequences
  FROM \`${cfg.projectId}.${cfg.datasetId}.${cfg.taskTable}\`
  WHERE CaseTasks_CompleteDate IS NOT NULL
    AND DATE(CaseTasks_CompleteDate) >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL ${Number(cfg.lookbackDays)} DAY)
    AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = '${ceramistSqlLiteral_(cfg.taskCode)}'
  GROUP BY Cases_CaseNumber, product_id
)
SELECT
  COUNT(*) AS case_product_groups,
  COUNTIF(distinct_sequences > 1) AS groups_with_multiple_sequences,
  MAX(distinct_sequences) AS maximum_sequences_on_one_case_product,
  ROUND(100 * SAFE_DIVIDE(COUNTIF(distinct_sequences > 1), COUNT(*)), 2) AS multiple_sequence_pct
FROM product_sequences
`;
}

function ceramistMultipleWorkerSamplesSql_(cfg) {
  return `
WITH product_tasks AS (
  SELECT
    Cases_CaseNumber,
    COALESCE(NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), ''), '[Missing product]') AS product_id,
    COUNT(*) AS task_rows,
    COUNT(DISTINCT CAST(CaseTasks_Sequence AS INT64)) AS distinct_sequences,
    STRING_AGG(
      DISTINCT COALESCE(CAST(CaseTasks_Sequence AS STRING), '[Missing sequence]'),
      ', '
      ORDER BY COALESCE(CAST(CaseTasks_Sequence AS STRING), '[Missing sequence]')
    ) AS sequences,
    COUNT(DISTINCT NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), '')) AS distinct_ceramists,
    STRING_AGG(
      DISTINCT COALESCE(NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), ''), '[Missing completed by]'),
      ', '
      ORDER BY COALESCE(NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), ''), '[Missing completed by]')
    ) AS ceramists,
    MIN(DATE(CaseTasks_CompleteDate)) AS first_completion_date,
    MAX(DATE(CaseTasks_CompleteDate)) AS last_completion_date
  FROM \`${cfg.projectId}.${cfg.datasetId}.${cfg.taskTable}\`
  WHERE CaseTasks_CompleteDate IS NOT NULL
    AND DATE(CaseTasks_CompleteDate) >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL ${Number(cfg.lookbackDays)} DAY)
    AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = '${ceramistSqlLiteral_(cfg.taskCode)}'
  GROUP BY Cases_CaseNumber, product_id
)
SELECT
  Cases_CaseNumber AS case_number,
  product_id,
  task_rows,
  distinct_sequences,
  sequences,
  distinct_ceramists,
  ceramists,
  first_completion_date,
  last_completion_date
FROM product_tasks
WHERE distinct_ceramists > 1 OR REGEXP_CONTAINS(ceramists, r'\\[Missing completed by\\]')
ORDER BY distinct_ceramists DESC, task_rows DESC, case_number DESC
LIMIT ${Math.max(1, Number(cfg.sampleLimit) || 12)}
`;
}

function ceramistSchemaSql_(cfg) {
  return `
SELECT
  column_name,
  data_type
FROM \`${cfg.projectId}.${cfg.datasetId}.INFORMATION_SCHEMA.COLUMNS\`
WHERE table_name = '${ceramistSqlLiteral_(cfg.taskTable)}'
  AND REGEXP_CONTAINS(
    LOWER(column_name),
    r'(case|product|department|task|sequence|complete|employee|user|technician)'
  )
ORDER BY ordinal_position
`;
}

function ceramistTaskInventorySql_(cfg) {
  return `
SELECT
  UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) AS task_code,
  CAST(CaseTasks_Sequence AS INT64) AS task_sequence,
  ANY_VALUE(ProductionTasks_Description) AS task_description,
  COUNT(*) AS completed_rows,
  COUNT(DISTINCT Cases_CaseNumber) AS completed_cases,
  COUNT(DISTINCT NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), '')) AS distinct_workers,
  MIN(DATE(CaseTasks_CompleteDate)) AS first_completion_date,
  MAX(DATE(CaseTasks_CompleteDate)) AS last_completion_date
FROM \`${cfg.projectId}.${cfg.datasetId}.${cfg.taskTable}\`
WHERE CaseTasks_CompleteDate IS NOT NULL
  AND DATE(CaseTasks_CompleteDate) >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL ${Number(cfg.lookbackDays)} DAY)
  AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = '${ceramistSqlLiteral_(cfg.taskCode)}'
GROUP BY task_code, task_sequence
ORDER BY task_sequence, task_code
`;
}

function ceramistSummarySql_(cfg) {
  return `
WITH ceramics AS (
  SELECT
    Cases_CaseNumber,
    COALESCE(NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), ''), '[Missing product]') AS product_id,
    NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), '') AS ceramist,
    CaseTasks_CompleteDate,
    ROW_NUMBER() OVER (
      PARTITION BY Cases_CaseNumber, COALESCE(NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), ''), '[Missing product]')
      ORDER BY CaseTasks_CompleteDate DESC
    ) AS completion_rank
  FROM \`${cfg.projectId}.${cfg.datasetId}.${cfg.taskTable}\`
  WHERE CaseTasks_CompleteDate IS NOT NULL
    AND DATE(CaseTasks_CompleteDate) >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL ${Number(cfg.lookbackDays)} DAY)
    AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = '${ceramistSqlLiteral_(cfg.taskCode)}'
)
SELECT
  COALESCE(ceramist, '[Missing completed by]') AS ceramist,
  COUNT(*) AS latest_case_product_completions,
  COUNT(DISTINCT Cases_CaseNumber) AS distinct_cases,
  MIN(DATE(CaseTasks_CompleteDate)) AS first_completion_date,
  MAX(DATE(CaseTasks_CompleteDate)) AS last_completion_date
FROM ceramics
WHERE completion_rank = 1
GROUP BY ceramist
ORDER BY latest_case_completions DESC, ceramist
`;
}

function ceramistAmbiguitySql_(cfg) {
  return `
WITH ceramics AS (
  SELECT
    Cases_CaseNumber,
    COALESCE(NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), ''), '[Missing product]') AS product_id,
    CAST(CaseTasks_Sequence AS INT64) AS task_sequence,
    NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), '') AS ceramist,
    CaseTasks_CompleteDate
  FROM \`${cfg.projectId}.${cfg.datasetId}.${cfg.taskTable}\`
  WHERE CaseTasks_CompleteDate IS NOT NULL
    AND DATE(CaseTasks_CompleteDate) >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL ${Number(cfg.lookbackDays)} DAY)
    AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = '${ceramistSqlLiteral_(cfg.taskCode)}'
)
SELECT
  Cases_CaseNumber AS case_number,
  product_id,
  COUNT(*) AS ceramics_completion_rows,
  COUNT(DISTINCT task_sequence) AS distinct_sequences,
  STRING_AGG(DISTINCT COALESCE(CAST(task_sequence AS STRING), '[Missing sequence]'), ', ' ORDER BY COALESCE(CAST(task_sequence AS STRING), '[Missing sequence]')) AS sequences,
  COUNT(DISTINCT ceramist) AS distinct_ceramists,
  STRING_AGG(DISTINCT COALESCE(ceramist, '[Missing completed by]'), ', ' ORDER BY COALESCE(ceramist, '[Missing completed by]')) AS ceramists,
  MIN(DATE(CaseTasks_CompleteDate)) AS first_completion_date,
  MAX(DATE(CaseTasks_CompleteDate)) AS last_completion_date
FROM ceramics
GROUP BY Cases_CaseNumber, product_id
HAVING COUNT(*) > 1 OR COUNT(DISTINCT ceramist) > 1 OR COUNTIF(ceramist IS NULL) > 0
ORDER BY distinct_ceramists DESC, ceramics_completion_rows DESC, case_number DESC
LIMIT 250
`;
}

function ceramistRunBigQuery_(sql, cfg) {
  const request = {
    query: sql,
    useLegacySql: false,
    timeoutMs: 10000
  };
  let response = BigQuery.Jobs.query(request, cfg.projectId, { location: cfg.location });
  const jobId = response.jobReference && response.jobReference.jobId;

  while (!response.jobComplete) {
    Utilities.sleep(250);
    response = BigQuery.Jobs.getQueryResults(cfg.projectId, jobId, {
      location: cfg.location,
      maxResults: 1000
    });
  }

  let fields = response.schema && response.schema.fields ? response.schema.fields : [];
  let rows = response.rows || [];
  let pageToken = response.pageToken || null;

  while (pageToken) {
    const page = BigQuery.Jobs.getQueryResults(cfg.projectId, jobId, {
      location: cfg.location,
      maxResults: 1000,
      pageToken: pageToken
    });
    if (!fields.length && page.schema && page.schema.fields) fields = page.schema.fields;
    rows = rows.concat(page.rows || []);
    pageToken = page.pageToken || null;
  }

  return rows.map(function(row) {
    const out = {};
    (row.f || []).forEach(function(cell, index) {
      const field = fields[index] || { name: 'column_' + index };
      out[field.name] = ceramistBigQueryValue_(cell && cell.v, field.type);
    });
    return out;
  });
}

function ceramistBigQueryValue_(value, type) {
  if (value === null || value === undefined) return null;
  if (type === 'INTEGER' || type === 'INT64') return Number(value);
  if (type === 'FLOAT' || type === 'FLOAT64' || type === 'NUMERIC' || type === 'BIGNUMERIC') return Number(value);
  if (type === 'BOOLEAN' || type === 'BOOL') return value === true || String(value).toLowerCase() === 'true';
  return value;
}

function ceramistSqlLiteral_(value) {
  return String(value === null || value === undefined ? '' : value).replace(/'/g, "''");
}