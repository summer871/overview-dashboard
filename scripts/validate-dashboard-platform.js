#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredVersion = 'v6.554';
const foundationPath = path.join(root, 'SharedComponentFoundation.html');
const blockedReferences = [
  'TatCleanPlatformScriptPart',
  'TatCleanPlatformStylesV6545',
  'SharedTableCardRendererV6544',
  'SharedTableCardRendererV6546'
];
const requiredIncludes = [
  'SharedDashboardThemeV6549','SharedDashboardRegistryV6547','SharedDashboardColumnsV6548',
  'SharedDashboardPopoutV6548','SharedDashboardToolbarV6548','SharedDashboardAuditV6550',
  'SharedDashboardDecoratorV6548','RemakeDashboardLegacyBridgeV6554',
  'RemakeDashboardAdapterV6548','RemakeDashboardDefinitionV6548',
  'RemakeDashboardBootstrapV6548','TatDashboardBindingsV6547','TatDashboardBootstrapV6547'
];

function fail(message){
  console.error('ERROR: ' + message);
  process.exitCode = 1;
}

function read(filePath){
  if (!fs.existsSync(filePath)) {
    fail('Missing file: ' + path.relative(root,filePath));
    return '';
  }
  return fs.readFileSync(filePath,'utf8');
}

function count(text,regex){ return (text.match(regex) || []).length; }

