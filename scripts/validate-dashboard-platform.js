#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredVersion = 'v6.562';

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
if (!foundation.includes(requiredVersion)) fail('SharedComponentFoundation.html is not ' + requiredVersion + '.');

const includes = Array.from(
  foundation.matchAll(/includeDashboardFile\(['"]([A-Za-z0-9_-]+)['"]\)/g)
).map(match => match[1]);

[
  'SharedDashboardIsolationV6555','SharedDashboardPopoutV6548',
  'SharedDashboardInteractionAuditV6557','TatProductTableV6562',
  'TatDashboardAdapterV6547','TatDashboardDefinitionV6547','TatProductAuditV6562',
  'TatDashboardBootstrapV6547','RemakeDashboardBootstrapV6548'
].forEach(name => {
  if (!includes.includes(name)) fail('Missing required include: ' + name);
});

const duplicateIncludes = includes.filter((name, index) => includes.indexOf(name) !== index);
if (duplicateIncludes.length) fail('Duplicate includes: ' + Array.from(new Set(duplicateIncludes)).join(', '));

function requireBefore(first, second) {
  if (includes.indexOf(first) < 0 || includes.indexOf(second) < 0 ||
      includes.indexOf(first) >= includes.indexOf(second)) {
    fail(first + ' must load before ' + second + '.');
  }
}
requireBefore('SharedDashboardIsolationV6555','SharedDashboardPopoutV6548');
requireBefore('SharedDashboardAuditV6550','SharedDashboardInteractionAuditV6557');
requireBefore('TatProductTableV6562','TatDashboardDefinitionV6547');
requireBefore('TatDashboardDefinitionV6547','TatProductAuditV6562');
requireBefore('TatProductAuditV6562','TatDashboardBootstrapV6547');
requireBefore('SharedDashboardInteractionAuditV6557','RemakeDashboardBootstrapV6548');

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
const interactionAudit = read('SharedDashboardInteractionAuditV6557.html');
const productService = read('TatProductTableV6562.html');
const productAudit = read('TatProductAuditV6562.html');
const renderer = read('SharedDashboardRendererV6547.html');
const tatAdapter = read('TatDashboardAdapterV6547.html');
const tatDefinition = read('TatDashboardDefinitionV6547.html');
const tatBootstrap = read('TatDashboardBootstrapV6547.html');
const remakeBootstrap = read('RemakeDashboardBootstrapV6548.html');

validateHtml('SharedFooter.html', footer);
try { new vm.Script(router, {filename:'Code.js'}); }
catch (error) { fail(error.message); }

if (!footer.includes("'v6.562'")) fail('SharedFooter.html is not v6.562.');
if (!footer.includes('TAT-SEPARATE-PRODUCTS-14')) fail('SharedFooter build label is incorrect.');
if (!router.includes("'v6.562'")) fail('Code.js is not v6.562.');

if (!isolation.includes("version:'v6.561'")) fail('Isolation service is not v6.561.');
if (!isolation.includes("tableMode:'window-scroll-full-table'")) {
  fail('Isolation does not assign vertical scrolling to the popup window.');
}
[
  'popup.document.adoptNode(card)',
  'placeholder.replaceWith(session.card)',
  'normalizeFullTableV6561(session)',
  'restoreInlineStylesV6561(session)',
  "node.style.setProperty(name,value,'important')",
  "setImportantV6561(session,node,'overflow-y','visible')",
  "doc.documentElement.style.setProperty('overflow-y','auto','important')",
  "doc.body.style.setProperty('overflow','visible','important')",
  'session.observer.observe(card',
  "verticalScrollOwner:'popup-window'"
].forEach(marker => {
  if (!isolation.includes(marker)) fail('Missing popup-window scroll contract: ' + marker);
});
['buildUrl','frameUrlFrom','hashRoute','userCodeAppPanel','toBase64Image','toDataURL','outerHTML']
  .forEach(marker => { if (isolation.includes(marker)) fail('Obsolete pop-out marker remains: ' + marker); });

if (!popout.includes("version:'v6.561'")) fail('Pop-out facade is not v6.561.');
if (!popout.includes("tableMode:'window-scroll-full-table'")) fail('Pop-out facade has the wrong table mode.');

if (!interactionAudit.includes("version:'v6.561'")) fail('Interaction audit is not v6.561.');
[
  'function isInternalVerticalScrollOwner(node)',
  "reason:'internal-vertical-scroll-owner'",
  "reason:'popup-window-not-sole-scroll-owner'",
  "scrollOwner:'popup-window'",
  'function detachedButtonParity()',
  'sameClasses','sameText','sameStyle'
].forEach(marker => {
  if (!interactionAudit.includes(marker)) fail('Interaction audit is missing: ' + marker);
});

if (!renderer.includes("version:'v6.562'")) fail('Renderer is not v6.562.');
if (!renderer.includes('renderHeaderControls')) fail('Renderer lacks shared header controls.');
if (!renderer.includes('cdaDashboardHeaderActionsV6562')) fail('Renderer lacks one header-actions owner.');

if (!productService.includes("version:'v6.562'")) fail('TAT product service is not v6.562.');
[
  "const TABLE_KEY = 'tatProduct'",
  "config.childRows = null",
  "config.childRowClass = ''",
  'data-tat-product-mode-v6562',
  "if (key === 'tatDepartment')",
  'ensureDepartmentOnlyV6562'
].forEach(marker => {
  if (!productService.includes(marker)) fail('TAT product service is missing: ' + marker);
});

if (!tatAdapter.includes("version:'v6.562'")) fail('TAT adapter is not v6.562.');
if (!tatAdapter.includes("'tatProduct'")) fail('TAT product table is not in adapter lifecycle cleanup.');
if (!tatDefinition.includes("version:'v6.562'")) fail('TAT definition is not v6.562.');
if (!tatDefinition.includes("key:'product',title:'Products'")) fail('TAT Products component is missing.');
if (!tatDefinition.includes("tableKey:'tatProduct'")) fail('TAT Products component uses the wrong table key.');
if (!tatDefinition.includes("renderHeaderControls:function(){ return productTable.headerMarkup(); }")) {
  fail('TAT Products / Groups toggle is not a first-class header control.');
}
if (!tatDefinition.includes("[{label:'Department'}].concat(TAT_METRIC_HEADERS)")) {
  fail('TAT Department header is not department-only.');
}

if (!productAudit.includes("version:'v6.562'")) fail('TAT product audit is not v6.562.');
if (!productAudit.includes('noProductRowsInsideDepartment')) {
  fail('TAT product audit does not reject department drill-down rows.');
}
if (!productAudit.includes('modeButtonCount:modeButtons.length')) {
  fail('TAT product audit does not verify Products / Groups controls.');
}

if (!tatBootstrap.includes("version:'v6.562'")) fail('TAT bootstrap is not v6.562.');
if (!tatBootstrap.includes('sevenComponents:definition.components.length === 7')) {
  fail('TAT bootstrap does not require seven components.');
}
if (!tatBootstrap.includes('productContract.ok')) fail('TAT bootstrap does not require the product contract.');
if (!tatBootstrap.includes("window.cdaDashboardIsolationV6555.version === 'v6.561'")) {
  fail('TAT bootstrap expects the wrong isolation version.');
}
if (!tatBootstrap.includes("window.cdaDashboardPopoutV6548.version === 'v6.561'")) {
  fail('TAT bootstrap expects the wrong pop-out version.');
}

if (!remakeBootstrap.includes("version:'v6.561'")) fail('Remake bootstrap is not v6.561.');
if (!remakeBootstrap.includes("window.cdaDashboardIsolationV6555.version === 'v6.561'")) {
  fail('Remake bootstrap expects the wrong isolation version.');
}
if (!remakeBootstrap.includes("window.cdaDashboardPopoutV6548.version === 'v6.561'")) {
  fail('Remake bootstrap expects the wrong pop-out version.');
}
if (!remakeBootstrap.includes("window.cdaDashboardPopoutV6548.tableMode === 'window-scroll-full-table'")) {
  fail('Remake bootstrap does not require popup-window-only scrolling.');
}

const relevantSelectorBlock = remakeBootstrap.match(/function relevantNodeV6561[\s\S]*?\n  }/)?.[0] || '';
if (!relevantSelectorBlock || relevantSelectorBlock.includes('.remakeCardTitle')) {
  fail('Remake bootstrap still watches title mutations.');
}

if (!process.exitCode) {
  try {
    childProcess.execFileSync(process.execPath,
      [path.join(root, 'scripts', 'test-dashboard-runtime-contracts.js')],
      {cwd:root,stdio:'inherit'});
    childProcess.execFileSync(process.execPath,
      [path.join(root, 'scripts', 'test-tat-product-contracts.js')],
      {cwd:root,stdio:'inherit'});
  } catch (error) {
    fail('Dashboard runtime contracts failed.');
  }
}

if (!process.exitCode) {
  console.log('Dashboard platform validation passed.');
  console.log('Version: ' + requiredVersion);
  console.log('Department table has no product drill-down rows: passed');
  console.log('Separate TAT Products table: passed');
  console.log('Products / Groups shared header toggle: passed');
  console.log('Seven-component TAT definition: passed');
  console.log('Popup window is the only vertical scroll owner: passed');
  console.log('Detached/dashboard button class, icon, and style parity: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
