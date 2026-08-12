/**
 * Remake Factor Attribution Data Projection
 * Version: v1.0.0 - 2026-08-08
 * State: Prepared only - read-only QA/data-model staging helper
 *
 * Purpose:
 * - Preserve every valid current remake product row and its event metrics.
 * - Resolve historical attribution through the validated remakeCaseID root chain.
 * - Attribute Product / Product Group / Department only when the confirmed root
 *   contains exactly one Product ID match to the current remake Product ID.
 * - Never use the immediate-previous case or current remake product as a fallback
 *   for historical attribution.
 * - Keep non-exact, ambiguous, and unresolved historical attribution visible via
 *   explicit Review / Unresolved display labels instead of dropping remake rows.
 * - Reconcile row count, unique remake cases, remake units, and Remake Discount
 *   before any cache write, dashboard wiring, or production release.
 *
 * Required existing project helpers:
 * - RemakeFactorAttributionAudit.js v1.1.6 or later compatible audit contract
 * - RemakeFactorCache.js v1.34.2 or later compatible product metadata helpers
 *
 * Safety:
 * - No Drive/cache writes.
 * - No trigger changes.
 * - No Git operations.
 * - No dashboard/UI writes.
 * - No deployment operations.
 */

const remakeFactorAttributionDataProjectionVersionV1 = 'remake-factor-attribution-data-projection-v1.0.0';
const remakeFactorAttributionDataProjectionPolicyV1 = 'EXACT_ROOT_ONLY_REVIEW_UNRESOLVED_NO_FALLBACK';

/**
 * Full read-only projection result. This can be large; use
 * profileRemakeFactorAttributionDataProjectionV1() for execution-log QA.
 */
function buildRemakeFactorAttributionDataProjectionV1(options) {
  const opts = Object.assign({}, options || {}, {
    includeCaseSummaries: true,
    includeAuditRows: true
  });
  if (!opts.maxCases) opts.maxCases = 50;

  const audit = buildRemakeProductAttributionAuditV1(opts);
  if (!audit || audit.ok !== true) return audit;

  const productMetadata = loadRemakeFactorAttributionProjectionProductMapV1(opts);
  const productMap = productMetadata.productMap || {};
  const inputRows = Array.isArray(audit.auditRows) ? audit.auditRows : [];
  const projectedRows = inputRows.map(function(row) {
    return buildRemakeFactorAttributionProjectionRowV1(row, productMap);
  });
  const reconciliation = reconcileRemakeFactorAttributionProjectionV1(inputRows, projectedRows);

  return {
    ok: true,
    version: remakeFactorAttributionDataProjectionVersionV1,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: new Date().toISOString(),
    sourceAuditVersion: audit.version || '',
    policy: remakeFactorAttributionDataProjectionPolicyV1,
    mappingRule: 'Confirmed root + unique exact Product ID only; all other historical attribution stays Review/Unresolved with no previous/current fallback.',
    eventRule: 'Every valid current remake row remains in remake event totals regardless of historical attribution state.',
    productMetadata: productMetadata.stats,
    auditStats: audit.stats || {},
    reconciliation: reconciliation,
    rows: projectedRows
  };
}

/**
 * Compact QA profile for execution logs.
 */
function profileRemakeFactorAttributionDataProjectionV1(options) {
  const opts = Object.assign({}, options || {});
  if (!opts.maxCases) opts.maxCases = 50;
  const samplesPerBucket = Math.max(1, Number(opts.samplesPerBucket || 2));
  const result = buildRemakeFactorAttributionDataProjectionV1(opts);
  if (!result || result.ok !== true) return result;

  return {
    ok: true,
    version: result.version,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: result.generatedAt,
    sourceAuditVersion: result.sourceAuditVersion,
    policy: result.policy,
    mappingRule: result.mappingRule,
    eventRule: result.eventRule,
    productMetadata: result.productMetadata,
    auditStats: result.auditStats,
    reconciliation: result.reconciliation,
    sampleRows: buildRemakeFactorAttributionProjectionSamplesV1(result.rows, samplesPerBucket)
  };
}

/**
 * One-case compact projection. Defaults to the known multi-product chain case.
 */
