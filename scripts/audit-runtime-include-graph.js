#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const seen = new Set();
const edges = [];
const missing = [];

function fileForModule(name) {
  return name.endsWith('.html') ? name : name + '.html';
}

function visit(file, parent) {
  if (seen.has(file)) return;
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    missing.push({ parent: parent || '(entry)', file });
    return;
  }
  seen.add(file);
  const text = fs.readFileSync(full, 'utf8');
  const re = /includeDashboardFile\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(text))) {
    const child = fileForModule(match[1]);
    edges.push([file, child]);
    visit(child, file);
  }
}

visit('Index.html', '');

const rootHtml = fs.readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name)
  .sort();
const unreachable = rootHtml.filter(file => !seen.has(file));

console.log('RUNTIME_INCLUDE_GRAPH_BEGIN');
console.log('Reachable root HTML (' + seen.size + '):');
Array.from(seen).sort().forEach(file => console.log('  + ' + file));
console.log('Unreachable root HTML (' + unreachable.length + '):');
unreachable.forEach(file => console.log('  - ' + file));
console.log('Missing include targets (' + missing.length + '):');
missing.forEach(item => console.log('  ! ' + item.parent + ' -> ' + item.file));
console.log('Edges: ' + edges.length);
console.log('RUNTIME_INCLUDE_GRAPH_END');
