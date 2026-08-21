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
const parentName = 'RemakeMainRuntimeV6230';
const parentPath = parentName + '.html';

const runtimeStartMarker = '/* v6.230 Remake section full rebuild.';
const iifeMarker = '(function installCleanRemakeSectionV6230() {';
const useStrictMarker = "  'use strict';\n\n";
const startupMarker = '  startupOnceV6624();';

const defs = [
  { name: 'RemakeRuntimeCoreV6230', start: '  const VERSION_TEXT_V6230 =', end: '  function installStylesV6230() {', required: ['REMAKE_RUNTIME_BRIDGE_VERSION_V6637', 'window.cdaRemakeRuntimeBridgeV6637', 'const uiV6230 ='] },
  { name: 'RemakeRuntimePresentationV6230', start: '  function installStylesV6230() {', end: '  function cardActionsV6230(component) {', required: ['cleanRemakeStylesV6230', 'document.head.appendChild(style)'] },
  { name: 'RemakeFilterRuntimeV6245', start: '  function cardActionsV6230(component) {', end: '  function kpiYearValuesV6281(rows) {', required: ['const filterMetaV6245 =', 'REMAKE_NONE_FILTER_VALUE_V6308', 'globalSearchKindsV6304', 'applyRemakeFilterSnapshotV6389'] },
  { name: 'RemakeAnalyticsRuntimeV6281', start: '  function kpiYearValuesV6281(rows) {', end: '  function renderCustomerTableV6230(customerGroups) {', required: ['remakeComparisonDateScopeV6306', 'renderCustomerResponsibilitySummaryV6503', 'customerHighestRateRowsV6303'] },
  { name: 'RemakeCustomerTableRuntimeV6230', start: '  function renderCustomerTableV6230(customerGroups) {', end: '  function ceramistCaseKeyV6342(row) {', required: ['remakeCustomerTable', 'metricHeaderCellsV6301', 'applySelectedRowPinningV6311'] },
  { name: 'RemakeTechnicianCoreRuntimeV6342', start: '  function ceramistCaseKeyV6342(row) {', end: '  let ceramistPopulationMemoV6569 = {', required: ['ceramistTryInContextV6348', 'ceramistEnrichTryInFromMainV6348'] },
  { name: 'RemakeTechnicianPopulationRuntimeV6569', start: '  let ceramistPopulationMemoV6569 = {', end: '  function renderCustomerChartV6230() {', required: ['ceramistPopulationMemoV6569', 'applyCeramistPayloadV6364', 'loadCeramistRemakeAnalysisV6342'] },
  { name: 'RemakeCustomerChartRuntimeV6504', start: '  function renderCustomerChartV6230() {', end: '  const dashboardMorphStateV6300 = { sequence: 0, active: null, lastStartedV6398: 0 };', required: ['responsibilityItemV6504', 'customerChartV6230'] },
  { name: 'RemakeTransitionRuntimeV6300', start: '  const dashboardMorphStateV6300 = { sequence: 0, active: null, lastStartedV6398: 0 };', end: "  window.CDA_REMAKE_INTERACTIVE_POPOUT_VERSION = 'v6.339';", required: ['captureTableV6300', 'runGentleTableMorphV6297'] },
  { name: 'RemakePopoutBridgeRuntimeV6339', start: "  window.CDA_REMAKE_INTERACTIVE_POPOUT_VERSION = 'v6.339';", end: '  function remakePopupRuntimeV6339(componentId) {', required: ['remakePopoutRefsV6339', 'getRemakePopoutSnapshotV6339', 'applyRemakePopoutActionV6339'] },
  { name: 'RemakePopoutWindowRuntimeV6339', start: '  function remakePopupRuntimeV6339(componentId) {', end: '  window.popoutRemakeComponentV6230 = function popoutRemakeComponentV6339(component) {', required: ['requestSnapshot', 'applySnapshot', 'renderContent'] },
  { name: 'RemakePopoutControllerRuntimeV6339', start: '  window.popoutRemakeComponentV6230 = function popoutRemakeComponentV6339(component) {', end: '  /* v6.388 first-open optimization: use the nightly browser-ready consolidated gzip cache before falling back to monthly Drive shards. */', required: ['window.popoutRemakeComponentV6230', 'callRemakeFactorServerV6254'] },
  { name: 'RemakeCacheRuntimeV6388', start: '  /* v6.388 first-open optimization: use the nightly browser-ready consolidated gzip cache before falling back to monthly Drive shards. */', end: startupMarker, required: ['expandRemakeBrowserReadyPayloadV6388', 'decodeRemakeBrowserReadyEnvelopeV6388', 'checkRemakeFactorServerMetaV6409', 'startupV6230'] }
];

