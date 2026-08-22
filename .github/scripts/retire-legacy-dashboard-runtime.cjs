'use strict';

const fs = require('fs');
const crypto = require('crypto');

const reportPath = 'docs/DASHBOARD-MAIN-LEGACY-RUNTIME-RETIREMENT-2026-08-22.json';
const legacyReportPath = 'docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json';
const remakeReportPath = 'docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json';

function fail(message) { throw new Error(message); }
function read(file) { if (!fs.existsSync(file)) fail('Missing required file: ' + file); return fs.readFileSync(file, 'utf8'); }
function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function bytes(text) { return Buffer.byteLength(text, 'utf8'); }
function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) fail(label + ': expected one replacement target, found ' + count + '.');
  return text.replace(oldText, newText);
}

if (fs.existsSync(reportPath)) fail('Retirement report already exists; refusing to repeat the runtime retirement.');

const legacyReport = JSON.parse(read(legacyReportPath));
const remakeReport = JSON.parse(read(remakeReportPath));
const mainPath = 'DashboardMainScript.html';
const oldMain = "<script><?!= includeDashboardFile('LegacyDashboardRuntime') ?><?!= includeDashboardFile('RemakeMainRuntimeV6230') ?></script>";
const newMain = "<script><?!= includeDashboardFile('RemakeMainRuntimeV6230') ?></script>";
const currentMain = read(mainPath);
if (currentMain !== oldMain) fail('DashboardMain retirement guard failed; current composition is not the expected 125-byte two-parent checkpoint.');
if (bytes(currentMain) !== 125 || sha256(currentMain) !== '33b3d96364964d308b9e8b6cf29b151a842d2e5f3363ba5f6b93fc95d42b41b4') {
  fail('DashboardMain retirement source hash/byte guard failed.');
}
if (bytes(newMain) !== 71 || sha256(newMain) !== '61911dd10b35d84e56f4d1106fb9910e2763bc5aceae01d5fd4617a00ff33b5e') {
  fail('DashboardMain retirement target hash/byte guard failed.');
}

const preservedArchivePath = legacyReport.archivePath;
const preservedArchive = read(preservedArchivePath);
if (bytes(preservedArchive) !== Number(legacyReport.sourceBytesBefore) || sha256(preservedArchive) !== legacyReport.sourceSha256Before) {
  fail('Legacy preserved archive no longer matches the staged legacy extraction source.');
}

const retiredRootFiles = [legacyReport.parentModule].concat(legacyReport.modules || []).map(function(item) { return item.path; });
retiredRootFiles.forEach(function(file) {
  const item = file === legacyReport.parentModule.path ? legacyReport.parentModule : (legacyReport.modules || []).find(function(module) { return module.path === file; });
  const content = read(file);
  if (!item || sha256(content) !== item.sha256 || bytes(content) !== Number(item.bytes)) fail('Legacy root file guard failed: ' + file);
});

const tatPath = 'TatDashboardControllerScript.html';
let tat = read(tatPath);
const oldTatInit = "  function ensureLegacyRemakeInitializedV6627(){\n    if(legacyRemakeInitializedV6627)return true;\n    legacyRemakeInitializedV6627=true;\n    if(previousSwitch){try{previousSwitch.call(window,'remakeFactor');}catch(error){}}\n    return true;\n  }";
const newTatInit = "  function ensureLegacyRemakeInitializedV6627(){\n    if(legacyRemakeInitializedV6627)return true;\n    legacyRemakeInitializedV6627=true;\n    if(previousSwitch){\n      try{previousSwitch.call(window,'remakeFactor');}catch(error){}\n    }else if(typeof window.loadRemakeFactorData==='function'){\n      if(!window.remakeFactorState||!window.remakeFactorState.loaded){\n        try{window.loadRemakeFactorData(false);}catch(error){}\n      }else if(typeof window.renderRemakeFactorDashboard==='function'){\n        try{window.renderRemakeFactorDashboard();}catch(error){}\n      }\n    }\n    return true;\n  }";
tat = replaceOnce(tat, oldTatInit, newTatInit, 'TAT direct Remake initialization');
fs.writeFileSync(tatPath, tat, 'utf8');

