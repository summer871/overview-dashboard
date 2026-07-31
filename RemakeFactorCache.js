/**
 * Remake Factor Cache
 * Version: v1.34.1 - 2026-07-31
 * Purpose: Build a cached Remake Factor dataset from the MagicTouch CRM API and save it to Drive JSON. Uses MagicTouch /api/Products/QueryProducts `department` as the authoritative product-department source. The Product_List Drive lookup and legacy inference remain fallback-only for products not returned by the API. v1.32 makes each case-product line authoritative for remake status, percentage, reason, discount rate, and discount amount. Case-level remake fields may identify detail-fetch candidates but are never propagated onto product lines. v1.32.1 expands the diagnostic-only product test so remake-discount dollars can be verified before rebuilding the cache. v1.32.2 records the approved canonical calculation below; it does not change the dashboard wording. v1.32.3 adds an opt-in compact browser response so the full product-level cache can load without duplicating unused fields in Chrome memory. v1.32.4 applies that compact response in the final smart-refresh public entry point, which otherwise overrides earlier declarations in this file. v1.33 adds a separate nightly browser-ready consolidated gzip file. First-time browsers can download that one pre-normalized packed file instead of making Apps Script open and parse every monthly Drive shard during the page request. Repeat visits continue to use the monthly IndexedDB cache. v1.33.2 permits the last optimized snapshot to be served while a newer source cache is being consolidated and adds a deduplicated rebuild assurance endpoint for stale-while-revalidate browser loading. v1.34.1 preserves the numeric case number in both compact and packed browser rows so the Remake population can join to the Ceramist attribution sidecar on the authoritative current case key.
 *
 * APPROVED REMAKE CALCULATION - 2026-07-13
 * - Product line is the authoritative grain for remake status and all remake fields.
 * - A product is a remake when that product line's remake value says it is a remake.
 *   This includes Remake 0%: it is still a remake, but the customer is charged fully.
 * - A case is a remake case when at least one product line on that case is a remake.
 *   Count the case once in Remake Cases and the case-rate numerator.
 * - Remake Units is the sum of quantity from remake product lines only.
 * - Keep the dashboard label exactly "Remake Discount". Its business meaning is
 *   estimated revenue waived, sourced from each remake product line's recorded
 *   remakeDiscount. Do not allocate a case-level discount across products.
 * - A zero-dollar stand-in/service product (for example an adjustment line) still
 *   counts as a remake and contributes its quantity, but contributes $0 to Remake Discount.
 * - remakeCaseID is not used to decide remake status, case rate, unit rate, or
 *   Remake Discount. It may be used separately to trace the original/root case
 *   for ceramist attribution only.
 *
 * Important:
 * - Do not put MagicTouch credentials in this file.
 * - Store credentials in Apps Script Project Settings > Script properties:
 *   MT_CRM_API_BASE_URL = https://crm.caldentalarts.com
 *   MT_CRM_API_USERID = crmapi user id
 *   MT_CRM_API_PASSWORD = crmapi password
 * - Optional script properties:
 *   MT_REMAKE_LOOKBACK_MONTHS = 24
 *   MT_REMAKE_PAGE_SIZE = 250
 *   MT_REMAKE_MAX_PAGES = 200
 *   MT_REMAKE_MAX_DETAIL_FETCHES = 800
 *   MT_REMAKE_CHUNK_BY_MONTH = true
 *   MT_REMAKE_MAX_PAGES_PER_CHUNK = 80
 *   MT_REMAKE_OPEN_REFRESH_MONTHS = 1
 *   MT_REMAKE_DETAIL_STRATEGY = remakesOnly  // remakesOnly, all, none
 *   MT_REMAKE_ADDITIONAL_FIELDS = caseProducts
 *   MT_REMAKE_CASE_QUERY_TEMPLATE = invoiceDate >= "{queryStartDate}" && invoiceDate < "{queryEndExclusiveDate}"
 *   MT_REMAKE_PULL_OVERLAP_DAYS = 1
 */

const remakeFactorApiBaseUrlProperty = 'MT_CRM_API_BASE_URL';
const remakeFactorApiUserIdProperty = 'MT_CRM_API_USERID';
const remakeFactorApiPasswordProperty = 'MT_CRM_API_PASSWORD';
const remakeFactorLookbackMonthsProperty = 'MT_REMAKE_LOOKBACK_MONTHS';
const remakeFactorPageSizeProperty = 'MT_REMAKE_PAGE_SIZE';
const remakeFactorMaxPagesProperty = 'MT_REMAKE_MAX_PAGES';
const remakeFactorMaxDetailFetchesProperty = 'MT_REMAKE_MAX_DETAIL_FETCHES';
const remakeFactorCaseQueryTemplateProperty = 'MT_REMAKE_CASE_QUERY_TEMPLATE';
const remakeFactorPullOverlapDaysProperty = 'MT_REMAKE_PULL_OVERLAP_DAYS';
const remakeFactorDetailStrategyProperty = 'MT_REMAKE_DETAIL_STRATEGY';
const remakeFactorAdditionalFieldsProperty = 'MT_REMAKE_ADDITIONAL_FIELDS';
const remakeFactorFetchProductMapProperty = 'MT_REMAKE_FETCH_PRODUCT_MAP';
const remakeFactorFetchCustomerMapProperty = 'MT_REMAKE_FETCH_CUSTOMER_MAP';
const remakeFactorChunkByMonthProperty = 'MT_REMAKE_CHUNK_BY_MONTH';
const remakeFactorMaxPagesPerChunkProperty = 'MT_REMAKE_MAX_PAGES_PER_CHUNK';
const remakeFactorCacheFileIdProperty = 'MT_REMAKE_CACHE_FILE_ID';
const remakeFactorCacheFileName = 'remake_factor_cache.json';
const remakeFactorProductLookupSourceUrlProperty = 'MT_REMAKE_PRODUCT_LOOKUP_SOURCE_URL';
const remakeFactorProductLookupCsvFileUrlProperty = 'MT_REMAKE_PRODUCT_LOOKUP_CSV_FILE_URL';
const remakeFactorProductLookupSheetUrlProperty = 'MT_REMAKE_PRODUCT_LOOKUP_SHEET_URL';
const remakeFactorProductLookupSheetNameProperty = 'MT_REMAKE_PRODUCT_LOOKUP_SHEET_NAME';
const remakeFactorUseProductLookupProperty = 'MT_REMAKE_USE_PRODUCT_LOOKUP';
const remakeFactorProductLookupCacheFileIdProperty = 'MT_REMAKE_PRODUCT_LOOKUP_CACHE_FILE_ID';
const remakeFactorDefaultProductLookupCsvFileUrl = 'https://drive.google.com/file/d/1tttvrqNRefwRNRs0MDw8WXYbVwk8FU93/view';
const remakeFactorDefaultProductLookupSheetUrl = 'https://docs.google.com/spreadsheets/d/1XrJctG1-0RGhKCV6w2jK4esoaahmc7Ji7MjQhZo-nBY/edit';
const remakeFactorDefaultProductLookupSheetName = 'Product List';
const remakeFactorProductLookupCacheFileName = 'remake_product_lookup_cache.json';
const remakeFactorDebugFileIdProperty = 'MT_REMAKE_DEBUG_FILE_ID';
const remakeFactorDebugFileName = 'remake_factor_debug.json';
const remakeFactorDefaultBaseUrl = 'https://crm.caldentalarts.com';

function getRemakeFactorData(options) {
  const requestedOptions = options || {};
  const compactForBrowser = requestedOptions.compactForBrowser === true || requestedOptions.browserCompact === true;

  if (requestedOptions.forceRefresh) {
    try {
      const refreshOptions = Object.assign({}, requestedOptions);

      // Web-app button refresh should be intentionally light so it returns a real
      // result instead of timing out and leaving the UI looking unchanged.
      // v1.4: month chunking is forced for web refreshes so one heavy month
      // cannot consume the whole page cap. Product metadata is still optional;
      // the frontend also remaps departments from the Overview cache for speed.
      if (refreshOptions.quickRefresh !== false && !refreshOptions.fullRefresh) {
        refreshOptions.quickRefresh = true;
        if (!refreshOptions.lookbackMonths) refreshOptions.lookbackMonths = 12;
        if (!refreshOptions.pageSize) refreshOptions.pageSize = 100;
        if (!refreshOptions.maxPages) refreshOptions.maxPages = 40;
        if (!refreshOptions.maxPagesPerChunk) refreshOptions.maxPagesPerChunk = 40;
        if (!refreshOptions.maxDetailFetches) refreshOptions.maxDetailFetches = 120;
        if (refreshOptions.fetchProductMap === undefined) refreshOptions.fetchProductMap = true;
        if (refreshOptions.fetchCustomerMap === undefined) refreshOptions.fetchCustomerMap = true;
        if (refreshOptions.chunkByMonth === undefined) refreshOptions.chunkByMonth = true;
      }

      const refreshed = refreshRemakeFactorCache(refreshOptions);
      return compactForBrowser ? compactRemakeFactorPayloadForBrowserV1323(refreshed) : refreshed;
    } catch (error) {
      return buildRemakeFactorErrorResponse('Remake Factor API refresh failed', error, requestedOptions);
    }
  }

  try {
    const cached = readRemakeFactorCache({ compactForBrowser: compactForBrowser });
    if (cached && cached.ok) return cached;
    if (cached && cached.message) return cached;
  } catch (error) {
    return buildRemakeFactorErrorResponse('Remake Factor cache read failed', error, requestedOptions);
  }

  return {
    ok: false,
    message: 'No Remake Factor cache exists yet. Click Refresh Cache. If it returns here again, click Test API / Health or run debugRemakeFactorCacheHealth() from Apps Script.',
    generatedAt: '',
    detailRows: [],
    stats: getRemakeFactorSafeHealthSummary()
  };
}

function refreshRemakeFactorCache(options) {
  const requestedOptions = options || {};
  const props = PropertiesService.getScriptProperties();
  const config = getRemakeFactorConfig(props, requestedOptions);
  const startedAt = new Date();

  const token = authenticateRemakeFactorApi(config);
  const apiProductMap = config.fetchProductMap ? fetchRemakeFactorProductMap(config, token) : {};
  const productLookupResult = config.useProductLookup ? fetchRemakeFactorProductLookupMap(config) : { lookup: {}, stats: { ok: true, source: 'disabled' } };
  const productLookupMap = productLookupResult.lookup || {};
  const productMap = mergeRemakeFactorProductMaps(apiProductMap, productLookupMap);
  const caseFetchResult = fetchRemakeFactorCases(config, token);
  const caseRows = caseFetchResult.rows;
  const customerMap = config.fetchCustomerMap ? fetchRemakeFactorCustomerMap(config, token, caseRows) : buildRemakeFactorCustomerMapFromCaseRows(caseRows || []);
  const customerMapStats = getRemakeFactorCustomerMapStats(customerMap);
  const detailRows = buildRemakeFactorDetailRows(caseRows, productMap, customerMap);

  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'MagicTouch CRM API',
    dateRange: {
      startDate: config.startDate,
      endDate: config.endDate,
      lookbackMonths: config.lookbackMonths
    },
    stats: {
      caseRowsFetched: caseRows.length,
      detailRows: detailRows.length,
      caseProductsInlineCount: caseFetchResult.stats.caseProductsInlineCount,
      caseProductsMissingCount: caseFetchResult.stats.caseProductsMissingCount,
      detailStrategy: caseFetchResult.stats.detailStrategy,
      detailFetchCandidates: caseFetchResult.stats.detailFetchCandidates,
      detailFetchesAttempted: caseFetchResult.stats.detailFetchesAttempted,
      detailFetchesSucceeded: caseFetchResult.stats.detailFetchesSucceeded,
      detailFetchesSkipped: caseFetchResult.stats.detailFetchesSkipped,
      fallbackCaseRows: detailRows.filter(row => row.isFallbackLine).length,
      remakeProductRows: detailRows.filter(row => row.isRemake).length,
      productRowsMissingRemakeField: detailRows.filter(row => !row.isFallbackLine && !row.remakeFieldPresent).length,
      remakeRowsMissingProductDiscountField: detailRows.filter(row => row.isRemake && !row.remakeDiscountFieldPresent).length,
      warnings: [].concat((caseFetchResult.stats && caseFetchResult.stats.warnings) || [], customerMapStats.warnings || []),
      customerMapStats: customerMapStats,
      productMapSize: Object.keys(productMap).length,
      apiProductMapSize: Object.keys(apiProductMap).length,
      productMapFetched: !!config.fetchProductMap,
      productLookupEnabled: !!config.useProductLookup,
      productLookupMapSize: Object.keys(productLookupMap).length,
      productLookupSource: (productLookupResult.stats && productLookupResult.stats.source) || '',
      productLookupStats: productLookupResult.stats || {},
      customerMapSize: Object.keys(customerMap).length,
      customerMapFetched: !!config.fetchCustomerMap,
      customerMapSource: customerMapStats.source || 'case rows',
      customerApiRowsFetched: customerMapStats.apiRowsFetched || 0,
      customerNamesFromApi: customerMapStats.namesFromApi || 0,
      customerNamesFromCaseRows: customerMapStats.namesFromCaseRows || 0,
      quickRefresh: !!config.quickRefresh,
      queryUsed: caseFetchResult.stats.queryUsed || '',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString()
    },
    detailRows: detailRows
  };

  writeRemakeFactorCache(payload);
  return payload;
}

function debugRemakeFactorCacheHealth() {
  const props = PropertiesService.getScriptProperties();
  const cached = readRemakeFactorCache();
  return {
    ok: true,
    version: 'RemakeFactorCache v1.34',
    timestamp: new Date().toISOString(),
    hasBaseUrl: !!props.getProperty(remakeFactorApiBaseUrlProperty),
    baseUrlHost: maskRemakeFactorBaseUrl(props.getProperty(remakeFactorApiBaseUrlProperty) || remakeFactorDefaultBaseUrl),
    hasUserId: !!props.getProperty(remakeFactorApiUserIdProperty),
    hasPassword: !!props.getProperty(remakeFactorApiPasswordProperty),
    lookbackMonths: props.getProperty(remakeFactorLookbackMonthsProperty) || '',
    pageSize: props.getProperty(remakeFactorPageSizeProperty) || '',
    maxPages: props.getProperty(remakeFactorMaxPagesProperty) || '',
    maxDetailFetches: props.getProperty(remakeFactorMaxDetailFetchesProperty) || '',
    detailStrategy: props.getProperty(remakeFactorDetailStrategyProperty) || '',
    fetchProductMap: props.getProperty(remakeFactorFetchProductMapProperty) || '',
    fetchCustomerMap: props.getProperty(remakeFactorFetchCustomerMapProperty) || '',
    chunkByMonth: props.getProperty(remakeFactorChunkByMonthProperty) || '',
    maxPagesPerChunk: props.getProperty(remakeFactorMaxPagesPerChunkProperty) || '',
    cacheFileId: props.getProperty(remakeFactorCacheFileIdProperty) || '',
    cacheOk: !!(cached && cached.ok),
    cacheMessage: cached && cached.message ? cached.message : '',
    cacheGeneratedAt: cached && cached.generatedAt ? cached.generatedAt : '',
    detailRows: cached && cached.detailRows ? cached.detailRows.length : 0,
    stats: cached && cached.stats ? cached.stats : {}
  };
}

function testRemakeFactorApiConnection() {
  try {
    const props = PropertiesService.getScriptProperties();
    const config = getRemakeFactorConfig(props, {
      quickRefresh: true,
      lookbackMonths: 1,
      pageSize: 1,
      maxPages: 1,
      maxDetailFetches: 0,
      fetchProductMap: false,
      fetchCustomerMap: false
    });
    const token = authenticateRemakeFactorApi(config);
    const caseResult = fetchRemakeFactorCases(config, token);
    return {
      ok: true,
      version: 'RemakeFactorCache v1.34',
      message: 'MagicTouch API authentication and QueryCases test succeeded.',
      timestamp: new Date().toISOString(),
      baseUrlHost: maskRemakeFactorBaseUrl(config.baseUrl),
      rowsFetched: caseResult.rows.length,
      stats: caseResult.stats
    };
  } catch (error) {
    return buildRemakeFactorErrorResponse('MagicTouch API connection test failed', error, { testOnly: true });
  }
}

/**
 * Diagnostic-only product-line check. It reads one case from the CRM API and
 * returns the remake fields exactly as supplied on each case-product line.
 * It does not refresh or write the Remake Factor cache.
 */
function testRemakeFactorProductLineClassification(options) {
  const opts = options || {};
  const targetCaseNumber = Number(opts.caseNumber || 375669);
  const props = PropertiesService.getScriptProperties();
  const config = getRemakeFactorConfig(props, {
    quickRefresh: true,
    lookbackMonths: 1,
    pageSize: 25,
    maxPages: 1,
    maxDetailFetches: 0,
    detailStrategy: 'none',
    chunkByMonth: false,
    fetchProductMap: false,
    fetchCustomerMap: false
  });
  const token = authenticateRemakeFactorApi(config);
  const url = config.baseUrl + '/api/Cases/QueryCases?' + toRemakeFactorQueryString({
    page: 1,
    pageSize: 25,
    orderBy: 'caseNumber',
    additionalFields: 'caseProducts',
    query: 'caseNumber == ' + targetCaseNumber
  });
  const response = remakeFactorFetchJson(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  const queryRows = extractRemakeFactorRows(response.body);
  const queryRow = queryRows.find(function(row) {
    return Number(row.caseNumber || row.caseNo || 0) === targetCaseNumber;
  });

  if (!queryRow) {
    const notFound = {
      ok: false,
      diagnosticOnly: true,
      targetCaseNumber: targetCaseNumber,
      message: 'The targeted case was not returned by QueryCases.'
    };
    console.log(JSON.stringify(notFound, null, 2));
    return notFound;
  }

  const caseId = String(queryRow.caseID || queryRow.caseId || queryRow.id || '').trim();
  const caseDetail = caseId ? fetchRemakeFactorCaseDetail(config, token, caseId) : queryRow;
  const products = Array.isArray(caseDetail.caseProducts) ? caseDetail.caseProducts : [];
  const productRows = products.map(function(line, index) {
    const fields = getRemakeFactorProductLineFields(line);
    return {
      index: index,
      lineId: line.id || line.caseProductID || line.caseProductId || '',
      productId: line.productID || line.productId || '',
      productName: line.invoiceDescription || line.description || line.productDescription || '',
      quantity: toRemakeFactorNumber(line.quantity || line.qty || 0),
      remakeValue: fields.remakeValue,
      remakePercent: fields.remakePercent,
      isRemake: fields.isRemake,
      remakeReason: fields.remakeReason,
      remakeDiscountRate: fields.remakeDiscountRate,
      remakeDiscount: fields.remakeDiscount,
      remakeFieldPresent: fields.remakeFieldPresent,
      remakeDiscountFieldPresent: fields.remakeDiscountFieldPresent,
      unitPrice: toRemakeFactorNumber(line.unitPrice || 0),
      extendedAmount: toRemakeFactorNumber(line.extendedAmount || 0),
      totalCharge: toRemakeFactorNumber(line.totalCharge || 0),
      discount: toRemakeFactorNumber(line.discount || 0),
      discountRate: toRemakeFactorNumber(line.discountRate || 0),
      salesDiscount: toRemakeFactorNumber(line.salesDiscount || 0),
      applyRemakeDiscountRatio: line.applyRemakeDiscountRatio,
      isRemakePerc: line.isRemakePerc,
      financialFieldSnapshot: getRemakeFactorProductFinancialFieldSnapshot(line)
    };
  });
  const result = {
    ok: true,
    generatedAt: new Date().toISOString(),
    diagnosticOnly: true,
    version: 'RemakeFactorCache v1.32.1',
    targetCaseNumber: targetCaseNumber,
    caseId: caseId,
    caseLevelRemakeValueForComparisonOnly: cleanRemakeFactorText(queryRow.remake),
    productCount: productRows.length,
    remakeProductCount: productRows.filter(function(row) { return row.isRemake; }).length,
    caseIsRemakeFromProducts: productRows.some(function(row) { return row.isRemake; }),
    products: productRows,
    notes: [
      'Only product-line remake values determine product and case remake status.',
      'Case-level remake values are displayed for comparison and are not propagated.',
      'Remake 0% remains a remake with a zero remake discount.',
      'Financial fields are included to determine how MagicTouch represents the product-level remake-discount dollars.',
      'No dashboard or cache data is changed by this diagnostic.'
    ]
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testRemakeFactorZeroPercentProductLine() {
  return testRemakeFactorProductLineClassification({ caseNumber: 373892 });
}

function getRemakeFactorProductFinancialFieldSnapshot(line) {
  const value = line && typeof line === 'object' ? line : {};
  return Object.keys(value)
    .filter(function(key) {
      return /(remake|discount|charge|amount|price|quantity)/i.test(key);
    })
    .sort()
    .reduce(function(snapshot, key) {
      snapshot[key] = value[key];
      return snapshot;
    }, {});
}

function installRemakeFactorDailyTrigger() {
  const functionName = 'refreshRemakeFactorCache';
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyDays(1)
    .atHour(5)
    .create();

  return {
    ok: true,
    message: 'Installed daily Remake Factor cache refresh trigger for approximately 5 AM script time.',
    functionName: functionName
  };
}

function clearRemakeFactorCache() {
  const props = PropertiesService.getScriptProperties();
  const fileId = props.getProperty(remakeFactorCacheFileIdProperty);
  if (fileId) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (error) {
      // If the file is already gone, just clear the property.
    }
  }
  props.deleteProperty(remakeFactorCacheFileIdProperty);
  return { ok: true, message: 'Remake Factor cache file reference cleared.' };
}

function getRemakeFactorConfig(props, requestedOptions) {
  const now = new Date();
  const lookbackMonths = Math.max(1, Number(requestedOptions.lookbackMonths || props.getProperty(remakeFactorLookbackMonthsProperty) || 36));
  const endDate = normalizeRemakeFactorDate(requestedOptions.endDate) || formatRemakeFactorDate(now);
  const startCandidate = new Date(now.getFullYear(), now.getMonth() - lookbackMonths + 1, 1);
  const startDate = normalizeRemakeFactorDate(requestedOptions.startDate) || formatRemakeFactorDate(startCandidate);

  const baseUrl = String(props.getProperty(remakeFactorApiBaseUrlProperty) || remakeFactorDefaultBaseUrl).replace(/\/+$/, '');
  const userId = props.getProperty(remakeFactorApiUserIdProperty);
  const password = props.getProperty(remakeFactorApiPasswordProperty);

  if (!userId || !password) {
    throw new Error('Missing MagicTouch API credentials. Set script properties MT_CRM_API_USERID and MT_CRM_API_PASSWORD. Do not store credentials in code.');
  }

  const propFetchProductMap = props.getProperty(remakeFactorFetchProductMapProperty);
  const requestedFetchProductMap = requestedOptions.fetchProductMap;
  const fetchProductMap = requestedFetchProductMap !== undefined
    ? parseRemakeFactorBoolean(requestedFetchProductMap, true)
    : (propFetchProductMap ? parseRemakeFactorBoolean(propFetchProductMap, true) : !requestedOptions.quickRefresh);

  const propFetchCustomerMap = props.getProperty(remakeFactorFetchCustomerMapProperty);
  const requestedFetchCustomerMap = requestedOptions.fetchCustomerMap;
  const fetchCustomerMap = requestedFetchCustomerMap !== undefined
    ? parseRemakeFactorBoolean(requestedFetchCustomerMap, true)
    : (propFetchCustomerMap ? parseRemakeFactorBoolean(propFetchCustomerMap, true) : true);

  const propUseProductLookup = props.getProperty(remakeFactorUseProductLookupProperty);
  const requestedUseProductLookup = requestedOptions.useProductLookup;
  const useProductLookup = requestedUseProductLookup !== undefined
    ? parseRemakeFactorBoolean(requestedUseProductLookup, true)
    : (propUseProductLookup ? parseRemakeFactorBoolean(propUseProductLookup, true) : true);

  const productLookupSourceUrl = String(requestedOptions.productLookupSourceUrl || requestedOptions.productLookupCsvFileUrl || props.getProperty(remakeFactorProductLookupSourceUrlProperty) || props.getProperty(remakeFactorProductLookupCsvFileUrlProperty) || remakeFactorDefaultProductLookupCsvFileUrl || requestedOptions.productLookupSheetUrl || props.getProperty(remakeFactorProductLookupSheetUrlProperty) || remakeFactorDefaultProductLookupSheetUrl).trim();
  const productLookupSheetName = String(requestedOptions.productLookupSheetName || props.getProperty(remakeFactorProductLookupSheetNameProperty) || remakeFactorDefaultProductLookupSheetName).trim();

  const rawQueryTemplate = props.getProperty(remakeFactorCaseQueryTemplateProperty) || requestedOptions.queryTemplate || 'invoiceDate >= "{queryStartDate}" && invoiceDate < "{queryEndExclusiveDate}"';
  const queryTemplate = normalizeRemakeFactorCaseQueryTemplate(rawQueryTemplate);
  const pullOverlapDays = Math.max(0, Number(
    requestedOptions.pullOverlapDays !== undefined
      ? requestedOptions.pullOverlapDays
      : (props.getProperty(remakeFactorPullOverlapDaysProperty) || 1)
  ));

  return {
    baseUrl: baseUrl,
    userId: userId,
    password: password,
    startDate: startDate,
    endDate: endDate,
    lookbackMonths: lookbackMonths,
    pageSize: Math.max(10, Number(requestedOptions.pageSize || props.getProperty(remakeFactorPageSizeProperty) || 250)),
    maxPages: Math.max(1, Number(requestedOptions.maxPages || props.getProperty(remakeFactorMaxPagesProperty) || 200)),
    maxPagesPerChunk: Math.max(1, Number(requestedOptions.maxPagesPerChunk || props.getProperty(remakeFactorMaxPagesPerChunkProperty) || requestedOptions.maxPages || props.getProperty(remakeFactorMaxPagesProperty) || 80)),
    chunkByMonth: requestedOptions.chunkByMonth !== undefined ? parseRemakeFactorBoolean(requestedOptions.chunkByMonth, true) : (requestedOptions.quickRefresh ? true : parseRemakeFactorBoolean(props.getProperty(remakeFactorChunkByMonthProperty), false)),
    maxDetailFetches: Math.max(0, Number(requestedOptions.maxDetailFetches || props.getProperty(remakeFactorMaxDetailFetchesProperty) || 800)),
    detailStrategy: normalizeRemakeFactorDetailStrategy(props.getProperty(remakeFactorDetailStrategyProperty) || requestedOptions.detailStrategy || 'remakesOnly'),
    additionalFields: String(props.getProperty(remakeFactorAdditionalFieldsProperty) || requestedOptions.additionalFields || 'caseProducts').trim(),
    queryTemplate: queryTemplate,
    pullOverlapDays: pullOverlapDays,
    fetchProductMap: fetchProductMap,
    fetchCustomerMap: fetchCustomerMap,
    useProductLookup: useProductLookup,
    productLookupSourceUrl: productLookupSourceUrl,
    productLookupSheetUrl: productLookupSourceUrl,
    productLookupSheetName: productLookupSheetName,
    quickRefresh: !!requestedOptions.quickRefresh
  };
}

function authenticateRemakeFactorApi(config) {
  const url = config.baseUrl + '/api/Authentication/authenticate';
  const response = remakeFactorFetchJson(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      userID: config.userId,
      password: config.password
    }),
    muteHttpExceptions: true
  });

  const token = extractRemakeFactorToken(response.body);
  if (!token) {
    throw new Error('MagicTouch authentication succeeded but no bearer token could be found in the response. Check the authenticate response shape.');
  }
  return token;
}

