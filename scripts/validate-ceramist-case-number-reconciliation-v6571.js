#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'DashboardMainScript.html');
const cachePath = path.join(root, 'RemakeFactorCache.js');
const profilerPath = path.join(root, 'CaeramistRemakeProfiler.js');
const updaterPath = path.join(root, 'CeramistIncrementalUpdater.js');
let failed = false;

function fail(message) {
  console.error('ERROR: ' + message);
  failed = true;
}

function pass(message) {
  console.log('PASS: ' + message);
}

function requireMarker(text, marker, message) {
  if (!text.includes(marker)) fail(message + ' Missing marker: ' + marker);
  else pass(message);
}

function requireAbsent(text, marker, message) {
  if (text.includes(marker)) fail(message + ' Forbidden marker: ' + marker);
  else pass(message);
}

function requireBefore(text, first, second, message) {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  if (a < 0 || b < 0 || a >= b) fail(message + ' Expected order was not found.');
  else pass(message);
}

function syntaxCheckJavaScript(source, filename) {
  try {
    new vm.Script(source, { filename });
    pass(filename + ' JavaScript syntax is valid.');
  } catch (error) {
    fail(error.message);
  }
}

[mainPath, cachePath, profilerPath, updaterPath].forEach(function(filePath) {
  if (!fs.existsSync(filePath)) fail('Missing file: ' + path.basename(filePath));
});

