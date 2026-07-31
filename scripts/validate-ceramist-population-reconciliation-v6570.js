#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'DashboardMainScript.html');
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

if (!fs.existsSync(mainPath)) {
  fail('Missing DashboardMainScript.html.');
  process.exitCode = 1;
} else {
  const main = fs.readFileSync(mainPath, 'utf8');

  requireMarker(main, '/* v6.568 native combined cache refresh.', 'Native combined refresh remains installed.');
  requireMarker(main, '// v6.570: The main Remake cache owns the complete remake population.', 'Sidecar-ready population reconciliation is installed.');
  requireMarker(main, 'function ceramistPopulationQueueSidecarRefreshV6570()', 'Missing sidecar payload triggers a native reload.');
  requireMarker(main, 'const emptySavedBrowserPayloadV6570 = fromBrowser === true && receivedRows.length === 0;', 'An empty saved browser payload is rejected.');
  requireMarker(main, 'Loading technician attribution before building the Unattributed group...', 'The UI waits instead of labeling every case Unattributed.');
  requireMarker(main, 'function ceramistPopulationCaseRepresentativesV6570(rows)', 'Case-level responsibility fallback exists.');
  requireMarker(main, 'row.currentCaseNumber', 'Sidecar current-case aliases are supported.');
  requireMarker(main, 'row.currentProductId', 'Sidecar current-product aliases are supported.');
  requireMarker(main, 'window.cdaCeramistPopulationReconciliationV6570 = ceramistPopulationApiV6570;', 'Live v6.570 audit is exposed.');
  requireMarker(main, 'liveSidecarRows:sidecarRows.length', 'Audit reports the live sidecar row count.');
  requireMarker(main, "attributionBasis = 'not_current_product_ceramics_eligible';", 'Only genuinely unmatched cases become Unattributed.');

  const forbidden = [
    "version:'v6.569',\n    audit:function()",
    'RemakeCombinedRefreshV6569',
    'cdaRemakeTechnicianReconciliationV6568',
    '|| true'
  ];
  forbidden.forEach(function(marker) {
    if (main.includes(marker)) fail('Obsolete or permissive code remains: ' + marker);
    else pass('Forbidden marker absent: ' + marker);
  });

  const scriptMatch = main.match(/^\s*<script>\s*([\s\S]*?)\s*<\/script>\s*$/);
  if (!scriptMatch) {
    fail('DashboardMainScript.html is not one complete script partial.');
  } else {
    const syntaxSource = scriptMatch[1].replace(/<\?!=[\s\S]*?\?>/g, 'null');
    try {
      new vm.Script(syntaxSource, { filename: 'DashboardMainScript.html' });
      pass('Full DashboardMainScript JavaScript syntax is valid.');
    } catch (error) {
      fail(error.message);
    }
  }

  const blockStart = main.indexOf('// v6.570: The main Remake cache owns the complete remake population.');
  const blockEnd = main.indexOf('  function ceramistRowsInDashboardScopeV6342(ignoreFilterKind)', blockStart);
  if (blockStart < 0 || blockEnd <= blockStart) {
    fail('Could not isolate the v6.570 population reconciliation block.');
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
        remakeFactorState: {
          data: { generatedAt: '2026-07-31T09:00:00.000Z' }
        },
        setTimeout() { return 1; }
      },
      ceramistStateV6342: {
        loading: false,
        loaded: true,
        ok: true,
        rows: [],
        cacheToken: 'cache-token-v6570',
        caseLevelRefreshedAt: ''
      },
      normalizedRowsV6230() {
        return context.runtimeMainRows;
      },
      textV6230(value, fallback) {
        const text = value === null || value === undefined ? '' : String(value).trim();
        return text || (fallback === null || fallback === undefined ? '' : String(fallback));
      },
      numV6230(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
      },
      isRemakeV6230(row) {
        return !!(row && row.isRemake === true);
      },
      ceramistIsAttributedV6343(row) {
        const worker = String(row && row.responsibleCeramist || '').trim();
        return String(row && row.attributionStatus || '') === 'attributed' && worker && worker !== '[Unattributed]';
      },
      ceramistDistinctCaseCountV6342(rows) {
        return new Set((rows || []).map(function(row) {
          return String(row && (row.remakeCaseNumber || row.caseNumber || row.caseId) || '').trim();
        }).filter(Boolean)).size;
      }
    };
    context.window.window = context.window;
    vm.createContext(context);

    try {
      vm.runInContext(block, context, { filename: 'DashboardMainScript.html#v6.570-population' });
      const join = context.ceramistBuildCompletePopulationV6569;
      if (typeof join !== 'function') throw new Error('Population join function was not created.');

      const sidecarRows = [{
        currentCaseNumber: '100',
        currentProductId: 'A',
        remakeCaseNumber: '100',
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
      }];

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
        }
      ];

      context.runtimeMainRows = mainRows;
      context.ceramistStateV6342.rows = sidecarRows;
      const joined = join(sidecarRows, mainRows);
      const audit = context.window.cdaCeramistPopulationReconciliationV6570.audit();
      const attributed = joined.filter(function(row) { return row.attributionStatus === 'attributed'; });
      const unattributed = joined.filter(function(row) { return row.attributionStatus === 'unattributed'; });

      if (joined.length !== 3) fail('Runtime join did not preserve all main remake rows.');
      else pass('Runtime join preserves all main remake rows.');

      if (attributed.length !== 2 || unattributed.length !== 1) {
        fail('Runtime join did not preserve product and case-level attribution before synthesizing Unattributed.');
      } else {
        pass('Runtime join preserves product and case-level attribution.');
      }

      if (!unattributed.every(function(row) {
        return row.responsibleCeramist === '[Unattributed]' &&
          row.attributionBasis === 'not_current_product_ceramics_eligible' &&
          row.currentProductCeramicsEligible === false;
      })) {
        fail('Synthesized rows do not carry the required Unattributed contract.');
      } else {
        pass('Only unmatched cases carry the Unattributed contract.');
      }

      if (!audit.complete || audit.mainRemakeRows !== 3 || audit.joinedRows !== 3 ||
          audit.matchedRows !== 2 || audit.exactOrProductMatchedRows !== 1 ||
          audit.caseLevelMatchedRows !== 1 || audit.synthesizedUnattributedRows !== 1 ||
          audit.liveSidecarRows !== 1 || audit.mainRemakeCases !== 2 || audit.joinedCases !== 2) {
        fail('Runtime reconciliation audit is incorrect: ' + JSON.stringify(audit));
      } else {
        pass('Runtime audit proves live sidecar and joined-population completeness.');
      }

      context.ceramistStateV6342.rows = [];
      const waitingRows = join([], mainRows);
      const waitingAudit = context.window.cdaCeramistPopulationReconciliationV6570.audit();
      if (waitingRows.length !== 0 || waitingAudit.waitingForSidecar !== true || waitingAudit.synthesizedUnattributedRows !== 0) {
        fail('Empty sidecar incorrectly synthesized every Remake row as Unattributed.');
      } else {
        pass('Empty sidecar waits and does not synthesize false Unattributed rows.');
      }
    } catch (error) {
      fail(error && error.stack ? error.stack : String(error));
    }
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('Ceramist sidecar-ready population reconciliation validation passed.');
  console.log('Version: v6.570');
  console.log('Empty saved browser cache rejection: passed');
  console.log('Sidecar readiness gate: passed');
  console.log('Product and case-level attribution preservation: passed');
  console.log('Unattributed fallback after sidecar readiness: passed');
  console.log('Live runtime audit: passed');
}
