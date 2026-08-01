#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const assert = (condition,message) => { if (!condition) throw new Error(message); };

function runSharedFeatureRuntimeContract(){
  const registry = read('SharedDashboardRegistryV6547.html');
  const runtime = read('SharedDashboardFeatureRuntimeV6579.html');
  const features = read('SharedDashboardFeaturesV6547.html');
  const toolbar = read('SharedDashboardToolbarV6548.html');
  const titleToggle = read('SharedDashboardTitleToggleV6555.html');
  const foundation = read('SharedComponentFoundation.html');
  const tatDefinition = read('TatDashboardDefinitionV6547.html');
  const remakeDefinition = read('RemakeDashboardDefinitionV6548.html');

  assert(registry.includes("version:VERSION_V6547"), 'Registry platform export is missing.');
  assert(registry.includes("const VERSION_V6547 = 'v6.579'"), 'Registry is not v6.579.');
  assert(registry.includes('featureOptions:normalizeFeatureOptionsV6579'), 'Component feature options are not normalized.');

  assert(runtime.includes("version:'v6.579'"), 'Shared feature runtime is not v6.579.');
  assert(runtime.includes("mode:'configuration-driven-shared-feature-runtime'"), 'Shared feature runtime mode is missing.');
  ['columns','popout','reset','more','collapse','exportCurrent','exportAll'].forEach(key => {
    assert(runtime.includes(key + ':'), 'Shared runtime handler is missing: ' + key);
  });
  assert(runtime.includes('function supportsV6579'), 'Shared runtime supports contract is missing.');
  assert(runtime.includes('function syncToolbarV6579'), 'Shared runtime sync contract is missing.');
  assert(runtime.includes('options.adapterMethod'), 'Feature adapter configuration is missing.');

  assert(features.includes("window.CDA_DASHBOARD_FEATURES_VERSION = 'v6.579'"), 'Feature catalog is not v6.579.');
  assert(features.includes('runtime.run(definition.key,context)'), 'Feature catalog bypasses the shared runtime.');
  assert(!features.includes('function callAdapter('), 'Feature catalog still owns adapter dispatch.');

  assert(toolbar.includes("version:'v6.579'"), 'Toolbar is not v6.579.');
  assert(toolbar.includes('runtime.run(featureKey'), 'Toolbar does not dispatch through the shared runtime.');
  assert(toolbar.includes('runtime.syncToolbar'), 'Toolbar does not sync through the shared runtime.');
  assert(toolbar.includes('button.ownerDocument'), 'Toolbar does not carry ownerDocument.');

  assert(titleToggle.includes("version:'v6.579'"), 'Title toggle is not v6.579.');
  assert(titleToggle.includes("runtime.run('collapse'"), 'Title collapse bypasses the shared runtime.');
  assert(titleToggle.includes("runtime.isActive('collapse'"), 'Title collapse state bypasses the shared runtime.');

  assert(foundation.includes("includeDashboardFile('SharedDashboardFeatureRuntimeV6579')"), 'Foundation does not include the shared feature runtime.');
  assert(foundation.indexOf("includeDashboardFile('SharedDashboardPopoutV6548')") < foundation.indexOf("includeDashboardFile('SharedDashboardFeatureRuntimeV6579')"), 'Pop-out must load before the feature runtime.');
  assert(foundation.indexOf("includeDashboardFile('SharedDashboardFeatureRuntimeV6579')") < foundation.indexOf("includeDashboardFile('SharedDashboardFeaturesV6547')"), 'Feature runtime must load before the feature catalog.');

  assert(tatDefinition.includes("version:'v6.579'"), 'TAT definition is not v6.579.');
  assert(tatDefinition.includes('featureOptions:'), 'TAT components do not opt into configured feature behavior.');
  assert(tatDefinition.includes("columns:{adapterMethod:'openColumns'}"), 'TAT chart-series column plugin is missing.');
  assert(tatDefinition.includes("collapse:COLLAPSE_OPTIONS"), 'TAT collapse plugin is missing.');

  assert(remakeDefinition.includes("version:'v6.579'"), 'Remake definition is not v6.579.');
  assert(remakeDefinition.includes("comparePriorYear:COMPARE_OPTIONS"), 'Remake prior-year plugin is missing.');
  assert(remakeDefinition.includes("collapse:COLLAPSE_OPTIONS"), 'Remake native collapse compatibility plugin is missing.');
  assert(remakeDefinition.includes("popout:{adapterMethod:'popout'}"), 'Remake detached comparison pop-out compatibility is missing.');
}

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
  const popover = read('SharedDashboardPopoverV6547.html');
  const columns = read('SharedDashboardColumnsV6548.html');
  const audit = read('SharedDashboardInteractionAuditV6557.html');
  assert(popover.includes("version:'v6.558'"), 'Popover is not v6.558.');
  assert(columns.includes("version:'v6.558'"), 'Columns is not v6.558.');
  assert(columns.includes('function documentFor(context)'), 'Columns lacks document resolution.');
  assert(columns.includes('single-shared-chooser'), 'Columns is not the shared chooser owner.');
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
  const bootstrap = read('TatDashboardBootstrapV6547.html');
  const definition = read('TatDashboardDefinitionV6547.html');
  const product = read('TatProductTableV6562.html');
  const layout = read('TatDashboardLayoutV6563.html');
  const widths = read('TatTableWidthsV6563.html');
  const audit = read('TatProductAuditV6562.html');
  const renderer = read('SharedDashboardRendererV6547.html');

  assert(bootstrap.includes("version:'v6.565'"), 'TAT bootstrap is not v6.565.');
  assert(bootstrap.includes('siblingCardWidths:'), 'Bootstrap does not require sibling card widths.');
  assert(bootstrap.includes('performanceToggle:'), 'Bootstrap does not require the performance toggle.');
  assert(definition.includes('renderHeaderControls:function(){ return layout.headerMarkup(); }'), 'Performance header toggle is missing.');
  assert(definition.includes('data-tat-performance-view-v6565="distribution"'), 'Distribution view is missing.');
  assert(definition.includes('data-tat-performance-view-v6565="promise"'), 'Promise view is missing.');
  assert(!definition.includes("targetId:'tatDistributionChartV6509',\n      tableKey:'tatLate',secondaryComponentKeys:['distribution','late'],wide:true"), 'Performance remains full-width.');
  assert(!definition.includes("targetId:'tatProductTableV6562',wide:true"), 'Products remains full-width.');
  assert(definition.indexOf("key:'performance'") < definition.indexOf("key:'product'"), 'Performance must precede Products.');
  assert(product.includes("config.childRows = null"), 'Department product drill-down is not disabled.');
  assert(product.includes('data-tat-product-mode-v6562'), 'Products / Groups toggle is missing.');
  assert(layout.includes("mode:'remake-parity-two-column-performance-toggle'"), 'Remake-parity mode is missing.');
  assert(layout.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'Equal two-column TAT grid is missing.');
  assert(!layout.includes('tatPromiseStripV6564'), 'Rejected promise strip remains.');
  assert(!layout.includes('tatPromisePanelV6563'), 'Rejected promise panel remains.');
  assert(widths.includes("tatProduct:['34%','12%','12%','10%','10%','10%','12%']"), 'Product width ratios are missing.');
  assert(audit.includes('performanceAndProductsAreSiblingCards:'), 'Audit does not verify sibling cards.');
  assert(renderer.includes("version:'v6.562'"), 'Renderer is not v6.562.');
}

function runColumnsRegressionGuards(){
  const columns = read('SharedDashboardColumnsV6548.html');
  assert(!columns.includes('Bolean'), 'The Bolean runtime typo is present.');
  assert(!columns.includes('.toggleChooser('), 'Columns delegates to the old chooser UI.');
}

runSharedFeatureRuntimeContract();
runDetachedPopoutContract();
runDocumentAwareSharedControls();
runRemakeNativeHeaderContract();
runTatLayoutContract();
runColumnsRegressionGuards();

console.log('Dashboard runtime contracts passed.');
console.log('Configuration-driven shared feature runtime: passed');
console.log('Native Remake collapse ownership: passed');
console.log('Live-node pop-out and restore: passed');
console.log('Remake-parity TAT layout: passed');
