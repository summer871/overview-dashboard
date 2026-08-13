/**
 * Temporary August 2026 Remake Factor root-attribution repair runner.
 * Version: v1.35.1-temp-august-repair
 *
 * Intended use:
 * - Run manually once from the Apps Script editor.
 * - Repair only the open August 2026 monthly shard with root-product attribution.
 * - Keep MT_REMAKE_ROOT_ATTRIBUTION_ENABLED=false.
 * - Restore August to the disabled/baseline form if the attributed refresh or a
 *   safety gate fails.
 * - Verify closed Jan 2025-Jul 2026 shard metadata is unchanged.
 * - Do not rebuild the browser-ready cache.
 *
 * This is a temporary operational runner and should be removed after verified use.
 */

const remakeFactorAugustRepairTargetMonthV1351 = '2026-08';
const remakeFactorAugustRepairRunnerVersionV1351 = 'v1.35.1-temp-august-repair';

function runAugust2026RootAttributionRepairV1351() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(5000)) {
    throw new Error('Could not obtain the script lock. Another Apps Script operation may be running. August repair was not started.');
  }

  try {
    validateAugust2026RootAttributionRepairDependenciesV1351();

    const statusBefore = getRemakeFactorRootProductAttributionActivationStatusV1350();

    if (!statusBefore || statusBefore.globalRootAttributionEnabled !== false) {
      throw new Error('MT_REMAKE_ROOT_ATTRIBUTION_ENABLED is not confirmed false. August repair was not started.');
    }

    const indexBefore = readRemakeFactorCacheIndexV118();

    if (!indexBefore || indexBefore.ok !== true || !indexBefore.shards) {
      throw new Error('The Remake monthly cache index is not valid. August repair was not started.');
    }

    const expectedClosedMonths = expectedClosedMonthsForAugustRepairV1351();
    const missingClosedMonths = expectedClosedMonths.filter(function(monthKey) {
      return !(indexBefore.shards[monthKey] && indexBefore.shards[monthKey].fileId);
    });

    if (missingClosedMonths.length) {
      throw new Error('Closed historical shards are missing: ' + missingClosedMonths.join(', ') + '. August repair was not started.');
    }

    const augustBefore = compactAugustRepairShardV1351(
      indexBefore.shards[remakeFactorAugustRepairTargetMonthV1351]
    );

    if (!augustBefore.fileId) {
      throw new Error('The existing August 2026 shard is missing. August repair was not started.');
    }

    const closedBefore = snapshotClosedShardsForAugustRepairV1351(indexBefore);
    const browserReadyMetaBefore = safeReadBrowserReadyMetaForAugustRepairV1351();

    logAugustRepairObjectV1351({
      ok: true,
      operation: 'August 2026 root-product-attribution repair',
      stage: 'preflight_passed',
      runnerVersion: remakeFactorAugustRepairRunnerVersionV1351,
      month: remakeFactorAugustRepairTargetMonthV1351,
      globalFlagConfirmedFalse: true,
      augustBefore: augustBefore,
      closedHistoricalMonthsVerified: expectedClosedMonths.length,
      browserReadyMetaBefore: browserReadyMetaBefore,
      note: 'Preflight passed. The next operation writes only the August 2026 monthly shard.'
    });

    console.log('AUGUST ROOT ATTRIBUTION WRITE STARTING: ' + remakeFactorAugustRepairTargetMonthV1351);

    let repairResult;

    try {
      repairResult = refreshRemakeFactorRootActivationMonthV1350(
        remakeFactorAugustRepairTargetMonthV1351,
        true
      );
    } catch (error) {
      const restore = restoreAugustBaselineForRepairV1351('attributed_refresh_threw_error');
      const indexAfterError = safeReadRemakeCacheIndexForAugustRepairV1351();

      return finishAugustRepairV1351({
        ok: false,
        operation: 'August 2026 root-product-attribution repair',
        stage: 'attributed_refresh_failed',
        runnerVersion: remakeFactorAugustRepairRunnerVersionV1351,
        month: remakeFactorAugustRepairTargetMonthV1351,
        globalFlagBefore: false,
        error: error && error.message ? error.message : String(error),
        restore: restore,
        augustBefore: augustBefore,
        augustAfterRestore: compactAugustRepairShardFromIndexV1351(indexAfterError),
        historicalClosedShardDifferencesAfterRestore: indexAfterError
          ? compareClosedShardsForAugustRepairV1351(
              closedBefore,
              snapshotClosedShardsForAugustRepairV1351(indexAfterError)
            )
          : null
      });
    }

    const repairGate = evaluateAugustRootAttributionRepairV1351(repairResult);

    if (!repairGate.pass) {
      const restore = restoreAugustBaselineForRepairV1351('repair_safety_gate_failed');
      const indexAfterRestore = safeReadRemakeCacheIndexForAugustRepairV1351();

      return finishAugustRepairV1351({
        ok: false,
        operation: 'August 2026 root-product-attribution repair',
        stage: 'repair_gate_failed_and_restore_attempted',
        runnerVersion: remakeFactorAugustRepairRunnerVersionV1351,
        month: remakeFactorAugustRepairTargetMonthV1351,
        globalFlagBefore: false,
        repairGate: repairGate,
        restore: restore,
        augustBefore: augustBefore,
        augustAfterRestore: compactAugustRepairShardFromIndexV1351(indexAfterRestore),
        historicalClosedShardDifferencesAfterRestore: indexAfterRestore
          ? compareClosedShardsForAugustRepairV1351(
              closedBefore,
              snapshotClosedShardsForAugustRepairV1351(indexAfterRestore)
            )
          : null
      });
    }

    const indexAfter = readRemakeFactorCacheIndexV118();

    if (!indexAfter || indexAfter.ok !== true || !indexAfter.shards) {
      const restore = restoreAugustBaselineForRepairV1351('post_write_cache_index_invalid');

      return finishAugustRepairV1351({
        ok: false,
        operation: 'August 2026 root-product-attribution repair',
        stage: 'post_write_cache_index_invalid_and_restore_attempted',
        runnerVersion: remakeFactorAugustRepairRunnerVersionV1351,
        month: remakeFactorAugustRepairTargetMonthV1351,
        globalFlagBefore: false,
        repairGate: repairGate,
        restore: restore,
        augustBefore: augustBefore
      });
    }

    const closedAfter = snapshotClosedShardsForAugustRepairV1351(indexAfter);
    const closedDifferences = compareClosedShardsForAugustRepairV1351(closedBefore, closedAfter);
    const augustAfter = compactAugustRepairShardV1351(
      indexAfter.shards[remakeFactorAugustRepairTargetMonthV1351]
    );

    if (closedDifferences.length) {
      const restore = restoreAugustBaselineForRepairV1351('closed_historical_shard_metadata_changed');
      const indexAfterRestore = safeReadRemakeCacheIndexForAugustRepairV1351();

      return finishAugustRepairV1351({
        ok: false,
        operation: 'August 2026 root-product-attribution repair',
        stage: 'historical_shard_guard_failed_and_restore_attempted',
        runnerVersion: remakeFactorAugustRepairRunnerVersionV1351,
        month: remakeFactorAugustRepairTargetMonthV1351,
        globalFlagBefore: false,
        repairGate: repairGate,
        historicalClosedShardDifferences: closedDifferences,
        restore: restore,
        augustBefore: augustBefore,
        augustAfterAttributedWrite: augustAfter,
        augustAfterRestore: compactAugustRepairShardFromIndexV1351(indexAfterRestore)
      });
    }

    if (augustAfter.fileId !== augustBefore.fileId) {
      const restore = restoreAugustBaselineForRepairV1351('august_shard_file_id_changed');
      const indexAfterRestore = safeReadRemakeCacheIndexForAugustRepairV1351();

      return finishAugustRepairV1351({
        ok: false,
        operation: 'August 2026 root-product-attribution repair',
        stage: 'august_file_identity_guard_failed_and_restore_attempted',
        runnerVersion: remakeFactorAugustRepairRunnerVersionV1351,
        month: remakeFactorAugustRepairTargetMonthV1351,
        globalFlagBefore: false,
        repairGate: repairGate,
        restore: restore,
        augustBefore: augustBefore,
        augustAfterAttributedWrite: augustAfter,
        augustAfterRestore: compactAugustRepairShardFromIndexV1351(indexAfterRestore)
      });
    }

    const statusAfter = getRemakeFactorRootProductAttributionActivationStatusV1350();
    const browserReadyMetaAfter = safeReadBrowserReadyMetaForAugustRepairV1351();
    const globalFlagStillFalse = !!(
      statusAfter &&
      statusAfter.globalRootAttributionEnabled === false
    );

    return finishAugustRepairV1351({
      ok: globalFlagStillFalse,
      operation: 'August 2026 root-product-attribution repair',
      stage: globalFlagStillFalse ? 'repair_verified' : 'unexpected_global_flag_change',
      runnerVersion: remakeFactorAugustRepairRunnerVersionV1351,
      month: remakeFactorAugustRepairTargetMonthV1351,
      globalFlagBefore: false,
      globalFlagAfter: statusAfter
        ? statusAfter.globalRootAttributionEnabled === true
        : null,
      globalFlagStillFalse: globalFlagStillFalse,
      repairGate: repairGate,
      augustBefore: augustBefore,
      augustAfter: augustAfter,
      augustShardFileIdPreserved: augustAfter.fileId === augustBefore.fileId,
      historicalClosedShardDifferences: closedDifferences,
      historicalClosedShardsUnchanged: closedDifferences.length === 0,
      browserReadyMetaBefore: browserReadyMetaBefore,
      browserReadyMetaAfter: browserReadyMetaAfter,
      nextStep: 'Do not change the flag yet. Review this output before any browser-ready cache rebuild.'
    });
  } finally {
    lock.releaseLock();
  }
}