fs.writeFileSync(mainPath, newMain, 'utf8');

const claspPath = '.claspignore';
let clasp = read(claspPath);
const claspGuard = '# Archived and paused source must never be pushed to Apps Script.\narchive/**';
const claspNext = "# Archived and paused source must never be pushed to Apps Script.\n# Retired paused-Overview staging files are excluded even if restored at repo root.\nLegacyDashboardRuntime.html\nLegacyOverviewRuntimeSegment*.html\narchive/**";
clasp = replaceOnce(clasp, claspGuard, claspNext, 'clasp retired legacy exclusion');
fs.writeFileSync(claspPath, clasp, 'utf8');

let composition = read('scripts/validate-dashboard-main-composition.js');
const oldCompositionStart = "let reconstructed = read('DashboardMainScript.html');\nlet layerCount = 0;\n\nconst legacyText = readOptional('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json');\nif (legacyText) {\n  let report;\n  try { report = JSON.parse(legacyText); } catch (error) { fail('Could not parse legacy DashboardMain report: ' + error.message); }\n  reconstructed = expandReport(reconstructed, report, 'legacy dashboard layer');\n  layerCount += 1;\n}\n\nconst remakeText = readOptional('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json');\nif (remakeText) {\n  let report;\n  try { report = JSON.parse(remakeText); } catch (error) { fail('Could not parse Remake DashboardMain report: ' + error.message); }\n  reconstructed = expandReport(reconstructed, report, 'Remake runtime layer');\n  layerCount += 1;\n}\n\nif (!layerCount) {\n  console.log('DashboardMain semantic extraction reports not present; composition validation not required yet.');\n  process.exit(0);\n}\n";
const newCompositionStart = "function expandParentOnly(baseText, report, label) {\n  const parent = report.parentModule || null;\n  if (!parent || !parent.name || !parent.path) fail(label + ': missing parentModule metadata.');\n  let parentContent = read(parent.path);\n  if (Buffer.byteLength(parentContent, 'utf8') > Number(report.maxModuleBytes || 75000)) fail(parent.name + ': parent exceeds semantic-module byte limit.');\n  if (sha256(parentContent) !== parent.sha256) fail(parent.name + ': parent SHA-256 no longer matches report.');\n  const modules = Array.isArray(report.modules) ? report.modules : [];\n  if (!modules.length) fail(label + ': report has no child modules.');\n  modules.forEach(function(module) {\n    const content = read(module.path);\n    const directive = \"<?!= includeDashboardFile('\" + module.name + \"') ?>\";\n    if (count(parentContent, directive) !== 1) fail(module.name + ': expected exactly one parent include directive.');\n    if (Buffer.byteLength(content, 'utf8') > Number(report.maxModuleBytes || 75000)) fail(module.name + ': exceeds semantic-module byte limit.');\n    if (sha256(content) !== module.sha256) fail(module.name + ': SHA-256 no longer matches report.');\n    if (module.rawJavaScriptFragment === true) {\n      try { new vm.Script(content, { filename: module.path }); }\n      catch (error) { fail(module.name + ': raw JavaScript fragment no longer parses: ' + error.message); }\n    }\n    parentContent = parentContent.replace(directive, function() { return content; });\n  });\n  const parentDirective = \"<?!= includeDashboardFile('\" + parent.name + \"') ?>\";\n  if (count(baseText, parentDirective) !== 1) fail(parent.name + ': expected exactly one parent include directive in active composition.');\n  console.log('PASS: ' + label + ' -> ' + parent.name + ' + ' + modules.length + ' child modules.');\n  return baseText.replace(parentDirective, function() { return parentContent; });\n}\n\nlet reconstructed = read('DashboardMainScript.html');\nlet layerCount = 0;\nlet historicalRuntime = '';\nconst retirementText = readOptional('docs/DASHBOARD-MAIN-LEGACY-RUNTIME-RETIREMENT-2026-08-22.json');\n\nif (retirementText) {\n  let retirement;\n  let remakeReport;\n  let legacyReport;\n  try { retirement = JSON.parse(retirementText); } catch (error) { fail('Could not parse legacy runtime retirement report: ' + error.message); }\n  try { remakeReport = JSON.parse(read('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json')); } catch (error) { fail('Could not parse Remake DashboardMain report: ' + error.message); }\n  try { legacyReport = JSON.parse(read('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json')); } catch (error) { fail('Could not parse legacy DashboardMain report: ' + error.message); }\n  if (sha256(reconstructed) !== retirement.sourceSha256After || Buffer.byteLength(reconstructed, 'utf8') !== retirement.sourceBytesAfter) fail('Active DashboardMain no longer matches the legacy retirement checkpoint.');\n  if (reconstructed.indexOf(\"includeDashboardFile('LegacyDashboardRuntime')\") >= 0) fail('Retired LegacyDashboardRuntime is still active in DashboardMain.');\n  const preservedArchive = read(retirement.preservedArchivePath);\n  if (sha256(preservedArchive) !== retirement.preservedArchiveSha256 || Buffer.byteLength(preservedArchive, 'utf8') !== retirement.preservedArchiveBytes) fail('Preserved legacy archive no longer matches the retirement report.');\n  if (sha256(preservedArchive) !== legacyReport.sourceSha256Before || Buffer.byteLength(preservedArchive, 'utf8') !== legacyReport.sourceBytesBefore) fail('Preserved legacy archive no longer matches the staged legacy source.');\n  reconstructed = expandParentOnly(reconstructed, remakeReport, 'active Remake runtime layer');\n  historicalRuntime = expandReport(preservedArchive, remakeReport, 'historical pre-retirement Remake layer');\n  layerCount = 1;\n  console.log('PASS: retired legacy dashboard layer remains preserved only in archive: ' + retirement.preservedArchivePath);\n} else {\n  const legacyText = readOptional('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json');\n  if (legacyText) {\n    let report;\n    try { report = JSON.parse(legacyText); } catch (error) { fail('Could not parse legacy DashboardMain report: ' + error.message); }\n    reconstructed = expandReport(reconstructed, report, 'legacy dashboard layer');\n    layerCount += 1;\n  }\n  const remakeText = readOptional('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json');\n  if (remakeText) {\n    let report;\n    try { report = JSON.parse(remakeText); } catch (error) { fail('Could not parse Remake DashboardMain report: ' + error.message); }\n    reconstructed = expandReport(reconstructed, report, 'Remake runtime layer');\n    layerCount += 1;\n  }\n  if (!layerCount) {\n    console.log('DashboardMain semantic extraction reports not present; composition validation not required yet.');\n    process.exit(0);\n  }\n}\n";
composition = replaceOnce(composition, oldCompositionStart, newCompositionStart, 'composition retirement branch');
composition = replaceOnce(
  composition,
  "console.log('PASS: fully composed runtime bytes: ' + Buffer.byteLength(reconstructed, 'utf8').toLocaleString());\n",
  "console.log('PASS: active composed runtime bytes: ' + Buffer.byteLength(reconstructed, 'utf8').toLocaleString());\nif (historicalRuntime) console.log('PASS: preserved historical runtime bytes: ' + Buffer.byteLength(historicalRuntime, 'utf8').toLocaleString());\n",
  'composition final runtime notes'
);
fs.writeFileSync('scripts/validate-dashboard-main-composition.js', composition, 'utf8');

