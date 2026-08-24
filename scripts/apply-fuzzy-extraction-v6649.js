'use strict';

const fs = require('fs');
const crypto = require('crypto');
const childProcess = require('child_process');

const expectedBranch = 'agent/ai-readable-cleanup-v6.648-2026-08-23';
const expectedIndexBlob = '7fd986441ffada22cba885ade713d7b026f9b004';
const indexPath = 'Index.html';
const targetPath = 'DashboardFuzzySearch.html';
const footerPath = 'SharedFooter.html';
const openMarker = '  <script id="dashboardFuzzySearchV6412">';
const closeMarker = '  </script>';
const includeLine = "  <?!= includeDashboardFile('DashboardFuzzySearch') ?>";
const nextUiVersion = 'v6.649';
const nextBuildLabel = 'AI-CLEANUP-FUZZY-EXTRACT-1';

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

function gitBlobSha(value) {
  const body = Buffer.from(value, 'utf8');
  const header = Buffer.from(`blob ${body.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header, body])).digest('hex');
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function currentBranch() {
  return childProcess.execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
}

const branch = currentBranch();
if (branch !== expectedBranch) {
  fail(`Wrong branch. Expected ${expectedBranch}; found ${branch || '(detached HEAD)'}.`);
}

const originalIndex = read(indexPath);
if (gitBlobSha(originalIndex) !== expectedIndexBlob) {
  fail(`Unexpected ${indexPath} baseline. Expected Git blob ${expectedIndexBlob}; found ${gitBlobSha(originalIndex)}.`);
}
if (count(originalIndex, openMarker) !== 1) fail('Expected exactly one dashboardFuzzySearchV6412 script block.');
if (originalIndex.includes(includeLine)) fail('DashboardFuzzySearch include already exists.');

const start = originalIndex.indexOf(openMarker);
const endStart = originalIndex.indexOf(closeMarker, start);
if (start < 0 || endStart < 0) fail('Could not isolate dashboardFuzzySearchV6412 block.');
const end = endStart + closeMarker.length;
const block = originalIndex.slice(start, end);

if (!block.includes('window.dashboardFuzzySearchV6412')) fail('Fuzzy search export missing from extracted block.');
if (!block.includes('function scoreV6412')) fail('Fuzzy search score function missing from extracted block.');

const existingModule = read(targetPath);
if (existingModule !== block + '\n') {
  fail(`${targetPath} is not byte-for-byte identical to the v6.648 inline block.`);
}

const nextIndex = originalIndex.slice(0, start) + includeLine + originalIndex.slice(end);
if (count(nextIndex, includeLine) !== 1) fail('Include insertion validation failed.');
if (nextIndex.includes(openMarker)) fail('Inline fuzzy search block still present after extraction.');

const reconstructed = nextIndex.replace(includeLine, block);
if (reconstructed !== originalIndex) fail('Reconstruction is not byte-for-byte identical to original Index.html.');

let footer = read(footerPath);
const expectedVersionComment = 'Version: v6.648';
const expectedUiLine = "  const UI_VERSION = 'v6.648';";
const expectedBuildLine = "  const BUILD_LABEL = 'V6.635-EXACT-RECOVERY-TEST-1';";
if (count(footer, expectedVersionComment) !== 1) fail('Expected exactly one v6.648 footer version comment.');
if (count(footer, expectedUiLine) !== 1) fail('Expected exactly one v6.648 UI_VERSION line.');
if (count(footer, expectedBuildLine) !== 1) fail('Expected exactly one recovery BUILD_LABEL line.');

footer = footer
  .replace(expectedVersionComment, `Version: ${nextUiVersion}`)
  .replace(expectedUiLine, `  const UI_VERSION = '${nextUiVersion}';`)
  .replace(expectedBuildLine, `  const BUILD_LABEL = '${nextBuildLabel}';`);

fs.writeFileSync(indexPath, nextIndex, 'utf8');
fs.writeFileSync(footerPath, footer, 'utf8');

console.log(JSON.stringify({
  ok: true,
  branch,
  indexBlobBefore: expectedIndexBlob,
  indexSha256Before: sha256(originalIndex),
  indexSha256After: sha256(nextIndex),
  extractedModule: targetPath,
  extractedBytes: Buffer.byteLength(block, 'utf8'),
  reconstructionVerified: true,
  uiVersion: nextUiVersion,
  buildLabel: nextBuildLabel,
  behaviorChangeIntended: false
}, null, 2));