function validateAugust2026RootAttributionRepairDependenciesV1351() {
  const missing = [];

  if (typeof getRemakeFactorRootProductAttributionActivationStatusV1350 !== 'function') {
    missing.push('getRemakeFactorRootProductAttributionActivationStatusV1350');
  }
  if (typeof readRemakeFactorCacheIndexV118 !== 'function') {
    missing.push('readRemakeFactorCacheIndexV118');
  }
  if (typeof refreshRemakeFactorRootActivationMonthV1350 !== 'function') {
    missing.push('refreshRemakeFactorRootActivationMonthV1350');
  }
  if (typeof evaluateRemakeFactorRootActivationMonthV1350 !== 'function') {
    missing.push('evaluateRemakeFactorRootActivationMonthV1350');
  }
  if (typeof compactRemakeFactorRootActivationStatsV1350 !== 'function') {
    missing.push('compactRemakeFactorRootActivationStatsV1350');
  }

  if (missing.length) {
    throw new Error('Required August repair dependencies are missing: ' + missing.join(', '));
  }
}

function expectedClosedMonthsForAugustRepairV1351() {
  const months = [];

  for (let year = 2025; year <= 2026; year += 1) {
    const lastMonth = year === 2025 ? 12 : 7;

    for (let month = 1; month <= lastMonth; month += 1) {
      months.push(String(year) + '-' + String(month).padStart(2, '0'));
    }
  }

  return months;
}

