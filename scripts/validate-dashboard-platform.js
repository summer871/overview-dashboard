#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredVersion = 'v6.555';
const foundationPath = path.join(root, 'SharedComponentFoundation.html');
const blockedReferences = [
  'TatCleanPlatformScriptPart','TatCleanPlatformStylesV6545',
  'SharedTableCardRendererV6544','SharedTableCardRendererV6546'
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
  if (foundation.includes(reference)) fail('Active foundation references blocked legacy runtime: ' + reference);
});

const includes = Array.from(
  foundation.matchAll(/includeDashboardFile\(['"]([A-Za-z0-9_-]+)['"]\)/g)
).map(match => match[1]);
if (!includes.length) fail('No active dashboard includes were found.');
const duplicateIncludes = includes.filter((name, index) => includes.indexOf(name) !== index);
if (duplicateIncludes.length) fail('Duplicate active includes: ' + Array.from(new Set(duplicateIncludes)).join(', '));
requiredIncludes.forEach(name => {
  if (!includes.includes(name)) fail('Missing required v6.555 include: ' + name);
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
    if (text.includes(reference)) fail(fileName + ' references blocked legacy runtime: ' + reference);
  });
});

const footer = read(path.join(root, 'SharedFooter.html'));
const router = read(path.join(root, 'Code.js'));
const popout = read(path.join(root, 'SharedDashboardPopoutV6548.html'));
const isolation = read(path.join(root, 'SharedDashboardIsolationV6555.html'));
const catalog = read(path.join(root, 'SharedDashboardCatalogV6555.html'));
const features = read(path.join(root, 'SharedDashboardFeaturesV6547.html'));
const titleToggle = read(path.join(root, 'SharedDashboardTitleToggleV6555.html'));
const renderer = read(path.join(root, 'SharedDashboardRendererV6547.html'));
const decorator = read(path.join(root, 'SharedDashboardDecoratorV6548.html'));
const audit = read(path.join(root, 'SharedDashboardAuditV6550.html'));
const remakeAdapter = read(path.join(root, 'RemakeDashboardAdapterV6548.html'));
const remakeDefinition = read(path.join(root, 'RemakeDashboardDefinitionV6548.html'));
const remakeBootstrap = read(path.join(root, 'RemakeDashboardBootstrapV6548.html'));
const tatAdapter = read(path.join(root, 'TatDashboardAdapterV6547.html'));
const tatDefinition = read(path.join(root, 'TatDashboardDefinitionV6547.html'));
const tatBindings = read(path.join(root, 'TatDashboardBindingsV6547.html'));
const tatBootstrap = read(path.join(root, 'TatDashboardBootstrapV6547.html'));

validateHtmlPartial('SharedFooter.html', footer);
try {
  new vm.Script(router, {filename:'Code.js'});
} catch (error) {
  fail(error.message);
}

if (!footer.includes("'v6.555'")) fail('SharedFooter.html is not stamped v6.555.');
if (!footer.includes('LIVE-COMPONENT-ISOLATION-07')) fail('SharedFooter.html build label is not v6.555.');
if (!router.includes("'v6.555'")) fail('Code.js is not stamped v6.555.');
if (!router.includes('getDashboardComponentRoute')) fail('Router does not validate component routes.');
if (!router.includes('componentRoute')) fail('Router does not inject the component route.');

if (!popout.includes("version:'v6.555'")) fail('Shared pop-out is not stamped v6.555.');
if (!popout.includes("mode:'same-application-live-component'")) fail('Shared pop-out is not a live same-application component.');
['toBase64Image','toDataURL','outerHTML','documentHtml'].forEach(marker => {
  if (popout.includes(marker)) fail('Shared pop-out still contains static snapshot marker: ' + marker);
});
if (!popout.includes('isolation.open(context)')) fail('Shared pop-out does not delegate to isolation.');

if (!isolation.includes("version:'v6.555'")) fail('Component isolation is not stamped v6.555.');
if (!isolation.includes("url.searchParams.set('component'")) fail('Isolation does not route by component identity.');
if (!isolation.includes('catalog.waitFor')) fail('Isolation does not wait for the real component.');
if (!isolation.includes('data-cda-isolated-component')) fail('Isolation does not isolate the real card.');

if (!catalog.includes("version:'v6.555'")) fail('Component catalog is not stamped v6.555.');
['data-cda-component-id','resolveCard','resolveTarget','capabilities:{','waitFor'].forEach(marker => {
  if (!catalog.includes(marker)) fail('Component catalog is missing ' + marker + '.');
});

if (!features.includes("CDA_DASHBOARD_FEATURES_VERSION = 'v6.555'")) fail('Feature catalog is not stamped v6.555.');
if (!features.includes("key:'collapse', placement:'title'")) fail('Collapse is not title-owned.');
if (features.includes("key:'collapse', placement:'toolbar'")) fail('Collapse is still toolbar-owned.');

if (!titleToggle.includes("version:'v6.555'")) fail('Title toggle is not stamped v6.555.');
if (!titleToggle.includes('data-cda-dashboard-title-toggle')) fail('Title toggle lacks a stable marker.');
if (!titleToggle.includes('adapter.collapse')) fail('Title toggle does not invoke adapter collapse.');

if (!renderer.includes("version:'v6.555'")) fail('Renderer is not stamped v6.555.');
if (!renderer.includes('data-cda-component-id')) fail('Renderer does not stamp component identity.');
if (!renderer.includes('titleToggle.mount')) fail('Renderer does not mount title toggles.');
if (!decorator.includes("version:'v6.555'")) fail('Decorator is not stamped v6.555.');
if (!decorator.includes('catalog.stamp')) fail('Decorator does not stamp component identity.');
if (!decorator.includes('titleToggle.mount')) fail('Decorator does not mount title toggles.');

if (!remakeAdapter.includes("version:'v6.555'")) fail('Remake adapter is not stamped v6.555.');
if (!remakeAdapter.includes('isCollapsed:isCollapsedV6555')) fail('Remake adapter does not expose collapse state.');
if (remakeAdapter.includes("bridge.invoke(context.component,'popout')")) fail('Remake still invokes the legacy pop-out provider.');
if (!tatAdapter.includes("version:'v6.555'")) fail('TAT adapter is not stamped v6.555.');
if (!tatAdapter.includes('isCollapsed:isCollapsedV6547')) fail('TAT adapter does not expose collapse state.');

if (!remakeDefinition.includes("version:'v6.555'")) fail('Remake definition is not stamped v6.555.');
if (!remakeDefinition.includes("tabButtonId:'remakeFactorTabBtn'")) fail('Remake lacks a stable tab route.');
const remakeComponentMatches = remakeDefinition.match(/\n\s*key:'(?:monthly|reason|department|product|customer|ceramist)'/g) || [];
if (remakeComponentMatches.length !== 6) fail('Remake definition does not contain six components.');
if (!tatDefinition.includes("version:'v6.555'")) fail('TAT definition is not stamped v6.555.');
if (!tatDefinition.includes("tabButtonId:'tatTabBtnV6509'")) fail('TAT lacks a stable tab route.');
if (/STANDARD_FEATURES\s*=\s*\[[^\]]*['"]year['"]/.test(tatDefinition)) fail('TAT still opts into the year feature.');

if (!audit.includes("version:'v6.555'")) fail('Shared audit is not stamped v6.555.');
['componentCatalog','livePopoutContract','titleSideCollapse','toolbarActionOrder','visibleLegacyHeaderActions'].forEach(marker => {
  if (!audit.includes(marker)) fail('Shared audit is missing ' + marker + '.');
});
if (!audit.includes('toolbarCollapseCount')) fail('Shared audit does not reject right-side collapse controls.');

if (!remakeBootstrap.includes("version:'v6.555'")) fail('Remake bootstrap is not stamped v6.555.');
if (!remakeBootstrap.includes('expectedActiveComponents:6')) fail('Remake bootstrap lacks the six-component contract.');
if (!remakeBootstrap.includes("same-application-live-component")) fail('Remake bootstrap does not require live pop-out mode.');
if (!tatBootstrap.includes("version:'v6.555'")) fail('TAT bootstrap is not stamped v6.555.');
if (!tatBootstrap.includes("same-application-live-component")) fail('TAT bootstrap does not require live pop-out mode.');
if (!tatBindings.includes("version:'v6.555'")) fail('TAT title binding is not stamped v6.555.');

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
  console.log('Stable component catalog: passed');
  console.log('Live same-application pop-out contract: passed');
  console.log('Title-side collapse contract: passed');
  console.log('Static snapshot pop-out guard: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
