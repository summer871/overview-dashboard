'use strict';

const fs = require('fs');
const file = '.github/scripts/audit-legacy-runtime-full-graph.cjs';
let text = fs.readFileSync(file, 'utf8');
const oldLine = "function handlerCount(text, name) { return count(text, new RegExp('on(?:click|change|input|keydown|keyup|submit)\\\\s*=\\\\s*[\"\\\\'][^\"\\\\']*\\\\b' + escapeRegex(name) + '\\\\s*\\\\(', 'gi')); }";
const newLine = "function handlerCount(text, name) { return count(text, new RegExp(\"on(?:click|change|input|keydown|keyup|submit)\\\\s*=\\\\s*[\\\"']^[^\\\"']*\".replace('^','') + '\\\\b' + escapeRegex(name) + '\\\\s*\\\\(', 'gi')); }";
if (!text.includes(oldLine)) throw new Error('Expected broken handlerCount line not found.');
text = text.replace(oldLine, newLine);
fs.writeFileSync(file, text, 'utf8');
console.log('Full graph audit handler regex syntax fixed.');
