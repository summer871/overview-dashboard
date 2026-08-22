#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const failures = [];
const notes = [];

function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${file}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function readOptional(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function executableScriptBlocks(file, text) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(text))) {
    const attrs = match[1] || '';
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    if (type && type !== 'text/javascript' && type !== 'application/javascript') continue;
    blocks.push({ code: match[2], index: blocks.length + 1 });
  }
  return blocks;
}

function parseHtmlScripts(file) {
  const text = read(file);
  if (!text) return;
  const opens = (text.match(/<script\b/gi) || []).length;
  const closes = (text.match(/<\/script>/gi) || []).length;
  assert(opens === closes, `${file}: script tag boundary mismatch (${opens} open / ${closes} close)`);
  executableScriptBlocks(file, text).forEach(block => {
    let prepared = block.code.replace(/<\?!=\s*includeDashboardFile\([\s\S]*?\)\s*\?>/g, 'void 0;\n');
    prepared = prepared.replace(/<\?[!=]?[\s\S]*?\?>/g, 'null');
    try {
      new vm.Script(prepared, { filename: `${file}#script${block.index}` });
    } catch (error) {
      failures.push(`${file}#script${block.index}: ${error.message}`);
    }
  });
}

function expandSemanticReport(baseText, report, label) {
  const archive = read(report.archivePath);
  const parent = report.parentModule || null;
  if (!parent || !parent.name || !parent.path) throw new Error(label + ' report is missing parentModule metadata.');
  let parentContent = read(parent.path);
  assert(Buffer.byteLength(parentContent, 'utf8') <= Number(report.maxModuleBytes || 75000), parent.name + ': exceeds semantic-module byte limit.');
  assert(sha256(parentContent) === parent.sha256, parent.name + ': SHA-256 no longer matches ' + label + ' report.');
  const modules = Array.isArray(report.modules) ? report.modules : [];
  assert(modules.length > 0, label + ' report has no child modules.');
  modules.forEach(module => {
    const content = read(module.path);
    const directive = `<?!= includeDashboardFile('${module.name}') ?>`;
    const occurrences = parentContent.split(directive).length - 1;
    assert(occurrences === 1, module.name + ': expected exactly one parent include directive, found ' + occurrences + '.');
    assert(Buffer.byteLength(content, 'utf8') <= Number(report.maxModuleBytes || 75000), module.name + ': exceeds semantic-module byte limit.');
    assert(sha256(content) === module.sha256, module.name + ': SHA-256 no longer matches ' + label + ' report.');
    if (module.rawJavaScriptFragment === true) {
      try { new vm.Script(content, { filename: module.path }); }
      catch (error) { failures.push(module.name + ': raw JavaScript fragment no longer parses: ' + error.message); }
    }
    parentContent = parentContent.replace(directive, function() { return content; });
  });
  const parentDirective = `<?!= includeDashboardFile('${parent.name}') ?>`;
  const parentOccurrences = baseText.split(parentDirective).length - 1;
  assert(parentOccurrences === 1, parent.name + ': expected exactly one parent include directive, found ' + parentOccurrences + '.');
  const reconstructed = baseText.replace(parentDirective, function() { return parentContent; });
  assert(reconstructed === archive, label + ' composition is not byte-for-byte identical to its archived outgoing runtime.');
  assert(sha256(reconstructed) === report.sourceSha256Before, label + ' composed SHA-256 does not match pre-extraction runtime.');
  assert(Buffer.byteLength(reconstructed, 'utf8') === report.sourceBytesBefore, label + ' composed byte count does not match pre-extraction runtime.');
  assert(sha256(baseText) === report.sourceSha256After, label + ' composition source changed since extraction report.');
  notes.push(label + ' composition verified: parent ' + parent.name + ' + ' + modules.length + ' modules.');
  return reconstructed;
}

