'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const sourcePath = 'Index.html';
const expectedSourceSha256 = '497a1ffba9ad8249985e46e751101666b6afc76a505248d46328d81e11fa4769';
const expectedSourceBytes = 175532;
const archiveDir = path.join('archive', 'index-semantic-extraction-2026-08-21');
const archivePath = path.join(archiveDir, 'Index.pre-semantic-module-extraction.html');
const reportPath = path.join('docs', 'INDEX-SEMANTIC-EXTRACTION-BATCH-2026-08-21.json');

const defs = [
  {
    name: 'RemakeSectionStateControllerV6402',
    path: 'RemakeSectionStateControllerV6402.html',
    startMarker: '<style id="remakeV6402PageReloadCollapseStyles">',
    endAnchor: '(function installRemakePageReloadAndSectionsV6402(){',
    endTag: '</script>',
    requiredTokens: [
      'remakeSectionCollapsedV6402',
      'window.toggleRemakeSectionV6402',
      'performRemakeAutomaticCacheSyncV6409',
      'installRemakeFocusSyncV6409'
    ]
  },
  {
    name: 'RemakeKpiChooserV6403',
    path: 'RemakeKpiChooserV6403.html',
    startMarker: '<!-- v6.406: keeps the v6.405 KPI spacing, removes the empty KPI toolbar row, and replaces the text KPI button with a compact vertical-ellipsis (kebab) menu. -->',
    endAnchor: '(function installRemakeKpiChooserV6403(){',
    endTag: '</script>',
    requiredTokens: [
      'remakeV6403KpiChooserStyles',
      'CDA_REMAKE_KPI_CHOOSER_VERSION',
      'applyKpiVisibilityV6403',
      'remakeKpiChooserPopoverV6403'
    ]
  },
  {
    name: 'SharedAtomicRenderingV6418',
    path: 'SharedAtomicRenderingV6418.html',
    startMarker: '<!-- v6.418: atomic stable rendering. No page fades, FLIP motion, delayed column shifts, or intermediate phased paints. -->',
    endAnchor: "window.CDA_ATOMIC_NO_TWITCH_VERSION = 'v6.422';",
    endTag: '</script>',
    requiredTokens: [
      'cdaAtomicStableStylesV6418',
      'installAtomicStableRenderingV6418',
      'dashboardElementV6418',
      'CDA_ATOMIC_STABLE_RENDER_VERSION'
    ]
  }
];

const protectedTokens = [
  '#remakeFactorPage',
  '#categoricalPage',
  '.tabPage',
  'remakeSectionCollapsedV6402',
  'performRemakeAutomaticCacheSyncV6409',
  'remakeKpiChooserPopoverV6403',
  'CDA_ATOMIC_STABLE_RENDER_VERSION',
  "includeDashboardFile('SharedFilterBar')",
  "includeDashboardFile('RemakeSharedFilterAdapterV6646')",
  "includeDashboardFile('TatDashboardControllerScript')",
  "includeDashboardFile('TatSharedFilterAdapterV6646')",
  "includeDashboardFile('SharedFooter')"
];

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function countLiteral(text, token) {
  return text.split(token).length - 1;
}

function tokenCounts(text) {
  const result = {};
  protectedTokens.forEach(function(token) {
    result[token] = countLiteral(text, token);
  });
  return result;
}

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
    try {
      new vm.Script(prepared, { filename: file + '#script' + index });
    } catch (error) {
      fail(file + '#script' + index + ': ' + error.message);
    }
  }
}

function extractDefinition(source, def) {
  const start = source.indexOf(def.startMarker);
  if (start < 0) fail(def.name + ': start marker not found.');
  if (source.indexOf(def.startMarker, start + def.startMarker.length) >= 0) fail(def.name + ': start marker appears more than once.');
  const anchor = source.indexOf(def.endAnchor, start + def.startMarker.length);
  if (anchor < 0) fail(def.name + ': end anchor not found after start marker.');
  const endStart = source.indexOf(def.endTag, anchor + def.endAnchor.length);
  if (endStart < 0) fail(def.name + ': end tag not found after end anchor.');
  const end = endStart + def.endTag.length;
  const content = source.slice(start, end);
  def.requiredTokens.forEach(function(token) {
    if (!content.includes(token)) fail(def.name + ': required token missing from extracted block: ' + token);
  });
  return { def, start, end, content };
}

