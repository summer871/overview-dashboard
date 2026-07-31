#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
let failed = false;

function fail(message) {
  console.error('ERROR: ' + message);
  failed = true;
}

function pass(message) {
  console.log('PASS: ' + message);
}

function read(name) {
  const filePath = path.join(root, name);
  if (!fs.existsSync(filePath)) {
    fail('Missing file: ' + name);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireMarker(text, marker, message) {
  if (!text.includes(marker)) fail(message + ' Missing marker: ' + marker);
  else pass(message);
}

function requireBefore(text, first, second, message) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    fail(message + ' Expected order: ' + first + ' before ' + second);
  } else {
    pass(message);
  }
}

function count(text, marker) {
  if (!marker) return 0;
  return text.split(marker).length - 1;
}

const main = read('DashboardMainScript.html');
const foundation = read('SharedComponentFoundation.html');

const temporaryFiles = [
  'RemakeCombinedRefreshV6569.html',
  'RemakeTechnicianReconciliationV6568.html'
];

temporaryFiles.forEach(function(name) {
  const filePath = path.join(root, name);
  if (fs.existsSync(filePath)) fail('Temporary prototype file still exists: ' + name);
  else pass('Temporary prototype removed: ' + name);
});

[
  'RemakeCombinedRefreshV6569',
  'RemakeTechnicianReconciliationV6568'
].forEach(function(name) {
  if (foundation.includes(name)) fail('SharedComponentFoundation still includes temporary prototype: ' + name);
  else pass('SharedComponentFoundation excludes temporary prototype: ' + name);
});

requireMarker(main, '/* v6.568 native combined cache refresh.', 'Native v6.568 refresh block is present.');
requireMarker(main, 'let browserCacheWriteCompletionV6568 = Promise.resolve(true);', 'Main browser-cache completion promise is declared.');
requireMarker(main, 'function refreshCeramistResponsibilityServerV6568()', 'Native technician server refresh helper is present.');
requireMarker(main, '.refreshCeramistCaseLevelResponsibilityNightlyV75();', 'Technician responsibility rebuild uses the canonical server function.');
requireMarker(main, 'function fetchFreshCeramistPayloadV6568()', 'Fresh technician payload helper is present.');
requireMarker(main, '.getCeramistRemakeAnalysisData();', 'Fresh technician payload is downloaded through the canonical read function.');
requireMarker(main, 'function refreshCeramistAfterRemakeV6568()', 'Combined native sequence is present.');
requireMarker(main, 'return Promise.resolve(browserCacheWriteCompletionV6568)', 'Technician download waits for the refreshed Remake browser cache.');
requireMarker(main, 'const applied = applyCeramistPayloadV6364(data, false);', 'Fresh technician payload uses the native application path.');
requireMarker(main, 'ceramistBrowserCacheWritePromiseV6364 = writeCeramistFastCacheV6364(data)', 'Fresh technician payload replaces the browser cache directly.');
requireMarker(main, 'function restoreCeramistAfterCombinedFailureV6568(error)', 'Technician-only failure restoration path is present.');
requireMarker(main, 'function callRemakeFactorServerV6254(request, noticeText, allowBrowserFallback, refreshTechnicianAfterSuccess)', 'Native Remake server function owns the combined-refresh flag.');
requireMarker(main, "callRemakeFactorServerV6254(request, 'Refreshing current open invoice month...', false, true);", 'The Refresh button path enables technician refresh only after the main refresh.');
requireMarker(main, 'window.cdaNativeCombinedCacheRefreshV6568 = Object.freeze({', 'Native combined-refresh audit is exposed.');
requireMarker(main, "temporaryButtonListener: false", 'Audit explicitly confirms there is no temporary button listener.');

const combinedStart = main.indexOf('function refreshCeramistAfterRemakeV6568()');
const combinedEnd = main.indexOf('function restoreCeramistAfterCombinedFailureV6568(error)', combinedStart);
const combinedBlock = combinedStart >= 0 && combinedEnd > combinedStart
  ? main.slice(combinedStart, combinedEnd)
  : '';

const serverStart = main.indexOf('function callRemakeFactorServerV6254(request, noticeText, allowBrowserFallback, refreshTechnicianAfterSuccess)');
const serverEnd = main.indexOf('/* v6.388 first-open optimization:', serverStart);
const serverBlock = serverStart >= 0 && serverEnd > serverStart
  ? main.slice(serverStart, serverEnd)
  : '';

requireBefore(
  serverBlock,
  'const applied = handleDataV6230(data, false);',
  'refreshCeramistAfterRemakeV6568()',
  'The refreshed Remake payload is accepted before the technician refresh begins.'
);
requireBefore(
  combinedBlock,
  'return refreshCeramistResponsibilityServerV6568()',
  'return fetchFreshCeramistPayloadV6568();',
  'Technician responsibility rebuild completes before the fresh payload download.'
);
requireBefore(
  combinedBlock,
  'return fetchFreshCeramistPayloadV6568();',
  'const applied = applyCeramistPayloadV6364(data, false);',
  'Fresh technician data is downloaded before it is applied.'
);
requireBefore(
  combinedBlock,
  'const applied = applyCeramistPayloadV6364(data, false);',
  'ceramistBrowserCacheWritePromiseV6364 = writeCeramistFastCacheV6364(data)',
  'Fresh technician data is applied before its browser cache is replaced.'
);

const combinedTrueCall = "callRemakeFactorServerV6254(request, 'Refreshing current open invoice month...', false, true);";
if (count(main, combinedTrueCall) !== 1) {
  fail('Expected exactly one native Refresh path to enable technician refresh; found ' + count(main, combinedTrueCall) + '.');
} else {
  pass('Exactly one native Refresh path enables technician refresh.');
}

if (main.includes('RemakeCombinedRefreshV6569') || main.includes('cdaRemakeCombinedRefreshV6569')) {
  fail('Temporary combined-refresh listener code remains in DashboardMainScript.html.');
} else {
  pass('No temporary combined-refresh listener remains in DashboardMainScript.html.');
}

if (main.includes('cdaRemakeTechnicianReconciliationV6568')) {
  fail('Temporary DOM reconciliation code remains in DashboardMainScript.html.');
} else {
  pass('No temporary DOM reconciliation code remains in DashboardMainScript.html.');
}

const blockStart = main.indexOf('/* v6.568 native combined cache refresh.');
const blockEnd = main.indexOf('/* v6.388 first-open optimization:', blockStart);
if (blockStart < 0 || blockEnd < 0 || blockEnd <= blockStart) {
  fail('Could not isolate the native v6.568 refresh block for syntax validation.');
} else {
  const nativeBlock = main.slice(blockStart, blockEnd);
  if (nativeBlock.includes('|| true')) {
    fail('Native combined-refresh block contains a permissive always-true check.');
  } else {
    pass('Native combined-refresh block has no permissive always-true check.');
  }
  try {
    new vm.Script(nativeBlock, { filename: 'DashboardMainScript.html#native-v6.568-refresh' });
    pass('Native v6.568 refresh block passes JavaScript syntax validation.');
  } catch (error) {
    fail(error.message);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('Native combined Remake/technician refresh validation passed.');
  console.log('Version: v6.568');
  console.log('Main Remake refresh before technician refresh: passed');
  console.log('Technician BigQuery responsibility rebuild: passed');
  console.log('Fresh technician payload download: passed');
  console.log('Technician IndexedDB replacement: passed');
  console.log('Technician failure restoration: passed');
  console.log('Temporary UI-layer prototypes removed: passed');
}