function fetchRemakeFactorCases(config, token) {
  if (config.chunkByMonth) {
    return fetchRemakeFactorCasesMonthChunks(config, token);
  }
  return fetchRemakeFactorCasesSingleRange(config, token);
}

function fetchRemakeFactorCasesMonthChunks(config, token) {
  const chunks = getRemakeFactorMonthChunks(config.startDate, config.endDate);
  const allCases = [];
  const seen = {};
  const warnings = [];
  const aggregateStats = {
    caseProductsInlineCount: 0,
    caseProductsMissingCount: 0,
    detailFetchCandidates: 0,
    detailFetchesAttempted: 0,
    detailFetchesSucceeded: 0,
    detailFetchesSkipped: 0,
    pagesRequested: 0,
    monthChunks: chunks.length,
    months: chunks.map(chunk => chunk.startDate.slice(0, 7)),
    chunkByMonth: true,
    detailStrategy: config.detailStrategy,
    additionalFields: config.additionalFields,
    queryUsed: 'month chunks from ' + config.startDate + ' to ' + config.endDate
  };

  chunks.forEach(chunk => {
    const chunkConfig = Object.assign({}, config, {
      startDate: chunk.startDate,
      endDate: chunk.endDate,
      maxPages: config.maxPagesPerChunk || config.maxPages
    });
    const result = fetchRemakeFactorCasesSingleRange(chunkConfig, token);
    const rows = result.rows || [];
    rows.forEach(row => {
      const key = String(row.caseID || row.caseId || row.id || row.caseNumber || JSON.stringify(row).slice(0, 120));
      if (seen[key]) return;
      seen[key] = true;
      allCases.push(row);
    });

    const stats = result.stats || {};
    aggregateStats.caseProductsInlineCount += Number(stats.caseProductsInlineCount || 0);
    aggregateStats.caseProductsMissingCount += Number(stats.caseProductsMissingCount || 0);
    aggregateStats.detailFetchCandidates += Number(stats.detailFetchCandidates || 0);
    aggregateStats.detailFetchesAttempted += Number(stats.detailFetchesAttempted || 0);
    aggregateStats.detailFetchesSucceeded += Number(stats.detailFetchesSucceeded || 0);
    aggregateStats.detailFetchesSkipped += Number(stats.detailFetchesSkipped || 0);
    aggregateStats.pagesRequested += Number(stats.pagesRequested || 0);
    if (Array.isArray(stats.warnings)) {
      stats.warnings.forEach(warning => warnings.push(chunk.startDate.slice(0, 7) + ': ' + warning));
    }
  });

  aggregateStats.warnings = warnings;
  return { rows: allCases, stats: aggregateStats };
}

function fetchRemakeFactorCasesSingleRange(config, token) {
  const allCases = [];
  const headers = { Authorization: 'Bearer ' + token };
  const query = buildRemakeFactorCaseQuery(config);
  const warnings = [];
  let queryUsed = query;
  let pagesRequested = 0;

  for (let page = 1; page <= config.maxPages; page++) {
    const params = {
      page: page,
      pageSize: config.pageSize,
      orderBy: 'invoiceDate'
    };
    if (config.additionalFields) params.additionalFields = config.additionalFields;
    if (query) params.query = query;

    let url = config.baseUrl + '/api/Cases/QueryCases?' + toRemakeFactorQueryString(params);
    let response;
    try {
      pagesRequested++;
      response = remakeFactorFetchJson(url, {
        method: 'get',
        headers: headers,
        muteHttpExceptions: true
      });
    } catch (error) {
      // The accepted query syntax was still an open item in the API runbook.
      // For the web refresh, try one tiny unfiltered page before failing so the
      // UI can prove auth/endpoint access and display a useful warning.
      if (page === 1 && query && config.quickRefresh && !config.chunkByMonth) {
        warnings.push('Date query failed, so quick refresh retried one unfiltered page. Error: ' + compactRemakeFactorError(error));
        delete params.query;
        queryUsed = '';
        url = config.baseUrl + '/api/Cases/QueryCases?' + toRemakeFactorQueryString(params);
        pagesRequested++;
        response = remakeFactorFetchJson(url, {
          method: 'get',
          headers: headers,
          muteHttpExceptions: true
        });
      } else {
        throw error;
      }
    }

    const rows = extractRemakeFactorRows(response.body);
    if (!rows.length) break;

    rows.forEach(row => allCases.push(row));
    if (rows.length < config.pageSize) break;
  }

  const rawFetchedCaseCount = allCases.length;
  const filteredCases = filterRemakeFactorCasesToRequestedInvoiceDateRange(allCases, config);
  const dateFilteredOut = Math.max(0, rawFetchedCaseCount - filteredCases.length);
  if (dateFilteredOut) {
    warnings.push('Fetched ' + dateFilteredOut + ' overlap rows outside requested invoiceDate range ' + config.startDate + ' to ' + config.endDate + '; those rows were not included in the cache.');
  }

  const needsDetail = filteredCases.filter(row => !Array.isArray(row.caseProducts) || !row.caseProducts.length);
  const inlineCount = filteredCases.length - needsDetail.length;
  let detailCandidates = [];

  if (config.detailStrategy === 'all') {
    detailCandidates = needsDetail;
  } else if (config.detailStrategy === 'remakesOnly') {
    detailCandidates = needsDetail.filter(isLikelyRemakeFactorCaseHeader);
  } else {
    detailCandidates = [];
  }

  const cappedCandidates = detailCandidates.slice(0, config.maxDetailFetches);
  const skipped = Math.max(0, detailCandidates.length - cappedCandidates.length);
  let detailFetchesSucceeded = 0;

  cappedCandidates.forEach(caseRow => {
    const caseId = caseRow.caseID || caseRow.caseId || caseRow.id;
    if (!caseId) {
      caseRow.detailFetchSkipped = true;
      caseRow.detailFetchSkipReason = 'Missing caseID';
      return;
    }
    try {
      const detail = fetchRemakeFactorCaseDetail(config, token, caseId);
      if (detail && Array.isArray(detail.caseProducts)) {
        Object.keys(detail).forEach(key => {
          caseRow[key] = detail[key];
        });
        detailFetchesSucceeded++;
      }
    } catch (error) {
      caseRow.detailFetchError = error && error.message ? error.message : String(error);
    }
  });

  needsDetail.forEach(caseRow => {
    if (!Array.isArray(caseRow.caseProducts) || !caseRow.caseProducts.length) {
      caseRow.usedCaseLevelFallback = true;
    }
  });

  if (needsDetail.length) {
    warnings.push('QueryCases returned ' + needsDetail.length + ' cases without inline caseProducts. Used detailStrategy=' + config.detailStrategy + '.');
  }
  if (config.detailStrategy === 'remakesOnly' && needsDetail.length) {
    warnings.push('Non-remake case headers use case-level fallback rows. Case counts are usable; unit/product detail is complete only for rows with fetched caseProducts.');
  }
  if (skipped) {
    warnings.push('Skipped ' + skipped + ' detail fetch candidates because MT_REMAKE_MAX_DETAIL_FETCHES is ' + config.maxDetailFetches + '.');
  }
  if (config.detailStrategy === 'all' && detailCandidates.length > config.maxDetailFetches) {
    warnings.push('Full detail mode needs ' + detailCandidates.length + ' detail fetches. Increase MT_REMAKE_MAX_DETAIL_FETCHES or use a narrower date range/scheduled chunked refresh.');
  }
  if (rawFetchedCaseCount >= config.maxPages * config.pageSize) {
    warnings.push('Reached page cap for ' + config.startDate + ' to ' + config.endDate + '. Increase maxPages/maxPagesPerChunk if this month or range is incomplete.');
  }

  const queryBounds = getRemakeFactorQueryDateBounds(config);

  return {
    rows: filteredCases,
    stats: {
      caseProductsInlineCount: inlineCount,
      caseProductsMissingCount: needsDetail.length,
      detailStrategy: config.detailStrategy,
      detailFetchCandidates: detailCandidates.length,
      detailFetchesAttempted: cappedCandidates.length,
      detailFetchesSucceeded: detailFetchesSucceeded,
      detailFetchesSkipped: skipped,
      additionalFields: config.additionalFields,
      queryUsed: queryUsed,
      requestedStartDate: config.startDate,
      requestedEndDate: config.endDate,
      queryStartDate: queryBounds.queryStartDate,
      queryEndDate: queryBounds.queryEndDate,
      queryEndExclusiveDate: queryBounds.queryEndExclusiveDate,
      pullOverlapDays: Number(config.pullOverlapDays || 0),
      rawFetchedCaseCount: rawFetchedCaseCount,
      dateFilteredOut: dateFilteredOut,
      pagesRequested: pagesRequested,
      chunkByMonth: false,
      warnings: warnings
    }
  };
}

function fetchRemakeFactorCaseDetail(config, token, caseId) {
  const url = config.baseUrl + '/api/Cases/' + encodeURIComponent(caseId);
  const response = remakeFactorFetchJson(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  return response.body;
}

function fetchRemakeFactorProductMap(config, token) {
  const productMap = {};
  const headers = { Authorization: 'Bearer ' + token };
  const maxPages = 100;
  const pageSize = 500;

  for (let page = 1; page <= maxPages; page++) {
    const url = config.baseUrl + '/api/Products/QueryProducts?' + toRemakeFactorQueryString({
      page: page,
      pageSize: pageSize,
      orderBy: 'productID'
    });

    try {
      const response = remakeFactorFetchJson(url, {
        method: 'get',
        headers: headers,
        muteHttpExceptions: true
      });
      const rows = extractRemakeFactorRows(response.body);
      if (!rows.length) break;

      rows.forEach(product => {
        const productId = String(product.productID || product.productId || product.id || '').trim();
        if (!productId) return;
        productMap[productId] = {
          productId: productId,
          productName: product.description || product.productDescription || product.name || product.invoiceDescription || productId,
          department: product.department || product.productsDepartment || product.taxDepartment || '',
          group: product.taxGroup || product.group || product.productsGroup || product.productGroup || product.Products_Group || '',
          category: product.taxCategory || product.category || product.productsCategory || '',
          type: product.type || product.productsType || '',
          source: product.department ? 'MagicTouch Products.department' : (product.productsDepartment ? 'MagicTouch Products.productsDepartment' : (product.taxDepartment ? 'MagicTouch Products.taxDepartment fallback' : 'MagicTouch Products'))
        };
      });

      if (rows.length < pageSize) break;
    } catch (error) {
      // Product metadata improves labels, but the remake cache can still work with productID/invoiceDescription.
      break;
    }
  }

  return productMap;
}


function refreshRemakeProductLookupCache(options) {
  const opts = options || {};
  const props = PropertiesService.getScriptProperties();
  const sourceUrl = String(opts.productLookupSourceUrl || opts.productLookupCsvFileUrl || props.getProperty(remakeFactorProductLookupSourceUrlProperty) || props.getProperty(remakeFactorProductLookupCsvFileUrlProperty) || remakeFactorDefaultProductLookupCsvFileUrl || opts.productLookupSheetUrl || props.getProperty(remakeFactorProductLookupSheetUrlProperty) || remakeFactorDefaultProductLookupSheetUrl).trim();
  const sheetName = String(opts.productLookupSheetName || props.getProperty(remakeFactorProductLookupSheetNameProperty) || remakeFactorDefaultProductLookupSheetName).trim();
  const payload = buildRemakeFactorProductLookupPayload(sourceUrl, sheetName);
  writeRemakeFactorProductLookupCache(payload);
  props.setProperty(remakeFactorProductLookupSourceUrlProperty, sourceUrl);
  if (isRemakeFactorCsvDriveSource(sourceUrl)) props.setProperty(remakeFactorProductLookupCsvFileUrlProperty, sourceUrl);
  return Object.assign({}, payload, {
    lookup: undefined,
    message: 'Product lookup cache refreshed from ' + (payload.sourceLabel || payload.source || sheetName) + '. Product IDs available: ' + Object.keys(payload.lookup || {}).length
  });
}

function fetchRemakeFactorProductLookupMap(config) {
  const cfg = config || {};
  const cached = readRemakeFactorProductLookupCache();
  const sourceUrl = String(cfg.productLookupSourceUrl || cfg.productLookupSheetUrl || remakeFactorDefaultProductLookupCsvFileUrl || remakeFactorDefaultProductLookupSheetUrl).trim();
  const sheetName = String(cfg.productLookupSheetName || remakeFactorDefaultProductLookupSheetName).trim();

  if (cached && cached.ok && cached.lookup && Object.keys(cached.lookup).length) {
    return {
      lookup: cached.lookup,
      stats: {
        ok: true,
        source: 'Drive product lookup cache',
        generatedAt: cached.generatedAt || '',
        productCount: Object.keys(cached.lookup || {}).length,
        sourceUrl: cached.sourceUrl || cached.sheetUrl || sourceUrl,
        sheetUrl: cached.sheetUrl || sourceUrl,
        sheetName: cached.sheetName || sheetName,
        sourceType: cached.sourceType || ''
      }
    };
  }

  const payload = buildRemakeFactorProductLookupPayload(sourceUrl, sheetName);
  writeRemakeFactorProductLookupCache(payload);
  return {
    lookup: payload.lookup || {},
    stats: {
      ok: true,
      source: (payload.sourceType === 'csv' ? 'CSV Drive product lookup rebuilt' : 'Google Sheet product lookup rebuilt'),
      generatedAt: payload.generatedAt || '',
      productCount: Object.keys(payload.lookup || {}).length,
      sourceUrl: sourceUrl,
      sheetUrl: sourceUrl,
      sheetName: sheetName,
      sourceType: payload.sourceType || '',
      rowCount: payload.rowCount || 0,
      duplicateIds: (payload.duplicates || []).length
    }
  };
}

function buildRemakeFactorProductLookupPayload(sourceUrl, sheetName) {
  const source = String(sourceUrl || remakeFactorDefaultProductLookupCsvFileUrl || remakeFactorDefaultProductLookupSheetUrl).trim();
  if (isRemakeFactorCsvDriveSource(source)) {
    return buildRemakeFactorProductLookupPayloadFromCsvFile(source);
  }
  return buildRemakeFactorProductLookupPayloadFromSpreadsheet(source, sheetName || remakeFactorDefaultProductLookupSheetName);
}

function buildRemakeFactorProductLookupPayloadFromSpreadsheet(sheetUrl, sheetName) {
  const spreadsheet = SpreadsheetApp.openByUrl(sheetUrl);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Product lookup sheet tab not found: ' + sheetName);
  const values = sheet.getDataRange().getValues();
  return buildRemakeFactorProductLookupPayloadFromValues(values, {
    source: 'CDA Prices and Stuff Google Sheet',
    sourceType: 'spreadsheet',
    sourceLabel: 'CDA Prices and Stuff / ' + sheetName,
    sourceUrl: sheetUrl,
    sheetUrl: sheetUrl,
    sheetName: sheetName,
    sourceName: sheetName
  });
}

function buildRemakeFactorProductLookupPayloadFromCsvFile(fileUrl) {
  const fileId = extractRemakeFactorDriveFileId(fileUrl);
  if (!fileId) throw new Error('Product lookup CSV file URL does not contain a Drive file ID.');
  const file = DriveApp.getFileById(fileId);
  const csvText = file.getBlob().getDataAsString('UTF-8');
  const values = Utilities.parseCsv(csvText);
  return buildRemakeFactorProductLookupPayloadFromValues(values, {
    source: 'Product_List CSV Drive file',
    sourceType: 'csv',
    sourceLabel: file.getName(),
    sourceUrl: fileUrl,
    sheetUrl: fileUrl,
    sheetName: file.getName(),
    sourceName: file.getName(),
    fileId: fileId,
    fileName: file.getName()
  });
}

function buildRemakeFactorProductLookupPayloadFromValues(values, sourceInfo) {
  const info = sourceInfo || {};
  if (!values || values.length < 2) {
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      source: info.source || 'Product lookup source',
      sourceType: info.sourceType || '',
      sourceLabel: info.sourceLabel || info.source || '',
      sourceUrl: info.sourceUrl || '',
      sheetUrl: info.sheetUrl || info.sourceUrl || '',
      sheetName: info.sheetName || '',
      fileId: info.fileId || '',
      fileName: info.fileName || '',
      rowCount: values ? values.length : 0,
      lookup: {},
      duplicates: []
    };
  }

  const headers = (values[0] || []).map(function(header) { return cleanRemakeFactorText(header); });
  const headerMap = buildRemakeFactorHeaderMap(headers);
  const idIndex = getRemakeFactorHeaderIndex(headerMap, ['id', 'product id', 'productid', 'product_id']);
  if (idIndex < 0) throw new Error('Product lookup source must contain an ID/Product ID column. Found headers: ' + headers.join(', '));

  const departmentIndex = getRemakeFactorHeaderIndex(headerMap, ['department', 'column 1', 'products_department', 'products department']);
  const groupIndex = getRemakeFactorHeaderIndex(headerMap, ['group', 'products_group', 'products group']);
  const typeIndex = getRemakeFactorHeaderIndex(headerMap, ['type', 'products_type', 'products type']);
  const categoryIndex = getRemakeFactorHeaderIndex(headerMap, ['category', 'products_category', 'products category']);
  const descriptionIndex = getRemakeFactorHeaderIndex(headerMap, ['description', 'products_description', 'products description']);
  const invoiceDescriptionIndex = getRemakeFactorHeaderIndex(headerMap, ['invoicedescription', 'invoice description', 'invoice_description']);
  const discontinuedIndex = getRemakeFactorHeaderIndex(headerMap, ['discontinued', 'inactive']);
  const activeIndex = getRemakeFactorHeaderIndex(headerMap, ['active']);
  const priceIndex = getRemakeFactorHeaderIndex(headerMap, ['price']);

  const lookup = {};
  const duplicates = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r] || [];
    const productId = cleanRemakeFactorProductId(row[idIndex]);
    if (!productId) continue;

    const record = {
      productId: productId,
      productName: cleanRemakeFactorText(row[descriptionIndex]) || cleanRemakeFactorText(row[invoiceDescriptionIndex]) || productId,
      description: cleanRemakeFactorText(row[descriptionIndex]),
      invoiceDescription: cleanRemakeFactorText(row[invoiceDescriptionIndex]),
      department: normalizeRemakeFactorDepartment(row[departmentIndex]) || cleanRemakeFactorText(row[departmentIndex]),
      group: cleanRemakeFactorText(row[groupIndex]),
      category: cleanRemakeFactorText(row[categoryIndex]),
      type: cleanRemakeFactorText(row[typeIndex]),
      price: priceIndex >= 0 ? toRemakeFactorNumber(row[priceIndex]) : 0,
      active: activeIndex >= 0 ? cleanRemakeFactorText(row[activeIndex]) : '',
      discontinued: discontinuedIndex >= 0 ? cleanRemakeFactorText(row[discontinuedIndex]) : '',
      source: info.sourceType === 'csv' ? 'productLookupCsv' : 'productLookupSheet',
      sourceType: info.sourceType || '',
      sourceName: info.sourceName || info.sheetName || info.fileName || '',
      sourceSheetName: info.sheetName || '',
      sourceRow: r + 1
    };

    const existing = lookup[productId];
    if (existing) {
      duplicates.push({ productId: productId, keptRow: existing.sourceRow, candidateRow: record.sourceRow });
      if (shouldReplaceRemakeFactorProductLookupRecord(existing, record)) lookup[productId] = record;
    } else {
      lookup[productId] = record;
    }
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: info.source || 'Product lookup source',
    sourceType: info.sourceType || '',
    sourceLabel: info.sourceLabel || info.source || '',
    sourceUrl: info.sourceUrl || '',
    sheetUrl: info.sheetUrl || info.sourceUrl || '',
    sheetName: info.sheetName || '',
    fileId: info.fileId || '',
    fileName: info.fileName || '',
    rowCount: values.length,
    productCount: Object.keys(lookup).length,
    duplicates: duplicates,
    lookup: lookup
  };
}

function isRemakeFactorCsvDriveSource(url) {
  const value = String(url || '').trim().toLowerCase();
  return value.indexOf('drive.google.com/file/d/') >= 0 || value.indexOf('uc?id=') >= 0 || value.slice(-4) === '.csv';
}

