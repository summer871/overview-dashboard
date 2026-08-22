'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { execFileSync } = require('child_process');

const datePt = '2026-08-21';
const archiveDir = path.join('archive', 'overview-paused-2026-08-21');
const reportPath = path.join('docs', 'OVERVIEW-SUPPORT-STALE-REF-CLEANUP-2026-08-21.json');

const files = {
  support01: {
    path: 'DashboardSupportScript01.html',
    expectedBlobSha: 'f13c601f725426387b88f46a69af1b5c636a6c0b',
    archivePath: path.join(archiveDir, 'DashboardSupportScript01.pre-stale-overview-ref-removal.html')
  },
  support04: {
    path: 'DashboardSupportScript04.html',
    expectedBlobSha: 'ccc827d01dc6439709e8d97ecbda8abca9fe3a21',
    archivePath: path.join(archiveDir, 'DashboardSupportScript04.pre-stale-overview-ref-removal.html')
  }
};

const protectedTokens = [
  'remakeFactorPage',
  'remakeFactorTabBtn',
  'categoricalPage',
  'remakeYearFilter',
  'remakeDepartmentFilter',
  'remakeProductFilter',
  'remakeCustomerFilter',
  'remakeReasonFilter'
];

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function gitBlobSha(filePath) {
  return execFileSync('git', ['hash-object', filePath], { encoding: 'utf8' }).trim();
}

function countLiteral(text, token) {
  return text.split(token).length - 1;
}

function tokenCounts(text) {
  const counts = {};
  protectedTokens.forEach(function(token) {
    counts[token] = countLiteral(text, token);
  });
  return counts;
}