function compactAugustRepairShardV1351(shard) {
  const source = shard || {};

  return {
    fileId: String(source.fileId || ''),
    fileName: String(source.fileName || ''),
    rowCount: Number(source.rowCount || 0),
    generatedAt: String(source.generatedAt || '')
  };
}

function compactAugustRepairShardFromIndexV1351(index) {
  if (!index || !index.shards) {
    return null;
  }

  return compactAugustRepairShardV1351(
    index.shards[remakeFactorAugustRepairTargetMonthV1351]
  );
}

function snapshotClosedShardsForAugustRepairV1351(index) {
  const shards = index && index.shards ? index.shards : {};
  const snapshot = {};

  expectedClosedMonthsForAugustRepairV1351().forEach(function(monthKey) {
    snapshot[monthKey] = compactAugustRepairShardV1351(shards[monthKey]);
  });

  return snapshot;
}

function compareClosedShardsForAugustRepairV1351(before, after) {
  const differences = [];

  expectedClosedMonthsForAugustRepairV1351().forEach(function(monthKey) {
    const left = before && before[monthKey] ? before[monthKey] : {};
    const right = after && after[monthKey] ? after[monthKey] : {};

    ['fileId', 'fileName', 'rowCount', 'generatedAt'].forEach(function(field) {
      const leftValue = left[field] == null ? '' : left[field];
      const rightValue = right[field] == null ? '' : right[field];

      if (String(leftValue) !== String(rightValue)) {
        differences.push({
          month: monthKey,
          field: field,
          before: leftValue,
          after: rightValue
        });
      }
    });
  });

  return differences;
}