function extractRemakeFactorDriveFileId(url) {
  const value = String(url || '').trim();
  let match = value.match(/\/file\/d\/([^\/\?#]+)/);
  if (match && match[1]) return match[1];
  match = value.match(/[?&]id=([^&]+)/);
  if (match && match[1]) return match[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(value)) return value;
  return '';
}

function mergeRemakeFactorProductMaps(apiProductMap, productLookupMap) {
  const merged = Object.assign({}, apiProductMap || {});
  Object.keys(productLookupMap || {}).forEach(function(productId) {
    const lookupRecord = productLookupMap[productId] || {};
    const apiRecord = merged[productId] || {};
    // MagicTouch Products.department is the authoritative department source.
    // The Drive product lookup remains a fallback for missing API catalog values.
    merged[productId] = Object.assign({}, apiRecord, lookupRecord, {
      productId: productId,
      productName: lookupRecord.productName || lookupRecord.description || lookupRecord.invoiceDescription || apiRecord.productName || apiRecord.description || productId,
      department: apiRecord.department || lookupRecord.department || '',
      group: lookupRecord.group || apiRecord.group || '',
      category: lookupRecord.category || apiRecord.category || '',
      type: lookupRecord.type || apiRecord.type || '',
      source: apiRecord.department ? (apiRecord.source || 'MagicTouch Products.department') : (lookupRecord.source || apiRecord.source || 'productMap')
    });
  });
  return merged;
}

function readRemakeFactorProductLookupCache() {
  const props = PropertiesService.getScriptProperties();
  const fileId = props.getProperty(remakeFactorProductLookupCacheFileIdProperty);
  if (!fileId) return null;
  try {
    const text = DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8');
    return JSON.parse(text);
  } catch (error) {
    props.deleteProperty(remakeFactorProductLookupCacheFileIdProperty);
    return null;
  }
}

function writeRemakeFactorProductLookupCache(payload) {
  const props = PropertiesService.getScriptProperties();
  const json = JSON.stringify(payload || {});
  const fileId = props.getProperty(remakeFactorProductLookupCacheFileIdProperty);
  if (fileId) {
    try {
      DriveApp.getFileById(fileId).setContent(json);
      return fileId;
    } catch (error) {
      props.deleteProperty(remakeFactorProductLookupCacheFileIdProperty);
    }
  }
  const file = DriveApp.createFile(remakeFactorProductLookupCacheFileName, json, MimeType.PLAIN_TEXT);
  props.setProperty(remakeFactorProductLookupCacheFileIdProperty, file.getId());
  return file.getId();
}

function clearRemakeProductLookupCache() {
  const props = PropertiesService.getScriptProperties();
  const fileId = props.getProperty(remakeFactorProductLookupCacheFileIdProperty);
  if (fileId) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (error) {
      // Ignore missing/deleted files.
    }
  }
  props.deleteProperty(remakeFactorProductLookupCacheFileIdProperty);
  return { ok: true, message: 'Remake Factor product lookup cache cleared.' };
}

function buildRemakeFactorHeaderMap(headers) {
  const map = {};
  (headers || []).forEach(function(header, index) {
    const normalized = normalizeRemakeFactorHeaderName(header);
    if (normalized && map[normalized] === undefined) map[normalized] = index;
  });
  return map;
}

function getRemakeFactorHeaderIndex(headerMap, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const key = normalizeRemakeFactorHeaderName(aliases[i]);
    if (headerMap[key] !== undefined) return headerMap[key];
  }
  return -1;
}

function normalizeRemakeFactorHeaderName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function cleanRemakeFactorProductId(value) {
  return String(value === null || value === undefined ? '' : value).trim().toUpperCase();
}

function shouldReplaceRemakeFactorProductLookupRecord(existing, candidate) {
  const existingScore = getRemakeFactorProductLookupRecordScore(existing);
  const candidateScore = getRemakeFactorProductLookupRecordScore(candidate);
  return candidateScore > existingScore;
}

function getRemakeFactorProductLookupRecordScore(record) {
  if (!record) return 0;
  let score = 0;
  const discontinued = String(record.discontinued || '').toLowerCase();
  const active = String(record.active || '').toLowerCase();
  if (record.department) score += 10;
  if (record.group) score += 5;
  if (record.type) score += 2;
  if (active === 'y' || active === 'yes' || active === 'true' || active === '1') score += 3;
  if (discontinued === '1' || discontinued === 'y' || discontinued === 'yes' || discontinued === 'true') score -= 2;
  return score;
}

function fetchRemakeFactorCustomerMap(config, token, caseRows) {
  // v1.12: customer names/practice names are API-based for Remake Factor.
  // No BigQuery lookup is used here. The cache should represent what the
  // MagicTouch/API source provides, with case rows as fallback and Customers API
  // as enrichment when the endpoint is available.
  if (Array.isArray(token) && caseRows === undefined) {
    caseRows = token;
    token = '';
  }

  const rows = Array.isArray(caseRows) ? caseRows : [];
  const requestedIds = getRemakeFactorCustomerIdsFromCaseRows(rows);
  const customerMap = buildRemakeFactorCustomerMapFromCaseRows(rows);
  const stats = {
    source: 'MagicTouch API customers + case rows',
    requestedCustomerIds: requestedIds.length,
    namesFromCaseRows: countRemakeFactorCustomerNames(customerMap),
    namesFromApi: 0,
    apiRowsFetched: 0,
    apiEndpoint: '',
    warnings: []
  };

  if (!token) {
    stats.warnings.push('Customer API lookup skipped because no bearer token was available. Used customer fields from QueryCases rows only.');
    attachRemakeFactorCustomerMapStats(customerMap, stats);
    return customerMap;
  }

  try {
    const apiResult = fetchRemakeFactorCustomersFromApi(config, token, requestedIds);
    stats.apiRowsFetched = apiResult.rowsFetched || 0;
    stats.apiUniqueRowsFetched = apiResult.uniqueRowsFetched || apiResult.rowsFetched || 0;
    stats.apiEndpoint = apiResult.endpoint || '';
    stats.apiAttempts = apiResult.attempts || [];
    stats.rawCustomerSamples = (apiResult.rows || []).slice(0, 10).map(summarizeRemakeFactorRawCustomerFields);
    (apiResult.warnings || []).forEach(warning => stats.warnings.push(warning));

    (apiResult.rows || []).forEach(customer => {
      const id = getRemakeFactorCustomerId(customer);
      if (!id) return;
      if (requestedIds.length && requestedIds.indexOf(id) === -1) return;
      mergeRemakeFactorCustomerMapEntry(customerMap, id, customer, 'api');
    });

    stats.namesFromApi = Object.keys(customerMap).filter(id => {
      const entry = customerMap[id] || {};
      return entry.source === 'api' && (entry.customerName || entry.practiceName || entry.customerDisplayName);
    }).length;

    if (!stats.apiRowsFetched) {
      stats.warnings.push('Customers API returned no rows. Used customer fields from QueryCases rows only.');
    }
    if (requestedIds.length && countRemakeFactorCustomerNames(customerMap) === 0) {
      stats.warnings.push('No customer names/practice names were found from QueryCases or Customers API. The API may not expose those fields in the current response.');
    }
  } catch (error) {
    stats.warnings.push('Customers API lookup failed. Used customer fields from QueryCases rows only. Error: ' + compactRemakeFactorError(error));
  }

  attachRemakeFactorCustomerMapStats(customerMap, stats);
  return customerMap;
}

function fetchRemakeFactorCustomersFromApi(config, token, requestedIds) {
  const headers = { Authorization: 'Bearer ' + token };
  const ids = (requestedIds || []).map(id => cleanRemakeFactorText(id)).filter(Boolean);
  const pageSize = Math.max(25, Number(config.customerApiPageSize || 250));
  const maxPages = Math.max(1, Number(config.customerApiMaxPages || 20));
  const maxCustomerLookups = Math.max(1, Number(config.customerApiMaxIds || 750));
  const limitedIds = ids.slice(0, maxCustomerLookups);
  const warnings = [];
  const attempts = [];
  const rowsById = {};
  const allRows = [];

  // v1.15: use the documented Customers endpoints first.
  // ClickUp/API notes confirm these endpoints exist:
  //   GET /api/Customers/{customerId}
  //   GET /api/Customers/CustKey/{custKey}
  // QueryCustomers remains only a fallback because it requires a query string.
  if (limitedIds.length) {
    limitedIds.forEach(customerId => {
      const directResult = fetchRemakeFactorCustomerRowsByDocumentedEndpoint(config, token, customerId, headers, attempts);
      (directResult.rows || []).forEach(row => appendRemakeFactorCustomerApiRow(row, rowsById, allRows));
    });
  }

  let rows = Object.keys(rowsById).map(id => rowsById[id]);
  if (rows.length) {
    return {
      endpoint: 'GET /api/Customers/{customerId} or /api/Customers/CustKey/{custKey}',
      rows: rows,
      rowsFetched: allRows.length,
      uniqueRowsFetched: rows.length,
      warnings: warnings.concat(buildRemakeFactorCustomerApiWarnings(limitedIds, rows, attempts)),
      attempts: summarizeRemakeFactorCustomerApiAttempts(attempts)
    };
  }

  // Fallback: QueryCustomers with real query patterns. This is used only if
  // direct customer/custKey lookup returns no rows.
  if (limitedIds.length) {
    const singleIdProbe = limitedIds[0];
    const probeResult = fetchRemakeFactorCustomerRowsForOneId(config, token, singleIdProbe, attempts);
    if (probeResult.rows && probeResult.rows.length) {
      probeResult.rows.forEach(row => appendRemakeFactorCustomerApiRow(row, rowsById, allRows));
      const workingPattern = probeResult.workingPattern || null;
      for (let i = 1; i < limitedIds.length; i++) {
        const id = limitedIds[i];
        const result = fetchRemakeFactorCustomerRowsForOneId(config, token, id, attempts, workingPattern);
        (result.rows || []).forEach(row => appendRemakeFactorCustomerApiRow(row, rowsById, allRows));
      }
      rows = Object.keys(rowsById).map(id => rowsById[id]);
      return {
        endpoint: workingPattern ? workingPattern.endpoint : probeResult.endpoint,
        rows: rows,
        rowsFetched: allRows.length,
        uniqueRowsFetched: rows.length,
        warnings: warnings.concat(buildRemakeFactorCustomerApiWarnings(limitedIds, rows, attempts)),
        attempts: summarizeRemakeFactorCustomerApiAttempts(attempts)
      };
    }
  }

  // Last fallback: broad customer queries with a required query. These are capped.
  const broadResult = fetchRemakeFactorCustomerRowsBroad(config, token, ids, headers, pageSize, maxPages, attempts);
  (broadResult.rows || []).forEach(row => appendRemakeFactorCustomerApiRow(row, rowsById, allRows));

  rows = Object.keys(rowsById).map(id => rowsById[id]);
  return {
    endpoint: broadResult.endpoint || '',
    rows: rows,
    rowsFetched: allRows.length,
    uniqueRowsFetched: rows.length,
    warnings: warnings.concat(buildRemakeFactorCustomerApiWarnings(limitedIds, rows, attempts, broadResult.warnings || [])),
    attempts: summarizeRemakeFactorCustomerApiAttempts(attempts)
  };
}

function fetchRemakeFactorCustomerRowsByDocumentedEndpoint(config, token, customerId, headers, attempts) {
  const id = cleanRemakeFactorText(customerId);
  const endpoints = [
    { endpoint: '/api/Customers/' + encodeURIComponent(id), method: 'get', source: 'customerId' },
    { endpoint: '/api/Customers/CustKey/' + encodeURIComponent(id), method: 'get', source: 'custKey' }
  ];

  for (let i = 0; i < endpoints.length; i++) {
    const pattern = endpoints[i];
    const url = config.baseUrl + pattern.endpoint;
    try {
      const response = remakeFactorFetchJson(url, {
        method: 'get',
        headers: headers,
        muteHttpExceptions: true
      });
      const rows = extractRemakeFactorCustomerRows(response.body, id);
      attempts.push({
        ok: true,
        endpoint: pattern.endpoint,
        method: 'get',
        query: '',
        page: '',
        rows: rows.length,
        customerId: id,
        source: pattern.source,
        sampleKeys: rows[0] ? Object.keys(rows[0]).slice(0, 35).join(',') : ''
      });
      if (rows.length) {
        return {
          endpoint: pattern.endpoint,
          rows: rows,
          rowsFetched: rows.length,
          workingPattern: pattern
        };
      }
    } catch (error) {
      attempts.push({
        ok: false,
        endpoint: pattern.endpoint,
        method: 'get',
        query: '',
        page: '',
        rows: 0,
        customerId: id,
        source: pattern.source,
        error: compactRemakeFactorError(error)
      });
    }
  }

  return { endpoint: '', rows: [], rowsFetched: 0, workingPattern: null };
}

function extractRemakeFactorCustomerRows(body, expectedCustomerId) {
  if (!body) return [];
  if (Array.isArray(body)) return body;

  const rows = extractRemakeFactorRows(body);
  if (rows.length) return rows;

  const nestedCandidates = [body.customer, body.Customer, body.customerModel, body.CustomerModel, body.data, body.result, body.value];
  for (let i = 0; i < nestedCandidates.length; i++) {
    const candidate = nestedCandidates[i];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const nestedRows = extractRemakeFactorRows(candidate);
      if (nestedRows.length) return nestedRows;
      if (looksLikeRemakeFactorCustomerObject(candidate, expectedCustomerId)) return [candidate];
    }
  }

  if (looksLikeRemakeFactorCustomerObject(body, expectedCustomerId)) return [body];
  return [];
}

function looksLikeRemakeFactorCustomerObject(row, expectedCustomerId) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const id = getRemakeFactorCustomerId(row);
  if (id) {
    if (!expectedCustomerId) return true;
    if (String(id) === String(expectedCustomerId)) return true;
  }
  return !!(
    row.practiceName || row.PracticeName ||
    row.firstName || row.FirstName ||
    row.lastName || row.LastName ||
    row.customerID || row.customerId || row.custKey || row.CustKey || row.CustomerID
  );
}

function fetchRemakeFactorCustomerRowsForOneId(config, token, customerId, attempts, preferredPattern) {
  const patterns = preferredPattern ? [preferredPattern] : getRemakeFactorCustomerQueryPatterns(customerId);
  const headers = { Authorization: 'Bearer ' + token };

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    try {
      const response = fetchRemakeFactorCustomerRowsWithPattern(config, token, pattern, headers);
      const rows = extractRemakeFactorCustomerRows(response.body, customerId);
      attempts.push({
        ok: true,
        endpoint: pattern.endpoint,
        method: pattern.method,
        query: pattern.query,
        rows: rows.length,
        customerId: customerId,
        sampleKeys: rows[0] ? Object.keys(rows[0]).slice(0, 35).join(',') : ''
      });
      if (rows.length) {
        return {
          endpoint: pattern.endpoint,
          rows: rows,
          rowsFetched: rows.length,
          workingPattern: pattern
        };
      }
    } catch (error) {
      attempts.push({
        ok: false,
        endpoint: pattern.endpoint,
        method: pattern.method,
        query: pattern.query,
        rows: 0,
        customerId: customerId,
        error: compactRemakeFactorError(error)
      });
    }
  }

  return { endpoint: '', rows: [], rowsFetched: 0, workingPattern: null };
}

function getRemakeFactorCustomerQueryPatterns(customerId) {
  const id = cleanRemakeFactorText(customerId);
  const quotedId = '"' + id.replace(/"/g, '\\"') + '"';
  const endpoints = [
    '/api/Customers/QueryCustomers',
    '/api/Customer/QueryCustomers'
  ];
  const queries = [
    'customerID == ' + quotedId,
    'customerId == ' + quotedId,
    'custKey == ' + quotedId,
    'CustomerID == ' + quotedId,
    'CustomerId == ' + quotedId,
    'CustKey == ' + quotedId,
    'customerID = ' + quotedId,
    'customerId = ' + quotedId,
    'custKey = ' + quotedId,
    'customerID == ' + id,
    'customerId == ' + id,
    'custKey == ' + id,
    'CustomerID == ' + id,
    'id == ' + quotedId,
    'id == ' + id
  ];
  const patterns = [];

  endpoints.forEach(endpoint => {
    queries.forEach(query => {
      patterns.push({ endpoint: endpoint, method: 'get', query: query });
    });
  });

  endpoints.forEach(endpoint => {
    queries.slice(0, 9).forEach(query => {
      patterns.push({ endpoint: endpoint, method: 'post', query: query });
    });
  });

  return patterns;
}

function fetchRemakeFactorCustomerRowsWithPattern(config, token, pattern, headers) {
  const params = {
    page: 1,
    pageSize: 50,
    orderBy: 'customerID'
  };

  if (pattern.method === 'post') {
    const url = config.baseUrl + pattern.endpoint;
    return remakeFactorFetchJson(url, {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(Object.assign({}, params, { query: pattern.query })),
      muteHttpExceptions: true
    });
  }

  params.query = pattern.query;
  const url = config.baseUrl + pattern.endpoint + '?' + toRemakeFactorQueryString(params);
  return remakeFactorFetchJson(url, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  });
}

function fetchRemakeFactorCustomerRowsBroad(config, token, requestedIds, headers, pageSize, maxPages, attempts) {
  const endpoints = [
    '/api/Customers/QueryCustomers',
    '/api/Customer/QueryCustomers'
  ];
  const broadQueries = [
    'customerID != ""',
    'customerId != ""',
    'custKey != ""',
    'CustomerID != ""',
    'customerID >= "0"',
    'customerId >= "0"',
    'custKey >= "0"',
    'id >= "0"'
  ];
  const warnings = [];
  const idSet = {};
  (requestedIds || []).forEach(id => { idSet[cleanRemakeFactorText(id)] = true; });

  for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
    const endpoint = endpoints[endpointIndex];
    for (let queryIndex = 0; queryIndex < broadQueries.length; queryIndex++) {
      const query = broadQueries[queryIndex];
      const allRows = [];
      let endpointWorked = false;

      for (let page = 1; page <= maxPages; page++) {
        try {
          const url = config.baseUrl + endpoint + '?' + toRemakeFactorQueryString({
            page: page,
            pageSize: pageSize,
            orderBy: 'customerID',
            query: query
          });
          const response = remakeFactorFetchJson(url, {
            method: 'get',
            headers: headers,
            muteHttpExceptions: true
          });
          endpointWorked = true;
          const rows = extractRemakeFactorCustomerRows(response.body, '');
          attempts.push({ ok: true, endpoint: endpoint, method: 'get', query: query, page: page, rows: rows.length, customerId: 'broad', sampleKeys: rows[0] ? Object.keys(rows[0]).slice(0, 35).join(',') : '' });
          rows.forEach(row => {
            const id = getRemakeFactorCustomerId(row);
            if (!requestedIds || !requestedIds.length || idSet[id]) allRows.push(row);
          });
          if (!rows.length || rows.length < pageSize) break;
        } catch (error) {
          attempts.push({ ok: false, endpoint: endpoint, method: 'get', query: query, page: page, rows: 0, customerId: 'broad', error: compactRemakeFactorError(error) });
          if (page === 1) warnings.push(endpoint + ' broad query failed for [' + query + ']: ' + compactRemakeFactorError(error));
          break;
        }
      }

      if (endpointWorked && allRows.length) {
        return {
          endpoint: endpoint,
          rows: allRows,
          rowsFetched: allRows.length,
          warnings: warnings
        };
      }
    }
  }

  return {
    endpoint: '',
    rows: [],
    rowsFetched: 0,
    warnings: warnings.concat(['No Customers API query pattern returned customer rows.'])
  };
}

function appendRemakeFactorCustomerApiRow(row, rowsById, allRows) {
  const id = getRemakeFactorCustomerId(row);
  if (!id) return;
  allRows.push(row);
  const existing = rowsById[id];
  if (!existing) {
    rowsById[id] = row;
    return;
  }

  const existingInfo = extractRemakeFactorCustomerInfo(existing, id);
  const nextInfo = extractRemakeFactorCustomerInfo(row, id);
  const existingScore = (existingInfo.customerName ? 2 : 0) + (existingInfo.practiceName ? 2 : 0) + (existingInfo.customerDisplayName ? 1 : 0);
  const nextScore = (nextInfo.customerName ? 2 : 0) + (nextInfo.practiceName ? 2 : 0) + (nextInfo.customerDisplayName ? 1 : 0);
  if (nextScore > existingScore) rowsById[id] = row;
}

function buildRemakeFactorCustomerApiWarnings(requestedIds, rows, attempts, extraWarnings) {
  const warnings = [].concat(extraWarnings || []);
  const requestedCount = (requestedIds || []).length;
  const rowCount = (rows || []).length;
  const nameCount = (rows || []).filter(row => {
    const id = getRemakeFactorCustomerId(row);
    const info = extractRemakeFactorCustomerInfo(row, id);
    return !!(info.customerName || info.practiceName || info.customerDisplayName);
  }).length;

  if (!rowCount) {
    warnings.push('Customer query diagnostics tried exact-ID and broad QueryCustomers patterns, but no customer rows were returned.');
  } else if (requestedCount && rowCount < requestedCount) {
    warnings.push('Customer API returned ' + rowCount + ' unique rows for ' + requestedCount + ' requested IDs. Some IDs may not exist in the customer endpoint or the query syntax may still be incomplete.');
  }
  if (rowCount && !nameCount) {
    warnings.push('Customer API returned rows, but no usable name/practice fields were detected. Check rawCustomerSamples in the debug output for actual field names.');
  }
  if (attempts && attempts.length) {
    const firstSuccess = attempts.filter(item => item.ok && item.rows > 0)[0];
    if (firstSuccess) warnings.push('First successful customer query pattern: ' + firstSuccess.method.toUpperCase() + ' ' + firstSuccess.endpoint + ' query=[' + firstSuccess.query + '].');
  }
  return warnings;
}

function summarizeRemakeFactorCustomerApiAttempts(attempts) {
  return (attempts || []).slice(0, 60).map(item => ({
    ok: !!item.ok,
    endpoint: item.endpoint || '',
    method: item.method || '',
    query: item.query || '',
    page: item.page || '',
    rows: Number(item.rows || 0),
    customerId: item.customerId || '',
    error: item.error || ''
  }));
}

function buildRemakeFactorCustomerMapFromCaseRows(caseRows) {
  const customerMap = {};
  (caseRows || []).forEach(row => {
    const id = getRemakeFactorCustomerId(row);
    if (!id) return;
    mergeRemakeFactorCustomerMapEntry(customerMap, id, row, 'case');
  });
  attachRemakeFactorCustomerMapStats(customerMap, {
    source: 'QueryCases rows only',
    requestedCustomerIds: Object.keys(customerMap).length,
    namesFromCaseRows: countRemakeFactorCustomerNames(customerMap),
    namesFromApi: 0,
    apiRowsFetched: 0,
    apiEndpoint: '',
    warnings: []
  });
  return customerMap;
}

function getRemakeFactorCustomerIdsFromCaseRows(caseRows) {
  const seen = {};
  const ids = [];
  (caseRows || []).forEach(row => {
    const id = getRemakeFactorCustomerId(row);
    if (!id || seen[id]) return;
    seen[id] = true;
    ids.push(id);
  });
  return ids;
}

function getRemakeFactorCustomerId(row) {
  if (!row) return '';
  return cleanRemakeFactorText(
    row.customerID ||
    row.customerId ||
    row.CustomerID ||
    row.CustomerId ||
    row.custKey ||
    row.CustKey ||
    row.customerNumber ||
    row.customerNo ||
    row.accountNumber ||
    row.accountNo ||
    row.Customers_CustomerID ||
    row.id ||
    ''
  );
}

function mergeRemakeFactorCustomerMapEntry(customerMap, customerId, raw, source) {
  if (!customerId) return;
  const existing = customerMap[customerId] || { customerId: customerId };
  const extracted = extractRemakeFactorCustomerInfo(raw, customerId);

  const customerName = extracted.customerName || existing.customerName || '';
  const practiceName = extracted.practiceName || existing.practiceName || '';
  const customerDisplayName = buildRemakeFactorCustomerDisplayName(customerName, practiceName, customerId, extracted.customerDisplayName || existing.customerDisplayName || '');

  customerMap[customerId] = {
    customerId: customerId,
    customerName: customerName,
    practiceName: practiceName,
    customerDisplayName: customerDisplayName,
    customerActive: extracted.customerActive !== null && extracted.customerActive !== undefined ? extracted.customerActive : (existing.customerActive !== false),
    source: source === 'api' && (customerName || practiceName || customerDisplayName !== customerId) ? 'api' : (existing.source || source || 'case')
  };
}

function extractRemakeFactorCustomerInfo(raw, customerId) {
  raw = raw || {};
  const nested = raw.customer || raw.Customer || raw.customerModel || raw.CustomerModel || raw.customerDto || raw.CustomerDto || {};
  const row = Object.assign({}, nested, raw);

  const firstName = firstCleanRemakeFactorValue([
    row.firstName,
    row.FirstName,
    row.customerFirstName,
    row.CustomerFirstName,
    row.contactFirstName,
    row.ContactFirstName,
    row.primaryContactFirstName
  ], customerId);

  const lastName = firstCleanRemakeFactorValue([
    row.lastName,
    row.LastName,
    row.customerLastName,
    row.CustomerLastName,
    row.contactLastName,
    row.ContactLastName,
    row.primaryContactLastName
  ], customerId);

  const nameFromParts = cleanRemakeFactorText([firstName, lastName].filter(Boolean).join(' '));

  const customerName = firstCleanRemakeFactorValue([
    row.customerFullName,
    row.customerName,
    row.customer_name,
    row.CustomerName,
    row.CustomerFullName,
    row.fullName,
    row.FullName,
    nameFromParts,
    row.name,
    row.Name,
    row.displayName,
    row.DisplayName,
    row.contactName,
    row.customerContactName,
    row.customerContactFullName,
    row.contactFullName,
    row.primaryContactName,
    row.billingName,
    row.billToName,
    row.billToCustomerName,
    row.soldToName,
    row.accountDisplayName,
    row.accountFullName,
    row.Customers_CustomerFullName,
    row.customersCustomerFullName
  ], customerId);

  const practiceName = firstCleanRemakeFactorValue([
    row.practiceName,
    row.PracticeName,
    row.customerPracticeName,
    row.practice_name,
    row.practice,
    row.Practice,
    row.officeName,
    row.OfficeName,
    row.office,
    row.Office,
    row.dentalOfficeName,
    row.customerOfficeName,
    row.companyName,
    row.CompanyName,
    row.customerCompanyName,
    row.businessName,
    row.BusinessName,
    row.organizationName,
    row.accountName,
    row.accountDisplayName,
    row.accountFullName,
    row.clinicName,
    row.Customers_PracticeName,
    row.customersPracticeName
  ], customerId);

  const customerDisplayName = firstCleanRemakeFactorValue([
    row.customerDisplayName,
    row.displayName,
    row.DisplayName,
    row.customerLabel,
    row.label
  ], customerId);

  let customerActive = null;
  if (row.active !== undefined) customerActive = parseRemakeFactorBoolean(row.active, true);
  else if (row.Active !== undefined) customerActive = parseRemakeFactorBoolean(row.Active, true);
  else if (row.customerActive !== undefined) customerActive = parseRemakeFactorBoolean(row.customerActive, true);
  else if (row.Customers_Active !== undefined) customerActive = parseRemakeFactorBoolean(row.Customers_Active, true);
  else if (row.status !== undefined) {
    const status = String(row.status || '').trim().toLowerCase();
    if (status) customerActive = !['inactive', 'closed', 'disabled', 'false', '0'].includes(status);
  }

  return {
    customerName: customerName,
    practiceName: practiceName,
    customerDisplayName: customerDisplayName,
    customerActive: customerActive
  };
}

