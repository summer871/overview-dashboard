'use strict';

const fs = require('fs');
const crypto = require('crypto');
const acorn = require('acorn');

const sourcePath = 'DashboardMainScript.html';
const reportPath = 'docs/DASHBOARD-MAIN-DUPLICATE-CLEANUP-2026-08-21.json';
const expectedSourceSha256 = 'dc392f7d3a11864dc02dd779afebaa7d8007ef753452b44e8d1b3efcece59748';

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function lineAt(value, index) { return value.slice(0, index).split('\n').length; }

function sanitizeTemplates(js) {
  return js.replace(/<\?[\s\S]*?\?>/g, match => {
    if (match.length < 4) return 'null'.slice(0, match.length);
    return 'null' + ' '.repeat(match.length - 4);
  });
}

function parseTopLevelFunctions(js) {
  const sanitized = sanitizeTemplates(js);
  if (sanitized.length !== js.length) fail('Template sanitization changed source length.');
  const ast = acorn.parse(sanitized, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
  return ast.body
    .filter(node => node.type === 'FunctionDeclaration' && node.id && node.id.name)
    .map(node => {
      let start = node.start;
      const lineStart = js.lastIndexOf('\n', start - 1) + 1;
      if (/^\s*$/.test(js.slice(lineStart, start))) start = lineStart;
      let end = node.end;
      while (end < js.length && /[ \t\r]/.test(js[end])) end += 1;
      if (js[end] === '\n') end += 1;
      const text = js.slice(start, end);
      return {
        name: node.id.name,
        start,
        end,
        line: lineAt(js, start),
        bytes: Buffer.byteLength(text, 'utf8'),
        sha256: sha256(text)
      };
    });
}

const original = fs.readFileSync(sourcePath, 'utf8');
if (sha256(original) !== expectedSourceSha256) fail(`Unexpected ${sourcePath} baseline. Refusing cleanup.`);

const scriptOpen = original.search(/<script(?:\s|>)/i);
const scriptOpenEnd = original.indexOf('>', scriptOpen) + 1;
const scriptClose = original.lastIndexOf('</script>');
if (scriptOpen < 0 || scriptOpenEnd <= scriptOpen || scriptClose <= scriptOpenEnd) fail('Could not isolate DashboardMainScript JavaScript payload.');

const js = original.slice(scriptOpenEnd, scriptClose);
const defs = parseTopLevelFunctions(js);
const byName = new Map();
for (const def of defs) {
  if (!byName.has(def.name)) byName.set(def.name, []);
  byName.get(def.name).push(def);
}

const duplicateGroups = [...byName.entries()].filter(([, list]) => list.length > 1);
if (!duplicateGroups.length) fail('No repeated top-level function declarations found.');

const removals = [];
for (const [name, list] of duplicateGroups) {
  const authoritative = list[list.length - 1];
  for (let i = 0; i < list.length - 1; i += 1) {
    removals.push({
      ...list[i],
      sourceStart: list[i].start + scriptOpenEnd,
      sourceEnd: list[i].end + scriptOpenEnd,
      authoritativeLine: authoritative.line,
      authoritativeSha256: authoritative.sha256
    });
  }
}
removals.sort((a, b) => b.sourceStart - a.sourceStart);

let next = original;
for (const removal of removals) next = next.slice(0, removal.sourceStart) + next.slice(removal.sourceEnd);
if (next === original) fail('Cleanup did not change the source.');

const nextScriptOpen = next.search(/<script(?:\s|>)/i);
const nextScriptOpenEnd = next.indexOf('>', nextScriptOpen) + 1;
const nextScriptClose = next.lastIndexOf('</script>');
const nextJs = next.slice(nextScriptOpenEnd, nextScriptClose);
const nextDefs = parseTopLevelFunctions(nextJs);
const nextByName = new Map();
for (const def of nextDefs) {
  if (!nextByName.has(def.name)) nextByName.set(def.name, []);
  nextByName.get(def.name).push(def);
}
const remainingDupes = [...nextByName.entries()].filter(([, list]) => list.length > 1);
if (remainingDupes.length) fail(`Top-level duplicates remain: ${remainingDupes.map(([name, list]) => `${name}=${list.length}`).join(', ')}`);

for (const [name, list] of duplicateGroups) {
  const authoritative = list[list.length - 1];
  const kept = (nextByName.get(name) || [])[0];
  if (!kept) fail(`Authoritative declaration disappeared: ${name}`);
  if (kept.sha256 !== authoritative.sha256) fail(`Authoritative declaration changed: ${name}`);
}

fs.writeFileSync(sourcePath, next, 'utf8');
const report = {
  generatedAt: new Date().toISOString(),
  source: sourcePath,
  sourceSha256Before: expectedSourceSha256,
  sourceSha256After: sha256(next),
  sourceBytesBefore: Buffer.byteLength(original, 'utf8'),
  sourceBytesAfter: Buffer.byteLength(next, 'utf8'),
  removedBytes: Buffer.byteLength(original, 'utf8') - Buffer.byteLength(next, 'utf8'),
  duplicateFunctionNames: duplicateGroups.length,
  removedDeclarations: removals.length,
  remainingTopLevelDuplicateFunctionNames: 0,
  behaviorChangeIntended: false,
  parser: 'acorn',
  rule: 'Remove only earlier repeated FunctionDeclaration nodes from Program.body; preserve the final same-name top-level declaration byte-for-byte.',
  removed: removals.slice().reverse().map(item => ({
    name: item.name,
    line: item.line,
    bytes: item.bytes,
    sha256: item.sha256,
    authoritativeLine: item.authoritativeLine,
    authoritativeSha256: item.authoritativeSha256
  }))
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  duplicateFunctionNames: report.duplicateFunctionNames,
  removedDeclarations: report.removedDeclarations,
  removedBytes: report.removedBytes
}, null, 2));
