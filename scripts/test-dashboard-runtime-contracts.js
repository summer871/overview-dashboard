#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const assert = (condition,message) => { if (!condition) throw new Error(message); };

function componentBlock(text,key,nextKey){
  const start = text.indexOf("key:'" + key + "'");
  assert(start >= 0,'Missing component: ' + key);
  const end = nextKey ? text.indexOf("key:'" + nextKey + "'",start + 1) : text.length;
  return text.slice(start,end >= 0 ? end : text.length);
}

function runSharedFeatureRuntimeContract(){
  const registry = read('SharedDashboardRegistryV6547.html');
  const runtime = read('SharedDashboardFeatureRuntimeV6579.html');
  const features = read('SharedDashboardFeaturesV6547.html');
  const toolbar = read('SharedDashboardToolbarV6548.html');
  const titleToggle = read('SharedDashboardTitleToggleV6555.html');
  const foundation = read('SharedComponentFoundation.html');

  assert(registry.includes("const VERSION_V6547 = 'v6.579'"), 'Registry is not v6.579.');
  assert(registry.includes('featureOptions:normalizeFeatureOptionsV6579'), 'Component feature options are not normalized.');
  assert(runtime.includes("version:'v6.582'"), 'Shared feature runtime is not v6.582.');
  assert(runtime.includes("mode:'configuration-driven-shared-feature-runtime'"), 'Shared feature runtime mode is missing.');
  ['columns','columnWidths','popout','reset','more','collapse','exportCurrent','exportAll'].forEach(key => {
    assert(runtime.includes(key + ':'), 'Shared runtime handler is missing: ' + key);
  });
  assert(runtime.includes('enableColumnWidthsV6581(context)'), 'Shared runtime does not enable column widths.');
  assert(runtime.includes('resetColumnWidthsV6581(context)'), 'Shared runtime does not reset column widths.');
  assert(runtime.includes('detachedContextV6581(context)'), 'Detached components do not receive their own width context.');

  assert(features.includes("window.CDA_DASHBOARD_FEATURES_VERSION = 'v6.582'"), 'Feature catalog is not v6.582.');
  assert(features.includes("key:'columnWidths'"), 'columnWidths is not a registered shared feature.');
  assert(features.includes("key:'columnWidths',placement:'service'"), 'columnWidths is not registered as a shared service.');
  assert(features.includes('runtime.run(definition.key,context)'), 'Feature catalog bypasses the shared runtime.');

  assert(toolbar.includes("version:'v6.579'"), 'Toolbar changed unexpectedly.');
  assert(toolbar.includes('runtime.run(featureKey'), 'Toolbar does not dispatch through the shared runtime.');
  assert(toolbar.includes('runtime.syncToolbar'), 'Toolbar does not sync through the shared runtime.');
  assert(titleToggle.includes("version:'v6.579'"), 'Title toggle changed unexpectedly.');

  assert(foundation.includes("includeDashboardFile('SharedDashboardColumnWidthsV6581')"), 'Foundation does not include the shared column-width feature.');
  assert(foundation.indexOf("includeDashboardFile('SharedDashboardColumnsV6548')") < foundation.indexOf("includeDashboardFile('SharedDashboardColumnWidthsV6581')"), 'Visibility must load before column widths.');
  assert(foundation.indexOf("includeDashboardFile('SharedDashboardColumnWidthsV6581')") < foundation.indexOf("includeDashboardFile('SharedDashboardFeatureRuntimeV6579')"), 'Column widths must load before the feature runtime.');
}

function runAllTableCoverageContract(){
  const tat = read('TatDashboardDefinitionV6547.html');
  const remake = read('RemakeDashboardDefinitionV6548.html');

  const tatComponents = [
    ['department','performance'],
    ['performance','product'],
    ['product','customer'],
    ['customer','quality'],
    ['quality',null]
  ];
  tatComponents.forEach(([key,next]) => {
    const block = componentBlock(tat,key,next);
    assert(block.includes('columnWidths'), 'TAT component does not opt into columnWidths: ' + key);
  });
  const promise = componentBlock(tat,'performance','product');
  assert(promise.includes("tableIds:['tatLateTableV6509']"), 'TAT Promise table ID is not explicitly registered.');
  assert(promise.includes("features:CHART_FEATURES.concat(['columnWidths'])"), 'TAT Promise table is not enabled inside the Performance component.');
  assert(promise.includes("label:'Reset Promise column widths'"), 'TAT Promise reset action is not labeled clearly.');

  const remakeComponents = [
    ['reason','department'],
    ['department','product'],
    ['product','customer'],
    ['customer','ceramist'],
    ['ceramist',null]
  ];
  remakeComponents.forEach(([key,next]) => {
    const block = componentBlock(remake,key,next);
    assert(block.includes('columnWidths'), 'Remake component does not opt into columnWidths: ' + key);
  });

  [
    'tatDepartmentTableV6509','tatLateTableV6509','tatProductTableV6562',
    'tatCustomerTableV6509','tatQualityTableV6509',
    'remakeReasonTable','remakeDepartmentTable','remakeProductTable',
    'remakeCustomerTable','remakeCeramistTableV6342','remakeCeramistDetailTableV6343'
  ].forEach(id => {
    assert(tat.includes(id) || remake.includes(id), 'Shared width coverage is missing table surface: ' + id);
  });
}

