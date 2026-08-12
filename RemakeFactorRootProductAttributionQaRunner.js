/**
 * Remake Factor Root Product Attribution QA + Activation Runner
 * Version: v1.1.0 - 2026-08-09
 * State: Controlled activation helper
 *
 * Purpose:
 * - Keep the existing read-only 50-case QA logger.
 * - Backfill root-product attribution one month at a time without resetting the
 *   existing monthly shard cache.
 * - Keep MT_REMAKE_ROOT_ATTRIBUTION_ENABLED=false while backfill is in progress.
 * - Restore the affected month to the disabled/baseline form if a safety gate fails.
 * - Enable MT_REMAKE_ROOT_ATTRIBUTION_ENABLED only after every target month passes.
 *
 * Safety:
 * - No cache-index reset.
 * - No trigger install/delete/update.
 * - No dashboard/UI changes.
 * - No Git operations.
 * - One month is processed per manual execution.
 */

const remakeFactorRootActivationStatePropertyV1350 = 'MT_REMAKE_ROOT_ATTRIBUTION_ACTIVATION_STATE_V1350';
const remakeFactorRootActivationVersionV1350 = 'root-product-attribution-activation-v1.35.0';
const remakeFactorRootActivationMaxApiCallsV1350 = 600;
const remakeFactorRootActivationMaxRuntimeMsV1350 = 180000;

function runRemakeFactorRootProductAttributionIntegrationV1350() {
  if (typeof profileRemakeFactorRootProductAttributionIntegrationV1350 !== 'function') {
    throw new Error('profileRemakeFactorRootProductAttributionIntegrationV1350 is not available in this Apps Script project.');
  }

  const result = profileRemakeFactorRootProductAttributionIntegrationV1350({
    maxCases: 50,
    samplesPerBucket: 2
  });

  logRemakeFactorRootActivationObjectV1350(result);
  return result;
}

function runRemakeFactorRootProductAttributionActivationStepV1350() {
  validateRemakeFactorRootActivationDependenciesV1350();

  const props = PropertiesService.getScriptProperties();
  const enabledProperty = remakeFactorRootAttributionEnabledPropertyV1350;
  const maxApiCallsProperty = remakeFactorRootAttributionMaxApiCallsPropertyV1350;
  const maxRuntimeProperty = remakeFactorRootAttributionMaxRuntimeMsPropertyV1350;
  const currentMonth = getRemakeFactorCurrentMonthKeyV123();
  const targetMonths = buildRemakeFactorRootActivationMonthOrderV1350(currentMonth);

  let state = readRemakeFactorRootActivationStateV1350(props);

  if (!state || state.version !== remakeFactorRootActivationVersionV1350) {
    state = {
      version: remakeFactorRootActivationVersionV1350,
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: '',
      currentMonth: currentMonth,
      months: targetMonths,
      nextIndex: 0,
      processedMonths: [],
      failedMonth: '',
      failure: null,
      maxApiCalls: remakeFactorRootActivationMaxApiCallsV1350,
      maxRuntimeMs: remakeFactorRootActivationMaxRuntimeMsV1350
    };
    props.setProperty(enabledProperty, 'false');
    saveRemakeFactorRootActivationStateV1350(props, state);
  }

  if (state.status === 'FAILED') {
    const failedResponse = buildRemakeFactorRootActivationStatusResponseV1350(props, state, null);
    failedResponse.ok = false;
    failedResponse.message = 'Activation is stopped on a failed month. The affected month was restored to disabled baseline. Review the failure before retrying.';
    logRemakeFactorRootActivationObjectV1350(failedResponse);
    return failedResponse;
  }

  if (state.status === 'COMPLETE') {
    const completeResponse = buildRemakeFactorRootActivationStatusResponseV1350(props, state, null);
    completeResponse.message = 'Root-product attribution activation is already complete.';
    logRemakeFactorRootActivationObjectV1350(completeResponse);
    return completeResponse;
  }

  if (!Array.isArray(state.months) || !state.months.length) {
    throw new Error('Activation state has no target months.');
  }

  if (state.nextIndex >= state.months.length) {
    finalizeRemakeFactorRootActivationStateV1350(props, state, enabledProperty, maxApiCallsProperty, maxRuntimeProperty);
    const finishedResponse = buildRemakeFactorRootActivationStatusResponseV1350(props, state, null);
    finishedResponse.message = 'All target months had already passed. Root-product attribution is now enabled.';
    logRemakeFactorRootActivationObjectV1350(finishedResponse);
    return finishedResponse;
  }

  // Global activation stays disabled until every month succeeds.
  props.setProperty(enabledProperty, 'false');

  const monthKey = state.months[state.nextIndex];
  const monthResult = refreshRemakeFactorRootActivationMonthV1350(monthKey, true);
  const rootStats = monthResult && monthResult.stats ? monthResult.stats.rootProductAttribution : null;
  const gate = evaluateRemakeFactorRootActivationMonthV1350(monthResult, rootStats);

  if (!gate.pass) {
    let restoreResult = null;
    let restoreError = '';

    try {
      restoreResult = refreshRemakeFactorRootActivationMonthV1350(monthKey, false);
    } catch (error) {
      restoreError = error && error.message ? error.message : String(error);
    }

    props.setProperty(enabledProperty, 'false');
    state.status = 'FAILED';
    state.failedMonth = monthKey;
    state.failure = {
      at: new Date().toISOString(),
      reasons: gate.reasons,
      rootStats: compactRemakeFactorRootActivationStatsV1350(rootStats),
      restoreOk: !!(restoreResult && restoreResult.ok),
      restoreError: restoreError
    };
    state.updatedAt = new Date().toISOString();
    saveRemakeFactorRootActivationStateV1350(props, state);

    const failedResponse = buildRemakeFactorRootActivationStatusResponseV1350(props, state, {
      month: monthKey,
      gate: gate,
      rootStats: compactRemakeFactorRootActivationStatsV1350(rootStats),
      restoreOk: !!(restoreResult && restoreResult.ok),
      restoreError: restoreError
    });
    failedResponse.ok = false;
    failedResponse.message = 'Activation safety gate failed for ' + monthKey + '. That month was restored to disabled baseline and global root attribution remains disabled.';
    logRemakeFactorRootActivationObjectV1350(failedResponse);
    return failedResponse;
  }

  state.processedMonths.push(buildRemakeFactorRootActivationMonthSummaryV1350(monthKey, monthResult, rootStats));
  state.nextIndex += 1;
  state.failedMonth = '';
  state.failure = null;
  state.updatedAt = new Date().toISOString();

  if (state.nextIndex >= state.months.length) {
    finalizeRemakeFactorRootActivationStateV1350(props, state, enabledProperty, maxApiCallsProperty, maxRuntimeProperty);
  } else {
    saveRemakeFactorRootActivationStateV1350(props, state);
  }

  const response = buildRemakeFactorRootActivationStatusResponseV1350(props, state, {
    month: monthKey,
    gate: gate,
    rootStats: compactRemakeFactorRootActivationStatsV1350(rootStats)
  });
  response.message = state.status === 'COMPLETE'
    ? 'Final month passed. Root-product attribution is now globally enabled.'
    : 'Month ' + monthKey + ' passed. Run this same function again to process the next month.';

  logRemakeFactorRootActivationObjectV1350(response);
  return response;
}

