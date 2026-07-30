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
  assert(isolation.includes("version:'v6.558'"), 'Isolation service is not v6.558.');
  assert(isolation.includes("mode:'detached-live-component'"), 'Isolation mode is not detached-live-component.');
  assert(isolation.includes('popup.document.adoptNode(card)'), 'Pop-out does not move the actual card node.');
  assert(isolation.includes('placeholder.replaceWith(session.card)'), 'Pop-out does not restore the same card node.');
  assert(isolation.includes('bridgeSharedEventsV6558(popup)'), 'Pop-out does not bridge shared toolbar events.');
  assert(isolation.includes('copyStylesV6558(sourceDocument,popup.document)'), 'Pop-out does not copy dashboard styles.');
  assert(isolation.includes("window.open('',popupName"), 'Pop-out does not use a same-origin blank window.');
  assert(isolation.includes('card:cardV6558'), 'Isolation does not expose the active detached card.');
  ['buildUrl','frameUrlFrom','hashRoute','userCodeAppPanel','toBase64Image','toDataURL','outerHTML'].forEach(marker => {
    assert(!isolation.includes(marker), 'Obsolete pop-out marker remains: ' + marker);
  });
  assert(facade.includes("version:'v6.558'"), 'Pop-out facade is not v6.558.');
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
  assert(popover.includes('activeDocument:function(){ return activeDocument; }'),
    'Popover does not expose active document ownership.');

  assert(columns.includes("version:'v6.558'"), 'Columns is not v6.558.');
  assert(columns.includes('function documentFor(context)'), 'Columns lacks document resolution.');
  assert(columns.includes('resolveTable(id,context)'), 'Columns table resolution is not context-aware.');
  assert(columns.includes('const doc = panel.ownerDocument || documentFor(context)'),
    'Columns chooser markup is not created in the active document.');
  assert(!columns.includes('const node = document.getElementById(id)'),
    'Columns still hardcodes original-document table lookup.');

  assert(features.includes("CDA_DASHBOARD_FEATURES_VERSION = 'v6.558'"),
    'Feature catalog is not v6.558.');
  assert(features.includes('const doc = popover.ownerDocument || context.document || document'),
    'More-actions menu is not document-aware.');
}

function runRemakeNativeHeaderContract() {
  const adapter = read('RemakeDashboardAdapterV6548.html');
  const decorator = read('SharedDashboardDecoratorV6548.html');
  const bootstrap = read('RemakeDashboardBootstrapV6548.html');
  assert(adapter.includes("version:'v6.558'"), 'Remake adapter is not v6.558.');
  assert(adapter.includes('nativeTitleToggle:true'), 'Remake native title ownership is missing.');
  assert(adapter.includes("header.querySelector('.remakeCardActionsV6230')"),
    'Remake does not reuse its native action host.');
  assert(adapter.includes("data-cda-dashboard-shared-host','native-remake-actions'"),
    'Native Remake action host marker is missing.');
  assert(!adapter.includes("header.querySelector(':scope > .cdaDashboardDecoratedActionsV6548')"),
    'Separate Remake action host is still active.');
  assert(adapter.includes('installNativeCollapseBridgeV6558'),
    'Remake native collapse is not bridged to detached cards.');
  assert(adapter.includes('isolation.card(componentId)'),
    'Remake detached collapse cannot resolve the active card.');
  assert(adapter.includes('context && context.card || bridge.card(component)'),
    'Remake actions do not prefer the clicked card.');
  assert(decorator.includes("version:'v6.558'"), 'Decorator is not v6.558.');
  assert(decorator.includes('if (titleToggle && !nativeTitle)'),
    'Decorator still rewrites native Remake titles.');
  const relevantSelectorBlock = bootstrap.match(/function relevantNodeV6558[\s\S]*?\n  }/)?.[0] || '';
  assert(relevantSelectorBlock && !relevantSelectorBlock.includes('.remakeCardTitle'),
    'Remake bootstrap still watches title mutations.');
  assert(bootstrap.includes("sharedColumns:window.cdaDashboardColumnsV6548 && window.cdaDashboardColumnsV6548.version === 'v6.558'"),
    'Remake bootstrap expects the wrong Columns version.');
}

function runTatDetachedContract() {
  const adapter = read('TatDashboardAdapterV6547.html');
  const bootstrap = read('TatDashboardBootstrapV6547.html');
  assert(adapter.includes("version:'v6.558'"), 'TAT adapter is not v6.558.');
  assert(adapter.includes('const doc = popover.ownerDocument || context.document || document'),
    'TAT chart-series chooser is not document-aware.');
  assert(adapter.includes('applyDetachedCollapseV6547(context)'),
    'TAT collapse does not update a detached card.');
  assert(adapter.includes('card.classList.toggle(\'collapsed\',collapsed)'),
    'TAT detached card class is not synchronized.');
  assert(bootstrap.includes("adapter:window.cdaTatDashboardAdapterV6547 && window.cdaTatDashboardAdapterV6547.version === 'v6.558'"),
    'TAT bootstrap expects the wrong adapter version.');
}

function runTitleContract() {
  const title = read('SharedDashboardTitleToggleV6555.html');
  assert(title.includes("version:'v6.556'"), 'Shared title service version is incorrect.');
  assert(title.includes('ARROW_REPLACE_PATTERN_V6556'), 'Shared title cleanup is missing.');
  assert(title.includes('title.replaceChildren(button)'), 'Shared TAT title replacement is missing.');
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
runTitleContract();
runColumnsRegressionGuards();

console.log('Dashboard runtime contracts passed.');
console.log('Actual card-node detach and restore: passed');
console.log('Document-aware toolbar, popover, Columns, and More menu: passed');
console.log('Native Remake action-host and detached collapse ownership: passed');
console.log('No Remake title mutation loop: passed');
console.log('TAT detached chart controls and collapse: passed');
console.log('Shared TAT title contract: passed');
console.log('Columns regression guards: passed');
