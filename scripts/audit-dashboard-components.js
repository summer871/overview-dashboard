#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outDir = path.join(root, 'reports');
const sourceExtensions = new Set(['.html', '.htm', '.js', '.gs', '.css']);
const excluded = new Set(['.git', '.github', '.clasp', 'node_modules', 'dist', 'build', 'coverage', 'reports', 'archive', 'tests']);
const selfPath = 'scripts/audit-dashboard-components.js';

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name)) walk(path.join(directory, entry.name), files);
      continue;
    }
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).replace(/\\/g, '/');
    if (relative !== selfPath && sourceExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
  }
  return files;
}

function lineAt(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function clean(value, limit = 220) {
  const result = String(value || '').replace(/\s+/g, ' ').trim();
  return result.length > limit ? `${result.slice(0, limit - 1)}…` : result;
}

function attr(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match ? match[2] : '';
}

function balancedObject(text, start) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return text.slice(start, index + 1);
  }
  return text.slice(start);
}

function prop(block, names) {
  for (const name of names) {
    const match = new RegExp(`\\b${name}\\s*:\\s*(["'\\x60])([^"'\\x60]+)\\1`).exec(block);
    if (match) return match[2];
  }
  return '';
}

function features(block, names) {
  return names.filter((name) => block.includes(name));
}

function htmlTags(text, file, tagName) {
  const items = [];
  const regex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match;
  while ((match = regex.exec(text))) {
    const tag = match[0];
    const item = {
      file,
      line: lineAt(text, match.index),
      id: attr(tag, 'id'),
      className: attr(tag, 'class'),
      title: attr(tag, 'title') || attr(tag, 'aria-label'),
      tag: clean(tag)
    };
    if (tagName === 'table') {
      const close = text.toLowerCase().indexOf('</table>', regex.lastIndex);
      const block = text.slice(match.index, close < 0 ? match.index + 5000 : close + 8);
      item.descendantIds = Array.from(block.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi), (idMatch) => idMatch[2]);
      item.dataManaged = attr(tag, 'data-cda-managed');
    }
    if (tagName === 'button') {
      const close = text.toLowerCase().indexOf('</button>', regex.lastIndex);
      item.label = close < 0 ? '' : clean(text.slice(regex.lastIndex, close).replace(/<[^>]+>/g, ' '), 100);
    }
    items.push(item);
  }
  return items;
}

