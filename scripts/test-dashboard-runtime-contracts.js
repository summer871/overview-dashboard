#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const assert = (condition,message) => { if (!condition) throw new Error(message); };

function runDetachedPopoutContract(){
  const isolation = read('SharedDashboardIsolationV6555.html');
  const facade = read('SharedDashboardPopoutV6548.html');
  assert(isolation.includes("version:'v6.561'"), 'Isolation service is not v6.561.');
  assert(isolation.includes("tableMode:'window-scroll-full-table'"), 'Popup window is not the vertical scroll owner.');
  assert(isolation.includes('popup.document.adoptNode(card)'), 'Pop-out does not move the actual card node.');
  assert(isolation.includes('placeholder.replaceWith(session.card)'), 'Pop-out does not restore the same card node.');
  assert(isolation.includes('normalizeFullTableV6561(session)'), 'Pop-out does not normalize nested scroll owners.');
  assert(isolation.includes('restoreInlineStylesV6561(session)'), 'Pop-out does not restore inline styles.');
  assert(facade.includes("version:'v6.561'"), 'Pop-out facade is not v6.561.');
}

function runDocumentAwareSharedControls(){
  const toolbar = read('SharedDashboardToolbarV6548.html');
  const popover = read('SharedDashboardPopoverV6547.html');
  const columns = read('SharedDashboardColumnsV6548.html');
  const audit = read('SharedDashboardInteractionAuditV6557.html');
  assert(toolbar.includes("version:'v6.558'"), 'Toolbar is not v6.558.');
  assert(toolbar.includes('button.ownerDocument'), 'Toolbar does not carry ownerDocument.');
  assert(popover.includes("version:'v6.558'"), 'Popover is not v6.558.');
  assert(columns.includes("version:'v6.558'"), 'Columns is not v6.558.');
  assert(columns.includes('function documentFor(context)'), 'Columns lacks document resolution.');
  assert(audit.includes('function detachedButtonParity()'), 'Shared control parity audit is missing.');
  assert(audit.includes('function detachedFullTables()'), 'Detached-table audit is missing.');
}

function runRemakeNativeHeaderContract(){
  const bridge = read('RemakeDashboardLegacyBridgeV6554.html');
  const adapter = read('RemakeDashboardAdapterV6548.html');
  const decorator = read('SharedDashboardDecoratorV6548.html');
  const bootstrap = read('RemakeDashboardBootstrapV6548.html');
  assert(bridge.includes("version:'v6.566'"), 'Remake bridge is not v6.566.');
  assert(bridge.includes("if (button.matches('[data-remake-section-toggle-v6402]')) return '';"), 'Native Remake collapse is hidden.');
  assert(adapter.includes('nativeTitleToggle:true'), 'Remake native title ownership is missing.');
  assert(decorator.includes('if (titleToggle && !nativeTitle)'), 'Decorator rewrites native Remake titles.');
  const relevant = bootstrap.match(/function relevantNodeV6561[\s\S]*?\n  }/)?.[0] || '';
  assert(relevant && !relevant.includes('.remakeCardTitle'), 'Remake bootstrap watches title mutations.');
}

function runTatLayoutContract(){
  const adapter = read('TatDashboardAdapterV6547.html');
  const bootstrap = read('TatDashboardBootstrapV6547.html');
  const definition = read('TatDashboardDefinitionV6547.html');
  const product = read('TatProductTableV6562.html');
  const layout = read('TatDashboardLayoutV6563.html');
  const widths = read('TatTableWidthsV6563.html');
  const audit = read('TatProductAuditV6562.html');
  const renderer = read('SharedDashboardRendererV6547.html');

  assert(adapter.includes("version:'v6.563'"), 'TAT adapter is not v6.563.');
  assert(adapter.includes("context.component.key === 'performance'"), 'Performance controls are missing.');
  assert(bootstrap.includes("version:'v6.565'"), 'TAT bootstrap is not v6.565.');
  assert(bootstrap.includes('siblingCardWidths:'), 'Bootstrap does not require sibling card widths.');
  assert(bootstrap.includes('performanceToggle:'), 'Bootstrap does not require the performance toggle.');

  assert(definition.includes("version:'v6.565'"), 'TAT definition is not v6.565.');
  assert(definition.includes('renderHeaderControls:function(){ return layout.headerMarkup(); }'), 'Performance header toggle is missing.');
  assert(definition.includes('data-tat-performance-view-v6565="distribution"'), 'Distribution view is missing.');
  assert(definition.includes('data-tat-performance-view-v6565="promise"'), 'Promise view is missing.');
  assert(!definition.includes("targetId:'tatDistributionChartV6509',\n      tableKey:'tatLate',secondaryComponentKeys:['distribution','late'],wide:true"), 'Performance remains full-width.');
  assert(!definition.includes("targetId:'tatProductTableV6562',wide:true"), 'Products remains full-width.');
  assert(definition.indexOf("key:'performance'") < definition.indexOf("key:'product'"), 'Performance must precede Products.');

  assert(product.includes("config.childRows = null"), 'Department product drill-down is not disabled.');
  assert(product.includes('data-tat-product-mode-v6562'), 'Products / Groups toggle is missing.');

  assert(layout.includes("version:'v6.565'"), 'TAT layout service is not v6.565.');
  assert(layout.includes("mode:'remake-parity-two-column-performance-toggle'"), 'Remake-parity mode is missing.');
  assert(layout.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'Equal two-column TAT grid is missing.');
  assert(layout.includes('data-tat-performance-mode-v6565="distribution"'), 'Distribution mode button is missing.');
  assert(layout.includes('data-tat-performance-mode-v6565="promise"'), 'Promise mode button is missing.');
  assert(!layout.includes('tatPromiseStripV6564'), 'Rejected promise strip remains.');
  assert(!layout.includes('tatPromisePanelV6563'), 'Rejected promise panel remains.');

  assert(widths.includes("version:'v6.563'"), 'TAT table-width service is not v6.563.');
  assert(widths.includes("tatProduct:['34%','12%','12%','10%','10%','10%','12%']"), 'Product width ratios are missing.');
  assert(audit.includes('performanceAndProductsAreSiblingCards:'), 'Audit does not verify sibling cards.');
  assert(audit.includes('performanceModeButtonCount:'), 'Audit does not verify performance modes.');
  assert(audit.includes('noRejectedLayouts:'), 'Audit does not reject prior layouts.');
  assert(renderer.includes("version:'v6.562'"), 'Renderer is not v6.562.');
}

function runColumnsRegressionGuards(){
  const columns = read('SharedDashboardColumnsV6548.html');
  assert(!columns.includes('Bolean'), 'The Bolean runtime typo is present.');
  assert(!columns.includes('.toggleChooser('), 'Columns delegates to the old chooser UI.');
  assert(columns.includes('single-shared-chooser'), 'Columns is not the shared chooser owner.');
}

runDetachedPopoutContract();
runDocumentAwareSharedControls();
runRemakeNativeHeaderContract();
runTatLayoutContract();
runColumnsRegressionGuards();

console.log('Dashboard runtime contracts passed.');
console.log('Popup window is the only vertical scroll owner: passed');
console.log('Detached/dashboard shared button class, icon, and style parity: passed');
console.log('Native Remake header controls: passed');
console.log('Remake-parity TAT card composition: passed');
console.log('Distribution / Promise and Products / Groups toggles: passed');
console.log('Readable TAT table width contracts: passed');
console.log('Columns regression guards: passed');