function getRemakeFactorRootProductAttributionActivationStatusV1350() {
  validateRemakeFactorRootActivationDependenciesV1350();
  const props = PropertiesService.getScriptProperties();
  const state = readRemakeFactorRootActivationStateV1350(props);
  const response = buildRemakeFactorRootActivationStatusResponseV1350(props, state, null);
  logRemakeFactorRootActivationObjectV1350(response);
  return response;
}

function validateRemakeFactorRootActivationDependenciesV1350() {
  if (typeof getRemakeFactorComparisonMonthsV120 !== 'function') throw new Error('getRemakeFactorComparisonMonthsV120 is not available.');
  if (typeof getRemakeFactorCurrentMonthKeyV123 !== 'function') throw new Error('getRemakeFactorCurrentMonthKeyV123 is not available.');
  if (typeof getRemakeFactorMonthRangeV120 !== 'function') throw new Error('getRemakeFactorMonthRangeV120 is not available.');
  if (typeof refreshRemakeFactorCache !== 'function') throw new Error('refreshRemakeFactorCache is not available.');

  if (typeof remakeFactorRootAttributionEnabledPropertyV1350 === 'undefined') {
    throw new Error('remakeFactorRootAttributionEnabledPropertyV1350 is not available.');
  }
  if (typeof remakeFactorRootAttributionMaxApiCallsPropertyV1350 === 'undefined') {
    throw new Error('remakeFactorRootAttributionMaxApiCallsPropertyV1350 is not available.');
  }
  if (typeof remakeFactorRootAttributionMaxRuntimeMsPropertyV1350 === 'undefined') {
    throw new Error('remakeFactorRootAttributionMaxRuntimeMsPropertyV1350 is not available.');
  }
}

function buildRemakeFactorRootActivationMonthOrderV1350(currentMonth) {
  const allMonths = getRemakeFactorComparisonMonthsV120();
  const current = String(currentMonth || '');
  const closedMonths = allMonths.filter(function(monthKey) {
    return String(monthKey || '') !== current;
  });
  return current ? closedMonths.concat([current]) : closedMonths;
}