let cleanup = read('scripts/validate-cleanup-checkpoint.js');
const oldHelperAnchor = "function composedDashboardMainVerification() {\n";
const helper = "function expandSemanticParentOnly(baseText, report, label) {\n  const parent = report.parentModule || null;\n  if (!parent || !parent.name || !parent.path) throw new Error(label + ' report is missing parentModule metadata.');\n  let parentContent = read(parent.path);\n  assert(Buffer.byteLength(parentContent, 'utf8') <= Number(report.maxModuleBytes || 75000), parent.name + ': exceeds semantic-module byte limit.');\n  assert(sha256(parentContent) === parent.sha256, parent.name + ': SHA-256 no longer matches ' + label + ' report.');\n  const modules = Array.isArray(report.modules) ? report.modules : [];\n  assert(modules.length > 0, label + ' report has no child modules.');\n  modules.forEach(module => {\n    const content = read(module.path);\n    const directive = `<?!= includeDashboardFile('${module.name}') ?>`;\n    const occurrences = parentContent.split(directive).length - 1;\n    assert(occurrences === 1, module.name + ': expected exactly one parent include directive, found ' + occurrences + '.');\n    assert(Buffer.byteLength(content, 'utf8') <= Number(report.maxModuleBytes || 75000), module.name + ': exceeds semantic-module byte limit.');\n    assert(sha256(content) === module.sha256, module.name + ': SHA-256 no longer matches ' + label + ' report.');\n    if (module.rawJavaScriptFragment === true) {\n      try { new vm.Script(content, { filename: module.path }); }\n      catch (error) { failures.push(module.name + ': raw JavaScript fragment no longer parses: ' + error.message); }\n    }\n    parentContent = parentContent.replace(directive, function() { return content; });\n  });\n  const parentDirective = `<?!= includeDashboardFile('${parent.name}') ?>`;\n  const parentOccurrences = baseText.split(parentDirective).length - 1;\n  assert(parentOccurrences === 1, parent.name + ': expected exactly one active parent include directive, found ' + parentOccurrences + '.');\n  notes.push(label + ' composition verified: parent ' + parent.name + ' + ' + modules.length + ' modules.');\n  return baseText.replace(parentDirective, function() { return parentContent; });\n}\n\nfunction composedDashboardMainVerification() {\n";
cleanup = replaceOnce(cleanup, oldHelperAnchor, helper, 'cleanup active-parent helper insertion');

