/**
 * Remake Factor Product Attribution Audit
 * Version: v1.1.6 - 2026-08-08
 * State: Prepared only - diagnostic/read-only staging helper
 * Base repository: summer871/overview-dashboard
 * Base branch: agent/v6.544-shared-table-platform-5118
 * Base commit: 265adaa13c6831bab0b936671310f39c89c85719
 * Base RemakeFactorCache.js blob: aed425019b4d4532dcf530096b55919b7834548d
 * Base CaeramistRemakeProfiler.js blob: 3317a08d16ea8008298676201b71171f01eaff59
 *
 * Purpose:
 * - Build a case-level audit for remake-product attribution without changing the
 *   existing Remake Factor cache, dashboard, filters, exports, triggers, or UI.
 * - Preserve the current remake event as authoritative while separately tracing
 *   current case -> immediate previous case -> root case through CRM remakeCaseID.
 * - Keep current replacement-product fields separate from historical candidates.
 * - Treat "No Remake Root" only when CRM case detail explicitly exposes a
 *   blank remakeCaseID. A missing/unconfirmed remakeCaseID field is a separate
 *   Unconfirmed Root review state and is never treated as no-root.
 * - Surface broken links, cycles, multiple historical products, and unresolved
 *   mappings as review states instead of silently falling back to current product.
 * - Read the existing Ceramist responsibility cache directly from its raw Drive
 *   JSON file. Do not call the dashboard badge/name enrichment path, because that
 *   path can attempt alert email side effects when lookup metadata is incomplete.
 * - Do not recompute or rewrite Ceramist responsibility in this audit helper.
 * - Provide compact QA outputs plus a direct CRM query-vs-detail diagnostic for
 *   a specific chain endpoint such as case 361499.
 * - Sample confirmed/resolved Ceramist-sidecar root candidates and compare the
 *   QueryCases vs direct-detail remakeCaseID serialization behavior.
 * - v1.1.3 applies the observed linked-terminal serialization rule only after a
 *   chain already exists: when linked-case detail omits remakeCaseID, an exact
 *   QueryCases row for the same case may confirm a blank terminal link or supply
 *   the next link. Current-case No Remake Root semantics remain unchanged.
 * - v1.1.4 leaves the v1.1.3 chain/no-root policy unchanged and adds a
 *   row-level candidate-comparison diagnostic across the same audit population.
 *   It compares immediate-previous vs root candidate status, method, and product
 *   without selecting either source or writing a final attribution.
 * - v1.1.5 leaves all v1.1.4 chain and candidate behavior unchanged and adds
 *   a narrow root-first decision-validation view over multi-chain rows only. It
 *   projects what a root-first rule would map or leave for review, but still does
 *   not write or apply any final dashboard/product attribution.
 * - v1.1.6 preserves all v1.1.5 behavior and adds two compact evidence-only QA
 *   views: one isolates every non-exact single-root candidate in the 50-case
 *   sample; the other models explicit unresolved dashboard buckets while keeping
 *   every valid remake event in counts. It does not approve a non-exact fallback
 *   or change any dashboard, cache, filter, export, or production behavior.
 *
 * This file intentionally performs NO writes. It does not call cache writers,
 * trigger installers, Drive file.setContent(), GitHub, or deployment functions.
 */

const remakeProductAttributionAuditVersionV1 = 'remake-product-attribution-audit-v1.1.6';
const remakeProductAttributionNoRootLabelV1 = 'No Remake Root';
const remakeProductAttributionReviewLabelV1 = 'Unresolved / Review';
const remakeProductAttributionDefaultMaxCasesV1 = 100;
const remakeProductAttributionMaxChainDepthV1 = 25;
const remakeProductAttributionCeramistCacheFileIdPropertyV1 = 'MT_CERAMIST_REMAKE_CACHE_FILE_ID';
const remakeProductAttributionTerminalRootDefaultSampleSizeV1 = 12;
const remakeProductAttributionTerminalRootMaxSampleSizeV1 = 20;
const remakeProductAttributionTerminalRootPolicyVersionV1 = 'linked-terminal-query-fallback-v1.1.3';

/**
 * Main read-only audit entry point.
 *
 * Options:
 * - caseNumbers: optional array of numeric case numbers to audit.
 * - maxCases: maximum unique remake cases to audit when caseNumbers is omitted.
 * - includeCaseSummaries: default true.
 * - includeAuditRows: default true.
 * - includeCeramist: default true; reads the existing Ceramist Drive cache only.
 *
 * This function does not write any cache or file.
 */
function buildRemakeProductAttributionAuditV1(options) {
  const opts = options || {};
  const maxCases = Math.max(1, Number(opts.maxCases || remakeProductAttributionDefaultMaxCasesV1));
  const requestedCaseNumbers = normalizeRemakeAttributionCaseNumberListV1(opts.caseNumbers || []);
  const includeCaseSummaries = opts.includeCaseSummaries !== false;
  const includeAuditRows = opts.includeAuditRows !== false;
  const includeCeramist = opts.includeCeramist !== false;
  const startedAt = new Date();

  const cached = readRemakeFactorCache({ compactForBrowser: false });
  if (!cached || cached.ok !== true || !Array.isArray(cached.detailRows)) {
    return {
      ok: false,
      version: remakeProductAttributionAuditVersionV1,
      diagnosticOnly: true,
      message: cached && cached.message ? cached.message : 'Remake Factor cache is not available.',
      generatedAt: new Date().toISOString(),
      stats: {},
      caseSummaries: [],
      auditRows: []
    };
  }

  const remakeRows = cached.detailRows.filter(function(row) {
    return row && row.isRemake === true;
  });
  const groupedCases = groupRemakeAttributionRowsByCaseV1(remakeRows);
  let caseKeys = Object.keys(groupedCases);

  if (requestedCaseNumbers.length) {
    const requestedMap = {};
    requestedCaseNumbers.forEach(function(caseNumber) {
      requestedMap[String(caseNumber)] = true;
    });
    caseKeys = caseKeys.filter(function(caseKey) {
      const firstRow = groupedCases[caseKey] && groupedCases[caseKey][0];
      return firstRow && requestedMap[String(Number(firstRow.caseNumber || 0))] === true;
    });
  }

  caseKeys.sort(function(leftKey, rightKey) {
    const left = groupedCases[leftKey] && groupedCases[leftKey][0];
    const right = groupedCases[rightKey] && groupedCases[rightKey][0];
    return Number(left && left.caseNumber || 0) - Number(right && right.caseNumber || 0);
  });

  const totalEligibleCases = caseKeys.length;
  caseKeys = caseKeys.slice(0, maxCases);

  const props = PropertiesService.getScriptProperties();
  const config = getRemakeFactorConfig(props, {
    quickRefresh: true,
    pageSize: 25,
    maxPages: 1,
    maxDetailFetches: 0,
    detailStrategy: 'none',
    chunkByMonth: false,
    fetchProductMap: false,
    fetchCustomerMap: false
  });
  const token = authenticateRemakeFactorApi(config);
  const caseMemo = {};
  const ceramistMap = includeCeramist ? loadRemakeAttributionCeramistMapV1() : {};
  const caseSummaries = [];
  const auditRows = [];

  caseKeys.forEach(function(caseKey) {
    const currentRows = groupedCases[caseKey] || [];
    if (!currentRows.length) return;

    const firstRow = currentRows[0];
    const ceramist = ceramistMap[String(Number(firstRow.caseNumber || 0))] || {};
    let currentCase = null;
    let chain;

    try {
      currentCase = fetchRemakeAttributionCurrentCaseV1(config, token, firstRow, caseMemo);
      chain = resolveRemakeAttributionChainV1(config, token, currentCase, caseMemo);
    } catch (error) {
      chain = buildRemakeAttributionUnconfirmedCurrentChainV1(firstRow, error);
    }

    const previousProducts = extractRemakeAttributionCaseProductsV1(chain.previousCase);
    const rootProducts = extractRemakeAttributionCaseProductsV1(chain.rootCase);

    const caseSummary = buildRemakeAttributionCaseSummaryV1(
      firstRow,
      currentRows,
      currentCase,
      chain,
      previousProducts,
      rootProducts,
      ceramist
    );

    if (includeCaseSummaries) caseSummaries.push(caseSummary);

    if (includeAuditRows) {
      currentRows.forEach(function(currentRow) {
        auditRows.push(buildRemakeAttributionAuditRowV1(
          currentRow,
          currentCase,
          chain,
          previousProducts,
          rootProducts,
          ceramist
        ));
      });
    }
  });

  const stats = buildRemakeAttributionAuditStatsV1(caseSummaries, auditRows, totalEligibleCases, caseKeys.length);
  stats.startedAt = startedAt.toISOString();
  stats.finishedAt = new Date().toISOString();
  stats.sourceCacheGeneratedAt = cached.generatedAt || '';
  stats.sourceRemakeRows = remakeRows.length;

  return {
    ok: true,
    version: remakeProductAttributionAuditVersionV1,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: new Date().toISOString(),
    source: 'Existing Remake Factor Drive cache + live CRM case-detail remakeCaseID confirmation + exact QueryCases linked-terminal fallback + raw Ceramist Drive cache alignment',
    mappingRuleState: 'AUDIT_ONLY_PENDING_BUSINESS_RULE',
    noRootPolicy: 'Current-case No Remake Root still requires CRM case detail to explicitly expose a blank remakeCaseID. The QueryCases fallback is allowed only for a linked historical terminal reached after a nonblank remakeCaseID chain already exists. Current product is preserved separately and is never relabeled as historical attribution.',
    linkedTerminalPolicy: 'When linked-case detail omits remakeCaseID, exact QueryCases for the same case must match the case identity and expose remakeCaseID. Blank confirms the terminal root; nonblank continues the chain; missing/mismatched/error remains Unconfirmed Root.',
    linkedTerminalPolicyVersion: remakeProductAttributionTerminalRootPolicyVersionV1,
    noRootDimensionPolicyState: 'CANDIDATE_ONLY_PENDING_BUSINESS_APPROVAL',
    stats: stats,
    caseSummaries: includeCaseSummaries ? caseSummaries : [],
    auditRows: includeAuditRows ? auditRows : []
  };
}

/**
 * Compact profiler intended for Apps Script execution logs/results.
 */
function profileRemakeProductAttributionAuditV1(options) {
  const opts = Object.assign({}, options || {}, {
    includeCaseSummaries: true,
    includeAuditRows: true
  });
  const result = buildRemakeProductAttributionAuditV1(opts);
  if (!result.ok) return result;

  const sampleSize = Math.max(1, Number((options && options.sampleSize) || 12));
  return {
    ok: true,
    version: result.version,
    diagnosticOnly: true,
    generatedAt: result.generatedAt,
    mappingRuleState: result.mappingRuleState,
    noRootPolicy: result.noRootPolicy,
    linkedTerminalPolicy: result.linkedTerminalPolicy,
    linkedTerminalPolicyVersion: result.linkedTerminalPolicyVersion,
    noRootDimensionPolicyState: result.noRootDimensionPolicyState,
    stats: result.stats,
    sampleCases: result.caseSummaries.slice(0, sampleSize),
    sampleRows: result.auditRows.slice(0, sampleSize)
  };
}

/**
 * Deep audit for one known remake case.
 */
function profileRemakeProductAttributionCaseV1(caseNumber) {
  const targetCaseNumber = Number(caseNumber || 0);
  if (!Number.isFinite(targetCaseNumber) || targetCaseNumber <= 0) {
    throw new Error('Provide a positive numeric case number.');
  }
  return buildRemakeProductAttributionAuditV1({
    caseNumbers: [Math.trunc(targetCaseNumber)],
    maxCases: 1,
    includeCaseSummaries: true,
    includeAuditRows: true,
    includeCeramist: true
  });
}


/**
 * Compact one-case output for Apps Script execution logs.
 * Keeps the chain, candidate products, Ceramist alignment, and mapping state
 * while avoiding the full nested payload that can exceed the execution-log cap.
 */
