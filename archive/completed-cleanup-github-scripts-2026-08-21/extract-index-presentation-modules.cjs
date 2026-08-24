'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const sourcePath = 'Index.html';
const expectedSourceSha256 = 'f7678829b26a72c064c7c2ec7973b3e8fbc3b2983ee7d753d796ccc382faac97';
const expectedSourceBytes = 139762;
const archiveDir = path.join('archive', 'index-semantic-extraction-2026-08-21');
const archivePath = path.join(archiveDir, 'Index.pre-presentation-module-extraction.html');
const reportPath = path.join('docs', 'INDEX-PRESENTATION-EXTRACTION-BATCH-2026-08-21.json');

const defs = [
  {
    name: 'RemakeHeadPresentationStyles',
    path: 'RemakeHeadPresentationStyles.html',
    start: '<style id="remakeV6285TargetedFixes">',
    endExclusive: '<script id="cdaRemakeTatBootClassV6501">',
    required: ['remakeV6285TargetedFixes', 'remakeV6324CompactFilterBarStyles', 'workerDetailCrossfilterStylesV6370']
  },
  {
    name: 'SharedDashboardBootPresentation',
    path: 'SharedDashboardBootPresentation.html',
    start: '<script id="cdaRemakeTatBootClassV6501">',
    endExclusive: '<style id="cdaRemakeUsabilityV6503Styles">',
    required: ['cdaRemakeTatBootV6501', 'cdaRemakeTatBootStylesV6501', '#categoricalPage']
  },
  {
    name: 'RemakeUsabilityPresentation',
    path: 'RemakeUsabilityPresentation.html',
    start: '<style id="cdaRemakeUsabilityV6503Styles">',
    endExclusive: '</head>',
    required: ['cdaRemakeUsabilityV6503Styles', 'cdaRemakeUniversalResponsibilityV6504Styles', 'CDA_REMAKE_RESPONSIBILITY_VERSION']
  },
  {
    name: 'RemakeCeramistTablePresentation',
    path: 'RemakeCeramistTablePresentation.html',
    start: '<style id="remakeV6344CeramistReadableLayoutStyles">',
    endExclusive: "<?!= includeDashboardFile('DashboardSupportScript03') ?>",
    required: ['remakeV6344CeramistReadableLayoutStyles', 'remakeV6354ConsistentTableTypographyStyles', 'remakeV6357TypographyAndColumnChooserStyles']
  },
  {
    name: 'RemakeTableInteractionPresentation',
    path: 'RemakeTableInteractionPresentation.html',
    start: '<!-- v6.357: readable consistent table typography, individual per-column visibility menus, and local chart/card clearing. -->',
    endExclusive: '<!-- v6.383 baseline: compact toolbar is mounted outside the rebuilt dashboard shell so',
    required: ['ceramistV6368CleanControlsDetailDrawerStyles', 'v6.382']
  },
  {
    name: 'RemakeCompactControlsPresentation',
    path: 'RemakeCompactControlsPresentation.html',
    start: '<!-- v6.385: simplified Saved Views/settings menu while preserving separate',
    endExclusive: "<?!= includeDashboardFile('DashboardSupportScript04') ?>",
    required: ['remakeCompactControlsAndTableGeometryV6384']
  },
  {
    name: 'RemakeFilterSummaryPresentation',
    path: 'RemakeFilterSummaryPresentation.html',
    start: '<!-- v6.387: clean, fully visible selection summaries for every Remake Factor multi-select dropdown -->',
    endExclusive: "<?!= includeDashboardFile('RemakeSectionStateControllerV6402') ?>",
    required: ['remakeDropdownSummaryV6387', 'remakeV6392TechnicianLeftColumnWidths', 'v6.400']
  },
  {
    name: 'RemakeInteractionPolish',
    path: 'RemakeInteractionPolish.html',
    start: '<!-- v6.424: smooth atomic motion plus active yellow filter pills below the KPI row. -->',
    endExclusive: '</body>',
    required: ['cdaSmoothAtomicPolishV6424', 'installSmoothAtomicPolishV6424', 'installRemakePillsOutsideKpiAreaV6428', 'remakeCompleteRowHoverStylesV6427']
  },
  {
    name: 'TatCompactPresentation',
    path: 'TatCompactPresentation.html',
    start: '<style id="cdaTatCompactPresentationV6513">',
    endExclusive: '<!-- v6.517: safe intrinsic-width toolbar retry. Preserves the original TAT dropdown DOM and inline event handlers. -->',
    required: ['cdaTatCompactPresentationV6513', 'tatCoverageV6509', 'tatKpiV6509']
  },
  {
    name: 'TatDropdownRepairPresentation',
    path: 'TatDropdownRepairPresentation.html',
    start: '<style id="cdaTatDropdownTabRepairV6525">',
    endExclusive: "<?!= includeDashboardFile('SharedTopParityControllerV6527') ?>",
    required: ['cdaTatDropdownTabRepairV6525', 'CDA_TAT_DROPDOWN_REPAIR_VERSION', 'CDA_TAT_KPI_HEADER_PARITY_VERSION']
  }
];

function fail(message) { throw new Error(message); }
function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function countLiteral(text, token) { return text.split(token).length - 1; }

function parseScripts(file, text) {
  const opens = (text.match(/<script\b/gi) || []).length;
  const closes = (text.match(/<\/script>/gi) || []).length;
  if (opens !== closes) fail(file + ': script tag mismatch ' + opens + ' / ' + closes);
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;
  while ((match = re.exec(text))) {
    index += 1;
    const attrs = match[1] || '';
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    if (type && type !== 'text/javascript' && type !== 'application/javascript') continue;
    const prepared = match[2].replace(/<\?[!=]?[\s\S]*?\?>/g, 'null');
    try { new vm.Script(prepared, { filename: file + '#script' + index }); }
    catch (error) { fail(file + '#script' + index + ': ' + error.message); }
  }
}