const oldComposedBody = "function composedDashboardMainVerification() {\n  const main = read('DashboardMainScript.html');\n  let reconstructed = main;\n  let composed = false;\n  let report = null;\n\n  const legacyText = readOptional('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json');\n  if (legacyText) {\n    try {\n      const legacyReport = JSON.parse(legacyText);\n      reconstructed = expandSemanticReport(reconstructed, legacyReport, 'DashboardMain legacy');\n      composed = true;\n      report = legacyReport;\n    } catch (error) {\n      failures.push('DashboardMain legacy extraction report could not be validated: ' + error.message);\n    }\n  }\n\n  const remakeText = readOptional('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json');\n  if (remakeText) {\n    try {\n      const remakeReport = JSON.parse(remakeText);\n      reconstructed = expandSemanticReport(reconstructed, remakeReport, 'DashboardMain Remake');\n      composed = true;\n      report = remakeReport;\n    } catch (error) {\n      failures.push('DashboardMain Remake extraction report could not be validated: ' + error.message);\n    }\n  }\n\n  return { text: reconstructed, currentText: main, composed, report };\n}\n";
const newComposedBody = "function composedDashboardMainVerification() {\n  const main = read('DashboardMainScript.html');\n  let reconstructed = main;\n  let composed = false;\n  let report = null;\n  const retirementText = readOptional('docs/DASHBOARD-MAIN-LEGACY-RUNTIME-RETIREMENT-2026-08-22.json');\n\n  if (retirementText) {\n    try {\n      const retirement = JSON.parse(retirementText);\n      const legacyReport = JSON.parse(read('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json'));\n      const remakeReport = JSON.parse(read('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json'));\n      assert(sha256(main) === retirement.sourceSha256After, 'DashboardMain active composition changed since legacy retirement.');\n      assert(Buffer.byteLength(main, 'utf8') === retirement.sourceBytesAfter, 'DashboardMain active byte count changed since legacy retirement.');\n      assert(!main.includes(\"includeDashboardFile('LegacyDashboardRuntime')\"), 'LegacyDashboardRuntime is still active after retirement.');\n      const preservedArchive = read(retirement.preservedArchivePath);\n      assert(sha256(preservedArchive) === retirement.preservedArchiveSha256, 'Legacy retirement archive SHA-256 mismatch.');\n      assert(Buffer.byteLength(preservedArchive, 'utf8') === retirement.preservedArchiveBytes, 'Legacy retirement archive byte-count mismatch.');\n      assert(sha256(preservedArchive) === legacyReport.sourceSha256Before, 'Legacy retirement archive no longer matches staged legacy source.');\n      const activeRuntime = expandSemanticParentOnly(main, remakeReport, 'DashboardMain active Remake');\n      reconstructed = expandSemanticReport(preservedArchive, remakeReport, 'DashboardMain historical Remake');\n      (retirement.retiredRootFiles || []).forEach(function(file) { assert(!fs.existsSync(path.join(root, file)), 'Retired legacy root file is still deployable: ' + file); });\n      notes.push('DashboardMain active runtime bytes after legacy retirement: ' + Buffer.byteLength(activeRuntime, 'utf8').toLocaleString());\n      notes.push('Paused Overview/legacy runtime preserved only in archive.');\n      composed = true;\n      report = remakeReport;\n      return { text: reconstructed, currentText: main, activeText: activeRuntime, composed, report, retirement };\n    } catch (error) {\n      failures.push('DashboardMain legacy retirement report could not be validated: ' + error.message);\n      return { text: reconstructed, currentText: main, activeText: main, composed, report };\n    }\n  }\n\n  const legacyText = readOptional('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json');\n  if (legacyText) {\n    try {\n      const legacyReport = JSON.parse(legacyText);\n      reconstructed = expandSemanticReport(reconstructed, legacyReport, 'DashboardMain legacy');\n      composed = true;\n      report = legacyReport;\n    } catch (error) {\n      failures.push('DashboardMain legacy extraction report could not be validated: ' + error.message);\n    }\n  }\n  const remakeText = readOptional('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json');\n  if (remakeText) {\n    try {\n      const remakeReport = JSON.parse(remakeText);\n      reconstructed = expandSemanticReport(reconstructed, remakeReport, 'DashboardMain Remake');\n      composed = true;\n      report = remakeReport;\n    } catch (error) {\n      failures.push('DashboardMain Remake extraction report could not be validated: ' + error.message);\n    }\n  }\n  return { text: reconstructed, currentText: main, activeText: reconstructed, composed, report };\n}\n";
cleanup = replaceOnce(cleanup, oldComposedBody, newComposedBody, 'cleanup retirement verification branch');

