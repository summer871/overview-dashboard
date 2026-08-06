/**
 * Remake Factor validated QueryCases pagination.
 * Version: v1.35.0 - 2026-08-05
 *
 * Keeps the approved product-line Remake calculation unchanged. This override
 * changes only source retrieval and Refresh behavior:
 * - probe API totalCount;
 * - split date ranges on whole-day boundaries until each leaf fits one page;
 * - retrieve each leaf with the existing detail-enrichment path;
 * - deduplicate by caseID and fail closed when counts differ;
 * - repair the previous closed month when it lacks validation, then refresh the
 *   current month.
 */

var remakeFactorValidationVersionV1350 = 'RemakeFactorCache v1.35.0';
var remakeFactorValidationModeV1350 = 'wholeDayPartitionTotalCountValidation';
var remakeFactorLastValidationV1350 = null;
var remakeFactorRefreshCacheBaseV1350 = refreshRemakeFactorCache;

function remakeFactorTotalCountV1350(body) {
  var values = [
    body && body.totalCount,
    body && body.TotalCount,
    body && body.data && body.data.totalCount,
    body && body.data && body.data.TotalCount,
    body && body.result && body.result.totalCount,
    body && body.result && body.result.TotalCount,
    body && body.pagination && body.pagination.totalCount,
    body && body.meta && body.meta.totalCount
  ];
  for (var i = 0; i < values.length; i += 1) {
    if (values[i] === null || values[i] === undefined || values[i] === '') continue;
    var count = Number(values[i]);
    if (Number.isFinite(count) && count >= 0) return Math.floor(count);
  }
  return null;
}

