'use strict';

const fs = require('fs');
const file = 'scripts/validate-cleanup-checkpoint.js';
let text = fs.readFileSync(file, 'utf8');
const oldText = "function indexOfInclude(name) {\n  return index.indexOf(`includeDashboardFile('${name}')`);\n}";
const newText = "function indexOfInclude(name) {\n  return index.indexOf(`includeDashboardFile('${name}'`);\n}";
const count = text.split(oldText).length - 1;
if (count !== 1) throw new Error('Expected exactly one strict indexOfInclude helper, found ' + count + '.');
text = text.replace(oldText, newText);
fs.writeFileSync(file, text, 'utf8');
console.log('Validator include lookup now supports context-bearing include calls.');