function profileRemakeProductAttributionCaseCompactV1(caseNumber) {
  const result = profileRemakeProductAttributionCaseV1(caseNumber);
  if (!result || result.ok !== true) return result;

  const summary = result.caseSummaries && result.caseSummaries[0] ? result.caseSummaries[0] : {};
  const row = result.auditRows && result.auditRows[0] ? result.auditRows[0] : {};

  return {
    ok: true,
    version: result.version,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: result.generatedAt,
    mappingRuleState: result.mappingRuleState,
    noRootPolicy: result.noRootPolicy,
    currentCaseNumber: Number(summary.currentCaseNumber || row.currentCaseNumber || 0),
    currentCaseId: cleanRemakeAttributionTextV1(summary.currentCaseId || row.currentCaseId || ''),
    currentProduct: {
      productId: cleanRemakeAttributionTextV1(row.currentProductId || ''),
      productName: cleanRemakeAttributionTextV1(row.currentProductName || ''),
      productGroup: cleanRemakeAttributionTextV1(row.currentProductGroup || ''),
      department: cleanRemakeAttributionTextV1(row.currentDepartment || ''),
      quantity: toRemakeAttributionNumberV1(row.currentQuantity || 0)
    },
    chain: {
      status: cleanRemakeAttributionTextV1(summary.chainStatus || ''),
      reason: cleanRemakeAttributionTextV1(summary.chainStatusReason || ''),
      depth: Number(summary.chainDepth || 0),
      path: Array.isArray(summary.chainPath) ? summary.chainPath : [],
      noRemakeRootFlag: summary.noRemakeRootFlag === true,
      unconfirmedRootFlag: summary.unconfirmedRootFlag === true,
      brokenChainFlag: summary.brokenChainFlag === true,
      cycleFlag: summary.cycleFlag === true,
      immediatePreviousCaseNumber: Number(summary.immediatePreviousCaseNumber || 0),
      rootCaseNumber: Number(summary.rootCaseNumber || 0),
      rootConfirmationMethod: cleanRemakeAttributionTextV1(summary.rootConfirmationMethod || ''),
      rootConfirmationPolicyVersion: cleanRemakeAttributionTextV1(summary.rootConfirmationPolicyVersion || '')
    },
    immediatePreviousProducts: compactRemakeAttributionProductsV1(summary.immediatePreviousProducts || []),
    rootProducts: compactRemakeAttributionProductsV1(summary.rootProducts || []),
    productReview: {
      ambiguousPreviousProductsFlag: summary.ambiguousPreviousProductsFlag === true,
      ambiguousRootProductsFlag: summary.ambiguousRootProductsFlag === true,
      immediatePreviousCandidateStatus: cleanRemakeAttributionTextV1(
        row.immediatePreviousCandidate && row.immediatePreviousCandidate.status || ''
      ),
      rootCandidateStatus: cleanRemakeAttributionTextV1(
        row.rootCandidate && row.rootCandidate.status || ''
      ),
      remadeProductMappingStatus: cleanRemakeAttributionTextV1(row.remadeProductMappingStatus || ''),
      remadeProductMappingMethod: cleanRemakeAttributionTextV1(row.remadeProductMappingMethod || ''),
      auditDisposition: cleanRemakeAttributionTextV1(summary.auditDisposition || '')
    },
    ceramistAlignment: {
      ceramist: cleanRemakeAttributionTextV1(summary.ceramist || ''),
      attributionStatus: cleanRemakeAttributionTextV1(summary.ceramistAttributionStatus || ''),
      attributionBasis: cleanRemakeAttributionTextV1(summary.ceramistAttributionBasis || ''),
      populationChainStatus: cleanRemakeAttributionTextV1(summary.ceramistPopulationChainStatus || ''),
      populationChainConfirmed: summary.ceramistPopulationChainConfirmed === true,
      previousCaseNumber: Number(summary.ceramistPreviousCaseNumber || 0),
      rootCaseNumber: Number(summary.ceramistRootCaseNumber || 0),
      alignmentStatus: cleanRemakeAttributionTextV1(summary.chainAlignmentStatus || '')
    }
  };
}

function compactRemakeAttributionProductsV1(products) {
  return (Array.isArray(products) ? products : []).map(function(product) {
    return {
      productId: cleanRemakeAttributionTextV1(product && product.productId || ''),
      productName: cleanRemakeAttributionTextV1(product && product.productName || ''),
      quantity: toRemakeAttributionNumberV1(product && product.quantity || 0),
      totalCharge: toRemakeAttributionNumberV1(product && product.totalCharge || 0)
    };
  });
}

/**
 * Direct CRM query-vs-detail diagnostic for one case number.
 * This is specifically useful for a suspected terminal root where QueryCases
 * and case detail may disagree about whether remakeCaseID exists or is blank.
 * No cache, Drive, trigger, or dashboard data is written.
 */
function profileRemakeAttributionCrmCaseV1(caseNumber) {
  const targetCaseNumber = Math.trunc(Number(caseNumber || 0));
  if (!targetCaseNumber) throw new Error('Provide a positive numeric case number.');

  const props = PropertiesService.getScriptProperties();
  const config = getRemakeFactorConfig(props, {
    quickRefresh: true,
    pageSize: 25,
    maxPages: 1,
    maxDetailFetches: 0,
    detailStrategy: 'none',
    chunkByMonth: false,
    fetchProductMap: false,
    fetchCustomerMap: false
  });
  const token = authenticateRemakeFactorApi(config);
  const diagnostic = fetchRemakeAttributionCrmCaseDiagnosticV1(config, token, targetCaseNumber);

  if (!diagnostic || diagnostic.ok !== true) {
    return {
      ok: false,
      version: remakeProductAttributionAuditVersionV1,
      diagnosticOnly: true,
      readOnly: true,
      targetCaseNumber: targetCaseNumber,
      queryUsed: diagnostic && diagnostic.queryUsed || ('caseNumber == ' + targetCaseNumber),
      message: diagnostic && diagnostic.message || 'CRM case diagnostic failed.'
    };
  }

  return {
    ok: true,
    version: remakeProductAttributionAuditVersionV1,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: new Date().toISOString(),
    targetCaseNumber: targetCaseNumber,
    queryUsed: diagnostic.queryUsed,
    caseId: diagnostic.caseId,
    queryRow: diagnostic.queryRow,
    detailRow: diagnostic.detailRow,
    detailError: diagnostic.detailError,
    conclusion: diagnostic.detailConclusion,
    serializationComparison: diagnostic.serializationComparison,
    linkedTerminalPolicyConclusion: classifyRemakeAttributionLinkedTerminalDiagnosticV1(diagnostic),
    linkedTerminalPolicyVersion: remakeProductAttributionTerminalRootPolicyVersionV1,
    interpretation: {
      fieldAbsent: 'Detail omission is raw endpoint behavior, not by itself a terminal decision for a linked historical case.',
      fieldPresentBlank: 'CRM detail explicitly exposed a blank remakeCaseID; linked terminal root is confirmed.',
      fieldPresentLinked: 'CRM detail exposed another remakeCaseID; continue the chain.',
      queryFallback: 'For a linked historical case only, when detail omits remakeCaseID, exact QueryCases for the same case may confirm blank terminal or provide the next link.',
      currentNoRootBoundary: 'This fallback is not used to classify a current remake case as No Remake Root.'
    }
  };
}

function buildRemakeAttributionCrmCaseSnapshotV1(caseObject) {
  const value = caseObject && typeof caseObject === 'object' ? caseObject : {};
  const matchingKeys = getRemakeAttributionRemakeCaseIdKeysV1(value);
  return {
    caseId: getRemakeAttributionCaseIdV1(value),
    caseNumber: getRemakeAttributionCaseNumberV1(value),
    remake: cleanRemakeAttributionTextV1(value.remake || value.remakeFlag || ''),
    remakeReason: cleanRemakeAttributionTextV1(value.remakeReason || ''),
    remakeCaseIdFieldPresent: hasRemakeAttributionRemakeCaseIdFieldV1(value),
    remakeCaseIdMatchingKeys: matchingKeys,
    remakeCaseId: getRemakeAttributionRemakeCaseIdV1(value),
    caseProductCount: Array.isArray(value.caseProducts) ? value.caseProducts.length : 0
  };
}

function getRemakeAttributionRemakeCaseIdKeysV1(caseObject) {
  const value = caseObject && typeof caseObject === 'object' ? caseObject : {};
  return Object.keys(value).filter(function(candidate) {
    return /^remakeCaseID$/i.test(candidate);
  });
}

function classifyRemakeAttributionCrmCaseLinkStateV1(snapshot) {
  const value = snapshot && typeof snapshot === 'object' ? snapshot : {};
  if (value.remakeCaseIdFieldPresent !== true) return 'FIELD_ABSENT_UNCONFIRMED';
  if (!cleanRemakeAttributionTextV1(value.remakeCaseId || '')) return 'FIELD_PRESENT_BLANK_CONFIRMED_TERMINAL';
  return 'FIELD_PRESENT_LINKED_CONTINUE_CHAIN';
}


/**
 * Compare how the same case's remakeCaseID is serialized by QueryCases and the
 * direct case-detail endpoint. This helper makes no policy decision by itself.
 */
function compareRemakeAttributionCrmCaseSnapshotsV1(querySnapshot, detailSnapshot, detailError) {
  const queryValue = querySnapshot && typeof querySnapshot === 'object' ? querySnapshot : {};
  const detailValue = detailSnapshot && typeof detailSnapshot === 'object' ? detailSnapshot : {};
  const queryPresent = queryValue.remakeCaseIdFieldPresent === true;
  const detailPresent = detailValue.remakeCaseIdFieldPresent === true;
  const queryLink = cleanRemakeAttributionTextV1(queryValue.remakeCaseId || '');
  const detailLink = cleanRemakeAttributionTextV1(detailValue.remakeCaseId || '');

  if (cleanRemakeAttributionTextV1(detailError || '')) return 'DETAIL_READ_ERROR';
  if (queryPresent && !queryLink && !detailPresent) return 'QUERY_BLANK_DETAIL_ABSENT';
  if (queryPresent && !queryLink && detailPresent && !detailLink) return 'BOTH_PRESENT_BLANK';
  if (queryPresent && queryLink && detailPresent && detailLink && queryLink === detailLink) {
    return 'BOTH_LINKED_SAME';
  }
  if (queryPresent && queryLink && !detailPresent) return 'QUERY_LINKED_DETAIL_ABSENT';
  if (!queryPresent && detailPresent && !detailLink) return 'QUERY_ABSENT_DETAIL_BLANK';
  if (!queryPresent && detailPresent && detailLink) return 'QUERY_ABSENT_DETAIL_LINKED';
  if (!queryPresent && !detailPresent) return 'BOTH_FIELD_ABSENT';
  return 'OTHER_MISMATCH';
}

function classifyRemakeAttributionLinkedTerminalDiagnosticV1(diagnostic) {
  const value = diagnostic && typeof diagnostic === 'object' ? diagnostic : {};
  const detailRow = value.detailRow && typeof value.detailRow === 'object' ? value.detailRow : {};
  const queryRow = value.queryRow && typeof value.queryRow === 'object' ? value.queryRow : {};
  const detailLink = cleanRemakeAttributionTextV1(detailRow.remakeCaseId || '');
  const queryLink = cleanRemakeAttributionTextV1(queryRow.remakeCaseId || '');

  if (cleanRemakeAttributionTextV1(value.detailError || '')) return 'UNCONFIRMED_DETAIL_READ_ERROR';
  if (detailRow.remakeCaseIdFieldPresent === true) {
    return detailLink ? 'CONTINUE_BY_DETAIL_LINK' : 'CONFIRMED_TERMINAL_BY_DETAIL_BLANK';
  }
  if (value.serializationComparison === 'QUERY_BLANK_DETAIL_ABSENT') {
    return 'CONFIRMED_TERMINAL_BY_QUERY_BLANK_DETAIL_OMITTED';
  }
  if (value.serializationComparison === 'QUERY_LINKED_DETAIL_ABSENT') {
    return queryLink ? 'CONTINUE_BY_QUERY_LINK_DETAIL_OMITTED' : 'UNCONFIRMED_QUERY_LINK_STATE';
  }
  return 'UNCONFIRMED_LINKED_TERMINAL';
}

/**
 * One authenticated CRM query-vs-detail diagnostic. The caller supplies the
 * existing API config/token so a multi-case sample authenticates only once.
 */
