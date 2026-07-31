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
  requireMarker(main, '// v6.569: The main Remake cache owns the complete remake population.', 'Native population reconciliation is installed.');
  requireMarker(main, 'caseNumber: textV6230(row.caseNumber || row.caseNo || row.Cases_CaseNumber', 'Normalized Remake rows retain case numbers.');
  requireMarker(main, 'caseProductLineId: textV6230(', 'Normalized Remake rows retain product-line identifiers.');
  requireMarker(main, 'function ceramistBuildCompletePopulationV6569(sidecarRows, mainRows)', 'Complete population join exists.');
  requireMarker(main, "attributionBasis = 'not_current_product_ceramics_eligible';", 'Missing sidecar rows are explicitly unattributed.');
  requireMarker(main, "label:'Unattributed'", 'The native worker row displays a clean Unattributed label.');
  requireMarker(main, 'ceramistBuildCompletePopulationV6569(sidecarRows, mainRows)', 'The native technician scope uses the population join.');
  requireMarker(main, 'const rowShapeReady = !receivedRows.length', 'The technician payload accepts sidecar rows without the obsolete eligibility gate.');
  requireMarker(main, "basis === 'not_current_product_ceramics_eligible'", 'The hover reason identifies ineligible current products.');
  requireMarker(main, "unassignedCasesV6569 = 'Cases: ' + caseListTextV6349", 'The Unattributed worker hover includes case numbers.');
  requireMarker(main, "rowTooltip + ' | Click to filter the dashboard'", 'Detail-row hover exposes case numbers and reasons.');
  requireMarker(main, 'window.cdaCeramistPopulationReconciliationV6569 = Object.freeze({', 'Runtime reconciliation audit is exposed.');

  const forbidden = [
    "rows = rows.filter(function(row) { return row && row.currentProductCeramicsEligible === true; });",
    'const eligibilityReady =',
    'RemakeCombinedRefreshV6569',
    'cdaRemakeTechnicianReconciliationV6568'
  ];
  forbidden.forEach(function(marker) {
    if (main.includes(marker)) fail('Obsolete or temporary code remains: ' + marker);
    else pass('Obsolete marker absent: ' + marker);
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

  const blockStart = main.indexOf('// v6.569: The main Remake cache owns the complete remake population.');
  const blockEnd = main.indexOf('  function ceramistRowsInDashboardScopeV6342(ignoreFilterKind)', blockStart);
  if (blockStart < 0 || blockEnd <= blockStart) {
    fail('Could not isolate the v6.569 population reconciliation block.');
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
      window: {
        remakeFactorState: {
          data: { generatedAt: '2026-07-31T09:00:00.000Z' }
        }
      },
      ceramistStateV6342: {
        cacheToken: 'cache-token-v6569',
        caseLevelRefreshedAt: ''
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
      ceramistDistinctCaseCountV6342(rows) {
        return new Set((rows || []).map(function(row) {
          return String(row && (row.remakeCaseNumber || row.caseNumber || row.caseId) || '').trim();
        }).filter(Boolean)).size;
      }
    };
    context.window.window = context.window;
    vm.createContext(context);

    try {
      vm.runInContext(block, context, { filename: 'DashboardMainScript.html#v6.569-population' });
      const join = context.ceramistBuildCompletePopulationV6569;
      if (typeof join !== 'function') throw new Error('Population join function was not created.');

      const sidecarRows = [{
        remakeCaseNumber: '100',
        caseNumber: '100',
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
          month: '2026-07',
          year: 2026,
          caseId: 'guid-100',
          caseNumber: '100',
          productId: 'A',
          productKey: 'A',
          productName: 'Product A',
          productGroup: 'Group A',
          department: 'Fixed',
          customerId: 'C1',
          customerName: 'Customer One',
          remakeReason: 'Reason A',
          quantity: 1,
          remakeUnits: 1,
          remakeDiscount: 10,
          isRemake: true
        },
        {
          month: '2026-07',
          year: 2026,
          caseId: 'guid-100',
          caseNumber: '100',
          productId: 'B',
          productKey: 'B',
          productName: 'Product B',
          productGroup: 'Group B',
          department: 'Fixed',
          customerId: 'C1',
          customerName: 'Customer One',
          remakeReason: 'Reason B',
          quantity: 2,
          remakeUnits: 2,
          remakeDiscount: 20,
          isRemake: true
        },
        {
          month: '2026-07',
          year: 2026,
          caseId: 'guid-101',
          caseNumber: '101',
          productId: 'C',
          productKey: 'C',
          productName: 'Product C',
          productGroup: 'Group C',
          department: 'Removable',
          customerId: 'C2',
          customerName: 'Customer Two',
          remakeReason: 'Reason C',
          quantity: 1,
          remakeUnits: 1,
          remakeDiscount: 30,
          isRemake: true
        }
      ];

      const joined = join(sidecarRows, mainRows);
      const audit = context.window.cdaCeramistPopulationReconciliationV6569.audit();
      const attributed = joined.filter(function(row) { return row.attributionStatus === 'attributed'; });
      const unattributed = joined.filter(function(row) { return row.attributionStatus === 'unattributed'; });

      if (joined.length !== 3) fail('Runtime join did not preserve all main remake rows.');
      else pass('Runtime join preserves all main remake rows.');

      if (attributed.length !== 1 || unattributed.length !== 2) {
        fail('Runtime join did not preserve matched attribution and synthesize missing Unattributed rows.');
      } else {
        pass('Runtime join preserves matched attribution and synthesizes Unattributed rows.');
      }

      if (!unattributed.every(function(row) {
        return row.responsibleCeramist === '[Unattributed]' &&
          row.attributionBasis === 'not_current_product_ceramics_eligible' &&
          row.currentProductCeramicsEligible === false;
      })) {
        fail('Synthesized rows do not carry the required Unattributed contract.');
      } else {
        pass('Synthesized rows carry the required Unattributed contract.');
      }

      if (!audit.complete || audit.mainRemakeRows !== 3 || audit.joinedRows !== 3 ||
          audit.matchedRows !== 1 || audit.synthesizedUnattributedRows !== 2 ||
          audit.mainRemakeCases !== 2 || audit.joinedCases !== 2) {
        fail('Runtime reconciliation audit is incorrect: ' + JSON.stringify(audit));
      } else {
        pass('Runtime reconciliation audit proves row and case completeness.');
      }
    } catch (error) {
      fail(error && error.stack ? error.stack : String(error));
    }
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('Ceramist population reconciliation validation passed.');
  console.log('Version: v6.569');
  console.log('Main Remake population authority: passed');
  console.log('Ceramist attribution sidecar join: passed');
  console.log('Unattributed fallback row: passed');
  console.log('Case-number and reason hover details: passed');
  console.log('Native combined refresh retained: passed');
}
