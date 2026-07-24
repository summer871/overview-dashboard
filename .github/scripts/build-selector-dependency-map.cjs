'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INDEX_FILE = 'Index.html';
const OUTPUT_DIR = path.join('reports', 'selector-dependency-map');
const OUTPUT_FILES = {
  markdown: path.join(OUTPUT_DIR, 'SELECTOR_DEPENDENCY_MAP.md'),
  groupsCsv: path.join(OUTPUT_DIR, 'SELECTOR_DEPENDENCY_MAP.csv'),
  occurrencesCsv: path.join(OUTPUT_DIR, 'SELECTOR_OCCURRENCES.csv'),
  json: path.join(OUTPUT_DIR, 'SELECTOR_DEPENDENCY_MAP.json'),
  manifest: path.join(OUTPUT_DIR, 'manifest.json')
};

function fail(message) {
  throw new Error(message);
}

function readUtf8(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) fail(`Required file is missing: ${relativePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function sha256File(relativePath) {
  return sha256Text(readUtf8(relativePath));
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function lineNumberAt(source, index) {
  if (index <= 0) return 1;
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function stripCssComments(value) {
  return String(value || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function splitTopLevel(value, delimiter) {
  const parts = [];
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
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);

    if (char === delimiter && bracketDepth === 0 && parenDepth === 0) {
      const normalized = normalizeSpace(current);
      if (normalized) parts.push(normalized);
      current = '';
      continue;
    }
    current += char;
  }

  const normalized = normalizeSpace(current);
  if (normalized) parts.push(normalized);
  return parts;
}

function splitSelectors(value) {
  return splitTopLevel(value, ',');
}

function findMatching(text, openIndex, openChar, closeChar) {
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
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function hasTopLevelBrace(body) {
  let quote = '';
  let comment = false;
  let parenDepth = 0;
  let bracketDepth = 0;

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
    if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === '{' && parenDepth === 0 && bracketDepth === 0) return true;
  }
  return false;
}

function parseDeclarations(body) {
  const declarations = [];
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
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
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
    declarations.push({ property, value, important });
  });

  return declarations;
}

function addSpecificity(left, right) {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function compareSpecificity(left, right) {
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

function maxSpecificity(selectors) {
  let max = [0, 0, 0];
  selectors.forEach(function(selector) {
    const current = calculateSpecificity(selector);
    if (compareSpecificity(current, max) > 0) max = current;
  });
  return max;
}

function calculateSpecificity(selector) {
  const source = stripCssComments(selector);
  let counts = [0, 0, 0];
  let residual = '';

  for (let i = 0; i < source.length;) {
    const char = source.charAt(i);
    if (char === '#') {
      counts[0] += 1;
      i += 1;
      while (i < source.length && /[\w-]/.test(source.charAt(i))) i += 1;
      residual += ' ';
      continue;
    }
    if (char === '.') {
      counts[1] += 1;
      i += 1;
      while (i < source.length && /[\w-]/.test(source.charAt(i))) i += 1;
      residual += ' ';
      continue;
    }
    if (char === '[') {
      const end = findMatching(source, i, '[', ']');
      counts[1] += 1;
      i = end >= 0 ? end + 1 : source.length;
      residual += ' ';
      continue;
    }
    if (char === ':') {
      const pseudoElement = source.charAt(i + 1) === ':';
      i += pseudoElement ? 2 : 1;
      const start = i;
      while (i < source.length && /[\w-]/.test(source.charAt(i))) i += 1;
      const name = source.slice(start, i).toLowerCase();
      if (pseudoElement) {
        counts[2] += 1;
        residual += ' ';
        continue;
      }
      if (source.charAt(i) === '(') {
        const end = findMatching(source, i, '(', ')');
        const inner = end >= 0 ? source.slice(i + 1, end) : source.slice(i + 1);
        if (name === 'where') {
          // :where() always contributes zero specificity.
        } else if (name === 'is' || name === 'not' || name === 'has') {
          counts = addSpecificity(counts, maxSpecificity(splitSelectors(inner)));
        } else if (name === 'nth-child' || name === 'nth-last-child') {
          counts[1] += 1;
          const ofMatch = inner.match(/(?:^|\s)of\s+([\s\S]+)$/i);
          if (ofMatch) counts = addSpecificity(counts, maxSpecificity(splitSelectors(ofMatch[1])));
        } else {
          counts[1] += 1;
        }
        i = end >= 0 ? end + 1 : source.length;
      } else {
        counts[1] += 1;
      }
      residual += ' ';
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      i += 1;
      while (i < source.length) {
        if (source.charAt(i) === quote && source.charAt(i - 1) !== '\\') {
          i += 1;
          break;
        }
        i += 1;
      }
      residual += ' ';
      continue;
    }
    residual += char;
    i += 1;
  }

  const typePattern = /(^|[\s>+~,(|])([a-zA-Z][\w-]*|\*)/g;
  let match;
  while ((match = typePattern.exec(residual)) !== null) {
    if (match[2] !== '*') counts[2] += 1;
  }
  return counts;
}

function formatSpecificity(value) {
  return value.join('-');
}

function extractSelectorTokens(selector) {
  const ids = [];
  const classes = [];
  let match;
  const idPattern = /#([A-Za-z_][\w-]*)/g;
  const classPattern = /\.([A-Za-z_][\w-]*)/g;
  while ((match = idPattern.exec(selector)) !== null) ids.push(match[1]);
  while ((match = classPattern.exec(selector)) !== null) classes.push(match[1]);
  return Array.from(new Set(ids.concat(classes)));
}

function classifyOccurrenceOwnership(selector, file, line) {
  const text = `${selector} ${file}`.toLowerCase();
  let hasTat = /#tat|\.tat|data-tab\s*=\s*["']tat/.test(text);
  let hasRemake = /#remake|\.remake|data-tab\s*=\s*["']remakefactor/.test(text);
  let hasOverview = /#overview|\.overview|data-tab\s*=\s*["']overview|manageroverview/.test(text);

  if (/^tat/i.test(file)) hasTat = true;
  if (/^remake/i.test(file)) hasRemake = true;
  if (/^shared/i.test(file) || /^unified/i.test(file)) return 'Shared';

  if (file === 'DashboardBaseStyles.html' && !hasTat && !hasRemake && !hasOverview) {
    if (line >= 3314 && line <= 8367) hasOverview = true;
    else if (line >= 8368) hasRemake = true;
    else return 'Shared';
  }

  const flags = [hasOverview, hasTat, hasRemake].filter(Boolean).length;
  if (flags > 1) return 'Shared';
  if (hasOverview) return 'Overview';
  if (hasTat) return 'TAT';
  if (hasRemake) return 'Remake';
  return 'Shared';
}

function combineOwnership(occurrences) {
  const values = Array.from(new Set(occurrences.map(function(item) { return item.ownership; })));
  if (values.length === 1) return values[0];
  return 'Shared';
}

function listRootSourceFiles() {
  return fs.readdirSync(ROOT)
    .filter(function(name) {
      const absolute = path.join(ROOT, name);
      return fs.statSync(absolute).isFile() && /\.(?:html|js)$/i.test(name);
    })
    .sort();
}

function removeStyleBlocks(source) {
  return source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
}

function countSubstring(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = haystack.indexOf(needle, cursor)) >= 0) {
    count += 1;
    cursor += needle.length;
  }
  return count;
}

function buildRuntimeCorpus(files) {
  return files.map(function(file) {
    return removeStyleBlocks(readUtf8(file));
  }).join('\n');
}

function runtimeReferenceCount(tokens, corpus) {
  return tokens.reduce(function(total, token) {
    return total + countSubstring(corpus, token);
  }, 0);
}

function extractStyleId(attributes) {
  const match = String(attributes || '').match(/\bid\s*=\s*(["'])(.*?)\1/i);
  return match ? match[2] : '';
}

function expandTemplate(relativePath, state, stack, rootAfterClose) {
  if (stack.includes(relativePath)) {
    fail(`Recursive include detected: ${stack.concat([relativePath]).join(' -> ')}`);
  }

  const source = readUtf8(relativePath);
  const includePattern = /<\?!=\s*includeDashboardFile\(\s*['"]([^'"]+)['"]\s*\)\s*\?>/g;
  let cursor = 0;
  let match;

  while ((match = includePattern.exec(source)) !== null) {
    if (match.index > cursor) {
      state.chunks.push({
        file: relativePath,
        text: source.slice(cursor, match.index),
        startLine: lineNumberAt(source, cursor),
        afterDocumentClose: rootAfterClose
      });
    }

    const includeName = match[1];
    const includeFile = `${includeName}.html`;
    const includeLine = lineNumberAt(source, match.index);
    const isAfterClose = relativePath === INDEX_FILE
      ? includeLine > state.indexClosingHtmlLine
      : rootAfterClose;

    state.includes.push({
      order: state.includes.length + 1,
      parentFile: relativePath,
      parentLine: includeLine,
      includeName,
      includeFile,
      afterDocumentClose: isAfterClose
    });

    expandTemplate(includeFile, state, stack.concat([relativePath]), isAfterClose);
    cursor = includePattern.lastIndex;
  }

  if (cursor < source.length) {
    state.chunks.push({
      file: relativePath,
      text: source.slice(cursor),
      startLine: lineNumberAt(source, cursor),
      afterDocumentClose: rootAfterClose
    });
  }
}

function parseRules(styleText, baseLine, metadata, context, output, counters) {
  let cursor = 0;
  while (cursor < styleText.length) {
    while (cursor < styleText.length && /\s/.test(styleText.charAt(cursor))) cursor += 1;
    if (styleText.slice(cursor, cursor + 2) === '/*') {
      const commentEnd = styleText.indexOf('*/', cursor + 2);
      cursor = commentEnd >= 0 ? commentEnd + 2 : styleText.length;
      continue;
    }

    const openIndex = styleText.indexOf('{', cursor);
    if (openIndex < 0) break;
    const prelude = normalizeSpace(stripCssComments(styleText.slice(cursor, openIndex)));
    const closeIndex = findMatching(styleText, openIndex, '{', '}');
    if (closeIndex < 0) fail(`Unclosed CSS block in ${metadata.file}:${baseLine + lineNumberAt(styleText, cursor) - 1}`);
    const body = styleText.slice(openIndex + 1, closeIndex);
    const line = baseLine + lineNumberAt(styleText, cursor) - 1;

    if (prelude.charAt(0) === '@') {
      const lower = prelude.toLowerCase();
      if (!/^@(keyframes|-webkit-keyframes|font-face|page|counter-style|property)\b/.test(lower) && hasTopLevelBrace(body)) {
        parseRules(body, baseLine + lineNumberAt(styleText, openIndex + 1) - 1, metadata, context.concat([prelude]), output, counters);
      }
    } else if (prelude && hasTopLevelBrace(body)) {
      parseRules(body, baseLine + lineNumberAt(styleText, openIndex + 1) - 1, metadata, context, output, counters);
    } else if (prelude) {
      const declarations = parseDeclarations(body);
      if (declarations.length) {
        splitSelectors(prelude).forEach(function(selector) {
          counters.rule += 1;
          const specificity = calculateSpecificity(selector);
          output.push({
            selector,
            context: context.join(' > '),
            file: metadata.file,
            line,
            styleId: metadata.styleId,
            styleBlockOrder: metadata.styleBlockOrder,
            ruleOrder: counters.rule,
            cascadeOrder: counters.rule,
            includeOrder: metadata.includeOrder,
            afterDocumentClose: metadata.afterDocumentClose,
            specificity,
            specificityText: formatSpecificity(specificity),
            ownership: classifyOccurrenceOwnership(selector, metadata.file, line),
            declarations,
            importantDeclarationCount: declarations.filter(function(item) { return item.important; }).length
          });
        });
      }
    }

    cursor = closeIndex + 1;
  }
}

function collectRules(chunks, includes) {
  const rules = [];
  const styleBlocks = [];
  const counters = { styleBlock: 0, rule: 0 };
  const includeOrderByFile = new Map();
  includes.forEach(function(item) {
    if (!includeOrderByFile.has(item.includeFile)) includeOrderByFile.set(item.includeFile, item.order);
  });

  chunks.forEach(function(chunk) {
    const stylePattern = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
    let match;
    while ((match = stylePattern.exec(chunk.text)) !== null) {
      counters.styleBlock += 1;
      const styleId = extractStyleId(match[1]);
      const styleLine = chunk.startLine + lineNumberAt(chunk.text, match.index) - 1;
      const contentOffset = match.index + match[0].indexOf(match[2]);
      const contentLine = chunk.startLine + lineNumberAt(chunk.text, contentOffset) - 1;
      const metadata = {
        file: chunk.file,
        styleId,
        styleBlockOrder: counters.styleBlock,
        includeOrder: includeOrderByFile.get(chunk.file) || 0,
        afterDocumentClose: chunk.afterDocumentClose
      };
      styleBlocks.push({
        order: counters.styleBlock,
        file: chunk.file,
        line: styleLine,
        styleId,
        includeOrder: metadata.includeOrder,
        afterDocumentClose: chunk.afterDocumentClose
      });
      parseRules(match[2], contentLine, metadata, [], rules, counters);
    }
  });

  return { rules, styleBlocks };
}

function selectorContextCounts(rules) {
  const map = new Map();
  rules.forEach(function(rule) {
    if (!map.has(rule.selector)) map.set(rule.selector, new Set());
    map.get(rule.selector).add(rule.context);
  });
  return map;
}

function movementRiskForGroup(group, selectorContexts) {
  const reasons = [];
  let score = 0;
  if (group.occurrenceCount > 1) {
    score += 2;
    reasons.push('repeated selector');
  }
  if (group.files.length > 1) {
    score += 3;
    reasons.push('cross-file cascade');
  }
  if (group.importantDeclarationCount > 0) {
    score += 2;
    reasons.push('uses !important');
  }
  if (group.ownership === 'Shared') {
    score += 3;
    reasons.push('shared or cross-dashboard ownership');
  }
  if (group.afterDocumentClose) {
    score += 3;
    reasons.push('loaded after closing HTML');
  }
  if ((selectorContexts.get(group.selector) || new Set()).size > 1) {
    score += 1;
    reasons.push('same selector appears in multiple at-rule contexts');
  }
  if (group.runtimeReferenceCount === 0 && group.tokens.length > 0) {
    reasons.push('no static runtime token reference found');
  }

  let level = 'Low';
  if (score >= 6) level = 'High';
  else if (score >= 3) level = 'Medium';
  return { level, score, reasons };
}

function groupRules(rules, runtimeCorpus) {
  const groups = new Map();
  rules.forEach(function(rule) {
    const key = `${rule.context}||${rule.selector}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  });

  const selectorContexts = selectorContextCounts(rules);
  const output = [];
  groups.forEach(function(occurrences) {
    occurrences.sort(function(left, right) { return left.cascadeOrder - right.cascadeOrder; });
    const first = occurrences[0];
    const files = Array.from(new Set(occurrences.map(function(item) { return item.file; })));
    const tokens = extractSelectorTokens(first.selector);
    const staticReferences = runtimeReferenceCount(tokens, runtimeCorpus);
    const group = {
      selector: first.selector,
      context: first.context,
      specificity: first.specificityText,
      ownership: combineOwnership(occurrences),
      occurrenceCount: occurrences.length,
      firstDefinition: `${first.file}:${first.line}`,
      firstFile: first.file,
      firstLine: first.line,
      laterOverrides: occurrences.slice(1).map(function(item) { return `${item.file}:${item.line}`; }),
      files,
      styleBlockOrders: Array.from(new Set(occurrences.map(function(item) { return item.styleBlockOrder; }))),
      importantDeclarationCount: occurrences.reduce(function(total, item) { return total + item.importantDeclarationCount; }, 0),
      afterDocumentClose: occurrences.some(function(item) { return item.afterDocumentClose; }),
      tokens,
      runtimeReferenceCount: staticReferences,
      likelyObsoleteReview: tokens.length > 0 && staticReferences === 0,
      occurrences
    };
    const movement = movementRiskForGroup(group, selectorContexts);
    group.movementRisk = movement.level;
    group.movementRiskScore = movement.score;
    group.movementRiskReasons = movement.reasons;
    output.push(group);
  });

  output.sort(function(left, right) {
    return right.movementRiskScore - left.movementRiskScore
      || right.occurrenceCount - left.occurrenceCount
      || left.selector.localeCompare(right.selector)
      || left.context.localeCompare(right.context);
  });
  return output;
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value == null ? '' : value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  return [headers.map(csvCell).join(',')].concat(rows.map(function(row) {
    return headers.map(function(header) { return csvCell(row[header]); }).join(',');
  })).join('\n') + '\n';
}

