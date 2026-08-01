#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname,'..');
const requiredVersion = 'v6.567';
const footerVersion = 'v6.578';
let failed = false;

function fail(message){ console.error('ERROR: ' + message); failed = true; }
function read(name){
  const filePath = path.join(root,name);
  if (!fs.existsSync(filePath)) { fail('Missing file: ' + name); return ''; }
  return fs.readFileSync(filePath,'utf8');
}
function count(text,regex){ return (text.match(regex) || []).length; }
function validateHtml(name,text){
  if (count(text,/<script\b/gi) !== count(text,/<\/script>/gi)) fail(name + ' has mismatched script tags.');
  if (count(text,/<style\b/gi) !== count(text,/<\/style>/gi)) fail(name + ' has mismatched style tags.');
  Array.from(text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).forEach((match,index) => {
    try { new vm.Script(match[1],{filename:name + '#script-' + (index + 1)}); }
    catch (error) { fail(error.message); }
  });
}

const foundation = read('SharedComponentFoundation.html');
if (!foundation.includes('Version: ' + requiredVersion)) fail('Foundation is not ' + requiredVersion + '.');
const includes = Array.from(foundation.matchAll(/includeDashboardFile\(['"]([A-Za-z0-9_-]+)['"]\)/g)).map(match => match[1]);
const requiredIncludes = [
  'SharedDashboardIsolationV6555','SharedDashboardPopoutV6548','SharedDashboardInteractionAuditV6557',
  'TatProductTableV6562','TatDashboardLayoutV6563','TatTableWidthsV6563','TatDashboardAdapterV6547',
  'TatDashboardDefinitionV6547','TatProductAuditV6562','TatDashboardBootstrapV6547','RemakeDashboardBootstrapV6548'
];
requiredIncludes.forEach(name => { if (!includes.includes(name)) fail('Missing required include: ' + name); });
const duplicates = includes.filter((name,index) => includes.indexOf(name) !== index);
if (duplicates.length) fail('Duplicate includes: ' + Array.from(new Set(duplicates)).join(', '));

function before(first,second){
  if (includes.indexOf(first) < 0 || includes.indexOf(second) < 0 || includes.indexOf(first) >= includes.indexOf(second)) {
    fail(first + ' must load before ' + second + '.');
  }
}
before('SharedDashboardIsolationV6555','SharedDashboardPopoutV6548');
before('TatProductTableV6562','TatDashboardDefinitionV6547');
before('TatDashboardLayoutV6563','TatDashboardDefinitionV6547');
before('TatTableWidthsV6563','TatDashboardDefinitionV6547');
before('TatDashboardDefinitionV6547','TatProductAuditV6562');
before('TatProductAuditV6562','TatDashboardBootstrapV6547');

includes.forEach(name => {
  const fileName = name + '.html';
  const text = read(fileName);
  validateHtml(fileName,text);
  if (text.includes('Bolean')) fail(fileName + ' contains Bolean.');
});

const footer = read('SharedFooter.html');
const router = read('Code.js');
const theme = read('SharedDashboardThemeV6549.html');
const isolation = read('SharedDashboardIsolationV6555.html');
const popout = read('SharedDashboardPopoutV6548.html');
const interactionAudit = read('SharedDashboardInteractionAuditV6557.html');
const remakeBridge = read('RemakeDashboardLegacyBridgeV6554.html');
const remakeAdapter = read('RemakeDashboardAdapterV6548.html');
const productService = read('TatProductTableV6562.html');
const layout = read('TatDashboardLayoutV6563.html');
const widths = read('TatTableWidthsV6563.html');
const definition = read('TatDashboardDefinitionV6547.html');
const audit = read('TatProductAuditV6562.html');
const bootstrap = read('TatDashboardBootstrapV6547.html');
const remakeBootstrap = read('RemakeDashboardBootstrapV6548.html');

validateHtml('SharedFooter.html',footer);
try { new vm.Script(router,{filename:'Code.js'}); } catch (error) { fail(error.message); }

if (!footer.includes("'" + footerVersion + "'")) fail('Footer is not ' + footerVersion + '.');
if (!footer.includes('TAT-REMAKE-PARITY-19')) fail('Footer build label is incorrect.');
if (!router.includes("'v6.567'")) fail('Router is not v6.567.');
if (!footer.includes("appendItem(footer,'Remake cache'")) fail('Separate Remake cache footer item is missing.');
if (!footer.includes("appendItem(footer,'Technician cache'")) fail('Separate technician cache footer item is missing.');
if (!footer.includes('debugDashboardServerHealth()')) fail('Footer does not request server cache health.');
if (!footer.includes('readLegacy')) fail('Footer does not retain legacy cache metadata fallback.');
if (!footer.includes('Timestamp unavailable')) fail('Footer lacks an honest missing-timestamp state.');
if (!footer.includes('data-cache-item-v6567')) fail('Footer cache items lack stable audit keys.');
if (!footer.includes('cdaSharedCacheFooterV6567')) fail('Footer runtime audit is missing.');
if (footer.includes("appendItem(footer,'Cache'")) fail('Ambiguous single Cache footer item remains.');
if (footer.includes("return 'Not loaded'")) fail('Legacy Not loaded placeholder logic remains.');

if (!theme.includes("version:'v6.566'")) fail('Shared theme is not v6.566.');
if (!theme.includes('--cda-card-content-padding: 10px 12px 12px')) fail('Shared card content padding is missing.');
if (!theme.includes('.remakeTableWrap')) fail('Remake table surface normalization is missing.');
if (!theme.includes('background: transparent !important')) fail('Remake nested table surface remains opaque.');
if (!theme.includes('border-radius: 0 !important')) fail('Remake nested table surface remains rounded.');

if (!isolation.includes("version:'v6.561'")) fail('Isolation service is not v6.561.');
if (!isolation.includes("tableMode:'window-scroll-full-table'")) fail('Isolation table mode is incorrect.');
if (!popout.includes("version:'v6.561'")) fail('Pop-out facade is not v6.561.');
if (!interactionAudit.includes("version:'v6.561'")) fail('Interaction audit is not v6.561.');

if (!remakeBridge.includes("version:'v6.566'")) fail('Remake legacy bridge is not v6.566.');
if (!remakeBridge.includes('function documentV6566(scope)')) fail('Remake bridge is not document-aware.');
if (!remakeBridge.includes('function explicitCardV6566(scope)')) fail('Remake bridge does not prioritize the live moved card.');
if (!remakeBridge.includes('prepareV6554(component,scope)')) fail('Remake bridge does not prepare an explicit card scope.');

if (!remakeAdapter.includes("version:'v6.566'")) fail('Remake adapter is not v6.566.');
if (!remakeAdapter.includes("return match ? match[1] : '2025';")) fail('Remake prior-year fallback is not fixed at 2025.');
if (!remakeAdapter.includes('stabilizeDetachedComparisonV6566')) fail('Detached comparison stabilization is missing.');
if (!remakeAdapter.includes("attributeFilter:['hidden']")) fail('Detached Remake observer is not limited to non-recursive mutations.');
if (!remakeAdapter.includes('data-cda-remake-popout-stable-v6566')) fail('Detached Remake stabilization marker is missing.');
if (remakeAdapter.includes("attributeFilter:['class','style','hidden']")) fail('Detached Remake observer still watches its own style/class writes.');
if (!remakeAdapter.includes('comparisonBusyV6566')) fail('Prior-year click re-entry guard is missing.');

if (!productService.includes("version:'v6.562'")) fail('TAT product service is not v6.562.');
if (!productService.includes("config.childRows = null")) fail('Department product drill-down is still enabled.');
if (!productService.includes('data-tat-product-mode-v6562')) fail('Products / Groups toggle is missing.');

if (!layout.includes("version:'v6.565'")) fail('TAT layout is not v6.565.');
[
  "mode:'remake-parity-two-column-performance-toggle'",
  'grid-template-columns:repeat(2,minmax(0,1fr))',
  'data-tat-performance-mode-v6565="distribution"',
  'data-tat-performance-mode-v6565="promise"',
  'data-tat-performance-view-v6565',
  'max-height:315px!important'
].forEach(marker => { if (!layout.includes(marker)) fail('TAT Remake-parity layout is missing: ' + marker); });
if (layout.includes('tatPromiseStripV6564')) fail('Rejected full-width promise strip remains.');
if (layout.includes('tatPromisePanelV6563')) fail('Rejected right-side promise panel remains.');

[
  "tatDepartment:['30%','13%','13%','11%','11%','10%','12%']",
  "tatProduct:['34%','12%','12%','10%','10%','10%','12%']",
  "tatCustomer:['30%','9%','12%','12%','10%','9%','9%','9%']"
].forEach(marker => { if (!widths.includes(marker)) fail('TAT width contract is missing: ' + marker); });

if (!definition.includes("version:'v6.565'")) fail('TAT definition is not v6.565.');
if (!definition.includes('renderHeaderControls:function(){ return layout.headerMarkup(); }')) fail('Performance header toggle is missing.');
if (!definition.includes('data-tat-performance-view-v6565="distribution"')) fail('Distribution view is missing.');
if (!definition.includes('data-tat-performance-view-v6565="promise"')) fail('Promise view is missing.');
if (definition.includes("targetId:'tatProductTableV6562',wide:true")) fail('Products is still full-width.');
if (definition.includes("targetId:'tatDistributionChartV6509',\n      tableKey:'tatLate',secondaryComponentKeys:['distribution','late'],wide:true")) fail('Performance is still full-width.');
if (definition.indexOf("key:'performance'") >= definition.indexOf("key:'product'")) fail('Performance must render left of Products.');

if (!audit.includes("version:'v6.565'")) fail('TAT audit is not v6.565.');
if (!audit.includes('performanceAndProductsAreSiblingCards:')) fail('Audit does not verify sibling cards.');
if (!audit.includes('performanceModeButtonCount:')) fail('Audit does not verify performance modes.');
if (!audit.includes('noRejectedLayouts:')) fail('Audit does not reject prior layouts.');
if (audit.includes('|| true')) fail('Audit contains a permissive always-true service check.');

if (!bootstrap.includes("version:'v6.565'")) fail('TAT bootstrap is not v6.565.');
if (!bootstrap.includes('siblingCardWidths:')) fail('Bootstrap does not require sibling widths.');
if (!bootstrap.includes('performanceToggle:')) fail('Bootstrap does not require performance modes.');
if (!remakeBootstrap.includes("version:'v6.561'")) fail('Remake bootstrap changed unexpectedly.');

if (!failed) {
  try {
    childProcess.execFileSync(process.execPath,[path.join(root,'scripts','test-dashboard-runtime-contracts.js')],{cwd:root,stdio:'inherit'});
    childProcess.execFileSync(process.execPath,[path.join(root,'scripts','test-tat-product-contracts.js')],{cwd:root,stdio:'inherit'});
  } catch (error) {
    fail('Dashboard runtime contracts failed.');
  }
}

if (failed) process.exitCode = 1;
else {
  console.log('Dashboard platform validation passed.');
  console.log('Platform foundation/router version: ' + requiredVersion);
  console.log('Footer release version: ' + footerVersion);
  console.log('Independent Remake cache timestamp: passed');
  console.log('Independent technician cache timestamp: passed');
  console.log('Duplicate Not loaded placeholder removed: passed');
  console.log('Server cache-health fallback: passed');
  console.log('Monthly and Department first-row parity: passed');
  console.log('Performance and Products second-row parity: passed');
  console.log('Distribution / Promise toggle: passed');
  console.log('Products / Groups toggle: passed');
  console.log('Remake detached 2025 comparison stabilization: passed');
  console.log('Shared Remake/TAT content spacing: passed');
  console.log('Remake nested table surface removed: passed');
  console.log('Rejected full-width performance layouts removed: passed');
  console.log('Readable TAT table widths retained: passed');
  console.log('Popup window is the only vertical scroll owner: passed');
  console.log('Detached/dashboard button parity: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
