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
  assert(isolation.includes("version:'v6.559'"), 'Isolation service is not v6.559.');
  assert(isolation.includes("mode:'detached-live-component'"), 'Isolation mode is not detached-live-component.');
  assert(isolation.includes('popup.document.adoptNode(card)'), 'Pop-out does not move the actual card node.');
  assert(isolation.includes('placeholder.replaceWith(session.card)'), 'Pop-out does not restore the same card node.');
  assert(isolation.includes('bridgeSharedEventsV6559(popup)'), 'Pop-out does not bridge shared toolbar events.');
  assert(isolation.includes('copyStylesV6559(sourceDocument,popup.document)'), 'Pop-out does not copy dashboard styles.');
  assert(isolation.includes("window.open('',popupName"), 'Pop-out does not use a same-origin blank window.');
  assert(isolation.includes('card:cardV6559'), 'Isolation does not expose the active detached card.');
  assert(isolation.includes('const wasCollapsed = collapsedV6559(context,card)'),
    'Pop-out does not detect the original collapsed state.');
  assert(isolation.includes('if (wasCollapsed) toggleCollapseV6559(context,card)'),
    'Collapsed cards are not expanded before detachment.');
  assert(isolation.includes('restoreOriginalCollapseV6559(session)'),
    'Original collapsed state is not restored.');
  assert(isolation.includes('grid-column:1 / -1!important'),
    'Detached card does not force full grid width.');
  assert(isolation.includes('width:100%!important;max-width:none!important'),
    'Detached content does not normalize to full width.');
  ['buildUrl','frameUrlFrom','hashRoute','userCodeAppPanel','toBase64Image','toDataURL','outerHTML'].forEach(marker => {
    assert(!isolation.includes(marker), 'Obsolete pop-out marker remains: ' + marker);
  });
  assert(facade.includes("version:'v6.559'"), 'Pop-out facade is not v6.559.');
  assert(facade.includes("mode:'detached-live-component'"), 'Pop-out facade mode is incorrect.');
}

function runDocumentAwareSharedControls() {
  const toolbar = read('SharedDashboardToolbarV6548.html');
  const popover = read('SharedDashboardPopoverV6547.html');
  const columns = read('SharedDashboardColumnsV6548.html');
  const features = read('SharedDashboardFeaturesV6547.html');

  assert(toolbar.includes("version:'v6.558'"), 'Toolbar is not v6.558.');
  assert(toolbar.includes('button.ownerDocument'), 'Toolbar does not carry the clicked ownerDocument.');
  assert(toolbar.includes('card:card'), 'Toolbar context does not carry the actual card.');
  assert(toolbar.includes('cardFor:cardFor'), 'Toolbar does not expose card resolution.');

  assert(popover.includes("version:'v6.558'"), 'Popover is not v6.558.');
  assert(popover.includes('const doc = button.ownerDocument || document'),
    'Popover does not open in the clicked button document.');

  assert(columns.includes("version:'v6.558'"), 'Columns is not v6.558.');
  assert(columns.includes('function documentFor(context)'), 'Columns lacks document resolution.');
  assert(columns.includes('resolveTable(id,context)'), 'Columns table resolution is not context-aware.');
  assert(columns.includes('const doc = panel.ownerDocument || documentFor(context)'),
    'Columns chooser markup is not created in the active document.');

  assert(features.includes("CDA_DASHBOARD_FEATURES_VERSION = 'v6.558'"),
    'Feature catalog is not v6.558.');
  assert(features.includes('const doc = popover.ownerDocument || context.document || document'),
    'More-actions menu is not document-aware.');
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
    'Remake bridge does not restore previously hidden native chevrons.');
  assert(bridge.includes("button.classList.remove('cdaDashboardLegacyControlV6548')"),
    'Native Remake chevron class is not restored.');

  assert(adapter.includes("version:'v6.558'"), 'Remake adapter is not v6.558.');
  assert(adapter.includes('nativeTitleToggle:true'), 'Remake native title ownership is missing.');
  assert(adapter.includes("header.querySelector('.remakeCardActionsV6230')"),
    'Remake does not reuse its native action host.');
  assert(adapter.includes('installNativeCollapseBridgeV6558'),
    'Remake native collapse is not bridged to detached cards.');
  assert(decorator.includes('if (titleToggle && !nativeTitle)'),
    'Decorator still rewrites native Remake titles.');
  const relevantSelectorBlock = bootstrap.match(/function relevantNodeV6559[\s\S]*?\n  }/)?.[0] || '';
  assert(relevantSelectorBlock && !relevantSelectorBlock.includes('.remakeCardTitle'),
    'Remake bootstrap still watches title mutations.');
  assert(bootstrap.includes("bridge:bridge.version === 'v6.559'"),
    'Remake bootstrap expects the wrong bridge version.');
}

function runTatDetachedContract() {
  const adapter = read('TatDashboardAdapterV6547.html');
  const bootstrap = read('TatDashboardBootstrapV6547.html');
  assert(adapter.includes("version:'v6.558'"), 'TAT adapter is not v6.558.');
  assert(adapter.includes('applyDetachedCollapseV6547(context)'),
    'TAT collapse does not update a detached card.');
  assert(bootstrap.includes("componentIsolation:window.cdaDashboardIsolationV6555 && window.cdaDashboardIsolationV6555.version === 'v6.559'"),
    'TAT bootstrap expects the wrong isolation version.');
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
runTatDetachedContract();
runColumnsRegressionGuards();

console.log('Dashboard runtime contracts passed.');
console.log('Full-width detached layout: passed');
console.log('Collapsed-card temporary expansion and restoration: passed');
console.log('Visible native Remake chevron ownership: passed');
console.log('Actual card-node detach and restore: passed');
console.log('Document-aware toolbar, popover, Columns, and More menu: passed');
console.log('No Remake title mutation loop: passed');
console.log('TAT detached controls and collapse: passed');
console.log('Columns regression guards: passed');
