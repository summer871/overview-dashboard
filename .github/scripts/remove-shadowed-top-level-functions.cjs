'use strict';

const fs = require('fs');
const crypto = require('crypto');

const sourcePath = 'DashboardMainScript.html';
const reportPath = 'docs/DASHBOARD-MAIN-DUPLICATE-CLEANUP-2026-08-21.json';
const expectedSourceSha256 = 'dc392f7d3a11864dc02dd779afebaa7d8007ef753452b44e8d1b3efcece59748';

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function lineAt(value, index) { return value.slice(0, index).split('\n').length; }
function isIdent(ch) { return !!ch && /[A-Za-z0-9_$]/.test(ch); }

function findFunctionEnd(js, start) {
  let state = 'normal';
  let escaped = false;
  let opened = false;
  let depth = 0;

  for (let i = start; i < js.length; i += 1) {
    const ch = js[i];
    const next = js[i + 1] || '';

    if (state === 'lineComment') {
      if (ch === '\n') state = 'normal';
      continue;
    }
    if (state === 'blockComment') {
      if (ch === '*' && next === '/') { state = 'normal'; i += 1; }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if ((state === 'single' && ch === "'") || (state === 'double' && ch === '"') || (state === 'template' && ch === '`')) {
        state = 'normal';
      }
      continue;
    }

    if (ch === '/' && next === '/') { state = 'lineComment'; i += 1; continue; }
    if (ch === '/' && next === '*') { state = 'blockComment'; i += 1; continue; }
    if (ch === "'") { state = 'single'; continue; }
    if (ch === '"') { state = 'double'; continue; }
    if (ch === '`') { state = 'template'; continue; }

    if (ch === '{') {
      opened = true;
      depth += 1;
      continue;
    }
    if (ch === '}' && opened) {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        while (end < js.length && (js[end] === ' ' || js[end] === '\t' || js[end] === '\r')) end += 1;
        if (js[end] === '\n') end += 1;
        return end;
      }
    }
  }
  fail(`Could not find closing brace for function at JS offset ${start}.`);
}