function refreshRemakeFactorRootActivationMonthV1350(monthKey, attributionEnabled) {
  const range = getRemakeFactorMonthRangeV120(monthKey);
  return refreshRemakeFactorCache({
    forceRefresh: true,
    fullRefresh: true,
    historicalRebuild: true,
    incrementalRefresh: false,
    quickRefresh: false,
    startDate: range.startDate,
    endDate: range.endDate,
    lookbackMonths: 1,
    pageSize: 250,
    maxPages: 90,
    maxPagesPerChunk: 90,
    maxDetailFetches: 900,
    fetchProductMap: true,
    fetchCustomerMap: true,
    chunkByMonth: false,
    rootProductAttributionEnabled: attributionEnabled === true,
    rootProductAttributionMaxApiCalls: remakeFactorRootActivationMaxApiCallsV1350,
    rootProductAttributionMaxRuntimeMs: remakeFactorRootActivationMaxRuntimeMsV1350
  });
}

function evaluateRemakeFactorRootActivationMonthV1350(result, rootStats) {
  const reasons = [];
  const reconciliation = rootStats && rootStats.reconciliation ? rootStats.reconciliation : null;

  if (!result || result.ok !== true) reasons.push('refresh_result_not_ok');
  if (!rootStats || rootStats.enabled !== true) reasons.push('root_attribution_stats_missing_or_disabled');
  if (rootStats && rootStats.budgetExhausted === true) reasons.push('root_attribution_budget_exhausted');
  if (rootStats && Array.isArray(rootStats.apiErrors) && rootStats.apiErrors.length) reasons.push('root_attribution_api_errors');
  if (!reconciliation || reconciliation.overallPass !== true) reasons.push('reconciliation_failed');
  if (reconciliation && reconciliation.eventRetentionPass !== true) reasons.push('event_retention_failed');
  if (reconciliation && reconciliation.noFallbackPass !== true) reasons.push('unsafe_fallback_detected');
  if (reconciliation && reconciliation.exactRootIntegrityPass !== true) reasons.push('exact_root_integrity_failed');
  if (reconciliation && reconciliation.displayCoveragePass !== true) reasons.push('display_coverage_failed');
  if (reconciliation && reconciliation.metadataCoveragePass !== true) reasons.push('metadata_coverage_failed');

  return {
    pass: reasons.length === 0,
    reasons: reasons
  };
}

function compactRemakeFactorRootActivationStatsV1350(rootStats) {
  const stats = rootStats || {};
  const reconciliation = stats.reconciliation || {};
  return {
    enabled: stats.enabled === true,
    inputRows: Number(stats.inputRows || 0),
    remakeRows: Number(stats.remakeRows || 0),
    processedRemakeCases: Number(stats.processedRemakeCases || 0),
    apiCalls: Number(stats.apiCalls || 0),
    apiCallLimit: Number(stats.apiCallLimit || 0),
    runtimeMs: Number(stats.runtimeMs || 0),
    runtimeLimitMs: Number(stats.runtimeLimitMs || 0),
    budgetExhausted: stats.budgetExhausted === true,
    apiErrors: Array.isArray(stats.apiErrors) ? stats.apiErrors.slice(0, 10) : [],
    statusCounts: stats.statusCounts || {},
    reconciliation: {
      rowCountDelta: Number(reconciliation.rowCountDelta || 0),
      uniqueCaseCountDelta: Number(reconciliation.uniqueCaseCountDelta || 0),
      remakeUnitsDelta: Number(reconciliation.remakeUnitsDelta || 0),
      remakeDiscountDelta: Number(reconciliation.remakeDiscountDelta || 0),
      unsafeFallbackRows: Number(reconciliation.unsafeFallbackRows || 0),
      exactRowsNotUsingRoot: Number(reconciliation.exactRowsNotUsingRoot || 0),
      exactRowsWithDifferentProductId: Number(reconciliation.exactRowsWithDifferentProductId || 0),
      eventRetentionPass: reconciliation.eventRetentionPass === true,
      noFallbackPass: reconciliation.noFallbackPass === true,
      exactRootIntegrityPass: reconciliation.exactRootIntegrityPass === true,
      displayCoveragePass: reconciliation.displayCoveragePass === true,
      metadataCoveragePass: reconciliation.metadataCoveragePass === true,
      overallPass: reconciliation.overallPass === true
    }
  };
}

