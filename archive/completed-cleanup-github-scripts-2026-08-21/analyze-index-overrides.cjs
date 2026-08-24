'use strict';

const crypto = require('crypto');
const fs = require('fs');

const indexPath = 'Index.html';
const reportPath = 'INDEX_OVERRIDE_ANALYSIS.md';

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripComments(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, ' ');
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

function hasTopLevelBrace(body) {
  let quote = '';
  let comment = false;
  for (let i = 0; i < body.length; i += 1) {
    const char = body.charAt(i);
    const next = body.charAt(i + 1);
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
      if (char === quote && body.charAt(i - 1) !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') return true;
  }
  return false;
}

function parseRules(text, absoluteOffset, styleBlockNumber, context, output) {
  let cursor = 0;
  while (cursor < text.length) {
    while (cursor < text.length && /\s/.test(text.charAt(cursor))) cursor += 1;
    if (text.slice(cursor, cursor + 2) === '/*') {
      const commentEnd = text.indexOf('*/', cursor + 2);
      cursor = commentEnd >= 0 ? commentEnd + 2 : text.length;
      continue;
    }

    const openIndex = text.indexOf('{', cursor);
    if (openIndex < 0) break;
    const prelude = normalizeSpace(stripComments(text.slice(cursor, openIndex)));
    const closeIndex = findMatchingBrace(text, openIndex);
    if (closeIndex < 0) break;
    const body = text.slice(openIndex + 1, closeIndex);
    const ruleAbsoluteIndex = absoluteOffset + cursor;

    if (prelude && (prelude.charAt(0) === '@' || hasTopLevelBrace(body))) {
      const nestedContext = prelude.charAt(0) === '@' ? context.concat([prelude]) : context;
      if (hasTopLevelBrace(body)) {
        parseRules(body, absoluteOffset + openIndex + 1, styleBlockNumber, nestedContext, output);
      }
    } else if (prelude) {
      const declarations = parseDeclarations(body);
      if (declarations.size) {
        splitSelectors(prelude).forEach(function(selector) {
          output.push({
            selector,
            context: context.join(' > '),
            styleBlockNumber,
            line: lineNumberAt(source, ruleAbsoluteIndex),
            declarations
          });
        });
      }
    }

    cursor = closeIndex + 1;
  }
}

function isDeclarationSuperseded(earlier, later) {
  if (!later) return false;
  if (earlier.important && !later.important) return false;
  return true;
}

const source = fs.readFileSync(indexPath, 'utf8');
const stylePattern = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi;
const rules = [];
const styleBlocks = [];
let styleMatch;
let styleBlockNumber = 0;

while ((styleMatch = stylePattern.exec(source)) !== null) {
  styleBlockNumber += 1;
  const contentStart = styleMatch.index + styleMatch[0].indexOf(styleMatch[1]);
  styleBlocks.push({
    number: styleBlockNumber,
    line: lineNumberAt(source, styleMatch.index),
    length: styleMatch[0].split(/\r?\n/).length
  });
  parseRules(styleMatch[1], contentStart, styleBlockNumber, [], rules);
}

const bySelector = new Map();
rules.forEach(function(rule) {
  const key = `${rule.context}||${rule.selector}`;
  if (!bySelector.has(key)) bySelector.set(key, []);
  bySelector.get(key).push(rule);
});

const repeated = [];
const candidates = [];

bySelector.forEach(function(occurrences) {
  if (occurrences.length < 2) return;
  occurrences.sort(function(a, b) { return a.line - b.line; });
  repeated.push({
    selector: occurrences[0].selector,
    context: occurrences[0].context,
    occurrences
  });

  for (let i = 0; i < occurrences.length - 1; i += 1) {
    const earlier = occurrences[i];
    const laterOccurrences = occurrences.slice(i + 1);
    const properties = Array.from(earlier.declarations.keys());
    const replacements = [];
    let fullySuperseded = properties.length > 0;

    properties.forEach(function(property) {
      const earlierDeclaration = earlier.declarations.get(property);
      let replacement = null;
      for (let j = laterOccurrences.length - 1; j >= 0; j -= 1) {
        const laterDeclaration = laterOccurrences[j].declarations.get(property);
        if (isDeclarationSuperseded(earlierDeclaration, laterDeclaration)) {
          replacement = {
            line: laterOccurrences[j].line,
            styleBlockNumber: laterOccurrences[j].styleBlockNumber,
            value: laterDeclaration.value,
            important: laterDeclaration.important
          };
          break;
        }
      }
      if (!replacement) fullySuperseded = false;
      replacements.push({ property, earlier: earlierDeclaration, replacement });
    });

    if (fullySuperseded) {
      candidates.push({
        selector: earlier.selector,
        context: earlier.context,
        earlierLine: earlier.line,
        earlierStyleBlock: earlier.styleBlockNumber,
        declarationCount: properties.length,
        replacements
      });
    }
  }
});

repeated.sort(function(a, b) {
  return b.occurrences.length - a.occurrences.length || a.occurrences[0].line - b.occurrences[0].line;
});
candidates.sort(function(a, b) {
  return b.declarationCount - a.declarationCount || a.earlierLine - b.earlierLine;
});

function formatContext(context) {
  return context ? ` — context: \`${context}\`` : '';
}

const candidateLines = candidates.length
  ? candidates.slice(0, 100).map(function(candidate, index) {
      const replacementLines = Array.from(new Set(candidate.replacements.map(function(item) {
        return item.replacement ? item.replacement.line : null;
      }).filter(Boolean))).join(', ');
      const properties = candidate.replacements.map(function(item) {
        const important = item.earlier.important ? ' !important' : '';
        return `\`${item.property}: ${item.earlier.value}${important}\``;
      }).join(', ');
      return [
        `${index + 1}. \`${candidate.selector}\`${formatContext(candidate.context)}`,
        `   - Earlier rule: line ${candidate.earlierLine}, style block ${candidate.earlierStyleBlock}`,
        `   - Exact properties replaced later at line(s): ${replacementLines}`,
        `   - Earlier declarations: ${properties}`
      ].join('\n');
    }).join('\n')
  : 'No fully superseded same-selector rules were detected by the strict property-name check.';

const repeatedLines = repeated.length
  ? repeated.slice(0, 100).map(function(group, index) {
      return `${index + 1}. \`${group.selector}\`${formatContext(group.context)} — ${group.occurrences.length} occurrences at lines ${group.occurrences.map(function(item) { return item.line; }).join(', ')}`;
    }).join('\n')
  : 'No repeated selectors were detected.';

const report = [
  '# Index.html CSS Override Analysis',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Scope',
  '',
  '- Analysis only; `Index.html` was not modified.',
  '- Parsed embedded `<style>` blocks and mapped repeated selectors within the same at-rule context.',
  '- A strict candidate is reported only when every exact property name in an earlier rule is declared again later for the same selector and context.',
  '- Shorthand/longhand interactions, JavaScript-injected CSS, dynamic stylesheet removal, and browser-specific cascade behavior still require human review before deletion.',
  '',
  '## File summary',
  '',
  `- Index SHA-256: \`${sha256(source)}\``,
  `- Lines: ${source.split(/\r?\n/).length}`,
  `- Style blocks: ${styleBlocks.length}`,
  `- Parsed selector rules: ${rules.length}`,
  `- Repeated selector groups: ${repeated.length}`,
  `- Strict fully-superseded candidates: ${candidates.length}`,
  '',
  '## Strict candidates for human review',
  '',
  candidateLines,
  '',
  '## Most repeated selectors',
  '',
  repeatedLines,
  '',
  '## Next gate',
  '',
  'Review one candidate against its exact earlier and later source blocks. Remove only one rule after confirming selector, context, importance, and runtime behavior are equivalent.',
  ''
].join('\n');

fs.writeFileSync(reportPath, report, 'utf8');
console.log(JSON.stringify({
  styleBlocks: styleBlocks.length,
  parsedRules: rules.length,
  repeatedGroups: repeated.length,
  candidates: candidates.length,
  reportPath
}, null, 2));