function scanTopLevelFunctions(js, sourceOffset) {
  const defs = [];
  let state = 'normal';
  let escaped = false;
  let depth = 0;

  for (let i = 0; i < js.length; i += 1) {
    const ch = js[i];
    const next = js[i + 1] || '';

    if (state === 'lineComment') {
      if (ch === '\n') state = 'normal';
      continue;
    }
    if (state === 'blockComment') {
      if (ch === '*' && next === '/') { state = 'normal'; i += 1; }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if ((state === 'single' && ch === "'") || (state === 'double' && ch === '"') || (state === 'template' && ch === '`')) state = 'normal';
      continue;
    }

    if (ch === '/' && next === '/') { state = 'lineComment'; i += 1; continue; }
    if (ch === '/' && next === '*') { state = 'blockComment'; i += 1; continue; }
    if (ch === "'") { state = 'single'; continue; }
    if (ch === '"') { state = 'double'; continue; }
    if (ch === '`') { state = 'template'; continue; }

    if (ch === '{') { depth += 1; continue; }
    if (ch === '}') { depth -= 1; if (depth < 0) fail(`Negative brace depth at JS offset ${i}.`); continue; }

    if (depth !== 0) continue;
    if (!js.startsWith('function', i)) continue;
    if (isIdent(js[i - 1]) || isIdent(js[i + 8])) continue;

    let cursor = i + 8;
    while (/\s/.test(js[cursor] || '')) cursor += 1;
    if (js[cursor] === '*') continue;
    const nameMatch = js.slice(cursor).match(/^([A-Za-z_$][\w$]*)\s*\(/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const lineStart = js.lastIndexOf('\n', i - 1) + 1;
    const prefix = js.slice(lineStart, i).trim();
    const start = prefix === '' || prefix === 'async' ? lineStart : i;
    const end = findFunctionEnd(js, i);
    const text = js.slice(start, end);
    defs.push({ name, start, end, line: lineAt(js, start), sha256: sha256(text), bytes: Buffer.byteLength(text, 'utf8') });
    i = end - 1;
  }

  if (depth !== 0 || state === 'single' || state === 'double' || state === 'blockComment') {
    fail(`Lexical scan ended in an unexpected state: ${state}, brace depth ${depth}.`);
  }
  return defs.map(def => ({ ...def, sourceStart: def.start + sourceOffset, sourceEnd: def.end + sourceOffset }));
}

const original = fs.readFileSync(sourcePath, 'utf8');
if (sha256(original) !== expectedSourceSha256) fail(`Unexpected ${sourcePath} baseline. Refusing cleanup.`);

const scriptOpen = original.search(/<script(?:\s|>)/i);
const scriptOpenEnd = original.indexOf('>', scriptOpen) + 1;
const scriptClose = original.lastIndexOf('</script>');
if (scriptOpen < 0 || scriptOpenEnd <= scriptOpen || scriptClose <= scriptOpenEnd) fail('Could not isolate DashboardMainScript JavaScript payload.');

const js = original.slice(scriptOpenEnd, scriptClose);
const defs = scanTopLevelFunctions(js, scriptOpenEnd);
const byName = new Map();
for (const def of defs) {
  if (!byName.has(def.name)) byName.set(def.name, []);
  byName.get(def.name).push(def);
}

const duplicateGroups = [...byName.entries()].filter(([, list]) => list.length > 1);
if (!duplicateGroups.length) fail('No shadowed top-level function declarations found.');

const removals = [];
for (const [name, list] of duplicateGroups) {
  const authoritative = list[list.length - 1];
  for (let i = 0; i < list.length - 1; i += 1) removals.push({ ...list[i], authoritativeLine: authoritative.line, authoritativeSha256: authoritative.sha256 });
}
removals.sort((a, b) => b.sourceStart - a.sourceStart);

let next = original;
for (const removal of removals) {
  next = next.slice(0, removal.sourceStart) + next.slice(removal.sourceEnd);
}

if (next === original) fail('Cleanup did not change the source.');

const nextScriptOpen = next.search(/<script(?:\s|>)/i);
const nextScriptOpenEnd = next.indexOf('>', nextScriptOpen) + 1;
const nextScriptClose = next.lastIndexOf('</script>');
const nextDefs = scanTopLevelFunctions(next.slice(nextScriptOpenEnd, nextScriptClose), nextScriptOpenEnd);
const nextCounts = new Map();
for (const def of nextDefs) nextCounts.set(def.name, (nextCounts.get(def.name) || 0) + 1);
const remainingDupes = [...nextCounts.entries()].filter(([, count]) => count > 1);
if (remainingDupes.length) fail(`Top-level duplicate declarations remain: ${remainingDupes.map(([name, count]) => `${name}=${count}`).join(', ')}`);

for (const [name, list] of duplicateGroups) {
  const authoritative = list[list.length - 1];
  const kept = nextDefs.find(def => def.name === name);
  if (!kept) fail(`Authoritative declaration disappeared: ${name}`);
  if (kept.sha256 !== authoritative.sha256) fail(`Authoritative declaration changed: ${name}`);
}

fs.writeFileSync(sourcePath, next, 'utf8');
const removedBytes = Buffer.byteLength(original, 'utf8') - Buffer.byteLength(next, 'utf8');
const report = {
  generatedAt: new Date().toISOString(),
  source: sourcePath,
  sourceSha256Before: expectedSourceSha256,
  sourceSha256After: sha256(next),
  sourceBytesBefore: Buffer.byteLength(original, 'utf8'),
  sourceBytesAfter: Buffer.byteLength(next, 'utf8'),
  removedBytes,
  duplicateFunctionNames: duplicateGroups.length,
  removedDeclarations: removals.length,
  remainingTopLevelDuplicateFunctionNames: 0,
  behaviorChangeIntended: false,
  rule: 'For repeated named function declarations in the same top-level classic-script scope, preserve the final declaration byte-for-byte and remove only earlier shadowed declarations.',
  removed: removals.slice().reverse().map(item => ({ name: item.name, line: item.line, bytes: item.bytes, sha256: item.sha256, authoritativeLine: item.authoritativeLine, authoritativeSha256: item.authoritativeSha256 }))
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ removedDeclarations: report.removedDeclarations, duplicateFunctionNames: report.duplicateFunctionNames, removedBytes }, null, 2));