function runColumnWidthFeatureContract(){
  const columns = read('SharedDashboardColumnsV6548.html');
  const widths = read('SharedDashboardColumnWidthsV6581.html');
  const runtime = read('SharedDashboardFeatureRuntimeV6579.html');
  const features = read('SharedDashboardFeaturesV6547.html');

  assert(columns.includes("const VERSION_V6581 = 'v6.582'"), 'Column visibility service is not v6.582.');
  assert(columns.includes("mode:'shared-visibility-only-rerender-safe'"), 'Column visibility service is not visibility-only.');
  assert(columns.includes('MutationObserver'), 'Column visibility is not reapplied after DOM rerenders.');
  assert(columns.includes('cdaTableRendered'), 'Managed-table visibility rerender hook is missing.');
  assert(columns.includes('cdaDashboardColumnsChanged'), 'Column-change event is missing.');
  assert(columns.includes('numericLabelV6581'), 'DOM text and numeric columns are not classified separately.');
  assert(!columns.includes('cdaColumnWidthHandleV6581'), 'Visibility service still owns resizing.');
  assert(!columns.includes('cdaDashboardColumnWidths.v6581'), 'Visibility service still owns width persistence.');

  assert(widths.includes("const VERSION_V6581 = 'v6.582'"), 'Shared column-width feature is not v6.582.');
  assert(widths.includes("mode:'opt-in-contained-spreadsheet-column-widths'"), 'Shared column-width mode is missing.');
  assert(widths.includes("(component.features || []).indexOf('columnWidths') >= 0"), 'Column widths are not opt-in.');
  const enabledBlock = widths.match(/function enabledV6581[\s\S]*?\n  }/)?.[0] || '';
  assert(enabledBlock && !enabledBlock.includes("component.kind === 'table'"), 'Embedded tables are incorrectly excluded by component kind.');
  assert(!widths.includes("viewport = table.closest && table.closest('.remakeTableWrap')"), 'Outer table wrappers are still reused as scroll owners.');
  assert(widths.includes('overflow-x:auto!important'), 'Horizontal and vertical table scrolling are not owned by one wrapper.');
  assert(widths.includes('overflow-x:auto!important'), 'Detached horizontal scrolling is missing.');
  assert(widths.includes('white-space:nowrap!important'), 'No-wrap behavior is missing.');
  assert(widths.includes('text-overflow:ellipsis!important'), 'Truncation behavior is missing.');
  assert(widths.includes('cdaColumnWidthDragShieldV6581'), 'Spreadsheet-style drag shield is missing.');
  assert(widths.includes('requestAnimationFrame'), 'Resize updates are not animation-frame batched.');
  const moveBlock = widths.match(/drag\.move = function\(moveEvent\)[\s\S]*?\n    };/)?.[0] || '';
  assert(moveBlock, 'Pointer-move handler is missing.');
  assert(!moveBlock.includes('getBoundingClientRect'), 'Pointer movement performs layout measurement and may stutter.');
  assert(!moveBlock.includes('applyWidthMapV6581'), 'Pointer movement rewrites the entire table layout.');
  assert(widths.includes('saveWidthMapV6581'), 'The complete visible width layout is not persisted after a drag.');
  assert(widths.includes('setPointerCapture'), 'Pointer capture is missing.');
  assert(widths.includes('lostpointercapture'), 'Lost pointer-capture cleanup is missing.');
  assert(widths.includes("view.addEventListener('blur'"), 'Window-blur cleanup is missing.');
  assert(widths.includes("doc.addEventListener('visibilitychange'"), 'Visibility cleanup is missing.');
  assert(widths.includes("keyEvent.key === 'Escape'"), 'Escape-to-cancel cleanup is missing.');
  assert(widths.includes('queueMicrotask'), 'Before-paint rerender reapply is missing.');
  assert(widths.includes("localStorage.removeItem('cdaDashboardColumnWidths.v6580')"), 'Experimental v6.580 widths are not cleared once.');
  assert(widths.includes('numericDefaultV6581') && widths.includes('firstColumnMin'), 'Compact numeric and wide primary-column defaults are missing.');
  assert(widths.includes('reset:resetV6581'), 'Reset-to-default width action is missing.');
  assert(runtime.includes('columnWidths:resetColumnWidthsV6581'), 'Shared runtime does not route reset widths.');

  assert(widths.includes("table.parentElement.classList.contains('cdaDashboardTableViewportV6581')"), 'Column widths do not create a dedicated table-only viewport.');
  assert(!widths.includes("viewport = table.closest && table.closest('.remakeTableWrap')"), 'Column widths still reuse outer dashboard wrappers.');
  assert(!widths.includes("frame.style.setProperty('width'"), 'Column widths still widen the shared table frame/card.');
  assert(widths.includes("overflow-x:auto!important"), 'Contained horizontal scrolling is missing.');
  assert(widths.includes("overflow-y:hidden!important"), 'Horizontal viewport does not contain vertical overflow safely.');
  assert(columns.includes("resetWidths.textContent = 'Reset widths'"), 'Reset widths is not in the Columns popover.');
  assert(features.includes("key:'columnWidths',placement:'service'"), 'columnWidths must be service-only, not a More-menu item.');
}

