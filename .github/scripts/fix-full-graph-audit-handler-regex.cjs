'use strict';

const fs = require('fs');
const file = '.github/scripts/audit-legacy-runtime-full-graph.cjs';
const lines = fs.readFileSync(file, 'utf8').split('\n');
let changed = false;
const next = lines.map(function(line) {
  if (!line.startsWith('function handlerCount(text, name)')) return line;
  changed = true;
  return 'function handlerCount(text, name) { const pattern = "on(?:click|change|input|keydown|keyup|submit)\\\\s*=\\\\s*[\\\"\''][^\\\"\'']*\\\\b" + escapeRegex(name) + "\\\\s*\\\\("; return count(text, new RegExp(pattern, "gi")); }';
});
if (!changed) throw new Error('handlerCount line not found.');
fs.writeFileSync(file, next.join('\n'), 'utf8');
console.log('Full graph audit handler regex syntax fixed.');
