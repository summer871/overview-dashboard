'use strict';

// Guarded Overview JavaScript checkpoint. Dependency-free by design.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { execFileSync } = require('child_process');

const sourcePath = 'DashboardMainScript.html';
const expectedBlobSha = '06c1dce5bf2cb49023a460d542124e6010e9204d';
const archiveDir = path.join('archive', 'overview-paused-2026-08-21');
const archivePath = path.join(archiveDir, 'DashboardMainScript.pre-overview-js-removal.html');
const reportPath = path.join('docs', 'OVERVIEW-JS-ARCHIVE-REMOVAL-2026-08-21.json');

const protectedTokens = [
  'remakeFactorPage',
  'remakeTabFilterHostV6337',
  'tatTabFilterHostV6509',
  'filterValuesV6245',
  'excludedFilterValuesV6389',
  'effectiveSelectionSetV6250',
  'commitEffectiveSelectionV6389',
  'persistUiV6230',
  'renderDashboardV6230',
  'cdaTatFilterBridgeV6646',
  'cdaSharedFilterActiveV6646',
  'SharedFilterBar',
  'SharedTableModule',
  'TatDashboardController',
  'RemakeDashboard'
];

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function gitBlobSha(file) {
  return execFileSync('git', ['hash-object', file], { encoding: 'utf8' }).trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenRegex(name) {
  return new RegExp('\\b' + escapeRegex(name) + '\\b', 'g');
}

function sanitizeTemplates(js) {
  return js.replace(/<\?[\s\S]*?\?>/g, function(match) {
    if (match.length < 4) return 'null'.slice(0, match.length);
    return 'null' + ' '.repeat(match.length - 4);
  });
}

function isIdentifierStart(ch) {
  return /[A-Za-z_$]/.test(ch || '');
}

function isIdentifierPart(ch) {
  return /[A-Za-z0-9_$]/.test(ch || '');
}

function previousSignificantChar(text, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!/\s/.test(text[i])) return text[i];
  }
  return '';
}

function slashStartsRegex(text, index) {
  const prev = previousSignificantChar(text, index);
  if (!prev) return true;
  return /[({[=,:;!?&|+\-*%^~<>]/.test(prev);
}

function skipQuoted(text, index, quote) {
  let i = index + 1;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === quote) return i + 1;
    i += 1;
  }
  return -1;
}

function skipTemplate(text, index) {
  let i = index + 1;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === '`') return i + 1;
    i += 1;
  }
  return -1;
}

function skipLineComment(text, index) {
  const next = text.indexOf('\n', index + 2);
  return next < 0 ? text.length : next + 1;
}

function skipBlockComment(text, index) {
  const next = text.indexOf('*/', index + 2);
  return next < 0 ? -1 : next + 2;
}

function skipRegexLiteral(text, index) {
  let i = index + 1;
  let inClass = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) {
      i += 1;
      while (/[A-Za-z]/.test(text[i] || '')) i += 1;
      return i;
    } else if (ch === '\n' || ch === '\r') {
      return index + 1;
    }
    i += 1;
  }
  return index + 1;
}

function advanceNonCode(text, index) {
  const ch = text[index];
  const next = text[index + 1];
  if (ch === "'") return skipQuoted(text, index, "'");
  if (ch === '"') return skipQuoted(text, index, '"');
  if (ch === '`') return skipTemplate(text, index);
  if (ch === '/' && next === '/') return skipLineComment(text, index);
  if (ch === '/' && next === '*') return skipBlockComment(text, index);
  if (ch === '/' && slashStartsRegex(text, index)) return skipRegexLiteral(text, index);
  return null;
}

function findParameterOpen(text, start) {
  let i = start;
  while (i < text.length) {
    const skipped = advanceNonCode(text, i);
    if (skipped !== null) {
      if (skipped < 0) return -1;
      i = skipped;
      continue;
    }
    if (text[i] === '(') return i;
    if (text[i] === '\n' && i - start > 500) return -1;
    i += 1;
  }
  return -1;
}

function findBodyOpen(text, paramOpen) {
  let i = paramOpen;
  let parenDepth = 0;
  while (i < text.length) {
    const skipped = advanceNonCode(text, i);
    if (skipped !== null) {
      if (skipped < 0) return -1;
      i = skipped;
      continue;
    }
    const ch = text[i];
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth < 0) return -1;
    } else if (ch === '{' && parenDepth === 0) {
      return i;
    }
    i += 1;
  }
  return -1;
}

function findMatchingBrace(text, openIndex) {
  let i = openIndex;
  let depth = 0;
  while (i < text.length) {
    const skipped = advanceNonCode(text, i);
    if (skipped !== null) {
      if (skipped < 0) return -1;
      i = skipped;
      continue;
    }
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
      if (depth < 0) return -1;
    }
    i += 1;
  }
  return -1;
}