cleanup = replaceOnce(
  cleanup,
  "  'DashboardMainScript.html',\n  'DashboardFuzzySearch.html',",
  "  'DashboardMainScript.html',\n  'DashboardClientBootRuntime.html',\n  'DashboardShellNavigationRuntime.html',\n  'DashboardFuzzySearch.html',",
  'cleanup required shell modules'
);

cleanup = replaceOnce(
  cleanup,
  "const sharedFilterPos = indexOfInclude('SharedFilterBar');\nconst remakeAdapterPos = indexOfInclude('RemakeSharedFilterAdapterV6646');",
  "const sharedFilterPos = indexOfInclude('SharedFilterBar');\nconst dashboardMainPos = indexOfInclude('DashboardMainScript');\nconst clientBootPos = indexOfInclude('DashboardClientBootRuntime');\nconst shellNavigationPos = indexOfInclude('DashboardShellNavigationRuntime');\nconst support01Pos = indexOfInclude('DashboardSupportScript01');\nconst remakeAdapterPos = indexOfInclude('RemakeSharedFilterAdapterV6646');",
  'cleanup index ownership positions'
);

cleanup = replaceOnce(
  cleanup,
  "assert(sharedFilterPos >= 0, 'Index is missing SharedFilterBar include.');\nassert(remakeAdapterPos > sharedFilterPos, 'Remake shared-filter adapter must load after SharedFilterBar.');",
  "assert(sharedFilterPos >= 0, 'Index is missing SharedFilterBar include.');\nassert(dashboardMainPos >= 0, 'Index is missing DashboardMainScript include.');\nassert(clientBootPos > dashboardMainPos, 'DashboardClientBootRuntime must load after DashboardMainScript.');\nassert(shellNavigationPos > clientBootPos, 'DashboardShellNavigationRuntime must load after DashboardClientBootRuntime.');\nassert(support01Pos > shellNavigationPos, 'DashboardSupportScript01 must load after the semantic shell runtime owners.');\nassert(remakeAdapterPos > sharedFilterPos, 'Remake shared-filter adapter must load after SharedFilterBar.');",
  'cleanup shell ownership order assertions'
);