function expandSemanticParentOnly(baseText, report, label) {
  const parent = report.parentModule || null;
  if (!parent || !parent.name || !parent.path) throw new Error(label + ' report is missing parentModule metadata.');
  let parentContent = read(parent.path);
  assert(Buffer.byteLength(parentContent, 'utf8') <= Number(report.maxModuleBytes || 75000), parent.name + ': exceeds semantic-module byte limit.');
  assert(sha256(parentContent) === parent.sha256, parent.name + ': SHA-256 no longer matches ' + label + ' report.');
  const modules = Array.isArray(report.modules) ? report.modules : [];
  assert(modules.length > 0, label + ' report has no child modules.');
  modules.forEach(module => {
    const content = read(module.path);
    const directive = `<?!= includeDashboardFile('${module.name}') ?>`;
    const occurrences = parentContent.split(directive).length - 1;
    assert(occurrences === 1, module.name + ': expected exactly one parent include directive, found ' + occurrences + '.');
    assert(Buffer.byteLength(content, 'utf8') <= Number(report.maxModuleBytes || 75000), module.name + ': exceeds semantic-module byte limit.');
    assert(sha256(content) === module.sha256, module.name + ': SHA-256 no longer matches ' + label + ' report.');
    if (module.rawJavaScriptFragment === true) {
      try { new vm.Script(content, { filename: module.path }); }
      catch (error) { failures.push(module.name + ': raw JavaScript fragment no longer parses: ' + error.message); }
    }
    parentContent = parentContent.replace(directive, function() { return content; });
  });
  const parentDirective = `<?!= includeDashboardFile('${parent.name}') ?>`;
  const parentOccurrences = baseText.split(parentDirective).length - 1;
  assert(parentOccurrences === 1, parent.name + ': expected exactly one active parent include directive, found ' + parentOccurrences + '.');
  notes.push(label + ' composition verified: parent ' + parent.name + ' + ' + modules.length + ' modules.');
  return baseText.replace(parentDirective, function() { return parentContent; });
}

function composedDashboardMainVerification() {
  const main = read('DashboardMainScript.html');
  let reconstructed = main;
  let composed = false;
  let report = null;
  const retirementText = readOptional('docs/DASHBOARD-MAIN-LEGACY-RUNTIME-RETIREMENT-2026-08-22.json');

  if (retirementText) {
    try {
      const retirement = JSON.parse(retirementText);
      const legacyReport = JSON.parse(read('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json'));
      const remakeReport = JSON.parse(read('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json'));
      assert(sha256(main) === retirement.sourceSha256After, 'DashboardMain active composition changed since legacy retirement.');
      assert(Buffer.byteLength(main, 'utf8') === retirement.sourceBytesAfter, 'DashboardMain active byte count changed since legacy retirement.');
      assert(!main.includes("includeDashboardFile('LegacyDashboardRuntime')"), 'LegacyDashboardRuntime is still active after retirement.');
      const preservedArchive = read(retirement.preservedArchivePath);
      assert(sha256(preservedArchive) === retirement.preservedArchiveSha256, 'Legacy retirement archive SHA-256 mismatch.');
      assert(Buffer.byteLength(preservedArchive, 'utf8') === retirement.preservedArchiveBytes, 'Legacy retirement archive byte-count mismatch.');
      assert(sha256(preservedArchive) === legacyReport.sourceSha256Before, 'Legacy retirement archive no longer matches staged legacy source.');
      const activeRuntime = expandSemanticParentOnly(main, remakeReport, 'DashboardMain active Remake');
      reconstructed = expandSemanticReport(preservedArchive, remakeReport, 'DashboardMain historical Remake');
      (retirement.retiredRootFiles || []).forEach(function(file) { assert(!fs.existsSync(path.join(root, file)), 'Retired legacy root file is still deployable: ' + file); });
      notes.push('DashboardMain active runtime bytes after legacy retirement: ' + Buffer.byteLength(activeRuntime, 'utf8').toLocaleString());
      notes.push('Paused Overview/legacy runtime preserved only in archive.');
      composed = true;
      report = remakeReport;
      return { text: reconstructed, currentText: main, activeText: activeRuntime, composed, report, retirement };
    } catch (error) {
      failures.push('DashboardMain legacy retirement report could not be validated: ' + error.message);
      return { text: reconstructed, currentText: main, activeText: main, composed, report };
    }
  }

  const legacyText = readOptional('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json');
  if (legacyText) {
    try {
      const legacyReport = JSON.parse(legacyText);
      reconstructed = expandSemanticReport(reconstructed, legacyReport, 'DashboardMain legacy');
      composed = true;
      report = legacyReport;
    } catch (error) {
      failures.push('DashboardMain legacy extraction report could not be validated: ' + error.message);
    }
  }
  const remakeText = readOptional('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json');
  if (remakeText) {
    try {
      const remakeReport = JSON.parse(remakeText);
      reconstructed = expandSemanticReport(reconstructed, remakeReport, 'DashboardMain Remake');
      composed = true;
      report = remakeReport;
    } catch (error) {
      failures.push('DashboardMain Remake extraction report could not be validated: ' + error.message);
    }
  }
  return { text: reconstructed, currentText: main, activeText: reconstructed, composed, report };
}

