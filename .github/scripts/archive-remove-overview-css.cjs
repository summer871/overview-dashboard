'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

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
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '[') bracketDepth += 1;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);

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

function hasOverviewMarker(selector) {
  return /#overviewOne\b|#overviewTwo\b|\.overviewTwo[A-Za-z0-9_-]*|\.o2[A-Za-z0-9_-]*/.test(selector);
}

function hasProtectedSelectorToken(selector) {
  return /#remakeFactorPage|#remakeTabFilterHostV6337|#tatTabFilterHostV6509|\.remake|\.cdaFilter/i.test(selector);
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

function findNextTopDelimiter(css, start) {
  let quote = '';
  let escaped = false;
  let inComment = false;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = start; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1] || '';

    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      parenDepth += 1;
      continue;
    }
    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (ch === '[') {
      bracketDepth += 1;
      continue;
    }
    if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (parenDepth === 0 && bracketDepth === 0 && (ch === '{' || ch === ';')) {
      return { index: i, delimiter: ch };
    }
  }
  if (quote || inComment || parenDepth || bracketDepth) fail('Unterminated CSS token while scanning top-level content.');
  return null;
}

function findMatchingBrace(css, openIndex) {
  let depth = 1;
  let quote = '';
  let escaped = false;
  let inComment = false;

  for (let i = openIndex + 1; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1] || '';

    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  fail('Unmatched CSS opening brace at offset ' + openIndex + '.');
}

function leadingTrivia(rawHeader) {
  const match = rawHeader.match(/^((?:\s|\/\*[\s\S]*?\*\/)*)/);
  return match ? match[1] : '';
}

function isNestedRuleAtRule(header) {
  return /^@(media|supports|container|layer|scope|document)\b/i.test(header);
}

function transformCss(css, removeOverviewRules, removedSelectors, remainingOverviewSelectors) {
  let cursor = 0;
  let output = '';

  while (cursor < css.length) {
    const delimiter = findNextTopDelimiter(css, cursor);
    if (!delimiter) {
      output += css.slice(cursor);
      break;
    }

    if (delimiter.delimiter === ';') {
      output += css.slice(cursor, delimiter.index + 1);
      cursor = delimiter.index + 1;
      continue;
    }

    const openIndex = delimiter.index;
    const closeIndex = findMatchingBrace(css, openIndex);
    const rawHeader = css.slice(cursor, openIndex);
    const header = rawHeader.trim();
    const body = css.slice(openIndex + 1, closeIndex);

    if (!header) fail('Empty CSS rule header near offset ' + openIndex + '.');

    if (header.startsWith('@')) {
      if (isNestedRuleAtRule(header)) {
        const nested = transformCss(body, removeOverviewRules, removedSelectors, remainingOverviewSelectors);
        output += rawHeader + '{' + nested + '}';
      } else {
        output += rawHeader + '{' + body + '}';
      }
      cursor = closeIndex + 1;
      continue;
    }

    const selectors = splitSelectorList(header);
    if (!selectors.length) fail('Unable to parse CSS selector list: ' + header);
    const overviewOnly = selectors.every(isOverviewOnlySelector);

    if (removeOverviewRules && overviewOnly) {
      if (hasProtectedSelectorToken(header)) fail('Refusing mixed/protected selector: ' + header);
      removedSelectors.push(header);
      output += leadingTrivia(rawHeader);
    } else {
      if (hasOverviewMarker(header)) remainingOverviewSelectors.push(header);
      output += rawHeader + '{' + body + '}';
    }
    cursor = closeIndex + 1;
  }

  return output;
}

