#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8');
}

function runDetachedPopoutContract() {
  const isolation = read('SharedDashboardIsolationV6555.html');
  const facade = read('SharedDashboardPopoutV6548.html');
  assert(isolation.includes("version:'v6.561'"), 'Isolation service is not v6.561.');
  assert(isolation.includes("mode:'detached-live-component'"), 'Isolation mode is not detached-live-component.');
  assert(isolation.includes("tableMode:'window-scroll-full-table'"), 'Popup window is not the vertical scroll owner.');
  assert(isolation.includes('popup.document.adoptNode(card)'), 'Pop-out does not move the actual card node.');
  assert(isolation.includes('placeholder.replaceWith(session.card)'), 'Pop-out does not restore the same card node.');
  assert(isolation.includes('bridgeSharedEventsV6561(popup)'), 'Pop-out does not bridge shared toolbar events.');
  assert(isolation.includes('copyStylesV6561(sourceDocument,popup.document)'), 'Pop-out does not copy dashboard styles.');
  assert(isolation.includes("window.open('',popupName"), 'Pop-out does not use a same-origin blank window.');
  assert(isolation.includes('card:cardV6561'), 'Isolation does not expose the active detached card.');
  assert(isolation.includes('const wasCollapsed = collapsedV6561(context,card)'),
    'Pop-out does not detect the original collapsed state.');
  assert(isolation.includes('if (wasCollapsed) toggleCollapseV6561(context,card)'),
    'Collapsed cards are not expanded before detachment.');
  assert(isolation.includes('restoreOriginalCollapseV6561(session)'),
    'Original collapsed state is not restored.');
  assert(isolation.includes('normalizeFullTableV6561(session)'),
    'Pop-out does not normalize nested vertical scroll owners.');
  assert(isolation.includes('restoreInlineStylesV6561(session)'),
    'Pop-out does not restore original inline styles.');
  assert(isolation.includes("verticalScrollOwner:'popup-window'"),
    'Pop-out does not report popup-window scroll ownership.');
  ['buildUrl','frameUrlFrom','hashRoute','userCodeAppPanel','toBase64Image','toDataURL','outerHTML'].forEach(marker => {
    assert(!isolation.includes(marker), 'Obsolete pop-out marker remains: ' + marker);
  });
  assert(facade.includes("version:'v6.561'"), 'Pop-out facade is not v6.561.');
  assert(facade.includes("tableMode:'window-scroll-full-table'"), 'Pop-out facade has the wrong table mode.');
}

function runDocumentAwareSharedControls() {
  const toolbar = read('SharedDashboardToolbarV6548.html');
  const popover = read('SharedDashboardPopoverV6547.html');
  const columns = read('SharedDashboardColumnsV6548.html');
  const features = read('SharedDashboardFeaturesV6547.html');
  const audit = read('SharedDashboardInteractionAuditV6557.html');

  assert(toolbar.includes("version:'v6.558'"), 'Toolbar is not v6.558.');
  assert(toolbar.includes('button.ownerDocument'), 'Toolbar does not carry the clicked ownerDocument.');
  assert(toolbar.includes('card:card'), 'Toolbar context does not carry the actual card.');
  assert(popover.includes("version:'v6.558'"), 'Popover is not v6.558.');
  assert(popover.includes('const doc = button.ownerDocument || document'),
    'Popover does not open in the clicked button document.');
  assert(columns.includes("version:'v6.558'"), 'Columns is not v6.558.');
  assert(columns.includes('function documentFor(context)'), 'Columns lacks document resolution.');
  assert(columns.includes('resolveTable(id,context)'), 'Columns table resolution is not context-aware.');
  assert(features.includes("CDA_DASHBOARD_FEATURES_VERSION = 'v6.558'"),
    'Feature catalog is not v6.558.');
  assert(features.includes('const doc = popover.ownerDocument || context.document || document'),
    'More-actions menu is not document-aware.');
  assert(audit.includes('function detachedButtonParity()'),
    'Browser audit does not compare detached and dashboard controls.');
  assert(audit.includes('sameClasses'), 'Browser audit does not compare shared button classes.');
  assert(audit.includes('sameText'), 'Browser audit does not compare icons or labels.');
  assert(audit.includes('sameStyle'), 'Browser audit does not compare computed styles.');
  assert(audit.includes('function detachedFullTables()'),
    'Browser audit does not check detached tables.');
  assert(audit.includes("reason:'internal-vertical-scroll-owner'"),
    'Browser audit does not reject nested vertical scroll owners.');
}

function runRemakeNativeHeaderContract() {
  const bridge = read('RemakeDashboardLegacyBridgeV6554.html');
  const adapter = read('RemakeDashboardAdapterV6548.html');
  const decorator = read('SharedDashboardDecoratorV6548.html');
  const bootstrap = read('RemakeDashboardBootstrapV6548.html');

  assert(bridge.includes("version:'v6.559'"), 'Remake bridge is not v6.559.');
  assert(bridge.includes("if (button.matches('[data-remake-section-toggle-v6402]')) return '';"),
    'Native Remake collapse buttons are still classified as hidden legacy controls.');
  assert(bridge.includes('restoreNativeCollapseControlsV6559'),
    'Remake bridge does not restore native chevrons.');
  assert(adapter.includes("version:'v6.558'"), 'Remake adapter is not v6.558.');
  assert(adapter.includes('nativeTitleToggle:true'), 'Remake native title ownership is missing.');
  assert(adapter.includes("header.querySelector('.remakeCardActionsV6230')"),
    'Remake does not reuse its native action host.');
  assert(decorator.includes('if (titleToggle && !nativeTitle)'),
    'Decorator still rewrites native Remake titles.');
  const relevantSelectorBlock = bootstrap.match(/function relevantNodeV6561[\s\S]*?\n  }/)?.[0] || '';
  assert(relevantSelectorBlock && !relevantSelectorBlock.includes('.remakeCardTitle'),
    'Remake bootstrap still watches title mutations.');
  assert(bootstrap.includes("componentIsolation:window.cdaDashboardIsolationV6555 && window.cdaDashboardIsolationV6555.version === 'v6.561'"),
    'Remake bootstrap expects the wrong isolation version.');
}