function validateHtmlPartial(fileName,text){
  if (count(text,/<script\b/gi) !== count(text,/<\/script>/gi)) fail(fileName + ' has mismatched script tags.');
  if (count(text,/<style\b/gi) !== count(text,/<\/style>/gi)) fail(fileName + ' has mismatched style tags.');
  Array.from(text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).forEach((match,index) => {
    try { new vm.Script(match[1],{filename:fileName + '#script-' + (index + 1)}); }
    catch (error) { fail(error.message); }
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
const duplicateIncludes = includes.filter((name,index) => includes.indexOf(name) !== index);
if (duplicateIncludes.length) fail('Duplicate active includes: ' + Array.from(new Set(duplicateIncludes)).join(', '));
requiredIncludes.forEach(name => {
  if (!includes.includes(name)) fail('Missing required v6.554 include: ' + name);
});
const bridgeIndex = includes.indexOf('RemakeDashboardLegacyBridgeV6554');
const adapterIndex = includes.indexOf('RemakeDashboardAdapterV6548');
if (bridgeIndex < 0 || adapterIndex < 0 || bridgeIndex >= adapterIndex) {
  fail('Remake legacy bridge must load before the Remake adapter.');
}

includes.forEach(name => {
  const fileName = name + '.html';
  const text = read(path.join(root,fileName));
  validateHtmlPartial(fileName,text);
  if (text.includes('Bolean')) fail(fileName + ' contains the invalid Bolean identifier.');
  blockedReferences.forEach(reference => {
    if (text.includes(reference)) fail(fileName + ' references blocked legacy runtime: ' + reference);
  });
});

const footer = read(path.join(root,'SharedFooter.html'));
const router = read(path.join(root,'Code.js'));
const toolbar = read(path.join(root,'SharedDashboardToolbarV6548.html'));
const audit = read(path.join(root,'SharedDashboardAuditV6550.html'));
const bridge = read(path.join(root,'RemakeDashboardLegacyBridgeV6554.html'));
const adapter = read(path.join(root,'RemakeDashboardAdapterV6548.html'));
const remakeDefinition = read(path.join(root,'RemakeDashboardDefinitionV6548.html'));
const remakeBootstrap = read(path.join(root,'RemakeDashboardBootstrapV6548.html'));
const tatDefinition = read(path.join(root,'TatDashboardDefinitionV6547.html'));
const tatBindings = read(path.join(root,'TatDashboardBindingsV6547.html'));
const tatBootstrap = read(path.join(root,'TatDashboardBootstrapV6547.html'));

validateHtmlPartial('SharedFooter.html',footer);
try { new vm.Script(router,{filename:'Code.js'}); }
catch (error) { fail(error.message); }

if (!footer.includes("'v6.554'")) fail('SharedFooter.html is not stamped v6.554.');
if (!footer.includes('COMPLETE-SHARED-VISUALS-06')) fail('SharedFooter.html build label is not v6.554.');
if (!router.includes("'v6.554'")) fail('Code.js is not stamped v6.554.');

if (!toolbar.includes("version:'v6.554'")) fail('Shared toolbar is not stamped v6.554.');
if (!toolbar.includes('#remakeFactorPage .remakeKpiAreaV6406 .remakeKpiChooserButtonV6403') ||
    !toolbar.includes('#tatDashboardPageV6509 .remakeKpiAreaV6406 .remakeKpiChooserButtonV6403')) {
  fail('Shared toolbar does not enforce KPI overflow parity in both tabs.');
}

if (!bridge.includes("version:'v6.554'")) fail('Remake legacy bridge is not stamped v6.554.');
['exportCurrent','exportAll','popout','reset','collapse'].forEach(action => {
  if (!bridge.includes("return '" + action + "'")) fail('Remake legacy bridge does not classify ' + action + '.');
});
if (!bridge.includes('data-cda-dashboard-legacy-action')) fail('Remake legacy bridge does not publish legacy action ownership.');

if (!adapter.includes("version:'v6.554'")) fail('Remake adapter is not stamped v6.554.');
if (!adapter.includes("bridge.invoke(context.component,'exportAll')")) fail('Remake All data is not routed through the shared menu adapter.');
if (!adapter.includes('toggleRemakeSectionV6402')) fail('Remake collapse is not routed through the shared toolbar adapter.');
if (!adapter.includes("data-cda-dashboard-icon-state")) fail('Remake collapse does not publish its shared icon state.');

if (!remakeDefinition.includes("version:'v6.554'")) fail('Remake definition is not stamped v6.554.');
if (!remakeDefinition.includes("key:'monthly'")) fail('Monthly Remake Comparison is not registered.');
if (!remakeDefinition.includes('monthlyCardV6554')) fail('Monthly Remake Comparison lacks title-based card resolution.');
const remakeComponentMatches = remakeDefinition.match(/\n\s*key:'(?:monthly|reason|department|product|customer|ceramist)'/g) || [];
if (remakeComponentMatches.length !== 6) fail('Remake definition does not contain exactly six visible components.');
if (!remakeDefinition.includes("collapseKey:'customer'") || !remakeDefinition.includes("collapseKey:'technician'")) {
  fail('Remake collapsible cards are not registered with shared collapse keys.');
}

if (!audit.includes("version:'v6.554'")) fail('Shared visual audit is not stamped v6.554.');
[
  'everyFeatureInstanceStyleParity','toolbarActionOrder','visibleLegacyHeaderActions',
  'remakeVisibleCardCoverage','kpiOverflowParity'
].forEach(marker => {
  if (!audit.includes(marker)) fail('Shared visual audit is missing ' + marker + '.');
});
if (!audit.includes('visibleAnalyticsCards.length === tab.components.length')) {
  fail('Shared visual audit does not require every visible Remake card to be registered.');
}

if (!remakeBootstrap.includes("version:'v6.554'")) fail('Remake bootstrap is not stamped v6.554.');
if (!remakeBootstrap.includes('expectedActiveComponents:6')) fail('Remake audit does not publish the six-card contract.');
if (!remakeBootstrap.includes('base.toolbarCount === base.expectedToolbarCount')) fail('Remake audit does not require exact toolbar count.');
if (!remakeBootstrap.includes('priorYearLabelsCorrect')) fail('Remake audit does not validate prior-year labels.');

if (!tatBootstrap.includes("version:'v6.554'")) fail('TAT bootstrap is not stamped v6.554.');
if (!tatBootstrap.includes("sharedToolbarV6548.version === 'v6.554'")) fail('TAT does not require the v6.554 shared toolbar.');
if (!tatBootstrap.includes("sharedAuditV6550.version === 'v6.554'")) fail('TAT does not require the v6.554 visual audit.');
if (!tatBindings.includes("version:'v6.553'")) fail('TAT stateful icon binding is missing.');
if (/STANDARD_FEATURES\s*=\s*\[[^\]]*['"]year['"]/.test(tatDefinition)) fail('TAT still opts into the year feature.');

if (!process.exitCode) {
  try {
    childProcess.execFileSync(process.execPath,[path.join(root,'scripts','test-dashboard-runtime-contracts.js')],{
      cwd:root,stdio:'inherit'
    });
  } catch (error) {
    fail('Dashboard runtime contracts failed.');
  }
}

if (!process.exitCode) {
  console.log('Dashboard platform validation passed.');
  console.log('Version: ' + requiredVersion);
  console.log('Complete visible-card coverage: 6 Remake cards');
  console.log('Shared header order and legacy-action guard: passed');
  console.log('KPI overflow parity: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