function buildRemakeFactorNameFromParts(firstName, lastName) {
  return cleanRemakeFactorText([firstName, lastName].filter(Boolean).join(' '));
}

function firstCleanRemakeFactorValue(values, customerId) {
  for (let i = 0; i < values.length; i++) {
    const clean = cleanRemakeFactorText(values[i] || '');
    if (!clean) continue;
    if (customerId && clean === String(customerId)) continue;
    // Avoid treating a plain numeric account/id as a name.
    if (/^\d{3,}$/.test(clean)) continue;
    return clean;
  }
  return '';
}

function buildRemakeFactorCustomerDisplayName(customerName, practiceName, customerId, displayName) {
  const safeDisplay = firstCleanRemakeFactorValue([displayName], customerId);
  const safeCustomer = firstCleanRemakeFactorValue([customerName], customerId);
  const safePractice = firstCleanRemakeFactorValue([practiceName], customerId);
  if (safeCustomer && safePractice && safeCustomer !== safePractice) return safeCustomer + ' / ' + safePractice;
  return safeCustomer || safePractice || safeDisplay || customerId || 'Unknown customer';
}

function countRemakeFactorCustomerNames(customerMap) {
  return Object.keys(customerMap || {}).filter(id => {
    const row = customerMap[id] || {};
    const display = String(row.customerDisplayName || row.customerName || row.practiceName || '').trim();
    return display && display !== id && !/^\d{3,}$/.test(display);
  }).length;
}

function attachRemakeFactorCustomerMapStats(customerMap, stats) {
  try {
    Object.defineProperty(customerMap, '__stats', {
      value: stats || {},
      enumerable: false,
      configurable: true
    });
  } catch (error) {
    customerMap.__stats = stats || {};
  }
}

function getRemakeFactorCustomerMapStats(customerMap) {
  return (customerMap && customerMap.__stats) || {};
}

function summarizeRemakeFactorRawCustomerFields(row) {
  row = row || {};
  const id = getRemakeFactorCustomerId(row);
  const info = extractRemakeFactorCustomerInfo(row, id);
  const keys = Object.keys(row).slice(0, 60);
  const sample = {
    customerId: id,
    extractedCustomerName: info.customerName || '',
    extractedPracticeName: info.practiceName || '',
    extractedDisplayName: info.customerDisplayName || '',
    keys: keys
  };

  keys.forEach(key => {
    const lower = String(key || '').toLowerCase();
    if (lower.indexOf('name') >= 0 || lower.indexOf('practice') >= 0 || lower.indexOf('office') >= 0 || lower.indexOf('company') >= 0 || lower.indexOf('account') >= 0 || lower.indexOf('customer') >= 0) {
      const value = row[key];
      if (value === null || value === undefined) return;
      if (typeof value === 'object') {
        sample[key] = JSON.stringify(value).slice(0, 250);
      } else {
        sample[key] = String(value).slice(0, 250);
      }
    }
  });
  return sample;
}

function debugRemakeFactorApiCustomerLookup() {
  try {
    const props = PropertiesService.getScriptProperties();
    const config = getRemakeFactorConfig(props, {
      quickRefresh: true,
      lookbackMonths: 1,
      pageSize: 25,
      maxPages: 1,
      maxDetailFetches: 0,
      fetchProductMap: false,
      fetchCustomerMap: true,
      chunkByMonth: false
    });
    const token = authenticateRemakeFactorApi(config);
    const caseResult = fetchRemakeFactorCases(config, token);
    const caseRows = caseResult.rows || [];
    const customerMap = fetchRemakeFactorCustomerMap(config, token, caseRows);
    const stats = getRemakeFactorCustomerMapStats(customerMap);
    const entries = Object.keys(customerMap).map(id => customerMap[id]);
    const result = {
      ok: true,
      version: 'RemakeFactorCache v1.34',
      source: 'MagicTouch API only - no BigQuery lookup',
      timestamp: new Date().toISOString(),
      message: 'Customer API diagnostic completed. See Apps Script Execution log and remake_factor_debug.json in Drive.',
      caseRowsFetched: caseRows.length,
      uniqueCustomerIdsFromCases: getRemakeFactorCustomerIdsFromCaseRows(caseRows).length,
      customerMapSize: entries.length,
      customerMapStats: stats,
      interpretation: buildRemakeFactorCustomerDebugInterpretation(caseRows, customerMap, stats),
      sampleCustomers: entries.slice(0, 20),
      sampleCaseCustomerFields: caseRows.slice(0, 10).map(row => ({
        customerID: row.customerID || row.customerId || row.customerNumber || row.id || '',
        customerName: row.customerName || row.customerFullName || row.displayName || row.name || '',
        practiceName: row.practiceName || row.officeName || row.companyName || row.practice || ''
      }))
    };
    return writeAndLogRemakeFactorDebugReport('debugRemakeFactorApiCustomerLookup', result);
  } catch (error) {
    const result = buildRemakeFactorErrorResponse('Customer API diagnostic failed', error, { diagnostic: true });
    return writeAndLogRemakeFactorDebugReport('debugRemakeFactorApiCustomerLookup', result);
  }
}

function debugRemakeFactorCachedCustomerNames() {
  try {
    const cached = readRemakeFactorCache();
    const detailRows = cached && Array.isArray(cached.detailRows) ? cached.detailRows : [];
    const namedIds = [];
    const missingIds = [];
    const seenNamed = {};
    const seenMissing = {};

    detailRows.forEach(row => {
      const id = cleanRemakeFactorText(row.customerId || row.customerID || '');
      if (!id) return;
      const display = cleanRemakeFactorText(row.customerDisplayName || row.customerName || row.practiceName || row.customerFullName || '');
      const hasName = display && display !== id && !/^\d{3,}$/.test(display);
      if (hasName && !seenNamed[id]) {
        seenNamed[id] = true;
        namedIds.push({ customerId: id, cachedDisplayName: display });
      }
      if (!hasName && !seenMissing[id]) {
        seenMissing[id] = true;
        missingIds.push({ customerId: id, cachedDisplayName: display || id });
      }
    });

    const testIds = missingIds.slice(0, 10).map(item => item.customerId)
      .concat(namedIds.slice(0, 10).map(item => item.customerId));

    const props = PropertiesService.getScriptProperties();
    const config = getRemakeFactorConfig(props, {
      quickRefresh: true,
      pageSize: 25,
      maxPages: 1,
      maxDetailFetches: 0,
      fetchProductMap: false,
      fetchCustomerMap: true,
      chunkByMonth: false
    });
    const token = authenticateRemakeFactorApi(config);
    const fakeCaseRows = testIds.map(id => ({ customerID: id }));
    const customerMap = fetchRemakeFactorCustomerMap(config, token, fakeCaseRows);
    const stats = getRemakeFactorCustomerMapStats(customerMap);
    const entries = Object.keys(customerMap).map(id => customerMap[id]);

    const result = {
      ok: true,
      version: 'RemakeFactorCache v1.34',
      source: 'MagicTouch API customer lookup diagnostic only - no BigQuery lookup',
      timestamp: new Date().toISOString(),
      message: 'Compared cached named customers and cached ID-only customers against the MagicTouch customer API.',
      cachedDetailRows: detailRows.length,
      cachedNamedCustomerIds: namedIds.length,
      cachedMissingCustomerIds: missingIds.length,
      testedCustomerIds: testIds,
      namedCustomerSamplesFromCache: namedIds.slice(0, 10),
      missingCustomerSamplesFromCache: missingIds.slice(0, 10),
      customerMapSize: entries.length,
      customerMapStats: stats,
      apiCustomerSamples: entries.slice(0, 20),
      interpretation: buildRemakeFactorCustomerDebugInterpretation(fakeCaseRows, customerMap, stats)
    };
    return writeAndLogRemakeFactorDebugReport('debugRemakeFactorCachedCustomerNames', result);
  } catch (error) {
    const result = buildRemakeFactorErrorResponse('Cached customer-name diagnostic failed', error, { diagnostic: true });
    return writeAndLogRemakeFactorDebugReport('debugRemakeFactorCachedCustomerNames', result);
  }
}


function buildRemakeFactorCustomerDebugInterpretation(caseRows, customerMap, stats) {
  const mapStats = stats || {};
  const customerNamesFound = countRemakeFactorCustomerNames(customerMap || {});
  const uniqueIds = getRemakeFactorCustomerIdsFromCaseRows(caseRows || []).length;
  const notes = [];
  if (!caseRows || !caseRows.length) {
    notes.push('No case rows came back from the API sample. Check API credentials, date filter, query template, and endpoint availability.');
  }
  if (uniqueIds && !customerNamesFound) {
    notes.push('The API returned customer IDs, but no usable customer/practice names were found in QueryCases rows or Customers endpoint rows.');
  }
  if (customerNamesFound) {
    notes.push('Usable customer/practice names were found from the API path. Historical rebuild should be able to save labels if it completes.');
  }
  if (mapStats.apiEndpoint) {
    notes.push('Customers endpoint used: ' + mapStats.apiEndpoint);
  } else {
    notes.push('No Customers endpoint produced rows; fallback is QueryCases customer fields only.');
  }
  (mapStats.warnings || []).forEach(warning => notes.push(warning));
  return {
    customerNamesFound: customerNamesFound,
    uniqueCustomerIds: uniqueIds,
    likelyWorking: !!customerNamesFound,
    notes: notes
  };
}

function writeAndLogRemakeFactorDebugReport(functionName, result) {
  const report = Object.assign({}, result || {}, {
    debugFunction: functionName,
    debugGeneratedAt: new Date().toISOString()
  });

  let debugFile = null;
  try {
    debugFile = getRemakeFactorDebugFile(true);
    report.debugDriveFileId = debugFile.getId();
    report.debugDriveFileUrl = debugFile.getUrl();
  } catch (error) {
    report.debugDriveWriteSetupError = compactRemakeFactorError(error);
  }

  const text = JSON.stringify(report, null, 2);
  Logger.log(text);
  try {
    console.log(text);
  } catch (error) {
    // Apps Script console may not be available in older runtimes. Logger is enough.
  }

  if (debugFile) {
    try {
      debugFile.setContent(text);
      Logger.log('Remake Factor debug report saved to Drive file: ' + debugFile.getUrl());
    } catch (error) {
      report.debugDriveWriteError = compactRemakeFactorError(error);
      Logger.log('Could not write Remake Factor debug report to Drive: ' + report.debugDriveWriteError);
    }
  }

  return report;
}

function getRemakeFactorDebugFile(createIfMissing) {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(remakeFactorDebugFileIdProperty);

  if (existingId) {
    try {
      return DriveApp.getFileById(existingId);
    } catch (error) {
      props.deleteProperty(remakeFactorDebugFileIdProperty);
    }
  }

  if (!createIfMissing) return null;

  const file = DriveApp.createFile(remakeFactorDebugFileName, JSON.stringify({ ok: false, createdAt: new Date().toISOString() }, null, 2), MimeType.PLAIN_TEXT);
  props.setProperty(remakeFactorDebugFileIdProperty, file.getId());
  return file;
}



function hydrateRemakeFactorCustomerNamesFromApi() {
  try {
    const cached = readRemakeFactorCache();
    if (!cached || !cached.ok || !Array.isArray(cached.detailRows) || !cached.detailRows.length) {
      return {
        ok: false,
        version: 'RemakeFactorCache v1.34',
        message: 'No existing Remake Factor Drive cache found to hydrate. Run rebuildRemakeFactorHistoricalCache first, or click Rebuild Historical.'
      };
    }

    const props = PropertiesService.getScriptProperties();
    const config = getRemakeFactorConfig(props, {
      quickRefresh: true,
      pageSize: 25,
      maxPages: 1,
      maxDetailFetches: 0,
      fetchProductMap: false,
      fetchCustomerMap: true,
      chunkByMonth: false
    });
    const token = authenticateRemakeFactorApi(config);
    const fakeCaseRows = getRemakeFactorCustomerIdsFromDetailRows(cached.detailRows).map(id => ({ customerID: id }));
    const customerMap = fetchRemakeFactorCustomerMap(config, token, fakeCaseRows);
    const stats = getRemakeFactorCustomerMapStats(customerMap);

    let updatedRows = 0;
    let rowsWithDisplayName = 0;
    const hydratedRows = cached.detailRows.map(row => {
      const customerId = cleanRemakeFactorText(row.customerId || row.customerID || '');
      if (!customerId || !customerMap[customerId]) {
        const existingDisplay = cleanRemakeFactorText(row.customerDisplayName || row.customerName || row.practiceName || '');
        if (existingDisplay && existingDisplay !== customerId && !/^\d{3,}$/.test(existingDisplay)) rowsWithDisplayName++;
        return row;
      }
      const info = customerMap[customerId];
      const displayName = buildRemakeFactorCustomerDisplayName(info.customerName, info.practiceName, customerId, info.customerDisplayName);
      const existingDisplay = cleanRemakeFactorText(row.customerDisplayName || row.customerName || '');
      const next = Object.assign({}, row, {
        customerName: displayName,
        customerFullName: info.customerName || row.customerFullName || '',
        practiceName: info.practiceName || row.practiceName || '',
        customerPracticeName: info.practiceName || row.customerPracticeName || '',
        customerDisplayName: displayName,
        customerActive: info.customerActive !== false
      });
      if (displayName && displayName !== customerId && !/^\d{3,}$/.test(displayName)) rowsWithDisplayName++;
      if (displayName && displayName !== existingDisplay) updatedRows++;
      return next;
    });

    const payload = Object.assign({}, cached, {
      generatedAt: new Date().toISOString(),
      source: (cached.source || 'MagicTouch CRM API') + ' + API customer-name hydration',
      stats: Object.assign({}, cached.stats || {}, {
        version: 'RemakeFactorCache v1.34',
        customerHydrationFromApi: true,
        customerHydratedAt: new Date().toISOString(),
        customerHydrationUpdatedRows: updatedRows,
        customerHydrationRowsWithDisplayName: rowsWithDisplayName,
        customerMapStats: stats,
        warnings: [].concat((cached.stats && cached.stats.warnings) || [], stats.warnings || [])
      }),
      detailRows: hydratedRows
    });

    writeRemakeFactorCache(payload);
    const result = {
      ok: true,
      version: 'RemakeFactorCache v1.34',
      message: 'Existing Remake Factor Drive cache hydrated with customer names/practice names from MagicTouch/API.',
      generatedAt: payload.generatedAt,
      detailRows: hydratedRows.length,
      updatedRows: updatedRows,
      rowsWithDisplayName: rowsWithDisplayName,
      customerMapSize: Object.keys(customerMap).length,
      customerMapStats: stats,
      sampleCustomers: Object.keys(customerMap).slice(0, 20).map(id => customerMap[id])
    };
    writeAndLogRemakeFactorDebugReport('hydrateRemakeFactorCustomerNamesFromApi', result);
    return result;
  } catch (error) {
    const result = buildRemakeFactorErrorResponse('Customer API hydration failed', error, { hydrateCustomerNames: true });
    writeAndLogRemakeFactorDebugReport('hydrateRemakeFactorCustomerNamesFromApi', result);
    return result;
  }
}

function getRemakeFactorCustomerIdsFromDetailRows(detailRows) {
  const seen = {};
  const ids = [];
  (detailRows || []).forEach(row => {
    const id = cleanRemakeFactorText(row.customerId || row.customerID || '');
    if (!id || seen[id]) return;
    seen[id] = true;
    ids.push(id);
  });
  return ids;
}


function hasRemakeFactorFieldValue(obj, fieldName) {
  if (!obj || !Object.prototype.hasOwnProperty.call(obj, fieldName)) return false;
  const value = obj[fieldName];
  return !(value === null || value === undefined || String(value).trim() === '');
}

function getRemakeFactorCaseCreditDebitReason(caseRow) {
  return cleanRemakeFactorText(
    caseRow && (
      caseRow.creditDebitReason ||
      caseRow.Cases_CreditDebitReason ||
      caseRow.creditReason ||
      caseRow.debitReason ||
      ''
    )
  );
}

function getRemakeFactorCaseInvoiceDate(caseRow) {
  return cleanRemakeFactorText(caseRow && (caseRow.invoiceDate || caseRow.Cases_InvoiceDate || ''));
}

function getRemakeFactorCaseStatus(caseRow) {
  return String(caseRow && (caseRow.status || caseRow.Cases_Status || '') || '').trim().toLowerCase();
}

function getRemakeFactorCaseExclusionReason(caseRow) {
  if (!caseRow) return 'missing case';
  if (caseRow.deleted === true || caseRow.Deleted === true) return 'deleted';

  const invoiceDate = getRemakeFactorCaseInvoiceDate(caseRow);
  if (!invoiceDate) return 'missing invoiceDate';

  const month = getRemakeFactorMonth(invoiceDate);
  if (!month) return 'invalid invoiceDate';

  const status = getRemakeFactorCaseStatus(caseRow);
  if (status === 'estimate') return 'estimate';
  if (status === 'sent for try in' || status === 'sent for try-in') return 'sent for try in';

  if (isRemakeFactorTruthy(caseRow.isAdjustment) || isRemakeFactorTruthy(caseRow.Cases_IsAdjustment)) return 'adjustment';
  if (isRemakeFactorTruthy(caseRow.isDebitMemo) || isRemakeFactorTruthy(caseRow.Cases_IsDebitMemo)) return 'debit memo';
  if (isRemakeFactorTruthy(caseRow.isFC) || isRemakeFactorTruthy(caseRow.Cases_IsFC)) return 'finance charge';

  const creditDebitReason = getRemakeFactorCaseCreditDebitReason(caseRow);
  if (creditDebitReason) return 'credit/debit reason';

  return '';
}

function isRealRemakeFactorInvoicedChargeCase(caseRow) {
  return !getRemakeFactorCaseExclusionReason(caseRow);
}

function getRemakeFactorFirstProductField(line, fieldNames) {
  const value = line && typeof line === 'object' ? line : {};
  let blankMatch = null;
  for (let index = 0; index < fieldNames.length; index++) {
    const fieldName = fieldNames[index];
    if (!Object.prototype.hasOwnProperty.call(value, fieldName)) continue;
    if (value[fieldName] === null || value[fieldName] === undefined) continue;
    const match = { present: true, value: value[fieldName], fieldName: fieldName };
    if (String(value[fieldName]).trim() !== '') return match;
    if (!blankMatch) blankMatch = match;
  }
  return blankMatch || { present: false, value: '', fieldName: '' };
}