function declarationSummary(declarations) {
  return declarations.map(function(item) {
    return `${item.property}: ${item.value}${item.important ? ' !important' : ''}`;
  }).join('; ');
}

function ownershipCounts(groups) {
  return groups.reduce(function(result, group) {
    result[group.ownership] = (result[group.ownership] || 0) + 1;
    return result;
  }, {});
}

function markdownEscape(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function buildMarkdown(data) {
  const highRisk = data.groups.filter(function(group) { return group.movementRisk === 'High'; }).slice(0, 100);
  const obsolete = data.groups.filter(function(group) { return group.likelyObsoleteReview; }).slice(0, 100);
  const crossFile = data.groups.filter(function(group) { return group.files.length > 1; }).slice(0, 100);
  const counts = ownershipCounts(data.groups);

  const lines = [
    '# CSS Selector Dependency Map',
    '',
    `Generated: ${data.generatedAt}`,
    '',
    '## Scope and safety',
    '',
    '- Analysis only. No dashboard source file is modified by the analyzer.',
    '- The cascade is reconstructed from `Index.html` and each `includeDashboardFile(...)` call in its actual template position.',
    '- The complete selector inventory is in `SELECTOR_DEPENDENCY_MAP.csv` and `SELECTOR_DEPENDENCY_MAP.json`.',
    '- "Likely obsolete" means no static ID/class token reference was found; dynamic runtime construction can produce false positives.',
    '- Movement risk is a review aid, not authorization to move or delete a selector.',
    '',
    '## Summary',
    '',
    `- Root source files hashed: ${data.sourceFiles.length}`,
    `- Template includes: ${data.includes.length}`,
    `- Style blocks: ${data.styleBlocks.length}`,
    `- Parsed selector occurrences: ${data.rules.length}`,
    `- Unique selector/context groups: ${data.groups.length}`,
    `- High movement-risk groups: ${data.groups.filter(function(group) { return group.movementRisk === 'High'; }).length}`,
    `- Cross-file groups: ${data.groups.filter(function(group) { return group.files.length > 1; }).length}`,
    `- Static-unreferenced review candidates: ${data.groups.filter(function(group) { return group.likelyObsoleteReview; }).length}`,
    '',
    '### Ownership counts',
    '',
    '| Ownership | Selector/context groups |',
    '|---|---:|',
    `| Overview | ${counts.Overview || 0} |`,
    `| TAT | ${counts.TAT || 0} |`,
    `| Remake | ${counts.Remake || 0} |`,
    `| Shared | ${counts.Shared || 0} |`,
    '',
    '## Template include order',
    '',
    '| Order | Parent location | Included file | After closing HTML |',
    '|---:|---|---|---|'
  ];

  data.includes.forEach(function(item) {
    lines.push(`| ${item.order} | ${markdownEscape(`${item.parentFile}:${item.parentLine}`)} | ${markdownEscape(item.includeFile)} | ${item.afterDocumentClose ? 'Yes' : 'No'} |`);
  });

  lines.push('', '## Stylesheet cascade order', '', '| Style order | Source location | Style ID | Include order | After closing HTML |', '|---:|---|---|---:|---|');
  data.styleBlocks.forEach(function(item) {
    lines.push(`| ${item.order} | ${markdownEscape(`${item.file}:${item.line}`)} | ${markdownEscape(item.styleId || '(none)')} | ${item.includeOrder || 0} | ${item.afterDocumentClose ? 'Yes' : 'No'} |`);
  });

  lines.push('', '## Highest movement-risk selectors', '', '| Selector | Context | Ownership | First definition | Occurrences | Files | Specificity | Reasons |', '|---|---|---|---|---:|---:|---|---|');
  highRisk.forEach(function(group) {
    lines.push(`| \`${markdownEscape(group.selector)}\` | ${markdownEscape(group.context || '(default)')} | ${group.ownership} | ${group.firstDefinition} | ${group.occurrenceCount} | ${group.files.length} | ${group.specificity} | ${markdownEscape(group.movementRiskReasons.join('; '))} |`);
  });

  lines.push('', '## Cross-file selector groups', '', '| Selector | Context | Ownership | Files | First definition | Later overrides |', '|---|---|---|---|---|---|');
  crossFile.forEach(function(group) {
    lines.push(`| \`${markdownEscape(group.selector)}\` | ${markdownEscape(group.context || '(default)')} | ${group.ownership} | ${markdownEscape(group.files.join('; '))} | ${group.firstDefinition} | ${markdownEscape(group.laterOverrides.join('; '))} |`);
  });

  lines.push('', '## Static-unreferenced review candidates', '', '| Selector | Context | Ownership | First definition | Occurrences | Risk |', '|---|---|---|---|---:|---|');
  obsolete.forEach(function(group) {
    lines.push(`| \`${markdownEscape(group.selector)}\` | ${markdownEscape(group.context || '(default)')} | ${group.ownership} | ${group.firstDefinition} | ${group.occurrenceCount} | ${group.movementRisk} |`);
  });

  lines.push(
    '',
    '## Next gate',
    '',
    'Choose one small selector group with one clear owner, no cross-dashboard reuse, no cross-file cascade, and no late-document dependency. Validate its exact source and visual behavior before any extraction.',
    ''
  );
  return lines.join('\n');
}

function writeFile(relativePath, content) {
  const absolute = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
}

const rootSourceFiles = listRootSourceFiles();
if (!rootSourceFiles.includes(INDEX_FILE)) fail(`${INDEX_FILE} is not present in the repository root.`);

const sourceHashesBefore = Object.fromEntries(rootSourceFiles.map(function(file) {
  return [file, sha256File(file)];
}));
const runtimeCorpus = buildRuntimeCorpus(rootSourceFiles);
const indexSource = readUtf8(INDEX_FILE);
const closingHtmlIndex = indexSource.toLowerCase().lastIndexOf('</html>');
const expansionState = {
  chunks: [],
  includes: [],
  indexClosingHtmlLine: closingHtmlIndex >= 0 ? lineNumberAt(indexSource, closingHtmlIndex) : Number.MAX_SAFE_INTEGER
};
expandTemplate(INDEX_FILE, expansionState, [], false);

const parsed = collectRules(expansionState.chunks, expansionState.includes);
const groups = groupRules(parsed.rules, runtimeCorpus);
const generatedAt = new Date().toISOString();

const groupsCsvRows = groups.map(function(group) {
  return {
    selector: group.selector,
    context: group.context,
    specificity: group.specificity,
    ownership: group.ownership,
    occurrenceCount: group.occurrenceCount,
    firstDefinition: group.firstDefinition,
    laterOverrides: group.laterOverrides,
    files: group.files,
    importantDeclarationCount: group.importantDeclarationCount,
    afterDocumentClose: group.afterDocumentClose,
    runtimeReferenceCount: group.runtimeReferenceCount,
    likelyObsoleteReview: group.likelyObsoleteReview,
    movementRisk: group.movementRisk,
    movementRiskScore: group.movementRiskScore,
    movementRiskReasons: group.movementRiskReasons
  };
});

const occurrenceRows = parsed.rules.map(function(rule) {
  return {
    cascadeOrder: rule.cascadeOrder,
    selector: rule.selector,
    context: rule.context,
    file: rule.file,
    line: rule.line,
    styleId: rule.styleId,
    styleBlockOrder: rule.styleBlockOrder,
    includeOrder: rule.includeOrder,
    afterDocumentClose: rule.afterDocumentClose,
    specificity: rule.specificityText,
    ownership: rule.ownership,
    importantDeclarationCount: rule.importantDeclarationCount,
    declarations: declarationSummary(rule.declarations)
  };
});

const jsonData = {
  generatedAt,
  branch: process.env.GITHUB_REF_NAME || '',
  commit: process.env.GITHUB_SHA || '',
  sourceFiles: rootSourceFiles,
  sourceHashes: sourceHashesBefore,
  includes: expansionState.includes,
  styleBlocks: parsed.styleBlocks,
  summary: {
    selectorOccurrences: parsed.rules.length,
    selectorContextGroups: groups.length,
    highRiskGroups: groups.filter(function(group) { return group.movementRisk === 'High'; }).length,
    crossFileGroups: groups.filter(function(group) { return group.files.length > 1; }).length,
    likelyObsoleteReviewGroups: groups.filter(function(group) { return group.likelyObsoleteReview; }).length,
    ownershipCounts: ownershipCounts(groups)
  },
  groups: groups.map(function(group) {
    return {
      selector: group.selector,
      context: group.context,
      specificity: group.specificity,
      ownership: group.ownership,
      occurrenceCount: group.occurrenceCount,
      firstDefinition: group.firstDefinition,
      laterOverrides: group.laterOverrides,
      files: group.files,
      importantDeclarationCount: group.importantDeclarationCount,
      afterDocumentClose: group.afterDocumentClose,
      tokens: group.tokens,
      runtimeReferenceCount: group.runtimeReferenceCount,
      likelyObsoleteReview: group.likelyObsoleteReview,
      movementRisk: group.movementRisk,
      movementRiskScore: group.movementRiskScore,
      movementRiskReasons: group.movementRiskReasons,
      occurrences: group.occurrences.map(function(rule) {
        return {
          cascadeOrder: rule.cascadeOrder,
          file: rule.file,
          line: rule.line,
          styleId: rule.styleId,
          styleBlockOrder: rule.styleBlockOrder,
          includeOrder: rule.includeOrder,
          afterDocumentClose: rule.afterDocumentClose,
          ownership: rule.ownership,
          specificity: rule.specificityText,
          declarations: rule.declarations
        };
      })
    };
  })
};

const groupsCsv = toCsv([
  'selector',
  'context',
  'specificity',
  'ownership',
  'occurrenceCount',
  'firstDefinition',
  'laterOverrides',
  'files',
  'importantDeclarationCount',
  'afterDocumentClose',
  'runtimeReferenceCount',
  'likelyObsoleteReview',
  'movementRisk',
  'movementRiskScore',
  'movementRiskReasons'
], groupsCsvRows);

const occurrencesCsv = toCsv([
  'cascadeOrder',
  'selector',
  'context',
  'file',
  'line',
  'styleId',
  'styleBlockOrder',
  'includeOrder',
  'afterDocumentClose',
  'specificity',
  'ownership',
  'importantDeclarationCount',
  'declarations'
], occurrenceRows);

const markdown = buildMarkdown({
  generatedAt,
  sourceFiles: rootSourceFiles,
  includes: expansionState.includes,
  styleBlocks: parsed.styleBlocks,
  rules: parsed.rules,
  groups
});
const json = JSON.stringify(jsonData, null, 2) + '\n';

writeFile(OUTPUT_FILES.markdown, markdown);
writeFile(OUTPUT_FILES.groupsCsv, groupsCsv);
writeFile(OUTPUT_FILES.occurrencesCsv, occurrencesCsv);
writeFile(OUTPUT_FILES.json, json);

const sourceHashesAfter = Object.fromEntries(rootSourceFiles.map(function(file) {
  return [file, sha256File(file)];
}));
const changedSources = rootSourceFiles.filter(function(file) {
  return sourceHashesBefore[file] !== sourceHashesAfter[file];
});
if (changedSources.length) fail(`Analyzer changed dashboard source files: ${changedSources.join(', ')}`);

const outputHashes = {};
Object.entries(OUTPUT_FILES).forEach(function(entry) {
  const name = entry[0];
  const relativePath = entry[1];
  if (name !== 'manifest') outputHashes[relativePath] = sha256File(relativePath);
});

const manifest = {
  generatedAt,
  analyzer: '.github/scripts/build-selector-dependency-map.cjs',
  branch: process.env.GITHUB_REF_NAME || '',
  commit: process.env.GITHUB_SHA || '',
  sourceFiles: rootSourceFiles.map(function(file) {
    return { file, sha256: sourceHashesBefore[file] };
  }),
  outputs: Object.keys(outputHashes).map(function(file) {
    return {
      file,
      sha256: outputHashes[file],
      bytes: fs.statSync(path.join(ROOT, file)).size
    };
  }),
  sourceFilesUnchanged: true,
  summary: jsonData.summary
};
writeFile(OUTPUT_FILES.manifest, JSON.stringify(manifest, null, 2) + '\n');

console.log(JSON.stringify({
  outputDirectory: OUTPUT_DIR,
  sourceFiles: rootSourceFiles.length,
  includes: expansionState.includes.length,
  styleBlocks: parsed.styleBlocks.length,
  selectorOccurrences: parsed.rules.length,
  selectorContextGroups: groups.length,
  highRiskGroups: jsonData.summary.highRiskGroups,
  crossFileGroups: jsonData.summary.crossFileGroups,
  likelyObsoleteReviewGroups: jsonData.summary.likelyObsoleteReviewGroups,
  sourceFilesUnchanged: true
}, null, 2));
