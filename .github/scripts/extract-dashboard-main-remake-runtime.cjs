'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const sourcePath = 'DashboardMainScript.html';
const expectedSourceBytes = 1223667;
const expectedSourceSha256 = 'e491f6db408e2e57bc82d02cf13575f59e5f64bd8f8ad00499332a73c5355a50';
const archiveDir = path.join('archive', 'dashboard-main-semantic-extraction-2026-08-21');
const archivePath = path.join(archiveDir, 'DashboardMainScript.pre-remake-runtime-extraction.html');
const reportPath = path.join('docs', 'DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json');
const maxModuleBytes = 75000;

const iifeMarker = '(function installCleanRemakeSectionV6230() {';
const useStrictMarker = "  'use strict';\n\n";
const startupMarker = '  startupOnceV6624();';

const defs = [
  {
    name: 'RemakeRuntimeCoreV6230',
    start: '  const VERSION_TEXT_V6230 =',
    end: '  function installStylesV6230() {',
    required: ['REMAKE_RUNTIME_BRIDGE_VERSION_V6637', 'window.cdaRemakeRuntimeBridgeV6637', 'const uiV6230 =']
  },
  {
    name: 'RemakeRuntimePresentationV6230',
    start: '  function installStylesV6230() {',
    end: '  function cardActionsV6230(component) {',
    required: ['cleanRemakeStylesV6230', 'document.head.appendChild(style)']
  },
  {
    name: 'RemakeFilterRuntimeV6245',
    start: '  function cardActionsV6230(component) {',
    end: '  function kpiYearValuesV6281(rows) {',
    required: ['const filterMetaV6245 =', 'REMAKE_NONE_FILTER_VALUE_V6308', 'globalSearchKindsV6304', 'applyRemakeFilterSnapshotV6389']
  },
  {
    name: 'RemakeAnalyticsRuntimeV6281',
    start: '  function kpiYearValuesV6281(rows) {',
    end: '  function renderCustomerTableV6230(customerGroups) {',
    required: ['remakeComparisonDateScopeV6306', 'renderCustomerResponsibilitySummaryV6503', 'customerHighestRateRowsV6303']
  },
  {
    name: 'RemakeCustomerTableRuntimeV6230',
    start: '  function renderCustomerTableV6230(customerGroups) {',
    end: '  function ceramistCaseKeyV6342(row) {',
    required: ['remakeCustomerTable', 'metricHeaderCellsV6301', 'applySelectedRowPinningV6311']
  },
  {
    name: 'RemakeTechnicianCoreRuntimeV6342',
    start: '  function ceramistCaseKeyV6342(row) {',
    end: '  let ceramistPopulationMemoV6569 = {',
    required: ['ceramistTryInContextV6348', 'ceramistEnrichTryInFromMainV6348']
  },
  {
    name: 'RemakeTechnicianPopulationRuntimeV6569',
    start: '  let ceramistPopulationMemoV6569 = {',
    end: '  function renderCustomerChartV6230() {',
    required: ['ceramistPopulationMemoV6569', 'applyCeramistPayloadV6364', 'loadCeramistRemakeAnalysisV6342']
  },
  {
    name: 'RemakeCustomerChartRuntimeV6504',
    start: '  function renderCustomerChartV6230() {',
    end: '  const dashboardMorphStateV6300 = { sequence: 0, active: null, lastStartedV6398: 0 };',
    required: ['responsibilityItemV6504', 'customerChartV6230']
  },
  {
    name: 'RemakeTransitionRuntimeV6300',
    start: '  const dashboardMorphStateV6300 = { sequence: 0, active: null, lastStartedV6398: 0 };',
    end: "  window.CDA_REMAKE_INTERACTIVE_POPOUT_VERSION = 'v6.339';",
    required: ['captureTableV6300', 'runGentleTableMorphV6297']
  },
  {
    name: 'RemakePopoutBridgeRuntimeV6339',
    start: "  window.CDA_REMAKE_INTERACTIVE_POPOUT_VERSION = 'v6.339';",
    end: '  function remakePopupRuntimeV6339(componentId) {',
    required: ['remakePopoutRefsV6339', 'getRemakePopoutSnapshotV6339', 'applyRemakePopoutActionV6339']
  },
  {
    name: 'RemakePopoutWindowRuntimeV6339',
    start: '  function remakePopupRuntimeV6339(componentId) {',
    end: '  window.popoutRemakeComponentV6230 = function popoutRemakeComponentV6339(component) {',
    required: ['requestSnapshot', 'applySnapshot', 'renderContent']
  },
  {
    name: 'RemakePopoutControllerRuntimeV6339',
    start: '  window.popoutRemakeComponentV6230 = function popoutRemakeComponentV6339(component) {',
    end: '  /* v6.388 first-open optimization: use the nightly browser-ready consolidated gzip cache before falling back to monthly Drive shards. */',
    required: ['remakePopupHtmlV6339', 'getRemakeFactorData']
  },
  {
    name: 'RemakeCacheRuntimeV6388',
    start: '  /* v6.388 first-open optimization: use the nightly browser-ready consolidated gzip cache before falling back to monthly Drive shards. */',
    end: startupMarker,
    required: ['expandRemakeBrowserReadyPayloadV6388', 'decodeRemakeBrowserReadyEnvelopeV6388', 'checkRemakeFactorServerMetaV6409', 'startupV6230']
  }
];