function parseRemakeFactorPercent(value) {
  const match = String(value === null || value === undefined ? '' : value).match(/(-?\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function getRemakeFactorProductLineFields(line) {
  const remakeField = getRemakeFactorFirstProductField(line, [
    'remake',
    'caseProductsRemake',
    'CaseProducts_Remake'
  ]);
  const reasonField = getRemakeFactorFirstProductField(line, [
    'remakeReason',
    'caseProductsRemakeReason',
    'CaseProducts_RemakeReason'
  ]);
  const discountRateField = getRemakeFactorFirstProductField(line, [
    'remakeDiscountRate',
    'caseProductsRemakeDiscountRate',
    'CaseProducts_RemakeDiscountRate'
  ]);
  const discountField = getRemakeFactorFirstProductField(line, [
    'remakeDiscount',
    'caseProductsRemakeDiscount',
    'CaseProducts_RemakeDiscount'
  ]);
  const remakeValue = cleanRemakeFactorText(remakeField.value);
  const isRemake = remakeField.present && isRemakeFactorTruthy(remakeField.value);

  return {
    remakeValue: remakeValue,
    remakePercent: parseRemakeFactorPercent(remakeValue),
    isRemake: isRemake,
    remakeReason: cleanRemakeFactorText(reasonField.value),
    remakeDiscountRate: Math.abs(toRemakeFactorNumber(discountRateField.value)),
    remakeDiscount: Math.abs(toRemakeFactorNumber(discountField.value)),
    remakeFieldPresent: remakeField.present,
    remakeDiscountRateFieldPresent: discountRateField.present,
    remakeDiscountFieldPresent: discountField.present
  };
}

function buildRemakeFactorDetailRows(caseRows, productMap, customerMap) {
  customerMap = customerMap || {};
  const detailRows = [];
  const seenLineKeys = {};

  caseRows.forEach(caseRow => {
    if (!shouldIncludeRemakeFactorCase(caseRow)) return;

    const caseId = String(caseRow.caseID || caseRow.caseId || caseRow.id || caseRow.caseNumber || '').trim();
    const caseNumber = caseRow.caseNumber || caseRow.caseNo || '';
    const invoiceDate = getRemakeFactorCaseInvoiceDate(caseRow);
    const month = getRemakeFactorMonth(invoiceDate);
    if (!month) return;
    const year = Number(month.slice(0, 4));
    const customerId = String(caseRow.customerID || caseRow.customerId || caseRow.Customers_CustomerID || '').trim();
    const customerInfo = customerId ? (customerMap[customerId] || {}) : {};
    const caseCustomerName = cleanRemakeFactorText(
      caseRow.customerName ||
      caseRow.customerFullName ||
      caseRow.customerDisplayName ||
      caseRow.Customers_CustomerFullName ||
      caseRow.customersCustomerFullName ||
      ''
    );
    const casePracticeName = cleanRemakeFactorText(
      caseRow.practiceName ||
      caseRow.customerPracticeName ||
      caseRow.Customers_PracticeName ||
      caseRow.customersPracticeName ||
      caseRow.practice ||
      caseRow.officeName ||
      ''
    );
    const mappedCustomerName = cleanRemakeFactorText(customerInfo.customerName || '');
    const mappedPracticeName = cleanRemakeFactorText(customerInfo.practiceName || '');
    const customerNameCandidate = mappedCustomerName || caseCustomerName;
    const practiceNameCandidate = mappedPracticeName || casePracticeName;
    const customerName = customerNameCandidate && customerNameCandidate !== customerId ? customerNameCandidate : '';
    const practiceName = practiceNameCandidate && practiceNameCandidate !== customerId ? practiceNameCandidate : '';
    const customerDisplayName = customerName || practiceName || customerId || 'Unknown customer';
    const customerActive = customerInfo.customerActive === false ? false : true;
    const creditDebitReason = getRemakeFactorCaseCreditDebitReason(caseRow);

    const products = Array.isArray(caseRow.caseProducts) && caseRow.caseProducts.length
      ? caseRow.caseProducts
      : [{
          id: caseId || caseNumber || 'case-level',
          caseID: caseId,
          productID: 'CASE',
          invoiceDescription: 'Case level',
          quantity: 0,
          totalCharge: caseRow.totalCharge,
          remake: '',
          remakeReason: '',
          remakeDiscountRate: 0,
          remakeDiscount: 0
        }];

    const lineInfos = products.map((line, index) => {
      const quantity = toRemakeFactorNumber(line.quantity || line.qty || 0);
      const totalCharge = toRemakeFactorNumber(line.totalCharge || line.extendedAmount || 0);
      const remakeFields = getRemakeFactorProductLineFields(line);
      return {
        index: index,
        line: line,
        quantity: quantity,
        totalCharge: totalCharge,
        lineRemake: remakeFields.isRemake,
        remakeFields: remakeFields
      };
    });

    products.forEach((line, index) => {
      const info = lineInfos[index];
      const productId = String(line.productID || line.productId || '').trim() || 'UNKNOWN';
      const productMeta = productMap[productId] || {};
      const lineId = String(line.id || line.caseProductID || line.caseProductId || caseId + '-' + index).trim();
      const lineKey = caseId + '|' + lineId + '|' + index;
      if (seenLineKeys[lineKey]) return;
      seenLineKeys[lineKey] = true;

      const quantity = info.quantity;
      const totalCharge = info.totalCharge;
      const lineRemake = info.lineRemake;
      const remakeFields = info.remakeFields;
      const remakeReason = remakeFields.remakeReason || 'Not specified';
      const remakeDiscount = lineRemake ? remakeFields.remakeDiscount : 0;
      const remakeDiscountSource = lineRemake
        ? (remakeFields.remakeDiscountFieldPresent ? 'productLine' : 'productLineMissing')
        : 'notRemake';
      const productName = cleanRemakeFactorText(productMeta.productName || productMeta.description || productMeta.invoiceDescription || line.invoiceDescription || line.description || line.productDescription || productId) || productId;
      const rawTaxDepartment = line.taxDepartment || line.taxDept || line.tax_department || '';
      const rawTaxGroup = line.taxGroup || line.tax_group || '';
      const lookupDepartment = normalizeRemakeFactorDepartment(productMeta.department || '');
      const lookupGroup = cleanRemakeFactorText(productMeta.group || '');
      const fallbackProductClass = inferRemakeFactorLegacyProductClass(productId, productName, line.productionLab || caseRow.productionLab || '');
      const fallbackGroup = cleanRemakeFactorText(fallbackProductClass.group || '');
      const rawGroup = lookupGroup || rawTaxGroup || line.productGroup || line.productsGroup || line.group || productMeta.category || line.taxCategory || fallbackGroup || '';
      const rawDepartment = lookupDepartment || rawTaxDepartment || line.productsDepartment || line.productDepartment || line.department || caseRow.productsDepartment || '';
      const normalizedTaxDepartment = normalizeRemakeFactorDepartment(rawTaxDepartment);
      const normalizedRawDepartment = normalizeRemakeFactorDepartment(rawDepartment);
      const inferredGroupDepartment = inferRemakeFactorDepartmentFromGroupOrCode(rawGroup);
      const inferredLegacyDepartment = normalizeRemakeFactorDepartment(fallbackProductClass.department || '');
      const inferredNameDepartment = inferRemakeFactorDepartmentFromProductName(productName);
      const department = lookupDepartment || normalizedTaxDepartment || normalizedRawDepartment || inferredGroupDepartment || inferredLegacyDepartment || inferredNameDepartment || 'Unassigned';
      const productGroup = normalizeRemakeFactorProductGroup(rawGroup, department);
      const departmentSource = lookupDepartment ? (productMeta.source || 'productLookupSheet') : (normalizedTaxDepartment ? 'taxDepartment' : (normalizedRawDepartment ? 'productOrLineDepartment' : (inferredGroupDepartment ? 'taxGroupOrGroupCode' : (inferredLegacyDepartment ? 'legacyProductIdOrNameFallback' : (inferredNameDepartment ? 'productName' : 'unassigned')))));
      const productGroupSource = lookupGroup ? (productMeta.source || 'productLookupSheet') : (cleanRemakeFactorText(rawTaxGroup) ? 'taxGroup' : (fallbackGroup ? 'legacyProductIdOrNameFallback' : 'productOrLineGroup'));

      detailRows.push({
        month: month,
        year: year,
        invoiceDate: invoiceDate,
        caseId: caseId || String(caseNumber || lineKey),
        caseNumber: caseNumber,
        customerId: customerId || 'Unknown customer',
        customerName: customerDisplayName,
        customerFullName: customerName,
        practiceName: practiceName,
        customerPracticeName: practiceName,
        customerDisplayName: customerDisplayName,
        customerActive: customerActive,
        department: department,
        productId: productId,
        productName: productName,
        productGroup: productGroup,
        taxDepartment: cleanRemakeFactorText(rawTaxDepartment),
        taxGroup: cleanRemakeFactorText(rawTaxGroup),
        departmentSource: departmentSource,
        productGroupSource: productGroupSource,
        lineId: lineId,
        quantity: quantity,
        totalCharge: totalCharge,
        chargeAmount: totalCharge,
        creditAmount: 0,
        netAmount: totalCharge,
        creditDebitReason: creditDebitReason,
        salesLogicClass: 'charge',
        isRealInvoicedCharge: true,
        isRemake: lineRemake,
        remakeFlag: lineRemake ? 'Y' : '',
        remakeValue: remakeFields.remakeValue,
        remakePercent: remakeFields.remakePercent,
        remakeFieldPresent: remakeFields.remakeFieldPresent,
        remakeReason: lineRemake ? remakeReason : 'Not a remake',
        remakeUnits: lineRemake ? quantity : 0,
        remakeDiscountRate: lineRemake ? remakeFields.remakeDiscountRate : 0,
        remakeDiscountRateFieldPresent: remakeFields.remakeDiscountRateFieldPresent,
        remakeDiscount: lineRemake ? remakeDiscount : 0,
        remakeDiscountFieldPresent: remakeFields.remakeDiscountFieldPresent,
        remakeDiscountSource: remakeDiscountSource,
        remakeClassificationSource: caseRow.usedCaseLevelFallback ? 'missingProductDetail' : 'productLine',
        isFallbackLine: !!caseRow.usedCaseLevelFallback
      });
    });
  });

  return detailRows;
}

function normalizeRemakeFactorDepartment(value) {
  const cleaned = cleanRemakeFactorText(value);
  const lowered = String(cleaned || '').toLowerCase();
  // These are lab/location names, not product departments. Leaving them in the
  // department field made the Remake tab show Pacifica/San Ramon/DeAnza/CADA
  // instead of product departments. Product metadata or the frontend Overview
  // product map should supply the real department when available.
  if (!cleaned) return '';
  if (lowered === 'pacifica' || lowered === 'san ramon' || lowered === 'deanza' || lowered === 'de anza' || lowered === 'cada' || lowered === 'cad' || lowered === 'case level' || lowered === 'unassigned' || lowered === 'unknown' || lowered === 'not specified') return '';
  return cleaned;
}

function inferRemakeFactorDepartmentFromProductName(productName) {
  const cleaned = cleanRemakeFactorText(productName);
  const first = cleanRemakeFactorText(String(cleaned || '').split(' - ')[0]);
  const lowered = String(cleaned || '').toLowerCase();
  const allowed = {
    Fixed: true,
    Implant: true,
    Alloy: true,
    Removable: true,
    Nightguard: true,
    'Advanced Prosthetics': true,
    'Denture Services': true,
    Services: true,
    Shipping: true,
    'CDA Connect': true
  };
  if (allowed[first]) return first;
  if (first === 'REM') return 'Removable';
  if (first === 'NG') return 'Nightguard';
  if (first === 'AP') return 'Advanced Prosthetics';
  if (lowered.indexOf('brux') >= 0 || lowered.indexOf('nightguard') >= 0 || lowered.indexOf('night guard') >= 0) return 'Nightguard';
  return '';
}

function inferRemakeFactorLegacyProductClass(productId, productName, productionLab) {
  const id = cleanRemakeFactorProductId(productId);
  const name = cleanRemakeFactorText(productName);
  const loweredName = String(name || '').toLowerCase();
  const lab = String(productionLab || '').toLowerCase();

  const overrides = {
    ITAP2TA: { department: 'Advanced Prosthetics', group: 'AP Components' },
    IPAP2TS: { department: 'Advanced Prosthetics', group: 'AP Components' },
    SAPRELSD: { department: 'Advanced Prosthetics', group: 'AP Reline' },
    SR13: { department: 'Removable', group: 'Repair' },
    TEETHR17PHAC: { department: 'Removable', group: 'Denture Teeth' },
    TEETHR18PHPC: { department: 'Removable', group: 'Denture Teeth' },
    VANGS88: { department: 'Nightguard', group: 'Veteran Affairs' }
  };
  if (overrides[id]) return overrides[id];

  if (id.indexOf('CDACONNECT') === 0 || loweredName.indexOf('cda connect') === 0) return { department: 'CDA Connect', group: 'CDA Connect' };
  if (id.indexOf('ITAP') === 0 || id.indexOf('IPAP') === 0 || id.indexOf('SAP') === 0 || id.indexOf('HDAP') === 0 || id.indexOf('AP') === 0 || loweredName.indexOf('ap -') === 0 || loweredName.indexOf('ap-') === 0 || loweredName.indexOf('ap ') === 0 || lab === 'deanza' || lab === 'de anza') return { department: 'Advanced Prosthetics', group: inferRemakeFactorLegacyGroupFromName(name, 'Advanced Prosthetics') };
  if (id.indexOf('TEETHR') === 0) return { department: 'Removable', group: 'Denture Teeth' };
  if (id.indexOf('NG') === 0 || loweredName.indexOf('brux') >= 0 || loweredName.indexOf('nightguard') >= 0 || loweredName.indexOf('night guard') >= 0) return { department: 'Nightguard', group: id.indexOf('VA') === 0 ? 'Veteran Affairs' : 'Nightguard' };
  if (id.indexOf('VA') === 0) return { department: 'Removable', group: 'Veteran Affairs' };
  if (id.indexOf('REM') === 0 || id.indexOf('RPD') === 0 || id.indexOf('STAY') === 0 || loweredName.indexOf('rem -') === 0 || loweredName.indexOf('denture') >= 0 || loweredName.indexOf('partial') >= 0 || loweredName.indexOf('flipper') >= 0 || loweredName.indexOf('reline removable') >= 0 || loweredName.indexOf('repair fracture') >= 0 || loweredName.indexOf('wire mesh') >= 0 || loweredName.indexOf('locator housing') >= 0) return { department: 'Removable', group: inferRemakeFactorLegacyGroupFromName(name, 'Removable') };

  return { department: '', group: '' };
}

function inferRemakeFactorLegacyGroupFromName(productName, fallbackDepartment) {
  const name = cleanRemakeFactorText(productName);
  const lowered = String(name || '').toLowerCase();
  if (!name) return cleanRemakeFactorText(fallbackDepartment || '');
  if (lowered.indexOf('denture teeth') >= 0 || lowered.indexOf('ivoclar') >= 0 || lowered.indexOf('dentsply') >= 0 || lowered.indexOf('tooth') >= 0 || lowered.indexOf('teeth') >= 0) return 'Denture Teeth';
  if (lowered.indexOf('rpd') >= 0) return 'RPD';
  if (lowered.indexOf('stayplate') >= 0 || lowered.indexOf('flipper') >= 0) return 'Stayplate';
  if (lowered.indexOf('repair') >= 0 || lowered.indexOf('reset') >= 0 || lowered.indexOf('reline') >= 0) return 'Repair';
  if (lowered.indexOf('brux') >= 0 || lowered.indexOf('nightguard') >= 0 || lowered.indexOf('night guard') >= 0) return 'Nightguard';
  if (lowered.indexOf('titanium') >= 0 || lowered.indexOf('abutment') >= 0 || lowered.indexOf('screw') >= 0 || lowered.indexOf('salvin') >= 0) return 'AP Components';
  if (lowered.indexOf('ap - reline') >= 0 || lowered.indexOf('ap- reline') >= 0) return 'AP Reline';
  return cleanRemakeFactorText(fallbackDepartment || '');
}

function inferRemakeFactorDepartmentFromGroupOrCode(value) {
  const cleaned = cleanRemakeFactorText(value);
  const lowered = String(cleaned || '').toLowerCase();
  if (!cleaned) return '';
  if (lowered === 'fixed' || lowered.indexOf('fixed') === 0) return 'Fixed';
  if (lowered === 'implant' || lowered.indexOf('implant') === 0) return 'Implant';
  if (lowered === 'alloy' || lowered.indexOf('alloy') === 0) return 'Alloy';
  if (lowered === 'rem' || lowered === 'removable' || lowered.indexOf('removable') === 0) return 'Removable';
  if (lowered === 'ng' || lowered === 'nightguard' || lowered === 'night guard' || lowered.indexOf('nightguard') === 0 || lowered.indexOf('night guard') === 0) return 'Nightguard';
  if (lowered === 'ap' || lowered.indexOf('ap-') === 0 || lowered.indexOf('advanced prosthetics') === 0) return 'Advanced Prosthetics';
  if (lowered.indexOf('denture') === 0) return 'Denture Services';
  if (lowered === 'shipping' || lowered.indexOf('ship') === 0) return 'Shipping';
  if (lowered === 'cda connect' || lowered.indexOf('cda connect') === 0) return 'CDA Connect';
  if (lowered === 'services' || lowered.indexOf('service') === 0) return 'Services';
  return '';
}

function normalizeRemakeFactorProductGroup(value, fallbackDepartment) {
  const cleaned = cleanRemakeFactorText(value);
  const lowered = String(cleaned || '').toLowerCase();
  if (!cleaned || lowered === 'unassigned' || lowered === 'unknown' || lowered === 'not specified' || lowered === 'case level') return cleanRemakeFactorText(fallbackDepartment || '') || 'Unassigned';
  return cleaned;
}

function isLikelyRemakeFactorCaseHeader(caseRow) {
  if (!caseRow) return false;
  if (isRemakeFactorTruthy(caseRow.remake)) return true;
  if (cleanRemakeFactorText(caseRow.remakeReason)) return true;
  if (toRemakeFactorNumber(caseRow.remakeDiscount || 0) !== 0) return true;
  if (toRemakeFactorNumber(caseRow.remakeDiscountRate || 0) !== 0) return true;
  return false;
}

function normalizeRemakeFactorDetailStrategy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'all') return 'all';
  if (normalized === 'none') return 'none';
  return 'remakesOnly';
}

function getRemakeFactorRecommendedScriptProperties() {
  return {
    required: [
      'MT_CRM_API_BASE_URL',
      'MT_CRM_API_USERID',
      'MT_CRM_API_PASSWORD'
    ],
    recommendedForFastDashboard: {
      MT_REMAKE_DETAIL_STRATEGY: 'remakesOnly',
      MT_REMAKE_MAX_DETAIL_FETCHES: '800',
      MT_REMAKE_LOOKBACK_MONTHS: '24',
      MT_REMAKE_ADDITIONAL_FIELDS: 'caseProducts',
      MT_REMAKE_FETCH_PRODUCT_MAP: 'false',
      MT_REMAKE_USE_PRODUCT_LOOKUP: 'true',
      MT_REMAKE_PRODUCT_LOOKUP_SOURCE_URL: remakeFactorDefaultProductLookupCsvFileUrl,
      MT_REMAKE_PRODUCT_LOOKUP_CSV_FILE_URL: remakeFactorDefaultProductLookupCsvFileUrl,
      MT_REMAKE_PRODUCT_LOOKUP_SHEET_URL: remakeFactorDefaultProductLookupSheetUrl,
      MT_REMAKE_PRODUCT_LOOKUP_SHEET_NAME: remakeFactorDefaultProductLookupSheetName,
      MT_REMAKE_CHUNK_BY_MONTH: 'true',
      MT_REMAKE_MAX_PAGES_PER_CHUNK: '80'
    },
    recommendedForFullScheduledRefresh: {
      MT_REMAKE_DETAIL_STRATEGY: 'all',
      MT_REMAKE_MAX_DETAIL_FETCHES: '3000',
      MT_REMAKE_LOOKBACK_MONTHS: '24',
      note: 'Only use full mode for scheduled refreshes or narrower date ranges because every case may require a detail API call.'
    }
  };
}

function shouldIncludeRemakeFactorCase(caseRow) {
  // Remake Factor denominator follows Summer's real invoiced charge-side logic:
  // require invoiceDate, exclude Estimates, Sent for Try In / Sent for Try-In,
  // adjustments, debit memos, finance charges, deleted records, and credit/debit
  // reason rows. Credits are not
  // counted as production invoice cases for the remake denominator.
  return isRealRemakeFactorInvoicedChargeCase(caseRow);
}

function buildRemakeFactorCaseQuery(config) {
  const template = String(config.queryTemplate || '').trim();
  if (!template) return '';

  const bounds = getRemakeFactorQueryDateBounds(config);
  return template
    .replace(/\{queryStartDate\}/g, bounds.queryStartDate)
    .replace(/\{queryEndDate\}/g, bounds.queryEndDate)
    .replace(/\{queryEndExclusiveDate\}/g, bounds.queryEndExclusiveDate)
    .replace(/\{queryStartDateTime\}/g, bounds.queryStartDate + 'T00:00:00')
    .replace(/\{queryEndDateTime\}/g, bounds.queryEndDate + 'T23:59:59')
    .replace(/\{queryEndExclusiveDateTime\}/g, bounds.queryEndExclusiveDate + 'T00:00:00')
    .replace(/\{startDate\}/g, bounds.queryStartDate)
    .replace(/\{endDate\}/g, bounds.queryEndDate)
    .replace(/\{startDateTime\}/g, bounds.queryStartDate + 'T00:00:00')
    .replace(/\{endDateTime\}/g, bounds.queryEndDate + 'T23:59:59');
}

function normalizeRemakeFactorCaseQueryTemplate(template) {
  const value = String(template || '').trim();
  if (!value) return '';

  // v1.30: normalize the old saved default too. Some Apps Script projects have
  // MT_REMAKE_CASE_QUERY_TEMPLATE persisted as <= {endDate}; with datetime API
  // comparisons that excludes records later on the last day of the month.
  const compact = value.replace(/\s+/g, ' ');
  const legacyDefaultPattern = /invoiceDate\s*>=\s*"?\{startDate\}"?\s*&&\s*invoiceDate\s*<=\s*"?\{endDate\}"?/i;
  if (legacyDefaultPattern.test(compact)) {
    return 'invoiceDate >= "{queryStartDate}" && invoiceDate < "{queryEndExclusiveDate}"';
  }

  return value;
}

function getRemakeFactorQueryDateBounds(config) {
  const startDate = normalizeRemakeFactorDate(config && config.startDate);
  const endDate = normalizeRemakeFactorDate(config && config.endDate);
  const overlapDays = Math.max(0, Number(config && config.pullOverlapDays || 0));

  if (!startDate || !endDate) {
    return {
      queryStartDate: startDate || '',
      queryEndDate: endDate || '',
      queryEndExclusiveDate: endDate || ''
    };
  }

  return {
    queryStartDate: addRemakeFactorDays(startDate, -overlapDays),
    queryEndDate: addRemakeFactorDays(endDate, overlapDays),
    queryEndExclusiveDate: addRemakeFactorDays(endDate, 1 + overlapDays)
  };
}

function filterRemakeFactorCasesToRequestedInvoiceDateRange(caseRows, config) {
  const rows = Array.isArray(caseRows) ? caseRows : [];
  const startDate = normalizeRemakeFactorDate(config && config.startDate);
  const endDate = normalizeRemakeFactorDate(config && config.endDate);
  if (!startDate || !endDate) return rows;

  return rows.filter(row => {
    const invoiceDate = normalizeRemakeFactorDate(getRemakeFactorCaseInvoiceDate(row));
    if (!invoiceDate) return false;
    return invoiceDate >= startDate && invoiceDate <= endDate;
  });
}

function addRemakeFactorDays(dateValue, days) {
  const normalized = normalizeRemakeFactorDate(dateValue);
  if (!normalized) return '';
  const parts = normalized.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2] + Number(days || 0));
  return formatRemakeFactorDate(date);
}

function remakeFactorFetchJson(url, params) {
  const response = UrlFetchApp.fetch(url, params || {});
  const code = response.getResponseCode();
  const text = response.getContentText() || '';
  let body = text;

  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    body = text;
  }

  if (code < 200 || code >= 300) {
    throw new Error('MagicTouch API request failed: HTTP ' + code + ' for ' + url + '. Response: ' + text.slice(0, 500));
  }

  return { code: code, body: body, text: text };
}

function extractRemakeFactorToken(body) {
  if (!body) return '';
  if (typeof body === 'string') {
    const trimmed = body.trim().replace(/^"|"$/g, '');
    if (trimmed && trimmed.split('.').length >= 2) return trimmed;
    return trimmed;
  }

  const candidates = [
    body.token,
    body.accessToken,
    body.access_token,
    body.jwt,
    body.jwtToken,
    body.bearerToken,
    body.value,
    body.result && body.result.token,
    body.data && body.data.token
  ];

  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i]) return String(candidates[i]).replace(/^Bearer\s+/i, '').trim();
  }
  return '';
}

function extractRemakeFactorRows(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  const candidates = [
    body.items,
    body.data,
    body.rows,
    body.results,
    body.value,
    body.result,
    body.records,
    body.customers,
    body.customerRows,
    body.entities
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (Array.isArray(candidates[i])) return candidates[i];
  }
  if (body.data && Array.isArray(body.data.items)) return body.data.items;
  if (body.data && Array.isArray(body.data.rows)) return body.data.rows;
  if (body.data && Array.isArray(body.data.customers)) return body.data.customers;
  if (body.result && Array.isArray(body.result.items)) return body.result.items;
  if (body.result && Array.isArray(body.result.rows)) return body.result.rows;
  if (body.result && Array.isArray(body.result.customers)) return body.result.customers;
  return [];
}

function readRemakeFactorCache() {
  const file = getRemakeFactorCacheFile(false);
  if (!file) return null;
  try {
    const text = file.getBlob().getDataAsString('UTF-8');
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return {
      ok: false,
      message: 'Remake Factor cache exists but could not be parsed: ' + (error && error.message ? error.message : String(error)),
      detailRows: []
    };
  }
}

function writeRemakeFactorCache(payload) {
  const file = getRemakeFactorCacheFile(true);
  const compactPayload = compactRemakeFactorPayloadForStorage(payload);
  file.setContent(JSON.stringify(compactPayload));
}

function compactRemakeFactorPayloadForStorage(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  const copy = Object.assign({}, payload);
  copy.stats = compactRemakeFactorStatsForStorage(copy.stats || {});

  if (Array.isArray(copy.detailRows)) {
    copy.detailRows = copy.detailRows.map(compactRemakeFactorDetailRowForStorage);
  }

  return copy;
}

function compactRemakeFactorStatsForStorage(stats) {
  const copy = Object.assign({}, stats || {});

  if (copy.customerMapStats && typeof copy.customerMapStats === 'object') {
    const cms = Object.assign({}, copy.customerMapStats);
    delete cms.apiAttempts;
    delete cms.rawCustomerSamples;
    delete cms.rawCustomers;
    delete cms.rawRows;
    delete cms.detailRows;
    copy.customerMapStats = cms;
  }

  delete copy.apiAttempts;
  delete copy.rawCustomerSamples;
  delete copy.rawCustomers;
  delete copy.rawRows;
  delete copy.caseRows;
  delete copy.productRows;
  delete copy.customerRows;

  return copy;
}

function compactRemakeFactorDetailRowForStorage(row) {
  if (!row || typeof row !== 'object') return row;
  const copy = Object.assign({}, row);

  // These raw/debug fields are useful during diagnostics but make the shared
  // Drive JSON too large for normal Apps Script reads. Keep dashboard fields only.
  delete copy.rawCase;
  delete copy.rawCaseProduct;
  delete copy.rawCustomer;
  delete copy.rawProduct;
  delete copy.debug;
  delete copy.apiResponse;

  return copy;
}

function getRemakeFactorCacheFile(createIfMissing) {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(remakeFactorCacheFileIdProperty);

  if (existingId) {
    try {
      return DriveApp.getFileById(existingId);
    } catch (error) {
      props.deleteProperty(remakeFactorCacheFileIdProperty);
    }
  }

  if (!createIfMissing) return null;

  const file = DriveApp.createFile(remakeFactorCacheFileName, JSON.stringify({ ok: false, detailRows: [] }), MimeType.PLAIN_TEXT);
  props.setProperty(remakeFactorCacheFileIdProperty, file.getId());
  return file;
}

function toRemakeFactorQueryString(params) {
  return Object.keys(params || {})
    .filter(key => params[key] !== null && params[key] !== undefined && String(params[key]) !== '')
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key])))
    .join('&');
}

function isRemakeFactorTruthy(value) {
  const normalized = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  if (!normalized) return false;
  if (['n', 'no', 'false', '0', 'none', 'not a remake'].includes(normalized)) return false;
  return ['y', 'yes', 'true', '1', 'r', 'remake'].includes(normalized) || normalized.length > 0;
}

function toRemakeFactorNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function cleanRemakeFactorText(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function getRemakeFactorMonth(value) {
  if (!value) return '';
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})/);
  if (match) return match[1] + '-' + match[2];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}


function buildRemakeFactorErrorResponse(prefix, error, requestedOptions) {
  const message = prefix + ': ' + compactRemakeFactorError(error);
  return {
    ok: false,
    message: message,
    generatedAt: '',
    detailRows: [],
    stats: Object.assign(getRemakeFactorSafeHealthSummary(), {
      error: message,
      requestedOptions: sanitizeRemakeFactorOptions(requestedOptions || {})
    })
  };
}

function compactRemakeFactorError(error) {
  const text = error && error.message ? error.message : String(error || 'Unknown error');
  return text.replace(/password=[^&\s]+/ig, 'password=[hidden]').slice(0, 900);
}

function sanitizeRemakeFactorOptions(options) {
  const cleaned = {};
  Object.keys(options || {}).forEach(key => {
    if (String(key).toLowerCase().indexOf('password') >= 0) return;
    cleaned[key] = options[key];
  });
  return cleaned;
}

function getRemakeFactorSafeHealthSummary() {
  try {
    const props = PropertiesService.getScriptProperties();
    return {
      version: 'RemakeFactorCache v1.34',
      hasBaseUrl: !!props.getProperty(remakeFactorApiBaseUrlProperty),
      baseUrlHost: maskRemakeFactorBaseUrl(props.getProperty(remakeFactorApiBaseUrlProperty) || remakeFactorDefaultBaseUrl),
      hasUserId: !!props.getProperty(remakeFactorApiUserIdProperty),
      hasPassword: !!props.getProperty(remakeFactorApiPasswordProperty),
      cacheFileId: props.getProperty(remakeFactorCacheFileIdProperty) || ''
    };
  } catch (error) {
    return { version: 'RemakeFactorCache v1.34', healthError: compactRemakeFactorError(error) };
  }
}

function maskRemakeFactorBaseUrl(value) {
  try {
    const match = String(value || '').match(/^https?:\/\/([^\/]+)/i);
    return match ? match[1] : String(value || '').slice(0, 80);
  } catch (error) {
    return '';
  }
}