function extract(source, def) {
  const start = source.indexOf(def.start);
  if (start < 0) fail(def.name + ': start marker not found.');
  if (source.indexOf(def.start, start + def.start.length) >= 0) fail(def.name + ': start marker appears more than once.');
  const end = source.indexOf(def.endExclusive, start + def.start.length);
  if (end < 0) fail(def.name + ': end marker not found after start marker.');
  const content = source.slice(start, end);
  if (!content.trim()) fail(def.name + ': extracted content is empty.');
  def.required.forEach(function(token) {
    if (!content.includes(token)) fail(def.name + ': required token missing: ' + token);
  });
  if (/includeDashboardFile\s*\(/.test(content)) fail(def.name + ': block contains an existing include directive; refusing nested include extraction.');
  if (Buffer.byteLength(content, 'utf8') > 75000) fail(def.name + ': module exceeds the 75KB readability target.');
  parseScripts(def.path, content);
  return { def, start, end, content };
}

const original = fs.readFileSync(sourcePath, 'utf8');
const originalBytes = Buffer.byteLength(original, 'utf8');
const originalSha = sha256(original);
if (originalBytes !== expectedSourceBytes || originalSha !== expectedSourceSha256) {
  fail('Index source guard failed. Expected ' + expectedSourceBytes + ' bytes / ' + expectedSourceSha256 + ' but found ' + originalBytes + ' / ' + originalSha + '.');
}
if (/overview/i.test(original)) fail('Index unexpectedly contains Overview text before presentation extraction.');

const blocks = defs.map(function(def) { return extract(original, def); }).sort(function(a, b) { return a.start - b.start; });
for (let i = 1; i < blocks.length; i += 1) {
  if (blocks[i - 1].end > blocks[i].start) fail('Extraction blocks overlap: ' + blocks[i - 1].def.name + ' / ' + blocks[i].def.name);
}
blocks.forEach(function(block) {
  if (fs.existsSync(block.def.path)) fail('Destination module already exists: ' + block.def.path);
});

let next = original;
blocks.slice().sort(function(a, b) { return b.start - a.start; }).forEach(function(block) {
  const directive = "<?!= includeDashboardFile('" + block.def.name + "') ?>";
  next = next.slice(0, block.start) + directive + next.slice(block.end);
});

blocks.forEach(function(block) {
  const includeName = "includeDashboardFile('" + block.def.name + "')";
  if (countLiteral(next, includeName) !== 1) fail(block.def.name + ': include count is not exactly one.');
  if (next.includes(block.def.start)) fail(block.def.name + ': implementation still remains inline in Index.');
});
if (/overview/i.test(next)) fail('Index gained an Overview reference during presentation extraction.');

let reconstructed = next;
blocks.forEach(function(block) {
  const directive = "<?!= includeDashboardFile('" + block.def.name + "') ?>";
  reconstructed = reconstructed.replace(directive, block.content);
});
if (reconstructed !== original) fail('Byte-for-byte composition reconstruction failed.');

const existingIncludesBefore = [...original.matchAll(/includeDashboardFile\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)].map(function(m) { return m[1]; });
const existingIncludesAfter = [...next.matchAll(/includeDashboardFile\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)].map(function(m) { return m[1]; });
existingIncludesBefore.forEach(function(name) {
  if (existingIncludesAfter.filter(function(item) { return item === name; }).length !== existingIncludesBefore.filter(function(item) { return item === name; }).length) {
    fail('Existing include count changed for ' + name + '.');
  }
});

parseScripts(sourcePath, next);

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive snapshot already exists; refusing overwrite.');
fs.writeFileSync(archivePath, original, 'utf8');
if (fs.readFileSync(archivePath, 'utf8') !== original) fail('Archived Index is not byte-for-byte identical.');
blocks.forEach(function(block) {
  fs.writeFileSync(block.def.path, block.content, 'utf8');
  if (fs.readFileSync(block.def.path, 'utf8') !== block.content) fail('Written module differs from extracted content: ' + block.def.path);
});
fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Large Index presentation extraction batch',
  behaviorChangeIntended: false,
  source: sourcePath,
  sourceSha256Before: originalSha,
  sourceSha256After: sha256(next),
  bytesBefore: originalBytes,
  bytesAfter: Buffer.byteLength(next, 'utf8'),
  bytesRemovedFromIndex: originalBytes - Buffer.byteLength(next, 'utf8'),
  archivePath,
  archiveByteForByteVerified: true,
  compositionByteForByteReconstructionVerified: true,
  existingIncludeOrderAndCountsPreserved: true,
  overviewReferencesAfter: (next.match(/overview/gi) || []).length,
  modules: blocks.map(function(block) {
    return {
      name: block.def.name,
      path: block.def.path,
      bytes: Buffer.byteLength(block.content, 'utf8'),
      sha256: sha256(block.content),
      extractedByteForByte: true,
      includeCountInIndex: countLiteral(next, "includeDashboardFile('" + block.def.name + "')")
    };
  }),
  logicRewritten: false,
  loadOrderChanged: false,
  productionDeployment: false
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  indexBytesBefore: report.bytesBefore,
  indexBytesAfter: report.bytesAfter,
  bytesRemovedFromIndex: report.bytesRemovedFromIndex,
  moduleCount: report.modules.length,
  largestModuleBytes: Math.max.apply(null, report.modules.map(function(item) { return item.bytes; })),
  compositionByteForByteReconstructionVerified: report.compositionByteForByteReconstructionVerified
}, null, 2));
