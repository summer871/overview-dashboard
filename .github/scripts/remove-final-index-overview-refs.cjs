'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const sourcePath = 'Index.html';
const expectedBlobSha = '97065bd9fee5b8957d422a8cd40bc037b5858c30';
const archiveDir = path.join('archive', 'overview-paused-2026-08-21');
const archivePath = path.join(archiveDir, 'Index.pre-final-overview-reference-removal.html');
const reportPath = path.join('docs', 'OVERVIEW-INDEX-FINAL-REFERENCE-CLEANUP-2026-08-21.json');

const protectedTokens = [
  '#remakeFactorPage',
  '#categoricalPage',
  '.tabPage',
  '#remakeTabFilterHostV6337',
  '#tatTabFilterHostV6509',
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

function countOverview(text) {
  return (text.match(/overview/gi) || []).length;
}

function tokenCounts(text) {
  const counts = {};
  protectedTokens.forEach(function(token) {
    counts[token] = countLiteral(text, token);
  });
  return counts;
}

function assertCountsEqual(before, after, label) {
  Object.keys(before).forEach(function(token) {
    if (before[token] !== after[token]) {
      fail(label + ': protected token count changed for ' + token + ': ' + before[token] + ' -> ' + after[token]);
    }
  });
}

function replaceExactOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) fail(label + ': expected source block not found.');
  if (text.indexOf(from, first + from.length) >= 0) fail(label + ': expected source block appears more than once.');
  return text.slice(0, first) + to + text.slice(first + from.length);
}

function removeExactScript(text, openingMarker, requiredTokens, label) {
  const start = text.indexOf(openingMarker);
  if (start < 0) fail(label + ': opening marker not found.');
  if (text.indexOf(openingMarker, start + openingMarker.length) >= 0) fail(label + ': opening marker appears more than once.');
  const endMarker = '</script>';
  const endStart = text.indexOf(endMarker, start + openingMarker.length);
  if (endStart < 0) fail(label + ': closing script tag not found.');
  const end = endStart + endMarker.length;
  const block = text.slice(start, end);
  requiredTokens.forEach(function(token) {
    if (!block.includes(token)) fail(label + ': required token missing from removable block: ' + token);
  });
  return {
    next: text.slice(0, start) + text.slice(end),
    block,
    bytesRemoved: Buffer.byteLength(block, 'utf8')
  };
}

const actualBlobSha = execFileSync('git', ['hash-object', sourcePath], { encoding: 'utf8' }).trim();
if (actualBlobSha !== expectedBlobSha) {
  fail('Index.html Git blob guard failed. Expected ' + expectedBlobSha + ' but found ' + actualBlobSha + '. Re-audit before cleanup.');
}

const original = fs.readFileSync(sourcePath, 'utf8');
const overviewCountBefore = countOverview(original);
const overviewTwoBefore = countLiteral(original, '#overviewTwo');
const overviewPageBefore = countLiteral(original, '#overviewPage');
const protectedBefore = tokenCounts(original);

if (overviewCountBefore !== 9) fail('Expected 9 remaining case-insensitive Overview references in Index.html, found ' + overviewCountBefore + '.');
if (overviewTwoBefore !== 3) fail('Expected exactly 3 #overviewTwo references before cleanup, found ' + overviewTwoBefore + '.');
if (overviewPageBefore !== 5) fail('Expected exactly 5 #overviewPage references before cleanup, found ' + overviewPageBefore + '.');
if (countLiteral(original, '#overviewOne') !== 0) fail('Unexpected #overviewOne reference returned before final Index cleanup.');

let next = original;

const v6160 = removeExactScript(
  next,
  '  <script>\n    (function installV6160Layout() {',
  [
    "document.querySelector('#overviewTwo .o2AnalyticsRowV150')",
    "document.querySelector('#overviewTwo .o2FeatureDockV153')",
    "document.querySelector('#overviewTwo .o2ExecutiveInsightsPanelV153')",
    "document.getElementById('o2ExecutiveInsightsTitle')",
    'setTimeout(movePanel, 250)'
  ],
  'remove paused Overview 2 v6.160 layout shim'
);
next = v6160.next;

next = replaceExactOnce(
  next,
  '  #overviewPage,\n  #remakeFactorPage,\n  #categoricalPage,\n  .tabPage,\n  #overviewPage *,\n  #remakeFactorPage *,\n  #categoricalPage * {',
  '  #remakeFactorPage,\n  #categoricalPage,\n  .tabPage,\n  #remakeFactorPage *,\n  #categoricalPage * {',
  'remove nonexistent Overview page from atomic animation guard'
);

next = replaceExactOnce(
  next,
  '  #overviewPage :is(.card,.panel,.tableCard,.chartCard,.componentCard,table,tbody,tr,td,th,canvas),\n',
  '',
  'remove nonexistent Overview page from atomic geometry guard'
);

next = replaceExactOnce(
  next,
  '  #overviewPage .tableWrap,\n',
  '',
  'remove nonexistent Overview page from stable scrollbar guard'
);