function runDetachedPopoutContract(){
  const isolation = read('SharedDashboardIsolationV6555.html');
  const facade = read('SharedDashboardPopoutV6548.html');
  assert(isolation.includes("version:'v6.561'"), 'Isolation service is not v6.561.');
  assert(isolation.includes("tableMode:'window-scroll-full-table'"), 'Popup window is not the vertical scroll owner.');
  assert(isolation.includes('popup.document.adoptNode(card)'), 'Pop-out does not move the actual card node.');
  assert(isolation.includes('placeholder.replaceWith(session.card)'), 'Pop-out does not restore the same card node.');
  assert(facade.includes("version:'v6.561'"), 'Pop-out facade changed unexpectedly.');
}

function runRemakeNativeHeaderContract(){
  const bridge = read('RemakeDashboardLegacyBridgeV6554.html');
  const adapter = read('RemakeDashboardAdapterV6548.html');
  const decorator = read('SharedDashboardDecoratorV6548.html');
  assert(bridge.includes("version:'v6.566'"), 'Remake bridge is not v6.566.');
  assert(adapter.includes('nativeTitleToggle:true'), 'Remake native title ownership is missing.');
  assert(decorator.includes('if (titleToggle && !nativeTitle)'), 'Decorator rewrites native Remake titles.');
}

function runTatLayoutContract(){
  const definition = read('TatDashboardDefinitionV6547.html');
  const product = read('TatProductTableV6562.html');
  const layout = read('TatDashboardLayoutV6563.html');
  const audit = read('TatProductAuditV6562.html');
  assert(definition.includes('renderHeaderControls:function(){ return layout.headerMarkup(); }'), 'Performance header toggle is missing.');
  assert(definition.indexOf("key:'performance'") < definition.indexOf("key:'product'"), 'Performance must precede Products.');
  assert(product.includes("config.childRows = null"), 'Department product drill-down is not disabled.');
  assert(layout.includes("mode:'remake-parity-two-column-performance-toggle'"), 'Remake-parity mode is missing.');
  assert(!layout.includes('tatPromiseStripV6564') && !layout.includes('tatPromisePanelV6563'), 'Rejected TAT layout remains.');
  assert(audit.includes('performanceAndProductsAreSiblingCards:'), 'TAT audit does not verify sibling cards.');
}

runSharedFeatureRuntimeContract();
runAllTableCoverageContract();
runColumnWidthFeatureContract();
runDetachedPopoutContract();
runRemakeNativeHeaderContract();
runTatLayoutContract();

console.log('Dashboard runtime contracts passed.');
console.log('All 11 shared table surfaces, including TAT Promise: passed');
console.log('Opt-in shared column-width feature: passed');
console.log('Animation-frame spreadsheet-style resizing: passed');
console.log('Complete width-layout persistence and pre-paint restore: passed');
console.log('One table scroll owner with detached horizontal scrolling: passed');
console.log('Compact numeric and elastic primary-column defaults: passed');
console.log('Native Remake collapse ownership: passed');
console.log('Live-node pop-out and restore: passed');
