'use strict';

const crypto = require('crypto');
const fs = require('fs');

const indexPath = 'Index.html';
const reportPath = 'FIRST_OVERRIDE_REMOVAL_REPORT.md';
const targetSelector = '#remakeTabFilterHostV6337 .remakeDropdownButtonV6245';
const expectedEarlierLineMin = 36650;
const expectedEarlierLineMax = 36690;
const expectedLaterLineMin = 44270;

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function splitSelectors(value) {
  const selectors = [];
  let current = '';
  let quote = '';
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let i = 0; i < value.length; i += 1) {
    const char = value.charAt(i);
    if (quote) {
      current += char;
      if (char === quote && value.charAt(i - 1) !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === ',' && bracketDepth === 0 && parenDepth === 0) {
      if (normalizeSpace(current)) selectors.push(normalizeSpace(current));
      current = '';
      continue;
    }
    current += char;
  }
  if (normalizeSpace(current)) selectors.push(normalizeSpace(current));
  return selectors;
}

function parseDeclarations(body) {
  const declarations = new Map();
  let current = '';
  let quote = '';
  let parenDepth = 0;
  const chunks = [];

  for (let i = 0; i < body.length; i += 1) {
    const char = body.charAt(i);
    if (quote) {
      current += char;
      if (char === quote && body.charAt(i - 1) !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === ';' && parenDepth === 0) {
      chunks.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) chunks.push(current);

  chunks.forEach(function(chunk) {
    const separator = chunk.indexOf(':');
    if (separator <= 0) return;
    const property = normalizeSpace(chunk.slice(0, separator)).toLowerCase();
    const rawValue = normalizeSpace(chunk.slice(separator + 1));
    if (!property || !rawValue) return;
    const important = /\s*!important\s*$/i.test(rawValue);
    const value = rawValue.replace(/\s*!important\s*$/i, '').trim();
    declarations.set(property, { value, important });
  });

  return declarations;
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = '';
  let comment = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const char = text.charAt(i);
    const next = text.charAt(i + 1);
    if (comment) {
      if (char === '*' && next === '/') {
        comment = false;
        i += 1;
      }
      continue;
    }
    if (!quote && char === '/' && next === '*') {
      comment = true;
      i += 1;
      continue;
    }
    if (quote) {
      if (char === quote && text.charAt(i - 1) !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function topLevelRules(styleBody, absoluteStart, source) {
  const rules = [];
  let cursor = 0;

  while (cursor < styleBody.length) {
    while (cursor < styleBody.length && /\s/.test(styleBody.charAt(cursor))) cursor += 1;
    if (styleBody.slice(cursor, cursor + 2) === '/*') {
      const commentEnd = styleBody.indexOf('*/', cursor + 2);
      cursor = commentEnd >= 0 ? commentEnd + 2 : styleBody.length;
      continue;
    }

    const openIndex = styleBody.indexOf('{', cursor);
    if (openIndex < 0) break;
    const closeIndex = findMatchingBrace(styleBody, openIndex);
    if (closeIndex < 0) break;

    const prelude = normalizeSpace(styleBody.slice(cursor, openIndex).replace(/\/\*[\s\S]*?\*\//g, ' '));
    const body = styleBody.slice(openIndex + 1, closeIndex);
    const absoluteRuleStart = absoluteStart + cursor;
    const absoluteRuleEnd = absoluteStart + closeIndex + 1;

    if (prelude && prelude.charAt(0) !== '@' && body.indexOf('{') < 0) {
      rules.push({
        prelude,
        selectors: splitSelectors(prelude),
        declarations: parseDeclarations(body),
        start: absoluteRuleStart,
        end: absoluteRuleEnd,
        line: lineNumberAt(source, absoluteRuleStart),
        raw: source.slice(absoluteRuleStart, absoluteRuleEnd)
      });
    }

    cursor = closeIndex + 1;
  }

  return rules;
}

function findTargetRules(source) {
  const stylePattern = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi;
  const targetRules = [];
  let match;
  let styleBlock = 0;

  while ((match = stylePattern.exec(source)) !== null) {
    styleBlock += 1;
    const bodyStart = match.index + match[0].indexOf(match[1]);
    topLevelRules(match[1], bodyStart, source).forEach(function(rule) {
      if (rule.selectors.indexOf(targetSelector) >= 0) {
        rule.styleBlock = styleBlock;
        targetRules.push(rule);
      }
    });
  }

  return targetRules.sort(function(a, b) { return a.start - b.start; });
}

function coversEarlierDeclarations(earlier, later) {
  const missing = [];
  earlier.declarations.forEach(function(earlierValue, property) {
    const laterValue = later.declarations.get(property);
    if (!laterValue || (earlierValue.important && !laterValue.important)) {
      missing.push(property);
    }
  });
  return missing;
}

function expandRemovalToLine(source, start, end) {
  let removalStart = source.lastIndexOf('\n', start - 1) + 1;
  if (source.slice(removalStart, start).trim()) removalStart = start;

  let removalEnd = end;
  while (removalEnd < source.length && (source.charAt(removalEnd) === ' ' || source.charAt(removalEnd) === '\t')) {
    removalEnd += 1;
  }
  if (source.slice(removalEnd, removalEnd + 2) === '\r\n') removalEnd += 2;
  else if (source.charAt(removalEnd) === '\n') removalEnd += 1;

  return { start: removalStart, end: removalEnd };
}

const original = fs.readFileSync(indexPath, 'utf8');
const beforeHash = sha256(original);
const targetRules = findTargetRules(original);

const earlierCandidates = targetRules.filter(function(rule) {
  return rule.line >= expectedEarlierLineMin &&
    rule.line <= expectedEarlierLineMax &&
    rule.selectors.length === 1 &&
    rule.selectors[0] === targetSelector;
});

if (earlierCandidates.length !== 1) {
  throw new Error(`Expected exactly one earlier target rule between lines ${expectedEarlierLineMin}-${expectedEarlierLineMax}; found ${earlierCandidates.length}.`);
}

const earlier = earlierCandidates[0];
const laterCandidates = targetRules.filter(function(rule) {
  return rule.line >= expectedLaterLineMin && rule.start > earlier.start;
});

if (!laterCandidates.length) {
  throw new Error(`No later target rule found after line ${expectedLaterLineMin}.`);
}

let later = null;
let missingProperties = null;
for (let i = laterCandidates.length - 1; i >= 0; i -= 1) {
  const missing = coversEarlierDeclarations(earlier, laterCandidates[i]);
  if (!missing.length) {
    later = laterCandidates[i];
    missingProperties = missing;
    break;
  }
}

if (!later) {
  throw new Error('No later target rule fully replaces all earlier declarations with compatible importance.');
}

const removal = expandRemovalToLine(original, earlier.start, earlier.end);
const removedText = original.slice(removal.start, removal.end);
const updated = original.slice(0, removal.start) + original.slice(removal.end);
const updatedTargetRules = findTargetRules(updated);

const checks = {
  styleOpenPreserved: countMatches(original, /<style\b/gi) === countMatches(updated, /<style\b/gi),
  styleClosePreserved: countMatches(original, /<\/style>/gi) === countMatches(updated, /<\/style>/gi),
  scriptOpenPreserved: countMatches(original, /<script\b/gi) === countMatches(updated, /<script\b/gi),
  scriptClosePreserved: countMatches(original, /<\/script>/gi) === countMatches(updated, /<\/script>/gi),
  templateCountPreserved: countMatches(original, /<\?[!=]?/g) === countMatches(updated, /<\?[!=]?/g),
  htmlCloseCountPreserved: countMatches(original, /<\/html>/gi) === countMatches(updated, /<\/html>/gi),
  oneTargetRuleRemoved: updatedTargetRules.length === targetRules.length - 1,
  laterRuleStillPresent: updatedTargetRules.some(function(rule) {
    return rule.declarations.size === later.declarations.size && rule.selectors.indexOf(targetSelector) >= 0;
  }),
  fileChanged: beforeHash !== sha256(updated)
};

if (Object.keys(checks).some(function(key) { return !checks[key]; })) {
  console.error(JSON.stringify(checks, null, 2));
  throw new Error('First override removal validation failed. Index.html was not written.');
}

const earlierDeclarations = Array.from(earlier.declarations.entries()).map(function(entry) {
  return `- \`${entry[0]}: ${entry[1].value}${entry[1].important ? ' !important' : ''}\``;
}).join('\n');

const report = [
  '# First Superseded Override Removal Report',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Removed rule',
  '',
  `- Selector: \`${targetSelector}\``,
  `- Original line: ${earlier.line}`,
  `- Original style block: ${earlier.styleBlock}`,
  `- Removed text SHA-256: \`${sha256(removedText)}\``,
  `- Removed text lines: ${removedText.split(/\r?\n/).length}`,
  '',
  '## Later replacement retained',
  '',
  `- Replacement line before removal: ${later.line}`,
  `- Replacement style block: ${later.styleBlock}`,
  `- Replacement selector list: ${later.selectors.map(function(selector) { return `\`${selector}\``; }).join(', ')}`,
  `- All ${earlier.declarations.size} earlier properties are redeclared later with compatible importance: true`,
  '',
  '## Earlier declarations removed',
  '',
  earlierDeclarations,
  '',
  '## Structural verification',
  '',
  Object.keys(checks).map(function(key) { return `- ${key}: ${checks[key]}`; }).join('\n'),
  '',
  '## File hashes',
  '',
  `- Before: \`${beforeHash}\``,
  `- After: \`${sha256(updated)}\``,
  '',
  '## Required validation',
  '',
  'Run the local preview and compare the Remake Factor and TAT top dropdowns, open/close behavior, widths, labels, icons, filters, charts, tables, animations, and responsive layout before any clasp push.',
  ''
].join('\n');

fs.writeFileSync(indexPath, updated, 'utf8');
fs.writeFileSync(reportPath, report, 'utf8');
console.log(JSON.stringify({
  selector: targetSelector,
  removedLine: earlier.line,
  replacementLine: later.line,
  checks,
  reportPath
}, null, 2));
