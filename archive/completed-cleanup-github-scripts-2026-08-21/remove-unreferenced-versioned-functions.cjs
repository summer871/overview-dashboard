'use strict';

const fs = require('fs');
const crypto = require('crypto');
const acorn = require('acorn');

const sourcePath = 'DashboardMainScript.html';
const reportPath = 'docs/DASHBOARD-MAIN-ORPHAN-VERSION-CLEANUP-2026-08-21.json';
const expectedSourceSha256 = 'e491f6db408e2e57bc82d02cf13575f59e5f64bd8f8ad00499332a73c5355a50';
const identifierChars = 'A-Za-z0-9_$';

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function lineAt(value, index) { return value.slice(0, index).split('\n').length; }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function familyName(name) { return name.replace(/V\d+(?:_\d+)?$/i, ''); }
function isVersioned(name) { return /V\d+(?:_\d+)?$/i.test(name); }

function sanitizeTemplates(js) {
  return js.replace(/<\?[\s\S]*?\?>/g, match => 'null' + ' '.repeat(Math.max(0, match.length - 4)));
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
      return { name: node.id.name, start, end, line: lineAt(js, start), bytes: Buffer.byteLength(text, 'utf8'), sha256: sha256(text) };
    });
}

function countIdentifier(text, name) {
  const escaped = escapeRegex(name);
  const re = new RegExp(`(^|[^${identifierChars}])${escaped}(?=$|[^${identifierChars}])`, 'g');
  let count = 0;
  while (re.exec(text)) count += 1;
  return count;
}

const original = fs.readFileSync(sourcePath, 'utf8');
if (sha256(original) !== expectedSourceSha256) fail(`Unexpected ${sourcePath} baseline. Refusing cleanup.`);

const scriptOpen = original.search(/<script(?:\s|>)/i);
const scriptOpenEnd = original.indexOf('>', scriptOpen) + 1;
const scriptClose = original.lastIndexOf('</script>');
if (scriptOpen < 0 || scriptOpenEnd <= scriptOpen || scriptClose <= scriptOpenEnd) fail('Could not isolate DashboardMainScript JavaScript payload.');
const js = original.slice(scriptOpenEnd, scriptClose);
const defs = parseTopLevelFunctions(js);

const families = new Map();
for (const def of defs) {
  const family = familyName(def.name);
  if (!families.has(family)) families.set(family, []);
  families.get(family).push(def);
}

const runtimeFiles = fs.readdirSync('.')
  .filter(name => fs.statSync(name).isFile() && /\.(html|js)$/i.test(name));
const runtimeText = new Map(runtimeFiles.map(file => [file, fs.readFileSync(file, 'utf8')]));

const candidates = [];
for (const [family, members] of families) {
  if (members.length < 2) continue;
  for (const def of members) {
    if (!isVersioned(def.name)) continue;
    let total = 0;
    const references = [];
    for (const [file, text] of runtimeText) {
      const count = countIdentifier(text, def.name);
      if (count) references.push({ file, count });
      total += count;
    }
    if (total === 1) candidates.push({ ...def, family, references });
  }
}

if (!candidates.length) fail('No unreferenced version-stacked top-level functions found.');
if (candidates.length > 80) fail(`Refusing unexpectedly broad cleanup: ${candidates.length} functions.`);
const candidateBytes = candidates.reduce((sum, item) => sum + item.bytes, 0);
if (candidateBytes > 200000) fail(`Refusing unexpectedly broad cleanup: ${candidateBytes} bytes.`);

const removals = candidates
  .map(item => ({ ...item, sourceStart: item.start + scriptOpenEnd, sourceEnd: item.end + scriptOpenEnd }))
  .sort((a, b) => b.sourceStart - a.sourceStart);
let next = original;
for (const removal of removals) next = next.slice(0, removal.sourceStart) + next.slice(removal.sourceEnd);

const nextScriptOpen = next.search(/<script(?:\s|>)/i);
const nextScriptOpenEnd = next.indexOf('>', nextScriptOpen) + 1;
const nextScriptClose = next.lastIndexOf('</script>');
const nextDefs = parseTopLevelFunctions(next.slice(nextScriptOpenEnd, nextScriptClose));
const nextNames = new Set(nextDefs.map(item => item.name));
for (const candidate of candidates) {
  if (nextNames.has(candidate.name)) fail(`Orphaned versioned declaration was not removed: ${candidate.name}`);
}
for (const def of defs) {
  if (candidates.some(item => item.name === def.name)) continue;
  const kept = nextDefs.find(item => item.name === def.name);
  if (!kept) fail(`Non-target top-level declaration disappeared: ${def.name}`);
  if (kept.sha256 !== def.sha256) fail(`Non-target top-level declaration changed: ${def.name}`);
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
  removedFunctions: candidates.length,
  behaviorChangeIntended: false,
  parser: 'acorn',
  criterion: 'Top-level FunctionDeclaration with trailing V<digits>, part of a multi-member version family, and exactly one literal identifier occurrence across active root .html/.js runtime files (its own declaration).',
  removed: candidates.map(item => ({ name: item.name, family: item.family, line: item.line, bytes: item.bytes, sha256: item.sha256 }))
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ removedFunctions: report.removedFunctions, removedBytes: report.removedBytes }, null, 2));
