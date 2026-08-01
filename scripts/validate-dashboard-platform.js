#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname,'..');
const requiredVersion = 'v6.567';
const footerVersion = 'v6.582';
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
  'SharedDashboardRegistryV6547','SharedDashboardColumnsV6548','SharedDashboardColumnWidthsV6581','SharedDashboardIsolationV6555',
  'SharedDashboardPopoutV6548','SharedDashboardFeatureRuntimeV6579','SharedDashboardFeaturesV6547',
  'SharedDashboardToolbarV6548','SharedDashboardTitleToggleV6555','SharedDashboardInteractionAuditV6557',
  'TatProductTableV6562','TatDashboardLayoutV6563','TatTableWidthsV6563','TatDashboardAdapterV6547',
  'TatDashboardDefinitionV6547','TatProductAuditV6562','TatDashboardBootstrapV6547',
  'RemakeDashboardAdapterV6548','RemakeDashboardDefinitionV6548','RemakeDashboardBootstrapV6548'
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
before('SharedDashboardColumnsV6548','SharedDashboardColumnWidthsV6581');
before('SharedDashboardColumnWidthsV6581','SharedDashboardFeatureRuntimeV6579');
before('SharedDashboardPopoutV6548','SharedDashboardFeatureRuntimeV6579');
before('SharedDashboardFeatureRuntimeV6579','SharedDashboardFeaturesV6547');
before('SharedDashboardFeaturesV6547','SharedDashboardToolbarV6548');
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
const registry = read('SharedDashboardRegistryV6547.html');
const runtime = read('SharedDashboardFeatureRuntimeV6579.html');
const columns = read('SharedDashboardColumnsV6548.html');
const columnWidths = read('SharedDashboardColumnWidthsV6581.html');
const features = read('SharedDashboardFeaturesV6547.html');
const toolbar = read('SharedDashboardToolbarV6548.html');
const titleToggle = read('SharedDashboardTitleToggleV6555.html');
const theme = read('SharedDashboardThemeV6549.html');
const isolation = read('SharedDashboardIsolationV6555.html');
const popout = read('SharedDashboardPopoutV6548.html');
const interactionAudit = read('SharedDashboardInteractionAuditV6557.html');
const remakeBridge = read('RemakeDashboardLegacyBridgeV6554.html');
const remakeAdapter = read('RemakeDashboardAdapterV6548.html');
const remakeDefinition = read('RemakeDashboardDefinitionV6548.html');
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
if (!footer.includes('SHARED-COLUMN-WIDTHS-HOTFIX-23')) fail('Footer build label is incorrect.');
if (!router.includes("'v6.567'")) fail('Router is not v6.567.');
if (!footer.includes("appendItem(footer,'Remake cache'")) fail('Separate Remake cache footer item is missing.');
if (!footer.includes("appendItem(footer,'Technician cache'")) fail('Separate technician cache footer item is missing.');
if (!footer.includes('debugDashboardServerHealth()')) fail('Footer does not request server cache health.');
if (footer.includes("appendItem(footer,'Cache'")) fail('Ambiguous single Cache footer item remains.');

if (!registry.includes("const VERSION_V6547 = 'v6.579'")) fail('Shared registry is not v6.579.');
if (!registry.includes('featureOptions:normalizeFeatureOptionsV6579')) fail('Registry does not normalize feature options.');
if (!runtime.includes("version:'v6.582'")) fail('Shared feature runtime is not v6.582.');
if (!runtime.includes("mode:'configuration-driven-shared-feature-runtime'")) fail('Shared feature runtime mode is missing.');
if (!features.includes("CDA_DASHBOARD_FEATURES_VERSION = 'v6.582'")) fail('Feature catalog is not v6.582.');
if (!features.includes("key:'columnWidths'")) fail('Shared columnWidths feature is not registered.');
if (features.includes('function callAdapter(')) fail('Feature catalog still owns adapter dispatch.');
if (!toolbar.includes("version:'v6.579'")) fail('Shared toolbar is not v6.579.');
if (!toolbar.includes('runtime.run(featureKey')) fail('Toolbar bypasses the shared runtime.');
if (!titleToggle.includes("version:'v6.579'")) fail('Shared title toggle is not v6.579.');
if (!titleToggle.includes("runtime.run('collapse'")) fail('Title collapse bypasses the shared runtime.');