function rowCaseNumberForAugustRepairV1351(row) {
  return String(
    row &&
    (row.caseNumber || row.caseNo || row.Cases_CaseNumber || '') ||
    ''
  ).trim();
}

function rowUsesUnsafeHistoricalFallbackForAugustRepairV1351(row) {
  return !!(
    row &&
    (
      row.historicalFallbackUsed === true ||
      row.currentProductFallbackUsed === true ||
      row.immediatePreviousProductFallbackUsed === true
    )
  );
}

function compactKnownCase375669ForAugustRepairV1351(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter(function(row) {
      return rowCaseNumberForAugustRepairV1351(row) === '375669';
    })
    .slice(0, 10)
    .map(function(row) {
      return {
        caseNumber: rowCaseNumberForAugustRepairV1351(row),
        isRemake: row && row.isRemake === true,
        mappingStatus: String(row && row.remadeProductMappingStatus || ''),
        mappingMethod: String(row && row.remadeProductMappingMethod || ''),
        rootCaseNumber: Number(row && row.remadeRootCaseNumber || 0),
        remadeProductId: String(row && row.remadeProductId || ''),
        remadeProductName: String(row && row.remadeProductName || ''),
        remadeProductGroup: String(row && row.remadeProductGroup || ''),
        remadeDepartment: String(row && row.remadeDepartment || ''),
        displayLabel: String(row && row.remadeAttributionDisplayLabel || ''),
        currentProductFallbackUsed: row && row.currentProductFallbackUsed === true,
        immediatePreviousProductFallbackUsed: row && row.immediatePreviousProductFallbackUsed === true,
        historicalFallbackUsed: row && row.historicalFallbackUsed === true
      };
    });
}

function knownCase375669PassIfPresentForAugustRepairV1351(knownRows) {
  if (!knownRows.length) {
    return null;
  }

  return knownRows.some(function(row) {
    return (
      row.mappingStatus === 'REVIEW_AMBIGUOUS_ROOT_PRODUCT' &&
      row.rootCaseNumber === 361499 &&
      !row.remadeProductId &&
      !row.remadeProductName &&
      !row.remadeProductGroup &&
      !row.remadeDepartment &&
      row.displayLabel === 'Review - Ambiguous Root Product' &&
      row.currentProductFallbackUsed === false &&
      row.immediatePreviousProductFallbackUsed === false &&
      row.historicalFallbackUsed === false
    );
  });
}

