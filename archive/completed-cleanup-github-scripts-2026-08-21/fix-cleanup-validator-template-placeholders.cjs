'use strict';

const fs = require('fs');
const file = 'scripts/validate-cleanup-checkpoint.js';
let text = fs.readFileSync(file, 'utf8');

const oldLine = "    const prepared = block.code.replace(/<\\?[!=]?[\\s\\S]*?\\?>/g, 'null;');";
const newLines = "    let prepared = block.code.replace(/<\\?!=\\s*includeDashboardFile\\([\\s\\S]*?\\)\\s*\\?>/g, 'void 0;\\n');\n    prepared = prepared.replace(/<\\?[!=]?[\\s\\S]*?\\?>/g, 'null');";

if (!text.includes(oldLine)) throw new Error('Expected cleanup validator placeholder line not found.');
text = text.replace(oldLine, newLines);
fs.writeFileSync(file, text, 'utf8');
console.log('Cleanup validator placeholder handling updated.');