function scanNamedFunctionDeclarations(js) {
  const matches = [];
  const re = /(^|\n)([ \t]*)function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let match;

  while ((match = re.exec(js))) {
    const declarationStart = match.index + match[1].length + match[2].length;
    if (matches.some(function(def) { return declarationStart > def.nodeStart && declarationStart < def.nodeEnd; })) {
      continue;
    }

    const paramOpen = findParameterOpen(js, declarationStart);
    if (paramOpen < 0) continue;
    const bodyOpen = findBodyOpen(js, paramOpen);
    if (bodyOpen < 0) continue;
    const bodyClose = findMatchingBrace(js, bodyOpen);
    if (bodyClose < 0) continue;

    const lineStart = js.lastIndexOf('\n', declarationStart - 1) + 1;
    let start = declarationStart;
    if (/^\s*$/.test(js.slice(lineStart, declarationStart))) start = lineStart;

    let end = bodyClose + 1;
    while (end < js.length && /[ \t\r]/.test(js[end])) end += 1;
    if (js[end] === '\n') end += 1;

    matches.push({
      name: match[3],
      start,
      end,
      nodeStart: declarationStart,
      nodeEnd: bodyClose + 1,
      text: js.slice(start, end)
    });
    re.lastIndex = bodyClose + 1;
  }

  return matches;
}

function parseValidate(js, label) {
  const sanitized = sanitizeTemplates(js);
  if (sanitized.length !== js.length) fail(label + ': template sanitization changed source length.');
  try {
    new vm.Script(sanitized, { filename: label });
  } catch (error) {
    fail(label + ': JavaScript parse failed: ' + error.message);
  }
}

function isDirectOverviewSeed(def) {
  if (/overview/i.test(def.name)) return true;
  if (/^o2[A-Z0-9_]/.test(def.name)) return true;
  return /\boverviewOne\b|\boverviewTwo\b|#overviewOne\b|#overviewTwo\b|\.o2[A-Za-z0-9_-]+/.test(def.text);
}

function hasProtectedEvidence(def) {
  return protectedTokens.some(function(token) {
    return def.text.includes(token);
  });
}

function protectedCounts(value) {
  const counts = {};
  protectedTokens.forEach(function(token) {
    counts[token] = value.split(token).length - 1;
  });
  return counts;
}

function activeRootFiles() {
  return fs.readdirSync('.')
    .filter(function(name) {
      return name !== sourcePath && /\.(?:html|js|gs)$/i.test(name) && fs.statSync(name).isFile();
    })
    .sort();
}

function occurrences(text, name) {
  const re = tokenRegex(name);
  const positions = [];
  let match;
  while ((match = re.exec(text))) positions.push(match.index);
  return positions;
}

function ownerAt(defs, position) {
  for (const def of defs) {
    if (position >= def.start && position < def.end) return def;
  }
  return null;
}

const original = fs.readFileSync(sourcePath, 'utf8');
const actualBlobSha = gitBlobSha(sourcePath);
if (actualBlobSha !== expectedBlobSha) {
  fail('DashboardMainScript.html Git blob guard failed. Expected ' + expectedBlobSha + ' but found ' + actualBlobSha + '. Re-audit before cleanup.');
}

const scriptOpen = original.search(/<script(?:\s|>)/i);
const scriptOpenEnd = original.indexOf('>', scriptOpen) + 1;
const scriptClose = original.lastIndexOf('</script>');
if (scriptOpen < 0 || scriptOpenEnd <= scriptOpen || scriptClose <= scriptOpenEnd) {
  fail('Could not isolate DashboardMainScript JavaScript payload.');
}

const js = original.slice(scriptOpenEnd, scriptClose);
parseValidate(js, 'DashboardMainScript-before');

const defs = scanNamedFunctionDeclarations(js);
if (!defs.length) fail('No named function declarations could be conservatively scanned.');

const byName = new Map();
const duplicateNamesBefore = [];
defs.forEach(function(def) {
  if (byName.has(def.name)) duplicateNamesBefore.push(def.name);
  byName.set(def.name, def);
});
if (duplicateNamesBefore.length) {
  fail('Duplicate scanned top-level function names remain before Overview cleanup: ' + Array.from(new Set(duplicateNamesBefore)).join(', '));
}

const directSeeds = defs.filter(isDirectOverviewSeed);
if (!directSeeds.length) fail('No direct Overview top-level function seeds found.');

const protectedSeeds = directSeeds.filter(hasProtectedEvidence);
let candidates = new Set(directSeeds.filter(function(def) { return !hasProtectedEvidence(def); }).map(function(def) { return def.name; }));
if (!candidates.size) fail('Every Overview seed intersects protected Remake/TAT/shared ownership; refusing cleanup.');

const externalFiles = activeRootFiles();
const externalTexts = new Map(externalFiles.map(function(file) {
  return [file, fs.readFileSync(file, 'utf8')];
}));
const pruned = new Map();

let changed = true;
while (changed) {
  changed = false;
  for (const name of Array.from(candidates)) {
    const refsOutsideCandidate = [];

    for (const pos of occurrences(js, name)) {
      const owner = ownerAt(defs, pos);
      if (!owner || !candidates.has(owner.name)) {
        refsOutsideCandidate.push(owner ? 'DashboardMainScript.html::' + owner.name : 'DashboardMainScript.html::<top-level>');
      }
    }

    for (const [file, text] of externalTexts.entries()) {
      if (tokenRegex(name).test(text)) refsOutsideCandidate.push(file);
    }

    if (refsOutsideCandidate.length) {
      candidates.delete(name);
      pruned.set(name, Array.from(new Set(refsOutsideCandidate)).sort());
      changed = true;
    }
  }
}