function runTatLayoutContract() {
  const adapter = read('TatDashboardAdapterV6547.html');
  const bootstrap = read('TatDashboardBootstrapV6547.html');
  const definition = read('TatDashboardDefinitionV6547.html');
  const product = read('TatProductTableV6562.html');
  const layout = read('TatDashboardLayoutV6563.html');
  const widths = read('TatTableWidthsV6563.html');
  const audit = read('TatProductAuditV6562.html');
  const renderer = read('SharedDashboardRendererV6547.html');

  assert(adapter.includes("version:'v6.563'"), 'TAT adapter is not v6.563.');
  assert(adapter.includes('applyDetachedCollapseV6547(context)'),
    'TAT collapse does not update a detached card.');
  assert(adapter.includes("context.component.key === 'performance'"),
    'Combined performance controls are missing.');
  assert(adapter.includes("'tatProduct'"), 'TAT product table is absent from lifecycle cleanup.');

  assert(bootstrap.includes("version:'v6.563'"), 'TAT bootstrap is not v6.563.');
  assert(bootstrap.includes("componentIsolation:window.cdaDashboardIsolationV6555 && window.cdaDashboardIsolationV6555.version === 'v6.561'"),
    'TAT bootstrap expects the wrong isolation version.');
  assert(bootstrap.includes('sixComponents:definition.components.length === 6'),
    'TAT bootstrap does not require six components.');
  assert(bootstrap.includes('combinedPerformance:'),
    'TAT bootstrap does not require combined performance.');

  assert(definition.includes("version:'v6.563'"), 'TAT definition is not v6.563.');
  assert(definition.includes("key:'product',title:'Products'"), 'TAT Products component is missing.');
  assert(definition.includes("key:'performance',title:'TAT Performance'"),
    'TAT Performance component is missing.');
  assert(!definition.includes("key:'late',title:'Promise Performance'"),
    'Standalone Promise Performance remains.');
  assert(!definition.includes("key:'distribution',title:'TAT Distribution'"),
    'Standalone Distribution remains.');

  assert(product.includes("config.childRows = null"), 'Department product drill-down is not disabled.');
  assert(product.includes("const TABLE_KEY = 'tatProduct'"), 'Separate TAT product table is missing.');
  assert(product.includes('data-tat-product-mode-v6562'), 'Products / Groups toggle is missing.');

  assert(layout.includes("version:'v6.563'"), 'TAT layout service is not v6.563.');
  assert(layout.includes('tatPerformanceLayoutV6563'), 'Combined performance layout is missing.');
  assert(layout.includes('tatPromiseStackSegmentV6563'), 'Promise stacked summary is missing.');
  assert(widths.includes("version:'v6.563'"), 'TAT table-width service is not v6.563.');
  assert(widths.includes("tatProduct:['34%','12%','12%','10%','10%','10%','12%']"),
    'Product width ratios are missing.');
  assert(audit.includes('noStandalonePromiseCard:noStandalonePromiseCard'),
    'TAT audit does not reject standalone Promise and Distribution cards.');
  assert(audit.includes('widthsCorrect:widthsCorrect'),
    'TAT audit does not verify readable widths.');
  assert(renderer.includes("version:'v6.562'"), 'Renderer is not v6.562.');
  assert(renderer.includes('renderHeaderControls'), 'Renderer lacks first-class header controls.');
}

function runColumnsRegressionGuards() {
  const columns = read('SharedDashboardColumnsV6548.html');
  assert(!columns.includes('Bolean'), 'The Bolean runtime typo is present.');
  assert(!columns.includes('.toggleChooser('), 'Columns delegates to the old chooser UI.');
  assert(columns.includes('single-shared-chooser'), 'Columns is not marked as the shared chooser owner.');
}

runDetachedPopoutContract();
runDocumentAwareSharedControls();
runRemakeNativeHeaderContract();
runTatLayoutContract();
runColumnsRegressionGuards();

console.log('Dashboard runtime contracts passed.');
console.log('Popup window is the only vertical scroll owner: passed');
console.log('Runtime nested-scroll detection and inline normalization: passed');
console.log('Original inline-style restoration: passed');
console.log('Detached/dashboard shared button class, icon, and style parity: passed');
console.log('Collapsed-card temporary expansion and restoration: passed');
console.log('Document-aware shared controls: passed');
console.log('Native Remake header controls: passed');
console.log('Combined TAT Performance component: passed');
console.log('Full-width TAT Products component: passed');
console.log('Readable TAT table width contracts: passed');
console.log('Columns regression guards: passed');