function assertCountsEqual(before, after, label) {
  protectedTokens.forEach(function(token) {
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

function validateSingleScriptHtml(filePath, text) {
  const opens = (text.match(/<script\b/gi) || []).length;
  const closes = (text.match(/<\/script>/gi) || []).length;
  if (opens !== 1 || closes !== 1) fail(filePath + ': expected exactly one script block; found ' + opens + ' open / ' + closes + ' close.');
  const match = text.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) fail(filePath + ': executable script payload not found.');
  const prepared = match[1].replace(/<\?[!=]?[\s\S]*?\?>/g, 'null');
  try {
    new vm.Script(prepared, { filename: filePath });
  } catch (error) {
    fail(filePath + ': resulting JavaScript failed syntax validation: ' + error.message);
  }
}

Object.keys(files).forEach(function(key) {
  const meta = files[key];
  const actual = gitBlobSha(meta.path);
  if (actual !== meta.expectedBlobSha) {
    fail(meta.path + ': Git blob guard failed. Expected ' + meta.expectedBlobSha + ' but found ' + actual + '. Re-audit before cleanup.');
  }
});

const original01 = fs.readFileSync(files.support01.path, 'utf8');
const original04 = fs.readFileSync(files.support04.path, 'utf8');

const expectedTargetCounts01 = {
  tabOneBtn: 5,
  overviewNavActions: 3,
  overviewOne: 4,
  overviewTwo: 4
};
Object.keys(expectedTargetCounts01).forEach(function(token) {
  const actual = countLiteral(original01, token);
  if (actual !== expectedTargetCounts01[token]) {
    fail(files.support01.path + ': expected ' + expectedTargetCounts01[token] + ' occurrences of ' + token + ' but found ' + actual + '.');
  }
});
if (countLiteral(original04, 'overviewOne') !== 1 || countLiteral(original04, 'overviewTwo') !== 1) {
  fail(files.support04.path + ': expected exactly one overviewOne and one overviewTwo occurrence before cleanup.');
}

const protected01Before = tokenCounts(original01);
const protected04Before = tokenCounts(original04);

let next01 = original01;
next01 = replaceExactOnce(
  next01,
  "      html.cdaExecRemakeOnlyV6243 .layoutResizeHandleV6184,\n      body.cdaExecRemakeOnlyV6243 .layoutResizeHandleV6184,\n      html.cdaExecRemakeOnlyV6243 #overviewNavActions,\n      body.cdaExecRemakeOnlyV6243 #overviewNavActions {",
  "      html.cdaExecRemakeOnlyV6243 .layoutResizeHandleV6184,\n      body.cdaExecRemakeOnlyV6243 .layoutResizeHandleV6184 {",
  'remove deleted overviewNavActions selectors'
);
next01 = replaceExactOnce(
  next01,
  "      html.cdaExecRemakeOnlyV6243 #tabOneBtn,\n      body.cdaExecRemakeOnlyV6243 #tabOneBtn,\n      html.cdaExecRemakeOnlyV6243 #underConstructionBtn,",
  "      html.cdaExecRemakeOnlyV6243 #underConstructionBtn,",
  'remove deleted tabOneBtn selectors'
);
next01 = replaceExactOnce(
  next01,
  "      html.cdaExecRemakeOnlyV6243 #overviewOne,\n      body.cdaExecRemakeOnlyV6243 #overviewOne,\n      html.cdaExecRemakeOnlyV6243 #categoricalPage,\n      body.cdaExecRemakeOnlyV6243 #categoricalPage,\n      html.cdaExecRemakeOnlyV6243 #overviewTwo,\n      body.cdaExecRemakeOnlyV6243 #overviewTwo {",
  "      html.cdaExecRemakeOnlyV6243 #categoricalPage,\n      body.cdaExecRemakeOnlyV6243 #categoricalPage {",
  'remove deleted Overview page selectors while preserving categoricalPage'
);
next01 = replaceExactOnce(
  next01,
  "      'tabOneBtn',\n      'underConstructionBtn',\n      'underConstructionMenu',\n      'categoricalTabBtn',\n      'overviewOne',\n      'categoricalPage',\n      'overviewTwo',\n      'overviewNavActions',",
  "      'underConstructionBtn',\n      'underConstructionMenu',\n      'categoricalTabBtn',\n      'categoricalPage',",
  'remove deleted Overview IDs from hidden-node list'
);
next01 = replaceExactOnce(
  next01,
  "    ['overviewOne', 'categoricalPage', 'overviewTwo'].forEach(id => {",
  "    ['categoricalPage'].forEach(id => {",
  'remove deleted Overview pages from inactive-page cleanup'
);
next01 = replaceExactOnce(
  next01,
  "    ['tabOneBtn', 'underConstructionBtn', 'categoricalTabBtn'].forEach(id => {",
  "    ['underConstructionBtn', 'categoricalTabBtn'].forEach(id => {",
  'remove deleted tabOneBtn from inactive-tab cleanup'
);
next01 = replaceExactOnce(
  next01,
  "event.target.closest('.managerTabs .tabBtn, .tabs .tabBtn, .tabDropdownBtn, #tabOneBtn, #underConstructionBtn, #categoricalTabBtn')",
  "event.target.closest('.managerTabs .tabBtn, .tabs .tabBtn, .tabDropdownBtn, #underConstructionBtn, #categoricalTabBtn')",
  'remove deleted tabOneBtn from click guard selector'
);

let next04 = original04;
next04 = replaceExactOnce(
  next04,
  "const overviewActive = !!document.querySelector('#overviewOne.active, #overviewTwo.active, #categoricalPage.active');",
  "const nonRemakePageActive = !!document.querySelector('#categoricalPage.active');",
  'narrow compact visibility check to the remaining categorical placeholder'
);
next04 = replaceExactOnce(
  next04,
  'if (visible && !overviewActive) return true;',
  'if (visible && !nonRemakePageActive) return true;',
  'rename compact visibility boolean after Overview removal'
);

['tabOneBtn', 'overviewNavActions', 'overviewOne', 'overviewTwo'].forEach(function(token) {
  if (countLiteral(next01, token) !== 0) fail(files.support01.path + ': stale token remains after cleanup: ' + token);
});
if (countLiteral(next04, 'overviewOne') !== 0 || countLiteral(next04, 'overviewTwo') !== 0) {
  fail(files.support04.path + ': stale Overview page token remains after cleanup.');
}

const protected01After = tokenCounts(next01);
const protected04After = tokenCounts(next04);
assertCountsEqual(protected01Before, protected01After, files.support01.path);
assertCountsEqual(protected04Before, protected04After, files.support04.path);

validateSingleScriptHtml(files.support01.path, next01);
validateSingleScriptHtml(files.support04.path, next04);

fs.mkdirSync(archiveDir, { recursive: true });
Object.keys(files).forEach(function(key) {
  const meta = files[key];
  if (fs.existsSync(meta.archivePath)) fail(meta.archivePath + ': archive snapshot already exists; refusing overwrite.');
});
fs.writeFileSync(files.support01.archivePath, original01, 'utf8');
fs.writeFileSync(files.support04.archivePath, original04, 'utf8');
if (sha256(fs.readFileSync(files.support01.archivePath, 'utf8')) !== sha256(original01)) fail('Support01 archive verification failed.');
if (sha256(fs.readFileSync(files.support04.archivePath, 'utf8')) !== sha256(original04)) fail('Support04 archive verification failed.');

fs.writeFileSync(files.support01.path, next01, 'utf8');
fs.writeFileSync(files.support04.path, next04, 'utf8');

const report = {
  datePt,
  checkpoint: 'Stale paused-Overview support references removal',
  behaviorChangeIntended: false,
  scope: 'Only references to DOM nodes already removed from active Index composition: tabOneBtn, overviewNavActions, overviewOne, overviewTwo.',
  files: [
    {
      path: files.support01.path,
      sourceGitBlobShaBefore: files.support01.expectedBlobSha,
      sourceSha256Before: sha256(original01),
      sourceSha256After: sha256(next01),
      bytesBefore: Buffer.byteLength(original01, 'utf8'),
      bytesAfter: Buffer.byteLength(next01, 'utf8'),
      bytesRemoved: Buffer.byteLength(original01, 'utf8') - Buffer.byteLength(next01, 'utf8'),
      archivePath: files.support01.archivePath,
      archiveByteForByteVerified: true,
      staleTargetCountsBefore: expectedTargetCounts01,
      staleTargetCountsAfter: { tabOneBtn: 0, overviewNavActions: 0, overviewOne: 0, overviewTwo: 0 },
      protectedTokenCountsBefore: protected01Before,
      protectedTokenCountsAfter: protected01After
    },
    {
      path: files.support04.path,
      sourceGitBlobShaBefore: files.support04.expectedBlobSha,
      sourceSha256Before: sha256(original04),
      sourceSha256After: sha256(next04),
      bytesBefore: Buffer.byteLength(original04, 'utf8'),
      bytesAfter: Buffer.byteLength(next04, 'utf8'),
      bytesRemoved: Buffer.byteLength(original04, 'utf8') - Buffer.byteLength(next04, 'utf8'),
      archivePath: files.support04.archivePath,
      archiveByteForByteVerified: true,
      staleTargetCountsBefore: { overviewOne: 1, overviewTwo: 1 },
      staleTargetCountsAfter: { overviewOne: 0, overviewTwo: 0 },
      protectedTokenCountsBefore: protected04Before,
      protectedTokenCountsAfter: protected04After
    }
  ],
  syntaxValidatedWithNodeVm: true,
  categoricalPlaceholderPreserved: true,
  remakeTatBehaviorTouched: false,
  productionDeployment: false
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  support01RemovedBytes: report.files[0].bytesRemoved,
  support04RemovedBytes: report.files[1].bytesRemoved,
  staleSupportReferencesRemoved: true
}, null, 2));