function profileRemakeFactorAttributionDataProjectionCaseV1(caseNumber) {
  const targetCaseNumber = Math.trunc(Number(caseNumber || 375669));
  if (!targetCaseNumber) throw new Error('Provide a positive numeric case number.');
  const result = buildRemakeFactorAttributionDataProjectionV1({
    caseNumbers: [targetCaseNumber],
    maxCases: 1
  });
  if (!result || result.ok !== true) return result;
  return {
    ok: true,
    version: result.version,
    diagnosticOnly: true,
    readOnly: true,
    generatedAt: result.generatedAt,
    targetCaseNumber: targetCaseNumber,
    policy: result.policy,
    reconciliation: result.reconciliation,
    rows: result.rows
  };
}

function buildRemakeFactorAttributionProjectionRowV1(row, productMap) {
  const current = row || {};
  const rootCandidate = current.rootCandidate || {};
  const rootProduct = rootCandidate.product || null;
  const chainStatus = cleanRemakeAttributionTextV1(current.chainStatus || '');
  const rootCaseNumber = Number(current.rootCaseNumber || 0);

  let status = '';
  let method = '';
  let displayLabel = '';
  let attributionState = 'review_bucket';
  let reason = '';
  let sourceCaseRole = '';
  let sourceCaseNumber = 0;
  let remadeProductId = '';
  let remadeProductName = '';
  let remadeProductGroup = '';
  let remadeDepartment = '';
  let productMetadataSource = '';
  let productMetadataComplete = false;

  if (current.noRemakeRootFlag === true) {
    status = 'UNRESOLVED_NO_REMAKE_ROOT';
    method = 'no_remake_root_no_historical_fallback';
    displayLabel = 'Unresolved - No Remake Root';
    reason = 'Current remake event is valid, but there is no confirmed linked remake root.';
    sourceCaseRole = 'no_remake_root';
  } else if (current.unconfirmedRootFlag === true) {
    status = 'UNRESOLVED_UNCONFIRMED_ROOT';
    method = 'unconfirmed_root_no_historical_fallback';
    displayLabel = 'Unresolved - Unconfirmed Root';
    reason = 'Current remake event is valid, but the historical root cannot be confirmed.';
    sourceCaseRole = 'unconfirmed_root';
  } else if (current.brokenChainFlag === true) {
    status = 'UNRESOLVED_BROKEN_CHAIN';
    method = 'broken_chain_no_historical_fallback';
    displayLabel = 'Unresolved - Broken Chain';
    reason = 'Current remake event is valid, but a linked historical case cannot be read.';
    sourceCaseRole = 'broken_chain';
  } else if (current.cycleFlag === true) {
    status = 'UNRESOLVED_CYCLE';
    method = 'cycle_no_historical_fallback';
    displayLabel = 'Unresolved - Chain Cycle';
    reason = 'Current remake event is valid, but the linked historical chain contains a cycle.';
    sourceCaseRole = 'chain_review';
  } else if (chainStatus !== 'resolved') {
    status = 'UNRESOLVED_OTHER_CHAIN';
    method = 'unresolved_chain_no_historical_fallback';
    displayLabel = 'Unresolved - Chain Review';
    reason = 'Current remake event is valid, but the linked historical chain is not resolved.';
    sourceCaseRole = 'chain_review';
  } else if (
    rootCandidate.status === 'candidate_exact_product_id' &&
    rootCandidate.method === 'exact_product_id' &&
    rootProduct
  ) {
    const resolvedProduct = resolveRemakeFactorAttributionRootProductMetadataV1(rootProduct, productMap || {});
    status = 'ATTRIBUTED_EXACT_ROOT';
    method = 'root_exact_product_id';
    attributionState = 'mapped_root_product';
    reason = 'Confirmed root contains one unique exact Product ID match.';
    sourceCaseRole = 'root';
    sourceCaseNumber = rootCaseNumber;
    remadeProductId = resolvedProduct.productId;
    remadeProductName = resolvedProduct.productName;
    remadeProductGroup = resolvedProduct.productGroup;
    remadeDepartment = resolvedProduct.department;
    productMetadataSource = resolvedProduct.metadataSource;
    productMetadataComplete = resolvedProduct.metadataComplete;
  } else if (
    rootCandidate.status === 'candidate_single_historical_product' &&
    rootCandidate.method === 'single_historical_product'
  ) {
    status = 'REVIEW_NON_EXACT_SINGLE_ROOT';
    method = 'review_required_non_exact_root_product';
    displayLabel = 'Review - Product Changed / No Exact Match';
    reason = 'One root product exists, but its Product ID does not uniquely match the current remake Product ID. No fallback is applied.';
    sourceCaseRole = 'root';
    sourceCaseNumber = rootCaseNumber;
  } else if (String(rootCandidate.status || '').indexOf('ambiguous_') === 0) {
    status = 'REVIEW_AMBIGUOUS_ROOT_PRODUCT';
    method = 'review_required_ambiguous_root_product';
    displayLabel = 'Review - Ambiguous Root Product';
    reason = 'The confirmed root does not identify one unique historical product line for this remake row.';
    sourceCaseRole = 'root';
    sourceCaseNumber = rootCaseNumber;
  } else if (rootCandidate.status === 'no_historical_products') {
    status = 'REVIEW_NO_ROOT_PRODUCTS';
    method = 'review_required_no_root_products';
    displayLabel = 'Review - No Root Products';
    reason = 'The confirmed root has no usable historical product rows.';
    sourceCaseRole = 'root';
    sourceCaseNumber = rootCaseNumber;
  } else {
    status = 'REVIEW_ROOT_UNRESOLVED';
    method = 'review_required_root_product_unresolved';
    displayLabel = 'Review - Root Product Unresolved';
    reason = 'The root product candidate does not meet the approved exact-root attribution condition.';
    sourceCaseRole = chainStatus === 'resolved' ? 'root' : 'chain_review';
    sourceCaseNumber = chainStatus === 'resolved' ? rootCaseNumber : 0;
  }

  return {
    currentCaseId: cleanRemakeAttributionTextV1(current.currentCaseId || ''),
    currentCaseNumber: Number(current.currentCaseNumber || 0),
    currentLineId: cleanRemakeAttributionTextV1(current.currentLineId || ''),
    currentProductId: cleanRemakeAttributionTextV1(current.currentProductId || ''),
    currentProductName: cleanRemakeAttributionTextV1(current.currentProductName || ''),
    currentProductGroup: cleanRemakeAttributionTextV1(current.currentProductGroup || ''),
    currentDepartment: cleanRemakeAttributionTextV1(current.currentDepartment || ''),
    currentRemakeReason: cleanRemakeAttributionTextV1(current.currentRemakeReason || ''),
    currentRemakeUnits: toRemakeAttributionNumberV1(current.currentQuantity || 0),
    currentRemakeDiscount: toRemakeAttributionNumberV1(current.currentRemakeDiscount || 0),
    currentInvoiceDate: cleanRemakeAttributionTextV1(current.currentInvoiceDate || ''),
    currentCustomerId: cleanRemakeAttributionTextV1(current.currentCustomerId || ''),
    currentCustomerName: cleanRemakeAttributionTextV1(current.currentCustomerName || ''),

    chainStatus: chainStatus,
    chainDepth: Number(current.chainDepth || 0),
    immediatePreviousCaseNumber: Number(current.immediatePreviousCaseNumber || 0),
    rootCaseNumber: rootCaseNumber,
    rootConfirmationMethod: cleanRemakeAttributionTextV1(current.rootConfirmationMethod || ''),

    remadeSourceCaseNumber: sourceCaseNumber,
    remadeSourceCaseRole: sourceCaseRole,
    remadeProductId: remadeProductId,
    remadeProductName: remadeProductName,
    remadeProductGroup: remadeProductGroup,
    remadeDepartment: remadeDepartment,
    remadeProductMappingStatus: status,
    remadeProductMappingMethod: method,
    remadeAttributionDisplayLabel: displayLabel,
    remadeProductDisplay: remadeProductName || displayLabel,
    remadeProductGroupDisplay: remadeProductGroup || displayLabel,
    remadeDepartmentDisplay: remadeDepartment || displayLabel,
    remadeAttributionState: attributionState,
    remadeAttributionReason: reason,
    remadeProductMetadataSource: productMetadataSource,
    remadeProductMetadataComplete: productMetadataComplete,

    includeInRemakeEventTotals: true,
    historicalFallbackUsed: false,
    currentProductFallbackUsed: false,
    immediatePreviousProductFallbackUsed: false
  };
}

