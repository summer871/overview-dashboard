'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const sourcePath = 'Index.html';
const expectedSourceSha256 = 'c8d9040749fdedd50b9291a02eeb3cca2f46a3dba003067e76dad4230d4a7504';
const expectedSourceBytes = 55263;
const archiveDir = path.join('archive', 'index-semantic-extraction-2026-08-21');
const archivePath = path.join(archiveDir, 'Index.pre-shell-legacy-runtime-extraction.html');
const reportPath = path.join('docs', 'INDEX-SHELL-LEGACY-RUNTIME-EXTRACTION-2026-08-21.json');

const defs = [
  {
    name: 'DashboardShellMarkup',
    path: 'DashboardShellMarkup.html',
    start: '  <div id="singleShellDebugBanner">DEBUG v6.209</div>',
    endExclusive: "  <?!= includeDashboardFile('RemakeRootAttributionBrowserIntegrationV1351') ?>",
    required: ['remakeFactorTabBtn', 'remakeFactorPage', 'categoricalPage', 'componentMenu']
  },
  {
    name: 'RemakeLegacyPolishRuntime',
    path: 'RemakeLegacyPolishRuntime.html',
    start: '<script>\n/* v6.244 remake polish marker',
    endExclusive: "<?!= includeDashboardFile('DashboardSupportScript02') ?>",
    required: ['CDA_REMAKE_POLISH_VERSION', 'antiTwitchHoverStabilizerV6249', 'installGentleTableMorphV6298']
  },
  {
    name: 'RemakeLegacyLayoutRuntime',
    path: 'RemakeLegacyLayoutRuntime.html',
    start: "<script>\nwindow.CDA_REMAKE_LAYOUT_BALANCE_VERSION = 'v6.319';",
    endExclusive: "<?!= includeDashboardFile('RemakeCeramistTablePresentation') ?>",
    required: ['installRemakeV6317LayoutBalance', 'installRemakeV6320AlignedTableColumns', 'installRemakeV6337StableTabFilterToolbar']
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
  if (end < 0) fail(def.name + ': end marker not found.');
  const content = source.slice(start, end);
  if (!content.trim()) fail(def.name + ': extracted content is empty.');
  def.required.forEach(function(token) {
    if (!content.includes(token)) fail(def.name + ': required token missing: ' + token);
  });
  if (/includeDashboardFile\s*\(/.test(content)) fail(def.name + ': block contains an existing include directive.');
  if (Buffer.byteLength(content, 'utf8') > 75000) fail(def.name + ': module exceeds 75KB target.');
  parseScripts(def.path, content);
  return { def, start, end, content };
}

const original = fs.readFileSync(sourcePath, 'utf8');
const originalBytes = Buffer.byteLength(original, 'utf8');
const originalSha = sha256(original);
if (originalBytes !== expectedSourceBytes || originalSha !== expectedSourceSha256) {
  fail('Index source guard failed. Expected ' + expectedSourceBytes + ' bytes / ' + expectedSourceSha256 + ' but found ' + originalBytes + ' / ' + originalSha + '.');
}
if (/overview/i.test(original)) fail('Index unexpectedly contains Overview text.');

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

let reconstructed = next;
blocks.forEach(function(block) {
  const directive = "<?!= includeDashboardFile('" + block.def.name + "') ?>";
  if (countLiteral(next, "includeDashboardFile('" + block.def.name + "')") !== 1) fail(block.def.name + ': include count is not exactly one.');
  reconstructed = reconstructed.replace(directive, block.content);
});
if (reconstructed !== original) fail('Byte-for-byte composition reconstruction failed.');
if (/overview/i.test(next)) fail('Index gained an Overview reference.');

const preservedIncludes = [
  'RemakeRootAttributionBrowserIntegrationV1351',
  'DashboardMainScript',
  'RemakeSharedFilterAdapterV6646',
  'DashboardSupportScript01',
  'DashboardSupportScript02',
  'RemakeCeramistTablePresentation',
  'DashboardSupportScript03',
  'RemakeTableInteractionPresentation',
  'RemakeResponsiveStyles',
  'RemakeCompactControlsPresentation',
  'DashboardSupportScript04',
  'RemakeFilterSummaryPresentation',
  'RemakeSectionStateControllerV6402',
  'RemakeKpiChooserV6403',
  'SharedAtomicRenderingV6418'
];
preservedIncludes.forEach(function(name) {
  const token = "includeDashboardFile('" + name + "')";
  if (countLiteral(original, token) !== countLiteral(next, token)) fail('Existing include count changed for ' + name + '.');
});

parseScripts(sourcePath, next);
fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive snapshot already exists; refusing overwrite.');
fs.writeFileSync(archivePath, original, 'utf8');
if (fs.readFileSync(archivePath, 'utf8') !== original) fail('Archived Index differs from outgoing source.');
blocks.forEach(function(block) {
  fs.writeFileSync(block.def.path, block.content, 'utf8');
  if (fs.readFileSync(block.def.path, 'utf8') !== block.content) fail('Written module differs from extracted source: ' + block.def.path);
});
fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Index shell and legacy runtime extraction batch',
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
  modules: blocks.map(function(block) {
    return {
      name: block.def.name,
      path: block.def.path,
      bytes: Buffer.byteLength(block.content, 'utf8'),
      sha256: sha256(block.content),
      extractedByteForByte: true
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
  modules: report.modules.map(function(item) { return { name: item.name, bytes: item.bytes }; }),
  compositionByteForByteReconstructionVerified: true
}, null, 2));
