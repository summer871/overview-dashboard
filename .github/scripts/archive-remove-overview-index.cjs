#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '../..');
const indexPath = path.join(root, 'Index.html');
const claspignorePath = path.join(root, '.claspignore');
const archiveDir = path.join(root, 'archive', 'overview-paused-2026-08-21');
const archiveIndexPath = path.join(archiveDir, 'Index.pre-overview-removal.html');
const archiveReadmePath = path.join(archiveDir, 'README.md');
const reportPath = path.join(root, 'docs', 'OVERVIEW-INDEX-ARCHIVE-REMOVAL-2026-08-21.json');
const expectedIndexSha256 = '19056496fa2e1f90f6ad1b4df280d58e660470a4d639742f022723c7e4980b21';

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function fail(message) {
  console.error('ERROR:', message);
  process.exit(1);
}

function removeElementById(source, tagName, id) {
  const openRe = new RegExp('<' + tagName + '\\b[^>]*\\bid=["\\\']' + id + '["\\\'][^>]*>', 'i');
  const open = openRe.exec(source);
  if (!open) fail('Missing <' + tagName + '> with id=' + id);
  const start = open.index;
  const tokenRe = new RegExp('<' + tagName + '\\b[^>]*>|<\\/' + tagName + '\\s*>', 'gi');
  tokenRe.lastIndex = start;
  let depth = 0;
  let token;
  let end = -1;
  while ((token = tokenRe.exec(source))) {
    if (/^<\//.test(token[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      end = tokenRe.lastIndex;
      break;
    }
  }
  if (end < 0) fail('Could not find closing </' + tagName + '> for id=' + id);
  let removalStart = start;
  let removalEnd = end;
  while (removalStart > 0 && source[removalStart - 1] === ' ') removalStart -= 1;
  if (removalStart > 0 && source[removalStart - 1] === '\n') removalStart -= 1;
  while (removalEnd < source.length && (source[removalEnd] === ' ' || source[removalEnd] === '\t')) removalEnd += 1;
  if (source[removalEnd] === '\r') removalEnd += 1;
  if (source[removalEnd] === '\n') removalEnd += 1;
  return {
    source: source.slice(0, removalStart) + source.slice(removalEnd),
    removed: source.slice(removalStart, removalEnd),
    bytes: Buffer.byteLength(source.slice(removalStart, removalEnd), 'utf8')
  };
}

function removeButtonById(source, id) {
  const re = new RegExp('^[ \\t]*<button\\b[^>]*\\bid=["\\\']' + id + '["\\\'][^>]*>[\\s\\S]*?<\\/button>[ \\t]*(?:\\r?\\n)?', 'mi');
  const match = re.exec(source);
  if (!match) fail('Missing button id=' + id);
  return {
    source: source.slice(0, match.index) + source.slice(match.index + match[0].length),
    removed: match[0],
    bytes: Buffer.byteLength(match[0], 'utf8')
  };
}

function claspArchiveExcluded(text) {
  return String(text || '').split(/\r?\n/).some(function(line){ return line.trim() === 'archive/**'; });
}

const before = fs.readFileSync(indexPath, 'utf8');
const beforeSha = sha256(before);
if (beforeSha !== expectedIndexSha256) {
  fail('Index.html SHA guard failed. Expected ' + expectedIndexSha256 + ' but found ' + beforeSha + '. Re-audit before removing Overview.');
}

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archiveIndexPath)) fail('Archive snapshot already exists; refusing to overwrite append-only recovery evidence.');
fs.writeFileSync(archiveIndexPath, before, 'utf8');

let after = before;
const removals = [];
let result = removeButtonById(after, 'tabOneBtn');
after = result.source;
removals.push({ id: 'tabOneBtn', tag: 'button', bytes: result.bytes });

result = removeElementById(after, 'div', 'overviewNavActions');
after = result.source;
removals.push({ id: 'overviewNavActions', tag: 'div', bytes: result.bytes });

