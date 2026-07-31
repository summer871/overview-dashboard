#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredVersion = 'v6.564';

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

function count(text, regex) { return (text.match(regex) || []).length; }

function validateHtml(fileName, text) {
  if (count(text, /<script\b/gi) !== count(text, /<\/script>/gi)) fail(fileName + ' has mismatched script tags.');
  if (count(text, /<style\b/gi) !== count(text, /<\/style>/gi)) fail(fileName + ' has mismatched style tags.');
  Array.from(text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).forEach((match, index) => {
    try { new vm.Script(match[1], {filename:fileName + '#script-' + (index + 1)}); }
    catch (error) { fail(error.message); }
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
  'TatDashboardLayoutV6563','TatTableWidthsV6563','TatDashboardAdapterV6547',
  'TatDashboardDefinitionV6547','TatProductAuditV6562',
  'TatDashboardBootstrapV6547','RemakeDashboardBootstrapV6548'
].forEach(name => { if (!includes.includes(name)) fail('Missing required include: ' + name); });

const duplicateIncludes = includes.filter((name, index) => includes.indexOf(name) !== index);
if (duplicateIncludes.length) fail('Duplicate includes: ' + Array.from(new Set(duplicateIncludes)).join(', '));

function requireBefore(first, second) {
  if (includes.indexOf(first) < 0 || includes.indexOf(second) < 0 || includes.indexOf(first) >= includes.indexOf(second)) {
    fail(first + ' must load before ' + second + '.');
  }
}
requireBefore('SharedDashboardIsolationV6555','SharedDashboardPopoutV6548');
requireBefore('SharedDashboardAuditV6550','SharedDashboardInteractionAuditV6557');
requireBefore('TatProductTableV6562','TatDashboardDefinitionV6547');
requireBefore('TatDashboardLayoutV6563','TatDashboardDefinitionV6547');
requireBefore('TatTableWidthsV6563','TatDashboardDefinitionV6547');
requireBefore('TatDashboardDefinitionV6547','TatProductAuditV6562');
requireBefore('TatProductAuditV6562','TatDashboardBootstrapV6547');

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
const layout = read('TatDashboardLayoutV6563.html');
const widths = read('TatTableWidthsV6563.html');
const productAudit = read('TatProductAuditV6562.html');
const renderer = read('SharedDashboardRendererV6547.html');
const tatAdapter = read('TatDashboardAdapterV6547.html');
const tatDefinition = read('TatDashboardDefinitionV6547.html');
const tatBootstrap = read('TatDashboardBootstrapV6547.html');
const remakeBootstrap = read('RemakeDashboardBootstrapV6548.html');

validateHtml('SharedFooter.html', footer);
try { new vm.Script(router, {filename:'Code.js'}); }
catch (error) { fail(error.message); }

if (!footer.includes("'v6.564'")) fail('SharedFooter.html is not v6.564.');
if (!footer.includes('TAT-ANALYSIS-FIRST-16')) fail('SharedFooter build label is incorrect.');
if (!router.includes("'v6.564'")) fail('Code.js is not v6.564.');

if (!isolation.includes("version:'v6.561'")) fail('Isolation service is not v6.561.');
if (!isolation.includes("tableMode:'window-scroll-full-table'")) fail('Isolation has the wrong table mode.');
if (!popout.includes("version:'v6.561'")) fail('Pop-out facade is not v6.561.');
if (!interactionAudit.includes("version:'v6.561'")) fail('Interaction audit is not v6.561.');

if (!renderer.includes("version:'v6.562'")) fail('Renderer is not v6.562.');
if (!renderer.includes('renderHeaderControls')) fail('Renderer lacks shared header controls.');

if (!productService.includes("version:'v6.562'")) fail('TAT product service is not v6.562.');
[
  "const TABLE_KEY = 'tatProduct'",
  "config.childRows = null",
  "config.childRowClass = ''",
  'data-tat-product-mode-v6562',
  'ensureDepartmentOnlyV6562'
].forEach(marker => { if (!productService.includes(marker)) fail('TAT product service is missing: ' + marker); });

if (!layout.includes("version:'v6.564'")) fail('TAT layout service is not v6.564.');
[
  "mode:'analysis-first-promise-strip-and-full-width-distribution'",
  'tatPerformanceLayoutV6564',
  'tatPromiseStripV6564',
  'tatPromiseHeadlineV6564',
  'tatPromiseStackSegmentV6564',
  'tatPromiseEmptyV6564',
  'tatPerformanceChartPanelV6564',
  'max-height:360px!important',
  "isolation.card('tat.performance')"
].forEach(marker => { if (!layout.includes(marker)) fail('TAT analysis-first layout is missing: ' + marker); });
if (layout.includes('tatPromisePanelV6563')) fail('Rejected right-side Promise panel remains.');

if (!widths.includes("version:'v6.563'")) fail('TAT table-width service is not v6.563.');
[
  "tatDepartment:['30%','13%','13%','11%','11%','10%','12%']",
  "tatProduct:['34%','12%','12%','10%','10%','10%','12%']",
  "tatCustomer:['30%','9%','12%','12%','10%','9%','9%','9%']"
].forEach(marker => { if (!widths.includes(marker)) fail('TAT width contract is missing: ' + marker); });

if (!tatAdapter.includes("version:'v6.563'")) fail('TAT adapter is not v6.563.');
if (!tatAdapter.includes("context.component.key === 'performance'")) fail('TAT adapter lacks combined performance controls.');

if (!tatDefinition.includes("version:'v6.564'")) fail('TAT definition is not v6.564.');
if (!tatDefinition.includes("key:'performance',title:'TAT Performance'")) fail('TAT Performance component is missing.');
if (!tatDefinition.includes('tatPromiseStripV6564')) fail('Compact promise strip markup is missing.');
if (!tatDefinition.includes('tatPerformanceChartPanelV6564')) fail('Full-width distribution markup is missing.');
if (tatDefinition.indexOf("key:'performance'") >= tatDefinition.indexOf("key:'product'")) {
  fail('TAT Performance must appear before Products.');
}
if (tatDefinition.includes("key:'late',title:'Promise Performance'")) fail('Standalone Promise Performance remains.');
if (tatDefinition.includes("key:'distribution',title:'TAT Distribution'")) fail('Standalone TAT Distribution remains.');
if (!tatDefinition.includes("key:'product',title:'Products',kind:'table',tableKey:'tatProduct',targetId:'tatProductTableV6562',wide:true")) {
  fail('TAT Products is not full-width.');
}

if (!productAudit.includes("version:'v6.564'")) fail('TAT layout audit is not v6.564.');
if (!productAudit.includes('performanceBeforeProducts:performanceBeforeProducts')) fail('TAT audit does not verify order.');
if (!productAudit.includes('compactPromiseStrip:')) fail('TAT audit does not verify compact strip.');
if (!productAudit.includes('fullWidthDistribution:')) fail('TAT audit does not verify full-width chart.');

if (!tatBootstrap.includes("version:'v6.564'")) fail('TAT bootstrap is not v6.564.');
if (!tatBootstrap.includes('sixComponents:definition.components.length === 6')) fail('TAT bootstrap does not require six components.');
if (!tatBootstrap.includes('performanceBeforeProducts:')) fail('TAT bootstrap does not enforce component order.');
if (!tatBootstrap.includes('analysisFirstLayout:')) fail('TAT bootstrap does not require analysis-first mode.');
if (!tatBootstrap.includes("window.cdaDashboardIsolationV6555.version === 'v6.561'")) fail('TAT bootstrap expects wrong isolation version.');

if (!remakeBootstrap.includes("version:'v6.561'")) fail('Remake bootstrap is not v6.561.');

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
  console.log('Performance appears before Products: passed');
  console.log('Compact promise strip above full-width distribution: passed');
  console.log('Zero-eligible promise state: passed');
  console.log('Products table is full-width and shorter: passed');
  console.log('Readable Department, Product, and Customer widths: passed');
  console.log('Popup window is the only vertical scroll owner: passed');
  console.log('Detached/dashboard button class, icon, and style parity: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