next = replaceExactOnce(
  next,
  "element.closest('#overviewPage,#remakeFactorPage,#categoricalPage,.tabPage')",
  "element.closest('#remakeFactorPage,#categoricalPage,.tabPage')",
  'remove nonexistent Overview page from animation cancellation scope'
);

next = replaceExactOnce(
  next,
  '<!-- v6.412: all Overview and Remake Factor dropdown/global searches use the Sales Customer Search-style fuzzy matcher: normalized text, compact text, tokens in any order, initials, partial words, and one-character typo tolerance. -->',
  '<!-- v6.412: Remake Factor dropdown/global searches use the Sales Customer Search-style fuzzy matcher: normalized text, compact text, tokens in any order, initials, partial words, and one-character typo tolerance. -->',
  'remove stale Overview reference from fuzzy-search marker'
);

const overviewCountAfter = countOverview(next);
const overviewTwoAfter = countLiteral(next, '#overviewTwo');
const overviewPageAfter = countLiteral(next, '#overviewPage');
const protectedAfter = tokenCounts(next);

if (overviewCountAfter !== 0) fail('Active Index still contains case-insensitive Overview references after cleanup: ' + overviewCountAfter + '.');
if (overviewTwoAfter !== 0) fail('#overviewTwo references remain after cleanup: ' + overviewTwoAfter + '.');
if (overviewPageAfter !== 0) fail('#overviewPage references remain after cleanup: ' + overviewPageAfter + '.');
assertCountsEqual(protectedBefore, protectedAfter, sourcePath);

if (!next.includes("element.closest('#remakeFactorPage,#categoricalPage,.tabPage')")) {
  fail('Live atomic animation-cancellation scope was not preserved.');
}
if (!next.includes('#remakeFactorPage :is(.remakeCard,.remakeCardV6230,.remakeSectionCardV6230,.remakeTableWrap,.remakeTable,table,tbody,tr,td,th,canvas)')) {
  fail('Live Remake atomic geometry guard was not preserved.');
}
if (!next.includes('#categoricalPage :is(.card,.panel,.tableCard,.chartCard,.componentCard,table,tbody,tr,td,th,canvas)')) {
  fail('Live categorical atomic geometry guard was not preserved.');
}

const scriptOpenBefore = (original.match(/<script\b/gi) || []).length;
const scriptCloseBefore = (original.match(/<\/script>/gi) || []).length;
const scriptOpenAfter = (next.match(/<script\b/gi) || []).length;
const scriptCloseAfter = (next.match(/<\/script>/gi) || []).length;
if (scriptOpenBefore !== scriptCloseBefore || scriptOpenAfter !== scriptCloseAfter) fail('Index script tag boundaries are imbalanced.');
if (scriptOpenAfter !== scriptOpenBefore - 1 || scriptCloseAfter !== scriptCloseBefore - 1) {
  fail('Expected exactly one dead Overview script block to be removed.');
}

const styleOpenBefore = (original.match(/<style\b/gi) || []).length;
const styleCloseBefore = (original.match(/<\/style>/gi) || []).length;
const styleOpenAfter = (next.match(/<style\b/gi) || []).length;
const styleCloseAfter = (next.match(/<\/style>/gi) || []).length;
if (styleOpenBefore !== styleOpenAfter || styleCloseBefore !== styleCloseAfter || styleOpenAfter !== styleCloseAfter) {
  fail('Index style tag boundaries changed unexpectedly.');
}

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive Index snapshot already exists; refusing overwrite.');
fs.writeFileSync(archivePath, original, 'utf8');
if (sha256(fs.readFileSync(archivePath, 'utf8')) !== sha256(original)) fail('Index archive byte-for-byte verification failed.');
fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Final active Index cleanup for paused Overview references',
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
  overviewReferencesBefore: overviewCountBefore,
  overviewReferencesAfter: overviewCountAfter,
  overviewTwoReferencesBefore: overviewTwoBefore,
  overviewTwoReferencesAfter: overviewTwoAfter,
  overviewPageReferencesBefore: overviewPageBefore,
  overviewPageReferencesAfter: overviewPageAfter,
  removedDeadBlocks: [
    'installV6160Layout Overview 2 relocation shim',
    '#overviewPage branches in cdaAtomicStableStylesV6418',
    '#overviewPage branch in dashboardElementV6418 scope',
    'stale Overview reference in v6.412 fuzzy-search marker'
  ],
  preservedLiveBehavior: [
    'Remake atomic animation suppression',
    'Remake atomic geometry stabilization',
    'Remake table scrollbar stabilization',
    'categorical atomic stabilization',
    'tab-page animation cancellation scope',
    'SharedFilterBar / Remake adapter / TAT controller / TAT adapter / SharedFooter includes'
  ],
  protectedTokenCountsBefore: protectedBefore,
  protectedTokenCountsAfter: protectedAfter,
  scriptTagDelta: -1,
  styleTagDelta: 0,
  productionDeployment: false
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  bytesRemoved: report.bytesRemoved,
  overviewReferencesAfter: report.overviewReferencesAfter,
  scriptTagDelta: report.scriptTagDelta,
  archiveByteForByteVerified: report.archiveByteForByteVerified
}, null, 2));
