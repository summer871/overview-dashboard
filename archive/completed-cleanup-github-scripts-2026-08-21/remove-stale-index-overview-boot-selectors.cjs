'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const sourcePath = 'Index.html';
const expectedBlobSha = '06aaa322f73647f8aacbd1364cff5db7d7bfdc43';
const archiveDir = path.join('archive', 'overview-paused-2026-08-21');
const archivePath = path.join(archiveDir, 'Index.pre-stale-overview-boot-selector-removal.html');
const reportPath = path.join('docs', 'OVERVIEW-INDEX-STALE-BOOT-SELECTOR-CLEANUP-2026-08-21.json');

const staleTokens = ['#tabOneBtn', '#overviewNavActions', '#overviewOne', '#overviewTwo'];
const protectedTokens = [
  '.managerTabs > .tabGroup',
  '#underConstructionBtn',
  '#underConstructionMenu',
  '#categoricalTabBtn',
  '#categoricalPage',
  '#dropdownDebugOverlayV6199',
  '#dropdownDebugOverlayV6196',
  '#layoutEditButtonV6183',
  '#layoutEditPanelV6183',
  '#layoutCardEditorV6184',
  '#remakeFactorPage',
  '#remakeTabFilterHostV6337',
  '#tatTabFilterHostV6509',
  "includeDashboardFile('SharedFilterBar')",
  "includeDashboardFile('RemakeSharedFilterAdapterV6646')",
  "includeDashboardFile('TatDashboardControllerScript')",
  "includeDashboardFile('TatSharedFilterAdapterV6646')"
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

function counts(text, tokens) {
  const result = {};
  tokens.forEach(function(token) { result[token] = countLiteral(text, token); });
  return result;
}

function assertCountsEqual(before, after, label) {
  Object.keys(before).forEach(function(token) {
    if (before[token] !== after[token]) {
      fail(label + ': token count changed for ' + token + ': ' + before[token] + ' -> ' + after[token]);
    }
  });
}

function replaceExactOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) fail(label + ': expected source block not found.');
  if (text.indexOf(from, first + from.length) >= 0) fail(label + ': expected source block appears more than once.');
  return text.slice(0, first) + to + text.slice(first + from.length);
}

function getBootStyle(text) {
  const match = text.match(/<style id="cdaRemakeTatBootStylesV6501">([\s\S]*?)<\/style>/);
  if (!match) fail('Index boot stylesheet cdaRemakeTatBootStylesV6501 was not found.');
  return match[1];
}

const actualBlobSha = execFileSync('git', ['hash-object', sourcePath], { encoding: 'utf8' }).trim();
if (actualBlobSha !== expectedBlobSha) {
  fail('Index.html Git blob guard failed. Expected ' + expectedBlobSha + ' but found ' + actualBlobSha + '. Re-audit before cleanup.');
}

const original = fs.readFileSync(sourcePath, 'utf8');
const originalBootStyle = getBootStyle(original);
const staleBootBefore = counts(originalBootStyle, staleTokens);
const staleGlobalBefore = counts(original, staleTokens);
const protectedBefore = counts(original, protectedTokens);

staleTokens.forEach(function(token) {
  if (staleBootBefore[token] !== 1) {
    fail('Expected exactly one ' + token + ' occurrence inside the boot stylesheet before cleanup, found ' + staleBootBefore[token] + '.');
  }
});

const from = [
  '  #tabOneBtn,',
  '  .managerTabs > .tabGroup,',
  '  #underConstructionBtn,',
  '  #underConstructionMenu,',
  '  #categoricalTabBtn,',
  '  #overviewNavActions,',
  '  #overviewOne,',
  '  #overviewTwo,',
  '  #categoricalPage,'
].join('\n');

const to = [
  '  .managerTabs > .tabGroup,',
  '  #underConstructionBtn,',
  '  #underConstructionMenu,',
  '  #categoricalTabBtn,',
  '  #categoricalPage,'
].join('\n');

const next = replaceExactOnce(original, from, to, 'remove stale deleted-Overview boot selectors');
if (next === original) fail('Index cleanup produced no source change.');

const nextBootStyle = getBootStyle(next);
const staleBootAfter = counts(nextBootStyle, staleTokens);
const staleGlobalAfter = counts(next, staleTokens);
staleTokens.forEach(function(token) {
  if (staleBootAfter[token] !== 0) {
    fail('Stale deleted-Overview token remains inside boot stylesheet after cleanup: ' + token + '.');
  }
  if (staleGlobalAfter[token] !== staleGlobalBefore[token] - 1) {
    fail('Unexpected global occurrence delta for ' + token + ': ' + staleGlobalBefore[token] + ' -> ' + staleGlobalAfter[token] + '.');
  }
});

const protectedAfter = counts(next, protectedTokens);
assertCountsEqual(protectedBefore, protectedAfter, sourcePath);

const scriptOpenCountBefore = (original.match(/<script\b/gi) || []).length;
const scriptCloseCountBefore = (original.match(/<\/script>/gi) || []).length;
const scriptOpenCountAfter = (next.match(/<script\b/gi) || []).length;
const scriptCloseCountAfter = (next.match(/<\/script>/gi) || []).length;
if (scriptOpenCountBefore !== scriptOpenCountAfter || scriptCloseCountBefore !== scriptCloseCountAfter || scriptOpenCountAfter !== scriptCloseCountAfter) {
  fail('Index script tag boundaries changed unexpectedly.');
}

const styleOpenCountBefore = (original.match(/<style\b/gi) || []).length;
const styleCloseCountBefore = (original.match(/<\/style>/gi) || []).length;
const styleOpenCountAfter = (next.match(/<style\b/gi) || []).length;
const styleCloseCountAfter = (next.match(/<\/style>/gi) || []).length;
if (styleOpenCountBefore !== styleOpenCountAfter || styleCloseCountBefore !== styleCloseCountAfter || styleOpenCountAfter !== styleCloseCountAfter) {
  fail('Index style tag boundaries changed unexpectedly.');
}

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive Index snapshot already exists; refusing overwrite.');
fs.writeFileSync(archivePath, original, 'utf8');
if (sha256(fs.readFileSync(archivePath, 'utf8')) !== sha256(original)) fail('Index archive byte-for-byte verification failed.');

fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Remove stale deleted-Overview selectors from active Index boot stylesheet',
  source: sourcePath,
  behaviorChangeIntended: false,
  sourceGitBlobShaBefore: actualBlobSha,
  sourceSha256Before: sha256(original),
  sourceSha256After: sha256(next),
  bytesBefore: Buffer.byteLength(original, 'utf8'),
  bytesAfter: Buffer.byteLength(next, 'utf8'),
  bytesRemoved: Buffer.byteLength(original, 'utf8') - Buffer.byteLength(next, 'utf8'),
  archivePath,
  archiveByteForByteVerified: true,
  staleBootTokenCountsBefore: staleBootBefore,
  staleBootTokenCountsAfter: staleBootAfter,
  staleGlobalTokenCountsBefore: staleGlobalBefore,
  staleGlobalTokenCountsAfter: staleGlobalAfter,
  protectedTokenCountsBefore: protectedBefore,
  protectedTokenCountsAfter: protectedAfter,
  scriptTagBoundaryCountsPreserved: true,
  styleTagBoundaryCountsPreserved: true,
  productionDeployment: false
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  bytesRemoved: report.bytesRemoved,
  staleOverviewBootSelectorsRemaining: 0,
  sourceSha256After: report.sourceSha256After
}, null, 2));