const removals = defs.filter(function(def) { return candidates.has(def.name); });
if (!removals.length) fail('No Overview-only functions survived the external-reference guard.');
if (removals.length > 200) fail('Refusing unexpectedly broad Overview JavaScript cleanup: ' + removals.length + ' functions.');

const removedBytes = removals.reduce(function(sum, def) {
  return sum + Buffer.byteLength(def.text, 'utf8');
}, 0);
if (removedBytes > 500000) fail('Refusing unexpectedly broad Overview JavaScript cleanup: ' + removedBytes + ' bytes.');

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive JavaScript snapshot already exists; refusing to overwrite recovery evidence.');
fs.writeFileSync(archivePath, original, 'utf8');
if (sha256(fs.readFileSync(archivePath, 'utf8')) !== sha256(original)) fail('Archive JavaScript snapshot verification failed.');

let nextJs = js;
const sortedRemovals = removals.slice().sort(function(a, b) { return b.start - a.start; });
sortedRemovals.forEach(function(def) {
  nextJs = nextJs.slice(0, def.start) + nextJs.slice(def.end);
});
const next = original.slice(0, scriptOpenEnd) + nextJs + original.slice(scriptClose);
if (next === original) fail('Overview JavaScript cleanup produced no source change.');

parseValidate(nextJs, 'DashboardMainScript-after');
const nextDefs = scanNamedFunctionDeclarations(nextJs);
const nextNames = new Set();
const duplicateNames = [];
nextDefs.forEach(function(def) {
  if (nextNames.has(def.name)) duplicateNames.push(def.name);
  nextNames.add(def.name);
});
if (duplicateNames.length) fail('Top-level duplicate functions appeared after cleanup: ' + Array.from(new Set(duplicateNames)).join(', '));

for (const removed of removals) {
  if (tokenRegex(removed.name).test(nextJs)) {
    fail('Removed function name still appears in DashboardMainScript after cleanup: ' + removed.name);
  }
  for (const [file, text] of externalTexts.entries()) {
    if (tokenRegex(removed.name).test(text)) {
      fail('Removed function name still appears in active root file ' + file + ': ' + removed.name);
    }
  }
}

const protectedBefore = protectedCounts(original);
const protectedAfter = protectedCounts(next);
protectedTokens.forEach(function(token) {
  if (protectedBefore[token] !== protectedAfter[token]) {
    fail('Protected token count changed for ' + token + ': ' + protectedBefore[token] + ' -> ' + protectedAfter[token]);
  }
});

fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Overview-only JavaScript top-level function removal',
  source: sourcePath,
  sourceGitBlobShaBefore: expectedBlobSha,
  sourceSha256Before: sha256(original),
  sourceSha256After: sha256(next),
  bytesBefore: Buffer.byteLength(original, 'utf8'),
  bytesAfter: Buffer.byteLength(next, 'utf8'),
  bytesRemoved: Buffer.byteLength(original, 'utf8') - Buffer.byteLength(next, 'utf8'),
  topLevelFunctionsBefore: defs.length,
  topLevelFunctionsAfter: nextDefs.length,
  directOverviewSeedCount: directSeeds.length,
  protectedOverviewSeedCount: protectedSeeds.length,
  removedFunctionCount: removals.length,
  retainedOverviewSeedCount: directSeeds.length - removals.length,
  remainingTopLevelDuplicateFunctionNames: 0,
  archivePath,
  archiveByteForByteVerified: true,
  parser: 'built-in conservative named-function lexical scanner plus vm.Script syntax validation',
  removalCriterion: 'Only direct Overview named-function seeds are eligible. A fixed-point reference guard removes a function from the deletion set if its identifier appears from retained DashboardMain code or any other active root .html/.js/.gs file. Functions containing protected Remake/TAT/shared-owner tokens are never eligible. The resulting script must parse with Node vm.Script.',
  protectedTokenCountsBefore: protectedBefore,
  protectedTokenCountsAfter: protectedAfter,
  removedFunctions: removals.map(function(def) {
    return {
      name: def.name,
      bytes: Buffer.byteLength(def.text, 'utf8'),
      sha256: sha256(def.text)
    };
  }),
  retainedProtectedSeeds: protectedSeeds.map(function(def) { return def.name; }).sort(),
  retainedExternallyReferencedSeeds: Array.from(pruned.entries()).map(function(entry) {
    return { name: entry[0], references: entry[1] };
  }).sort(function(a, b) { return a.name.localeCompare(b.name); })
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  directOverviewSeeds: report.directOverviewSeedCount,
  removedFunctions: report.removedFunctionCount,
  removedBytes: report.bytesRemoved,
  retainedOverviewSeeds: report.retainedOverviewSeedCount
}, null, 2));