const original = fs.readFileSync(sourcePath, 'utf8');
const originalBytes = Buffer.byteLength(original, 'utf8');
const originalSha = sha256(original);
if (originalSha !== expectedSourceSha256 || originalBytes !== expectedSourceBytes) {
  fail('Index source guard failed. Expected ' + expectedSourceBytes + ' bytes / ' + expectedSourceSha256 + ' but found ' + originalBytes + ' / ' + originalSha + '. Re-audit before extraction.');
}
if (/overview/i.test(original)) fail('Index unexpectedly contains Overview text before semantic extraction.');

const protectedBefore = tokenCounts(original);
const extracted = defs.map(function(def) { return extractDefinition(original, def); }).sort(function(a, b) { return a.start - b.start; });
for (let i = 1; i < extracted.length; i += 1) {
  if (extracted[i - 1].end > extracted[i].start) fail('Semantic extraction blocks overlap: ' + extracted[i - 1].def.name + ' and ' + extracted[i].def.name + '.');
}

extracted.forEach(function(item) {
  if (fs.existsSync(item.def.path)) fail('Destination module already exists: ' + item.def.path);
  if (Buffer.byteLength(item.content, 'utf8') > 75000) fail(item.def.path + ' exceeds the 75KB semantic-module target.');
  parseScripts(item.def.path, item.content);
});

let next = original;
extracted.slice().sort(function(a, b) { return b.start - a.start; }).forEach(function(item) {
  const includeToken = "<?!= includeDashboardFile('" + item.def.name + "') ?>";
  next = next.slice(0, item.start) + includeToken + next.slice(item.end);
});

extracted.forEach(function(item) {
  const includeToken = "includeDashboardFile('" + item.def.name + "')";
  if (countLiteral(next, includeToken) !== 1) fail(item.def.name + ': Index include count is not exactly one after extraction.');
  if (next.includes(item.def.startMarker) || next.includes(item.def.endAnchor)) fail(item.def.name + ': extracted implementation still remains inline in Index.');
});
if (/overview/i.test(next)) fail('Index gained an Overview reference during semantic extraction.');

let reconstructed = next;
extracted.forEach(function(item) {
  const includeDirective = "<?!= includeDashboardFile('" + item.def.name + "') ?>";
  reconstructed = reconstructed.replace(includeDirective, item.content);
});
if (reconstructed !== original) fail('Byte-for-byte composition reconstruction failed after semantic extraction.');

const combined = next + '\n' + extracted.map(function(item) { return item.content; }).join('\n');
const protectedAfterComposed = tokenCounts(combined);
Object.keys(protectedBefore).forEach(function(token) {
  if (protectedBefore[token] !== protectedAfterComposed[token]) {
    fail('Composed protected token count changed for ' + token + ': ' + protectedBefore[token] + ' -> ' + protectedAfterComposed[token]);
  }
});

parseScripts(sourcePath, next);

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive Index snapshot already exists; refusing overwrite.');
fs.writeFileSync(archivePath, original, 'utf8');
if (fs.readFileSync(archivePath, 'utf8') !== original) fail('Archived Index is not byte-for-byte identical to outgoing source.');

extracted.forEach(function(item) {
  fs.writeFileSync(item.def.path, item.content, 'utf8');
  if (fs.readFileSync(item.def.path, 'utf8') !== item.content) fail('Written module is not byte-for-byte identical to extracted source: ' + item.def.path);
});
fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Semantic Index extraction batch',
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
  overviewReferencesAfter: (next.match(/overview/gi) || []).length,
  modules: extracted.map(function(item) {
    return {
      name: item.def.name,
      path: item.def.path,
      bytes: Buffer.byteLength(item.content, 'utf8'),
      sha256: sha256(item.content),
      extractedByteForByte: true,
      includeCountInIndex: countLiteral(next, "includeDashboardFile('" + item.def.name + "')")
    };
  }),
  protectedTokenCountsBefore: protectedBefore,
  protectedTokenCountsAfterComposed: protectedAfterComposed,
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
  modules: report.modules.map(function(module) { return { name: module.name, bytes: module.bytes }; }),
  compositionByteForByteReconstructionVerified: report.compositionByteForByteReconstructionVerified
}, null, 2));