function evaluateAugustRootAttributionRepairV1351(result) {
  const rootStats = result && result.stats
    ? result.stats.rootProductAttribution
    : null;
  const baseGate = evaluateRemakeFactorRootActivationMonthV1350(result, rootStats);
  const rows = result && Array.isArray(result.detailRows)
    ? result.detailRows
    : [];
  const remakeRows = rows.filter(function(row) {
    return row && row.isRemake === true;
  });
  const missingMappingStatusRows = remakeRows.filter(function(row) {
    return !String(row.remadeProductMappingStatus || '').trim();
  }).length;
  const unsafeReturnedRows = remakeRows.filter(function(row) {
    return rowUsesUnsafeHistoricalFallbackForAugustRepairV1351(row);
  }).length;
  const knownCase375669 = compactKnownCase375669ForAugustRepairV1351(rows);
  const knownCasePass = knownCase375669PassIfPresentForAugustRepairV1351(
    knownCase375669
  );
  const reasons = baseGate && Array.isArray(baseGate.reasons)
    ? baseGate.reasons.slice()
    : ['base_activation_gate_unavailable'];

  if (missingMappingStatusRows > 0) {
    reasons.push('returned_remake_rows_missing_mapping_status');
  }

  if (unsafeReturnedRows > 0) {
    reasons.push('returned_rows_contain_unsafe_fallback');
  }

  if (knownCasePass === false) {
    reasons.push('known_case_375669_failed');
  }

  return {
    pass: reasons.length === 0,
    reasons: reasons,
    generatedAt: String(result && result.generatedAt || ''),
    dateRange: result && result.dateRange ? result.dateRange : {},
    detailRows: rows.length,
    remakeRows: remakeRows.length,
    missingMappingStatusRows: missingMappingStatusRows,
    unsafeReturnedRows: unsafeReturnedRows,
    rootStats: rootStats
      ? compactRemakeFactorRootActivationStatsV1350(rootStats)
      : null,
    knownCase375669: knownCase375669,
    knownCasePassIfPresent: knownCasePass
  };
}

function restoreAugustBaselineForRepairV1351(reason) {
  try {
    const restoreResult = refreshRemakeFactorRootActivationMonthV1350(
      remakeFactorAugustRepairTargetMonthV1351,
      false
    );

    return {
      attempted: true,
      ok: !!(restoreResult && restoreResult.ok),
      reason: reason,
      result: {
        ok: !!(restoreResult && restoreResult.ok),
        generatedAt: String(restoreResult && restoreResult.generatedAt || ''),
        dateRange: restoreResult && restoreResult.dateRange
          ? restoreResult.dateRange
          : {},
        detailRows: restoreResult && Array.isArray(restoreResult.detailRows)
          ? restoreResult.detailRows.length
          : 0,
        rootProductAttributionStatsPresent: !!(
          restoreResult &&
          restoreResult.stats &&
          restoreResult.stats.rootProductAttribution
        )
      },
      error: ''
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      reason: reason,
      result: null,
      error: error && error.message ? error.message : String(error)
    };
  }
}

function safeReadRemakeCacheIndexForAugustRepairV1351() {
  try {
    return readRemakeFactorCacheIndexV118();
  } catch (error) {
    return null;
  }
}

function safeReadBrowserReadyMetaForAugustRepairV1351() {
  if (typeof getRemakeFactorBrowserReadyMetaV1330 !== 'function') {
    return {
      ok: false,
      message: 'getRemakeFactorBrowserReadyMetaV1330 is not available.'
    };
  }

  try {
    return getRemakeFactorBrowserReadyMetaV1330();
  } catch (error) {
    return {
      ok: false,
      message: error && error.message ? error.message : String(error)
    };
  }
}

function finishAugustRepairV1351(result) {
  logAugustRepairObjectV1351(result);
  return result;
}

function logAugustRepairObjectV1351(value) {
  const output = JSON.stringify(value, null, 2);
  Logger.log(output);

  try {
    console.log(output);
  } catch (error) {
    // Logger output is authoritative in the Apps Script editor.
  }
}