function buildRemakeFactorRootActivationMonthSummaryV1350(monthKey, result, rootStats) {
  const compact = compactRemakeFactorRootActivationStatsV1350(rootStats);
  return {
    month: monthKey,
    generatedAt: result && result.generatedAt ? result.generatedAt : '',
    remakeRows: compact.remakeRows,
    processedRemakeCases: compact.processedRemakeCases,
    apiCalls: compact.apiCalls,
    runtimeMs: compact.runtimeMs,
    exactRootRows: Number((compact.statusCounts && compact.statusCounts.ATTRIBUTED_EXACT_ROOT) || 0),
    reviewRows: Number((compact.statusCounts && compact.statusCounts.REVIEW_NON_EXACT_SINGLE_ROOT) || 0) +
      Number((compact.statusCounts && compact.statusCounts.REVIEW_AMBIGUOUS_ROOT_PRODUCT) || 0) +
      Number((compact.statusCounts && compact.statusCounts.REVIEW_NO_ROOT_PRODUCTS) || 0) +
      Number((compact.statusCounts && compact.statusCounts.REVIEW_ROOT_UNRESOLVED) || 0),
    unresolvedRows: Number((compact.statusCounts && compact.statusCounts.UNRESOLVED_NO_REMAKE_ROOT) || 0) +
      Number((compact.statusCounts && compact.statusCounts.UNRESOLVED_UNCONFIRMED_ROOT) || 0) +
      Number((compact.statusCounts && compact.statusCounts.UNRESOLVED_BROKEN_CHAIN) || 0) +
      Number((compact.statusCounts && compact.statusCounts.UNRESOLVED_CYCLE) || 0) +
      Number((compact.statusCounts && compact.statusCounts.UNRESOLVED_OTHER_CHAIN) || 0),
    overallPass: compact.reconciliation.overallPass === true
  };
}

function finalizeRemakeFactorRootActivationStateV1350(props, state, enabledProperty, maxApiCallsProperty, maxRuntimeProperty) {
  state.status = 'COMPLETE';
  state.completedAt = new Date().toISOString();
  state.updatedAt = state.completedAt;
  state.failedMonth = '';
  state.failure = null;

  props.setProperties({
    [enabledProperty]: 'true',
    [maxApiCallsProperty]: String(remakeFactorRootActivationMaxApiCallsV1350),
    [maxRuntimeProperty]: String(remakeFactorRootActivationMaxRuntimeMsV1350)
  });
  saveRemakeFactorRootActivationStateV1350(props, state);
}

function readRemakeFactorRootActivationStateV1350(props) {
  try {
    const raw = props.getProperty(remakeFactorRootActivationStatePropertyV1350);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveRemakeFactorRootActivationStateV1350(props, state) {
  props.setProperty(remakeFactorRootActivationStatePropertyV1350, JSON.stringify(state || {}));
}

function buildRemakeFactorRootActivationStatusResponseV1350(props, state, currentStep) {
  const sourceState = state || null;
  const enabledRaw = props.getProperty(remakeFactorRootAttributionEnabledPropertyV1350) || '';
  const maxApiCallsRaw = props.getProperty(remakeFactorRootAttributionMaxApiCallsPropertyV1350) || '';
  const maxRuntimeRaw = props.getProperty(remakeFactorRootAttributionMaxRuntimeMsPropertyV1350) || '';
  const months = sourceState && Array.isArray(sourceState.months) ? sourceState.months : [];
  const nextIndex = sourceState ? Number(sourceState.nextIndex || 0) : 0;

  return {
    ok: !sourceState || sourceState.status !== 'FAILED',
    version: remakeFactorRootActivationVersionV1350,
    status: sourceState ? sourceState.status : 'NOT_STARTED',
    globalRootAttributionEnabled: String(enabledRaw).toLowerCase() === 'true',
    globalMaxApiCalls: maxApiCallsRaw,
    globalMaxRuntimeMs: maxRuntimeRaw,
    monthsTotal: months.length,
    monthsDone: Math.min(nextIndex, months.length),
    monthsRemaining: Math.max(0, months.length - nextIndex),
    nextMonth: months[nextIndex] || '',
    processedMonths: sourceState && Array.isArray(sourceState.processedMonths) ? sourceState.processedMonths : [],
    failedMonth: sourceState && sourceState.failedMonth ? sourceState.failedMonth : '',
    failure: sourceState && sourceState.failure ? sourceState.failure : null,
    currentStep: currentStep || null,
    startedAt: sourceState && sourceState.startedAt ? sourceState.startedAt : '',
    updatedAt: sourceState && sourceState.updatedAt ? sourceState.updatedAt : '',
    completedAt: sourceState && sourceState.completedAt ? sourceState.completedAt : ''
  };
}

function logRemakeFactorRootActivationObjectV1350(value) {
  const output = JSON.stringify(value, null, 2);
  Logger.log(output);
  try {
    console.log(output);
  } catch (error) {
    // Logger output is authoritative for this helper.
  }
}