if (!failed) {
  const main = fs.readFileSync(mainPath, 'utf8');
  const cache = fs.readFileSync(cachePath, 'utf8');
  const profiler = fs.readFileSync(profilerPath, 'utf8');
  const updater = fs.readFileSync(updaterPath, 'utf8');

  requireMarker(cache, 'Version: v1.34.2 - 2026-07-31', 'Remake cache release stamp is current.');
  requireMarker(cache, 'const remakeCaseIdFieldPresent = Object.keys(caseRow || {}).some', 'Durable Remake rows record whether CRM supplied remakeCaseID.');
  requireMarker(cache, 'remakeCaseId: remakeCaseId,', 'Durable Remake rows preserve remakeCaseId.');
  requireMarker(cache, 'remakeCaseID: remakeCaseId,', 'Durable Remake rows preserve the canonical remakeCaseID alias.');
  requireMarker(cache, 'remakeCaseIdFieldPresent: remakeCaseIdFieldPresent,', 'Durable rows distinguish a confirmed blank link from an old missing field.');
  requireMarker(cache, "const caseNumber = cleanRemakeFactorText(row.caseNumber || row.caseNo || row.Cases_CaseNumber || '');", 'Compact Remake rows retain numeric caseNumber.');
  requireMarker(cache, 'caseNumbers: [],', 'Packed browser-ready cache retains the case-number dictionary.');
  requireMarker(cache, "scalarIndex('caseNumbers', row.caseNumber || '')", 'Packed browser-ready rows append caseNumber.');

  requireMarker(profiler, 'Version: 7.8.1', 'Ceramist profiler release stamp is current.');
  requireMarker(profiler, "const ceramistPopulationVersionV77 = 'complete-remake-population-v7.7.1';", 'Complete-population contract is declared.');
  requireMarker(profiler, "const ceramistPopulationChainLookupVersionV771 = 'crm-remakeCaseID-confirmed-v7.7.1';", 'Confirmed CRM chain lookup contract is declared.');
  requireMarker(profiler, 'function ceramistReconcileCompleteRemakePopulationV77_(existingRows)', 'Complete Remake population reconciliation is installed.');
  requireMarker(profiler, 'const remakePayload = readRemakeFactorCache();', 'The durable Remake cache is the population source of truth.');
  requireMarker(profiler, 'function ceramistResolveRemakeChainV77_(row, mainCaseById, apiContext)', 'CRM remakeCaseID chains are resolved for missing sidecar cases.');
  requireMarker(profiler, 'function refreshCeramistCaseLevelResponsibilityNightlyV75()', 'The existing trigger-compatible refresh function is retained.');
  requireMarker(
    profiler,
    'return refreshCeramistIncrementalNightlyV780();',
    'The stable nightly entry point delegates to open-month incremental maintenance.'
  );
  requireMarker(
    updater,
    'ceramistApplyCaseLevelResponsibilityV74_(rebuiltRows);',
    'Incremental open-month rows calculate CERAMICS responsibility before the sidecar is written.'
  );
  requireMarker(updater, "payload.populationVersion = ceramistHistoricalSeedVersionV780;", 'The Drive sidecar records its historical population version.');
  requireMarker(profiler, "row.attributionBasis = 'population_chain_pending';", 'Deferred API work has an explicit non-misleading reason.');
  requireMarker(profiler, "row.attributionBasis = 'population_chain_error';", 'CRM chain errors have an explicit non-misleading reason.');
  requireMarker(
    profiler,
    "row.attributionBasis = 'remake_case_id_unavailable';",
    'The missing current-link state remains explicit and non-misleading.'
  );
  requireMarker(
    updater,
    "'unlinked_unconfirmed'",
    'The incremental updater preserves current cases whose CRM detail omits remakeCaseID.'
  );
  requireMarker(profiler, 'QueryCases can expose the remakeCaseID field while leaving its value blank.', 'Blank QueryCases relationship values are not treated as authoritative.');
  requireMarker(profiler, 'row.populationChainConfirmed = !!(chain && chain.confirmed === true);', 'Confirmed chain state is persisted in the sidecar.');
  requireMarker(profiler, 'existing_confirmed_unlinked_case', 'Confirmed terminal cases can be safely reused.');

  requireMarker(main, '// v6.573: Reconcile the complete Remake population to the Ceramist sidecar', 'v6.573 native reconciliation is installed.');
  requireMarker(main, 'window.cdaCeramistPopulationReconciliationV6573 = ceramistPopulationApiV6573;', 'Live v6.573 audit is exposed.');
  requireMarker(main, "row.attributionBasis = 'missing_sidecar_record';", 'A missing sidecar record is distinguished from a missing CERAMICS task.');
  requireMarker(main, 'No Ceramist attribution sidecar record exists for this remake case', 'The accurate sidecar-missing explanation is present.');
  requireMarker(main, "if (basis === 'population_chain_pending')", 'The dashboard explains deferred population-chain work.');
  requireMarker(main, "if (basis === 'population_chain_error')", 'The dashboard explains population-chain errors.');

  [
    'Click to filter the dashboard',
    'Click selected row again to clear',
    'Select a row',
    'Select this worker',
    '|| true'
  ].forEach(function(marker) {
    requireAbsent(main + '\n' + profiler + '\n' + updater + '\n' + cache, marker, 'Obsolete, noisy, or permissive code is absent.');
  });

  syntaxCheckJavaScript(cache, 'RemakeFactorCache.js');
  syntaxCheckJavaScript(profiler, 'CaeramistRemakeProfiler.js');
  syntaxCheckJavaScript(updater, 'CeramistIncrementalUpdater.js');

  const scriptMatch = main.match(/^\s*<script>\s*([\s\S]*?)\s*<\/script>\s*$/);
  if (!scriptMatch) {
    fail('DashboardMainScript.html is not one complete script partial.');
  } else {
    const syntaxSource = scriptMatch[1].replace(/<\?[\s\S]*?\?>/g, 'null');
    syntaxCheckJavaScript(syntaxSource, 'DashboardMainScript.html');
  }

  // Prove the durable Remake row stores the link while the compact browser row
  // still preserves independent GUID caseId and numeric caseNumber.
  try {
    const cacheContext = { console };
    vm.createContext(cacheContext);
    vm.runInContext(cache, cacheContext, { filename: 'RemakeFactorCache.js' });
    const detailRows = cacheContext.buildRemakeFactorDetailRows([
      {
        caseID: 'CURRENT-GUID',
        caseNumber: 389666,
        remakeCaseID: 'ROOT-GUID',
        invoiceDate: '2026-07-24',
        customerID: '100496',
        caseProducts: [{
          id: 'LINE-1',
          productID: 'ZIRPRF11PC',
          invoiceDescription: 'Fixed - Zirfit Prime - Posterior Crown',
          quantity: 2,
          totalCharge: 0,
          remake: 'Remake 100%',
          remakeReason: 'Margin Open',
          remakeDiscount: 290
        }]
      }
    ], {}, {});
    if (!detailRows.length || detailRows[0].remakeCaseId !== 'ROOT-GUID' || detailRows[0].remakeCaseIdFieldPresent !== true) {
      fail('Durable Remake row did not preserve remakeCaseID and its field-presence flag.');
    } else {
      pass('Durable Remake row preserves authoritative remakeCaseID.');
    }
    const compactRow = cacheContext.buildRemakeFactorBrowserRowV1323(detailRows[0]);
    if (compactRow.caseId !== 'CURRENT-GUID' || compactRow.caseNumber !== '389666') {
      fail('Compact row did not preserve independent caseId and caseNumber.');
    } else {
      pass('Compact row preserves GUID caseId and numeric caseNumber independently.');
    }
  } catch (error) {
    fail(error && error.stack ? error.stack : String(error));
  }

  // Reproduce the verified 389666 -> 385918 case without hard-coding it in the
  // production logic. BigQuery has completed CERAMICS by Jhan on both cases.
  try {
    const context = {
      console,
      JSON,
      Date,
      Math,
      Number,
      String,
      Object,
      Array,
      Set,
      Map,
      RegExp,
      PropertiesService: {
        getScriptProperties() {
          return { getProperty(name) { return name === 'MT_CERAMIST_POPULATION_MAX_API_CALLS' ? '160' : ''; } };
        }
      },
      CacheService: { getScriptCache() { return { get() { return null; }, put() {} }; } },
      SpreadsheetApp: {},
      DriveApp: {},
      MailApp: {},
      LockService: {},
      ScriptApp: {},
      Utilities: { sleep() {} },
      BigQuery: {}
    };
    vm.createContext(context);
    vm.runInContext(profiler, context, { filename: 'CaeramistRemakeProfiler.js' });
    context.readRemakeFactorCache = function() {
      return {
        ok: true,
        generatedAt: '2026-07-31T16:00:00.000Z',
        detailRows: [
          {
            month: '2026-07', year: 2026, invoiceDate: '2026-07-24',
            caseId: 'current-guid', caseNumber: 389666,
            remakeCaseId: '', remakeCaseID: '', remakeCaseIdFieldPresent: true,
            customerId: '100496', customerName: 'UOP: School of Dentistry',
            department: 'Fixed', productId: 'ZIRPRF11PC',
            productName: 'Fixed - Zirfit Prime - Posterior Crown', productGroup: 'Crown',
            lineId: 'line-1', quantity: 2, isRemake: true, remakeUnits: 2,
            remakeDiscount: 290, remakeReason: 'Margin Open'
          },
          {
            month: '2026-05', year: 2026, invoiceDate: '2026-05-13',
            caseId: 'root-guid', caseNumber: 385918,
            customerId: '100496', customerName: 'UOP: School of Dentistry',
            department: 'Fixed', productId: 'ZIRPRF11PC',
            productName: 'Fixed - Zirfit Prime - Posterior Crown', productGroup: 'Crown',
            lineId: 'root-line', quantity: 2, isRemake: false
          }
        ]
      };
    };
    context.getRemakeFactorConfig = function() { return { baseUrl: 'https://example.invalid' }; };
    context.authenticateRemakeFactorApi = function() { return 'token'; };
    context.fetchRemakeFactorCaseDetail = function(cfg, token, caseId) {
      if (caseId === 'root-guid') return { caseID: 'root-guid', caseNumber: 385918, remakeCaseID: '' };
      if (caseId === 'current-guid') return { caseID: 'current-guid', caseNumber: 389666, remakeCaseID: 'root-guid' };
      throw new Error('Unexpected caseId: ' + caseId);
    };
    context.ceramistRunBigQuery_ = function() {
      return [
        { case_number: 385918, completed_rows: 1, missing_worker_rows: 0, workers_json: '["Jhan"]', sequences_json: '[800]', product_ids_json: '["ZIRPRF11PC"]' },
        { case_number: 389666, completed_rows: 1, missing_worker_rows: 0, workers_json: '["Jhan"]', sequences_json: '[800]', product_ids_json: '["ZIRPRF11PC"]' }
      ];
    };

    const population = context.ceramistReconcileCompleteRemakePopulationV77_([]);
    context.ceramistApplyCaseLevelResponsibilityV74_(population.rows);
    const row = population.rows[0] || {};
    const correct = String(row.currentCaseNumber) === '389666' &&
      String(row.previousCaseNumber) === '385918' &&
      String(row.rootCaseNumber) === '385918' &&
      Number(row.chainDepth) === 1 &&
      row.responsibleCeramist === 'Jhan' &&
      row.currentCeramist === 'Jhan' &&
      row.attributionStatus === 'attributed' &&
      row.attributionBasis === 'root_case_level';
    if (!correct) {
      fail('Verified 389666 -> 385918 attribution scenario failed: ' + JSON.stringify(row));
    } else {
      pass('Verified 389666 -> 385918 scenario attributes Jhan from completed CERAMICS.');
    }
    if (population.stats.populationSynthesizedRows !== 1 || population.stats.populationApiCalls !== 2) {
      fail('Population reconciliation stats are incorrect: ' + JSON.stringify(population.stats));
    } else {
      pass('Blank QueryCases link is confirmed through current and root CRM case details.');
    }
  } catch (error) {
    fail(error && error.stack ? error.stack : String(error));
  }

  // A blank QueryCases value may only become unlinked after case detail
  // explicitly returns a blank remakeCaseID. API-cap and lookup failures must
  // remain retryable and must never be mislabeled as unlinked.
  try {
    const context = {
      console,
      JSON,
      Date,
      Math,
      Number,
      String,
      Object,
      Array,
      Set,
      Map,
      RegExp,
      PropertiesService: { getScriptProperties() { return { getProperty() { return ''; } }; } },
      CacheService: { getScriptCache() { return { get() { return null; }, put() {} }; } },
      SpreadsheetApp: {},
      DriveApp: {},
      MailApp: {},
      LockService: {},
      ScriptApp: {},
      Utilities: { sleep() {} },
      BigQuery: {}
    };
    vm.createContext(context);
    vm.runInContext(profiler, context, { filename: 'CaeramistRemakeProfiler.js' });

    const mainCaseById = {};
    const blankQueryRow = {
      caseId: 'current-guid',
      caseNumber: 389666,
      remakeCaseID: '',
      remakeCaseIdFieldPresent: true
    };

    const deferred = context.ceramistResolveRemakeChainV77_(blankQueryRow, mainCaseById, {
      cfg: null, token: '', calls: 0, maxCalls: 0, detailById: {}, errors: []
    });
    if (deferred.status !== 'deferred' || deferred.confirmed !== false) {
      fail('API-cap result was mislabeled: ' + JSON.stringify(deferred));
    } else {
      pass('API-cap result remains deferred and retryable.');
    }

    context.getRemakeFactorConfig = function() { return { baseUrl: 'https://example.invalid' }; };
    context.authenticateRemakeFactorApi = function() { return 'token'; };
    context.fetchRemakeFactorCaseDetail = function(cfg, token, caseId) {
      if (caseId === 'current-guid') return { caseID: 'current-guid', caseNumber: 389666, remakeCaseID: '' };
      throw new Error('Unexpected caseId: ' + caseId);
    };
    const confirmedUnlinked = context.ceramistResolveRemakeChainV77_(blankQueryRow, mainCaseById, {
      cfg: null, token: '', calls: 0, maxCalls: 5, detailById: {}, errors: []
    });
    if (confirmedUnlinked.status !== 'unlinked' || confirmedUnlinked.confirmed !== true ||
        confirmedUnlinked.lookupVersion !== 'crm-remakeCaseID-confirmed-v7.7.1') {
      fail('Explicit blank case detail was not persisted as confirmed unlinked: ' + JSON.stringify(confirmedUnlinked));
    } else {
      pass('Only an explicit blank CRM case detail becomes confirmed unlinked.');
    }

    const existingConfirmed = Object.assign({}, blankQueryRow, {
      currentCaseNumber: 389666,
      populationChainStatus: 'unlinked',
      populationChainConfirmed: true,
      populationChainLookupVersion: 'crm-remakeCaseID-confirmed-v7.7.1',
      populationChainCheckedAt: '2026-07-31T17:00:00.000Z'
    });
    const reused = context.ceramistPopulationChainFromRowV77_(existingConfirmed);
    if (reused.status !== 'unlinked' || reused.confirmed !== true) {
      fail('Confirmed unlinked chain was not reusable: ' + JSON.stringify(reused));
    } else {
      pass('Confirmed unlinked chain is durable and reusable without another API call.');
    }
  } catch (error) {
    fail(error && error.stack ? error.stack : String(error));
  }

  // Prove the browser join still preserves complete main population and uses an
  // accurate reason only when the durable backend sidecar has not caught up yet.
  const blockStart = main.indexOf('// v6.573: Reconcile the complete Remake population to the Ceramist sidecar');
  const blockEnd = main.indexOf('  function ceramistRowsInDashboardScopeV6342(ignoreFilterKind)', blockStart);
  if (blockStart < 0 || blockEnd <= blockStart) {
    fail('Could not isolate the v6.573 reconciliation block.');
  } else {
    const block = main.slice(blockStart, blockEnd);
    const context = {
      console,
      Map,
      Set,
      Object,
      Array,
      Number,
      String,
      Math,
      runtimeMainRows: [],
      mainCacheSwapActiveV6346: false,
      browserCacheWriteScheduledV6346: false,
      loadCeramistRemakeAnalysisV6342() {},
      window: {
        remakeFactorState: { data: { generatedAt: '2026-07-31T09:00:00.000Z' } },
        setTimeout() { return 1; }
      },
      ceramistStateV6342: {
        loading: false,
        loaded: true,
        ok: true,
        rows: [],
        cacheToken: 'cache-token-v6573',
        caseLevelRefreshedAt: ''
      },
      normalizedRowsV6230() { return context.runtimeMainRows; },
      textV6230(value, fallback) {
        const text = value === null || value === undefined ? '' : String(value).trim();
        return text || (fallback === null || fallback === undefined ? '' : String(fallback));
      },
      numV6230(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
      },
      isRemakeV6230(row) { return !!(row && row.isRemake === true); },
      ceramistIsAttributedV6343(row) {
        const worker = String(row && row.responsibleCeramist || '').trim();
        return String(row && row.attributionStatus || '') === 'attributed' && worker && worker !== '[Unattributed]';
      }
    };
    context.window.window = context.window;
    vm.createContext(context);

    try {
      vm.runInContext(block, context, { filename: 'DashboardMainScript.html#v6.573-population' });
      const join = context.ceramistBuildCompletePopulationV6569;
      const sidecarRows = [{
        currentCaseNumber: '100', currentProductId: 'A', productId: 'A', productName: 'Product A',
        remakeUnits: 1, remakeDiscount: 10, remakeReason: 'Reason A',
        responsibleCeramist: 'worker-1', responsibleCeramistDisplay: 'Worker One',
        attributionStatus: 'attributed', attributionBasis: 'root_case_level'
      }];
      const mainRows = [
        { month: '2026-07', year: 2026, caseId: 'guid-100', caseNumber: '100', productId: 'A', productKey: 'A', productName: 'Product A', productGroup: 'Group A', department: 'Fixed', customerId: 'C1', customerName: 'Customer One', remakeReason: 'Reason A', quantity: 1, remakeUnits: 1, remakeDiscount: 10, isRemake: true },
        { month: '2026-07', year: 2026, caseId: 'guid-101', caseNumber: '101', productId: 'B', productKey: 'B', productName: 'Product B', productGroup: 'Group B', department: 'Fixed', customerId: 'C2', customerName: 'Customer Two', remakeReason: 'Reason B', quantity: 1, remakeUnits: 1, remakeDiscount: 20, isRemake: true }
      ];
      context.runtimeMainRows = mainRows;
      context.ceramistStateV6342.rows = sidecarRows;
      const joined = join(sidecarRows, mainRows);
      const unmatched = joined.find(function(row) { return row.caseNumber === '101'; }) || {};
      const audit = context.window.cdaCeramistPopulationReconciliationV6573.audit();
      if (joined.length !== 2 || unmatched.attributionBasis !== 'missing_sidecar_record' ||
          unmatched.attributionReason !== 'No Ceramist attribution sidecar record exists for this remake case') {
        fail('Browser fallback did not use the accurate missing-sidecar contract: ' + JSON.stringify(unmatched));
      } else {
        pass('Browser fallback distinguishes a missing sidecar record from a missing CERAMICS task.');
      }
      if (!audit.complete || audit.version !== 'v6.573' || audit.synthesizedUnattributedRows !== 1) {
        fail('v6.573 browser reconciliation audit is incorrect: ' + JSON.stringify(audit));
      } else {
        pass('v6.573 browser reconciliation audit is complete and accurate.');
      }
    } catch (error) {
      fail(error && error.stack ? error.stack : String(error));
    }
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('Complete Ceramist population validation passed.');
  console.log('Dashboard: v6.573');
  console.log('RemakeFactorCache: v1.34.2');
  console.log('CaeramistRemakeProfiler: v7.8.1');
  console.log('Confirmed blank remakeCaseID handling: passed');
  console.log('Deferred/error retry contract: passed');
  console.log('Durable confirmed-unlinked reuse: passed');
  console.log('Complete Remake population source: passed');
  console.log('CRM remakeCaseID chain resolution: passed');
  console.log('389666 -> 385918 -> Jhan regression: passed');
  console.log('Accurate missing-sidecar reason: passed');
  console.log('Technician tooltip action-copy removal: passed');
}
