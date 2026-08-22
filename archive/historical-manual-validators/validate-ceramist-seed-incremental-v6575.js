const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = process.cwd();
const profilerPath = path.join(root, 'CaeramistRemakeProfiler.js');
const updaterPath = path.join(root, 'CeramistIncrementalUpdater.js');
const builderPath = path.join(root, 'tools', 'ceramist_historical_rebuild_colab.py');
const backfillPath = path.join(root, 'tools', 'ceramist_invoice_note_backfill_colab.py');

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

for (const file of [profilerPath, updaterPath, builderPath, backfillPath]) {
  assert(fs.existsSync(file), `Required file exists: ${path.relative(root, file)}`);
}

const profiler = fs.readFileSync(profilerPath, 'utf8');
const updater = fs.readFileSync(updaterPath, 'utf8');
const builder = fs.readFileSync(builderPath, 'utf8');
const backfill = fs.readFileSync(backfillPath, 'utf8');
const canonical = functionBody(profiler, 'refreshCeramistCaseLevelResponsibilityNightlyV75');

assert(profiler.includes('Version: 7.8.2'), 'Profiler version is 7.8.1.');
assert(profiler.includes("CeramistRemakeCache v0.6.0"), 'Profiler cache version is v0.6.0.');
assert(canonical.includes('refreshCeramistIncrementalNightlyV780'), 'Canonical nightly entry point delegates to incremental maintenance.');
assert(!canonical.includes('ceramistReconcileCompleteRemakePopulationV77_'), 'Canonical nightly entry point no longer performs the full historical population walk.');

[
  'ceramistHistoricalSeedVersionV780',
  'historical-seed-plus-open-month-upsert-v7.8.2',
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
childProcess.execFileSync('python', ['-m', 'py_compile', backfillPath], { stdio: 'inherit' });
console.log('PASS: Invoice Notes backfill Python syntax is valid.');

assert(
  builder.includes('BUILDER_VERSION = "ceramist-colab-builder-v1.0.3"'),
  'Colab builder version v1.0.3 is present.'
);
assert(
  builder.includes('allow_missing_remake_field_as_terminal: bool = False'),
  'Linked/root terminal-field compatibility parameter is present.'
);
assert(
  builder.includes('allow_missing_remake_field_as_terminal=True'),
  'Linked/root CRM fetches allow omitted remakeCaseID as terminal.'
);
assert(
  builder.includes('Running CRM chain preflight for 389666 -> 385918'),
  '389666 -> 385918 preflight is present.'
);
assert(
  builder.includes('MAX_CHAIN_ERRORS_BEFORE_ABORT = 5'),
  'Historical rebuild fails fast after five chain errors.'
);
console.log('PASS: Colab root-chain termination contract is present.');

assert(
  builder.includes('"unlinked_unconfirmed"') &&
    builder.includes('"remake_case_id_unavailable"'),
  'Colab builder preserves missing current remakeCaseID as an accurate Unattributed reason.'
);
assert(
  updater.includes("'missing_link_field'") &&
    updater.includes("'unlinked_unconfirmed'") &&
    updater.includes('allowMissingRemakeFieldAsTerminal'),
  'Incremental updater distinguishes missing current links from linked-root terminal cases.'
);
assert(
  profiler.includes("chainStatus === 'unlinked_unconfirmed'") &&
    profiler.includes("row.attributionBasis = 'remake_case_id_unavailable'"),
  'Dashboard responsibility output preserves the unconfirmed-link reason.'
);
console.log('PASS: Unconfirmed current-case link handling is preserved.');


[
  'invoiceNotes',
  'InvoiceNotes',
  'Cases_InvoiceNotes'
].forEach(marker => {
  assert(builder.includes(marker), `Historical builder reads direct Invoice Notes alias: ${marker}`);
  assert(updater.includes(marker), `Incremental updater reads direct Invoice Notes alias: ${marker}`);
  assert(backfill.includes(marker), `Backfill reads direct Invoice Notes alias: ${marker}`);
});
assert(
  builder.includes('extract_tech_numbers') &&
    builder.includes('[-/,;&+]') &&
    builder.includes('technicianType'),
  'Historical builder contains multi-number Invoice Notes parsing.'
);
assert(
  updater.includes('ceramistIncrementalExtractTechNumbersV782') &&
    updater.includes('[-/,;&+]'),
  'Incremental updater contains multi-number Invoice Notes parsing.'
);
assert(
  profiler.includes('ceramistCandidates.length === 1') &&
    profiler.includes('/^ceramist$/i'),
  'Profiler selects a multi-number Invoice Notes worker only when exactly one mapped worker is a Ceramist.'
);
assert(
  backfill.includes('378035') &&
    backfill.includes('377483') &&
    backfill.includes('Ol Phann') &&
    backfill.includes('Type WRITE to back up and replace the Ceramist cache'),
  'One-time backfill includes the verified 378035 -> 377483 -> Ol Phann regression and guarded write.'
);

console.log('Ceramist historical seed + incremental maintenance validation passed.');
console.log('Version: v6.578 / backend v7.8.2');