function resolveRemakeFactorAttributionRootProductMetadataV1(rootProduct, productMap) {
  const product = rootProduct || {};
  const productId = cleanRemakeAttributionTextV1(product.productId || '');
  const meta = productMap && productId ? (productMap[productId] || {}) : {};
  const historicalName = cleanRemakeAttributionTextV1(product.productName || '');
  const productName = historicalName || cleanRemakeFactorText(meta.productName || meta.description || productId) || productId;
  const lookupDepartment = normalizeRemakeFactorDepartment(meta.department || '');
  const rawDepartment = normalizeRemakeFactorDepartment(product.departmentRaw || '');
  const lookupGroup = cleanRemakeFactorText(meta.group || '');
  const rawGroup = cleanRemakeFactorText(product.productGroupRaw || '');
  const fallbackClass = inferRemakeFactorLegacyProductClass(productId, productName, '');
  const fallbackGroup = cleanRemakeFactorText(fallbackClass && fallbackClass.group || '');
  const groupCandidate = lookupGroup || rawGroup || fallbackGroup || '';
  const department = lookupDepartment ||
    rawDepartment ||
    inferRemakeFactorDepartmentFromGroupOrCode(groupCandidate) ||
    normalizeRemakeFactorDepartment(fallbackClass && fallbackClass.department || '') ||
    inferRemakeFactorDepartmentFromProductName(productName) ||
    'Unassigned';
  const productGroup = normalizeRemakeFactorProductGroup(groupCandidate, department);
  const metadataComplete = !!productId && !!productName && !!groupCandidate && department !== 'Unassigned' && productGroup !== 'Unassigned';
  const metadataSource = lookupDepartment || lookupGroup
    ? cleanRemakeFactorText(meta.source || 'MagicTouch Products / product map')
    : (rawDepartment || rawGroup
      ? 'historical case product fields'
      : (fallbackClass && (fallbackClass.department || fallbackClass.group)
        ? 'legacy product inference fallback'
        : 'product-name inference / unassigned'));

  return {
    productId: productId,
    productName: productName,
    productGroup: productGroup,
    department: department,
    metadataSource: metadataSource,
    metadataComplete: metadataComplete
  };
}