cleanup = replaceOnce(
  cleanup,
  "assert(tatController.includes('window.cdaTatFilterBridgeV6646'), 'TAT shared-filter bridge is missing.');\n",
  "assert(tatController.includes('window.cdaTatFilterBridgeV6646'), 'TAT shared-filter bridge is missing.');\nassert(tatController.includes(\"window.loadRemakeFactorData(false)\"), 'TAT controller is missing direct Remake initialization for the no-legacy-router path.');\nconst claspIgnore = read('.claspignore');\nassert(claspIgnore.includes('LegacyDashboardRuntime.html'), '.claspignore is missing the retired legacy parent exclusion.');\nassert(claspIgnore.includes('LegacyOverviewRuntimeSegment*.html'), '.claspignore is missing the retired legacy segment exclusion.');\n",
  'cleanup retirement ownership assertions'
);

fs.writeFileSync('scripts/validate-cleanup-checkpoint.js', cleanup, 'utf8');

retiredRootFiles.forEach(function(file) { fs.unlinkSync(file); });

const report = {
  datePt: '2026-08-22',
  checkpoint: 'Retire paused Overview/legacy DashboardMain runtime from active execution',
  source: mainPath,
  sourceBytesBefore: bytes(oldMain),
  sourceSha256Before: sha256(oldMain),
  sourceBytesAfter: bytes(newMain),
  sourceSha256After: sha256(newMain),
  removedActiveInclude: 'LegacyDashboardRuntime',
  activeRuntimeParent: 'RemakeMainRuntimeV6230',
  activeLegacyRuntime: false,
  preservedArchivePath: preservedArchivePath,
  preservedArchiveBytes: bytes(preservedArchive),
  preservedArchiveSha256: sha256(preservedArchive),
  retiredRootFiles: retiredRootFiles,
  claspExclusions: ['LegacyDashboardRuntime.html', 'LegacyOverviewRuntimeSegment*.html', 'archive/**'],
  tatRouterOwner: 'TatDashboardControllerScript.html',
  tatDirectRemakeInitialization: 'window.loadRemakeFactorData(false)',
  remakeTatBehaviorChangeIntended: false,
  pausedOverviewExecutionRemoved: true,
  productionDeployment: false,
  mergePerformed: false
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  dashboardMainBytesBefore: report.sourceBytesBefore,
  dashboardMainBytesAfter: report.sourceBytesAfter,
  retiredRootFileCount: retiredRootFiles.length,
  preservedArchiveBytes: report.preservedArchiveBytes,
  tatDirectRemakeInitialization: true,
  activeLegacyRuntime: false
}, null, 2));