result = removeElementById(after, 'section', 'overviewOne');
after = result.source;
removals.push({ id: 'overviewOne', tag: 'section', bytes: result.bytes });

result = removeElementById(after, 'section', 'overviewTwo');
after = result.source;
removals.push({ id: 'overviewTwo', tag: 'section', bytes: result.bytes });

[
  ['tabOneBtn', /<button\b[^>]*\bid=["']tabOneBtn["']/i],
  ['overviewNavActions', /<div\b[^>]*\bid=["']overviewNavActions["']/i],
  ['overviewOne', /<section\b[^>]*\bid=["']overviewOne["']/i],
  ['overviewTwo', /<section\b[^>]*\bid=["']overviewTwo["']/i]
].forEach(function(entry) {
  if (entry[1].test(after)) fail('Overview runtime node still present after removal: ' + entry[0]);
});

if (!/<section\b[^>]*\bid=["']remakeFactorPage["']/i.test(after)) fail('Protected Remake page markup disappeared.');
if (!after.includes("includeDashboardFile('TatDashboardControllerScript')")) fail('Protected TAT controller include disappeared.');
if (!/<section\b[^>]*\bid=["']categoricalPage["']/i.test(after)) fail('Categorical placeholder changed unexpectedly.');

fs.writeFileSync(indexPath, after, 'utf8');

let claspignore = fs.readFileSync(claspignorePath, 'utf8');
if (!claspArchiveExcluded(claspignore)) {
  if (!claspignore.endsWith('\n')) claspignore += '\n';
  claspignore += '# Archived and paused code is intentionally excluded from Apps Script source.\narchive/**\n';
  fs.writeFileSync(claspignorePath, claspignore, 'utf8');
}
if (!claspArchiveExcluded(fs.readFileSync(claspignorePath, 'utf8'))) fail('archive/** is not protected by .claspignore.');

const afterSha = sha256(after);
const archivedSha = sha256(fs.readFileSync(archiveIndexPath, 'utf8'));
if (archivedSha !== beforeSha) fail('Archived Index snapshot does not match outgoing source byte-for-byte.');

fs.writeFileSync(archiveReadmePath,
  '# Paused Overview archive — 2026-08-21\n\n' +
  'This directory contains recovery evidence for the paused Overview UI removed from active `Index.html`.\n\n' +
  '- `Index.pre-overview-removal.html` is an exact byte-for-byte snapshot of the outgoing Index source.\n' +
  '- Source SHA-256: `' + beforeSha + '`\n' +
  '- The archive is explicitly excluded from Apps Script by `.claspignore` (`archive/**`).\n' +
  '- This checkpoint removes only paused Overview UI/routes. Large Overview JavaScript/CSS cleanup is intentionally deferred to a later checkpoint.\n',
  'utf8'
);

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Overview active composition removal',
  source: 'Index.html',
  sourceSha256Before: beforeSha,
  sourceSha256After: afterSha,
  bytesBefore: Buffer.byteLength(before, 'utf8'),
  bytesAfter: Buffer.byteLength(after, 'utf8'),
  bytesRemoved: Buffer.byteLength(before, 'utf8') - Buffer.byteLength(after, 'utf8'),
  archivePath: 'archive/overview-paused-2026-08-21/Index.pre-overview-removal.html',
  archiveByteForByteVerified: archivedSha === beforeSha,
  claspignoreArchiveExclusionVerified: true,
  removedRuntimeNodes: removals,
  protectedRuntimeChecks: {
    remakePagePresent: true,
    tatControllerIncludePresent: true,
    categoricalPlaceholderPresent: true
  },
  deferred: [
    'DashboardMainScript Overview-only JavaScript',
    'DashboardBaseStyles Overview-only CSS',
    'Overview references in support scripts',
    'Overview-only inline script/style layers outside the removed DOM nodes'
  ],
  productionDeployment: false
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log('Overview Index checkpoint prepared.');
console.log('Archive SHA:', archivedSha);
console.log('Index SHA after:', afterSha);
console.log('Bytes removed:', report.bytesRemoved);
