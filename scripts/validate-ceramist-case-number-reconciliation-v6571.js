#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'DashboardMainScript.html');
const cachePath = path.join(root, 'RemakeFactorCache.js');
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

function syntaxCheckJavaScript(source, filename) {
  try {
    new vm.Script(source, { filename });
    pass(filename + ' JavaScript syntax is valid.');
  } catch (error) {
    fail(error.message);
  }
}

if (!fs.existsSync(mainPath)) fail('Missing DashboardMainScript.html.');
if (!fs.existsSync(cachePath)) fail('Missing RemakeFactorCache.js.');

if (!failed) {
  const main = fs.readFileSync(mainPath, 'utf8');
  const cache = fs.readFileSync(cachePath, 'utf8');

  requireMarker(cache, 'Version: v1.34.1 - 2026-07-31', 'Remake cache release stamp is current.');
  requireMarker(cache, "const caseNumber = cleanRemakeFactorText(row.caseNumber || row.caseNo || row.Cases_CaseNumber || '');", 'Compact Remake rows retain the numeric case number.');
  requireMarker(cache, 'caseNumber: caseNumber,', 'Compact browser row exposes caseNumber.');
  requireMarker(cache, 'caseNumbers: [],', 'Packed browser-ready cache has a case-number dictionary.');
  requireMarker(cache, "scalarIndex('caseNumbers', row.caseNumber || '')", 'Packed browser-ready rows append caseNumber.');
  requireMarker(cache, 'caseNumbers: dictionaries.caseNumbers.length,', 'Packed cache metadata counts case numbers.');

  requireMarker(main, 'const caseNumbers = dictionaries.caseNumbers || [];', 'Browser-ready decoder accepts the case-number dictionary.');
  requireMarker(main, "caseNumber: String(remakeDictionaryValueV6388(caseNumbers, packedRow[15], '') || ''),", 'Browser-ready decoder restores caseNumber.');
  requireMarker(main, '// v6.571: Reconcile the complete Remake population to the Ceramist sidecar', 'v6.571 native population reconciliation is installed.');
  requireMarker(main, 'GUID case IDs are intentionally not used as attribution', 'The join contract rejects GUID case IDs.');
  requireMarker(main, "waitingForMainCaseNumber:reason === 'main_case_number_missing'", 'Old browser caches safely fall back instead of synthesizing false Unattributed rows.');
  requireMarker(main, "matchMethod = 'case_level_unique_worker';", 'Case-level unique-worker responsibility is preserved.');
  requireMarker(main, 'window.cdaCeramistPopulationReconciliationV6571 = ceramistPopulationApiV6571;', 'Live v6.571 audit is exposed.');
  requireMarker(main, 'liveMainRowsWithCaseNumber:', 'Audit reports live main case-number readiness.');
  requireMarker(main, 'unattributedOnlyCases:', 'Audit reports genuinely unattributed case count.');

  const forbidden = [
    'RemakeCombinedRefreshV6569',
    'cdaRemakeTechnicianReconciliationV6568',
    '|| true'
  ];
  forbidden.forEach(function(marker) {
    if (main.includes(marker) || cache.includes(marker)) fail('Obsolete or permissive code remains: ' + marker);
    else pass('Forbidden marker absent: ' + marker);
  });

  syntaxCheckJavaScript(cache, 'RemakeFactorCache.js');

  const scriptMatch = main.match(/^\s*<script>\s*([\s\S]*?)\s*<\/script>\s*$/);
  if (!scriptMatch) {
    fail('DashboardMainScript.html is not one complete script partial.');
  } else {
    const syntaxSource = scriptMatch[1].replace(/<\?!=[\s\S]*?\?>/g, 'null');
    syntaxCheckJavaScript(syntaxSource, 'DashboardMainScript.html');
  }

  // Execute the complete cache file without invoking Apps Script services, then
  // prove the compact browser row keeps both GUID caseId and numeric caseNumber.
  try {
    const cacheContext = { console };
    vm.createContext(cacheContext);
    vm.runInContext(cache, cacheContext, { filename: 'RemakeFactorCache.js' });
    const compactRow = cacheContext.buildRemakeFactorBrowserRowV1323({
      month: '2026-07',
      invoiceDate: '2026-07-31',
      caseId: 'GUID-CASE-100',
      caseNumber: 100,
      customerId: 'C1',
      customerName: 'Customer One',
      department: 'Fixed',
      productId: 'P1',
      productName: 'Product One',
      productGroup: 'Crown',
      quantity: 1,
      isRemake: true,
      remakeUnits: 1,
      remakeDiscount: 10
    });
    if (compactRow.caseId !== 'GUID-CASE-100' || compactRow.caseNumber !== '100') {
      fail('Compact row did not preserve independent caseId and caseNumber: ' + JSON.stringify(compactRow));
    } else {
      pass('Compact row preserves GUID caseId and numeric caseNumber independently.');
    }
  } catch (error) {
    fail(error && error.stack ? error.stack : String(error));
  }

  const blockStart = main.indexOf('// v6.571: Reconcile the complete Remake population to the Ceramist sidecar');
  const blockEnd = main.indexOf('  function ceramistRowsInDashboardScopeV6342(ignoreFilterKind)', blockStart);
  if (blockStart < 0 || blockEnd <= blockStart) {
    fail('Could not isolate the v6.571 reconciliation block.');
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
        cacheToken: 'cache-token-v6571',
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
      },
      ceramistDistinctCaseCountV6342(rows) {
        return new Set((rows || []).map(function(row) {
          return String(row && (row.currentCaseNumber || row.remakeCaseNumber || row.caseNumber || row.caseId) || '').trim();
        }).filter(Boolean)).size;
      }
    };
    context.window.window = context.window;
    vm.createContext(context);

    try {
      vm.runInContext(block, context, { filename: 'DashboardMainScript.html#v6.571-population' });
      const join = context.ceramistBuildCompletePopulationV6569;
      if (typeof join !== 'function') throw new Error('Population join function was not created.');

      const sidecarRows = [
        {
          currentCaseNumber: '100',
          currentProductId: 'A',
          productId: 'A',
          productName: 'Product A',
          remakeUnits: 1,
          remakeDiscount: 10,
          remakeReason: 'Reason A',
          currentProductCeramicsEligible: true,
          responsibleCeramist: 'worker-1',
          responsibleCeramistDisplay: 'Worker One',
          attributionStatus: 'attributed',
          attributionBasis: 'root_case_level'
        },
        {
          currentCaseNumber: '101',
          currentProductId: 'C',
          productId: 'C',
          productName: 'Product C',
          remakeUnits: 1,
          remakeDiscount: 30,
          remakeReason: 'Reason C',
          currentProductCeramicsEligible: true,
          responsibleCeramist: '[Unattributed]',
          responsibleCeramistDisplay: '[Unattributed]',
          attributionStatus: 'unattributed',
          attributionBasis: 'no_case_level_ceramics_worker'
        }
      ];

      const mainRows = [
        {
          month: '2026-07', year: 2026, caseId: 'guid-100', caseNumber: '100',
          productId: 'A', productKey: 'A', productName: 'Product A', productGroup: 'Group A',
          department: 'Fixed', customerId: 'C1', customerName: 'Customer One',
          remakeReason: 'Reason A', quantity: 1, remakeUnits: 1, remakeDiscount: 10, isRemake: true
        },
        {
          month: '2026-07', year: 2026, caseId: 'guid-100', caseNumber: '100',
          productId: 'B', productKey: 'B', productName: 'Product B', productGroup: 'Group B',
          department: 'Fixed', customerId: 'C1', customerName: 'Customer One',
          remakeReason: 'Reason B', quantity: 2, remakeUnits: 2, remakeDiscount: 20, isRemake: true
        },
        {
          month: '2026-07', year: 2026, caseId: 'guid-101', caseNumber: '101',
          productId: 'C', productKey: 'C', productName: 'Product C', productGroup: 'Group C',
          department: 'Removable', customerId: 'C2', customerName: 'Customer Two',
          remakeReason: 'Reason C', quantity: 1, remakeUnits: 1, remakeDiscount: 30, isRemake: true
        },
        {
          month: '2026-07', year: 2026, caseId: 'guid-102', caseNumber: '102',
          productId: 'D', productKey: 'D', productName: 'Product D', productGroup: 'Group D',
          department: 'Implant', customerId: 'C3', customerName: 'Customer Three',
          remakeReason: 'Reason D', quantity: 1, remakeUnits: 1, remakeDiscount: 40, isRemake: true
        }
      ];

      context.runtimeMainRows = mainRows;
      context.ceramistStateV6342.rows = sidecarRows;
      const joined = join(sidecarRows, mainRows);
      const audit = context.window.cdaCeramistPopulationReconciliationV6571.audit();
      const case100Rows = joined.filter(function(row) { return row.caseNumber === '100'; });
      const case101Rows = joined.filter(function(row) { return row.caseNumber === '101'; });
      const case102Rows = joined.filter(function(row) { return row.caseNumber === '102'; });

      if (joined.length !== 4) fail('Runtime join did not preserve all main Remake rows.');
      else pass('Runtime join preserves all main Remake rows.');

      if (case100Rows.length !== 2 || !case100Rows.every(function(row) { return row.attributionStatus === 'attributed'; })) {
        fail('Exact product plus case-level unique-worker attribution was not preserved.');
      } else {
        pass('Exact product and case-level unique-worker attribution are preserved.');
      }

      if (case101Rows.length !== 1 || case101Rows[0].attributionStatus !== 'unattributed' ||
          case101Rows[0].attributionBasis !== 'no_case_level_ceramics_worker') {
        fail('Existing sidecar Unattributed reason was not preserved.');
      } else {
        pass('Existing sidecar Unattributed reason is preserved.');
      }

      if (case102Rows.length !== 1 || case102Rows[0].responsibleCeramist !== '[Unattributed]' ||
          case102Rows[0].attributionBasis !== 'not_current_product_ceramics_eligible') {
        fail('Genuinely unmatched case did not receive the synthesized Unattributed contract.');
      } else {
        pass('Only the genuinely unmatched case receives synthesized Unattributed.');
      }

      if (!audit.complete || !audit.caseNumberReady || audit.mainRemakeRows !== 4 ||
          audit.mainRowsWithCaseNumber !== 4 || audit.liveMainRowsWithCaseNumber !== 4 ||
          audit.sidecarRows !== 2 || audit.liveSidecarRows !== 2 ||
          audit.matchedRows !== 3 || audit.exactOrProductMatchedRows !== 2 ||
          audit.caseLevelMatchedRows !== 1 || audit.synthesizedUnattributedRows !== 1 ||
          audit.joinedRows !== 4 || audit.mainRemakeCases !== 3 || audit.joinedCases !== 3 ||
          audit.attributedJoinedCases !== 1 || audit.unattributedOnlyCases !== 2) {
        fail('Runtime reconciliation audit is incorrect: ' + JSON.stringify(audit));
      } else {
        pass('Runtime audit proves case-number readiness and true attributed/unattributed case counts.');
      }

      // Old compact browser rows had GUID caseId but no numeric caseNumber. The
      // safe behavior is the original sidecar view, never all-Unattributed.
      const oldBrowserRows = mainRows.map(function(row) {
        const copy = Object.assign({}, row);
        delete copy.caseNumber;
        return copy;
      });
      context.runtimeMainRows = oldBrowserRows;
      context.window.remakeFactorState.data.generatedAt = '2026-07-31T09:01:00.000Z';
      const fallbackRows = join(sidecarRows, oldBrowserRows);
      const fallbackAudit = context.window.cdaCeramistPopulationReconciliationV6571.audit();
      if (fallbackRows.length !== sidecarRows.length || fallbackAudit.fallbackToSidecar !== true ||
          fallbackAudit.waitingForMainCaseNumber !== true || fallbackAudit.synthesizedUnattributedRows !== 0 ||
          fallbackAudit.caseNumberReady !== false) {
        fail('Old browser cache did not safely fall back to the proven sidecar view: ' + JSON.stringify(fallbackAudit));
      } else {
        pass('Old browser cache safely falls back and never labels every case Unattributed.');
      }
    } catch (error) {
      fail(error && error.stack ? error.stack : String(error));
    }
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('Ceramist case-number reconciliation validation passed.');
  console.log('Version: v6.571 / RemakeFactorCache v1.34.1');
  console.log('Compact caseNumber preservation: passed');
  console.log('Packed caseNumber preservation: passed');
  console.log('Numeric case-key join: passed');
  console.log('Old browser-cache safety fallback: passed');
  console.log('Attributed and Unattributed case audit: passed');
}
