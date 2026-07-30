#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredVersion = 'v6.556';
const foundationPath = path.join(root, 'SharedComponentFoundation.html');
const blockedReferences = [
  'TatCleanPlatformScriptPart','TatCleanPlatformStylesV6545',
  'SharedTableCardRendererV6544','SharedTableCardRendererV6546',
  'SharedDashboardLiveComponentV6555'
];
const requiredIncludes = [
  'SharedDashboardThemeV6549','SharedDashboardRegistryV6547','SharedDashboardCatalogV6555',
  'SharedDashboardPopoverV6547','SharedDashboardColumnsV6548','SharedDashboardIsolationV6555',
  'SharedDashboardPopoutV6548','SharedDashboardFeaturesV6547','SharedDashboardToolbarV6548',
  'SharedDashboardTitleToggleV6555','SharedDashboardRendererV6547','SharedDashboardDecoratorV6548',
  'SharedDashboardAuditV6550','RemakeDashboardLegacyBridgeV6554','RemakeDashboardAdapterV6548',
  'RemakeDashboardDefinitionV6548','RemakeDashboardBootstrapV6548','TatDashboardAdapterV6547',
  'TatDashboardDefinitionV6547','TatDashboardBindingsV6547','TatDashboardBootstrapV6547'
];

function fail(message) {
  console.error('ERROR: ' + message);
  process.exitCode = 1;
}

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    fail('Missing file: ' + path.relative(root, filePath));
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function count(text, regex) {
  return (text.match(regex) || []).length;
}