function fail(message) { throw new Error(message); }
function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function byteLength(text) { return Buffer.byteLength(text, 'utf8'); }
function count(text, token) { return text.split(token).length - 1; }

function parseRawJavaScript(name, text) {
  if (/<script\b/i.test(text) || /<\/script>/i.test(text)) fail(name + ': raw runtime fragment contains script tags.');
  if (/includeDashboardFile\s*\(/.test(text)) fail(name + ': child runtime fragment contains a nested dashboard include.');
  try { new vm.Script(text, { filename: name + '.html' }); }
  catch (error) { fail(name + ': extracted JavaScript is not independently parseable: ' + error.message); }
}

const original = fs.readFileSync(sourcePath, 'utf8');
const sourceBytes = byteLength(original);
const sourceSha = sha256(original);
if (sourceBytes !== expectedSourceBytes || sourceSha !== expectedSourceSha256) {
  fail('DashboardMain source guard failed. Expected ' + expectedSourceBytes + ' bytes / ' + expectedSourceSha256 + ' but found ' + sourceBytes + ' / ' + sourceSha + '.');
}
if (fs.existsSync(parentPath)) fail('Destination parent module already exists: ' + parentPath);
if (fs.existsSync(archivePath)) fail('DashboardMain archive snapshot already exists; refusing overwrite.');
defs.forEach(function(def) {
  if (fs.existsSync(def.name + '.html')) fail('Destination child module already exists: ' + def.name + '.html');
});

const scriptClose = original.lastIndexOf('</script>');
if (scriptClose < 0) fail('DashboardMain closing script tag not found.');
const runtimeStart = original.indexOf(runtimeStartMarker);
if (runtimeStart < 0 || runtimeStart >= scriptClose) fail('Remake runtime start marker not found before DashboardMain closing script tag.');
if (original.indexOf(runtimeStartMarker, runtimeStart + runtimeStartMarker.length) >= 0) fail('Remake runtime start marker appears more than once.');
const runtimeSource = original.slice(runtimeStart, scriptClose);
if (!runtimeSource.includes(iifeMarker)) fail('Remake runtime IIFE marker is missing from isolated runtime.');
if (!runtimeSource.includes(startupMarker)) fail('Remake runtime startup call is missing from isolated runtime.');
if (!runtimeSource.trimEnd().endsWith('})();')) fail('Remake runtime is not the final executable block before DashboardMain closing script tag.');

const iifeStart = runtimeSource.indexOf(iifeMarker);
const strictPos = runtimeSource.indexOf(useStrictMarker, iifeStart + iifeMarker.length);
if (iifeStart < 0 || strictPos < 0) fail('Remake IIFE shell could not be located inside isolated runtime.');
const bodyStart = strictPos + useStrictMarker.length;
const startupPos = runtimeSource.indexOf(startupMarker, bodyStart);
if (startupPos < 0) fail('Remake startup marker not found after IIFE body start.');

const blocks = defs.map(function(def) {
  const start = runtimeSource.indexOf(def.start, bodyStart);
  if (start < 0 || start >= startupPos) fail(def.name + ': start marker not found inside isolated Remake runtime.');
  const end = def.end === startupMarker ? startupPos : runtimeSource.indexOf(def.end, start + def.start.length);
  if (end < 0 || end > startupPos) fail(def.name + ': end marker not found after start marker.');
  const content = runtimeSource.slice(start, end);
  if (!content.trim()) fail(def.name + ': extracted content is empty.');
  def.required.forEach(function(token) { if (!content.includes(token)) fail(def.name + ': required token missing: ' + token); });
  const bytes = byteLength(content);
  if (bytes > maxModuleBytes) fail(def.name + ': ' + bytes + ' bytes exceeds the 75KB semantic-module limit; split this region more narrowly.');
  parseRawJavaScript(def.name, content);
  return { def, start, end, content, bytes };
}).sort(function(a, b) { return a.start - b.start; });

if (blocks[0].start !== bodyStart) fail('First semantic child does not begin immediately after the Remake IIFE use-strict marker.');
for (let index = 1; index < blocks.length; index += 1) {
  if (blocks[index - 1].end !== blocks[index].start) fail('Semantic children are not contiguous: ' + blocks[index - 1].def.name + ' -> ' + blocks[index].def.name + '.');
}
if (blocks[blocks.length - 1].end !== startupPos) fail('Last semantic child does not end immediately before the Remake startup call.');

let parent = runtimeSource;
blocks.slice().sort(function(a, b) { return b.start - a.start; }).forEach(function(block) {
  const directive = "<?!= includeDashboardFile('" + block.def.name + "') ?>";
  parent = parent.slice(0, block.start) + directive + parent.slice(block.end);
});
if (byteLength(parent) > maxModuleBytes) fail(parentName + ': parent composition module exceeds the 75KB readability target.');
blocks.forEach(function(block) {
  const directive = "<?!= includeDashboardFile('" + block.def.name + "') ?>";
  if (count(parent, directive) !== 1) fail(block.def.name + ': expected exactly one child include in ' + parentName + '.');
});

const preparedParent = parent.replace(/<\?[!=]?[\s\S]*?\?>/g, 'void 0;\n');
try { new vm.Script(preparedParent, { filename: parentPath }); }
catch (error) { fail(parentName + ': parent composition shell is not parseable with placeholder children: ' + error.message); }

let reconstructedParent = parent;
blocks.forEach(function(block) {
  reconstructedParent = reconstructedParent.replace("<?!= includeDashboardFile('" + block.def.name + "') ?>", block.content);
});
if (reconstructedParent !== runtimeSource) fail('Nested Remake runtime reconstruction is not byte-for-byte identical to isolated source.');

const parentDirective = "<?!= includeDashboardFile('" + parentName + "') ?>";
const next = original.slice(0, runtimeStart) + parentDirective + original.slice(scriptClose);
if (count(next, parentDirective) !== 1) fail('DashboardMain parent include count is not exactly one.');
if (next.includes(iifeMarker) || next.includes(runtimeStartMarker)) fail('Isolated Remake runtime still remains inline in DashboardMain.');

let preparedMain = next.replace(parentDirective, 'void 0;\n');
preparedMain = preparedMain.replace(/<\?[!=]?[\s\S]*?\?>/g, 'null');
const outerMatch = preparedMain.match(/^<script>([\s\S]*)<\/script>\s*$/i);
if (!outerMatch) fail('DashboardMain outer script boundary changed unexpectedly.');
try { new vm.Script(outerMatch[1], { filename: sourcePath }); }
catch (error) { fail('DashboardMain composition shell is not parseable after single-parent extraction: ' + error.message); }

const reconstructedMain = next.replace(parentDirective, reconstructedParent);
if (reconstructedMain !== original) fail('Recursive DashboardMain reconstruction is not byte-for-byte identical to outgoing source.');
if (sha256(reconstructedMain) !== sourceSha) fail('Recursive DashboardMain reconstruction SHA mismatch.');

fs.mkdirSync(archiveDir, { recursive: true });
fs.writeFileSync(archivePath, original, 'utf8');
if (fs.readFileSync(archivePath, 'utf8') !== original) fail('DashboardMain archive is not byte-for-byte identical to outgoing source.');

blocks.forEach(function(block) {
  const modulePath = block.def.name + '.html';
  fs.writeFileSync(modulePath, block.content, 'utf8');
  if (fs.readFileSync(modulePath, 'utf8') !== block.content) fail('Written child module differs from extracted bytes: ' + modulePath);
});
fs.writeFileSync(parentPath, parent, 'utf8');
if (fs.readFileSync(parentPath, 'utf8') !== parent) fail('Written parent module differs from guarded parent composition.');
fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'DashboardMain single-parent Remake semantic runtime extraction',
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
  recursiveCompositionVerified: true,
  runtimeWasFinalDashboardMainBlock: true,
  parentModule: {
    name: parentName,
    path: parentPath,
    bytes: byteLength(parent),
    sha256: sha256(parent),
    includeCountInDashboardMain: count(next, parentDirective)
  },
  maxModuleBytes: maxModuleBytes,
  modules: blocks.map(function(block) {
    return {
      name: block.def.name,
      path: block.def.name + '.html',
      bytes: block.bytes,
      sha256: sha256(block.content),
      rawJavaScriptFragment: true,
      independentlyParseable: true,
      includeCountInParent: count(parent, "<?!= includeDashboardFile('" + block.def.name + "') ?>")
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
  parentModuleBytes: report.parentModule.bytes,
  semanticChildCount: report.modules.length,
  largestChildBytes: Math.max.apply(null, report.modules.map(function(module) { return module.bytes; })),
  recursiveCompositionVerified: report.recursiveCompositionVerified
}, null, 2));
