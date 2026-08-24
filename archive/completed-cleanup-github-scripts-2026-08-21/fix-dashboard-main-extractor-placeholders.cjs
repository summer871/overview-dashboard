'use strict';

const fs = require('fs');
const file = '.github/scripts/extract-dashboard-main-remake-runtime.cjs';
let text = fs.readFileSync(file, 'utf8');

const oldParent = "const preparedParent = parent.replace(/<\\?[!=]?[\\s\\S]*?\\?>/g, 'null;');";
const newParent = "const preparedParent = parent.replace(/<\\?[!=]?[\\s\\S]*?\\?>/g, 'void 0;\\n');";
const oldMain = "const preparedMain = next.replace(/<\\?[!=]?[\\s\\S]*?\\?>/g, 'null;');";
const newMain = "let preparedMain = next.replace(parentDirective, 'void 0;\\n');\npreparedMain = preparedMain.replace(/<\\?[!=]?[\\s\\S]*?\\?>/g, 'null');";

if (!text.includes(oldParent)) throw new Error('Expected preparedParent placeholder line not found.');
if (!text.includes(oldMain)) throw new Error('Expected preparedMain placeholder line not found.');
text = text.replace(oldParent, newParent).replace(oldMain, newMain);
fs.writeFileSync(file, text, 'utf8');
console.log('DashboardMain extractor placeholder handling updated.');
