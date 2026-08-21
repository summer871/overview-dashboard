'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sourcePath = 'DashboardMainScript.html';
const expectedBytes = 776674;
const expectedSha256 = 'c699841f394d25ae29c4113f3364a2eb2f7cda06df8c30b2a27add8f6e6ff0ef';
const parentName = 'LegacyDashboardRuntime';
const parentPath = parentName + '.html';
const archiveDir = path.join('archive', 'dashboard-main-semantic-extraction-2026-08-21');
const archivePath = path.join(archiveDir, 'DashboardMainScript.pre-legacy-runtime-extraction.html');
const reportPath = path.join('docs', 'DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json');
const targetBytes = 62000;
const maxBytes = 75000;
const remakeDirective = "<?!= includeDashboardFile('RemakeMainRuntimeV6230') ?>";

function fail(message) { throw new Error(message); }
function bytes(text) { return Buffer.byteLength(text, 'utf8'); }
function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function count(text, token) { return text.split(token).length - 1; }

const original = fs.readFileSync(sourcePath, 'utf8');
if (bytes(original) !== expectedBytes || sha256(original) !== expectedSha256) {
  fail('DashboardMain legacy extraction source guard failed.');
}
if (fs.existsSync(parentPath)) fail('Legacy parent module already exists.');
if (fs.existsSync(archivePath)) fail('Legacy extraction archive already exists.');

const open = original.indexOf('<script>');
const bodyStart = open + '<script>'.length;
const remakePos = original.indexOf(remakeDirective, bodyStart);
if (open !== 0 || remakePos < 0 || count(original, remakeDirective) !== 1) fail('Expected DashboardMain script/remake composition boundary not found.');
const legacy = original.slice(bodyStart, remakePos);
if (bytes(legacy) < 500000) fail('Legacy runtime boundary is unexpectedly small.');

const lines = legacy.split(/(?<=\n)/);
const chunks = [];
let current = '';
for (const line of lines) {
  if (current && bytes(current) + bytes(line) > targetBytes) {
    chunks.push(current);
    current = '';
  }
  current += line;
}
if (current) chunks.push(current);
if (chunks.length < 2) fail('Expected multiple legacy runtime segments.');
if (chunks.join('') !== legacy) fail('Legacy chunk reconstruction is not byte-for-byte identical.');
chunks.forEach(function(chunk, index) {
  if (bytes(chunk) > maxBytes) fail('Legacy segment ' + (index + 1) + ' exceeds 75KB.');
});

const moduleNames = chunks.map(function(_, index) {
  return 'LegacyOverviewRuntimeSegment' + String(index + 1).padStart(2, '0');
});
moduleNames.forEach(function(name) { if (fs.existsSync(name + '.html')) fail('Destination already exists: ' + name + '.html'); });

const parent = moduleNames.map(function(name) { return "<?!= includeDashboardFile('" + name + "') ?>"; }).join('');
if (bytes(parent) > maxBytes) fail('Legacy parent composition exceeds 75KB.');
let reconstructedLegacy = parent;
chunks.forEach(function(chunk, index) {
  const directive = "<?!= includeDashboardFile('" + moduleNames[index] + "') ?>";
  reconstructedLegacy = reconstructedLegacy.replace(directive, function() { return chunk; });
});
if (reconstructedLegacy !== legacy) fail('Legacy parent recursive reconstruction failed.');

const parentDirective = "<?!= includeDashboardFile('" + parentName + "') ?>";
const next = original.slice(0, bodyStart) + parentDirective + original.slice(remakePos);
if (count(next, parentDirective) !== 1) fail('Legacy parent include count is not one.');
if (next.replace(parentDirective, function() { return reconstructedLegacy; }) !== original) fail('DashboardMain legacy recursive reconstruction failed.');

fs.mkdirSync(archiveDir, { recursive: true });
fs.writeFileSync(archivePath, original, 'utf8');
if (fs.readFileSync(archivePath, 'utf8') !== original) fail('Legacy outgoing DashboardMain archive mismatch.');
chunks.forEach(function(chunk, index) { fs.writeFileSync(moduleNames[index] + '.html', chunk, 'utf8'); });
fs.writeFileSync(parentPath, parent, 'utf8');
fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'DashboardMain legacy dashboard runtime staging extraction',
  behaviorChangeIntended: false,
  source: sourcePath,
  sourceBytesBefore: expectedBytes,
  sourceSha256Before: expectedSha256,
  sourceBytesAfter: bytes(next),
  sourceSha256After: sha256(next),
  bytesRemovedFromDashboardMain: expectedBytes - bytes(next),
  archivePath,
  archiveByteForByteVerified: true,
  recursiveCompositionVerified: true,
  parentModule: { name: parentName, path: parentPath, bytes: bytes(parent), sha256: sha256(parent) },
  maxModuleBytes: maxBytes,
  modules: chunks.map(function(chunk, index) { return { name: moduleNames[index], path: moduleNames[index] + '.html', bytes: bytes(chunk), sha256: sha256(chunk), stagingSegment: true }; }),
  domain: 'legacy dashboard / paused Overview staging',
  note: 'Behavior-preserving staging only. Segment files retain exact legacy bytes so ownership/removal can be audited safely before deletion.',
  logicRewritten: false,
  executionOrderChanged: false,
  productionDeployment: false
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ before: expectedBytes, after: bytes(next), removed: expectedBytes - bytes(next), segments: chunks.length, largestSegment: Math.max.apply(null, chunks.map(bytes)), recursiveCompositionVerified: true }, null, 2));