function remakeFactorUtcMsV1350(value) {
  var normalized = normalizeRemakeFactorDate(value);
  if (!normalized) throw new Error('Invalid date boundary: ' + String(value || ''));
  var parts = normalized.split('-').map(Number);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function remakeFactorUtcDateV1350(milliseconds) {
  var date = new Date(milliseconds);
  return date.getUTCFullYear() + '-' +
    String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(date.getUTCDate()).padStart(2, '0');
}

function remakeFactorAddDaysV1350(value, days) {
  return remakeFactorUtcDateV1350(remakeFactorUtcMsV1350(value) + Number(days || 0) * 86400000);
}

function remakeFactorDaySpanV1350(startDate, endExclusiveDate) {
  return Math.round((remakeFactorUtcMsV1350(endExclusiveDate) - remakeFactorUtcMsV1350(startDate)) / 86400000);
}

function remakeFactorCaseKeyV1350(row) {
  var caseId = cleanRemakeFactorText(row && (row.caseID || row.caseId || row.CaseID || row.id || ''));
  if (!caseId) {
    throw new Error('QueryCases returned a row without caseID. Validated cache publication stopped.');
  }
  return caseId;
}

function remakeFactorDedupeCasesV1350(rows) {
  var map = new Map();
  (rows || []).forEach(function(row) {
    var key = remakeFactorCaseKeyV1350(row);
    if (!map.has(key)) map.set(key, row);
  });
  return Array.from(map.values()).sort(function(left, right) {
    var byDate = String(getRemakeFactorCaseInvoiceDate(left) || '')
      .localeCompare(String(getRemakeFactorCaseInvoiceDate(right) || ''));
    if (byDate) return byDate;
    return remakeFactorCaseKeyV1350(left).localeCompare(
      remakeFactorCaseKeyV1350(right),
      undefined,
      { numeric: true, sensitivity: 'base' }
    );
  });
}

function remakeFactorExactQueryV1350(startDate, endExclusiveDate) {
  return 'invoiceDate >= "' + normalizeRemakeFactorDate(startDate) + 'T00:00:00" && ' +
    'invoiceDate < "' + normalizeRemakeFactorDate(endExclusiveDate) + 'T00:00:00"';
}

function remakeFactorProbeV1350(config, token, startDate, endExclusiveDate, log, depth) {
  var pageSize = Math.max(10, Number(config.pageSize || 250));
  var query = remakeFactorExactQueryV1350(startDate, endExclusiveDate);
  var params = { page: 1, pageSize: pageSize, orderBy: 'invoiceDate', query: query };
  if (config.additionalFields) params.additionalFields = config.additionalFields;
  var response = remakeFactorFetchJson(
    config.baseUrl + '/api/Cases/QueryCases?' + toRemakeFactorQueryString(params),
    { method: 'get', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
  );
  var rows = extractRemakeFactorRows(response.body);
  var totalCount = remakeFactorTotalCountV1350(response.body);
  log.push({
    startDate: startDate,
    endExclusiveDate: endExclusiveDate,
    depth: depth,
    totalCount: totalCount,
    rowsReturned: rows.length,
    pageSize: pageSize
  });
  if (totalCount === null) {
    throw new Error('QueryCases did not return totalCount for ' + startDate + ' to ' + endExclusiveDate + '. Cache publication stopped.');
  }
  return { totalCount: totalCount, pageSize: pageSize, query: query };
}

function remakeFactorLeafRangesV1350(config, token, startDate, endExclusiveDate, log, depth) {
  if (depth > 16) throw new Error('Validated QueryCases partition depth exceeded 16.');
  var probe = remakeFactorProbeV1350(config, token, startDate, endExclusiveDate, log, depth);
  if (probe.totalCount <= probe.pageSize) {
    return [{
      startDate: startDate,
      endExclusiveDate: endExclusiveDate,
      expected: probe.totalCount,
      query: probe.query,
      depth: depth
    }];
  }
  var span = remakeFactorDaySpanV1350(startDate, endExclusiveDate);
  if (span <= 1) {
    throw new Error(
      'One invoice day contains ' + probe.totalCount + ' cases, exceeding pageSize=' + probe.pageSize +
      '. Cache publication stopped rather than using unsafe page traversal.'
    );
  }
  var midpoint = remakeFactorAddDaysV1350(startDate, Math.max(1, Math.floor(span / 2)));
  return remakeFactorLeafRangesV1350(config, token, startDate, midpoint, log, depth + 1)
    .concat(remakeFactorLeafRangesV1350(config, token, midpoint, endExclusiveDate, log, depth + 1));
}

function remakeFactorFetchLeafV1350(config, token, leaf) {
  var leafEndDate = remakeFactorAddDaysV1350(leaf.endExclusiveDate, -1);
  var leafConfig = Object.assign({}, config, {
    startDate: leaf.startDate,
    endDate: leafEndDate,
    pullOverlapDays: 0,
    chunkByMonth: false,
    quickRefresh: false,
    maxPages: 1,
    maxPagesPerChunk: 1,
    queryTemplate: 'invoiceDate >= "{queryStartDateTime}" && invoiceDate < "{queryEndExclusiveDateTime}"'
  });
  var result = fetchRemakeFactorCasesSingleRange(leafConfig, token);
  var rows = remakeFactorDedupeCasesV1350(result && result.rows || []);
  if (rows.length !== leaf.expected) {
    throw new Error(
      'QueryCases leaf validation failed for ' + leaf.startDate + ' to ' + leaf.endExclusiveDate +
      ': API totalCount=' + leaf.expected + ', unique caseIDs=' + rows.length + '. Cache publication stopped.'
    );
  }
  return { rows: rows, stats: result.stats || {} };
}

function fetchRemakeFactorCasesValidatedV1350(config, token) {
  var startDate = normalizeRemakeFactorDate(config && config.startDate);
  var endDate = normalizeRemakeFactorDate(config && config.endDate);
  if (!startDate || !endDate || startDate > endDate) {
    throw new Error('Validated QueryCases requires a valid inclusive startDate and endDate.');
  }
  var endExclusiveDate = remakeFactorAddDaysV1350(endDate, 1);
  var probeLog = [];
  var root = remakeFactorProbeV1350(config, token, startDate, endExclusiveDate, probeLog, 0);
  var leaves = root.totalCount <= root.pageSize
    ? [{ startDate: startDate, endExclusiveDate: endExclusiveDate, expected: root.totalCount, query: root.query, depth: 0 }]
    : remakeFactorLeafRangesV1350(config, token, startDate, endExclusiveDate, probeLog, 0);
  var allRows = [];
  var aggregate = {
    caseProductsInlineCount: 0,
    caseProductsMissingCount: 0,
    detailFetchCandidates: 0,
    detailFetchesAttempted: 0,
    detailFetchesSucceeded: 0,
    detailFetchesSkipped: 0,
    warnings: []
  };
  leaves.forEach(function(leaf) {
    var fetched = remakeFactorFetchLeafV1350(config, token, leaf);
    allRows = allRows.concat(fetched.rows);
    var stats = fetched.stats || {};
    aggregate.caseProductsInlineCount += Number(stats.caseProductsInlineCount || 0);
    aggregate.caseProductsMissingCount += Number(stats.caseProductsMissingCount || 0);
    aggregate.detailFetchCandidates += Number(stats.detailFetchCandidates || 0);
    aggregate.detailFetchesAttempted += Number(stats.detailFetchesAttempted || 0);
    aggregate.detailFetchesSucceeded += Number(stats.detailFetchesSucceeded || 0);
    aggregate.detailFetchesSkipped += Number(stats.detailFetchesSkipped || 0);
    (stats.warnings || []).forEach(function(warning) { aggregate.warnings.push(leaf.startDate + ': ' + warning); });
  });
  var uniqueRows = remakeFactorDedupeCasesV1350(allRows);
  if (uniqueRows.length !== root.totalCount) {
    throw new Error(
      'Final QueryCases validation failed: API totalCount=' + root.totalCount +
      ', retrieved unique caseIDs=' + uniqueRows.length + '. Cache publication stopped.'
    );
  }
  var validation = {
    version: remakeFactorValidationVersionV1350,
    paginationMode: remakeFactorValidationModeV1350,
    paginationValidated: true,
    apiExpectedTotalCount: root.totalCount,
    retrievedUniqueCaseCount: uniqueRows.length,
    rawFetchedCaseCount: uniqueRows.length,
    pagesRequested: probeLog.length + leaves.length,
    partitionCount: probeLog.length,
    leafRangeCount: leaves.length,
    requestedStartDate: startDate,
    requestedEndDate: endDate,
    queryStartDate: startDate,
    queryEndDate: endDate,
    queryEndExclusiveDate: endExclusiveDate,
    pullOverlapDays: 0,
    partitionLog: probeLog.slice(0, 80),
    partitionLogTruncated: probeLog.length > 80
  };
  remakeFactorLastValidationV1350 = validation;
  return {
    rows: uniqueRows,
    stats: Object.assign({}, aggregate, validation, {
      detailStrategy: config.detailStrategy,
      additionalFields: config.additionalFields,
      queryUsed: root.query,
      chunkByMonth: false,
      warnings: aggregate.warnings.concat([
        'QueryCases population passed totalCount validation using whole-day partitions and unique caseID deduplication.'
      ])
    })
  };
}

function refreshRemakeFactorCacheValidatedV1350(options) {
  remakeFactorLastValidationV1350 = null;
  var payload = remakeFactorRefreshCacheBaseV1350(options || {});
  var validation = remakeFactorLastValidationV1350;
  if (payload && payload.ok === true && validation && validation.paginationValidated === true) {
    payload.version = remakeFactorValidationVersionV1350;
    payload.stats = Object.assign({}, payload.stats || {}, validation, {
      version: remakeFactorValidationVersionV1350,
      warnings: [].concat((payload.stats && payload.stats.warnings) || [], [
        'Monthly shard publication passed QueryCases totalCount validation.'
      ])
    });
    writeRemakeFactorCache(payload);
  }
  return payload;
}

function remakeFactorPreviousMonthV1350() {
  var today = new Date();
  return formatRemakeFactorDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7);
}

function remakeFactorShardValidationV1350(index, monthKey) {
  var shard = index && index.shards && index.shards[monthKey];
  if (!shard || !shard.fileId) return { valid: false, month: monthKey, reason: 'missing shard' };
  try {
    var parsed = JSON.parse(DriveApp.getFileById(shard.fileId).getBlob().getDataAsString('UTF-8'));
    var stats = parsed && parsed.stats || {};
    var expected = Number(stats.apiExpectedTotalCount);
    var retrieved = Number(stats.retrievedUniqueCaseCount);
    var valid = stats.paginationValidated === true && Number.isFinite(expected) && expected === retrieved;
    return {
      valid: valid,
      month: monthKey,
      reason: valid ? '' : 'pagination validation metadata missing or failed',
      expectedTotalCount: Number.isFinite(expected) ? expected : 0,
      retrievedUniqueCaseCount: Number.isFinite(retrieved) ? retrieved : 0,
      generatedAt: parsed && parsed.generatedAt || shard.generatedAt || '',
      rowCount: Number(parsed && parsed.rowCount || shard.rowCount || 0),
      fileId: shard.fileId
    };
  } catch (error) {
    return { valid: false, month: monthKey, reason: compactRemakeFactorError(error), fileId: shard.fileId };
  }
}

function rebuildRemakeFactorValidatedMonthV1350(monthKey, options) {
  var summary = rebuildRemakeFactorOneMonthToShardV123(monthKey, options || {});
  var validation = remakeFactorShardValidationV1350(readRemakeFactorCacheIndexV118() || {}, monthKey);
  if (!summary || summary.ok !== true) throw new Error(summary && summary.message || 'Month rebuild returned ok=false.');
  if (!validation.valid) throw new Error('Month ' + monthKey + ' rebuilt without passed pagination metadata. ' + validation.reason);
  return Object.assign({}, summary, {
    validation: validation,
    paginationValidated: true,
    apiExpectedTotalCount: validation.expectedTotalCount,
    retrievedUniqueCaseCount: validation.retrievedUniqueCaseCount
  });
}

function refreshRemakeFactorValidatedSmartV1350(options) {
  var opts = options || {};
  var props = PropertiesService.getScriptProperties();
  var startMs = Date.now();
  var maxRunMs = Math.max(60000, Number(opts.maxRunMs || 4.75 * 60 * 1000));
  var maxMonths = Math.max(2, Number(opts.monthsPerRun || props.getProperty(remakeFactorSmartRefreshMonthsPerRunPropertyV123) || 3));
  var currentMonth = getRemakeFactorCurrentMonthKeyV123();
  var previousMonth = remakeFactorPreviousMonthV1350();
  var index = readRemakeFactorCacheIndexV118();
  if (!index || index.storageMode !== remakeFactorCacheStorageModeV118) {
    getRemakeFactorCacheIndexFileV118(true);
    index = readRemakeFactorCacheIndexV118();
  }
  var previousBefore = remakeFactorShardValidationV1350(index || {}, previousMonth);
  var processed = [];
  var errors = [];
  if (!previousBefore.valid && Date.now() - startMs < maxRunMs) {
    try {
      var previousSummary = rebuildRemakeFactorValidatedMonthV1350(previousMonth, opts);
      previousSummary.previousClosedMonthRepair = true;
      processed.push(previousSummary);
    } catch (error) {
      errors.push({ month: previousMonth, error: compactRemakeFactorError(error) });
    }
  }
  if (!errors.length && processed.length < maxMonths && Date.now() - startMs < maxRunMs) {
    try {
      var currentSummary = rebuildRemakeFactorValidatedMonthV1350(currentMonth, opts);
      currentSummary.currentMonthReplacement = true;
      processed.push(currentSummary);
    } catch (error) {
      errors.push({ month: currentMonth, error: compactRemakeFactorError(error) });
    }
  }
  index = readRemakeFactorCacheIndexV118();
  var previousAfter = remakeFactorShardValidationV1350(index || {}, previousMonth);
  var currentAfter = remakeFactorShardValidationV1350(index || {}, currentMonth);
  var response = {
    ok: !errors.length,
    version: remakeFactorValidationVersionV1350,
    storageMode: remakeFactorCacheStorageModeV118,
    status: errors.length ? 'ERROR' : (previousAfter.valid && currentAfter.valid ? 'COMPLETE' : 'IN_PROGRESS'),
    mode: 'validatedSmartRefresh',
    message: errors.length
      ? 'Refresh stopped because a month failed validated API retrieval. The failed month was not published.'
      : 'Previous closed month and current month passed API totalCount validation.',
    rule: 'Refresh validates the previous closed month when needed, refreshes the current month, and never publishes a month whose unique caseID count differs from API totalCount.',
    currentMonth: currentMonth,
    previousMonth: previousMonth,
    previousMonthValidationBefore: previousBefore,
    previousMonthValidationAfter: previousAfter,
    currentMonthValidationAfter: currentAfter,
    processedThisRun: processed,
    errorsThisRun: errors,
    generatedAt: new Date().toISOString()
  };
  Logger.log(JSON.stringify(response, null, 2));
  try {
    var cached = readRemakeFactorCache();
    if (cached && cached.detailRows) {
      cached.version = remakeFactorValidationVersionV1350;
      cached.message = response.message;
      cached.smartRefresh = response;
      cached.stats = Object.assign({}, cached.stats || {}, {
        version: remakeFactorValidationVersionV1350,
        paginationMode: remakeFactorValidationModeV1350,
        smartRefreshStatus: response.status,
        smartRefreshPreviousMonthValidated: previousAfter.valid,
        smartRefreshCurrentMonthValidated: currentAfter.valid,
        smartRefreshProcessedThisRun: processed
      });
      return cached;
    }
  } catch (error) {
    response.cacheReadAfterRefreshError = compactRemakeFactorError(error);
  }
  return response;
}

function rebuildRemakeFactorJuly2026ValidatedV1350() {
  var summary = rebuildRemakeFactorValidatedMonthV1350('2026-07', {
    pageSize: 250,
    maxDetailFetches: 900,
    fetchProductMap: true,
    fetchCustomerMap: true
  });
  var scheduled = null;
  try { scheduled = scheduleRemakeFactorBrowserReadyRebuildV1331(); }
  catch (error) { scheduled = { ok: false, message: compactRemakeFactorError(error) }; }
  return {
    ok: true,
    version: remakeFactorValidationVersionV1350,
    month: '2026-07',
    summary: summary,
    browserReadyRebuildScheduled: !!(scheduled && scheduled.ok),
    browserReady: scheduled,
    message: 'July 2026 passed API totalCount validation and its monthly shard was replaced.'
  };
}

function auditRemakeFactorValidatedPaginationV1350() {
  var index = readRemakeFactorCacheIndexV118();
  var currentMonth = getRemakeFactorCurrentMonthKeyV123();
  var previousMonth = remakeFactorPreviousMonthV1350();
  return {
    ok: fetchRemakeFactorCases === fetchRemakeFactorCasesValidatedV1350 &&
      refreshRemakeFactorCache === refreshRemakeFactorCacheValidatedV1350 &&
      refreshRemakeFactorMissingThenCurrentV123 === refreshRemakeFactorValidatedSmartV1350,
    version: remakeFactorValidationVersionV1350,
    currentMonthValidation: remakeFactorShardValidationV1350(index || {}, currentMonth),
    previousMonthValidation: remakeFactorShardValidationV1350(index || {}, previousMonth),
    generatedAt: new Date().toISOString()
  };
}

function installRemakeFactorValidatedPaginationV1350() {
  fetchRemakeFactorCases = fetchRemakeFactorCasesValidatedV1350;
  refreshRemakeFactorCache = refreshRemakeFactorCacheValidatedV1350;
  refreshRemakeFactorMissingThenCurrentV123 = refreshRemakeFactorValidatedSmartV1350;
}

installRemakeFactorValidatedPaginationV1350();
