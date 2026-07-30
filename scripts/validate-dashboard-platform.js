#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredVersion = 'v6.557';

function fail(message) {
  console.error('ERROR: ' + message);
  process.exitCode = 1;
}

function read(fileName) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) {
    fail('Missing file: ' + fileName);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function count(text, regex) {
  return (text.match(regex) || []).length;
}

function validateHtml(fileName, text) {
  if (count(text, /<script\b/gi) !== count(text, /<\/script>/gi)) fail(fileName + ' has mismatched script tags.');
  if (count(text, /<style\b/gi) !== count(text, /<\/style>/gi)) fail(fileName + ' has mismatched style tags.');
  Array.from(text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).forEach((match, index) => {
    try {
      new vm.Script(match[1], {filename:fileName + '#script-' + (index + 1)});
    } catch (error) {
      fail(error.message);
    }
  });
}

const foundation = read('SharedComponentFoundation.html');
if (!foundation.includes(requiredVersion)) fail('SharedComponentFoundation.html is not ' + requiredVersion + '.');

const includes = Array.from(
  foundation.matchAll(/includeDashboardFile\(['"]([A-Za-z0-9_-]+)['"]\)/g)
).map(match => match[1]);

const requiredIncludes = [
  'SharedDashboardIsolationV6555','SharedDashboardPopoutV6548','SharedDashboardTitleToggleV6555',
  'SharedDashboardInteractionAuditV6557','RemakeDashboardAdapterV6548','TatDashboardBootstrapV6547',
  'RemakeDashboardBootstrapV6548'
];
requiredIncludes.forEach(name => {
  if (!includes.includes(name)) fail('Missing required include: ' + name);
});

const duplicateIncludes = includes.filter((name, index) => includes.indexOf(name) !== index);
if (duplicateIncludes.length) fail('Duplicate includes: ' + Array.from(new Set(duplicateIncludes)).join(', '));

function requireBefore(first, second) {
  if (includes.indexOf(first) < 0 || includes.indexOf(second) < 0 || includes.indexOf(first) >= includes.indexOf(second)) {
    fail(first + ' must load before ' + second + '.');
  }
}
requireBefore('SharedDashboardIsolationV6555','SharedDashboardPopoutV6548');
requireBefore('SharedDashboardAuditV6550','SharedDashboardInteractionAuditV6557');
requireBefore('SharedDashboardInteractionAuditV6557','TatDashboardBootstrapV6547');
requireBefore('SharedDashboardInteractionAuditV6557','RemakeDashboardBootstrapV6548');
requireBefore('RemakeDashboardLegacyBridgeV6554','RemakeDashboardAdapterV6548');

includes.forEach(name => {
  const fileName = name + '.html';
  const text = read(fileName);
  validateHtml(fileName, text);
  if (text.includes('Bolean')) fail(fileName + ' contains Bolean.');
});

const footer = read('SharedFooter.html');
const router = read('Code.js');
const isolation = read('SharedDashboardIsolationV6555.html');
const popout = read('SharedDashboardPopoutV6548.html');
const titleToggle = read('SharedDashboardTitleToggleV6555.html');
const interactionAudit = read('SharedDashboardInteractionAuditV6557.html');
const remakeAdapter = read('RemakeDashboardAdapterV6548.html');
const remakeBootstrap = read('RemakeDashboardBootstrapV6548.html');
const tatBootstrap = read('TatDashboardBootstrapV6547.html');

validateHtml('SharedFooter.html', footer);
try {
  new vm.Script(router, {filename:'Code.js'});
} catch (error) {
  fail(error.message);
}

if (!footer.includes("'v6.557'")) fail('SharedFooter.html is not v6.557.');
if (!footer.includes('SHARED-INTERACTION-RECOVERY-09')) fail('SharedFooter build label is incorrect.');
if (!router.includes("'v6.557'")) fail('Code.js is not v6.557.');

if (!isolation.includes("version:'v6.557'")) fail('Isolation service is not v6.557.');
if (!isolation.includes("mode:'same-build-live-component'")) fail('Isolation mode is incorrect.');
if (!isolation.includes('frameUrlFrom')) fail('Isolation lacks current-frame URL fallback.');
if (!isolation.includes("url.hash=hashParams.toString()")) fail('Isolation lacks hash routing for frame URLs.');
if (!isolation.includes('hashRoute')) fail('Isolation cannot read client-side component routes.');
if (!isolation.includes("window.open('about:blank'")) fail('Isolation does not reserve a popup synchronously.');
if (!isolation.includes('lastAttemptV6557')) fail('Isolation launch diagnostics are missing.');

if (!popout.includes("version:'v6.557'")) fail('Pop-out facade is not v6.557.');
if (!popout.includes("mode:'same-build-live-component'")) fail('Pop-out facade mode is incorrect.');
['toBase64Image','toDataURL','outerHTML','documentHtml'].forEach(marker => {
  if (popout.includes(marker)) fail('Pop-out contains static snapshot marker: ' + marker);
});

if (!titleToggle.includes("version:'v6.556'")) fail('Title toggle is not the canonical v6.556 implementation.');
if (!titleToggle.includes('title.replaceChildren(button)')) fail('Title toggle does not replace legacy title content.');
if (!titleToggle.includes('ARROW_REPLACE_PATTERN_V6556')) fail('Title toggle does not remove legacy arrows.');

if (!remakeAdapter.includes("version:'v6.557'")) fail('Remake adapter is not v6.557.');
if (!remakeAdapter.includes("data-cda-dashboard-shared-host','true'")) fail('Remake dedicated shared host marker is missing.');
if (!remakeAdapter.includes("header.querySelector(':scope > .cdaDashboardDecoratedActionsV6548')")) {
  fail('Remake toolbar is not mounted directly under the header.');
}
if (remakeAdapter.includes("header.querySelector('.remakeCardActionsV6230')")) {
  fail('Remake toolbar still uses the legacy action host.');
}
if (!remakeAdapter.includes('pointer-events:auto!important')) fail('Remake shared host does not own pointer events.');

if (!interactionAudit.includes("version:'v6.557'")) fail('Interaction audit is not v6.557.');
if (!interactionAudit.includes('remakePointerHosts')) fail('Interaction audit lacks Remake pointer-host checks.');
if (!interactionAudit.includes('sameBuildPopout')) fail('Interaction audit lacks same-build pop-out checks.');

if (!remakeBootstrap.includes("version:'v6.557'")) fail('Remake bootstrap is not v6.557.');
if (!tatBootstrap.includes("version:'v6.557'")) fail('TAT bootstrap is not v6.557.');

if (!process.exitCode) {
  try {
    childProcess.execFileSync(process.execPath, [path.join(root, 'scripts', 'test-dashboard-runtime-contracts.js')], {
      cwd:root,
      stdio:'inherit'
    });
  } catch (error) {
    fail('Dashboard runtime contracts failed.');
  }
}

if (!process.exitCode) {
  console.log('Dashboard platform validation passed.');
  console.log('Version: ' + requiredVersion);
  console.log('Dedicated Remake shared pointer host: passed');
  console.log('Same-build frame pop-out fallback: passed');
  console.log('Canonical title cleanup: passed');
  console.log('Static snapshot pop-out guard: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