/**
 * Read-only product metadata loader. It intentionally reads the existing Drive
 * lookup cache if present but never rebuilds/writes that lookup cache.
 */
function loadRemakeFactorAttributionProjectionProductMapV1(options) {
  const opts = options || {};
  if (opts.fetchProductMetadata === false) {
    return {
      productMap: {},
      stats: {
        ok: true,
        mode: 'disabled_by_option',
        apiProductCount: 0,
        cachedLookupCount: 0,
        mergedProductCount: 0,
        writesPerformed: false
      }
    };
  }

  const props = PropertiesService.getScriptProperties();
  const config = getRemakeFactorConfig(props, {
    quickRefresh: true,
    pageSize: 25,
    maxPages: 1,
    maxDetailFetches: 0,
    detailStrategy: 'none',
    chunkByMonth: false,
    fetchProductMap: true,
    fetchCustomerMap: false,
    useProductLookup: false
  });
  const token = authenticateRemakeFactorApi(config);
  const apiProductMap = fetchRemakeFactorProductMap(config, token) || {};
  let cachedLookupMap = {};
  let cachedLookupAvailable = false;

  try {
    const cached = readRemakeFactorProductLookupCache();
    if (cached && cached.ok && cached.lookup && typeof cached.lookup === 'object') {
      cachedLookupMap = cached.lookup;
      cachedLookupAvailable = true;
    }
  } catch (error) {
    cachedLookupMap = {};
  }

  const merged = mergeRemakeFactorProductMaps(apiProductMap, cachedLookupMap);
  return {
    productMap: merged,
    stats: {
      ok: true,
      mode: 'read_only_api_plus_existing_lookup_cache',
      apiProductCount: Object.keys(apiProductMap).length,
      cachedLookupAvailable: cachedLookupAvailable,
      cachedLookupCount: Object.keys(cachedLookupMap).length,
      mergedProductCount: Object.keys(merged).length,
      writesPerformed: false
    }
  };
}

