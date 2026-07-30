#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredVersion = 'v6.558';

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

const requiredIncludes = [
  'SharedDashboardIsolationV6555','SharedDashboardPopoutV6548','SharedDashboardTitleToggleV6555',
  'SharedDashboardInteractionAuditV6557','RemakeDashboardAdapterV6548','TatDashboardAdapterV6547',
  'TatDashboardBootstrapV6547','RemakeDashboardBootstrapV6548'
];
requiredIncludes.forEach(name => {
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
requireBefore('SharedDashboardToolbarV6548','SharedDashboardIsolationV6555');

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
const toolbar = read('SharedDashboardToolbarV6548.html');
const popover = read('SharedDashboardPopoverV6547.html');
const columns = read('SharedDashboardColumnsV6548.html');
const features = read('SharedDashboardFeaturesV6547.html');
const decorator = read('SharedDashboardDecoratorV6548.html');
const interactionAudit = read('SharedDashboardInteractionAuditV6557.html');
const remakeAdapter = read('RemakeDashboardAdapterV6548.html');
const tatAdapter = read('TatDashboardAdapterV6547.html');
const remakeBootstrap = read('RemakeDashboardBootstrapV6548.html');
const tatBootstrap = read('TatDashboardBootstrapV6547.html');

validateHtml('SharedFooter.html', footer);
try {
  new vm.Script(router, {filename:'Code.js'});
} catch (error) {
  fail(error.message);
}

if (!footer.includes("'v6.558'")) fail('SharedFooter.html is not v6.558.');
if (!footer.includes('DETACHED-LIVE-COMPONENTS-10')) fail('SharedFooter build label is incorrect.');
if (!router.includes("'v6.558'")) fail('Code.js is not v6.558.');

if (!isolation.includes("version:'v6.558'")) fail('Isolation service is not v6.558.');
if (!isolation.includes("mode:'detached-live-component'")) fail('Isolation mode is incorrect.');
if (!isolation.includes('popup.document.adoptNode(card)')) fail('Isolation does not move the actual card node.');
if (!isolation.includes('placeholder.replaceWith(session.card)')) fail('Isolation does not restore the actual card node.');
if (!isolation.includes('bridgeSharedEventsV6558(popup)')) fail('Isolation lacks shared event bridging.');
if (!isolation.includes("window.open('',popupName")) fail('Isolation does not use a same-origin blank popup.');
if (!isolation.includes('card:cardV6558')) fail('Isolation does not expose active detached card lookup.');
['buildUrl','frameUrlFrom','hashRoute','userCodeAppPanel','toBase64Image','toDataURL','outerHTML'].forEach(marker => {
  if (isolation.includes(marker)) fail('Obsolete pop-out marker remains: ' + marker);
});

if (!popout.includes("version:'v6.558'")) fail('Pop-out facade is not v6.558.');
if (!popout.includes("mode:'detached-live-component'")) fail('Pop-out facade mode is incorrect.');

if (!toolbar.includes("version:'v6.558'")) fail('Toolbar is not v6.558.');
if (!toolbar.includes('button.ownerDocument')) fail('Toolbar does not carry ownerDocument.');
if (!toolbar.includes('card:card')) fail('Toolbar context does not carry the clicked card.');

if (!popover.includes("version:'v6.558'")) fail('Popover is not v6.558.');
if (!popover.includes('const doc = button.ownerDocument || document')) {
  fail('Popover does not open in the clicked document.');
}
if (!popover.includes('activeDocument:function(){ return activeDocument; }')) {
  fail('Popover does not expose active document ownership.');
}

if (!columns.includes("version:'v6.558'")) fail('Columns is not v6.558.');
if (!columns.includes('function documentFor(context)')) fail('Columns lacks document resolution.');
if (!columns.includes('resolveTable(id,context)')) fail('Columns table lookup is not context-aware.');
if (!columns.includes('const doc = panel.ownerDocument || documentFor(context)')) {
  fail('Columns chooser is not built in the active document.');
}
if (columns.includes('const node = document.getElementById(id)')) {
  fail('Columns still hardcodes original-document table lookup.');
}

if (!features.includes("CDA_DASHBOARD_FEATURES_VERSION = 'v6.558'")) {
  fail('Shared feature catalog is not v6.558.');
}
if (!features.includes('const doc = popover.ownerDocument || context.document || document')) {
  fail('More-actions menu is not document-aware.');
}

if (!decorator.includes("version:'v6.558'")) fail('Decorator is not v6.558.');
if (!decorator.includes('if (titleToggle && !nativeTitle)')) {
  fail('Decorator does not respect native title ownership.');
}

if (!remakeAdapter.includes("version:'v6.558'")) fail('Remake adapter is not v6.558.');
if (!remakeAdapter.includes('nativeTitleToggle:true')) fail('Remake native title ownership is missing.');
if (!remakeAdapter.includes("header.querySelector('.remakeCardActionsV6230')")) {
  fail('Remake toolbar does not reuse the native action host.');
}
if (!remakeAdapter.includes("data-cda-dashboard-shared-host','native-remake-actions'")) {
  fail('Native Remake action-host marker is missing.');
}
if (remakeAdapter.includes("header.querySelector(':scope > .cdaDashboardDecoratedActionsV6548')")) {
  fail('Separate Remake action host remains active.');
}
if (!remakeAdapter.includes('installNativeCollapseBridgeV6558')) {
  fail('Remake detached native-collapse bridge is missing.');
}
if (!remakeAdapter.includes('isolation.card(componentId)')) {
  fail('Remake detached collapse cannot find the active card.');
}
if (!remakeAdapter.includes('context && context.card || bridge.card(component)')) {
  fail('Remake actions do not prefer the clicked card.');
}

if (!tatAdapter.includes("version:'v6.558'")) fail('TAT adapter is not v6.558.');
if (!tatAdapter.includes('const doc = popover.ownerDocument || context.document || document')) {
  fail('TAT chart-series chooser is not document-aware.');
}
if (!tatAdapter.includes('applyDetachedCollapseV6547(context)')) {
  fail('TAT detached collapse synchronization is missing.');
}

const relevantSelectorBlock = remakeBootstrap.match(/function relevantNodeV6558[\s\S]*?\n  }/)?.[0] || '';
if (!relevantSelectorBlock || relevantSelectorBlock.includes('.remakeCardTitle')) {
  fail('Remake bootstrap still watches title mutations.');
}
if (!remakeBootstrap.includes("version:'v6.558'")) fail('Remake bootstrap is not v6.558.');
if (!tatBootstrap.includes("version:'v6.558'")) fail('TAT bootstrap is not v6.558.');
if (!remakeBootstrap.includes("sharedColumns:window.cdaDashboardColumnsV6548 && window.cdaDashboardColumnsV6548.version === 'v6.558'")) {
  fail('Remake bootstrap expects the wrong Columns version.');
}
if (!tatBootstrap.includes("adapter:window.cdaTatDashboardAdapterV6547 && window.cdaTatDashboardAdapterV6547.version === 'v6.558'")) {
  fail('TAT bootstrap expects the wrong adapter version.');
}

if (!interactionAudit.includes("version:'v6.558'")) fail('Interaction audit is not v6.558.');
if (!interactionAudit.includes('remakeActionHosts')) fail('Interaction audit lacks native Remake host checks.');
if (!interactionAudit.includes('titleOwnership')) fail('Interaction audit lacks title ownership checks.');
if (!interactionAudit.includes('detachedLivePopout')) fail('Interaction audit lacks detached pop-out checks.');
if (!interactionAudit.includes('documentAwareColumns')) fail('Interaction audit lacks document-aware Columns checks.');
if (!interactionAudit.includes('tatDetachedCollapse')) fail('Interaction audit lacks TAT detached collapse checks.');
if (!interactionAudit.includes('remakeDetachedCollapse')) fail('Interaction audit lacks Remake detached collapse checks.');

if (!process.exitCode) {
  try {
    childProcess.execFileSync(process.execPath, [
      path.join(root, 'scripts', 'test-dashboard-runtime-contracts.js')
    ], {
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
  console.log('Actual live card detach and restore: passed');
  console.log('Document-aware toolbar, popover, Columns, and More menu: passed');
  console.log('Native Remake header and detached collapse ownership: passed');
  console.log('TAT detached chart controls and collapse: passed');
  console.log('No Remake title mutation loop: passed');
  console.log('Static snapshot and URL-route guards: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
