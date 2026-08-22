import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const profilerPath = path.join(root, 'CaeramistRemakeProfiler.js');
const updaterPath = path.join(root, 'CeramistIncrementalUpdater.js');
const builderPath = path.join(root, 'tools', 'ceramist_historical_rebuild_colab.py');

for (const required of [profilerPath, updaterPath, builderPath]) {
  if (!fs.existsSync(required)) throw new Error(`Missing required file: ${required}`);
}

function findFunctionRange(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Function not found: ${name}`);
  const open = source.indexOf('{', start);
  if (open < 0) throw new Error(`Function opening brace not found: ${name}`);

  let depth = 0;
  let state = 'code';
  let escaped = false;
  for (let index = open; index < source.length; index++) {
    const ch = source[index];
    const next = source[index + 1] || '';
    if (state === 'line') {
      if (ch === '\n') state = 'code';
      continue;
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') { state = 'code'; index++; }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if ((state === 'single' && ch === "'") || (state === 'double' && ch === '"') || (state === 'template' && ch === '`')) state = 'code';
      continue;
    }
    if (ch === '/' && next === '/') { state = 'line'; index++; continue; }
    if (ch === '/' && next === '*') { state = 'block'; index++; continue; }
    if (ch === "'") { state = 'single'; continue; }
    if (ch === '"') { state = 'double'; continue; }
    if (ch === '`') { state = 'template'; continue; }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  throw new Error(`Function closing brace not found: ${name}`);
}

let profiler = fs.readFileSync(profilerPath, 'utf8');
const range = findFunctionRange(profiler, 'refreshCeramistCaseLevelResponsibilityNightlyV75');
const replacement = `function refreshCeramistCaseLevelResponsibilityNightlyV75() {\n  return refreshCeramistIncrementalNightlyV780();\n}`;
profiler = profiler.slice(0, range.start) + replacement + profiler.slice(range.end);
profiler = profiler.replace('Version: 7.7.1', 'Version: 7.8.0');
profiler = profiler.replace("const ceramistRemakeCacheVersionV7 = 'CeramistRemakeCache v0.5.1';", "const ceramistRemakeCacheVersionV7 = 'CeramistRemakeCache v0.6.0';");
profiler = profiler.replace(
  /v7\.7\.1 confirms blank remakeCaseID values[\s\S]*?deferred and failed lookups remain retryable\./,
  'v7.8 delegates normal maintenance to a historical-seed plus open-month upsert workflow. The complete historical chain is built once in Colab; nightly and dashboard refreshes replace only the same open month(s) refreshed by the Remake cache.'
);
fs.writeFileSync(profilerPath, profiler, 'utf8');
console.log('Patched canonical Ceramist nightly entry point to v7.8 incremental maintenance.');