function reconcileRemakeFactorAttributionProjectionV1(inputRows, projectedRows) {
  const input = Array.isArray(inputRows) ? inputRows : [];
  const output = Array.isArray(projectedRows) ? projectedRows : [];
  const inputCaseCount = countRemakeFactorAttributionUniqueCasesV1(input, 'currentCaseNumber');
  const outputCaseCount = countRemakeFactorAttributionUniqueCasesV1(output, 'currentCaseNumber');
  const inputUnits = roundRemakeFactorAttributionMetricV1(sumRemakeFactorAttributionMetricV1(input, 'currentQuantity'));
  const outputUnits = roundRemakeFactorAttributionMetricV1(sumRemakeFactorAttributionMetricV1(output, 'currentRemakeUnits'));
  const inputDiscount = roundRemakeFactorAttributionMetricV1(sumRemakeFactorAttributionMetricV1(input, 'currentRemakeDiscount'));
  const outputDiscount = roundRemakeFactorAttributionMetricV1(sumRemakeFactorAttributionMetricV1(output, 'currentRemakeDiscount'));
  const counts = buildRemakeFactorAttributionProjectionCountsV1(output);
  const exactRows = output.filter(function(row) { return row.remadeProductMappingStatus === 'ATTRIBUTED_EXACT_ROOT'; });
  const reviewRows = output.filter(function(row) {
    return /^REVIEW_|^UNRESOLVED_/.test(String(row.remadeProductMappingStatus || ''));
  });
  const exactMetadataCompleteRows = exactRows.filter(function(row) { return row.remadeProductMetadataComplete === true; }).length;
  const exactMetadataIncompleteRows = exactRows.length - exactMetadataCompleteRows;
  const unsafeFallbackRows = output.filter(function(row) {
    if (row.remadeProductMappingStatus === 'ATTRIBUTED_EXACT_ROOT') return false;
    return !!cleanRemakeAttributionTextV1(row.remadeProductId || '') ||
      row.currentProductFallbackUsed === true ||
      row.immediatePreviousProductFallbackUsed === true ||
      row.historicalFallbackUsed === true;
  }).length;
  const reviewRowsMissingDisplayLabel = reviewRows.filter(function(row) {
    return !cleanRemakeAttributionTextV1(row.remadeAttributionDisplayLabel || '');
  }).length;
  const exactRowsNotUsingRoot = exactRows.filter(function(row) {
    return row.remadeSourceCaseRole !== 'root' || Number(row.remadeSourceCaseNumber || 0) !== Number(row.rootCaseNumber || 0);
  }).length;
  const exactRowsWithDifferentId = exactRows.filter(function(row) {
    return cleanRemakeAttributionTextV1(row.remadeProductId || '') !== cleanRemakeAttributionTextV1(row.currentProductId || '');
  }).length;

  const rowDelta = output.length - input.length;
  const caseDelta = outputCaseCount - inputCaseCount;
  const unitDelta = roundRemakeFactorAttributionMetricV1(outputUnits - inputUnits);
  const discountDelta = roundRemakeFactorAttributionMetricV1(outputDiscount - inputDiscount);
  const allRowsAssigned = output.every(function(row) {
    return !!cleanRemakeAttributionTextV1(row.remadeProductMappingStatus || '');
  });

  return {
    inputRemakeRows: input.length,
    projectedRemakeRows: output.length,
    rowCountDelta: rowDelta,
    inputUniqueRemakeCases: inputCaseCount,
    projectedUniqueRemakeCases: outputCaseCount,
    uniqueCaseCountDelta: caseDelta,
    inputRemakeUnits: inputUnits,
    projectedRemakeUnits: outputUnits,
    remakeUnitsDelta: unitDelta,
    inputRemakeDiscount: inputDiscount,
    projectedRemakeDiscount: outputDiscount,
    remakeDiscountDelta: discountDelta,
    allRowsAssignedToAttributionState: allRowsAssigned,
    exactRootRows: exactRows.length,
    exactRootMetadataCompleteRows: exactMetadataCompleteRows,
    exactRootMetadataIncompleteRows: exactMetadataIncompleteRows,
    reviewOrUnresolvedRows: reviewRows.length,
    reviewRowsMissingDisplayLabel: reviewRowsMissingDisplayLabel,
    unsafeFallbackRows: unsafeFallbackRows,
    exactRowsNotUsingRoot: exactRowsNotUsingRoot,
    exactRowsWithDifferentProductId: exactRowsWithDifferentId,
    statusCounts: counts,
    eventRetentionPass: rowDelta === 0 && caseDelta === 0 && unitDelta === 0 && discountDelta === 0,
    noFallbackPass: unsafeFallbackRows === 0,
    exactRootIntegrityPass: exactRowsNotUsingRoot === 0 && exactRowsWithDifferentId === 0,
    displayCoveragePass: allRowsAssigned && reviewRowsMissingDisplayLabel === 0,
    metadataCoveragePass: exactMetadataIncompleteRows === 0,
    overallPass: rowDelta === 0 && caseDelta === 0 && unitDelta === 0 && discountDelta === 0 &&
      unsafeFallbackRows === 0 && exactRowsNotUsingRoot === 0 && exactRowsWithDifferentId === 0 &&
      allRowsAssigned && reviewRowsMissingDisplayLabel === 0 && exactMetadataIncompleteRows === 0
  };
}

