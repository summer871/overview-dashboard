const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = process.cwd();
const profilerPath = path.join(root, 'CaeramistRemakeProfiler.js');
const updaterPath = path.join(root, 'CeramistIncrementalUpdater.js');
const builderPath = path.join(root, 'tools', 'ceramist_historical_rebuild_colab.py');

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log('PASS:', message);
}

function functionBody(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

for (const file of [profilerPath, updaterPath, builderPath]) {
  assert(fs.existsSync(file), `Required file exists: ${path.relative(root, file)}`);
}

const profiler = fs.readFileSync(profilerPath, 'utf8');
const updater = fs.readFileSync(updaterPath, 'utf8');
const builder = fs.readFileSync(builderPath, 'utf8');
const canonical = functionBody(profiler, 'refreshCeramistCaseLevelResponsibilityNightlyV75');

assert(profiler.includes('Version: 7.8.0'), 'Profiler version is 7.8.0.');
assert(profiler.includes("CeramistRemakeCache v0.6.0"), 'Profiler cache version is v0.6.0.');
assert(canonical.includes('refreshCeramistIncrementalNightlyV780'), 'Canonical nightly entry point delegates to incremental maintenance.');
assert(!canonical.includes('ceramistReconcileCompleteRemakePopulationV77_'), 'Canonical nightly entry point no longer performs the full historical population walk.');

[
  'ceramistHistoricalSeedVersionV780',
  'historical-seed-plus-open-month-upsert-v7.8.0',
  'readRemakeFactorCacheIndexV118',
  'incrementalPreservedClosedRows',
  'ceramistApplyCaseLevelResponsibilityV74_',
  'ceramistApplyTaskUserBadgeNamesV72_',
  'MT_CERAMIST_INCREMENTAL_MAX_API_CALLS',
  'getCeramistSeedConfigurationV780',
  'requiresHistoricalSeed: true',
  'incrementalRefreshedMonths'
].forEach(marker => assert(updater.includes(marker), `Incremental updater marker present: ${marker}`));

assert(!updater.includes('ceramistReconcileCompleteRemakePopulationV77_('), 'Incremental updater never calls the old complete-population routine.');
assert(updater.includes("props.getProperty('MT_REMAKE_OPEN_REFRESH_MONTHS')"), 'Incremental updater mirrors the Remake open-month configuration.');
assert(updater.includes('preservedRows.concat(rebuiltRows)'), 'Closed historical sidecar rows are preserved and open rows are replaced.');
assert(updater.includes('incrementalApiCallLimit'), 'Incremental API fallback use is measured.');

[
  'SEED_VERSION = "ceramist-colab-seed-v1.0.0"',
  'Type WRITE to back up and replace the Ceramist cache',
  'drive.files().copy',
  '389666',
  '385918',
  'Hoseung Han (Jason)',
  'UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), \'\'))) = @task_code',
  'remakeCaseID',
  'invoice-note backup',
  'MT_CERAMIST_REMAKE_CACHE_FILE_ID'
].forEach(marker => assert(builder.includes(marker), `Historical builder marker present: ${marker}`));

assert(!/MT_CRM_API_PASSWORD\s*=\s*["'][^"']+["']/.test(builder), 'Historical builder contains no embedded CRM password.');
assert(!/MT_CRM_API_USERID\s*=\s*["'][^"']+["']/.test(builder), 'Historical builder contains no embedded CRM user ID.');

new Function(updater);
console.log('PASS: CeramistIncrementalUpdater.js JavaScript syntax is valid.');

childProcess.execFileSync('python', ['-m', 'py_compile', builderPath], { stdio: 'inherit' });
console.log('PASS: Colab historical builder Python syntax is valid.');

console.log('Ceramist historical seed + incremental maintenance validation passed.');
console.log('Version: v6.575 / backend v7.8.0');
