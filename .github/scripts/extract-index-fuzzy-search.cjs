'use strict';

const fs = require('fs');
const crypto = require('crypto');

const indexPath = 'Index.html';
const targetPath = 'DashboardFuzzySearch.html';
const reportPath = 'docs/INDEX-CLEANUP-PASS1-2026-08-21.json';
const expectedIndexSha256 = '5a47d0ff8f2d9b4de0c57d8aaa78c02ead3c6c16ae8072e2a08aaabf7602974b';
const openMarker = '  <script id="dashboardFuzzySearchV6412">';
const closeMarker = '  </script>';
const includeLine = "  <?!= includeDashboardFile('DashboardFuzzySearch') ?>";

function fail(message) {
  throw new Error(message);
}

function read(path) {
  if (!fs.existsSync(path)) fail(`Missing required file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

const originalIndex = read(indexPath);
if (sha256(originalIndex) !== expectedIndexSha256) {
  fail(`Unexpected ${indexPath} baseline. Refusing extraction.`);
}
if (fs.existsSync(targetPath)) fail(`${targetPath} already exists.`);
if (count(originalIndex, openMarker) !== 1) fail('Expected exactly one dashboardFuzzySearchV6412 script block.');
if (originalIndex.includes(includeLine)) fail('DashboardFuzzySearch include already exists.');

const start = originalIndex.indexOf(openMarker);
const endStart = originalIndex.indexOf(closeMarker, start);
if (start < 0 || endStart < 0) fail('Could not isolate dashboardFuzzySearchV6412 block.');
const end = endStart + closeMarker.length;
const block = originalIndex.slice(start, end);

if (!block.includes('window.dashboardFuzzySearchV6412')) fail('Fuzzy search export missing from extracted block.');
if (!block.includes('function scoreV6412')) fail('Fuzzy search score function missing from extracted block.');

const nextIndex = originalIndex.slice(0, start) + includeLine + originalIndex.slice(end);
if (count(nextIndex, includeLine) !== 1) fail('Include insertion validation failed.');
if (nextIndex.includes(openMarker)) fail('Inline fuzzy search block still present after extraction.');

const reconstructed = nextIndex.replace(includeLine, block);
if (reconstructed !== originalIndex) fail('Reconstruction is not byte-for-byte identical to original Index.html.');

fs.writeFileSync(targetPath, block + '\n', 'utf8');
fs.writeFileSync(indexPath, nextIndex, 'utf8');

const report = {
  generatedAt: new Date().toISOString(),
  source: indexPath,
  sourceSha256Before: expectedIndexSha256,
  sourceSha256After: sha256(nextIndex),
  target: targetPath,
  extractedBytes: Buffer.byteLength(block, 'utf8'),
  reconstructionVerified: true,
  behaviorChangeIntended: false,
  overviewChanged: false,
  sharedFilterChanged: false,
  note: 'Mechanical extraction of the existing dashboardFuzzySearchV6412 script into a semantic include. Script bytes and load position are preserved.'
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