function fetchRemakeAttributionQueryCaseByNumberV1(config, token, caseNumber) {
  const targetCaseNumber = Math.trunc(Number(caseNumber || 0));
  const queryUsed = 'caseNumber == ' + targetCaseNumber;
  if (!targetCaseNumber) {
    return { ok: false, queryUsed: queryUsed, row: null, message: 'Provide a positive numeric case number.' };
  }

  const url = config.baseUrl + '/api/Cases/QueryCases?' + toRemakeFactorQueryString({
    page: 1,
    pageSize: 25,
    orderBy: 'caseNumber',
    additionalFields: 'caseProducts',
    query: queryUsed
  });
  const response = remakeFactorFetchJson(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  const rows = extractRemakeFactorRows(response.body);
  const row = rows.find(function(candidate) {
    return Number(candidate && (candidate.caseNumber || candidate.caseNo) || 0) === targetCaseNumber;
  }) || null;

  return {
    ok: !!row,
    queryUsed: queryUsed,
    row: row,
    message: row ? '' : 'Case was not found in CRM QueryCases.'
  };
}

function fetchRemakeAttributionCrmCaseDiagnosticV1(config, token, caseNumber) {
  const targetCaseNumber = Math.trunc(Number(caseNumber || 0));
  if (!targetCaseNumber) {
    return {
      ok: false,
      targetCaseNumber: targetCaseNumber,
      message: 'Provide a positive numeric case number.'
    };
  }

  const queryResult = fetchRemakeAttributionQueryCaseByNumberV1(config, token, targetCaseNumber);
  if (!queryResult.ok) {
    return {
      ok: false,
      targetCaseNumber: targetCaseNumber,
      queryUsed: queryResult.queryUsed,
      message: queryResult.message || 'Case was not found in CRM QueryCases.'
    };
  }

  const queryUsed = queryResult.queryUsed;
  const queryRow = queryResult.row;
  const caseId = getRemakeAttributionCaseIdV1(queryRow);
  let detailRow = null;
  let detailError = '';
  if (caseId) {
    try {
      detailRow = fetchRemakeFactorCaseDetail(config, token, caseId);
    } catch (error) {
      detailError = error && error.message ? error.message : String(error || '');
    }
  }

  const querySnapshot = buildRemakeAttributionCrmCaseSnapshotV1(queryRow);
  const detailSnapshot = buildRemakeAttributionCrmCaseSnapshotV1(detailRow);

  return {
    ok: true,
    targetCaseNumber: targetCaseNumber,
    queryUsed: queryUsed,
    caseId: caseId,
    queryRow: querySnapshot,
    detailRow: detailSnapshot,
    detailError: detailError,
    detailConclusion: classifyRemakeAttributionCrmCaseLinkStateV1(detailSnapshot),
    serializationComparison: compareRemakeAttributionCrmCaseSnapshotsV1(
      querySnapshot,
      detailSnapshot,
      detailError
    )
  };
}

/**
 * Read the raw Ceramist responsibility cache rows without badge/name enrichment.
 * This intentionally avoids getCeramistRemakeAnalysisData(), whose enrichment
 * path can attempt an alert email when lookup metadata is incomplete.
 */
function loadRemakeAttributionCeramistRowsV1() {
  try {
    const props = PropertiesService.getScriptProperties();
    const fileId = cleanRemakeAttributionTextV1(
      props.getProperty(remakeProductAttributionCeramistCacheFileIdPropertyV1) || ''
    );
    if (!fileId) return [];

    const file = DriveApp.getFileById(fileId);
    const text = file.getBlob().getDataAsString('UTF-8');
    const payload = text ? JSON.parse(text) : null;
    if (!payload || payload.ok !== true || !Array.isArray(payload.rows)) return [];

    return payload.rows.filter(function(row) {
      return row && typeof row === 'object';
    });
  } catch (ignore) {
    return [];
  }
}

/**
 * Diagnostic sample of roots that the existing Ceramist sidecar currently marks
 * resolved+confirmed. For each unique root, compare QueryCases vs direct detail
 * remakeCaseID behavior. This measures API serialization behavior only; it does
 * not change the root-confirmation policy or any product-attribution rule.
 */
function profileRemakeAttributionTerminalRootBehaviorV1(options) {
  const opts = options || {};
  const requestedSampleSize = Math.max(
    1,
    Number(opts.sampleSize || remakeProductAttributionTerminalRootDefaultSampleSizeV1)
  );
  const sampleSize = Math.min(
    remakeProductAttributionTerminalRootMaxSampleSizeV1,
    Math.trunc(requestedSampleSize)
  );
  const includeKnownRootCaseNumber = Math.trunc(Number(opts.includeKnownRootCaseNumber || 361499));
  const sidecarRows = loadRemakeAttributionCeramistRowsV1();
  const resolvedRows = sidecarRows.filter(function(row) {
    return cleanRemakeAttributionTextV1(row.populationChainStatus || '') === 'resolved' &&
      row.populationChainConfirmed === true &&
      Number(row.rootCaseNumber || 0) > 0;
  });

  const rootBuckets = {};
  resolvedRows.forEach(function(row) {
    const rootCaseNumber = Math.trunc(Number(row.rootCaseNumber || 0));
    if (!rootCaseNumber) return;
    const key = String(rootCaseNumber);
    if (!rootBuckets[key]) {
      rootBuckets[key] = {
        rootCaseNumber: rootCaseNumber,
        sidecarRows: 0,
        currentCaseNumbers: []
      };
    }
    const bucket = rootBuckets[key];
    bucket.sidecarRows++;
    const currentCaseNumber = Math.trunc(Number(
      row.currentCaseNumber || row.remakeCaseNumber || row.caseNumber || 0
    ));
    if (currentCaseNumber && bucket.currentCaseNumbers.indexOf(currentCaseNumber) < 0) {
      bucket.currentCaseNumbers.push(currentCaseNumber);
    }
  });

  let rootCaseNumbers = Object.keys(rootBuckets).map(function(value) {
    return Number(value);
  }).filter(function(value) {
    return Number.isFinite(value) && value > 0;
  }).sort(function(left, right) {
    return right - left;
  });

  if (includeKnownRootCaseNumber > 0 && rootBuckets[String(includeKnownRootCaseNumber)]) {
    rootCaseNumbers = [includeKnownRootCaseNumber].concat(rootCaseNumbers.filter(function(value) {
      return value !== includeKnownRootCaseNumber;
    }));
  }
  rootCaseNumbers = rootCaseNumbers.slice(0, sampleSize);

  const props = PropertiesService.getScriptProperties();
  const config = getRemakeFactorConfig(props, {
    quickRefresh: true,
    pageSize: 25,
    maxPages: 1,
    maxDetailFetches: 0,
    detailStrategy: 'none',
    chunkByMonth: false,
    fetchProductMap: false,
    fetchCustomerMap: false
  });
  const token = authenticateRemakeFactorApi(config);
  const results = [];

  rootCaseNumbers.forEach(function(rootCaseNumber) {
    const bucket = rootBuckets[String(rootCaseNumber)] || {};
    let diagnostic;
    try {
      diagnostic = fetchRemakeAttributionCrmCaseDiagnosticV1(config, token, rootCaseNumber);
    } catch (error) {
      diagnostic = {
        ok: false,
        targetCaseNumber: rootCaseNumber,
        message: error && error.message ? error.message : String(error || '')
      };
    }

    const queryRow = diagnostic && diagnostic.queryRow || {};
    const detailRow = diagnostic && diagnostic.detailRow || {};
    results.push({
      rootCaseNumber: rootCaseNumber,
      sidecarResolvedConfirmed: true,
      sidecarReferenceRows: Number(bucket.sidecarRows || 0),
      representativeCurrentCaseNumbers: Array.isArray(bucket.currentCaseNumbers)
        ? bucket.currentCaseNumbers.slice(0, 3)
        : [],
      crmDiagnosticOk: diagnostic && diagnostic.ok === true,
      caseId: cleanRemakeAttributionTextV1(diagnostic && diagnostic.caseId || ''),
      queryFieldPresent: queryRow.remakeCaseIdFieldPresent === true,
      queryRemakeCaseId: cleanRemakeAttributionTextV1(queryRow.remakeCaseId || ''),
      detailFieldPresent: detailRow.remakeCaseIdFieldPresent === true,
      detailRemakeCaseId: cleanRemakeAttributionTextV1(detailRow.remakeCaseId || ''),
      detailConclusion: cleanRemakeAttributionTextV1(diagnostic && diagnostic.detailConclusion || ''),
      serializationComparison: cleanRemakeAttributionTextV1(
        diagnostic && diagnostic.serializationComparison || ''
      ),
      detailError: cleanRemakeAttributionTextV1(diagnostic && diagnostic.detailError || ''),
      diagnosticMessage: cleanRemakeAttributionTextV1(diagnostic && diagnostic.message || '')
    });
  });

  const stats = {
    rawCeramistRows: sidecarRows.length,
    resolvedConfirmedCeramistRows: resolvedRows.length,
    uniqueResolvedRootCases: Object.keys(rootBuckets).length,
    sampledRootCases: results.length,
    queryFieldPresentCases: 0,
    queryBlankCases: 0,
    queryLinkedCases: 0,
    detailFieldPresentCases: 0,
    detailFieldAbsentCases: 0,
    detailBlankCases: 0,
    detailLinkedCases: 0,
    detailReadErrorCases: 0,
    queryBlankDetailAbsentCases: 0,
    bothPresentBlankCases: 0,
    bothLinkedSameCases: 0,
    otherComparisonCases: 0,
    detailFieldOmissionRatePct: 0
  };

  results.forEach(function(row) {
    if (row.queryFieldPresent) stats.queryFieldPresentCases++;
    if (row.queryFieldPresent && !row.queryRemakeCaseId) stats.queryBlankCases++;
    if (row.queryFieldPresent && row.queryRemakeCaseId) stats.queryLinkedCases++;
    if (row.detailFieldPresent) stats.detailFieldPresentCases++;
    else stats.detailFieldAbsentCases++;
    if (row.detailFieldPresent && !row.detailRemakeCaseId) stats.detailBlankCases++;
    if (row.detailFieldPresent && row.detailRemakeCaseId) stats.detailLinkedCases++;
    if (row.detailError) stats.detailReadErrorCases++;

    if (row.serializationComparison === 'QUERY_BLANK_DETAIL_ABSENT') {
      stats.queryBlankDetailAbsentCases++;
    } else if (row.serializationComparison === 'BOTH_PRESENT_BLANK') {
      stats.bothPresentBlankCases++;
    } else if (row.serializationComparison === 'BOTH_LINKED_SAME') {
      stats.bothLinkedSameCases++;
    } else {
      stats.otherComparisonCases++;
    }
  });

  stats.detailFieldOmissionRatePct = results.length
    ? Math.round((stats.detailFieldAbsentCases / results.length) * 10000) / 100
    : 0;

  return {
    ok: true,
    version: remakeProductAttributionAuditVersionV1,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: new Date().toISOString(),
    purpose: 'Measure QueryCases vs direct-detail remakeCaseID serialization on roots already marked resolved+confirmed by the existing Ceramist sidecar.',
    policyDecisionState: 'LINKED_TERMINAL_QUERY_FALLBACK_ACTIVE_IN_AUDIT_ONLY',
    linkedTerminalPolicyVersion: remakeProductAttributionTerminalRootPolicyVersionV1,
    sampleSelection: {
      source: 'raw_ceramist_drive_cache_no_badge_enrichment',
      requiredPopulationChainStatus: 'resolved',
      requiredPopulationChainConfirmed: true,
      requestedSampleSize: sampleSize,
      knownRootPrioritized: includeKnownRootCaseNumber > 0 ? includeKnownRootCaseNumber : 0,
      ordering: 'known root first when present, then root case number descending'
    },
    stats: stats,
    roots: results
  };
}

function groupRemakeAttributionRowsByCaseV1(rows) {
  const grouped = {};
  (rows || []).forEach(function(row, index) {
    if (!row || typeof row !== 'object') return;
    const caseId = cleanRemakeAttributionTextV1(row.caseId || row.caseID || '');
    const caseNumber = Number(row.caseNumber || 0);
    const key = caseId || (caseNumber > 0 ? 'case-number:' + Math.trunc(caseNumber) : 'row:' + index);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  });
  return grouped;
}

function normalizeRemakeAttributionCaseNumberListV1(values) {
  const seen = {};
  const result = [];
  (Array.isArray(values) ? values : [values]).forEach(function(value) {
    const numberValue = Number(value || 0);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return;
    const caseNumber = Math.trunc(numberValue);
    if (seen[caseNumber]) return;
    seen[caseNumber] = true;
    result.push(caseNumber);
  });
  return result;
}

function fetchRemakeAttributionCurrentCaseV1(config, token, currentRow, memo) {
  const caseId = cleanRemakeAttributionTextV1(currentRow && (currentRow.caseId || currentRow.caseID) || '');
  const caseNumber = Number(currentRow && currentRow.caseNumber || 0);

  if (caseId) {
    try {
      return fetchRemakeAttributionCaseByIdV1(config, token, caseId, memo);
    } catch (ignore) {}
  }

  if (caseNumber > 0) {
    return fetchRemakeAttributionCaseByNumberV1(config, token, Math.trunc(caseNumber), memo);
  }

  throw new Error('Current remake row is missing both caseId and caseNumber.');
}

function fetchRemakeAttributionCaseByIdV1(config, token, caseId, memo) {
  const cleanId = cleanRemakeAttributionTextV1(caseId);
  if (!cleanId) throw new Error('Missing case ID.');
  const memoKey = 'id:' + cleanId;
  if (Object.prototype.hasOwnProperty.call(memo, memoKey)) return memo[memoKey];
  const detail = fetchRemakeFactorCaseDetail(config, token, cleanId);
  if (!detail || typeof detail !== 'object') throw new Error('Case detail was empty for case ID ' + cleanId + '.');
  memo[memoKey] = detail;

  const detailCaseId = getRemakeAttributionCaseIdV1(detail);
  const detailCaseNumber = getRemakeAttributionCaseNumberV1(detail);
  if (detailCaseId) memo['id:' + detailCaseId] = detail;
  if (detailCaseNumber > 0) memo['number:' + detailCaseNumber] = detail;
  return detail;
}

function fetchRemakeAttributionCaseByNumberV1(config, token, caseNumber, memo) {
  const normalizedCaseNumber = Math.trunc(Number(caseNumber || 0));
  if (!normalizedCaseNumber) throw new Error('Missing case number.');
  const memoKey = 'number:' + normalizedCaseNumber;
  if (Object.prototype.hasOwnProperty.call(memo, memoKey)) return memo[memoKey];

  const url = config.baseUrl + '/api/Cases/QueryCases?' + toRemakeFactorQueryString({
    page: 1,
    pageSize: 25,
    orderBy: 'caseNumber',
    additionalFields: 'caseProducts',
    query: 'caseNumber == ' + normalizedCaseNumber
  });
  const response = remakeFactorFetchJson(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  const rows = extractRemakeFactorRows(response.body);
  const match = rows.find(function(row) {
    return Number(row && (row.caseNumber || row.caseNo) || 0) === normalizedCaseNumber;
  });
  if (!match) throw new Error('Case ' + normalizedCaseNumber + ' was not found in CRM QueryCases.');

  const caseId = getRemakeAttributionCaseIdV1(match);
  const detail = caseId ? fetchRemakeAttributionCaseByIdV1(config, token, caseId, memo) : match;
  memo[memoKey] = detail;
  return detail;
}

function buildRemakeAttributionUnconfirmedCurrentChainV1(currentRow, error) {
  const currentCaseId = cleanRemakeAttributionTextV1(currentRow && (currentRow.caseId || currentRow.caseID) || '');
  const currentCaseNumber = Number(currentRow && currentRow.caseNumber || 0);
  return {
    status: 'unconfirmed_root',
    statusReason: 'Current CRM case detail could not be confirmed, so remakeCaseID cannot be classified.',
    noRemakeRootFlag: false,
    unconfirmedRootFlag: true,
    brokenChainFlag: false,
    rootMissingFlag: true,
    malformedLinkFlag: false,
    cycleFlag: false,
    chainDepth: 0,
    chainPath: [{ role: 'current', caseId: currentCaseId, caseNumber: currentCaseNumber }],
    currentCase: null,
    previousCase: null,
    rootCase: null,
    rootConfirmationMethod: '',
    rootConfirmationPolicyVersion: remakeProductAttributionTerminalRootPolicyVersionV1,
    brokenLinkCaseId: '',
    error: error && error.message ? error.message : String(error || '')
  };
}

function resolveRemakeAttributionChainV1(config, token, currentCase, memo) {
  const currentCaseId = getRemakeAttributionCaseIdV1(currentCase);
  const currentCaseNumber = getRemakeAttributionCaseNumberV1(currentCase);
  const currentLinkFieldPresent = hasRemakeAttributionRemakeCaseIdFieldV1(currentCase);
  const firstLink = getRemakeAttributionRemakeCaseIdV1(currentCase);
  const chain = {
    status: '',
    statusReason: '',
    noRemakeRootFlag: false,
    unconfirmedRootFlag: false,
    brokenChainFlag: false,
    rootMissingFlag: false,
    malformedLinkFlag: false,
    cycleFlag: false,
    chainDepth: 0,
    chainPath: [{ role: 'current', caseId: currentCaseId, caseNumber: currentCaseNumber }],
    currentCase: currentCase,
    previousCase: null,
    rootCase: null,
    rootConfirmationMethod: '',
    rootConfirmationPolicyVersion: remakeProductAttributionTerminalRootPolicyVersionV1,
    brokenLinkCaseId: '',
    error: ''
  };

  if (!currentLinkFieldPresent) {
    chain.status = 'unconfirmed_root';
    chain.statusReason = 'CRM current-case detail did not expose remakeCaseID, so a no-root result cannot be confirmed.';
    chain.unconfirmedRootFlag = true;
    chain.rootMissingFlag = true;
    return chain;
  }

  if (!firstLink) {
    chain.status = 'no_remake_root';
    chain.statusReason = 'CRM current-case detail explicitly confirmed a blank remakeCaseID. QueryCases fallback is intentionally not used for current-case No Remake Root.';
    chain.noRemakeRootFlag = true;
    chain.rootConfirmationMethod = 'current_detail_blank_no_root';
    return chain;
  }

  const visited = {};
  if (currentCaseId) visited[currentCaseId.toLowerCase()] = true;
  let nextCaseId = firstLink;
  let depth = 0;

  while (nextCaseId && depth < remakeProductAttributionMaxChainDepthV1) {
    const cleanNextCaseId = cleanRemakeAttributionTextV1(nextCaseId);
    const visitKey = cleanNextCaseId.toLowerCase();

    if (!cleanNextCaseId || visited[visitKey]) {
      chain.status = 'cycle_detected';
      chain.statusReason = 'remakeCaseID cycle detected at case ID ' + cleanNextCaseId + '.';
      chain.cycleFlag = true;
      chain.rootMissingFlag = true;
      chain.brokenLinkCaseId = cleanNextCaseId;
      return chain;
    }
    visited[visitKey] = true;

    let linkedCase;
    try {
      linkedCase = fetchRemakeAttributionCaseByIdV1(config, token, cleanNextCaseId, memo);
    } catch (error) {
      chain.status = 'broken_chain';
      chain.statusReason = depth > 0
        ? 'A remakeCaseID chain was partially resolved, but the next linked case could not be read.'
        : 'The immediate remakeCaseID link exists, but the linked case could not be read.';
      chain.brokenChainFlag = true;
      chain.rootMissingFlag = true;
      chain.brokenLinkCaseId = cleanNextCaseId;
      chain.error = error && error.message ? error.message : String(error);
      return chain;
    }

    const linkedCaseId = getRemakeAttributionCaseIdV1(linkedCase);
    const linkedCaseNumber = getRemakeAttributionCaseNumberV1(linkedCase);
    if (!linkedCaseNumber) {
      chain.status = 'broken_chain';
      chain.statusReason = 'A linked CRM case did not contain a numeric case number.';
      chain.brokenChainFlag = true;
      chain.malformedLinkFlag = true;
      chain.rootMissingFlag = true;
      chain.brokenLinkCaseId = cleanNextCaseId;
      return chain;
    }

    depth++;
    if (!chain.previousCase) chain.previousCase = linkedCase;
    chain.rootCase = linkedCase;
    chain.chainDepth = depth;
    chain.chainPath.push({
      role: depth === 1 ? 'previous' : 'ancestor',
      caseId: linkedCaseId || cleanNextCaseId,
      caseNumber: linkedCaseNumber
    });

    if (hasRemakeAttributionRemakeCaseIdFieldV1(linkedCase)) {
      const linkedNext = getRemakeAttributionRemakeCaseIdV1(linkedCase);
      if (!linkedNext) {
        chain.status = 'resolved';
        chain.statusReason = depth > 1
          ? 'CRM remakeCaseID chain resolved and the linked terminal root explicitly confirmed a blank remakeCaseID in case detail.'
          : 'Immediate previous case is also the confirmed terminal root by explicit blank case detail.';
        chain.rootConfirmationMethod = 'detail_blank';
        return chain;
      }

      nextCaseId = linkedNext;
      continue;
    }

    let queryResult;
    try {
      queryResult = fetchRemakeAttributionQueryCaseByNumberV1(config, token, linkedCaseNumber);
    } catch (error) {
      chain.status = 'unconfirmed_root';
      chain.statusReason = 'Linked case detail omitted remakeCaseID and the exact QueryCases fallback failed.';
      chain.unconfirmedRootFlag = true;
      chain.rootMissingFlag = true;
      chain.error = error && error.message ? error.message : String(error || '');
      return chain;
    }

    if (!queryResult || queryResult.ok !== true || !queryResult.row) {
      chain.status = 'unconfirmed_root';
      chain.statusReason = 'Linked case detail omitted remakeCaseID and exact QueryCases did not return the same case.';
      chain.unconfirmedRootFlag = true;
      chain.rootMissingFlag = true;
      chain.error = queryResult && queryResult.message || '';
      return chain;
    }

    const queryCase = queryResult.row;
    const queryCaseId = getRemakeAttributionCaseIdV1(queryCase);
    const queryCaseNumber = getRemakeAttributionCaseNumberV1(queryCase);
    const expectedCaseId = cleanRemakeAttributionTextV1(linkedCaseId || cleanNextCaseId);
    const sameCaseId = !!queryCaseId && !!expectedCaseId && queryCaseId.toLowerCase() === expectedCaseId.toLowerCase();
    const sameCaseNumber = queryCaseNumber === linkedCaseNumber;

    if (!sameCaseId || !sameCaseNumber) {
      chain.status = 'unconfirmed_root';
      chain.statusReason = 'Linked case detail omitted remakeCaseID and QueryCases identity did not match the linked case exactly.';
      chain.unconfirmedRootFlag = true;
      chain.rootMissingFlag = true;
      return chain;
    }

    if (!hasRemakeAttributionRemakeCaseIdFieldV1(queryCase)) {
      chain.status = 'unconfirmed_root';
      chain.statusReason = 'Linked case detail omitted remakeCaseID and exact QueryCases also did not expose remakeCaseID.';
      chain.unconfirmedRootFlag = true;
      chain.rootMissingFlag = true;
      return chain;
    }

    const queryNext = getRemakeAttributionRemakeCaseIdV1(queryCase);
    if (!queryNext) {
      chain.status = 'resolved';
      chain.statusReason = depth > 1
        ? 'CRM remakeCaseID chain resolved: linked terminal detail omitted remakeCaseID, while exact QueryCases for the same case exposed a blank remakeCaseID.'
        : 'Immediate previous case is the confirmed terminal root by exact QueryCases blank fallback after detail omission.';
      chain.rootConfirmationMethod = 'query_blank_detail_omitted';
      return chain;
    }

    nextCaseId = queryNext;
  }

  if (nextCaseId) {
    chain.status = 'max_depth_exceeded';
    chain.statusReason = 'Chain exceeded safety depth ' + remakeProductAttributionMaxChainDepthV1 + '.';
    chain.unconfirmedRootFlag = true;
    chain.rootMissingFlag = true;
  } else if (!chain.status) {
    chain.status = 'unconfirmed_root';
    chain.statusReason = 'Chain could not be conclusively classified.';
    chain.unconfirmedRootFlag = true;
    chain.rootMissingFlag = true;
  }
  return chain;
}

function hasRemakeAttributionRemakeCaseIdFieldV1(caseObject) {
  const value = caseObject && typeof caseObject === 'object' ? caseObject : {};
  if (value.remakeCaseIdFieldPresent === true) return true;
  return Object.keys(value).some(function(candidate) {
    return /^remakeCaseID$/i.test(candidate);
  });
}

function getRemakeAttributionRemakeCaseIdV1(caseObject) {
  const value = caseObject && typeof caseObject === 'object' ? caseObject : {};
  const key = Object.keys(value).find(function(candidate) {
    return /^remakeCaseID$/i.test(candidate);
  });
  if (!key) return '';
  return cleanRemakeAttributionTextV1(value[key]);
}

function getRemakeAttributionCaseIdV1(caseObject) {
  const value = caseObject && typeof caseObject === 'object' ? caseObject : {};
  return cleanRemakeAttributionTextV1(value.caseID || value.caseId || value.id || '');
}

function getRemakeAttributionCaseNumberV1(caseObject) {
  const value = caseObject && typeof caseObject === 'object' ? caseObject : {};
  const numberValue = Number(value.caseNumber || value.caseNo || 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.trunc(numberValue) : 0;
}

function extractRemakeAttributionCaseProductsV1(caseObject) {
  if (!caseObject || typeof caseObject !== 'object') return [];
  const source = Array.isArray(caseObject.caseProducts) ? caseObject.caseProducts : [];
  return source.map(function(line, index) {
    const rawDepartment = cleanRemakeAttributionTextV1(
      line.taxDepartment || line.department || line.productsDepartment || line.productDepartment || ''
    );
    const rawGroup = cleanRemakeAttributionTextV1(
      line.taxGroup || line.group || line.productsGroup || line.productGroup || ''
    );
    return {
      index: index,
      lineId: cleanRemakeAttributionTextV1(line.id || line.caseProductID || line.caseProductId || ''),
      productId: cleanRemakeAttributionTextV1(line.productID || line.productId || ''),
      productName: cleanRemakeAttributionTextV1(
        line.invoiceDescription || line.description || line.productDescription || line.productName || ''
      ),
      productGroupRaw: rawGroup,
      departmentRaw: rawDepartment,
      quantity: toRemakeAttributionNumberV1(line.quantity || line.qty || 0),
      unitPrice: toRemakeAttributionNumberV1(line.unitPrice || line.price || 0),
      totalCharge: toRemakeAttributionNumberV1(line.totalCharge || line.charge || 0),
      sourceRole: 'historical_case_product'
    };
  });
}

function buildRemakeAttributionCaseSummaryV1(firstRow, currentRows, currentCase, chain, previousProducts, rootProducts, ceramist) {
  const currentCaseNumber = Number(firstRow.caseNumber || getRemakeAttributionCaseNumberV1(currentCase) || 0);
  return {
    currentCaseId: cleanRemakeAttributionTextV1(firstRow.caseId || getRemakeAttributionCaseIdV1(currentCase)),
    currentCaseNumber: currentCaseNumber,
    currentRemakeLineCount: currentRows.length,
    currentRemakeProductIds: uniqueRemakeAttributionValuesV1(currentRows.map(function(row) { return row.productId; })),
    currentRemakeProductNames: uniqueRemakeAttributionValuesV1(currentRows.map(function(row) { return row.productName; })),
    cachedRemakeCaseId: cleanRemakeAttributionTextV1(firstRow.remakeCaseId || firstRow.remakeCaseID || ''),
    cachedRemakeCaseIdFieldPresent: firstRow.remakeCaseIdFieldPresent === true,
    crmRemakeCaseIdFieldPresent: hasRemakeAttributionRemakeCaseIdFieldV1(currentCase),
    crmRemakeCaseId: getRemakeAttributionRemakeCaseIdV1(currentCase),
    immediatePreviousCaseId: getRemakeAttributionCaseIdV1(chain.previousCase),
    immediatePreviousCaseNumber: getRemakeAttributionCaseNumberV1(chain.previousCase),
    rootCaseId: getRemakeAttributionCaseIdV1(chain.rootCase),
    rootCaseNumber: getRemakeAttributionCaseNumberV1(chain.rootCase),
    rootConfirmationMethod: cleanRemakeAttributionTextV1(chain.rootConfirmationMethod || ''),
    rootConfirmationPolicyVersion: cleanRemakeAttributionTextV1(chain.rootConfirmationPolicyVersion || remakeProductAttributionTerminalRootPolicyVersionV1),
    chainStatus: chain.status,
    chainStatusReason: chain.statusReason,
    chainDepth: chain.chainDepth,
    chainPath: chain.chainPath,
    noRemakeRootFlag: chain.noRemakeRootFlag,
    unconfirmedRootFlag: chain.unconfirmedRootFlag === true,
    brokenChainFlag: chain.brokenChainFlag === true,
    rootMissingFlag: chain.rootMissingFlag,
    multiChainFlag: chain.chainDepth > 1,
    cycleFlag: chain.cycleFlag,
    brokenLinkCaseId: chain.brokenLinkCaseId,
    chainError: chain.error,
    immediatePreviousProducts: previousProducts,
    rootProducts: rootProducts,
    immediatePreviousProductCount: previousProducts.length,
    rootProductCount: rootProducts.length,
    ambiguousPreviousProductsFlag: previousProducts.length > 1,
    ambiguousRootProductsFlag: rootProducts.length > 1,
    ceramist: ceramist.ceramist || '',
    ceramistAttributionStatus: ceramist.attributionStatus || '',
    ceramistAttributionBasis: ceramist.attributionBasis || '',
    ceramistRootMissingFlag: ceramist.rootMissingFlag === true,
    ceramistPopulationChainStatus: ceramist.populationChainStatus || '',
    ceramistPopulationChainConfirmed: ceramist.populationChainConfirmed === true,
    ceramistPreviousCaseNumber: ceramist.previousCaseNumber || 0,
    ceramistRootCaseNumber: ceramist.rootCaseNumber || 0,
    chainAlignmentStatus: getRemakeAttributionChainAlignmentV1(chain, ceramist),
    auditDisposition: classifyRemakeAttributionCaseDispositionV1(chain, previousProducts, rootProducts)
  };
}

function buildRemakeAttributionAuditRowV1(currentRow, currentCase, chain, previousProducts, rootProducts, ceramist) {
  const previousCandidate = mapRemakeAttributionHistoricalCandidateV1(currentRow, previousProducts, 'immediate_previous');
  const rootCandidate = mapRemakeAttributionHistoricalCandidateV1(currentRow, rootProducts, 'root');
  const noRoot = chain.noRemakeRootFlag === true;
  const unconfirmedRoot = chain.unconfirmedRootFlag === true;
  const brokenChain = chain.brokenChainFlag === true;
  const noRootBucket = noRoot ? buildRemakeAttributionNoRootBucketV1() : null;

  return {
    currentCaseId: cleanRemakeAttributionTextV1(currentRow.caseId || getRemakeAttributionCaseIdV1(currentCase)),
    currentCaseNumber: Number(currentRow.caseNumber || getRemakeAttributionCaseNumberV1(currentCase) || 0),
    currentLineId: cleanRemakeAttributionTextV1(currentRow.lineId || ''),
    currentProductId: cleanRemakeAttributionTextV1(currentRow.productId || ''),
    currentProductName: cleanRemakeAttributionTextV1(currentRow.productName || ''),
    currentProductGroup: cleanRemakeAttributionTextV1(currentRow.productGroup || ''),
    currentDepartment: cleanRemakeAttributionTextV1(currentRow.department || ''),
    currentQuantity: toRemakeAttributionNumberV1(currentRow.quantity || 0),
    currentRemakeReason: cleanRemakeAttributionTextV1(currentRow.remakeReason || ''),
    currentRemakeDiscount: toRemakeAttributionNumberV1(currentRow.remakeDiscount || currentRow.remakeDiscountAmount || 0),
    currentInvoiceDate: cleanRemakeAttributionTextV1(currentRow.invoiceDate || ''),
    currentCustomerId: cleanRemakeAttributionTextV1(currentRow.customerId || ''),
    currentCustomerName: cleanRemakeAttributionTextV1(currentRow.customerDisplayName || currentRow.customerName || ''),

    cachedRemakeCaseId: cleanRemakeAttributionTextV1(currentRow.remakeCaseId || currentRow.remakeCaseID || ''),
    cachedRemakeCaseIdFieldPresent: currentRow.remakeCaseIdFieldPresent === true,
    crmRemakeCaseIdFieldPresent: hasRemakeAttributionRemakeCaseIdFieldV1(currentCase),
    crmRemakeCaseId: getRemakeAttributionRemakeCaseIdV1(currentCase),
    immediatePreviousCaseId: getRemakeAttributionCaseIdV1(chain.previousCase),
    immediatePreviousCaseNumber: getRemakeAttributionCaseNumberV1(chain.previousCase),
    rootCaseId: getRemakeAttributionCaseIdV1(chain.rootCase),
    rootCaseNumber: getRemakeAttributionCaseNumberV1(chain.rootCase),
    rootConfirmationMethod: cleanRemakeAttributionTextV1(chain.rootConfirmationMethod || ''),
    rootConfirmationPolicyVersion: cleanRemakeAttributionTextV1(chain.rootConfirmationPolicyVersion || remakeProductAttributionTerminalRootPolicyVersionV1),
    chainStatus: chain.status,
    chainStatusReason: chain.statusReason,
    chainDepth: chain.chainDepth,
    chainPath: chain.chainPath,
    noRemakeRootFlag: noRoot,
    unconfirmedRootFlag: unconfirmedRoot,
    rootMissingFlag: chain.rootMissingFlag,
    multiChainFlag: chain.chainDepth > 1,
    cycleFlag: chain.cycleFlag,
    brokenChainFlag: brokenChain,
    chainAlignmentStatus: getRemakeAttributionChainAlignmentV1(chain, ceramist),

    immediatePreviousProducts: previousProducts,
    rootProducts: rootProducts,
    immediatePreviousCandidate: previousCandidate,
    rootCandidate: rootCandidate,

    proposedRemadeSourceCaseRole: noRoot ? 'no_remake_root' : 'PENDING_BUSINESS_RULE',
    proposedRemadeSourceCaseNumber: 0,
    proposedRemadeProductId: noRootBucket ? noRootBucket.productId : '',
    proposedRemadeProductName: noRootBucket ? noRootBucket.productName : '',
    proposedRemadeProductGroup: noRootBucket ? noRootBucket.productGroup : '',
    proposedRemadeDepartment: noRootBucket ? noRootBucket.department : '',
    remadeProductMappingStatus: noRoot
      ? 'no_remake_root_candidate'
      : (unconfirmedRoot
        ? 'unconfirmed_root_review'
        : (brokenChain
          ? 'broken_chain_review'
          : (chain.cycleFlag
            ? 'cycle_review'
            : (chain.status === 'resolved'
              ? (chain.chainDepth > 1 ? 'pending_root_vs_previous_rule' : 'pending_product_mapping_rule')
              : 'unresolved_chain_review')))),
    remadeProductMappingMethod: noRoot
      ? 'candidate_no_remake_root_bucket_pending_business_approval'
      : 'audit_only_no_final_mapping_applied_no_current_product_fallback',
    ambiguousProductFlag: previousCandidate.status.indexOf('ambiguous') === 0 || rootCandidate.status.indexOf('ambiguous') === 0,
    unmatchedFlag: unconfirmedRoot || brokenChain || chain.cycleFlag || previousCandidate.status === 'no_historical_products' || rootCandidate.status === 'no_historical_products',

    ceramist: ceramist.ceramist || '',
    ceramistAttributionStatus: ceramist.attributionStatus || '',
    ceramistAttributionBasis: ceramist.attributionBasis || '',
    ceramistRootMissingFlag: ceramist.rootMissingFlag === true,
    ceramistPopulationChainStatus: ceramist.populationChainStatus || '',
    ceramistPopulationChainConfirmed: ceramist.populationChainConfirmed === true
  };
}

function mapRemakeAttributionHistoricalCandidateV1(currentRow, historicalProducts, sourceRole) {
  const products = Array.isArray(historicalProducts) ? historicalProducts : [];
  if (!products.length) {
    return {
      sourceRole: sourceRole,
      status: 'no_historical_products',
      method: 'none',
      product: null,
      candidates: []
    };
  }

  const currentProductId = cleanRemakeAttributionTextV1(currentRow && currentRow.productId || '');
  if (currentProductId) {
    const exactMatches = products.filter(function(product) {
      return cleanRemakeAttributionTextV1(product.productId) === currentProductId;
    });
    if (exactMatches.length === 1) {
      return {
        sourceRole: sourceRole,
        status: 'candidate_exact_product_id',
        method: 'exact_product_id',
        product: exactMatches[0],
        candidates: exactMatches
      };
    }
    if (exactMatches.length > 1) {
      return {
        sourceRole: sourceRole,
        status: 'ambiguous_duplicate_product_id',
        method: 'exact_product_id_multiple_lines',
        product: null,
        candidates: exactMatches
      };
    }
  }

  if (products.length === 1) {
    return {
      sourceRole: sourceRole,
      status: 'candidate_single_historical_product',
      method: 'single_historical_product',
      product: products[0],
      candidates: products
    };
  }

  return {
    sourceRole: sourceRole,
    status: 'ambiguous_multiple_historical_products',
    method: 'review_required',
    product: null,
    candidates: products
  };
}

function buildRemakeAttributionNoRootBucketV1() {
  return {
    productId: '__NO_REMAKE_ROOT__',
    productName: remakeProductAttributionNoRootLabelV1,
    productGroup: remakeProductAttributionNoRootLabelV1,
    department: remakeProductAttributionNoRootLabelV1
  };
}

function classifyRemakeAttributionCaseDispositionV1(chain, previousProducts, rootProducts) {
  if (chain.noRemakeRootFlag) return 'NO_REMAKE_ROOT_CONFIRMED';
  if (chain.unconfirmedRootFlag) return 'REVIEW_UNCONFIRMED_ROOT';
  if (chain.brokenChainFlag) return 'REVIEW_BROKEN_CHAIN';
  if (chain.cycleFlag) return 'REVIEW_CYCLE';
  if (chain.status !== 'resolved') return 'REVIEW_UNRESOLVED_CHAIN';
  if (!previousProducts.length && !rootProducts.length) return 'REVIEW_NO_HISTORICAL_PRODUCTS';
  if (previousProducts.length > 1 || rootProducts.length > 1) return 'REVIEW_MULTI_PRODUCT';
  if (chain.chainDepth > 1) return 'REVIEW_ROOT_VS_PREVIOUS';
  return 'READY_FOR_PRODUCT_MAPPING_RULE_REVIEW';
}

function loadRemakeAttributionCeramistMapV1() {
  const result = {};
  const rows = loadRemakeAttributionCeramistRowsV1();

  rows.forEach(function(row) {
    const caseNumber = Number(row.caseNumber || row.currentCaseNumber || row.remakeCaseNumber || 0);
    if (!Number.isFinite(caseNumber) || caseNumber <= 0) return;
    const key = String(Math.trunc(caseNumber));
    if (result[key]) return;
    result[key] = {
      ceramist: cleanRemakeAttributionTextV1(
        row.ceramist || row.responsibleCeramist || row.worker || row.technician || row.completedBy || ''
      ),
      attributionStatus: cleanRemakeAttributionTextV1(row.attributionStatus || ''),
      attributionBasis: cleanRemakeAttributionTextV1(row.attributionBasis || ''),
      rootMissingFlag: row.rootMissingFlag === true || row.ceramistRootMissingFlag === true,
      populationChainStatus: cleanRemakeAttributionTextV1(row.populationChainStatus || ''),
      populationChainConfirmed: row.populationChainConfirmed === true,
      chainDepth: Number(row.chainDepth || 0),
      previousCaseNumber: Number(row.previousCaseNumber || 0),
      rootCaseNumber: Number(row.rootCaseNumber || 0),
      populationChainReason: cleanRemakeAttributionTextV1(row.populationChainReason || ''),
      source: 'raw_ceramist_drive_cache_no_badge_enrichment'
    };
  });
  return result;
}

function getRemakeAttributionChainAlignmentV1(chain, ceramist) {
  const sidecarStatus = cleanRemakeAttributionTextV1(ceramist && ceramist.populationChainStatus || '');
  if (!sidecarStatus) return 'ceramist_chain_not_available';

  if (sidecarStatus === 'unlinked' && ceramist.populationChainConfirmed === true) {
    return chain.noRemakeRootFlag === true ? 'match_confirmed_no_root' : 'mismatch_no_root';
  }

  if (sidecarStatus === 'resolved' && ceramist.populationChainConfirmed === true) {
    if (chain.status !== 'resolved') return 'mismatch_resolved_status';
    const previousMatches = Number(ceramist.previousCaseNumber || 0) === getRemakeAttributionCaseNumberV1(chain.previousCase);
    const rootMatches = Number(ceramist.rootCaseNumber || 0) === getRemakeAttributionCaseNumberV1(chain.rootCase);
    return previousMatches && rootMatches ? 'match_resolved_chain' : 'mismatch_resolved_case_numbers';
  }

  if (sidecarStatus === 'deferred') return 'ceramist_chain_deferred';
  if (sidecarStatus === 'error') return 'ceramist_chain_error';
  if (sidecarStatus === 'unlinked_unconfirmed') return 'ceramist_chain_unlinked_unconfirmed';
  return 'ceramist_chain_' + sidecarStatus;
}

function buildRemakeAttributionAuditStatsV1(caseSummaries, auditRows, totalEligibleCases, auditedCases) {
  const stats = {
    totalEligibleCases: totalEligibleCases,
    auditedCases: auditedCases,
    truncatedCases: Math.max(0, totalEligibleCases - auditedCases),
    auditRows: auditRows.length,
    resolvedCases: 0,
    noRemakeRootCases: 0,
    unconfirmedRootCases: 0,
    brokenChainCases: 0,
    cycleCases: 0,
    maxDepthCases: 0,
    multiChainCases: 0,
    multiProductReviewCases: 0,
    readyForProductMappingRuleReviewCases: 0,
    pendingRootVsPreviousCases: 0,
    detailBlankResolvedCases: 0,
    queryFallbackResolvedCases: 0,
    ceramistAttributedCases: 0,
    ceramistUnattributedCases: 0,
    ceramistChainMatchCases: 0,
    ceramistChainMismatchCases: 0,
    noRemakeRootRows: 0,
    unconfirmedRootRows: 0,
    brokenChainRows: 0,
    ambiguousProductRows: 0
  };

  (caseSummaries || []).forEach(function(row) {
    if (row.chainStatus === 'resolved') stats.resolvedCases++;
    if (row.noRemakeRootFlag) stats.noRemakeRootCases++;
    if (row.unconfirmedRootFlag) stats.unconfirmedRootCases++;
    if (row.brokenChainFlag) stats.brokenChainCases++;
    if (row.cycleFlag) stats.cycleCases++;
    if (row.chainStatus === 'max_depth_exceeded') stats.maxDepthCases++;
    if (row.multiChainFlag) stats.multiChainCases++;
    if (row.auditDisposition === 'REVIEW_MULTI_PRODUCT') stats.multiProductReviewCases++;
    if (row.auditDisposition === 'READY_FOR_PRODUCT_MAPPING_RULE_REVIEW') stats.readyForProductMappingRuleReviewCases++;
    if (row.auditDisposition === 'REVIEW_ROOT_VS_PREVIOUS') stats.pendingRootVsPreviousCases++;
    if (row.rootConfirmationMethod === 'detail_blank') stats.detailBlankResolvedCases++;
    if (row.rootConfirmationMethod === 'query_blank_detail_omitted') stats.queryFallbackResolvedCases++;
    if (row.ceramistAttributionStatus === 'attributed') stats.ceramistAttributedCases++;
    else if (row.ceramistAttributionStatus) stats.ceramistUnattributedCases++;
    if (/^match_/.test(row.chainAlignmentStatus || '')) stats.ceramistChainMatchCases++;
    if (/^mismatch_/.test(row.chainAlignmentStatus || '')) stats.ceramistChainMismatchCases++;
  });

  (auditRows || []).forEach(function(row) {
    if (row.noRemakeRootFlag) stats.noRemakeRootRows++;
    if (row.unconfirmedRootFlag) stats.unconfirmedRootRows++;
    if (row.brokenChainFlag) stats.brokenChainRows++;
    if (row.ambiguousProductFlag) stats.ambiguousProductRows++;
  });

  return stats;
}

function profileRemakeProductAttributionAuditCompactV1(options) {
  const opts = Object.assign({}, options || {}, {
    includeCaseSummaries: true,
    includeAuditRows: true
  });
  const result = buildRemakeProductAttributionAuditV1(opts);
  if (!result || result.ok !== true) return result;

  const sampleSize = Math.max(1, Number(opts.sampleSize || 12));
  return {
    ok: true,
    version: result.version,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: result.generatedAt,
    mappingRuleState: result.mappingRuleState,
    linkedTerminalPolicyVersion: result.linkedTerminalPolicyVersion,
    stats: result.stats,
    sampleCases: (result.caseSummaries || []).slice(0, sampleSize).map(function(row) {
      return {
        currentCaseNumber: Number(row.currentCaseNumber || 0),
        currentRemakeProductNames: Array.isArray(row.currentRemakeProductNames) ? row.currentRemakeProductNames : [],
        chainStatus: cleanRemakeAttributionTextV1(row.chainStatus || ''),
        chainDepth: Number(row.chainDepth || 0),
        immediatePreviousCaseNumber: Number(row.immediatePreviousCaseNumber || 0),
        rootCaseNumber: Number(row.rootCaseNumber || 0),
        rootConfirmationMethod: cleanRemakeAttributionTextV1(row.rootConfirmationMethod || ''),
        immediatePreviousProductCount: Number(row.immediatePreviousProductCount || 0),
        rootProductCount: Number(row.rootProductCount || 0),
        ambiguousPreviousProductsFlag: row.ambiguousPreviousProductsFlag === true,
        ambiguousRootProductsFlag: row.ambiguousRootProductsFlag === true,
        chainAlignmentStatus: cleanRemakeAttributionTextV1(row.chainAlignmentStatus || ''),
        auditDisposition: cleanRemakeAttributionTextV1(row.auditDisposition || '')
      };
    }),
    sampleRows: (result.auditRows || []).slice(0, sampleSize).map(function(row) {
      return {
        currentCaseNumber: Number(row.currentCaseNumber || 0),
        currentProductId: cleanRemakeAttributionTextV1(row.currentProductId || ''),
        currentProductName: cleanRemakeAttributionTextV1(row.currentProductName || ''),
        immediatePreviousCaseNumber: Number(row.immediatePreviousCaseNumber || 0),
        rootCaseNumber: Number(row.rootCaseNumber || 0),
        rootConfirmationMethod: cleanRemakeAttributionTextV1(row.rootConfirmationMethod || ''),
        immediatePreviousCandidateStatus: cleanRemakeAttributionTextV1(row.immediatePreviousCandidate && row.immediatePreviousCandidate.status || ''),
        rootCandidateStatus: cleanRemakeAttributionTextV1(row.rootCandidate && row.rootCandidate.status || ''),
        remadeProductMappingStatus: cleanRemakeAttributionTextV1(row.remadeProductMappingStatus || ''),
        ambiguousProductFlag: row.ambiguousProductFlag === true
      };
    })
  };
}


/**
 * Compare immediate-previous vs root historical product candidates across the
 * same read-only audit population. The unit of comparison is one current remake
 * product row, not one case. This diagnostic does not choose a winning source.
 *
 * Options:
 * - maxCases: maximum unique remake cases to audit; default 50 here.
 * - sampleSize: maximum compact comparison rows to return; default 12.
 * - caseNumbers: optional explicit case-number list passed through to the audit.
 */
function profileRemakeProductAttributionCandidateComparisonV1(options) {
  const opts = Object.assign({}, options || {}, {
    includeCaseSummaries: true,
    includeAuditRows: true
  });
  if (!opts.maxCases) opts.maxCases = 50;

  const result = buildRemakeProductAttributionAuditV1(opts);
  if (!result || result.ok !== true) return result;

  const comparisonRows = (result.auditRows || []).map(function(row) {
    return buildRemakeAttributionCandidateComparisonRowV1(row);
  });
  const comparisonStats = buildRemakeAttributionCandidateComparisonStatsV1(comparisonRows);
  const sampleSize = Math.max(1, Number(opts.sampleSize || 12));
  const prioritizedRows = comparisonRows.slice().sort(compareRemakeAttributionCandidateComparisonPriorityV1);

  return {
    ok: true,
    version: result.version,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: result.generatedAt,
    purpose: 'Compare immediate-previous vs root historical product candidates without selecting or writing a final remade-product attribution.',
    policyDecisionState: 'PENDING_CANDIDATE_COMPARISON_REVIEW_NO_ATTRIBUTION_CHANGE',
    mappingRuleState: result.mappingRuleState,
    linkedTerminalPolicyVersion: result.linkedTerminalPolicyVersion,
    scope: {
      comparisonUnit: 'current_remake_product_row',
      auditedCases: Number(result.stats && result.stats.auditedCases || 0),
      auditRows: comparisonRows.length,
      multiChainCases: Number(result.stats && result.stats.multiChainCases || 0),
      sampleSize: Math.min(sampleSize, prioritizedRows.length),
      sampleOrdering: 'multi-chain rows first; then different/one-side-only evidence; then ambiguity; then same-product rows',
      note: 'Depth-1 chains have the same immediate-previous and root case by definition. Multi-chain statistics isolate the evidence that can distinguish previous-vs-root source choice.'
    },
    stats: comparisonStats,
    sampleComparisons: prioritizedRows.slice(0, sampleSize).map(function(row) {
      return compactRemakeAttributionCandidateComparisonRowV1(row);
    })
  };
}

function buildRemakeAttributionCandidateComparisonRowV1(row) {
  const previous = summarizeRemakeAttributionCandidateV1(row && row.immediatePreviousCandidate, 'immediate_previous');
  const root = summarizeRemakeAttributionCandidateV1(row && row.rootCandidate, 'root');
  const chainStatus = cleanRemakeAttributionTextV1(row && row.chainStatus || '');
  const chainDepth = Number(row && row.chainDepth || 0);
  const comparison = classifyRemakeAttributionCandidateComparisonV1(chainStatus, previous, root);

  return {
    currentCaseNumber: Number(row && row.currentCaseNumber || 0),
    currentProductId: cleanRemakeAttributionTextV1(row && row.currentProductId || ''),
    currentProductName: cleanRemakeAttributionTextV1(row && row.currentProductName || ''),
    chainStatus: chainStatus,
    chainDepth: chainDepth,
    multiChainFlag: chainDepth > 1,
    immediatePreviousCaseNumber: Number(row && row.immediatePreviousCaseNumber || 0),
    rootCaseNumber: Number(row && row.rootCaseNumber || 0),
    immediatePreviousCandidate: previous,
    rootCandidate: root,
    comparison: comparison.result,
    comparisonBasis: comparison.basis,
    auditDisposition: cleanRemakeAttributionTextV1(row && row.auditDisposition || ''),
    remadeProductMappingStatus: cleanRemakeAttributionTextV1(row && row.remadeProductMappingStatus || '')
  };
}

function summarizeRemakeAttributionCandidateV1(candidate, sourceRole) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  const product = source.product && typeof source.product === 'object' ? source.product : null;
  const status = cleanRemakeAttributionTextV1(source.status || '');
  const method = cleanRemakeAttributionTextV1(source.method || '');
  const productId = cleanRemakeAttributionTextV1(product && product.productId || '');
  const productName = cleanRemakeAttributionTextV1(product && product.productName || '');

  return {
    sourceRole: sourceRole,
    status: status,
    method: method,
    resolved: !!product && status.indexOf('candidate_') === 0,
    ambiguous: status.indexOf('ambiguous_') === 0,
    noHistoricalProducts: status === 'no_historical_products',
    productId: productId,
    productName: productName,
    productIdentityKey: getRemakeAttributionCandidateProductIdentityKeyV1(productId, productName),
    productIdentityBasis: productId ? 'product_id' : (productName ? 'product_name_fallback' : '')
  };
}

function getRemakeAttributionCandidateProductIdentityKeyV1(productId, productName) {
  const id = cleanRemakeAttributionTextV1(productId || '');
  if (id) return 'ID:' + id.toUpperCase();
  const name = cleanRemakeAttributionTextV1(productName || '');
  return name ? 'NAME:' + name.toUpperCase() : '';
}

function classifyRemakeAttributionCandidateComparisonV1(chainStatus, previous, root) {
  if (cleanRemakeAttributionTextV1(chainStatus || '') !== 'resolved') {
    return { result: 'CHAIN_UNRESOLVED', basis: 'chain_not_resolved' };
  }

  if (previous.resolved && root.resolved) {
    const sameKey = previous.productIdentityKey && previous.productIdentityKey === root.productIdentityKey;
    return sameKey
      ? {
        result: 'SAME_PRODUCT',
        basis: previous.productIdentityBasis === 'product_id' && root.productIdentityBasis === 'product_id'
          ? 'same_product_id'
          : 'same_product_identity_with_name_fallback'
      }
      : { result: 'DIFFERENT_PRODUCT', basis: 'both_resolved_different_product_identity' };
  }

  if (previous.resolved && !root.resolved) {
    return { result: 'PREVIOUS_ONLY', basis: 'previous_resolved_root_not_resolved' };
  }

  if (root.resolved && !previous.resolved) {
    return { result: 'ROOT_ONLY', basis: 'root_resolved_previous_not_resolved' };
  }

  if (previous.ambiguous && root.ambiguous) {
    return { result: 'BOTH_AMBIGUOUS', basis: 'both_candidates_ambiguous' };
  }

  if (previous.ambiguous || root.ambiguous) {
    return { result: 'ONE_AMBIGUOUS', basis: 'one_candidate_ambiguous_neither_side_resolved' };
  }

  if (previous.noHistoricalProducts && root.noHistoricalProducts) {
    return { result: 'NO_HISTORICAL_MATCH', basis: 'neither_source_has_historical_products' };
  }

  return { result: 'UNCLASSIFIED', basis: 'candidate_status_combination_not_classified' };
}

function buildRemakeAttributionCandidateComparisonStatsV1(rows) {
  const comparisonKeys = [
    'SAME_PRODUCT',
    'DIFFERENT_PRODUCT',
    'PREVIOUS_ONLY',
    'ROOT_ONLY',
    'BOTH_AMBIGUOUS',
    'ONE_AMBIGUOUS',
    'NO_HISTORICAL_MATCH',
    'CHAIN_UNRESOLVED',
    'UNCLASSIFIED'
  ];

  const stats = buildEmptyRemakeAttributionCandidateComparisonStatsV1(comparisonKeys);
  const multiChain = buildEmptyRemakeAttributionCandidateComparisonStatsV1(comparisonKeys);

  (rows || []).forEach(function(row) {
    accumulateRemakeAttributionCandidateComparisonStatsV1(stats, row);
    if (row.multiChainFlag === true) {
      accumulateRemakeAttributionCandidateComparisonStatsV1(multiChain, row);
    }
  });

  stats.multiChain = multiChain;
  return stats;
}

function buildEmptyRemakeAttributionCandidateComparisonStatsV1(comparisonKeys) {
  const comparisonCounts = {};
  (comparisonKeys || []).forEach(function(key) {
    comparisonCounts[key] = 0;
  });

  return {
    rows: 0,
    resolvedChainRows: 0,
    previousResolvableRows: 0,
    rootResolvableRows: 0,
    bothResolvableRows: 0,
    previousExactProductIdRows: 0,
    rootExactProductIdRows: 0,
    previousSingleHistoricalProductRows: 0,
    rootSingleHistoricalProductRows: 0,
    comparisonCounts: comparisonCounts,
    previousCandidateStatusCounts: {},
    rootCandidateStatusCounts: {},
    previousCandidateMethodCounts: {},
    rootCandidateMethodCounts: {}
  };
}

function accumulateRemakeAttributionCandidateComparisonStatsV1(stats, row) {
  stats.rows++;
  if (row.chainStatus === 'resolved') stats.resolvedChainRows++;
  if (row.immediatePreviousCandidate.resolved) stats.previousResolvableRows++;
  if (row.rootCandidate.resolved) stats.rootResolvableRows++;
  if (row.immediatePreviousCandidate.resolved && row.rootCandidate.resolved) stats.bothResolvableRows++;
  if (row.immediatePreviousCandidate.method === 'exact_product_id') stats.previousExactProductIdRows++;
  if (row.rootCandidate.method === 'exact_product_id') stats.rootExactProductIdRows++;
  if (row.immediatePreviousCandidate.method === 'single_historical_product') stats.previousSingleHistoricalProductRows++;
  if (row.rootCandidate.method === 'single_historical_product') stats.rootSingleHistoricalProductRows++;

  incrementRemakeAttributionCountV1(stats.comparisonCounts, row.comparison || 'UNCLASSIFIED');
  incrementRemakeAttributionCountV1(stats.previousCandidateStatusCounts, row.immediatePreviousCandidate.status || '(blank)');
  incrementRemakeAttributionCountV1(stats.rootCandidateStatusCounts, row.rootCandidate.status || '(blank)');
  incrementRemakeAttributionCountV1(stats.previousCandidateMethodCounts, row.immediatePreviousCandidate.method || '(blank)');
  incrementRemakeAttributionCountV1(stats.rootCandidateMethodCounts, row.rootCandidate.method || '(blank)');
}

function incrementRemakeAttributionCountV1(target, key) {
  const cleanKey = cleanRemakeAttributionTextV1(key || '') || '(blank)';
  target[cleanKey] = Number(target[cleanKey] || 0) + 1;
}

function compareRemakeAttributionCandidateComparisonPriorityV1(left, right) {
  const leftScore = getRemakeAttributionCandidateComparisonPriorityScoreV1(left);
  const rightScore = getRemakeAttributionCandidateComparisonPriorityScoreV1(right);
  if (leftScore !== rightScore) return leftScore - rightScore;
  if (left.currentCaseNumber !== right.currentCaseNumber) return left.currentCaseNumber - right.currentCaseNumber;
  return cleanRemakeAttributionTextV1(left.currentProductId || '').localeCompare(
    cleanRemakeAttributionTextV1(right.currentProductId || '')
  );
}

function getRemakeAttributionCandidateComparisonPriorityScoreV1(row) {
  const result = cleanRemakeAttributionTextV1(row && row.comparison || '');
  const resultPriority = {
    DIFFERENT_PRODUCT: 0,
    PREVIOUS_ONLY: 1,
    ROOT_ONLY: 2,
    BOTH_AMBIGUOUS: 3,
    ONE_AMBIGUOUS: 4,
    NO_HISTORICAL_MATCH: 5,
    SAME_PRODUCT: 6,
    CHAIN_UNRESOLVED: 7,
    UNCLASSIFIED: 8
  };
  const base = Object.prototype.hasOwnProperty.call(resultPriority, result) ? resultPriority[result] : 9;
  return (row && row.multiChainFlag === true ? 0 : 100) + base;
}

function compactRemakeAttributionCandidateComparisonRowV1(row) {
  return {
    currentCaseNumber: Number(row.currentCaseNumber || 0),
    currentProductId: cleanRemakeAttributionTextV1(row.currentProductId || ''),
    currentProductName: cleanRemakeAttributionTextV1(row.currentProductName || ''),
    chainStatus: cleanRemakeAttributionTextV1(row.chainStatus || ''),
    chainDepth: Number(row.chainDepth || 0),
    immediatePreviousCaseNumber: Number(row.immediatePreviousCaseNumber || 0),
    rootCaseNumber: Number(row.rootCaseNumber || 0),
    immediatePreviousCandidate: compactRemakeAttributionCandidateV1(row.immediatePreviousCandidate),
    rootCandidate: compactRemakeAttributionCandidateV1(row.rootCandidate),
    comparison: cleanRemakeAttributionTextV1(row.comparison || ''),
    comparisonBasis: cleanRemakeAttributionTextV1(row.comparisonBasis || '')
  };
}

function compactRemakeAttributionCandidateV1(candidate) {
  return {
    status: cleanRemakeAttributionTextV1(candidate && candidate.status || ''),
    method: cleanRemakeAttributionTextV1(candidate && candidate.method || ''),
    productId: cleanRemakeAttributionTextV1(candidate && candidate.productId || ''),
    productName: cleanRemakeAttributionTextV1(candidate && candidate.productName || '')
  };
}


/**
 * Read-only v1.1.5 decision-validation view.
 *
 * This intentionally evaluates only multi-chain rows from the same 50-case audit
 * population used by v1.1.4, because only those rows have different immediate-
 * previous and root historical cases. It projects a root-first mapping outcome
 * without changing any cache, dashboard, business rule, or persisted data.
 *
 * Proposed root-first decision being validated:
 * - unique exact product-ID candidate on root -> MAPPED_EXACT_ROOT
 * - one historical product on root -> MAPPED_SINGLE_ROOT
 * - ambiguous/multiple root products -> REVIEW_MULTI_ROOT
 * - unresolved chain -> REVIEW_UNCONFIRMED_CHAIN
 * - no usable root product -> review; never fall back to previous/current product
 */
function profileRemakeProductAttributionRootFirstDecisionValidationV1(options) {
  const opts = Object.assign({}, options || {}, {
    includeCaseSummaries: true,
    includeAuditRows: true
  });
  if (!opts.maxCases) opts.maxCases = 50;

  const result = buildRemakeProductAttributionAuditV1(opts);
  if (!result || result.ok !== true) return result;

  const multiChainRows = (result.auditRows || [])
    .map(function(row) {
      return buildRemakeAttributionCandidateComparisonRowV1(row);
    })
    .filter(function(row) {
      return row.multiChainFlag === true;
    });

  const decisionRows = multiChainRows.map(function(row) {
    return buildRemakeAttributionRootFirstDecisionRowV1(row);
  });
  const projectedCounts = buildRemakeAttributionRootFirstProjectedCountsV1(decisionRows);

  return {
    ok: true,
    version: result.version,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: result.generatedAt,
    purpose: 'Validate the proposed root-first remade-product rule across all multi-chain rows in the same 50-case QA population without applying attribution.',
    policyDecisionState: 'PENDING_ROOT_FIRST_DECISION_VALIDATION_NO_ATTRIBUTION_CHANGE',
    mappingRuleState: result.mappingRuleState,
    linkedTerminalPolicyVersion: result.linkedTerminalPolicyVersion,
    scope: {
      comparisonUnit: 'current_remake_product_row',
      auditedCases: Number(result.stats && result.stats.auditedCases || 0),
      auditRows: Number(result.stats && result.stats.auditRows || 0),
      multiChainCases: Number(result.stats && result.stats.multiChainCases || 0),
      multiChainRows: decisionRows.length,
      proposedSourceCaseRole: 'root',
      proposedRule: 'unique root exact-product-ID match first; otherwise single root historical product; otherwise review; never fall back to immediate previous or current remake product'
    },
    projectedCounts: projectedCounts,
    decisionRows: decisionRows
  };
}

function buildRemakeAttributionRootFirstDecisionRowV1(row) {
  const previous = row && row.immediatePreviousCandidate ? row.immediatePreviousCandidate : {};
  const root = row && row.rootCandidate ? row.rootCandidate : {};
  const decision = classifyRemakeAttributionRootFirstDecisionV1(row);

  return {
    currentCaseNumber: Number(row && row.currentCaseNumber || 0),
    currentProductId: cleanRemakeAttributionTextV1(row && row.currentProductId || ''),
    currentProductName: cleanRemakeAttributionTextV1(row && row.currentProductName || ''),
    chainStatus: cleanRemakeAttributionTextV1(row && row.chainStatus || ''),
    chainDepth: Number(row && row.chainDepth || 0),
    immediatePreviousCaseNumber: Number(row && row.immediatePreviousCaseNumber || 0),
    rootCaseNumber: Number(row && row.rootCaseNumber || 0),
    immediatePreviousCandidate: compactRemakeAttributionCandidateV1(previous),
    rootCandidate: compactRemakeAttributionCandidateV1(root),
    previousVsRootComparison: cleanRemakeAttributionTextV1(row && row.comparison || ''),
    proposedSourceCaseRole: 'root',
    projectedStatus: decision.status,
    projectedMappingMethod: decision.method,
    projectedProductId: decision.productId,
    projectedProductName: decision.productName,
    reviewReason: decision.reviewReason
  };
}

function classifyRemakeAttributionRootFirstDecisionV1(row) {
  const chainStatus = cleanRemakeAttributionTextV1(row && row.chainStatus || '');
  const root = row && row.rootCandidate ? row.rootCandidate : {};
  const rootStatus = cleanRemakeAttributionTextV1(root.status || '');
  const rootMethod = cleanRemakeAttributionTextV1(root.method || '');
  const rootProductId = cleanRemakeAttributionTextV1(root.productId || '');
  const rootProductName = cleanRemakeAttributionTextV1(root.productName || '');

  if (chainStatus !== 'resolved') {
    return {
      status: 'REVIEW_UNCONFIRMED_CHAIN',
      method: 'review_required_chain_not_resolved',
      productId: '',
      productName: '',
      reviewReason: 'Root-first mapping is not allowed until the remake chain is resolved.'
    };
  }

  if (rootStatus === 'candidate_exact_product_id' && rootMethod === 'exact_product_id') {
    return {
      status: 'MAPPED_EXACT_ROOT',
      method: 'root_exact_product_id',
      productId: rootProductId,
      productName: rootProductName,
      reviewReason: ''
    };
  }

  if (rootStatus === 'candidate_single_historical_product' && rootMethod === 'single_historical_product') {
    return {
      status: 'MAPPED_SINGLE_ROOT',
      method: 'root_single_historical_product',
      productId: rootProductId,
      productName: rootProductName,
      reviewReason: ''
    };
  }

  if (rootStatus.indexOf('ambiguous_') === 0) {
    return {
      status: 'REVIEW_MULTI_ROOT',
      method: 'review_required_root_ambiguous',
      productId: '',
      productName: '',
      reviewReason: 'Root case does not identify one unique historical product; no fallback to immediate previous or current remake product.'
    };
  }

  if (rootStatus === 'no_historical_products') {
    return {
      status: 'REVIEW_NO_ROOT_PRODUCTS',
      method: 'review_required_no_root_products',
      productId: '',
      productName: '',
      reviewReason: 'Resolved root case has no usable historical product candidate; no fallback is applied.'
    };
  }

  return {
    status: 'REVIEW_ROOT_UNRESOLVED',
    method: 'review_required_root_candidate_not_resolved',
    productId: '',
    productName: '',
    reviewReason: 'Root candidate did not meet an approved projected mapping condition.'
  };
}

function buildRemakeAttributionRootFirstProjectedCountsV1(rows) {
  const counts = {
    rows: 0,
    MAPPED_EXACT_ROOT: 0,
    MAPPED_SINGLE_ROOT: 0,
    REVIEW_MULTI_ROOT: 0,
    REVIEW_UNCONFIRMED_CHAIN: 0,
    REVIEW_NO_ROOT_PRODUCTS: 0,
    REVIEW_ROOT_UNRESOLVED: 0
  };

  (rows || []).forEach(function(row) {
    counts.rows++;
    const key = cleanRemakeAttributionTextV1(row && row.projectedStatus || 'REVIEW_ROOT_UNRESOLVED');
    if (!Object.prototype.hasOwnProperty.call(counts, key)) counts[key] = 0;
    counts[key]++;
  });

  counts.projectedMappedRows = counts.MAPPED_EXACT_ROOT + counts.MAPPED_SINGLE_ROOT;
  counts.projectedReviewRows = counts.rows - counts.projectedMappedRows;
  return counts;
}

function uniqueRemakeAttributionValuesV1(values) {
  const seen = {};
  const result = [];
  (values || []).forEach(function(value) {
    const clean = cleanRemakeAttributionTextV1(value);
    if (!clean || seen[clean]) return;
    seen[clean] = true;
    result.push(clean);
  });
  return result;
}

function cleanRemakeAttributionTextV1(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toRemakeAttributionNumberV1(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = typeof value === 'string' ? value.replace(/[$,%\s,]/g, '') : value;
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : 0;
}


/**
 * Read-only v1.1.6 validation: isolate non-exact single-root product candidates.
 *
 * A single historical product on the root is NOT treated as proof that it is the
 * same product as the current remake line. This view returns the evidence needed
 * to review those cases explicitly before any fallback rule is approved.
 */
function profileRemakeProductAttributionNonExactValidationV1(options) {
  const opts = Object.assign({}, options || {}, {
    includeCaseSummaries: true,
    includeAuditRows: true
  });
  if (!opts.maxCases) opts.maxCases = 50;

  const result = buildRemakeProductAttributionAuditV1(opts);
  if (!result || result.ok !== true) return result;

  const rows = (result.auditRows || []).filter(function(row) {
    const root = row && row.rootCandidate ? row.rootCandidate : {};
    return cleanRemakeAttributionTextV1(row && row.chainStatus || '') === 'resolved' &&
      cleanRemakeAttributionTextV1(root.status || '') === 'candidate_single_historical_product' &&
      cleanRemakeAttributionTextV1(root.method || '') === 'single_historical_product';
  }).map(function(row) {
    return buildRemakeAttributionNonExactEvidenceRowV116(row);
  }).sort(function(a, b) {
    if (a.currentCaseNumber !== b.currentCaseNumber) return a.currentCaseNumber - b.currentCaseNumber;
    return a.currentProductId.localeCompare(b.currentProductId);
  });

  const differenceCounts = {};
  rows.forEach(function(row) {
    const key = cleanRemakeAttributionTextV1(row.productIdentityComparison || 'UNCLASSIFIED');
    differenceCounts[key] = Number(differenceCounts[key] || 0) + 1;
  });

  return {
    ok: true,
    version: result.version,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: result.generatedAt,
    purpose: 'Review every resolved single-root candidate where no unique exact root Product ID match exists before approving any non-exact fallback.',
    policyDecisionState: 'NON_EXACT_ROOT_FALLBACK_NOT_APPROVED_REVIEW_REQUIRED',
    scope: {
      auditedCases: Number(result.stats && result.stats.auditedCases || 0),
      auditRows: Number(result.stats && result.stats.auditRows || 0),
      nonExactSingleRootRows: rows.length,
      note: 'These rows were previously projected as MAPPED_SINGLE_ROOT in v1.1.5. v1.1.6 treats them as evidence-only review rows until a business rule explicitly permits the different Product ID.'
    },
    checks: {
      allReturnedRowsResolvedChain: rows.every(function(row) { return row.chainStatus === 'resolved'; }),
      allReturnedRowsUseSingleRootCandidate: rows.every(function(row) { return row.rootCandidateMethod === 'single_historical_product'; }),
      returnedRowsWithSameProductId: rows.filter(function(row) { return row.sameProductId === true; }).length,
      returnedRowsWithDifferentProductId: rows.filter(function(row) { return row.sameProductId !== true; }).length
    },
    productIdentityComparisonCounts: differenceCounts,
    rows: rows
  };
}

function buildRemakeAttributionNonExactEvidenceRowV116(row) {
  const rootCandidate = row && row.rootCandidate ? row.rootCandidate : {};
  const rootProduct = rootCandidate.product && typeof rootCandidate.product === 'object' ? rootCandidate.product : {};
  const previousCandidate = row && row.immediatePreviousCandidate ? row.immediatePreviousCandidate : {};
  const currentProductId = cleanRemakeAttributionTextV1(row && row.currentProductId || '');
  const currentProductName = cleanRemakeAttributionTextV1(row && row.currentProductName || '');
  const rootProductId = cleanRemakeAttributionTextV1(rootProduct.productId || '');
  const rootProductName = cleanRemakeAttributionTextV1(rootProduct.productName || '');
  const sameProductId = !!currentProductId && !!rootProductId && currentProductId === rootProductId;
  const sameProductName = !!currentProductName && !!rootProductName &&
    currentProductName.toLowerCase() === rootProductName.toLowerCase();

  return {
    currentCaseNumber: Number(row && row.currentCaseNumber || 0),
    currentProductId: currentProductId,
    currentProductName: currentProductName,
    currentProductGroup: cleanRemakeAttributionTextV1(row && row.currentProductGroup || ''),
    currentDepartment: cleanRemakeAttributionTextV1(row && row.currentDepartment || ''),
    currentRemakeReason: cleanRemakeAttributionTextV1(row && row.currentRemakeReason || ''),
    chainStatus: cleanRemakeAttributionTextV1(row && row.chainStatus || ''),
    chainDepth: Number(row && row.chainDepth || 0),
    immediatePreviousCaseNumber: Number(row && row.immediatePreviousCaseNumber || 0),
    rootCaseNumber: Number(row && row.rootCaseNumber || 0),
    previousCandidateStatus: cleanRemakeAttributionTextV1(previousCandidate.status || ''),
    previousCandidateMethod: cleanRemakeAttributionTextV1(previousCandidate.method || ''),
    previousProductId: cleanRemakeAttributionTextV1(previousCandidate.product && previousCandidate.product.productId || ''),
    previousProductName: cleanRemakeAttributionTextV1(previousCandidate.product && previousCandidate.product.productName || ''),
    rootCandidateStatus: cleanRemakeAttributionTextV1(rootCandidate.status || ''),
    rootCandidateMethod: cleanRemakeAttributionTextV1(rootCandidate.method || ''),
    rootProductId: rootProductId,
    rootProductName: rootProductName,
    rootProductGroupRaw: cleanRemakeAttributionTextV1(rootProduct.productGroupRaw || ''),
    rootDepartmentRaw: cleanRemakeAttributionTextV1(rootProduct.departmentRaw || ''),
    sameProductId: sameProductId,
    sameProductName: sameProductName,
    productIdentityComparison: classifyRemakeAttributionProductIdentityEvidenceV116(
      currentProductId,
      currentProductName,
      rootProductId,
      rootProductName
    ),
    proposedTreatment: 'REVIEW_NON_EXACT_SINGLE_ROOT',
    reviewReason: 'One root product exists, but there is no approved rule allowing a different Product ID to be treated as the same original product.'
  };
}

function classifyRemakeAttributionProductIdentityEvidenceV116(currentProductId, currentProductName, rootProductId, rootProductName) {
  const currentId = cleanRemakeAttributionTextV1(currentProductId || '');
  const rootId = cleanRemakeAttributionTextV1(rootProductId || '');
  const currentName = cleanRemakeAttributionTextV1(currentProductName || '');
  const rootName = cleanRemakeAttributionTextV1(rootProductName || '');

  if (!currentId) return 'CURRENT_PRODUCT_ID_MISSING';
  if (!rootId) return 'ROOT_PRODUCT_ID_MISSING';
  if (currentId === rootId) return 'SAME_PRODUCT_ID';
  if (currentName && rootName && currentName.toLowerCase() === rootName.toLowerCase()) {
    return 'DIFFERENT_ID_SAME_NAME';
  }
  return 'DIFFERENT_ID_DIFFERENT_NAME';
}


/**
 * Read-only v1.1.6 dashboard-presentation model.
 *
 * Every input row is already a valid current remake product row. This model
 * therefore keeps every row in remake-event totals and changes only the proposed
 * Product / Product Group / Department presentation state when historical
 * attribution is unresolved or under review.
 */
function profileRemakeProductAttributionUnresolvedDisplayValidationV1(options) {
  const opts = Object.assign({}, options || {}, {
    includeCaseSummaries: true,
    includeAuditRows: true
  });
  if (!opts.maxCases) opts.maxCases = 50;
  const samplesPerBucket = Math.max(1, Math.min(3, Number(opts.samplesPerBucket || 2)));

  const result = buildRemakeProductAttributionAuditV1(opts);
  if (!result || result.ok !== true) return result;

  const modeledRows = (result.auditRows || []).map(function(row) {
    return buildRemakeAttributionDashboardPresentationRowV116(row);
  });

  const bucketCounts = buildRemakeAttributionDashboardBucketCountsV116(modeledRows);
  const sampleRows = buildRemakeAttributionDashboardBucketSamplesV116(modeledRows, samplesPerBucket);
  const totalBucketRows = Object.keys(bucketCounts).reduce(function(total, key) {
    return total + Number(bucketCounts[key] || 0);
  }, 0);

  return {
    ok: true,
    version: result.version,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: result.generatedAt,
    purpose: 'Model explicit dashboard buckets for unresolved/review attribution while preserving every valid remake event in totals.',
    policyDecisionState: 'DASHBOARD_UNRESOLVED_PRESENTATION_CANDIDATE_ONLY_NO_UI_CHANGE',
    scope: {
      auditedCases: Number(result.stats && result.stats.auditedCases || 0),
      auditRows: modeledRows.length,
      samplesPerBucket: samplesPerBucket,
      eventRule: 'Historical attribution failure must not remove a valid current remake event from Remake Cases, Remake Units, Remake Discount, customer, reason, or time totals.',
      dimensionRule: 'Product / Product Group / Department may use an explicit unresolved/review bucket when historical attribution is not approved.'
    },
    eventRetentionChecks: {
      validRemakeRowsInput: modeledRows.length,
      retainedRemakeRows: modeledRows.filter(function(row) { return row.includeInRemakeEventTotals === true; }).length,
      excludedRemakeRows: modeledRows.filter(function(row) { return row.includeInRemakeEventTotals !== true; }).length,
      allAuditRowsAssignedToPresentationBucket: totalBucketRows === modeledRows.length
    },
    dashboardBucketCounts: bucketCounts,
    proposedLabels: {
      UNRESOLVED_NO_REMAKE_ROOT: 'Unresolved - No Remake Root',
      UNRESOLVED_UNCONFIRMED_ROOT: 'Unresolved - Unconfirmed Root',
      UNRESOLVED_BROKEN_CHAIN: 'Unresolved - Broken Chain',
      UNRESOLVED_CYCLE: 'Unresolved - Chain Cycle',
      UNRESOLVED_OTHER_CHAIN: 'Unresolved - Chain Review',
      REVIEW_NON_EXACT_SINGLE_ROOT: 'Review - Product Changed / No Exact Match',
      REVIEW_MULTIPLE_ROOT_PRODUCTS: 'Review - Multiple Root Products',
      REVIEW_NO_ROOT_PRODUCTS: 'Review - No Root Products',
      REVIEW_ROOT_UNRESOLVED: 'Review - Root Product Unresolved'
    },
    sampleRows: sampleRows
  };
}

function buildRemakeAttributionDashboardPresentationRowV116(row) {
  const bucket = classifyRemakeAttributionDashboardBucketV116(row);
  return {
    currentCaseNumber: Number(row && row.currentCaseNumber || 0),
    currentProductId: cleanRemakeAttributionTextV1(row && row.currentProductId || ''),
    currentProductName: cleanRemakeAttributionTextV1(row && row.currentProductName || ''),
    chainStatus: cleanRemakeAttributionTextV1(row && row.chainStatus || ''),
    chainDepth: Number(row && row.chainDepth || 0),
    rootCaseNumber: Number(row && row.rootCaseNumber || 0),
    rootCandidateStatus: cleanRemakeAttributionTextV1(row && row.rootCandidate && row.rootCandidate.status || ''),
    rootCandidateMethod: cleanRemakeAttributionTextV1(row && row.rootCandidate && row.rootCandidate.method || ''),
    presentationBucket: bucket.key,
    proposedDimensionLabel: bucket.label,
    includeInRemakeEventTotals: true,
    dimensionAttributionState: bucket.attributionState,
    reason: bucket.reason
  };
}

function classifyRemakeAttributionDashboardBucketV116(row) {
  const chainStatus = cleanRemakeAttributionTextV1(row && row.chainStatus || '');
  const root = row && row.rootCandidate ? row.rootCandidate : {};
  const rootStatus = cleanRemakeAttributionTextV1(root.status || '');
  const rootMethod = cleanRemakeAttributionTextV1(root.method || '');

  if (row && row.noRemakeRootFlag === true) {
    return buildRemakeAttributionDashboardBucketV116(
      'UNRESOLVED_NO_REMAKE_ROOT',
      'Unresolved - No Remake Root',
      'review_bucket',
      'Current remake event is valid, but there is no confirmed linked remake root.'
    );
  }
  if (row && row.unconfirmedRootFlag === true) {
    return buildRemakeAttributionDashboardBucketV116(
      'UNRESOLVED_UNCONFIRMED_ROOT',
      'Unresolved - Unconfirmed Root',
      'review_bucket',
      'Current remake event is valid, but the historical root cannot be confirmed.'
    );
  }
  if (row && row.brokenChainFlag === true) {
    return buildRemakeAttributionDashboardBucketV116(
      'UNRESOLVED_BROKEN_CHAIN',
      'Unresolved - Broken Chain',
      'review_bucket',
      'Current remake event is valid, but a linked historical case cannot be read.'
    );
  }
  if (row && row.cycleFlag === true) {
    return buildRemakeAttributionDashboardBucketV116(
      'UNRESOLVED_CYCLE',
      'Unresolved - Chain Cycle',
      'review_bucket',
      'Current remake event is valid, but the linked chain contains a cycle.'
    );
  }
  if (chainStatus !== 'resolved') {
    return buildRemakeAttributionDashboardBucketV116(
      'UNRESOLVED_OTHER_CHAIN',
      'Unresolved - Chain Review',
      'review_bucket',
      'Current remake event is valid, but the linked chain is not resolved.'
    );
  }
  if (rootStatus === 'candidate_exact_product_id' && rootMethod === 'exact_product_id') {
    return buildRemakeAttributionDashboardBucketV116(
      'ATTRIBUTED_EXACT_ROOT',
      '',
      'mapped_root_product',
      'Unique exact root Product ID match.'
    );
  }
  if (rootStatus === 'candidate_single_historical_product' && rootMethod === 'single_historical_product') {
    return buildRemakeAttributionDashboardBucketV116(
      'REVIEW_NON_EXACT_SINGLE_ROOT',
      'Review - Product Changed / No Exact Match',
      'review_bucket',
      'One root product exists, but no approved rule permits a different Product ID fallback.'
    );
  }
  if (rootStatus.indexOf('ambiguous_') === 0) {
    return buildRemakeAttributionDashboardBucketV116(
      'REVIEW_MULTIPLE_ROOT_PRODUCTS',
      'Review - Multiple Root Products',
      'review_bucket',
      'Root case does not identify one unique historical product.'
    );
  }
  if (rootStatus === 'no_historical_products') {
    return buildRemakeAttributionDashboardBucketV116(
      'REVIEW_NO_ROOT_PRODUCTS',
      'Review - No Root Products',
      'review_bucket',
      'Resolved root case has no usable historical products.'
    );
  }
  return buildRemakeAttributionDashboardBucketV116(
    'REVIEW_ROOT_UNRESOLVED',
    'Review - Root Product Unresolved',
    'review_bucket',
    'Root product candidate does not meet an approved attribution condition.'
  );
}

function buildRemakeAttributionDashboardBucketV116(key, label, attributionState, reason) {
  return {
    key: key,
    label: label,
    attributionState: attributionState,
    reason: reason
  };
}

function buildRemakeAttributionDashboardBucketCountsV116(rows) {
  const keys = [
    'ATTRIBUTED_EXACT_ROOT',
    'REVIEW_NON_EXACT_SINGLE_ROOT',
    'REVIEW_MULTIPLE_ROOT_PRODUCTS',
    'REVIEW_NO_ROOT_PRODUCTS',
    'REVIEW_ROOT_UNRESOLVED',
    'UNRESOLVED_NO_REMAKE_ROOT',
    'UNRESOLVED_UNCONFIRMED_ROOT',
    'UNRESOLVED_BROKEN_CHAIN',
    'UNRESOLVED_CYCLE',
    'UNRESOLVED_OTHER_CHAIN'
  ];
  const counts = {};
  keys.forEach(function(key) { counts[key] = 0; });
  (rows || []).forEach(function(row) {
    const key = cleanRemakeAttributionTextV1(row && row.presentationBucket || 'REVIEW_ROOT_UNRESOLVED');
    if (!Object.prototype.hasOwnProperty.call(counts, key)) counts[key] = 0;
    counts[key]++;
  });
  return counts;
}

function buildRemakeAttributionDashboardBucketSamplesV116(rows, samplesPerBucket) {
  const counts = {};
  const samples = [];
  (rows || []).forEach(function(row) {
    if (row.presentationBucket === 'ATTRIBUTED_EXACT_ROOT') return;
    const key = cleanRemakeAttributionTextV1(row.presentationBucket || '');
    const used = Number(counts[key] || 0);
    if (used >= samplesPerBucket) return;
    counts[key] = used + 1;
    samples.push(row);
  });
  return samples;
}