function parseRemakeFactorBoolean(value, defaultValue) {
  if (value === true || value === false) return value;
  const normalized = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  if (!normalized) return !!defaultValue;
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return !!defaultValue;
}

function getRemakeFactorMonthChunks(startDate, endDate) {
  const start = normalizeRemakeFactorDate(startDate);
  const end = normalizeRemakeFactorDate(endDate);
  if (!start || !end) return [{ startDate: startDate, endDate: endDate }];

  const startParts = start.split('-').map(Number);
  const endParts = end.split('-').map(Number);
  let cursor = new Date(startParts[0], startParts[1] - 1, 1);
  const endMonth = new Date(endParts[0], endParts[1] - 1, 1);
  const chunks = [];

  while (cursor.getTime() <= endMonth.getTime() && chunks.length < 60) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const chunkStart = y === startParts[0] && m === startParts[1] - 1 ? start : formatRemakeFactorDate(new Date(y, m, 1));
    const lastDay = new Date(y, m + 1, 0);
    let chunkEnd = formatRemakeFactorDate(lastDay);
    if (y === endParts[0] && m === endParts[1] - 1) chunkEnd = end;
    chunks.push({ startDate: chunkStart, endDate: chunkEnd });
    cursor = new Date(y, m + 1, 1);
  }

  return chunks;
}

function normalizeRemakeFactorDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[1] + '-' + match[2] + '-' + match[3];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatRemakeFactorDate(date);
}

function formatRemakeFactorDate(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}


/**
 * v1.10 incremental/open-month refresh override.
 *
 * Dashboard button refreshes should not refetch every historical month each time.
 * Closed historical months are preserved from remake_factor_cache.json. The web
 * refresh fetches only the current open month by default, then merges those
 * refreshed rows back into the existing cache.
 */
const remakeFactorOpenRefreshMonthsPropertyV150 = 'MT_REMAKE_OPEN_REFRESH_MONTHS';

function getRemakeFactorData(options) {
  const requestedOptions = options || {};

  if (requestedOptions.forceRefresh) {
    try {
      const refreshOptions = Object.assign({}, requestedOptions);

      // v1.11: full historical rebuild is an explicit path used when the saved
      // historical cache needs to be corrected, for example after customer-name
      // enrichment changes. This does NOT preserve historical rows; it rebuilds
      // the requested historical window and rewrites remake_factor_cache.json.
      if (refreshOptions.fullRefresh || refreshOptions.historicalRebuild) {
        refreshOptions.fullRefresh = true;
        refreshOptions.historicalRebuild = !!refreshOptions.historicalRebuild;
        refreshOptions.incrementalRefresh = false;
        refreshOptions.quickRefresh = false;
        if (!refreshOptions.lookbackMonths) refreshOptions.lookbackMonths = Number(PropertiesService.getScriptProperties().getProperty(remakeFactorLookbackMonthsProperty) || 36);
        if (!refreshOptions.pageSize) refreshOptions.pageSize = 250;
        if (!refreshOptions.maxPages) refreshOptions.maxPages = 240;
        if (!refreshOptions.maxPagesPerChunk) refreshOptions.maxPagesPerChunk = 90;
        if (!refreshOptions.maxDetailFetches) refreshOptions.maxDetailFetches = 900;
        if (refreshOptions.fetchProductMap === undefined) refreshOptions.fetchProductMap = true;
        if (refreshOptions.fetchCustomerMap === undefined) refreshOptions.fetchCustomerMap = true;
        if (refreshOptions.chunkByMonth === undefined) refreshOptions.chunkByMonth = true;
        const rebuilt = refreshRemakeFactorCache(refreshOptions);
        rebuilt.stats = Object.assign({}, rebuilt.stats || {}, {
          version: 'RemakeFactorCache v1.34',
          historicalRebuild: true,
          incrementalRefresh: false,
          warnings: [].concat((rebuilt.stats && rebuilt.stats.warnings) || [], [
            'Full historical rebuild completed. Existing closed-month rows were replaced, not preserved.'
          ])
        });
        writeRemakeFactorCache(rebuilt);
        return rebuilt;
      }

      if (refreshOptions.quickRefresh !== false && !refreshOptions.fullRefresh) {
        refreshOptions.quickRefresh = true;
        refreshOptions.incrementalRefresh = refreshOptions.incrementalRefresh !== false;
        if (!refreshOptions.lookbackMonths) refreshOptions.lookbackMonths = 12;
        if (!refreshOptions.pageSize) refreshOptions.pageSize = 120;
        if (!refreshOptions.maxPages) refreshOptions.maxPages = 50;
        if (!refreshOptions.maxPagesPerChunk) refreshOptions.maxPagesPerChunk = 50;
        if (!refreshOptions.maxDetailFetches) refreshOptions.maxDetailFetches = 160;
        if (refreshOptions.fetchProductMap === undefined) refreshOptions.fetchProductMap = true;
        if (refreshOptions.fetchCustomerMap === undefined) refreshOptions.fetchCustomerMap = true;
        if (refreshOptions.chunkByMonth === undefined) refreshOptions.chunkByMonth = true;
      }

      if (refreshOptions.incrementalRefresh && !refreshOptions.fullRefresh) {
        return refreshRemakeFactorOpenMonthsCacheV150(refreshOptions);
      }

      return refreshRemakeFactorCache(refreshOptions);
    } catch (error) {
      return buildRemakeFactorErrorResponse('Remake Factor API refresh failed', error, requestedOptions);
    }
  }

  try {
    const cached = readRemakeFactorCache();
    if (cached && cached.ok) return cached;
    if (cached && cached.message) return cached;
  } catch (error) {
    return buildRemakeFactorErrorResponse('Remake Factor cache read failed', error, requestedOptions);
  }

  return {
    ok: false,
    message: 'No Remake Factor cache exists yet. Click Refresh Cache. If it returns here again, run debugRemakeFactorCacheHealth() from Apps Script.',
    generatedAt: '',
    detailRows: [],
    stats: getRemakeFactorSafeHealthSummary()
  };
}

function refreshRemakeFactorOpenMonthsCacheV150(options) {
  const requestedOptions = options || {};
  const props = PropertiesService.getScriptProperties();
  const existing = readRemakeFactorCache();

  // If there is no existing cache, the first web refresh still needs a usable
  // baseline. Build the requested 12-month cache once, then later clicks will be
  // incremental.
  if (!existing || !existing.ok || !Array.isArray(existing.detailRows) || !existing.detailRows.length) {
    const firstBuildOptions = Object.assign({}, requestedOptions, {
      incrementalRefresh: false,
      lookbackMonths: Number(requestedOptions.lookbackMonths || props.getProperty(remakeFactorLookbackMonthsProperty) || 12),
      chunkByMonth: true
    });
    const first = refreshRemakeFactorCache(firstBuildOptions);
    first.stats = Object.assign({}, first.stats || {}, {
      incrementalRefresh: false,
      incrementalReason: 'No existing cache was available, so a baseline cache was created.'
    });
    writeRemakeFactorCache(first);
    return first;
  }

  const openMonths = Math.max(1, Number(requestedOptions.openRefreshMonths || props.getProperty(remakeFactorOpenRefreshMonthsPropertyV150) || 1));
  const today = new Date();
  const openStart = new Date(today.getFullYear(), today.getMonth() - openMonths + 1, 1);
  const openStartDate = formatRemakeFactorDate(openStart);
  const openEndDate = formatRemakeFactorDate(today);
  const openMonthKeys = getRemakeFactorMonthChunks(openStartDate, openEndDate).map(chunk => chunk.startDate.slice(0, 7));
  const openMonthSet = {};
  openMonthKeys.forEach(key => { openMonthSet[key] = true; });

  const refreshOptions = Object.assign({}, requestedOptions, {
    incrementalRefresh: false,
    startDate: openStartDate,
    endDate: openEndDate,
    lookbackMonths: openMonths,
    chunkByMonth: true,
    pageSize: Math.max(50, Number(requestedOptions.pageSize || props.getProperty(remakeFactorPageSizeProperty) || 120)),
    maxPages: Math.max(1, Number(requestedOptions.maxPages || props.getProperty(remakeFactorMaxPagesProperty) || 50)),
    maxPagesPerChunk: Math.max(1, Number(requestedOptions.maxPagesPerChunk || props.getProperty(remakeFactorMaxPagesPerChunkProperty) || 50)),
    maxDetailFetches: Math.max(0, Number(requestedOptions.maxDetailFetches || props.getProperty(remakeFactorMaxDetailFetchesProperty) || 160)),
    fetchProductMap: requestedOptions.fetchProductMap === undefined ? true : requestedOptions.fetchProductMap
  });

  const freshOpen = refreshRemakeFactorCache(refreshOptions);
  if (!freshOpen || !freshOpen.ok) return freshOpen;

  const historicalRows = (existing.detailRows || []).filter(row => !openMonthSet[String(row.month || '').slice(0, 7)]);
  const freshRows = Array.isArray(freshOpen.detailRows) ? freshOpen.detailRows : [];
  const mergedRows = historicalRows.concat(freshRows);

  const historicalRange = existing.dateRange || {};
  const mergedStart = historicalRange.startDate || existing.startDate || '';
  const merged = {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'MagicTouch CRM API + preserved closed-month cache',
    dateRange: {
      startDate: mergedStart || openStartDate,
      endDate: openEndDate,
      lookbackMonths: historicalRange.lookbackMonths || requestedOptions.lookbackMonths || '',
      incrementalOpenStartDate: openStartDate,
      incrementalOpenEndDate: openEndDate,
      refreshedMonths: openMonthKeys
    },
    stats: Object.assign({}, freshOpen.stats || {}, {
      version: 'RemakeFactorCache v1.34',
      incrementalRefresh: true,
      openRefreshMonths: openMonths,
      refreshedMonths: openMonthKeys,
      preservedHistoricalRows: historicalRows.length,
      freshOpenRows: freshRows.length,
      mergedRows: mergedRows.length,
      previousCacheGeneratedAt: existing.generatedAt || '',
      warnings: [].concat((freshOpen.stats && freshOpen.stats.warnings) || [], [
        'Incremental refresh preserved closed historical months and replaced only: ' + openMonthKeys.join(', ')
      ])
    }),
    detailRows: mergedRows
  };

  writeRemakeFactorCache(merged);
  return merged;
}

function debugRemakeFactorCacheHealthV150() {
  const health = debugRemakeFactorCacheHealth();
  health.version = 'RemakeFactorCache v1.33.1';
  health.openRefreshMonths = PropertiesService.getScriptProperties().getProperty(remakeFactorOpenRefreshMonthsPropertyV150) || '1';
  return health;
}


/**
 * v1.7.0 trigger/status override.
 * Keeps the Remake Factor backend file as the cache owner. The web UI browser
 * cache lives in Index.html, but the saved Drive/API cache remains here.
 */

function logRemakeFactorRunSummary(functionName, result) {
  try {
    const summary = {
      ok: !!(result && result.ok),
      version: 'RemakeFactorCache v1.34',
      message: result && result.message ? result.message : '',
      generatedAt: result && result.generatedAt ? result.generatedAt : new Date().toISOString(),
      source: result && result.source ? result.source : '',
      detailRows: result && Array.isArray(result.detailRows) ? result.detailRows.length : 0,
      dateRange: result && result.dateRange ? result.dateRange : {},
      stats: result && result.stats ? result.stats : {},
      sampleRows: result && Array.isArray(result.detailRows) ? result.detailRows.slice(0, 10).map(row => ({
        month: row.month || '',
        customerId: row.customerId || '',
        customerName: row.customerName || '',
        customerFullName: row.customerFullName || '',
        practiceName: row.practiceName || '',
        productName: row.productName || '',
        department: row.department || '',
        isRemake: row.isRemake === true,
        remakeReason: row.remakeReason || ''
      })) : []
    };
    writeAndLogRemakeFactorDebugReport(functionName, summary);
  } catch (error) {
    Logger.log('Unable to write Remake Factor run summary: ' + compactRemakeFactorError(error));
  }
}

function refreshRemakeFactorDailyCache() {
  return getRemakeFactorData({
    forceRefresh: true,
    quickRefresh: true,
    incrementalRefresh: true,
    openRefreshMonths: 1,
    lookbackMonths: 12,
    pageSize: 120,
    maxPages: 50,
    maxPagesPerChunk: 50,
    maxDetailFetches: 160,
    fetchProductMap: true,
    chunkByMonth: true
  });
}

function installRemakeFactorDailyTrigger() {
  const refreshFunctionName = 'refreshRemakeFactorDailyCache';
  const browserFunctionName = 'refreshRemakeFactorBrowserReadyCacheNightlyV1330';
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (!trigger.getHandlerFunction) return;
    const handler = trigger.getHandlerFunction();
    if (handler === refreshFunctionName || handler === browserFunctionName || handler === 'refreshRemakeFactorCache' || handler === 'refreshRemakeFactorBrowserReadyCacheAfterSourceUpdateV1331') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(refreshFunctionName)
    .timeBased()
    .everyDays(1)
    .atHour(5)
    .create();

  // Build the browser-ready file in a separate execution so the main API refresh
  // can release its memory before the full saved cache is packed and gzipped.
  ScriptApp.newTrigger(browserFunctionName)
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  return {
    ok: true,
    version: 'RemakeFactorCache v1.34',
    message: 'Installed the daily Remake Factor cache refresh near 5 AM and the browser-ready consolidated cache build near 6 AM script time.',
    refreshFunctionName: refreshFunctionName,
    browserFunctionName: browserFunctionName
  };
}

function getRemakeFactorTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(trigger => {
      if (!trigger.getHandlerFunction) return false;
      const handler = trigger.getHandlerFunction();
      return handler === 'refreshRemakeFactorDailyCache' ||
        handler === 'refreshRemakeFactorBrowserReadyCacheNightlyV1330' ||
        handler === 'refreshRemakeFactorCache' ||
        handler === 'refreshRemakeFactorBrowserReadyCacheAfterSourceUpdateV1331';
    })
    .map(trigger => ({
      handlerFunction: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType ? trigger.getEventType() : ''),
      source: String(trigger.getTriggerSource ? trigger.getTriggerSource() : '')
    }));

  let browserReadyCache = null;
  try {
    browserReadyCache = getRemakeFactorBrowserReadyMetaV1330();
  } catch (error) {
    browserReadyCache = { ok: false, message: compactRemakeFactorError(error) };
  }

  return {
    ok: true,
    version: 'RemakeFactorCache v1.34',
    timestamp: new Date().toISOString(),
    hasDailyTrigger: triggers.some(trigger => trigger.handlerFunction === 'refreshRemakeFactorDailyCache'),
    hasBrowserReadyTrigger: triggers.some(trigger => trigger.handlerFunction === 'refreshRemakeFactorBrowserReadyCacheNightlyV1330'),
    hasFollowUpBrowserReadyTrigger: triggers.some(trigger => trigger.handlerFunction === 'refreshRemakeFactorBrowserReadyCacheAfterSourceUpdateV1331'),
    triggers: triggers,
    cacheHealth: getRemakeFactorSafeHealthSummary(),
    browserReadyCache: browserReadyCache
  };
}


/**
 * v1.18.0 Overview-style storage override.
 *
 * Source remains MagicTouch/API. Storage changes from one large Drive JSON file
 * to an Overview-style saved Drive cache with a small index file plus one JSON
 * file per invoice month. This avoids Apps Script's whole-file read/write size
 * limit and keeps page loads cached instead of API-backed.
 */
const remakeFactorStorageVersionV118 = 'RemakeFactorCache v1.33.1';
const remakeFactorCacheIndexFileIdPropertyV118 = 'MT_REMAKE_CACHE_INDEX_FILE_ID';
const remakeFactorCacheIndexFileNameV118 = 'remake_factor_cache_index.json';
const remakeFactorCacheShardPrefixV118 = 'remake_factor_cache_month_';
const remakeFactorCacheStorageModeV118 = 'overviewStyleDriveJsonMonthlyShards';

function getRemakeFactorCacheIndexFileV118(createIfMissing) {
  const props = PropertiesService.getScriptProperties();
  const candidateIds = [
    props.getProperty(remakeFactorCacheIndexFileIdPropertyV118),
    props.getProperty(remakeFactorCacheFileIdProperty)
  ].filter(Boolean);

  for (let i = 0; i < candidateIds.length; i++) {
    try {
      const file = DriveApp.getFileById(candidateIds[i]);
      if (file.getName && file.getName() === remakeFactorCacheIndexFileNameV118) {
        props.setProperty(remakeFactorCacheIndexFileIdPropertyV118, file.getId());
        props.setProperty(remakeFactorCacheFileIdProperty, file.getId());
        return file;
      }
    } catch (error) {}
  }

  if (!createIfMissing) return null;

  const createdAt = new Date().toISOString();
  const index = {
    ok: false,
    version: remakeFactorStorageVersionV118,
    storageMode: remakeFactorCacheStorageModeV118,
    createdAt: createdAt,
    generatedAt: '',
    message: 'Remake Factor sharded cache index created. Run rebuildRemakeFactorHistoricalCache next.',
    months: [],
    shards: {},
    totalRows: 0,
    stats: {}
  };
  const file = DriveApp.createFile(remakeFactorCacheIndexFileNameV118, JSON.stringify(index), MimeType.PLAIN_TEXT);
  props.setProperty(remakeFactorCacheIndexFileIdPropertyV118, file.getId());
  props.setProperty(remakeFactorCacheFileIdProperty, file.getId());
  return file;
}

function readRemakeFactorCacheIndexV118() {
  const file = getRemakeFactorCacheIndexFileV118(false);
  if (!file) return null;
  try {
    const text = file.getBlob().getDataAsString('UTF-8');
    const parsed = text ? JSON.parse(text) : null;
    if (!parsed || parsed.storageMode !== remakeFactorCacheStorageModeV118) return null;
    return parsed;
  } catch (error) {
    return {
      ok: false,
      version: remakeFactorStorageVersionV118,
      storageMode: remakeFactorCacheStorageModeV118,
      message: 'Remake Factor sharded cache index could not be read: ' + compactRemakeFactorError(error),
      months: [],
      shards: {},
      totalRows: 0,
      stats: { error: compactRemakeFactorError(error) }
    };
  }
}

function writeRemakeFactorCacheIndexV118(index) {
  const file = getRemakeFactorCacheIndexFileV118(true);
  file.setContent(JSON.stringify(index));
  return file;
}

function getRemakeFactorMonthKeyFromRowV118(row) {
  const raw = String(row && (row.month || row.invoiceMonth || row.invoiceDate || row.Cases_InvoiceDate || row.dateIn || row.createDate || '') || '').trim();
  if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !isNaN(parsed.getTime())) return formatRemakeFactorDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1)).slice(0, 7);
  return 'unknown';
}

function groupRemakeFactorRowsByMonthV118(rows) {
  const groups = {};
  (rows || []).forEach(row => {
    const key = getRemakeFactorMonthKeyFromRowV118(row);
    if (!groups[key]) groups[key] = [];
    groups[key].push(compactRemakeFactorDetailRowForStorage(row));
  });
  return groups;
}

function getRemakeFactorShardFileV118(monthKey, existingFileId) {
  if (existingFileId) {
    try {
      return DriveApp.getFileById(existingFileId);
    } catch (error) {}
  }
  const safeMonth = String(monthKey || 'unknown').replace(/[^0-9A-Za-z_-]/g, '_');
  return DriveApp.createFile(remakeFactorCacheShardPrefixV118 + safeMonth + '.json', JSON.stringify({ ok: false, rows: [] }), MimeType.PLAIN_TEXT);
}

function compactRemakeFactorShardStatsV118(stats) {
  const copy = compactRemakeFactorStatsForStorage(stats || {});
  delete copy.queryUsed;
  delete copy.warnings;
  return copy;
}

function writeRemakeFactorCache(payload) {
  const sourcePayload = payload || {};
  const rows = Array.isArray(sourcePayload.detailRows) ? sourcePayload.detailRows : (Array.isArray(sourcePayload.rows) ? sourcePayload.rows : []);
  const groups = groupRemakeFactorRowsByMonthV118(rows);
  const existingIndex = readRemakeFactorCacheIndexV118() || {
    ok: false,
    version: remakeFactorStorageVersionV118,
    storageMode: remakeFactorCacheStorageModeV118,
    months: [],
    shards: {},
    totalRows: 0,
    stats: {}
  };
  const existingShards = existingIndex.shards || {};
  const months = Object.keys(groups).sort();
  const newShards = Object.assign({}, existingShards);
  const generatedAt = sourcePayload.generatedAt || new Date().toISOString();

  months.forEach(monthKey => {
    const oldShard = existingShards[monthKey] || {};
    const shardFile = getRemakeFactorShardFileV118(monthKey, oldShard.fileId || '');
    const shardRows = groups[monthKey] || [];
    const shardPayload = {
      ok: true,
      version: remakeFactorStorageVersionV118,
      storageMode: remakeFactorCacheStorageModeV118,
      month: monthKey,
      generatedAt: generatedAt,
      source: sourcePayload.source || 'MagicTouch CRM API',
      rowCount: shardRows.length,
      rows: shardRows,
      stats: compactRemakeFactorShardStatsV118(sourcePayload.stats || {})
    };
    shardFile.setContent(JSON.stringify(shardPayload));
    newShards[monthKey] = {
      month: monthKey,
      fileId: shardFile.getId(),
      fileName: shardFile.getName(),
      fileUrl: shardFile.getUrl(),
      rowCount: shardRows.length,
      generatedAt: generatedAt
    };
  });

  // Keep previously cached months that were not part of this write. This is what
  // lets current-month refresh replace only open months while preserving history.
  const allMonths = Object.keys(newShards).sort();
  const totalRows = allMonths.reduce((sum, monthKey) => sum + Number((newShards[monthKey] && newShards[monthKey].rowCount) || 0), 0);
  const compactStats = compactRemakeFactorStatsForStorage(sourcePayload.stats || {});
  compactStats.version = remakeFactorStorageVersionV118;
  compactStats.storageMode = remakeFactorCacheStorageModeV118;
  compactStats.lastWriteRows = rows.length;
  compactStats.totalCachedRows = totalRows;
  compactStats.writtenMonths = months;
  compactStats.cachedMonths = allMonths;

  const index = {
    ok: !!sourcePayload.ok,
    version: remakeFactorStorageVersionV118,
    storageMode: remakeFactorCacheStorageModeV118,
    generatedAt: generatedAt,
    source: sourcePayload.source || 'MagicTouch CRM API',
    message: sourcePayload.message || 'Remake Factor cache stored as monthly Drive JSON shards.',
    dateRange: sourcePayload.dateRange || {},
    months: allMonths,
    shards: newShards,
    totalRows: totalRows,
    stats: compactStats
  };
  writeRemakeFactorCacheIndexV118(index);
}

function buildRemakeFactorBrowserRowV1323(row) {
  row = row || {};
  const month = cleanRemakeFactorText(row.month || getRemakeFactorMonth(row.invoiceDate || row.Cases_InvoiceDate || ''));
  const invoiceDate = cleanRemakeFactorText(row.invoiceDate || row.Cases_InvoiceDate || '');
  const caseNumber = cleanRemakeFactorText(row.caseNumber || row.caseNo || row.Cases_CaseNumber || '');
  const caseId = cleanRemakeFactorText(row.caseId || row.caseID || caseNumber || '');
  const customerId = cleanRemakeFactorText(row.customerId || row.customerID || row.Cases_CustomerID || '');
  let customerName = cleanRemakeFactorText(
    row.customerFullName ||
    row.Customers_CustomerFullName ||
    row.customerName ||
    row.customerDisplayName ||
    ''
  );
  let practiceName = cleanRemakeFactorText(
    row.practiceName ||
    row.customerPracticeName ||
    row.Customers_PracticeName ||
    ''
  );
  if (customerName === customerId) customerName = '';
  if (practiceName === customerId) practiceName = '';
  customerName = customerName || practiceName || customerId || 'Unknown customer';
  const productId = cleanRemakeFactorText(row.productId || row.productID || row.CaseProducts_ProductID || '');
  const productName = cleanRemakeFactorText(
    row.productName ||
    row.productsDescription ||
    row.Products_Description ||
    row.productDescription ||
    row.invoiceDescription ||
    productId ||
    'Unknown product'
  );
  const productGroup = cleanRemakeFactorText(
    row.productGroup ||
    row.productsGroup ||
    row.Products_Group ||
    row.group ||
    row.taxGroup ||
    row.department ||
    'Unassigned'
  );
  const remakeValue = row.remakeFlag || row.remake || row.remakeValue || row.caseProductsRemake || row.CaseProducts_Remake || '';
  const isRemake = row.isRemake === true
    ? true
    : (row.isRemake === false ? false : isRemakeFactorTruthy(remakeValue));
  const quantity = toRemakeFactorNumber(row.quantity !== undefined ? row.quantity : (row.units !== undefined ? row.units : row.CaseProducts_Quantity));
  const remakeUnits = isRemake
    ? toRemakeFactorNumber(row.remakeUnits !== undefined ? row.remakeUnits : quantity)
    : 0;
  const remakeDiscount = isRemake
    ? Math.abs(toRemakeFactorNumber(row.remakeDiscount || row.CaseProducts_RemakeDiscount || 0))
    : 0;
  let customerDisplayLabel = customerName;
  if (customerName && practiceName && customerName !== practiceName) customerDisplayLabel = customerName + ' - ' + practiceName;
  if (customerId && customerDisplayLabel !== customerId && customerDisplayLabel.indexOf('(' + customerId + ')') < 0) {
    customerDisplayLabel += ' (' + customerId + ')';
  }

  return {
    month: month,
    year: Number(row.year || (month ? month.slice(0, 4) : 0)) || '',
    invoiceDate: invoiceDate,
    caseId: caseId,
    caseNumber: caseNumber,
    customerId: customerId || customerName,
    customerKey: customerId || customerName,
    customerName: customerName,
    practiceName: practiceName,
    customerDisplayLabel: customerDisplayLabel,
    customerActive: row.customerActive === false || row.customerActive === 'false' ? false : true,
    department: cleanRemakeFactorText(row.department || row.productsDepartment || row.Products_Department || 'Unassigned') || 'Unassigned',
    productId: productId,
    productKey: productId || productName,
    productName: productName,
    productGroup: productGroup,
    remakeReason: isRemake
      ? (cleanRemakeFactorText(row.remakeReason || row.reason || row.CaseProducts_RemakeReason || '') || 'Not specified')
      : 'Not a remake',
    quantity: quantity,
    units: quantity,
    isRemake: isRemake,
    remakeUnits: remakeUnits,
    remakeDiscount: remakeDiscount,
    isRealInvoicedCharge: row.isRealInvoicedCharge !== false,
    chargeAmount: toRemakeFactorNumber(row.chargeAmount !== undefined ? row.chargeAmount : row.totalCharge),
    remakeDiscountSource: cleanRemakeFactorText(row.remakeDiscountSource || '')
  };
}

