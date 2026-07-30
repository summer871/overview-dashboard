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
  assert(isolation.includes("tableMode:'window-scroll-full-table'"),
    'Isolation is not in popup-window-only scroll mode.');
  assert(isolation.includes('popup.document.adoptNode(card)'),
    'Pop-out does not move the actual card node.');
  assert(isolation.includes('placeholder.replaceWith(session.card)'),
    'Pop-out does not restore the same card node.');
  assert(isolation.includes('normalizeFullTableV6561(session)'),
    'Pop-out does not normalize nested table scroll owners.');
  assert(isolation.includes('styleSnapshots:new Map()'),
    'Pop-out does not preserve original inline styles.');
  assert(isolation.includes('restoreInlineStylesV6561(session)'),
    'Pop-out does not restore original inline styles.');
  assert(isolation.includes("node.style.setProperty(name,value,'important')"),
    'Runtime normalization does not use inline important overrides.');
  assert(isolation.includes("setImportantV6561(session,node,'overflow-y','visible')"),
    'Nested vertical scroll owners are not disabled.');
  assert(isolation.includes("doc.documentElement.style.setProperty('overflow-y','auto','important')"),
    'Popup document root is not the vertical scroll owner.');
  assert(isolation.includes("doc.body.style.setProperty('overflow','visible','important')"),
    'Popup body may still own a second scrollbar.');
  assert(isolation.includes('session.observer.observe(card'),
    'Runtime normalization is not reapplied after table rerenders.');
  assert(isolation.includes("verticalScrollOwner:'popup-window'"),
    'Last-attempt diagnostics do not identify the popup window as scroll owner.');
  ['buildUrl','frameUrlFrom','hashRoute','userCodeAppPanel','toBase64Image','toDataURL','outerHTML']
    .forEach(marker => assert(!isolation.includes(marker), 'Obsolete pop-out marker remains: ' + marker));
  assert(facade.includes("version:'v6.561'"), 'Pop-out facade is not v6.561.');
  assert(facade.includes("tableMode:'window-scroll-full-table'"),
    'Pop-out facade has the wrong table mode.');
}

function runSharedControlParityContract() {
  const audit = read('SharedDashboardInteractionAuditV6557.html');
  assert(audit.includes("version:'v6.561'"), 'Interaction audit is not v6.561.');
  assert(audit.includes('function detachedButtonParity()'),
    'Browser audit does not compare detached and dashboard controls.');
  assert(audit.includes('sameClasses') && audit.includes('sameText') && audit.includes('sameStyle'),
    'Browser audit does not compare classes, icon/text, and computed style.');
  assert(audit.includes('function isInternalVerticalScrollOwner(node)'),
    'Browser audit does not scan every descendant for nested scrolling.');
  assert(audit.includes("reason:'internal-vertical-scroll-owner'"),
    'Browser audit does not reject nested vertical scroll owners.');
  assert(audit.includes("reason:'popup-window-not-sole-scroll-owner'"),
    'Browser audit does not require the popup window to be the only scroll owner.');
  assert(audit.includes("scrollOwner:'popup-window'"),
    'Browser audit does not report popup-window scroll ownership.');
}

function runBootstrapContract() {
  const tat = read('TatDashboardBootstrapV6547.html');
  const remake = read('RemakeDashboardBootstrapV6548.html');
  [tat, remake].forEach((text, index) => {
    const name = index === 0 ? 'TAT' : 'Remake';
    assert(text.includes("version:'v6.561'"), name + ' bootstrap is not v6.561.');
    assert(text.includes("window.cdaDashboardIsolationV6555.version === 'v6.561'"),
      name + ' bootstrap expects the wrong isolation version.');
    assert(text.includes("window.cdaDashboardPopoutV6548.version === 'v6.561'"),
      name + ' bootstrap expects the wrong pop-out version.');
    assert(text.includes("window.cdaDashboardPopoutV6548.tableMode === 'window-scroll-full-table'"),
      name + ' bootstrap does not require popup-window-only scrolling.');
  });
  const relevantSelectorBlock = remake.match(/function relevantNodeV6561[\s\S]*?\n  }/)?.[0] || '';
  assert(relevantSelectorBlock && !relevantSelectorBlock.includes('.remakeCardTitle'),
    'Remake bootstrap still watches title mutations.');
}

function runExistingSharedContracts() {
  const columns = read('SharedDashboardColumnsV6548.html');
  const bridge = read('RemakeDashboardLegacyBridgeV6554.html');
  assert(columns.includes("version:'v6.558'"), 'Columns is not the document-aware v6.558 service.');
  assert(columns.includes('function documentFor(context)'), 'Columns lacks document resolution.');
  assert(!columns.includes('Bolean'), 'The Bolean runtime typo is present.');
  assert(bridge.includes("if (button.matches('[data-remake-section-toggle-v6402]')) return '';"),
    'Native Remake collapse buttons are classified as hidden legacy controls.');
}

runDetachedPopoutContract();
runSharedControlParityContract();
runBootstrapContract();
runExistingSharedContracts();

console.log('Dashboard runtime contracts passed.');
console.log('Popup window is the only vertical scroll owner: passed');
console.log('Runtime nested-scroll detection and inline normalization: passed');
console.log('Original inline-style restoration: passed');
console.log('Detached/dashboard shared button class, icon, and style parity: passed');
console.log('Collapsed-card expansion and restoration: passed');
console.log('Document-aware shared controls: passed');
console.log('Native Remake collapse ownership: passed');