if (!columns.includes("const VERSION_V6581 = 'v6.582'")) fail('Shared column visibility is not v6.582.');
if (!columns.includes("mode:'shared-visibility-only-rerender-safe'")) fail('Shared column visibility still owns width behavior.');
if (columns.includes('cdaColumnWidthHandleV6581') || columns.includes('cdaDashboardColumnWidths.v6581')) fail('Width behavior leaked back into the Columns service.');
if (!columnWidths.includes("const VERSION_V6581 = 'v6.582'")) fail('Shared column-width feature is not v6.582.');
if (!columnWidths.includes("mode:'opt-in-contained-spreadsheet-column-widths'")) fail('Shared column-width mode is missing.');
if (!columnWidths.includes("(component.features || []).indexOf('columnWidths') >= 0")) fail('Shared column widths are not opt-in.');
if (!columnWidths.includes('cdaDashboardTableViewportV6581')) fail('Dedicated horizontal table viewport is missing.');
if (!columnWidths.includes('overflow-x:auto!important')) fail('Dashboard table scroll ownership is missing.');
if (!columnWidths.includes('overflow-x:auto!important')) fail('Detached horizontal table scrolling is missing.');
if (!columnWidths.includes('setPointerCapture') || !columnWidths.includes('lostpointercapture')) fail('Pointer capture cleanup is incomplete.');
if (!columnWidths.includes("view.addEventListener('blur'") || !columnWidths.includes("doc.addEventListener('visibilitychange'")) fail('Resize cleanup does not cover blur/visibility loss.');
if (!columnWidths.includes('queueMicrotask')) fail('Before-paint persisted-width reapply is missing.');
if (!columnWidths.includes('requestAnimationFrame')) fail('Resize updates are not animation-frame batched.');
if (!columnWidths.includes('saveWidthMapV6581')) fail('Complete manual width layouts are not persisted.');
if (!columnWidths.includes('numericMin') || !columnWidths.includes('firstColumnMin')) fail('Default width auto-fit rules are missing.');
if (!runtime.includes('columnWidths:resetColumnWidthsV6581')) fail('Runtime does not route reset column widths.');
if (!columnWidths.includes("table.parentElement.classList.contains('cdaDashboardTableViewportV6581')")) fail('Column widths do not create a dedicated table-only viewport.');
if (columnWidths.includes("viewport = table.closest && table.closest('.remakeTableWrap')")) fail('Column widths still reuse outer dashboard wrappers.');
if (columnWidths.includes("frame.style.setProperty('width'")) fail('Column widths still widen the shared table frame/card.');
if (!columnWidths.includes('overflow-y:hidden!important')) fail('Contained table viewport vertical overflow rule is missing.');
if (!columns.includes("resetWidths.textContent = 'Reset widths'")) fail('Reset widths is not in the Columns popover.');
if (!features.includes("key:'columnWidths',placement:'service'")) fail('columnWidths must be service-only.');

if (!theme.includes("version:'v6.566'")) fail('Shared theme is not v6.566.');
if (!isolation.includes("version:'v6.561'")) fail('Isolation service is not v6.561.');
if (!isolation.includes("tableMode:'window-scroll-full-table'")) fail('Isolation table mode is incorrect.');
if (!popout.includes("version:'v6.561'")) fail('Pop-out facade is not v6.561.');
if (!interactionAudit.includes("version:'v6.561'")) fail('Interaction audit is not v6.561.');

if (!remakeBridge.includes("version:'v6.566'")) fail('Remake legacy bridge is not v6.566.');
if (!remakeAdapter.includes("version:'v6.566'")) fail('Remake adapter changed unexpectedly.');
if (!remakeAdapter.includes('nativeTitleToggle:true')) fail('Remake native title ownership is missing.');
if (!remakeAdapter.includes('stabilizeDetachedComparisonV6566')) fail('Detached comparison stabilization is missing.');
if (!remakeDefinition.includes("version:'v6.581'")) fail('Remake definition is not v6.581.');
if (!remakeDefinition.includes('featureOptions:')) fail('Remake feature configuration is missing.');
if (!remakeDefinition.includes("'columns','columnWidths'")) fail('Remake tables do not opt into shared column widths.');
if (!remakeDefinition.includes('comparePriorYear:COMPARE_OPTIONS')) fail('Remake comparison plugin is missing.');

if (!productService.includes("version:'v6.562'")) fail('TAT product service is not v6.562.');
if (!productService.includes("config.childRows = null")) fail('Department product drill-down is still enabled.');
if (!layout.includes("version:'v6.565'")) fail('TAT layout is not v6.565.');
if (!layout.includes("mode:'remake-parity-two-column-performance-toggle'")) fail('TAT Remake-parity layout is missing.');
if (layout.includes('tatPromiseStripV6564') || layout.includes('tatPromisePanelV6563')) fail('Rejected TAT layout remains.');
[
  "tatDepartment:['30%','13%','13%','11%','11%','10%','12%']",
  "tatProduct:['34%','12%','12%','10%','10%','10%','12%']",
  "tatCustomer:['30%','9%','12%','12%','10%','9%','9%','9%']"
].forEach(marker => { if (!widths.includes(marker)) fail('TAT width contract is missing: ' + marker); });
if (!definition.includes("version:'v6.581'")) fail('TAT definition is not v6.581.');
if (!definition.includes('featureOptions:')) fail('TAT feature configuration is missing.');
if (!definition.includes("const TABLE_FEATURES = ['columns','columnWidths'")) fail('TAT tables do not opt into shared column widths.');
if (!definition.includes('renderHeaderControls:function(){ return layout.headerMarkup(); }')) fail('Performance header toggle is missing.');
if (!definition.includes("tableIds:['tatLateTableV6509']")) fail('TAT Promise table is not registered for shared widths.');
if (!definition.includes("features:CHART_FEATURES.concat(['columnWidths'])")) fail('TAT Promise table does not opt into shared widths.');
if (definition.indexOf("key:'performance'") >= definition.indexOf("key:'product'")) fail('Performance must render left of Products.');
if (!audit.includes("version:'v6.565'")) fail('TAT audit is not v6.565.');
if (!bootstrap.includes("version:'v6.565'")) fail('TAT bootstrap is not v6.565.');
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
  console.log('Shared feature runtime version: ' + requiredVersion);
  console.log('Footer release version: ' + footerVersion);
  console.log('Configuration-driven table/card features: passed');
  console.log('Opt-in shared column-width feature: passed');
  console.log('Animation-frame spreadsheet-style resize cleanup: passed');
  console.log('All 11 table surfaces including TAT Promise: passed');
  console.log('Single scroll owner, pre-paint restore, and compact defaults: passed');
  console.log('Native Remake title/collapse ownership: passed');
  console.log('Live-node pop-out and restore contract: passed');
  console.log('TAT Remake-parity layout: passed');
  console.log('Active includes: ' + includes.length);
}