function buildRemakeFactorAttributionProjectionCountsV1(rows) {
  const keys = [
    'ATTRIBUTED_EXACT_ROOT',
    'REVIEW_NON_EXACT_SINGLE_ROOT',
    'REVIEW_AMBIGUOUS_ROOT_PRODUCT',
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
    const key = cleanRemakeAttributionTextV1(row && row.remadeProductMappingStatus || 'REVIEW_ROOT_UNRESOLVED');
    if (!Object.prototype.hasOwnProperty.call(counts, key)) counts[key] = 0;
    counts[key]++;
  });
  return counts;
}

function buildRemakeFactorAttributionProjectionSamplesV1(rows, samplesPerBucket) {
  const used = {};
  const result = [];
  (rows || []).forEach(function(row) {
    const key = cleanRemakeAttributionTextV1(row.remadeProductMappingStatus || '');
    const count = Number(used[key] || 0);
    if (count >= samplesPerBucket) return;
    used[key] = count + 1;
    result.push({
      currentCaseNumber: Number(row.currentCaseNumber || 0),
      currentProductId: cleanRemakeAttributionTextV1(row.currentProductId || ''),
      currentProductName: cleanRemakeAttributionTextV1(row.currentProductName || ''),
      currentProductGroup: cleanRemakeAttributionTextV1(row.currentProductGroup || ''),
      currentDepartment: cleanRemakeAttributionTextV1(row.currentDepartment || ''),
      currentRemakeReason: cleanRemakeAttributionTextV1(row.currentRemakeReason || ''),
      chainStatus: cleanRemakeAttributionTextV1(row.chainStatus || ''),
      chainDepth: Number(row.chainDepth || 0),
      rootCaseNumber: Number(row.rootCaseNumber || 0),
      remadeSourceCaseNumber: Number(row.remadeSourceCaseNumber || 0),
      remadeSourceCaseRole: cleanRemakeAttributionTextV1(row.remadeSourceCaseRole || ''),
      remadeProductId: cleanRemakeAttributionTextV1(row.remadeProductId || ''),
      remadeProductName: cleanRemakeAttributionTextV1(row.remadeProductName || ''),
      remadeProductGroup: cleanRemakeAttributionTextV1(row.remadeProductGroup || ''),
      remadeDepartment: cleanRemakeAttributionTextV1(row.remadeDepartment || ''),
      remadeProductMappingStatus: cleanRemakeAttributionTextV1(row.remadeProductMappingStatus || ''),
      remadeProductMappingMethod: cleanRemakeAttributionTextV1(row.remadeProductMappingMethod || ''),
      remadeAttributionDisplayLabel: cleanRemakeAttributionTextV1(row.remadeAttributionDisplayLabel || ''),
      remadeProductMetadataSource: cleanRemakeAttributionTextV1(row.remadeProductMetadataSource || ''),
      remadeProductMetadataComplete: row.remadeProductMetadataComplete === true,
      includeInRemakeEventTotals: row.includeInRemakeEventTotals === true
    });
  });
  return result;
}

function countRemakeFactorAttributionUniqueCasesV1(rows, fieldName) {
  const seen = {};
  (rows || []).forEach(function(row) {
    const value = Number(row && row[fieldName] || 0);
    if (Number.isFinite(value) && value > 0) seen[String(Math.trunc(value))] = true;
  });
  return Object.keys(seen).length;
}

function sumRemakeFactorAttributionMetricV1(rows, fieldName) {
  return (rows || []).reduce(function(sum, row) {
    return sum + toRemakeAttributionNumberV1(row && row[fieldName] || 0);
  }, 0);
}

function roundRemakeFactorAttributionMetricV1(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 1000000) / 1000000;
}
