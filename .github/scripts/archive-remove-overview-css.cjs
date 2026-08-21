'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');

const sourcePath = 'DashboardBaseStyles.html';
const expectedBlobSha = 'e73c7109e5e69d70204730da91502e7c57a5fabc';
const archiveDir = path.join('archive', 'overview-paused-2026-08-21');
const archivePath = path.join(archiveDir, 'DashboardBaseStyles.pre-overview-css-removal.html');
const reportPath = path.join('docs', 'OVERVIEW-CSS-ARCHIVE-REMOVAL-2026-08-21.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function fail(message) {
  throw new Error(message);
}

function splitSelectorList(selector) {
  const parts = [];
  let current = '';
  let quote = '';
  let escaped = false;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      current += ch;
      quote = ch;
      continue;
    }
    if (ch === '(') parenDepth += 1;
    if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === '[') bracketDepth += 1;
    if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function isOverviewOnlySelector(selector) {
  return /#overviewOne\b/i.test(selector)
    || /#overviewTwo\b/i.test(selector)
    || /\.overviewTwo[A-Za-z0-9_-]*/.test(selector)
    || /\.o2[A-Za-z0-9_-]*/.test(selector);
}

function protectedTokenCounts(value) {
  const tokens = [
    '#remakeFactorPage',
    '#remakeTabFilterHostV6337',
    '#tatTabFilterHostV6509',
    '.remakeFilterBarV6230',
    '.cdaFilterBar'
  ];
  const result = {};
  tokens.forEach(function(token) {
    result[token] = value.split(token).length - 1;
  });
  return result;
}

const original = fs.readFileSync(sourcePath, 'utf8');
const originalSha256 = sha256(original);

// Git blob SHA cannot be derived with plain SHA-256; keep the known GitHub blob in the report
// and use SHA-256 plus the archive copy for the executable content guard.
const expectedSha256 = 'f1a60ea180e1dc505af75b8442791b51f21ad9f774592e048e767f203f22e22b';
if (originalSha256 !== expectedSha256) {
  fail('DashboardBaseStyles.html SHA-256 guard failed. Expected ' + expectedSha256 + ' but found ' + originalSha256 + '. Re-audit before cleanup.');
}

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive stylesheet snapshot already exists; refusing to overwrite recovery evidence.');
fs.writeFileSync(archivePath, original, 'utf8');
if (sha256(fs.readFileSync(archivePath, 'utf8')) !== originalSha256) fail('Archive stylesheet snapshot verification failed.');

const styleRe = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
const blocks = [];
let match;
while ((match = styleRe.exec(original))) {
  const fullStart = match.index;
  const openLength = match[0].indexOf('>') + 1;
  const contentStart = fullStart + openLength;
  const content = match[2];
  let root;
  try {
    root = postcss.parse(content, { from: undefined });
  } catch (error) {
    fail('Unable to parse stylesheet block: ' + error.message);
  }
  blocks.push({ contentStart, content, root });
}
if (!blocks.length) fail('No style blocks found in DashboardBaseStyles.html.');

const removedRules = [];
blocks.forEach(function(block, blockIndex) {
  block.root.walkRules(function(rule) {
    const selector = String(rule.selector || '').trim();
    if (!selector) return;
    const branches = splitSelectorList(selector);
    if (!branches.length) return;
    if (!branches.every(isOverviewOnlySelector)) return;

    // Extra safety: no clearly protected active-dashboard token may appear in a removed selector.
    if (/#remakeFactorPage|#remakeTabFilterHostV6337|#tatTabFilterHostV6509|\.remake|\.cdaFilter/i.test(selector)) {
      fail('Refusing mixed/protected selector: ' + selector);
    }

    removedRules.push({
      blockIndex: blockIndex,
      selector: selector,
      branches: branches.slice(),
      css: rule.toString()
    });
    rule.remove();
  });
});

if (!removedRules.length) fail('No provably Overview-only CSS rules found.');
if (removedRules.length > 2000) fail('Refusing unexpectedly broad Overview CSS cleanup: ' + removedRules.length + ' rules.');

let next = original;
const replacements = [];
blocks.forEach(function(block) {
  replacements.push({
    start: block.contentStart,
    end: block.contentStart + block.content.length,
    text: block.root.toString()
  });
});
replacements.sort(function(a, b) { return b.start - a.start; }).forEach(function(rep) {
  next = next.slice(0, rep.start) + rep.text + next.slice(rep.end);
});

if (next === original) fail('Overview CSS cleanup produced no source change.');

const protectedBefore = protectedTokenCounts(original);
const protectedAfter = protectedTokenCounts(next);
Object.keys(protectedBefore).forEach(function(token) {
  if (protectedBefore[token] !== protectedAfter[token]) {
    fail('Protected selector token count changed for ' + token + ': ' + protectedBefore[token] + ' -> ' + protectedAfter[token]);
  }
});

let parsedBlocksAfter = 0;
styleRe.lastIndex = 0;
while ((match = styleRe.exec(next))) {
  postcss.parse(match[2], { from: undefined });
  parsedBlocksAfter += 1;
}
if (parsedBlocksAfter !== blocks.length) fail('Style block count changed unexpectedly.');

// Every remaining rule that still contains an Overview marker must either be mixed/shared,
// or belong to a construct we intentionally retained. This is evidence, not a failure.
const remainingOverviewSelectors = [];
styleRe.lastIndex = 0;
while ((match = styleRe.exec(next))) {
  const root = postcss.parse(match[2], { from: undefined });
  root.walkRules(function(rule) {
    const selector = String(rule.selector || '').trim();
    if (/#overviewOne\b|#overviewTwo\b|\.overviewTwo[A-Za-z0-9_-]*|\.o2[A-Za-z0-9_-]*/.test(selector)) {
      remainingOverviewSelectors.push(selector);
    }
  });
}

fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Overview-only CSS removal',
  source: sourcePath,
  sourceGitBlobShaBefore: expectedBlobSha,
  sourceSha256Before: originalSha256,
  sourceSha256After: sha256(next),
  bytesBefore: Buffer.byteLength(original, 'utf8'),
  bytesAfter: Buffer.byteLength(next, 'utf8'),
  bytesRemoved: Buffer.byteLength(original, 'utf8') - Buffer.byteLength(next, 'utf8'),
  removedRuleCount: removedRules.length,
  archivePath: archivePath,
  archiveByteForByteVerified: true,
  removalCriterion: 'Remove a CSS rule only when every top-level selector branch is anchored to deleted Overview UI (#overviewOne, #overviewTwo, .overviewTwo*, or .o2*), and reject any selector containing protected Remake/TAT/shared-filter tokens.',
  protectedTokenCountsBefore: protectedBefore,
  protectedTokenCountsAfter: protectedAfter,
  remainingOverviewSelectorCount: remainingOverviewSelectors.length,
  remainingOverviewSelectorsSample: remainingOverviewSelectors.slice(0, 100),
  removedSelectors: removedRules.map(function(item) { return item.selector; }),
  productionDeployment: false
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  removedRuleCount: report.removedRuleCount,
  bytesRemoved: report.bytesRemoved,
  remainingOverviewSelectorCount: report.remainingOverviewSelectorCount,
  sourceSha256After: report.sourceSha256After
}, null, 2));
