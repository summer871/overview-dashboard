'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const sourcePath = 'DashboardBaseStyles.html';
const expectedBlobSha = '0ea60c3e709759ff12934a50c54563d1e1fae671';
const archiveDir = path.join('archive', 'overview-paused-2026-08-21');
const archivePath = path.join(archiveDir, 'DashboardBaseStyles.pre-final-overview-css-removal.html');
const reportPath = path.join('docs', 'OVERVIEW-CSS-FINAL-REMOVAL-2026-08-21.json');
const expectedRemainingOverviewRules = 15;

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function fail(message) {
  throw new Error(message);
}

function stripLeadingTrivia(value) {
  return value.replace(/^(?:\s|\/\*[\s\S]*?\*\/)+/, '').trim();
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
  const clean = stripLeadingTrivia(selector);
  return /#overviewOne\b/i.test(clean)
    || /#overviewTwo\b/i.test(clean)
    || /\.overviewTwo[A-Za-z0-9_-]*/.test(clean)
    || /\.o2[A-Za-z0-9_-]*/.test(clean);
}

function hasOverviewMarker(selector) {
  const clean = stripLeadingTrivia(selector);
  return /#overviewOne\b|#overviewTwo\b|\.overviewTwo[A-Za-z0-9_-]*|\.o2[A-Za-z0-9_-]*/.test(clean);
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
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '[') bracketDepth += 1;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
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
  return /^@(media|supports|container|layer|scope|document)\b/i.test(stripLeadingTrivia(header));
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
    const cleanHeader = stripLeadingTrivia(rawHeader);
    const body = css.slice(openIndex + 1, closeIndex);
    if (!cleanHeader) fail('Empty CSS rule header near offset ' + openIndex + '.');

    if (cleanHeader.startsWith('@')) {
      if (isNestedRuleAtRule(cleanHeader)) {
        const nested = transformCss(body, removeOverviewRules, removedSelectors, remainingOverviewSelectors);
        output += rawHeader + '{' + nested + '}';
      } else {
        output += rawHeader + '{' + body + '}';
      }
      cursor = closeIndex + 1;
      continue;
    }

    const selectors = splitSelectorList(cleanHeader);
    if (!selectors.length) fail('Unable to parse CSS selector list: ' + cleanHeader);
    const overviewOnly = selectors.every(isOverviewOnlySelector);

    if (removeOverviewRules && overviewOnly) {
      if (hasProtectedSelectorToken(cleanHeader)) fail('Refusing mixed/protected selector: ' + cleanHeader);
      removedSelectors.push(cleanHeader);
      output += leadingTrivia(rawHeader);
    } else {
      if (hasOverviewMarker(cleanHeader)) remainingOverviewSelectors.push(cleanHeader);
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
const actualBlobSha = execFileSync('git', ['hash-object', sourcePath], { encoding: 'utf8' }).trim();
if (actualBlobSha !== expectedBlobSha) {
  fail('DashboardBaseStyles.html Git blob guard failed. Expected ' + expectedBlobSha + ' but found ' + actualBlobSha + '. Re-audit before cleanup.');
}

const parseOnly = transformStyleBlocks(original, false);
if (parseOnly.next !== original) fail('CSS scanner is not byte-preserving in parse-only mode. Refusing cleanup.');
if (parseOnly.remainingOverviewSelectors.length !== expectedRemainingOverviewRules) {
  fail('Expected exactly ' + expectedRemainingOverviewRules + ' remaining Overview rules but found ' + parseOnly.remainingOverviewSelectors.length + '.');
}

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive stylesheet snapshot already exists; refusing to overwrite recovery evidence.');
fs.writeFileSync(archivePath, original, 'utf8');
if (sha256(fs.readFileSync(archivePath, 'utf8')) !== sha256(original)) fail('Archive stylesheet snapshot verification failed.');

const transformed = transformStyleBlocks(original, true);
if (transformed.removedSelectors.length !== expectedRemainingOverviewRules) {
  fail('Expected to remove exactly ' + expectedRemainingOverviewRules + ' Overview rules but removed ' + transformed.removedSelectors.length + '.');
}
if (transformed.remainingOverviewSelectors.length !== 0) {
  fail('Overview selectors remain after final cleanup: ' + transformed.remainingOverviewSelectors.join(' | '));
}
const next = transformed.next;
if (next === original) fail('Final Overview CSS cleanup produced no source change.');

const resultParseOnly = transformStyleBlocks(next, false);
if (resultParseOnly.next !== next) fail('Resulting CSS is not byte-preserving under validation scan.');
if (resultParseOnly.blockCount !== transformed.blockCount) fail('Style block count changed unexpectedly.');
if (resultParseOnly.remainingOverviewSelectors.length !== 0) fail('Overview selector marker reappeared after validation scan.');

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
  checkpoint: 'Final remaining Overview-only CSS removal',
  source: sourcePath,
  behaviorChangeIntended: false,
  sourceGitBlobShaBefore: actualBlobSha,
  sourceSha256Before: sha256(original),
  sourceSha256After: sha256(next),
  bytesBefore: Buffer.byteLength(original, 'utf8'),
  bytesAfter: Buffer.byteLength(next, 'utf8'),
  bytesRemoved: Buffer.byteLength(original, 'utf8') - Buffer.byteLength(next, 'utf8'),
  removedRuleCount: transformed.removedSelectors.length,
  remainingOverviewSelectorCount: 0,
  styleBlockCount: transformed.blockCount,
  archivePath,
  archiveByteForByteVerified: true,
  parser: 'built-in brace/string/comment-aware CSS scanner; leading comments stripped for selector classification only',
  removalCriterion: 'Remove exactly the 15 previously retained rules only when every selector branch remains anchored to deleted Overview UI after leading comment trivia is ignored. Reject protected Remake/TAT/shared-filter selectors.',
  protectedTokenCountsBefore: protectedBefore,
  protectedTokenCountsAfter: protectedAfter,
  removedSelectors: transformed.removedSelectors,
  productionDeployment: false
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ removedRuleCount: report.removedRuleCount, bytesRemoved: report.bytesRemoved, remainingOverviewSelectorCount: 0 }, null, 2));