function compactRemakeFactorPayloadForBrowserV1323(payload) {
  payload = payload || {};
  const rows = Array.isArray(payload.rows)
    ? payload.rows
    : (Array.isArray(payload.detailRows) ? payload.detailRows : []);
  for (let index = 0; index < rows.length; index++) {
    rows[index] = buildRemakeFactorBrowserRowV1323(rows[index]);
  }
  return {
    ok: !!payload.ok,
    version: payload.version || remakeFactorStorageVersionV118,
    storageMode: payload.storageMode || remakeFactorCacheStorageModeV118,
    generatedAt: payload.generatedAt || '',
    source: payload.source || 'MagicTouch CRM API cached in Drive monthly shards',
    message: payload.message || '',
    dateRange: payload.dateRange || {},
    stats: Object.assign({}, payload.stats || {}, {
      browserCompact: true,
      browserRowSchema: 'remakeBrowserRowV1323',
      browserRows: rows.length
    }),
    browserRowsNormalized: true,
    browserRowSchema: 'remakeBrowserRowV1323',
    rows: rows
  };
}


/**
 * v1.33.0 browser-ready consolidated cache.
 *
 * The monthly Drive shards remain the durable source of truth. A separate daily
 * trigger reads those shards once, converts them to the approved compact browser
 * row shape, dictionary-packs repeated strings, gzips the result, and saves one
 * active Drive file. A first-time browser receives the gzip bytes as base64 and
 * expands them locally. Repeat visits continue to use the existing monthly
 * IndexedDB cache in Index.html.
 */
const remakeFactorBrowserReadyVersionV1330 = 'RemakeFactorBrowserReady v1.33.0';
const remakeFactorBrowserReadySchemaV1330 = 'remakeBrowserPackedV1330';
const remakeFactorBrowserReadyFileIdPropertyV1330 = 'MT_REMAKE_BROWSER_CACHE_FILE_ID';
const remakeFactorBrowserReadySourceGeneratedAtPropertyV1330 = 'MT_REMAKE_BROWSER_CACHE_SOURCE_GENERATED_AT';
const remakeFactorBrowserReadyBuiltAtPropertyV1330 = 'MT_REMAKE_BROWSER_CACHE_BUILT_AT';
const remakeFactorBrowserReadyRowCountPropertyV1330 = 'MT_REMAKE_BROWSER_CACHE_ROW_COUNT';
const remakeFactorBrowserReadyFileSizePropertyV1330 = 'MT_REMAKE_BROWSER_CACHE_FILE_SIZE';
const remakeFactorBrowserReadyFileNameV1330 = 'remake_factor_browser_cache.json.gz';

function buildRemakeFactorBrowserPackedPayloadV1330_() {
  const index = readRemakeFactorCacheIndexV118();
  if (!index || !index.ok) {
    throw new Error(index && index.message ? index.message : 'The Remake Factor monthly cache index is not ready.');
  }

  const dictionaries = {
    months: [],
    dates: [],
    cases: [],
    caseNumbers: [],
    customers: [],
    departments: [],
    products: [],
    groups: [],
    reasons: [],
    discountSources: []
  };
  const maps = {
    months: new Map(),
    dates: new Map(),
    cases: new Map(),
    caseNumbers: new Map(),
    customers: new Map(),
    departments: new Map(),
    products: new Map(),
    groups: new Map(),
    reasons: new Map(),
    discountSources: new Map()
  };

  function scalarIndex(name, value) {
    const clean = cleanRemakeFactorText(value || '');
    const map = maps[name];
    if (map.has(clean)) return map.get(clean);
    const indexValue = dictionaries[name].length;
    dictionaries[name].push(clean);
    map.set(clean, indexValue);
    return indexValue;
  }

  function customerIndex(row) {
    const record = [
      cleanRemakeFactorText(row.customerId || ''),
      cleanRemakeFactorText(row.customerName || ''),
      cleanRemakeFactorText(row.practiceName || ''),
      row.customerActive === false ? 0 : 1
    ];
    const key = JSON.stringify(record);
    if (maps.customers.has(key)) return maps.customers.get(key);
    const indexValue = dictionaries.customers.length;
    dictionaries.customers.push(record);
    maps.customers.set(key, indexValue);
    return indexValue;
  }

  function productIndex(row) {
    const record = [
      cleanRemakeFactorText(row.productId || ''),
      cleanRemakeFactorText(row.productName || '')
    ];
    const key = JSON.stringify(record);
    if (maps.products.has(key)) return maps.products.get(key);
    const indexValue = dictionaries.products.length;
    dictionaries.products.push(record);
    maps.products.set(key, indexValue);
    return indexValue;
  }

  const packedRows = [];
  const months = (index.months || Object.keys(index.shards || {})).slice().sort();
  const shardErrors = [];

  months.forEach(monthKey => {
    const shard = index.shards && index.shards[monthKey] ? index.shards[monthKey] : null;
    if (!shard || !shard.fileId) return;
    try {
      const file = DriveApp.getFileById(shard.fileId);
      const text = file.getBlob().getDataAsString('UTF-8');
      const parsed = text ? JSON.parse(text) : null;
      const shardRows = parsed && (Array.isArray(parsed.rows) ? parsed.rows : (Array.isArray(parsed.detailRows) ? parsed.detailRows : []));
      (shardRows || []).forEach(rawRow => {
        const row = buildRemakeFactorBrowserRowV1323(rawRow);
        packedRows.push([
          scalarIndex('months', row.month),
          scalarIndex('dates', row.invoiceDate),
          scalarIndex('cases', row.caseId),
          customerIndex(row),
          scalarIndex('departments', row.department || 'Unassigned'),
          productIndex(row),
          scalarIndex('groups', row.productGroup || row.department || 'Unassigned'),
          scalarIndex('reasons', row.remakeReason || (row.isRemake ? 'Not specified' : 'Not a remake')),
          Number(row.quantity || 0),
          row.isRemake === true ? 1 : 0,
          Number(row.remakeUnits || 0),
          Number(row.remakeDiscount || 0),
          row.isRealInvoicedCharge === false ? 0 : 1,
          Number(row.chargeAmount || 0),
          scalarIndex('discountSources', row.remakeDiscountSource || ''),
          scalarIndex('caseNumbers', row.caseNumber || '')
        ]);
      });
    } catch (error) {
      shardErrors.push(monthKey + ': ' + compactRemakeFactorError(error));
    }
  });

  if (shardErrors.length) {
    throw new Error('Browser-ready cache build stopped because monthly shards could not be read: ' + shardErrors.join(' | '));
  }

  return {
    ok: true,
    version: remakeFactorBrowserReadyVersionV1330,
    storageMode: 'browserReadyConsolidatedGzip',
    browserRowsPacked: true,
    browserRowSchema: remakeFactorBrowserReadySchemaV1330,
    generatedAt: index.generatedAt || '',
    builtAt: new Date().toISOString(),
    source: index.source || 'MagicTouch CRM API cached in Drive monthly shards',
    message: 'Nightly browser-ready Remake Factor cache.',
    dateRange: index.dateRange || {},
    stats: Object.assign({}, index.stats || {}, {
      browserReadyConsolidated: true,
      browserReadySchema: remakeFactorBrowserReadySchemaV1330,
      browserReadyRows: packedRows.length,
      browserReadyMonths: months.length,
      browserReadyDictionaryCounts: {
        months: dictionaries.months.length,
        dates: dictionaries.dates.length,
        cases: dictionaries.cases.length,
        caseNumbers: dictionaries.caseNumbers.length,
        customers: dictionaries.customers.length,
        departments: dictionaries.departments.length,
        products: dictionaries.products.length,
        groups: dictionaries.groups.length,
        reasons: dictionaries.reasons.length,
        discountSources: dictionaries.discountSources.length
      }
    }),
    dictionaries: dictionaries,
    rows: packedRows
  };
}

function rebuildRemakeFactorBrowserReadyCacheV1330() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error('Another Remake Factor cache operation is already running.');
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const oldFileId = props.getProperty(remakeFactorBrowserReadyFileIdPropertyV1330) || '';
    const payload = buildRemakeFactorBrowserPackedPayloadV1330_();
    const jsonText = JSON.stringify(payload);
    const sourceBlob = Utilities.newBlob(jsonText, 'application/json', 'remake_factor_browser_cache.json');
    const gzipBlob = Utilities.gzip(sourceBlob, remakeFactorBrowserReadyFileNameV1330);
    const file = DriveApp.createFile(gzipBlob);
    const builtAt = payload.builtAt || new Date().toISOString();
    const fileSizeBytes = Number(file.getSize() || 0);
    const sourceGeneratedAt = payload.generatedAt || '';
    const rowCount = Array.isArray(payload.rows) ? payload.rows.length : 0;

    props.setProperties({
      [remakeFactorBrowserReadyFileIdPropertyV1330]: file.getId(),
      [remakeFactorBrowserReadySourceGeneratedAtPropertyV1330]: sourceGeneratedAt,
      [remakeFactorBrowserReadyBuiltAtPropertyV1330]: builtAt,
      [remakeFactorBrowserReadyRowCountPropertyV1330]: String(rowCount),
      [remakeFactorBrowserReadyFileSizePropertyV1330]: String(fileSizeBytes)
    }, false);

    const index = readRemakeFactorCacheIndexV118();
    if (index) {
      index.browserReadyCache = {
        ok: true,
        version: remakeFactorBrowserReadyVersionV1330,
        schema: remakeFactorBrowserReadySchemaV1330,
        encoding: 'gzip-base64',
        fileId: file.getId(),
        fileName: file.getName(),
        fileUrl: file.getUrl(),
        fileSizeBytes: fileSizeBytes,
        rowCount: rowCount,
        sourceGeneratedAt: sourceGeneratedAt,
        builtAt: builtAt
      };
      writeRemakeFactorCacheIndexV118(index);
    }

    if (oldFileId && oldFileId !== file.getId()) {
      try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (ignore) {}
    }

    return {
      ok: true,
      version: remakeFactorBrowserReadyVersionV1330,
      schema: remakeFactorBrowserReadySchemaV1330,
      encoding: 'gzip-base64',
      message: 'Browser-ready consolidated Remake Factor cache rebuilt.',
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileSizeBytes: fileSizeBytes,
      sourceJsonBytes: jsonText.length,
      rowCount: rowCount,
      sourceGeneratedAt: sourceGeneratedAt,
      builtAt: builtAt
    };
  } finally {
    lock.releaseLock();
  }
}

function refreshRemakeFactorBrowserReadyCacheNightlyV1330() {
  return rebuildRemakeFactorBrowserReadyCacheV1330();
}

function getRemakeFactorBrowserReadyMetaV1330() {
  const props = PropertiesService.getScriptProperties();
  const fileId = props.getProperty(remakeFactorBrowserReadyFileIdPropertyV1330) || '';
  const sourceGeneratedAt = props.getProperty(remakeFactorBrowserReadySourceGeneratedAtPropertyV1330) || '';
  const builtAt = props.getProperty(remakeFactorBrowserReadyBuiltAtPropertyV1330) || '';
  const rowCount = Number(props.getProperty(remakeFactorBrowserReadyRowCountPropertyV1330) || 0);
  const savedFileSizeBytes = Number(props.getProperty(remakeFactorBrowserReadyFileSizePropertyV1330) || 0);
  const index = readRemakeFactorCacheIndexV118();
  const currentSourceGeneratedAt = index && index.generatedAt ? String(index.generatedAt) : '';
  const stale = !!(currentSourceGeneratedAt && sourceGeneratedAt && currentSourceGeneratedAt !== sourceGeneratedAt);

  if (!fileId) {
    return {
      ok: false,
      servable: false,
      fresh: false,
      version: remakeFactorBrowserReadyVersionV1330,
      schema: remakeFactorBrowserReadySchemaV1330,
      stale: false,
      message: 'The browser-ready cache has not been built yet. Run rebuildRemakeFactorBrowserReadyCacheV1330() or install the nightly triggers.'
    };
  }

  try {
    const file = DriveApp.getFileById(fileId);
    const fileSizeBytes = Number(file.getSize() || savedFileSizeBytes || 0);
    return {
      ok: true,
      servable: true,
      fresh: !stale,
      version: remakeFactorBrowserReadyVersionV1330,
      schema: remakeFactorBrowserReadySchemaV1330,
      encoding: 'gzip-base64',
      stale: stale,
      message: stale
        ? 'The latest optimized snapshot is available while a replacement is rebuilt from the newer monthly source.'
        : 'Browser-ready consolidated cache is available.',
      fileId: fileId,
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      fileSizeBytes: fileSizeBytes,
      rowCount: rowCount,
      sourceGeneratedAt: sourceGeneratedAt,
      currentSourceGeneratedAt: currentSourceGeneratedAt,
      builtAt: builtAt,
      cacheToken: [sourceGeneratedAt, builtAt, fileSizeBytes, rowCount].join(':')
    };
  } catch (error) {
    return {
      ok: false,
      servable: false,
      fresh: false,
      version: remakeFactorBrowserReadyVersionV1330,
      schema: remakeFactorBrowserReadySchemaV1330,
      stale: false,
      message: 'The browser-ready cache file could not be read: ' + compactRemakeFactorError(error)
    };
  }
}

function getRemakeFactorBrowserReadyDataV1330() {
  const meta = getRemakeFactorBrowserReadyMetaV1330();
  if (!meta.ok) return meta;

  try {
    const file = DriveApp.getFileById(meta.fileId);
    return Object.assign({}, meta, {
      ok: true,
      payloadBase64: Utilities.base64Encode(file.getBlob().getBytes())
    });
  } catch (error) {
    return Object.assign({}, meta, {
      ok: false,
      payloadBase64: '',
      message: 'The browser-ready cache payload could not be transferred: ' + compactRemakeFactorError(error)
    });
  }
}

function debugRemakeFactorBrowserReadyCacheV1330() {
  return getRemakeFactorBrowserReadyMetaV1330();
}


/**
 * v1.33.2 stale-while-revalidate assurance endpoint.
 * This never performs the gzip rebuild inside the browser request. It only
 * confirms the optimized cache is current or schedules one deduplicated
 * follow-up execution when the file is missing/stale.
 */
function ensureRemakeFactorBrowserReadyCacheCurrentV1332() {
  const meta = getRemakeFactorBrowserReadyMetaV1330();
  if (meta && meta.ok && meta.stale !== true) {
    return Object.assign({}, meta, {
      version: 'RemakeFactorCache v1.33.2',
      rebuildScheduled: false,
      message: 'The optimized Remake cache is already current.'
    });
  }

  const existing = ScriptApp.getProjectTriggers().filter(trigger =>
    trigger.getHandlerFunction && trigger.getHandlerFunction() === remakeFactorBrowserReadyFollowUpHandlerV1331
  );
  if (existing.length) {
    return Object.assign({}, meta || {}, {
      ok: true,
      version: 'RemakeFactorCache v1.33.2',
      rebuildScheduled: true,
      rebuildAlreadyScheduled: true,
      handlerFunction: remakeFactorBrowserReadyFollowUpHandlerV1331,
      message: 'An optimized Remake cache rebuild is already scheduled.'
    });
  }

  const scheduled = scheduleRemakeFactorBrowserReadyRebuildV1331();
  return Object.assign({}, meta || {}, {
    ok: true,
    version: 'RemakeFactorCache v1.33.2',
    rebuildScheduled: !!(scheduled && scheduled.ok),
    rebuildAlreadyScheduled: false,
    handlerFunction: remakeFactorBrowserReadyFollowUpHandlerV1331,
    message: scheduled && scheduled.message
      ? scheduled.message
      : 'Scheduled the optimized Remake cache rebuild.'
  });
}

function readRemakeFactorCache(options) {
  const requestedOptions = options || {};
  const compactForBrowser = requestedOptions.compactForBrowser === true;
  const index = readRemakeFactorCacheIndexV118();
  if (!index) {
    return {
      ok: false,
      version: remakeFactorStorageVersionV118,
      storageMode: remakeFactorCacheStorageModeV118,
      message: 'No Overview-style Remake Factor cache index exists yet. Run rebuildRemakeFactorHistoricalCache.',
      generatedAt: '',
      detailRows: [],
      stats: getRemakeFactorSafeHealthSummary()
    };
  }
  if (!index.ok) {
    return {
      ok: false,
      version: remakeFactorStorageVersionV118,
      storageMode: remakeFactorCacheStorageModeV118,
      message: index.message || 'Remake Factor cache index exists but is not ready.',
      generatedAt: index.generatedAt || '',
      detailRows: [],
      stats: index.stats || {}
    };
  }

  const rows = [];
  const months = (index.months || Object.keys(index.shards || {})).slice().sort();
  const shardErrors = [];
  months.forEach(monthKey => {
    const shard = index.shards && index.shards[monthKey] ? index.shards[monthKey] : null;
    if (!shard || !shard.fileId) return;
    try {
      const file = DriveApp.getFileById(shard.fileId);
      const text = file.getBlob().getDataAsString('UTF-8');
      const parsed = text ? JSON.parse(text) : null;
      const shardRows = parsed && (Array.isArray(parsed.rows) ? parsed.rows : (Array.isArray(parsed.detailRows) ? parsed.detailRows : []));
      if (shardRows && shardRows.length) {
        if (compactForBrowser) {
          for (let rowIndex = 0; rowIndex < shardRows.length; rowIndex++) {
            rows.push(buildRemakeFactorBrowserRowV1323(shardRows[rowIndex]));
          }
        } else {
          Array.prototype.push.apply(rows, shardRows);
        }
      }
    } catch (error) {
      shardErrors.push(monthKey + ': ' + compactRemakeFactorError(error));
    }
  });

  const response = {
    ok: shardErrors.length === 0,
    version: remakeFactorStorageVersionV118,
    storageMode: remakeFactorCacheStorageModeV118,
    generatedAt: index.generatedAt || '',
    source: index.source || 'MagicTouch CRM API cached in Drive monthly shards',
    message: shardErrors.length ? 'One or more Remake Factor month cache files could not be read.' : (index.message || ''),
    dateRange: index.dateRange || {},
    stats: Object.assign({}, index.stats || {}, {
      version: remakeFactorStorageVersionV118,
      storageMode: remakeFactorCacheStorageModeV118,
      cachedMonths: months,
      shardErrors: shardErrors,
      detailRows: rows.length
    })
  };
  if (compactForBrowser) {
    response.browserRowsNormalized = true;
    response.browserRowSchema = 'remakeBrowserRowV1323';
    response.stats.browserCompact = true;
    response.stats.browserRowSchema = 'remakeBrowserRowV1323';
    response.stats.browserRows = rows.length;
    response.rows = rows;
  } else {
    response.detailRows = rows;
  }
  return response;
}

