#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('ERROR: ' + message);
  process.exit(1);
}
function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) fail('Missing required file: ' + file);
  return fs.readFileSync(full, 'utf8');
}
function readOptional(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
function count(text, token) {
  return text.split(token).length - 1;
}

function expandReport(baseText, report, label) {
  const archive = read(report.archivePath);
  const parent = report.parentModule || null;
  if (!parent || !parent.name || !parent.path) fail(label + ': missing parentModule metadata.');
  let parentContent = read(parent.path);
  if (Buffer.byteLength(parentContent, 'utf8') > Number(report.maxModuleBytes || 75000)) fail(parent.name + ': parent exceeds semantic-module byte limit.');
  if (sha256(parentContent) !== parent.sha256) fail(parent.name + ': parent SHA-256 no longer matches report.');

  const modules = Array.isArray(report.modules) ? report.modules : [];
  if (!modules.length) fail(label + ': report has no child modules.');
  modules.forEach(function(module) {
    const content = read(module.path);
    const directive = "<?!= includeDashboardFile('" + module.name + "') ?>";
    if (count(parentContent, directive) !== 1) fail(module.name + ': expected exactly one parent include directive.');
    if (Buffer.byteLength(content, 'utf8') > Number(report.maxModuleBytes || 75000)) fail(module.name + ': exceeds semantic-module byte limit.');
    if (sha256(content) !== module.sha256) fail(module.name + ': SHA-256 no longer matches report.');
    if (module.rawJavaScriptFragment === true) {
      try { new vm.Script(content, { filename: module.path }); }
      catch (error) { fail(module.name + ': raw JavaScript fragment no longer parses: ' + error.message); }
    }
    parentContent = parentContent.replace(directive, content);
  });

  const parentDirective = "<?!= includeDashboardFile('" + parent.name + "') ?>";
  if (count(baseText, parentDirective) !== 1) fail(parent.name + ': expected exactly one parent include directive in current composition.');
  const reconstructed = baseText.replace(parentDirective, parentContent);
  if (reconstructed !== archive) fail(label + ': reconstruction is not byte-for-byte identical to archived outgoing runtime.');
  if (sha256(reconstructed) !== report.sourceSha256Before) fail(label + ': composed SHA-256 does not match pre-extraction source.');
  if (Buffer.byteLength(reconstructed, 'utf8') !== report.sourceBytesBefore) fail(label + ': composed byte count does not match pre-extraction source.');
  if (sha256(baseText) !== report.sourceSha256After) fail(label + ': current composition SHA-256 no longer matches report.');
  console.log('PASS: ' + label + ' -> ' + parent.name + ' + ' + modules.length + ' child modules.');
  return reconstructed;
}

let reconstructed = read('DashboardMainScript.html');
let layerCount = 0;

const legacyText = readOptional('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json');
if (legacyText) {
  let report;
  try { report = JSON.parse(legacyText); } catch (error) { fail('Could not parse legacy DashboardMain report: ' + error.message); }
  reconstructed = expandReport(reconstructed, report, 'legacy dashboard layer');
  layerCount += 1;
}

const remakeText = readOptional('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json');
if (remakeText) {
  let report;
  try { report = JSON.parse(remakeText); } catch (error) { fail('Could not parse Remake DashboardMain report: ' + error.message); }
  reconstructed = expandReport(reconstructed, report, 'Remake runtime layer');
  layerCount += 1;
}

if (!layerCount) {
  console.log('DashboardMain semantic extraction reports not present; composition validation not required yet.');
  process.exit(0);
}

const prepared = reconstructed.replace(/<\?[!=]?[\s\S]*?\?>/g, 'null');
const scriptMatch = prepared.match(/^<script>([\s\S]*)<\/script>\s*$/i);
if (!scriptMatch) fail('Fully composed DashboardMain lost its outer script boundary.');
try { new vm.Script(scriptMatch[1], { filename: 'DashboardMainScript.fully-composed.html' }); }
catch (error) { fail('Fully composed DashboardMain no longer parses: ' + error.message); }

console.log('DashboardMain chained composition validation passed.');
console.log('PASS: ' + layerCount + ' extraction layer(s) recursively reconstruct and parse.');
console.log('PASS: fully composed runtime bytes: ' + Buffer.byteLength(reconstructed, 'utf8').toLocaleString());
