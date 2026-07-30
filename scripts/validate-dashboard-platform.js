#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredVersion = 'v6.559';

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
  if (count(text, /<script\b/gi) !== count(text, /<\/script>/gi)) {
    fail(fileName + ' has mismatched script tags.');
  }
  if (count(text, /<style\b/gi) !== count(text, /<\/style>/gi)) {
    fail(fileName + ' has mismatched style tags.');
  }
  Array.from(text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).forEach((match, index) => {
    try {
      new vm.Script(match[1], {filename:fileName + '#script-' + (index + 1)});
    } catch (error) {
      fail(error.message);
    }
  });
}

const foundation = read('SharedComponentFoundation.html');
if (!foundation.includes(requiredVersion)) {
  fail('SharedComponentFoundation.html is not ' + requiredVersion + '.');
}

const includes = Array.from(
  foundation.matchAll(/includeDashboardFile\(['"]([A-Za-z0-9_-]+)['"]\)/g)
).map(match => match[1]);

[
  'SharedDashboardIsolationV6555','SharedDashboardPopoutV6548','SharedDashboardTitleToggleV6555',
  'SharedDashboardInteractionAuditV6557','RemakeDashboardLegacyBridgeV6554',
  'RemakeDashboardAdapterV6548','TatDashboardAdapterV6547',
  'TatDashboardBootstrapV6547','RemakeDashboardBootstrapV6548'
].forEach(name => {
  if (!includes.includes(name)) fail('Missing required include: ' + name);
});

const duplicateIncludes = includes.filter((name, index) => includes.indexOf(name) !== index);
if (duplicateIncludes.length) {
  fail('Duplicate includes: ' + Array.from(new Set(duplicateIncludes)).join(', '));
}

function requireBefore(first, second) {
  if (includes.indexOf(first) < 0 || includes.indexOf(second) < 0 ||
      includes.indexOf(first) >= includes.indexOf(second)) {
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
const bridge = read('RemakeDashboardLegacyBridgeV6554.html');
const toolbar = read('SharedDashboardToolbarV6548.html');
const popover = read('SharedDashboardPopoverV6547.html');
const columns = read('SharedDashboardColumnsV6548.html');
const interactionAudit = read('SharedDashboardInteractionAuditV6557.html');
const remakeAdapter = read('RemakeDashboardAdapterV6548.html');
const tatAdapter = read('TatDashboardAdapterV6547.html');
const remakeBootstrap = read('RemakeDashboardBootstrapV6548.html');
const tatBootstrap = read('TatDashboardBootstrapV6547.html');

validateHtml('SharedFooter.html', footer);
try { new vm.Script(router, {filename:'Code.js'}); }
catch (error) { fail(error.message); }

if (!footer.includes("'v6.559'")) fail('SharedFooter.html is not v6.559.');
if (!footer.includes('NORMALIZED-LIVE-POPOUTS-11')) fail('SharedFooter build label is incorrect.');
if (!router.includes("'v6.559'")) fail('Code.js is not v6.559.');

if (!isolation.includes("version:'v6.559'")) fail('Isolation service is not v6.559.');
if (!isolation.includes("mode:'detached-live-component'")) fail('Isolation mode is incorrect.');
if (!isolation.includes('popup.document.adoptNode(card)')) fail('Isolation does not move the actual card node.');
if (!isolation.includes('placeholder.replaceWith(session.card)')) fail('Isolation does not restore the actual card node.');
if (!isolation.includes('const wasCollapsed = collapsedV6559(context,card)')) {
  fail('Isolation does not detect collapsed cards.');
}
if (!isolation.includes('if (wasCollapsed) toggleCollapseV6559(context,card)')) {
  fail('Collapsed cards are not expanded before pop-out.');
}
if (!isolation.includes('restoreOriginalCollapseV6559(session)')) {
  fail('Original collapsed state is not restored.');
}
if (!isolation.includes('grid-column:1 / -1!important')) {
  fail('Detached card does not force full grid width.');
}
if (!isolation.includes('width:100%!important;max-width:none!important')) {
  fail('Detached content is not normalized to full width.');
}
['buildUrl','frameUrlFrom','hashRoute','userCodeAppPanel','toBase64Image','toDataURL','outerHTML'].forEach(marker => {
  if (isolation.includes(marker)) fail('Obsolete pop-out marker remains: ' + marker);
});

if (!popout.includes("version:'v6.559'")) fail('Pop-out facade is not v6.559.');
if (!bridge.includes("version:'v6.559'")) fail('Remake bridge is not v6.559.');
if (!bridge.includes("if (button.matches('[data-remake-section-toggle-v6402]')) return '';")) {
  fail('Native Remake collapse buttons are still classified as legacy controls.');
}
if (!bridge.includes('restoreNativeCollapseControlsV6559')) {
  fail('Native Remake chevron restoration is missing.');
}

if (!toolbar.includes("version:'v6.558'")) fail('Toolbar is not v6.558.');
if (!popover.includes("version:'v6.558'")) fail('Popover is not v6.558.');
if (!columns.includes("version:'v6.558'")) fail('Columns is not v6.558.');
if (!columns.includes('function documentFor(context)')) fail('Columns lacks document resolution.');

if (!remakeAdapter.includes("version:'v6.558'")) fail('Remake adapter is not v6.558.');
if (!remakeAdapter.includes('nativeTitleToggle:true')) fail('Remake native title ownership is missing.');
if (!remakeAdapter.includes('installNativeCollapseBridgeV6558')) {
  fail('Remake detached native-collapse bridge is missing.');
}
if (!tatAdapter.includes("version:'v6.558'")) fail('TAT adapter is not v6.558.');
if (!tatAdapter.includes('applyDetachedCollapseV6547(context)')) {
  fail('TAT detached collapse synchronization is missing.');
}

const relevantSelectorBlock = remakeBootstrap.match(/function relevantNodeV6559[\s\S]*?\n  }/)?.[0] || '';
if (!relevantSelectorBlock || relevantSelectorBlock.includes('.remakeCardTitle')) {
  fail('Remake bootstrap still watches title mutations.');
}
if (!remakeBootstrap.includes("version:'v6.559'")) fail('Remake bootstrap is not v6.559.');
if (!tatBootstrap.includes("version:'v6.559'")) fail('TAT bootstrap is not v6.559.');
if (!remakeBootstrap.includes("bridge:bridge.version === 'v6.559'")) {
  fail('Remake bootstrap expects the wrong bridge version.');
}
if (!tatBootstrap.includes("componentIsolation:window.cdaDashboardIsolationV6555 && window.cdaDashboardIsolationV6555.version === 'v6.559'")) {
  fail('TAT bootstrap expects the wrong isolation version.');
}

if (!interactionAudit.includes("version:'v6.559'")) fail('Interaction audit is not v6.559.');
if (!interactionAudit.includes('visibleNativeButtonCount')) {
  fail('Interaction audit does not verify visible native Remake chevrons.');
}
if (!interactionAudit.includes('normalizedLayout')) {
  fail('Interaction audit lacks normalized detached-layout checks.');
}

if (!process.exitCode) {
  try {
    childProcess.execFileSync(process.execPath, [
      path.join(root, 'scripts', 'test-dashboard-runtime-contracts.js')
    ], {cwd:root,stdio:'inherit'});
  } catch (error) {
    fail('Dashboard runtime contracts failed.');
  }
}

if (!process.exitCode) {
  console.log('Dashboard platform validation passed.');
  console.log('Version: ' + requiredVersion);
  console.log('Full-width detached layout: passed');
  console.log('Collapsed-card temporary expansion and restoration: passed');
  console.log('Visible native Remake chevron ownership: passed');
  console.log('Actual live card detach and restore: passed');
  console.log('Document-aware shared controls: passed');
  console.log('No Remake title mutation loop: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
