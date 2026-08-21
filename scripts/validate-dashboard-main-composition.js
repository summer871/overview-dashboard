#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const reportPath = 'docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json';

function fail(message) {
  console.error('ERROR: ' + message);
  process.exit(1);
}
function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) fail('Missing required file: ' + file);
  return fs.readFileSync(full, 'utf8');
}
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
function count(text, token) {
  return text.split(token).length - 1;
}

if (!fs.existsSync(path.join(root, reportPath))) {
  console.log('DashboardMain semantic extraction report not present; composition validation not required yet.');
  process.exit(0);
}

let report;
try { report = JSON.parse(read(reportPath)); }
catch (error) { fail('Could not parse DashboardMain semantic extraction report: ' + error.message); }

const main = read('DashboardMainScript.html');
const archive = read(report.archivePath);
const parent = report.parentModule || null;
if (!parent || !parent.name || !parent.path) fail('DashboardMain semantic extraction report is missing parentModule metadata.');
const parentContent = read(parent.path);
if (Buffer.byteLength(parentContent, 'utf8') > Number(report.maxModuleBytes || 75000)) fail(parent.name + ': parent module exceeds semantic-module byte limit.');
if (sha256(parentContent) !== parent.sha256) fail(parent.name + ': parent SHA-256 no longer matches extraction report.');

let reconstructedParent = parentContent;
const modules = Array.isArray(report.modules) ? report.modules : [];
if (!modules.length) fail('DashboardMain semantic extraction report has no child modules.');
modules.forEach(function(module) {
  const content = read(module.path);
  const directive = "<?!= includeDashboardFile('" + module.name + "') ?>";
  const occurrences = count(reconstructedParent, directive);
  if (occurrences !== 1) fail(module.name + ': expected exactly one include directive in parent module, found ' + occurrences + '.');
  if (Buffer.byteLength(content, 'utf8') > Number(report.maxModuleBytes || 75000)) fail(module.name + ': exceeds semantic-module byte limit.');
  if (sha256(content) !== module.sha256) fail(module.name + ': module SHA-256 no longer matches extraction report.');
  try { new vm.Script(content, { filename: module.path }); }
  catch (error) { fail(module.name + ': raw JavaScript fragment no longer parses: ' + error.message); }
  reconstructedParent = reconstructedParent.replace(directive, content);
});

const parentDirective = "<?!= includeDashboardFile('" + parent.name + "') ?>";
if (count(main, parentDirective) !== 1) fail(parent.name + ': expected exactly one include directive in DashboardMain.');
let reconstructed = main.replace(parentDirective, reconstructedParent);

if (reconstructed !== archive) fail('Recursively composed DashboardMain is not byte-for-byte identical to the archived outgoing runtime.');
if (sha256(reconstructed) !== report.sourceSha256Before) fail('Composed DashboardMain SHA-256 does not match the verified pre-extraction source.');
if (Buffer.byteLength(reconstructed, 'utf8') !== report.sourceBytesBefore) fail('Composed DashboardMain byte count does not match the verified pre-extraction source.');
if (sha256(main) !== report.sourceSha256After) fail('DashboardMain composition file changed since the semantic extraction report.');

const prepared = reconstructed.replace(/<\?[!=]?[\s\S]*?\?>/g, 'null');
const scriptMatch = prepared.match(/^<script>([\s\S]*)<\/script>\s*$/i);
if (!scriptMatch) fail('Composed DashboardMain lost its outer script boundary.');
try { new vm.Script(scriptMatch[1], { filename: 'DashboardMainScript.composed.html' }); }
catch (error) { fail('Composed DashboardMain no longer parses: ' + error.message); }

console.log('DashboardMain recursive composition validation passed.');
console.log('PASS: composition is byte-for-byte identical to the verified pre-extraction runtime.');
console.log('PASS: parent module ' + parent.name + ' is hash-verified.');
console.log('PASS: ' + modules.length + ' semantic Remake child modules are present, parseable, and hash-verified.');
console.log('PASS: DashboardMain composition bytes: ' + Buffer.byteLength(main, 'utf8').toLocaleString());