function transformStyleBlocks(source, removeOverviewRules) {
  const styleRe = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
  const replacements = [];
  const removedSelectors = [];
  const remainingOverviewSelectors = [];
  let match;
  let blockCount = 0;

  while ((match = styleRe.exec(source))) {
    blockCount += 1;
    const fullStart = match.index;
    const openLength = match[0].indexOf('>') + 1;
    const contentStart = fullStart + openLength;
    const content = match[2];
    const transformed = transformCss(content, removeOverviewRules, removedSelectors, remainingOverviewSelectors);
    replacements.push({ start: contentStart, end: contentStart + content.length, text: transformed });
  }
  if (!blockCount) fail('No style blocks found in DashboardBaseStyles.html.');

  let next = source;
  replacements.sort(function(a, b) { return b.start - a.start; }).forEach(function(rep) {
    next = next.slice(0, rep.start) + rep.text + next.slice(rep.end);
  });

  return { next, blockCount, removedSelectors, remainingOverviewSelectors };
}

const original = fs.readFileSync(sourcePath, 'utf8');
const originalSha256 = sha256(original);
const actualBlobSha = execFileSync('git', ['hash-object', sourcePath], { encoding: 'utf8' }).trim();
if (actualBlobSha !== expectedBlobSha) {
  fail('DashboardBaseStyles.html Git blob guard failed. Expected ' + expectedBlobSha + ' but found ' + actualBlobSha + '. Re-audit before cleanup.');
}

// First prove the built-in scanner is lossless when deletion is disabled.
const parseOnly = transformStyleBlocks(original, false);
if (parseOnly.next !== original) fail('CSS scanner is not byte-preserving in parse-only mode. Refusing cleanup.');

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive stylesheet snapshot already exists; refusing to overwrite recovery evidence.');
fs.writeFileSync(archivePath, original, 'utf8');
if (sha256(fs.readFileSync(archivePath, 'utf8')) !== originalSha256) fail('Archive stylesheet snapshot verification failed.');

const transformed = transformStyleBlocks(original, true);
const next = transformed.next;
if (!transformed.removedSelectors.length) fail('No provably Overview-only CSS rules found.');
if (transformed.removedSelectors.length > 2000) fail('Refusing unexpectedly broad Overview CSS cleanup: ' + transformed.removedSelectors.length + ' rules.');
if (next === original) fail('Overview CSS cleanup produced no source change.');

// Re-parse the result with deletion disabled to prove braces/comments/strings are structurally balanced.
const resultParseOnly = transformStyleBlocks(next, false);
if (resultParseOnly.next !== next) fail('Resulting CSS is not byte-preserving under validation scan.');
if (resultParseOnly.blockCount !== transformed.blockCount) fail('Style block count changed unexpectedly.');

const protectedBefore = protectedTokenCounts(original);
const protectedAfter = protectedTokenCounts(next);
Object.keys(protectedBefore).forEach(function(token) {
  if (protectedBefore[token] !== protectedAfter[token]) {
    fail('Protected selector token count changed for ' + token + ': ' + protectedBefore[token] + ' -> ' + protectedAfter[token]);
  }
});

fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Overview-only CSS removal',
  source: sourcePath,
  sourceGitBlobShaBefore: actualBlobSha,
  sourceSha256Before: originalSha256,
  sourceSha256After: sha256(next),
  bytesBefore: Buffer.byteLength(original, 'utf8'),
  bytesAfter: Buffer.byteLength(next, 'utf8'),
  bytesRemoved: Buffer.byteLength(original, 'utf8') - Buffer.byteLength(next, 'utf8'),
  removedRuleCount: transformed.removedSelectors.length,
  styleBlockCount: transformed.blockCount,
  archivePath: archivePath,
  archiveByteForByteVerified: true,
  parser: 'built-in brace/string/comment-aware CSS scanner; no external package dependency',
  removalCriterion: 'Remove a CSS rule only when every top-level selector branch is anchored to deleted Overview UI (#overviewOne, #overviewTwo, .overviewTwo*, or .o2*), and reject any selector containing protected Remake/TAT/shared-filter tokens.',
  protectedTokenCountsBefore: protectedBefore,
  protectedTokenCountsAfter: protectedAfter,
  remainingOverviewSelectorCount: transformed.remainingOverviewSelectors.length,
  remainingOverviewSelectorsSample: transformed.remainingOverviewSelectors.slice(0, 100),
  removedSelectors: transformed.removedSelectors,
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