function fail(message) { throw new Error(message); }
function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function byteLength(text) { return Buffer.byteLength(text, 'utf8'); }
function count(text, token) { return text.split(token).length - 1; }

function parseFragment(name, text) {
  if (/<script\b/i.test(text) || /<\/script>/i.test(text)) fail(name + ': raw runtime fragment contains script tags.');
  if (/includeDashboardFile\s*\(/.test(text)) fail(name + ': raw runtime fragment contains a nested dashboard include.');
  try {
    new vm.Script(text, { filename: name + '.html' });
  } catch (error) {
    fail(name + ': extracted JavaScript is not independently parseable: ' + error.message);
  }
}

const original = fs.readFileSync(sourcePath, 'utf8');
const sourceBytes = byteLength(original);
const sourceSha = sha256(original);
if (sourceBytes !== expectedSourceBytes || sourceSha !== expectedSourceSha256) {
  fail('DashboardMain source guard failed. Expected ' + expectedSourceBytes + ' bytes / ' + expectedSourceSha256 + ' but found ' + sourceBytes + ' / ' + sourceSha + '.');
}

const iifeStart = original.indexOf(iifeMarker);
if (iifeStart < 0) fail('Remake runtime IIFE marker not found.');
if (original.indexOf(iifeMarker, iifeStart + iifeMarker.length) >= 0) fail('Remake runtime IIFE marker appears more than once.');
const strictPos = original.indexOf(useStrictMarker, iifeStart + iifeMarker.length);
if (strictPos < 0) fail('Remake runtime use-strict marker not found.');
const bodyStart = strictPos + useStrictMarker.length;
const startupPos = original.indexOf(startupMarker, bodyStart);
if (startupPos < 0) fail('Remake runtime startup marker not found.');

const blocks = defs.map(function(def) {
  const start = original.indexOf(def.start, bodyStart);
  if (start < 0 || start >= startupPos) fail(def.name + ': start marker not found inside Remake runtime body.');
  const end = def.end === startupMarker ? startupPos : original.indexOf(def.end, start + def.start.length);
  if (end < 0 || end > startupPos) fail(def.name + ': end marker not found after start marker.');
  const content = original.slice(start, end);
  if (!content.trim()) fail(def.name + ': extracted content is empty.');
  def.required.forEach(function(token) {
    if (!content.includes(token)) fail(def.name + ': required token missing: ' + token);
  });
  const bytes = byteLength(content);
  if (bytes > maxModuleBytes) fail(def.name + ': ' + bytes + ' bytes exceeds the 75KB semantic-module limit; split this region more narrowly.');
  parseFragment(def.name, content);
  return { def, start, end, content, bytes };
}).sort(function(a, b) { return a.start - b.start; });

if (blocks[0].start !== bodyStart) fail('First Remake semantic block does not begin immediately after the IIFE use-strict marker.');
for (let index = 1; index < blocks.length; index += 1) {
  if (blocks[index - 1].end !== blocks[index].start) {
    fail('Remake semantic blocks are not contiguous: ' + blocks[index - 1].def.name + ' -> ' + blocks[index].def.name + '.');
  }
}
if (blocks[blocks.length - 1].end !== startupPos) fail('Last Remake semantic block does not end at startup marker.');

blocks.forEach(function(block) {
  const modulePath = block.def.name + '.html';
  if (fs.existsSync(modulePath)) fail('Destination module already exists: ' + modulePath);
});

let next = original;
blocks.slice().sort(function(a, b) { return b.start - a.start; }).forEach(function(block) {
  const directive = "<?!= includeDashboardFile('" + block.def.name + "') ?>";
  next = next.slice(0, block.start) + directive + next.slice(block.end);
});

blocks.forEach(function(block) {
  const directive = "<?!= includeDashboardFile('" + block.def.name + "') ?>";
  if (count(next, directive) !== 1) fail(block.def.name + ': include directive count is not exactly one.');
  if (next.includes(block.def.start)) fail(block.def.name + ': implementation still remains inline in DashboardMain.');
});
if (!next.includes(iifeMarker) || !next.includes(useStrictMarker) || !next.includes(startupMarker)) {
  fail('DashboardMain no longer preserves the Remake IIFE shell/startup call.');
}

let reconstructed = next;
blocks.forEach(function(block) {
  const directive = "<?!= includeDashboardFile('" + block.def.name + "') ?>";
  reconstructed = reconstructed.replace(directive, block.content);
});
if (reconstructed !== original) fail('DashboardMain composed reconstruction is not byte-for-byte identical to the outgoing source.');
if (sha256(reconstructed) !== sourceSha) fail('DashboardMain composed reconstruction SHA mismatch.');

const preparedMain = next.replace(/<\?[!=]?[\s\S]*?\?>/g, 'null');
const scriptMatch = preparedMain.match(/^<script>([\s\S]*)<\/script>\s*$/i);
if (!scriptMatch) fail('DashboardMain outer script boundary changed unexpectedly.');
try {
  new vm.Script(scriptMatch[1], { filename: sourcePath });
} catch (error) {
  fail('DashboardMain composition source is not parseable after extraction: ' + error.message);
}

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('DashboardMain archive snapshot already exists; refusing overwrite.');
fs.writeFileSync(archivePath, original, 'utf8');
if (fs.readFileSync(archivePath, 'utf8') !== original) fail('DashboardMain archive is not byte-for-byte identical.');

blocks.forEach(function(block) {
  fs.writeFileSync(block.def.name + '.html', block.content, 'utf8');
  if (fs.readFileSync(block.def.name + '.html', 'utf8') !== block.content) fail('Written module differs from extracted bytes: ' + block.def.name);
});
fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'DashboardMain Remake semantic runtime extraction',
  behaviorChangeIntended: false,
  source: sourcePath,
  sourceBytesBefore: sourceBytes,
  sourceSha256Before: sourceSha,
  sourceBytesAfter: byteLength(next),
  sourceSha256After: sha256(next),
  bytesRemovedFromDashboardMain: sourceBytes - byteLength(next),
  archivePath: archivePath,
  archiveByteForByteVerified: true,
  compositionByteForByteReconstructionVerified: true,
  iifeShellPreserved: true,
  startupCallPreserved: true,
  maxModuleBytes: maxModuleBytes,
  modules: blocks.map(function(block) {
    return {
      name: block.def.name,
      path: block.def.name + '.html',
      bytes: block.bytes,
      sha256: sha256(block.content),
      rawJavaScriptFragment: true,
      independentlyParseable: true,
      includeCountInDashboardMain: count(next, "<?!= includeDashboardFile('" + block.def.name + "') ?>")
    };
  }),
  logicRewritten: false,
  executionOrderChanged: false,
  productionDeployment: false
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  dashboardMainBytesBefore: report.sourceBytesBefore,
  dashboardMainBytesAfter: report.sourceBytesAfter,
  bytesRemovedFromDashboardMain: report.bytesRemovedFromDashboardMain,
  moduleCount: report.modules.length,
  largestModuleBytes: Math.max.apply(null, report.modules.map(function(module) { return module.bytes; })),
  compositionByteForByteReconstructionVerified: report.compositionByteForByteReconstructionVerified
}, null, 2));
