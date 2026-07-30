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
  ['buildUrl','frameUrlFrom','hashRoute','userCodeAppPanel','toBase64Image','toDataURL','outerHTML'].forEach(marker => {
    assert(!isolation.includes(marker), 'Obsolete pop-out marker remains: ' + marker);
  });
  assert(facade.includes("version:'v6.558'"), 'Pop-out facade is not v6.558.');
  assert(facade.includes("mode:'detached-live-component'"), 'Pop-out facade mode is incorrect.');
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
  assert(decorator.includes("version:'v6.558'"), 'Decorator is not v6.558.');
  assert(decorator.includes('if (titleToggle && !nativeTitle)'),
    'Decorator still rewrites native Remake titles.');
  const relevantSelectorBlock = bootstrap.match(/function relevantNodeV6558[\s\S]*?\n  }/)?.[0] || '';
  assert(relevantSelectorBlock && !relevantSelectorBlock.includes('.remakeCardTitle'),
    'Remake bootstrap still watches title mutations.');
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
runRemakeNativeHeaderContract();
runTitleContract();
runColumnsRegressionGuards();

console.log('Dashboard runtime contracts passed.');
console.log('Actual card-node detach and restore: passed');
console.log('Same-origin popup and shared-event bridge: passed');
console.log('Native Remake action-host ownership: passed');
console.log('No Remake title mutation loop: passed');
console.log('Shared TAT title contract: passed');
console.log('Columns regression guards: passed');