const requiredRuntimeFiles = [
  'Index.html',
  'DashboardMainScript.html',
  'DashboardClientBootRuntime.html',
  'DashboardShellNavigationRuntime.html',
  'DashboardFuzzySearch.html',
  'SharedFilterBar.html',
  'SharedFilterBarStyles.html',
  'RemakeSharedFilterAdapterV6646.html',
  'TatDashboardControllerScript.html',
  'TatSharedFilterAdapterV6646.html',
  'SharedTableModule.html',
  'SharedDashboardTablePlatformV6586.html',
  'SharedDashboardLayoutEditorV6593.html',
  'SharedVisualFitControllerV6617.html',
  'SharedFooter.html'
];

requiredRuntimeFiles.forEach(parseHtmlScripts);

const index = read('Index.html');
const includes = [...index.matchAll(/includeDashboardFile\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)].map(match => match[1]);
const missingIncludes = [...new Set(includes)].filter(name => !fs.existsSync(path.join(root, `${name}.html`)));
assert(missingIncludes.length === 0, `Index include target(s) missing: ${missingIncludes.join(', ')}`);

function indexOfInclude(name) {
  return index.indexOf(`includeDashboardFile('${name}'`);
}

const sharedFilterPos = indexOfInclude('SharedFilterBar');
const dashboardMainPos = indexOfInclude('DashboardMainScript');
const clientBootPos = indexOfInclude('DashboardClientBootRuntime');
const shellNavigationPos = indexOfInclude('DashboardShellNavigationRuntime');
const support01Pos = indexOfInclude('DashboardSupportScript01');
const remakeAdapterPos = indexOfInclude('RemakeSharedFilterAdapterV6646');
const tatControllerPos = indexOfInclude('TatDashboardControllerScript');
const tatAdapterPos = indexOfInclude('TatSharedFilterAdapterV6646');
assert(sharedFilterPos >= 0, 'Index is missing SharedFilterBar include.');
assert(dashboardMainPos >= 0, 'Index is missing DashboardMainScript include.');
assert(clientBootPos > dashboardMainPos, 'DashboardClientBootRuntime must load after DashboardMainScript.');
assert(shellNavigationPos > clientBootPos, 'DashboardShellNavigationRuntime must load after DashboardClientBootRuntime.');
assert(support01Pos > shellNavigationPos, 'DashboardSupportScript01 must load after the semantic shell runtime owners.');
assert(remakeAdapterPos > sharedFilterPos, 'Remake shared-filter adapter must load after SharedFilterBar.');
assert(tatControllerPos >= 0, 'Index is missing TAT controller include.');
assert(tatAdapterPos > tatControllerPos, 'TAT shared-filter adapter must load after the TAT controller.');