function tableRegistrations(text, file) {
  const items = [];
  const regex = /\b(?:window\.)?(?:cdaTable|CdaSharedTableModule)\s*\.\s*register\s*\(/g;
  let match;
  while ((match = regex.exec(text))) {
    const brace = text.indexOf('{', regex.lastIndex);
    if (brace < 0) continue;
    const block = balancedObject(text, brace);
    items.push({
      file,
      line: lineAt(text, match.index),
      key: prop(block, ['key']),
      tableId: prop(block, ['tableId', 'table']),
      bodyId: prop(block, ['bodyId', 'tbodyId']),
      features: features(block, [
        'defaultSort', 'sortable', 'hideable', 'exportCsv', 'csvFileName',
        'childRows', 'onRowClick', 'multiSelect', 'manageSelection',
        'totalsRow', 'beforeRender', 'afterRender'
      ])
    });
    regex.lastIndex = brace + block.length;
  }
  return items;
}

function chartConstructors(text, file) {
  const items = [];
  const regex = /\bnew\s+(?:window\.)?Chart\s*\(/g;
  let match;
  while ((match = regex.exec(text))) {
    const brace = text.indexOf('{', regex.lastIndex);
    const block = brace < 0 ? '' : balancedObject(text, brace);
    const before = text.slice(Math.max(0, match.index - 180), match.index);
    const args = brace < 0 ? '' : text.slice(match.index, brace);
    const variableMatch = /([A-Za-z_$][\w$]*)\s*=\s*$/.exec(before);
    const canvasMatch = /getElementById\s*\(\s*(["'])(.*?)\1/.exec(args);
    items.push({
      file,
      line: lineAt(text, match.index),
      variable: variableMatch ? variableMatch[1] : '',
      canvasId: canvasMatch ? canvasMatch[2] : '',
      type: prop(block, ['type']) || 'dynamic',
      features: features(before + block, [
        'onClick', 'tooltip', 'legend', 'plugins', 'annotation', 'targetLine',
        'threshold', 'datalabel', 'responsive', 'maintainAspectRatio',
        'stacked', 'chartMode', 'ModeBar', 'modeButton'
      ])
    });
    if (block) regex.lastIndex = brace + block.length;
  }
  return items;
}

function interactionPatterns(text, file) {
  const definitions = [
    ['click listeners', /\.addEventListener\s*\(\s*['"]click['"]/g],
    ['inline onclick', /\bonclick\s*=/gi],
    ['table row click', /\bonRowClick\s*:/g],
    ['chart click', /\bonClick\s*:/g],
    ['filter or selection', /\b(?:apply|set|toggle|clear)[A-Za-z0-9_$]*(?:Filter|Selection)\b/g],
    ['CSV export', /\b(?:exportCsv|downloadCsv|csvFileName)\b/g],
    ['column chooser', /\b(?:toggleColumn|columnChooser|ColumnChooser|hiddenColumns)\b/g],
    ['chart mode controls', /\b(?:chartMode|ModeBar|modeButton|setMode)\b/g]
  ];
  return definitions.map(([name, regex]) => ({ file, name, count: (text.match(regex) || []).length })).filter((item) => item.count);
}

function styleOverrides(text, file) {
  const blocks = [];
  for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) blocks.push([match[1], match.index]);
  if (path.extname(file).toLowerCase() === '.css') blocks.push([text, 0]);
  const items = [];
  for (const [css, offset] of blocks) {
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = clean(match[1]);
      const declarations = match[2];
      const lower = `${selector} ${declarations}`.toLowerCase();
      const table = /(?:table|thead|tbody|\bth\b|\btd\b|columnchooser|tablebutton)/.test(lower);
      const chart = /(?:chart|canvas|legend|tooltip)/.test(lower);
      if (!table && !chart) continue;
      items.push({
        file,
        line: lineAt(text, offset + match.index),
        scope: table && chart ? 'table+chart' : table ? 'table' : 'chart',
        important: (declarations.match(/!important/g) || []).length,
        selector
      });
    }
  }
  return items;
}

function markdown(report) {
  const lines = ['# Dashboard component inventory', '', `Generated: ${report.generatedAt}`, '', '## Summary', '', '| Measure | Count |', '|---|---:|'];
  for (const [key, value] of Object.entries(report.summary)) lines.push(`| ${key} | ${value} |`);
  function section(title, headers, rows) {
    lines.push('', `## ${title}`, '', `| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`);
    for (const row of rows) lines.push(`| ${row.map((value) => String(value || '—').replace(/\|/g, '\\|')).join(' | ')} |`);
  }
  section('Tables', ['File', 'Line', 'ID', 'Classes', 'Shared'], report.tables.map((item) => [item.file, item.line, item.id, item.className, item.shared ? 'Yes' : 'No']));
  section('Table registrations', ['File', 'Line', 'Key', 'Table/body ID', 'Features'], report.tableRegistrations.map((item) => [item.file, item.line, item.key, item.tableId || item.bodyId, item.features.join(', ')]));
  section('Charts', ['File', 'Line', 'Variable', 'Canvas', 'Type', 'Features'], report.charts.map((item) => [item.file, item.line, item.variable, item.canvasId, item.type, item.features.join(', ')]));
  section('Buttons', ['File', 'Line', 'ID', 'Classes', 'Label/title'], report.buttons.map((item) => [item.file, item.line, item.id, item.className, item.title || item.label]));
  section('Interaction patterns', ['File', 'Pattern', 'Count'], report.interactions.map((item) => [item.file, item.name, item.count]));
  section('Style ownership conflicts', ['File', 'Line', 'Scope', '!important', 'Selector'], report.styleOverrides.map((item) => [item.file, item.line, item.scope, item.important, item.selector]));
  lines.push('', '## Duplicate HTML IDs', '');
  if (!report.duplicateIds.length) lines.push('None detected.');
  for (const duplicate of report.duplicateIds) lines.push(`- \`${duplicate.id}\`: ${duplicate.locations.map((item) => `${item.file}:${item.line}`).join(', ')}`);
  lines.push('', 'A component is not ready to migrate until its data source, renderer, controls, click-to-filter behavior, custom features, responsive rules, and style overrides are documented.', '');
  return lines.join('\n');
}

const report = {
  generatedAt: new Date().toISOString(),
  files: [],
  tables: [],
  canvases: [],
  buttons: [],
  tableRegistrations: [],
  charts: [],
  interactions: [],
  styleOverrides: [],
  duplicateIds: [],
  summary: {}
};
const idLocations = new Map();

for (const absolute of walk(root).sort()) {
  const file = path.relative(root, absolute).replace(/\\/g, '/');
  const text = fs.readFileSync(absolute, 'utf8');
  report.files.push(file);
  report.tables.push(...htmlTags(text, file, 'table'));
  report.canvases.push(...htmlTags(text, file, 'canvas'));
  report.buttons.push(...htmlTags(text, file, 'button'));
  report.tableRegistrations.push(...tableRegistrations(text, file));
  report.charts.push(...chartConstructors(text, file));
  report.interactions.push(...interactionPatterns(text, file));
  report.styleOverrides.push(...styleOverrides(text, file));
  for (const match of text.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)) {
    if (!idLocations.has(match[2])) idLocations.set(match[2], []);
    idLocations.get(match[2]).push({ file, line: lineAt(text, match.index) });
  }
}

const registrationsByFile = new Map();
for (const item of report.tableRegistrations) {
  if (!registrationsByFile.has(item.file)) registrationsByFile.set(item.file, []);
  registrationsByFile.get(item.file).push(item);
}
report.tables = report.tables.map((table) => {
  const ids = new Set([table.id, ...(table.descendantIds || [])].filter(Boolean));
  const shared = Boolean(table.dataManaged || (registrationsByFile.get(table.file) || []).some((item) => ids.has(item.tableId) || ids.has(item.bodyId)));
  return { ...table, shared };
});
report.duplicateIds = Array.from(idLocations, ([id, locations]) => ({ id, locations })).filter((item) => item.locations.length > 1);
report.summary = {
  files: report.files.length,
  tables: report.tables.length,
  sharedTables: report.tables.filter((item) => item.shared).length,
  tableRegistrations: report.tableRegistrations.length,
  canvases: report.canvases.length,
  charts: report.charts.length,
  buttons: report.buttons.length,
  interactionGroups: report.interactions.length,
  tableStyleOverrides: report.styleOverrides.filter((item) => item.scope.includes('table')).length,
  chartStyleOverrides: report.styleOverrides.filter((item) => item.scope.includes('chart')).length,
  importantDeclarations: report.styleOverrides.reduce((sum, item) => sum + item.important, 0),
  duplicateIds: report.duplicateIds.length
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'dashboard-component-inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'dashboard-component-inventory.md'), `${markdown(report)}\n`);
console.log(`Scanned ${report.summary.files} files: ${report.summary.tables} tables, ${report.summary.charts} charts, ${report.summary.buttons} buttons.`);
console.log('Wrote reports/dashboard-component-inventory.json and reports/dashboard-component-inventory.md');
