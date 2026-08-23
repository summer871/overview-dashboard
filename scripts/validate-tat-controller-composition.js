#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'docs/TAT-CONTROLLER-RENDER-EXTRACTION-2026-08-23.json');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  const header = Buffer.from('blob ' + body.length + '\0', 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header, body])).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(fs.existsSync(reportPath), 'Missing TAT render extraction report.');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const parent = read(report.parent.path);
const child = read(report.child.path);
const archive = read(report.archive.path);
const directive = report.includeDirective;

assert(parent.split(directive).length - 1 === 1, 'TAT render include directive must occur exactly once in the parent.');
assert(Buffer.byteLength(parent, 'utf8') === report.parent.bytes, 'TAT parent byte count changed.');
assert(Buffer.byteLength(child, 'utf8') === report.child.bytes, 'TAT render child byte count changed.');
assert(sha256(parent) === report.parent.sha256, 'TAT parent SHA-256 changed.');
assert(sha256(child) === report.child.sha256, 'TAT render child SHA-256 changed.');
assert(sha256(archive) === report.archive.sha256, 'Archived pre-split TAT controller SHA-256 changed.');
assert(Buffer.byteLength(parent, 'utf8') <= report.maxModuleBytes, 'TAT parent exceeds semantic-module target.');
assert(Buffer.byteLength(child, 'utf8') <= report.maxModuleBytes, 'TAT render child exceeds semantic-module target.');

const reconstructed = parent.replace(directive, child);
assert(reconstructed === archive, 'TAT parent + render child is not byte-for-byte identical to the pre-split controller.');
assert(Buffer.byteLength(reconstructed, 'utf8') === report.source.bytes, 'Reconstructed TAT controller byte count changed.');
assert(sha256(reconstructed) === report.source.sha256, 'Reconstructed TAT controller SHA-256 changed.');
assert(gitBlobSha(reconstructed) === report.source.gitBlobSha, 'Reconstructed TAT controller Git blob SHA changed.');

new vm.Script(child, { filename: report.child.path });
const scriptMatch = reconstructed.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
assert(scriptMatch, 'Reconstructed TAT controller script block is missing.');
new vm.Script(scriptMatch[1], { filename: 'TatDashboardControllerScript.reconstructed.js' });

assert(child.startsWith('  function destroyChart(name)'), 'TAT render child no longer starts at destroyChart(name).');
assert(child.includes('  function renderAll(){'), 'TAT render child is missing renderAll().');
assert(!parent.includes('  function destroyChart(name)'), 'TAT parent still owns destroyChart(name).');
assert(!parent.includes('  function renderAll(){'), 'TAT parent still owns renderAll().');

console.log('TAT controller semantic composition passed.');
console.log('Parent bytes:', Buffer.byteLength(parent, 'utf8'));
console.log('Render child bytes:', Buffer.byteLength(child, 'utf8'));
console.log('Reconstructed Git blob:', gitBlobSha(reconstructed));
