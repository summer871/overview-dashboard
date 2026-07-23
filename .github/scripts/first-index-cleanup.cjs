'use strict';

const crypto = require('crypto');
const fs = require('fs');

const indexPath = 'Index.html';
const reportPath = 'INDEX_CLEANUP_REPORT.md';

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function normalizeStyleBlock(block) {
  return block
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function removeStaleHeaderComment(source) {
  const pattern = /^(<!DOCTYPE html>\r?\n)<!--\r?\n[\s\S]*?Executive Dashboard Frontend[\s\S]*?-->\r?\n(?=<html>)/;
  const match = source.match(pattern);
  if (!match) return { source, removed: false, removedText: '' };

  return {
    source: source.replace(pattern, '$1'),
    removed: true,
    removedText: match[0].slice(match[1].length)
  };
}

function removeEarlierDuplicateStyleBlocks(source) {
  const pattern = /^[ \t]*<style(?:\s[^>]*)?>[\s\S]*?<\/style>[ \t]*(?:\r?\n)?/gim;
  const blocks = [];
  let match;

  while ((match = pattern.exec(source)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      key: normalizeStyleBlock(match[0])
    });
  }

  const indexesByKey = new Map();
  blocks.forEach(function(block, index) {
    if (!indexesByKey.has(block.key)) indexesByKey.set(block.key, []);
    indexesByKey.get(block.key).push(index);
  });

  const duplicateGroups = [];
  const removalIndexes = [];

  indexesByKey.forEach(function(indexes, key) {
    if (indexes.length < 2) return;
    const keptIndex = indexes[indexes.length - 1];
    const removedIndexes = indexes.slice(0, -1);
    removalIndexes.push.apply(removalIndexes, removedIndexes);
    duplicateGroups.push({
      hash: sha256(key),
      occurrences: indexes.length,
      keptBlockNumber: keptIndex + 1,
      removedBlockNumbers: removedIndexes.map(function(index) { return index + 1; })
    });
  });

  let updated = source;
  removalIndexes
    .sort(function(a, b) { return blocks[b].start - blocks[a].start; })
    .forEach(function(index) {
      const block = blocks[index];
      updated = updated.slice(0, block.start) + updated.slice(block.end);
    });

  return {
    source: updated,
    originalBlockCount: blocks.length,
    removedBlockCount: removalIndexes.length,
    duplicateGroups
  };
}

function buildReport(details) {
  const groupLines = details.duplicateGroups.length
    ? details.duplicateGroups.map(function(group, index) {
        return [
          `${index + 1}. Style hash: \`${group.hash}\``,
          `   - Occurrences: ${group.occurrences}`,
          `   - Kept original style block: ${group.keptBlockNumber}`,
          `   - Removed original style blocks: ${group.removedBlockNumbers.join(', ')}`
        ].join('\n');
      }).join('\n')
    : 'No byte-equivalent duplicate style blocks were found.';

  return [
    '# Index.html First Cleanup Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- Removed the stale version-history comment immediately after the doctype.',
    '- Removed only earlier byte-equivalent duplicate `<style>` blocks.',
    '- Kept the final occurrence of every duplicate style block to preserve the final CSS cascade.',
    '- Did not edit JavaScript, Apps Script template expressions, HTML elements, data logic, or chart configuration.',
    '',
    '## Results',
    '',
    `- Stale header removed: ${details.headerRemoved}`,
    `- Original style blocks: ${details.originalStyleBlocks}`,
    `- Duplicate style blocks removed: ${details.removedStyleBlocks}`,
    `- Final style blocks: ${details.finalStyleBlocks}`,
    `- Original lines: ${details.originalLines}`,
    `- Final lines: ${details.finalLines}`,
    `- Original SHA-256: \`${details.beforeHash}\``,
    `- Final SHA-256: \`${details.afterHash}\``,
    '',
    '## Duplicate groups',
    '',
    groupLines,
    '',
    '## Structural verification',
    '',
    '- Opening `<style>` count equals closing `</style>` count: ' + details.styleTagsBalanced,
    '- Opening `<script>` count unchanged: ' + details.scriptOpenUnchanged,
    '- Closing `</script>` count unchanged: ' + details.scriptCloseUnchanged,
    '- Apps Script template-expression count unchanged: ' + details.templateCountUnchanged,
    '- Doctype preserved: ' + details.doctypePreserved,
    '- Root HTML closing tag count preserved: ' + details.htmlClosePreserved,
    '',
    '## Required validation',
    '',
    'Run the local preview and compare layout, charts, animations, hover behavior, filters, tables, menus, exports, tabs, and responsive behavior before any clasp push.',
    ''
  ].join('\n');
}

const original = fs.readFileSync(indexPath, 'utf8');
const beforeHash = sha256(original);
const originalLines = original.split(/\r?\n/).length;
const originalScriptOpen = countMatches(original, /<script\b/gi);
const originalScriptClose = countMatches(original, /<\/script>/gi);
const originalTemplateCount = countMatches(original, /<\?[!=]?/g);
const originalHtmlClose = countMatches(original, /<\/html>/gi);

const headerResult = removeStaleHeaderComment(original);
const styleResult = removeEarlierDuplicateStyleBlocks(headerResult.source);
const updated = styleResult.source;

const finalStyleOpen = countMatches(updated, /<style\b/gi);
const finalStyleClose = countMatches(updated, /<\/style>/gi);
const finalScriptOpen = countMatches(updated, /<script\b/gi);
const finalScriptClose = countMatches(updated, /<\/script>/gi);
const finalTemplateCount = countMatches(updated, /<\?[!=]?/g);
const finalHtmlClose = countMatches(updated, /<\/html>/gi);

const details = {
  headerRemoved: headerResult.removed,
  originalStyleBlocks: styleResult.originalBlockCount,
  removedStyleBlocks: styleResult.removedBlockCount,
  finalStyleBlocks: finalStyleOpen,
  originalLines,
  finalLines: updated.split(/\r?\n/).length,
  beforeHash,
  afterHash: sha256(updated),
  duplicateGroups: styleResult.duplicateGroups,
  styleTagsBalanced: finalStyleOpen === finalStyleClose,
  scriptOpenUnchanged: originalScriptOpen === finalScriptOpen,
  scriptCloseUnchanged: originalScriptClose === finalScriptClose,
  templateCountUnchanged: originalTemplateCount === finalTemplateCount,
  doctypePreserved: /^<!DOCTYPE html>/i.test(updated),
  htmlClosePreserved: originalHtmlClose > 0 && originalHtmlClose === finalHtmlClose
};

const allChecksPass =
  details.headerRemoved &&
  details.styleTagsBalanced &&
  details.scriptOpenUnchanged &&
  details.scriptCloseUnchanged &&
  details.templateCountUnchanged &&
  details.doctypePreserved &&
  details.htmlClosePreserved &&
  details.beforeHash !== details.afterHash;

if (!allChecksPass) {
  console.error(JSON.stringify(details, null, 2));
  throw new Error('Index cleanup validation failed. Index.html was not written.');
}

fs.writeFileSync(indexPath, updated, 'utf8');
fs.writeFileSync(reportPath, buildReport(details), 'utf8');
console.log(JSON.stringify(details, null, 2));