function resetRemakeFactorCacheFile() {
  const props = PropertiesService.getScriptProperties();
  const oldCacheFileId = props.getProperty(remakeFactorCacheFileIdProperty) || '';
  const oldIndexFileId = props.getProperty(remakeFactorCacheIndexFileIdPropertyV118) || '';
  let oldCacheFileUrl = '';
  let oldIndexFileUrl = '';

  try { if (oldCacheFileId) oldCacheFileUrl = DriveApp.getFileById(oldCacheFileId).getUrl(); } catch (error) {}
  try { if (oldIndexFileId) oldIndexFileUrl = DriveApp.getFileById(oldIndexFileId).getUrl(); } catch (error) {}

  props.deleteProperty(remakeFactorCacheIndexFileIdPropertyV118);
  props.deleteProperty(remakeFactorCacheFileIdProperty);
  const file = getRemakeFactorCacheIndexFileV118(true);
  const result = {
    ok: true,
    version: remakeFactorStorageVersionV118,
    storageMode: remakeFactorCacheStorageModeV118,
    message: 'Fresh Overview-style Remake Factor cache index created. Old oversized cache was not read.',
    newCacheFileId: file.getId(),
    newCacheFileUrl: file.getUrl(),
    oldCacheFileId: oldCacheFileId,
    oldCacheFileUrl: oldCacheFileUrl,
    oldIndexFileId: oldIndexFileId,
    oldIndexFileUrl: oldIndexFileUrl
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


const remakeFactorRebuildStatePropertyV120 = 'MT_REMAKE_REBUILD_STATE_V120';
const remakeFactorRebuildMonthsPerRunPropertyV120 = 'MT_REMAKE_REBUILD_MONTHS_PER_RUN';

function getRemakeFactorComparisonMonthsV120() {
  const today = new Date();
  const months = [];
  const first = new Date(2025, 0, 1);
  const lastAllowed = new Date(2026, 11, 1);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = currentMonth < lastAllowed ? currentMonth : lastAllowed;
  for (let cursor = new Date(first); cursor <= last; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    months.push(formatRemakeFactorDate(cursor).slice(0, 7));
  }
  return months;
}

function getRemakeFactorMonthRangeV120(monthKey) {
  const parts = String(monthKey || '').split('-');
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const today = new Date();
  const cappedEnd = end > today ? today : end;
  return {
    month: monthKey,
    startDate: formatRemakeFactorDate(start),
    endDate: formatRemakeFactorDate(cappedEnd)
  };
}

function parseRemakeFactorRebuildStateV120(props) {
  try {
    const raw = props.getProperty(remakeFactorRebuildStatePropertyV120);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveRemakeFactorRebuildStateV120(props, state) {
  props.setProperty(remakeFactorRebuildStatePropertyV120, JSON.stringify(state || {}));
}

function startRemakeFactorComparisonRebuildStateV120(props, modeLabel) {
  const reset = resetRemakeFactorCacheFile();
  const months = getRemakeFactorComparisonMonthsV120();
  const state = {
    ok: true,
    version: 'RemakeFactorCache v1.34',
    storageMode: remakeFactorCacheStorageModeV118,
    status: 'running',
    mode: modeLabel || 'chunk',
    scope: '2025 and 2026 API rebuild saved as monthly Drive cache shards',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    months: months,
    nextIndex: 0,
    processed: [],
    errors: [],
    reset: reset
  };
  saveRemakeFactorRebuildStateV120(props, state);
  return state;
}

function summarizeRemakeFactorChunkResultV120(monthKey, result) {
  const stats = result && result.stats ? result.stats : {};
  return {
    month: monthKey,
    ok: !!(result && result.ok),
    generatedAt: result && result.generatedAt ? result.generatedAt : '',
    caseRowsFetched: Number(stats.caseRowsFetched || 0),
    detailRows: Number(stats.detailRows || (result && result.detailRows ? result.detailRows.length : 0) || 0),
    customerApiRowsFetched: Number(stats.customerApiRowsFetched || 0),
    customerNamesFromApi: Number(stats.customerNamesFromApi || 0),
    productMapSize: Number(stats.productMapSize || 0),
    warnings: (stats.warnings || []).slice(0, 5),
    message: result && result.message ? result.message : ''
  };
}

function buildRemakeFactorRebuildResponseV122(props, state, runProcessed, runErrors, messageOverride) {
  const index = readRemakeFactorCacheIndexV118();
  const monthsTotal = state && Array.isArray(state.months) ? state.months.length : 0;
  const monthsDone = state ? Number(state.nextIndex || 0) : 0;
  const response = {
    ok: !runErrors.length,
    version: 'RemakeFactorCache v1.34',
    storageMode: remakeFactorCacheStorageModeV118,
    status: state && state.status === 'complete' ? 'COMPLETE' : 'IN_PROGRESS',
    mode: state && state.mode ? state.mode : '',
    message: messageOverride || (state && state.status === 'complete'
      ? '2025 + 2026 Remake Factor cache rebuild is complete.'
      : 'Processed this run. Run the chunk option again to continue, or run the full option to reset and attempt all months.'),
    scope: state && state.scope ? state.scope : '2025 and 2026 API rebuild saved as monthly Drive cache shards',
    monthsTotal: monthsTotal,
    monthsDone: monthsDone,
    monthsRemaining: Math.max(0, monthsTotal - monthsDone),
    nextMonth: state && state.months ? (state.months[state.nextIndex] || '') : '',
    processedThisRun: runProcessed,
    errorsThisRun: runErrors,
    processedAll: state && state.processed ? state.processed : [],
    cacheIndexFileId: index && index.fileId ? index.fileId : props.getProperty(remakeFactorCacheIndexFileIdPropertyV118) || '',
    generatedAt: new Date().toISOString()
  };
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function runRemakeFactorHistoricalRebuildV122(options) {
  const opts = options || {};
  const props = PropertiesService.getScriptProperties();
  let state = parseRemakeFactorRebuildStateV120(props);

  if (opts.reset || !state || state.status === 'complete' || !Array.isArray(state.months) || !state.months.length) {
    state = startRemakeFactorComparisonRebuildStateV120(props, opts.mode || 'chunk');
  } else if (opts.mode) {
    state.mode = opts.mode;
    saveRemakeFactorRebuildStateV120(props, state);
  }

  const startedMs = Date.now();
  const maxRunMs = Math.max(60000, Number(opts.maxRunMs || 4.75 * 60 * 1000));
  const monthsPerRun = Math.max(1, Number(opts.monthsPerRun || 1));
  const runProcessed = [];
  const runErrors = [];

  while (state.nextIndex < state.months.length && runProcessed.length < monthsPerRun && (Date.now() - startedMs) < maxRunMs) {
    const monthKey = state.months[state.nextIndex];
    const range = getRemakeFactorMonthRangeV120(monthKey);
    try {
      const result = refreshRemakeFactorCache({
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
        chunkByMonth: false
      });
      const summary = summarizeRemakeFactorChunkResultV120(monthKey, result);
      runProcessed.push(summary);
      state.processed.push(summary);
      state.nextIndex += 1;
      state.updatedAt = new Date().toISOString();
      saveRemakeFactorRebuildStateV120(props, state);
      if (!result || !result.ok) {
        runErrors.push({ month: monthKey, error: summary.message || 'Month rebuild returned ok=false.' });
        break;
      }
    } catch (error) {
      const compact = compactRemakeFactorError(error);
      const errorRow = { month: monthKey, error: compact };
      runErrors.push(errorRow);
      state.errors.push(errorRow);
      state.updatedAt = new Date().toISOString();
      saveRemakeFactorRebuildStateV120(props, state);
      break;
    }
  }

  if (!runErrors.length && state.nextIndex >= state.months.length) {
    state.status = 'complete';
    state.completedAt = new Date().toISOString();
    state.updatedAt = state.completedAt;
    saveRemakeFactorRebuildStateV120(props, state);
  }

  const stoppedForTime = state.status !== 'complete' && !runErrors.length && (Date.now() - startedMs) >= maxRunMs;
  const message = state.status === 'complete'
    ? '2025 + 2026 Remake Factor cache rebuild is complete.'
    : (stoppedForTime
      ? 'Stopped safely before Apps Script timeout. Run rebuildRemakeFactorHistoricalCacheChunk to continue.'
      : (opts.mode === 'full'
        ? 'Full rebuild attempted as many months as possible in this run. Run chunk to continue if not complete.'
        : 'Chunk processed. Run rebuildRemakeFactorHistoricalCacheChunk again to continue.'));

  return buildRemakeFactorRebuildResponseV122(props, state, runProcessed, runErrors, message);
}

// Option 1: Full rebuild. This resets the Overview-style Remake cache and
// attempts all 2025 + 2026 months in one execution, saving each month as it goes.
// If Apps Script gets close to timeout, it stops safely and you can continue
// with rebuildRemakeFactorHistoricalCacheChunk.
function rebuildRemakeFactorHistoricalCacheFull() {
  const months = getRemakeFactorComparisonMonthsV120();
  return runRemakeFactorHistoricalRebuildV122({
    reset: true,
    mode: 'full',
    monthsPerRun: months.length,
    maxRunMs: 5.4 * 60 * 1000
  });
}

// Option 2: Chunked rebuild. This does not reset if a rebuild is in progress.
// It processes a smaller number of months per run and saves progress after each
// month. Set MT_REMAKE_REBUILD_MONTHS_PER_RUN if you want more than the default.
function rebuildRemakeFactorHistoricalCacheChunk() {
  const props = PropertiesService.getScriptProperties();
  const monthsPerRun = Math.max(1, Number(props.getProperty(remakeFactorRebuildMonthsPerRunPropertyV120) || 2));
  return runRemakeFactorHistoricalRebuildV122({
    reset: false,
    mode: 'chunk',
    monthsPerRun: monthsPerRun,
    maxRunMs: 4.75 * 60 * 1000
  });
}

// Backward-compatible alias. If you run the old function name, it uses the safe
// chunked behavior.
function rebuildRemakeFactorHistoricalCache() {
  return rebuildRemakeFactorHistoricalCacheChunk();
}

function getRemakeFactorRebuildStatus() {
  const props = PropertiesService.getScriptProperties();
  const state = parseRemakeFactorRebuildStateV120(props);
  const index = readRemakeFactorCacheIndexV118();
  const monthsTotal = state && Array.isArray(state.months) ? state.months.length : 0;
  const monthsDone = state ? Number(state.nextIndex || 0) : 0;
  const response = {
    ok: true,
    version: 'RemakeFactorCache v1.34',
    storageMode: remakeFactorCacheStorageModeV118,
    status: state ? (state.status === 'complete' ? 'COMPLETE' : 'IN_PROGRESS') : 'NOT_STARTED',
    mode: state && state.mode ? state.mode : '',
    monthsTotal: monthsTotal,
    monthsDone: monthsDone,
    monthsRemaining: Math.max(0, monthsTotal - monthsDone),
    nextMonth: state && state.months ? (state.months[state.nextIndex] || '') : '',
    processedAll: state && state.processed ? state.processed : [],
    errors: state && state.errors ? state.errors : [],
    cachedMonths: index && index.months ? index.months : [],
    totalCachedRows: index && index.totalRows ? index.totalRows : 0,
    generatedAt: new Date().toISOString()
  };
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function debugRemakeFactorCacheHealth() {
  const props = PropertiesService.getScriptProperties();
  const index = readRemakeFactorCacheIndexV118();
  const cached = index && index.ok ? readRemakeFactorCache() : null;
  return {
    ok: true,
    version: remakeFactorStorageVersionV118,
    storageMode: remakeFactorCacheStorageModeV118,
    timestamp: new Date().toISOString(),
    hasBaseUrl: !!props.getProperty(remakeFactorApiBaseUrlProperty),
    baseUrlHost: maskRemakeFactorBaseUrl(props.getProperty(remakeFactorApiBaseUrlProperty) || remakeFactorDefaultBaseUrl),
    hasUserId: !!props.getProperty(remakeFactorApiUserIdProperty),
    hasPassword: !!props.getProperty(remakeFactorApiPasswordProperty),
    cacheIndexFileId: props.getProperty(remakeFactorCacheIndexFileIdPropertyV118) || '',
    cacheFileId: props.getProperty(remakeFactorCacheFileIdProperty) || '',
    cacheOk: !!(cached && cached.ok),
    cacheMessage: cached && cached.message ? cached.message : (index && index.message ? index.message : ''),
    cacheGeneratedAt: index && index.generatedAt ? index.generatedAt : '',
    cachedMonths: index && index.months ? index.months.length : 0,
    totalRows: index && index.totalRows ? index.totalRows : 0,
    detailRows: cached && cached.detailRows ? cached.detailRows.length : 0,
    stats: index && index.stats ? index.stats : {}
  };
}


/**
 * v1.23.0 smart refresh override.
 *
 * Refresh Cache now means:
 * 1) Do not reset the existing Overview-style monthly shard cache.
 * 2) Rebuild any missing closed months in the 2025/2026 comparison window.
 * 3) Once closed months are complete, always replace the current/open month.
 *
 * This derives progress from the Drive index itself rather than the bulky rebuild
 * state property, so clicking dashboard Refresh cannot move progress backward.
 */
const remakeFactorSmartRefreshVersionV123 = 'RemakeFactorCache v1.33.0';
const remakeFactorSmartRefreshMonthsPerRunPropertyV123 = 'MT_REMAKE_SMART_REFRESH_MONTHS_PER_RUN';

function getRemakeFactorCurrentMonthKeyV123() {
  return formatRemakeFactorDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)).slice(0, 7);
}

function getRemakeFactorCachedMonthSetV123(index) {
  const set = {};
  const shards = index && index.shards ? index.shards : {};
  const months = Array.isArray(index && index.months) ? index.months : Object.keys(shards);
  months.forEach(monthKey => {
    const key = String(monthKey || '').slice(0, 7);
    if (!key) return;
    const shard = shards[key] || {};
    if (shard.fileId && Number(shard.rowCount || 0) >= 0) set[key] = true;
  });
  return set;
}

function getRemakeFactorMissingClosedMonthsV123(index) {
  const currentMonth = getRemakeFactorCurrentMonthKeyV123();
  const targetMonths = getRemakeFactorComparisonMonthsV120();
  const cached = getRemakeFactorCachedMonthSetV123(index || {});
  return targetMonths.filter(monthKey => monthKey < currentMonth && !cached[monthKey]);
}

function rebuildRemakeFactorOneMonthToShardV123(monthKey, options) {
  const opts = options || {};
  const range = getRemakeFactorMonthRangeV120(monthKey);
  const result = refreshRemakeFactorCache({
    forceRefresh: true,
    fullRefresh: true,
    historicalRebuild: true,
    incrementalRefresh: false,
    quickRefresh: false,
    startDate: range.startDate,
    endDate: range.endDate,
    lookbackMonths: 1,
    pageSize: Math.max(50, Number(opts.pageSize || 250)),
    maxPages: Math.max(1, Number(opts.maxPages || 90)),
    maxPagesPerChunk: Math.max(1, Number(opts.maxPagesPerChunk || 90)),
    maxDetailFetches: Math.max(0, Number(opts.maxDetailFetches || 900)),
    fetchProductMap: opts.fetchProductMap === undefined ? true : opts.fetchProductMap,
    fetchCustomerMap: opts.fetchCustomerMap === undefined ? true : opts.fetchCustomerMap,
    chunkByMonth: false
  });

  if (result && result.ok) {
    result.version = remakeFactorSmartRefreshVersionV123;
    result.storageMode = remakeFactorCacheStorageModeV118;
    result.message = 'Month ' + monthKey + ' rebuilt from MagicTouch API and saved to Drive shard.';
    result.stats = Object.assign({}, result.stats || {}, {
      version: remakeFactorSmartRefreshVersionV123,
      smartRefreshMonth: monthKey
    });
    writeRemakeFactorCache(result);
  }

  return summarizeRemakeFactorChunkResultV120(monthKey, result);
}

function refreshRemakeFactorMissingThenCurrentV123(options) {
  const opts = options || {};
  const props = PropertiesService.getScriptProperties();
  const startedMs = Date.now();
  const maxRunMs = Math.max(60000, Number(opts.maxRunMs || 4.75 * 60 * 1000));
  const monthsPerRun = Math.max(1, Number(opts.monthsPerRun || props.getProperty(remakeFactorSmartRefreshMonthsPerRunPropertyV123) || 3));
  const currentMonth = getRemakeFactorCurrentMonthKeyV123();
  const processed = [];
  const errors = [];

  let index = readRemakeFactorCacheIndexV118();
  if (!index || index.storageMode !== remakeFactorCacheStorageModeV118) {
    getRemakeFactorCacheIndexFileV118(true);
    index = readRemakeFactorCacheIndexV118();
  }

  let missingClosed = getRemakeFactorMissingClosedMonthsV123(index || {});
  let processedMissingCount = 0;

  while (missingClosed.length && processedMissingCount < monthsPerRun && (Date.now() - startedMs) < maxRunMs) {
    const monthKey = missingClosed[0];
    try {
      const summary = rebuildRemakeFactorOneMonthToShardV123(monthKey, opts);
      processed.push(summary);
      processedMissingCount += 1;
      if (!summary.ok) {
        errors.push({ month: monthKey, error: summary.message || 'Month rebuild returned ok=false.' });
        break;
      }
    } catch (error) {
      errors.push({ month: monthKey, error: compactRemakeFactorError(error) });
      break;
    }

    index = readRemakeFactorCacheIndexV118();
    missingClosed = getRemakeFactorMissingClosedMonthsV123(index || {});
  }

  let currentMonthRefreshed = false;
  if (!errors.length && !missingClosed.length && (Date.now() - startedMs) < maxRunMs) {
    try {
      const summary = rebuildRemakeFactorOneMonthToShardV123(currentMonth, opts);
      summary.currentMonthReplacement = true;
      processed.push(summary);
      currentMonthRefreshed = !!summary.ok;
      if (!summary.ok) errors.push({ month: currentMonth, error: summary.message || 'Current month refresh returned ok=false.' });
    } catch (error) {
      errors.push({ month: currentMonth, error: compactRemakeFactorError(error) });
    }
    index = readRemakeFactorCacheIndexV118();
    missingClosed = getRemakeFactorMissingClosedMonthsV123(index || {});
  }

  const cachedMonths = (index && (index.months || Object.keys(index.shards || {})) || []).slice().sort();
  const targetMonths = getRemakeFactorComparisonMonthsV120();
  const status = errors.length ? 'ERROR' : (!missingClosed.length && currentMonthRefreshed ? 'COMPLETE' : 'IN_PROGRESS');
  const response = {
    ok: !errors.length,
    version: remakeFactorSmartRefreshVersionV123,
    storageMode: remakeFactorCacheStorageModeV118,
    status: status,
    mode: 'smartRefresh',
    message: errors.length
      ? 'Refresh stopped because a month failed. See errorsThisRun.'
      : (status === 'COMPLETE'
        ? 'Missing closed months are complete and current month was replaced from the API.'
        : 'Missing closed months were rebuilt. Click Refresh Cache again to continue.'),
    rule: 'Refresh Cache rebuilds missing closed months first, then replaces the current month. It does not reset completed months.',
    currentMonth: currentMonth,
    targetMonthsTotal: targetMonths.length,
    cachedMonthsTotal: cachedMonths.length,
    missingClosedMonthsRemaining: missingClosed.length,
    nextMissingMonth: missingClosed[0] || '',
    currentMonthRefreshed: currentMonthRefreshed,
    processedThisRun: processed,
    errorsThisRun: errors,
    cachedMonths: cachedMonths,
    cacheIndexFileId: index && index.fileId ? index.fileId : props.getProperty(remakeFactorCacheIndexFileIdPropertyV118) || '',
    generatedAt: new Date().toISOString()
  };
  Logger.log(JSON.stringify(response, null, 2));

  // The web dashboard expects a normal dashboard payload with detailRows. After
  // the smart refresh updates Drive shards, return the saved cache payload so
  // the chart/table can render immediately instead of showing only a status
  // object. The status is embedded under stats.smartRefresh.
  try {
    const cachedPayload = readRemakeFactorCache();
    if (cachedPayload && cachedPayload.detailRows) {
      cachedPayload.version = remakeFactorSmartRefreshVersionV123;
      cachedPayload.storageMode = remakeFactorCacheStorageModeV118;
      cachedPayload.message = response.message;
      cachedPayload.smartRefresh = response;
      cachedPayload.stats = Object.assign({}, cachedPayload.stats || {}, {
        version: remakeFactorSmartRefreshVersionV123,
        smartRefreshStatus: response.status,
        smartRefreshMessage: response.message,
        smartRefreshMissingClosedMonthsRemaining: response.missingClosedMonthsRemaining,
        smartRefreshNextMissingMonth: response.nextMissingMonth,
        smartRefreshCurrentMonthRefreshed: response.currentMonthRefreshed,
        smartRefreshProcessedThisRun: response.processedThisRun
      });
      return cachedPayload;
    }
  } catch (error) {
    response.cacheReadAfterRefreshError = compactRemakeFactorError(error);
  }

  return response;
}

/**
 * v1.33.1 browser-ready follow-up scheduler.
 * Any successful source-cache refresh schedules a separate execution to rebuild
 * the consolidated gzip file. This keeps the web request memory-safe while
 * ensuring other users receive the newest manually or nightly refreshed data.
 */
const remakeFactorBrowserReadyFollowUpHandlerV1331 = 'refreshRemakeFactorBrowserReadyCacheAfterSourceUpdateV1331';

function scheduleRemakeFactorBrowserReadyRebuildV1331() {
  const existing = ScriptApp.getProjectTriggers().filter(trigger =>
    trigger.getHandlerFunction && trigger.getHandlerFunction() === remakeFactorBrowserReadyFollowUpHandlerV1331
  );
  existing.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger(remakeFactorBrowserReadyFollowUpHandlerV1331)
    .timeBased()
    .after(60 * 1000)
    .create();
  return {
    ok: true,
    version: 'RemakeFactorCache v1.33.2',
    handlerFunction: remakeFactorBrowserReadyFollowUpHandlerV1331,
    message: 'Scheduled an isolated browser-ready cache rebuild after the source cache update.'
  };
}

function refreshRemakeFactorBrowserReadyCacheAfterSourceUpdateV1331() {
  try {
    return rebuildRemakeFactorBrowserReadyCacheV1330();
  } finally {
    ScriptApp.getProjectTriggers().forEach(trigger => {
      if (trigger.getHandlerFunction && trigger.getHandlerFunction() === remakeFactorBrowserReadyFollowUpHandlerV1331) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  }
}

function scheduleBrowserReadyRebuildForSuccessfulRefreshV1331(payload) {
  if (!payload || payload.ok === false) return payload;
  try {
    const scheduled = scheduleRemakeFactorBrowserReadyRebuildV1331();
    payload.stats = Object.assign({}, payload.stats || {}, {
      browserReadyRebuildScheduled: !!(scheduled && scheduled.ok),
      browserReadyRebuildHandler: remakeFactorBrowserReadyFollowUpHandlerV1331
    });
  } catch (error) {
    payload.stats = Object.assign({}, payload.stats || {}, {
      browserReadyRebuildScheduled: false,
      browserReadyRebuildScheduleError: compactRemakeFactorError(error)
    });
  }
  return payload;
}

// Override the public data entry point so the dashboard Refresh button uses the
// smart missing-month/current-month behavior. Non-refresh loads still read the
// saved Drive monthly shards only.
function getRemakeFactorData(options) {
  const requestedOptions = options || {};
  const compactForBrowser = requestedOptions.compactForBrowser === true || requestedOptions.browserCompact === true;

  function finishResponseV1324(payload) {
    if (!compactForBrowser || !payload || payload.browserRowsNormalized === true) return payload;
    const hasRows = Array.isArray(payload.rows) || Array.isArray(payload.detailRows);
    return hasRows ? compactRemakeFactorPayloadForBrowserV1323(payload) : payload;
  }

  if (requestedOptions.forceRefresh) {
    try {
      if (requestedOptions.fullRefresh || requestedOptions.historicalRebuild) {
        const historicalPayload = runRemakeFactorHistoricalRebuildV122({
          reset: !!requestedOptions.resetHistoricalCache,
          mode: requestedOptions.resetHistoricalCache ? 'full' : 'chunk',
          monthsPerRun: Math.max(1, Number(requestedOptions.monthsPerRun || 3)),
          maxRunMs: Math.max(60000, Number(requestedOptions.maxRunMs || 4.75 * 60 * 1000))
        });
        return finishResponseV1324(scheduleBrowserReadyRebuildForSuccessfulRefreshV1331(historicalPayload));
      }
      const refreshedPayload = refreshRemakeFactorMissingThenCurrentV123(requestedOptions);
      return finishResponseV1324(scheduleBrowserReadyRebuildForSuccessfulRefreshV1331(refreshedPayload));
    } catch (error) {
      return buildRemakeFactorErrorResponse('Remake Factor smart refresh failed', error, requestedOptions);
    }
  }

  try {
    const cached = readRemakeFactorCache({ compactForBrowser: compactForBrowser });
    if (cached && cached.ok) return cached;
    if (cached && cached.message) return cached;
  } catch (error) {
    return buildRemakeFactorErrorResponse('Remake Factor cache read failed', error, requestedOptions);
  }

  return {
    ok: false,
    version: remakeFactorSmartRefreshVersionV123,
    storageMode: remakeFactorCacheStorageModeV118,
    message: 'No Remake Factor cache exists yet. Click Refresh Cache to build missing months, then replace the current month.',
    generatedAt: '',
    detailRows: [],
    stats: getRemakeFactorSafeHealthSummary()
  };
}

function getRemakeFactorRebuildStatusV123() {
  const index = readRemakeFactorCacheIndexV118();
  const targetMonths = getRemakeFactorComparisonMonthsV120();
  const currentMonth = getRemakeFactorCurrentMonthKeyV123();
  const missingClosed = getRemakeFactorMissingClosedMonthsV123(index || {});
  const cachedMonths = index && (index.months || Object.keys(index.shards || {})) || [];
  return {
    ok: true,
    version: remakeFactorSmartRefreshVersionV123,
    storageMode: remakeFactorCacheStorageModeV118,
    currentMonth: currentMonth,
    targetMonths: targetMonths,
    cachedMonths: cachedMonths.slice().sort(),
    missingClosedMonths: missingClosed,
    missingClosedMonthsRemaining: missingClosed.length,
    nextMissingMonth: missingClosed[0] || '',
    readyForDashboard: missingClosed.length === 0 && cachedMonths.indexOf(currentMonth) !== -1,
    generatedAt: new Date().toISOString()
  };
}


/**
 * One-time department migration for existing Remake monthly shards.
 * Fetches the product catalog once, rewrites only department fields in each
 * existing shard, and schedules the browser-ready gzip rebuild. No case pull is
 * performed.
 */
function migrateRemakeFactorDepartmentsFromProductsApi() {
  const props = PropertiesService.getScriptProperties();
  const config = getRemakeFactorConfig(props, { fetchProductMap: true, useProductLookup: false });
  const token = authenticateRemakeFactorApi(config);
  const productMap = fetchRemakeFactorProductMap(config, token) || {};
  const productMapUpper = {};
  Object.keys(productMap).forEach(function(productId) {
    productMapUpper[String(productId).toUpperCase()] = productMap[productId];
  });
  const index = readRemakeFactorCacheIndexV118();
  if (!index || !index.ok) throw new Error('No valid Remake Factor monthly shard index is available.');
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
    const rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
    rows.forEach(function(row) {
      scannedRows++;
      const productId = cleanRemakeFactorText(row.productId || row.productID || '');
      const product = productMap[productId] || productMapUpper[productId.toUpperCase()] || null;
      const apiDepartment = normalizeRemakeFactorDepartment(product && product.department || '');
      if (!apiDepartment) {
        if (productId) unmapped[productId] = true;
        return;
      }
      mappedRows++;
      if (cleanRemakeFactorText(row.department) !== apiDepartment || cleanRemakeFactorText(row.departmentSource) !== 'MagicTouch Products.department') {
        row.department = apiDepartment;
        row.departmentSource = 'MagicTouch Products.department';
        row.productGroup = normalizeRemakeFactorProductGroup(row.productGroup || row.taxGroup || '', apiDepartment);
        changedRows++;
      }
    });
    parsed.rows = rows;
    parsed.generatedAt = generatedAt;
    parsed.departmentSource = 'MagicTouch Products.department';
    file.setContent(JSON.stringify(parsed));
    shard.generatedAt = generatedAt;
    shard.departmentSource = 'MagicTouch Products.department';
  });

  index.generatedAt = generatedAt;
  index.message = 'Remake Factor departments migrated from MagicTouch Products.department.';
  index.stats = Object.assign({}, index.stats || {}, {
    departmentSource: 'MagicTouch Products.department',
    departmentMigrationAt: generatedAt,
    departmentMigrationScannedRows: scannedRows,
    departmentMigrationMappedRows: mappedRows,
    departmentMigrationChangedRows: changedRows,
    departmentMigrationUnmappedProductCount: Object.keys(unmapped).length
  });
  writeRemakeFactorCacheIndexV118(index);
  let scheduled = null;
  if (typeof scheduleRemakeFactorBrowserReadyRebuildV1331 === 'function') scheduled = scheduleRemakeFactorBrowserReadyRebuildV1331();
  return {
    ok: true,
    source: 'MagicTouch /api/Products/QueryProducts department',
    scannedRows: scannedRows,
    mappedRows: mappedRows,
    changedRows: changedRows,
    unmappedProductCount: Object.keys(unmapped).length,
    browserReadyRebuildScheduled: !!(scheduled && scheduled.ok),
    message: 'Remake monthly shards now use Products.department. The browser-ready cache rebuild was scheduled.'
  };
}
