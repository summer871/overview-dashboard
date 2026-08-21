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
    const prepared = block.code.replace(/<\?[!=]?[\s\S]*?\?>/g, 'null');
    try {
      new vm.Script(prepared, { filename: `${file}#script${block.index}` });
    } catch (error) {
      failures.push(`${file}#script${block.index}: ${error.message}`);
    }
  });
}

const requiredRuntimeFiles = [
  'Index.html',
  'DashboardMainScript.html',
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
  return index.indexOf(`includeDashboardFile('${name}')`);
}

const sharedFilterPos = indexOfInclude('SharedFilterBar');
const remakeAdapterPos = indexOfInclude('RemakeSharedFilterAdapterV6646');
const tatControllerPos = indexOfInclude('TatDashboardControllerScript');
const tatAdapterPos = indexOfInclude('TatSharedFilterAdapterV6646');
assert(sharedFilterPos >= 0, 'Index is missing SharedFilterBar include.');
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

const duplicateReport = read('docs/DASHBOARD-MAIN-DUPLICATE-CLEANUP-2026-08-21.json');
if (duplicateReport) {
  try {
    const report = JSON.parse(duplicateReport);
    const main = read('DashboardMainScript.html');
    const mainSha = sha256(main);
    assert(report.remainingTopLevelDuplicateFunctionNames === 0, 'Duplicate-cleanup report does not show zero remaining duplicate top-level functions.');

    const overviewJsReportText = readOptional('docs/OVERVIEW-JS-ARCHIVE-REMOVAL-2026-08-21.json');
    if (overviewJsReportText) {
      try {
        const overviewReport = JSON.parse(overviewJsReportText);
        assert(overviewReport.sourceSha256Before === report.sourceSha256After, 'Overview JS cleanup did not start from the verified duplicate-cleanup DashboardMain baseline.');
        assert(overviewReport.sourceSha256After === mainSha, 'DashboardMain has changed since the Overview JS cleanup report; rerun ownership audit before deleting more legacy functions.');
        assert(overviewReport.remainingTopLevelDuplicateFunctionNames === 0, 'Overview JS cleanup report does not show zero remaining duplicate top-level functions.');
        assert(overviewReport.archiveByteForByteVerified === true, 'Overview JS cleanup archive was not byte-for-byte verified.');
        notes.push(`DashboardMain Overview JS checkpoint verified: ${overviewReport.removedFunctionCount} functions removed.`);
      } catch (error) {
        failures.push(`Overview JS cleanup report could not be validated: ${error.message}`);
      }
    } else {
      assert(report.sourceSha256After === mainSha, 'DashboardMain has changed since the duplicate-cleanup report; rerun duplicate ownership audit before deleting more legacy functions.');
    }

    notes.push(`DashboardMain bytes: ${Buffer.byteLength(main, 'utf8').toLocaleString()}`);
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