const remakeAdapter = read('RemakeSharedFilterAdapterV6646.html');
const tatAdapter = read('TatSharedFilterAdapterV6646.html');
const tatController = read('TatDashboardControllerScript.html');
assert(remakeAdapter.includes('cdaSharedFilterActiveV6646'), 'Remake shared-filter mount guard is missing.');
assert(remakeAdapter.includes('getPopulationKeys'), 'Remake linked-inventory adapter contract is missing.');
assert(remakeAdapter.includes('commitEffectiveSelectionV6389'), 'Remake adapter is not using the established effective-selection commit path.');
assert(remakeAdapter.includes('persistUiV6230'), 'Remake adapter is not preserving established persistence.');
assert(tatAdapter.includes('cdaSharedFilterActiveV6646'), 'TAT shared-filter mount guard is missing.');
assert(tatAdapter.includes('getPopulationKeys'), 'TAT linked-inventory adapter contract is missing.');
assert(tatController.includes('window.cdaTatFilterBridgeV6646'), 'TAT shared-filter bridge is missing.');
assert(tatController.includes("window.loadRemakeFactorData(false)"), 'TAT controller is missing direct Remake initialization for the no-legacy-router path.');
const claspIgnore = read('.claspignore');
assert(claspIgnore.includes('LegacyDashboardRuntime.html'), '.claspignore is missing the retired legacy parent exclusion.');
assert(claspIgnore.includes('LegacyOverviewRuntimeSegment*.html'), '.claspignore is missing the retired legacy segment exclusion.');

const mainVerification = composedDashboardMainVerification();
const duplicateReport = read('docs/DASHBOARD-MAIN-DUPLICATE-CLEANUP-2026-08-21.json');
if (duplicateReport) {
  try {
    const report = JSON.parse(duplicateReport);
    const mainSha = sha256(mainVerification.text);
    assert(report.remainingTopLevelDuplicateFunctionNames === 0, 'Duplicate-cleanup report does not show zero remaining duplicate top-level functions.');

    const overviewJsReportText = readOptional('docs/OVERVIEW-JS-ARCHIVE-REMOVAL-2026-08-21.json');
    if (overviewJsReportText) {
      try {
        const overviewReport = JSON.parse(overviewJsReportText);
        assert(overviewReport.sourceSha256Before === report.sourceSha256After, 'Overview JS cleanup did not start from the verified duplicate-cleanup DashboardMain baseline.');
        assert(overviewReport.sourceSha256After === mainSha, 'Composed DashboardMain has changed since the Overview JS cleanup report; rerun ownership audit before deleting more legacy functions.');
        assert(overviewReport.remainingTopLevelDuplicateFunctionNames === 0, 'Overview JS cleanup report does not show zero remaining duplicate top-level functions.');
        assert(overviewReport.archiveByteForByteVerified === true, 'Overview JS cleanup archive was not byte-for-byte verified.');
        notes.push(`DashboardMain Overview JS checkpoint verified: ${overviewReport.removedFunctionCount} functions removed.`);
      } catch (error) {
        failures.push(`Overview JS cleanup report could not be validated: ${error.message}`);
      }
    } else {
      assert(report.sourceSha256After === mainSha, 'Composed DashboardMain has changed since the duplicate-cleanup report; rerun duplicate ownership audit before deleting more legacy functions.');
    }

    notes.push(`DashboardMain verified runtime bytes: ${Buffer.byteLength(mainVerification.text, 'utf8').toLocaleString()}`);
  } catch (error) {
    failures.push(`Duplicate cleanup report could not be validated: ${error.message}`);
  }
}

notes.push(`Index bytes: ${Buffer.byteLength(index, 'utf8').toLocaleString()}`);
notes.push(`Index includes: ${includes.length}`);
notes.push('Shared-filter adapters: Remake + TAT present with legacy fallback guards.');

if (failures.length) {
  failures.forEach(item => console.error(`ERROR: ${item}`));
  process.exit(1);
}

console.log('Cleanup checkpoint structural validation passed.');
notes.forEach(item => console.log(`PASS: ${item}`));
