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
  'SharedDashboardInteractionAuditV6557','RemakeDashboardAdapterV6548','TatDashboardBootstrapV6547',
  'RemakeDashboardBootstrapV6548'
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
const decorator = read('SharedDashboardDecoratorV6548.html');
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

if (!footer.includes("'v6.558'")) fail('SharedFooter.html is not v6.558.');
if (!footer.includes('DETACHED-LIVE-COMPONENTS-10')) fail('SharedFooter build label is incorrect.');
if (!router.includes("'v6.558'")) fail('Code.js is not v6.558.');

if (!isolation.includes("version:'v6.558'")) fail('Isolation service is not v6.558.');
if (!isolation.includes("mode:'detached-live-component'")) fail('Isolation mode is incorrect.');
if (!isolation.includes('popup.document.adoptNode(card)')) fail('Isolation does not move the actual card node.');
if (!isolation.includes('placeholder.replaceWith(session.card)')) fail('Isolation does not restore the actual card node.');
if (!isolation.includes('bridgeSharedEventsV6558(popup)')) fail('Isolation lacks shared event bridging.');
if (!isolation.includes("window.open('',popupName")) fail('Isolation does not use a same-origin blank popup.');
['buildUrl','frameUrlFrom','hashRoute','userCodeAppPanel','toBase64Image','toDataURL','outerHTML'].forEach(marker => {
  if (isolation.includes(marker)) fail('Obsolete pop-out marker remains: ' + marker);
});

if (!popout.includes("version:'v6.558'")) fail('Pop-out facade is not v6.558.');
if (!popout.includes("mode:'detached-live-component'")) fail('Pop-out facade mode is incorrect.');

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

const relevantSelectorBlock = remakeBootstrap.match(/function relevantNodeV6558[\s\S]*?\n  }/)?.[0] || '';
if (!relevantSelectorBlock || relevantSelectorBlock.includes('.remakeCardTitle')) {
  fail('Remake bootstrap still watches title mutations.');
}
if (!remakeBootstrap.includes("version:'v6.558'")) fail('Remake bootstrap is not v6.558.');
if (!tatBootstrap.includes("version:'v6.558'")) fail('TAT bootstrap is not v6.558.');

if (!interactionAudit.includes("version:'v6.558'")) fail('Interaction audit is not v6.558.');
if (!interactionAudit.includes('remakeActionHosts')) fail('Interaction audit lacks native Remake host checks.');
if (!interactionAudit.includes('titleOwnership')) fail('Interaction audit lacks title ownership checks.');
if (!interactionAudit.includes('detachedLivePopout')) fail('Interaction audit lacks detached pop-out checks.');

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
  console.log('Native Remake header ownership: passed');
  console.log('No Remake title mutation loop: passed');
  console.log('Static snapshot and URL-route guards: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