function validateHtmlPartial(fileName, text) {
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

const foundation = read(foundationPath);
if (!foundation.includes(requiredVersion)) fail('SharedComponentFoundation.html does not contain ' + requiredVersion + '.');
blockedReferences.forEach(reference => {
  if (foundation.includes(reference)) fail('Active foundation references blocked runtime: ' + reference);
});

const includes = Array.from(
  foundation.matchAll(/includeDashboardFile\(['"]([A-Za-z0-9_-]+)['"]\)/g)
).map(match => match[1]);
if (!includes.length) fail('No active dashboard includes were found.');
const duplicateIncludes = includes.filter((name, index) => includes.indexOf(name) !== index);
if (duplicateIncludes.length) fail('Duplicate active includes: ' + Array.from(new Set(duplicateIncludes)).join(', '));
requiredIncludes.forEach(name => {
  if (!includes.includes(name)) fail('Missing required v6.556 include: ' + name);
});

function requireBefore(first, second) {
  const firstIndex = includes.indexOf(first);
  const secondIndex = includes.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    fail(first + ' must load before ' + second + '.');
  }
}
requireBefore('SharedDashboardRegistryV6547','SharedDashboardCatalogV6555');
requireBefore('SharedDashboardCatalogV6555','SharedDashboardIsolationV6555');
requireBefore('SharedDashboardIsolationV6555','SharedDashboardPopoutV6548');
requireBefore('SharedDashboardTitleToggleV6555','SharedDashboardRendererV6547');
requireBefore('SharedDashboardTitleToggleV6555','SharedDashboardDecoratorV6548');
requireBefore('RemakeDashboardLegacyBridgeV6554','RemakeDashboardAdapterV6548');

includes.forEach(name => {
  const fileName = name + '.html';
  const text = read(path.join(root, fileName));
  validateHtmlPartial(fileName, text);
  if (text.includes('Bolean')) fail(fileName + ' contains the invalid Bolean identifier.');
  blockedReferences.forEach(reference => {
    if (text.includes(reference)) fail(fileName + ' references blocked runtime: ' + reference);
  });
});

const footer = read(path.join(root, 'SharedFooter.html'));
const router = read(path.join(root, 'Code.js'));
const isolation = read(path.join(root, 'SharedDashboardIsolationV6555.html'));
const popout = read(path.join(root, 'SharedDashboardPopoutV6548.html'));
const titleToggle = read(path.join(root, 'SharedDashboardTitleToggleV6555.html'));
const audit = read(path.join(root, 'SharedDashboardAuditV6550.html'));
const remakeBootstrap = read(path.join(root, 'RemakeDashboardBootstrapV6548.html'));
const tatBootstrap = read(path.join(root, 'TatDashboardBootstrapV6547.html'));
const bridge = read(path.join(root, 'RemakeDashboardLegacyBridgeV6554.html'));
const columns = read(path.join(root, 'SharedDashboardColumnsV6548.html'));

validateHtmlPartial('SharedFooter.html', footer);
try {
  new vm.Script(router, {filename:'Code.js'});
} catch (error) {
  fail(error.message);
}

if (!footer.includes("'v6.556'")) fail('SharedFooter.html is not stamped v6.556.');
if (!footer.includes('CANONICAL-TITLES-RELIABLE-POPOUT-08')) fail('SharedFooter.html build label is not v6.556.');
if (!router.includes("'v6.556'")) fail('Code.js is not stamped v6.556.');
if (!router.includes('getDashboardComponentRoute')) fail('Router does not validate component routes.');
if (!router.includes('componentRoute')) fail('Router does not inject the component route.');

if (!isolation.includes("version:'v6.556'")) fail('Isolation service is not stamped v6.556.');
if (!isolation.includes("window.open('about:blank'")) fail('Pop-out does not synchronously reserve a window.');
if (!isolation.includes('popup.location.replace(url)')) fail('Pop-out does not navigate the reserved window.');
if (!isolation.includes('lastAttemptV6556')) fail('Pop-out launch attempts are not observable.');
if (!isolation.includes("reason='popup-blocked'")) fail('Popup-blocked failures are not recorded.');
if (!isolation.includes("reason='web-app-url-unavailable'")) fail('Missing URL failures are not recorded.');
if (!isolation.includes("url.searchParams.set('component'")) fail('Isolation route lacks component identity.');
if (!isolation.includes('catalog.waitFor')) fail('Isolation does not wait for the real component.');

if (!popout.includes("version:'v6.556'")) fail('Pop-out facade is not stamped v6.556.');
if (!popout.includes("mode:'same-application-live-component'")) fail('Pop-out is not marked as live.');
if (!popout.includes('lastAttempt:isolation.lastAttempt')) fail('Pop-out facade does not expose launch diagnostics.');
['toBase64Image','toDataURL','outerHTML','documentHtml'].forEach(marker => {
  if (popout.includes(marker)) fail('Pop-out contains static snapshot marker: ' + marker);
});

if (!titleToggle.includes("version:'v6.556'")) fail('Title toggle is not stamped v6.556.');
if (!titleToggle.includes('canonicalTitle')) fail('Title toggle lacks canonical title ownership.');
if (!titleToggle.includes('title.replaceChildren(button)')) fail('Title toggle does not replace legacy title content.');
if (!titleToggle.includes('cdaDashboardTitleHostV6556::after')) fail('Title toggle does not suppress legacy pseudo arrows.');
if (!titleToggle.includes('textContainsArrow')) fail('Title toggle lacks duplicate-arrow inspection.');

if (!audit.includes("version:'v6.556'")) fail('Shared audit is not stamped v6.556.');
['chevronCount','titleTextContainsArrow','lastAttempt','componentRouteCorrect'].forEach(marker => {
  if (!audit.includes(marker)) fail('Shared audit is missing ' + marker + '.');
});
if (!audit.includes('!!testUrl && componentRouteCorrect')) fail('Shared audit allows an empty pop-out URL.');

if (!remakeBootstrap.includes("version:'v6.556'")) fail('Remake bootstrap is not stamped v6.556.');
if (!remakeBootstrap.includes("componentIsolation:window.cdaDashboardIsolationV6555 && window.cdaDashboardIsolationV6555.version === 'v6.556'")) {
  fail('Remake bootstrap expects the wrong isolation version.');
}
if (!tatBootstrap.includes("version:'v6.556'")) fail('TAT bootstrap is not stamped v6.556.');
if (!tatBootstrap.includes("componentIsolation:window.cdaDashboardIsolationV6555 && window.cdaDashboardIsolationV6555.version === 'v6.556'")) {
  fail('TAT bootstrap expects the wrong isolation version.');
}
if (!bridge.includes("version:'v6.555'")) fail('Remake bridge version changed unexpectedly.');
if (columns.includes('.toggleChooser(')) fail('Columns delegates to the old chooser UI.');

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
  console.log('Canonical single-title-chevron contract: passed');
  console.log('Observable reliable pop-out contract: passed');
  console.log('Static snapshot pop-out guard: passed');
  console.log('Columns regression contracts: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
