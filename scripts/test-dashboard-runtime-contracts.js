#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8');
}

function scriptBodies(fileName) {
  return Array.from(read(fileName).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).map(match => match[1]);
}

function firstScript(fileName) {
  const bodies = scriptBodies(fileName);
  assert(bodies.length, fileName + ' has no executable script.');
  return bodies[0];
}

const popoutSource = read('SharedDashboardPopoutV6548.html');
const isolationSource = read('SharedDashboardIsolationV6555.html');
const catalogSource = read('SharedDashboardCatalogV6555.html');
const featuresSource = read('SharedDashboardFeaturesV6547.html');
const titleToggleSource = read('SharedDashboardTitleToggleV6555.html');
const rendererSource = read('SharedDashboardRendererV6547.html');
const decoratorSource = read('SharedDashboardDecoratorV6548.html');
const remakeDefinition = read('RemakeDashboardDefinitionV6548.html');
const tatDefinition = read('TatDashboardDefinitionV6547.html');

assert(!popoutSource.includes('toBase64Image'), 'Pop-out still converts charts to images.');
assert(!popoutSource.includes('toDataURL'), 'Pop-out still converts canvas content to an image.');
assert(!popoutSource.includes('outerHTML'), 'Pop-out still copies static table markup.');
assert(!popoutSource.includes('documentHtml'), 'Pop-out still owns a simplified document renderer.');
assert(popoutSource.includes("mode:'same-application-live-component'"), 'Pop-out is not marked as a live same-application component.');
assert(popoutSource.includes('isolation.open(context)'), 'Pop-out does not delegate to live isolation.');

assert(isolationSource.includes("url.searchParams.set('component'"), 'Isolation route does not include the component identity.');
assert(isolationSource.includes("url.searchParams.set('presentation','all')"), 'Isolation route does not load the complete application.');
assert(isolationSource.includes('catalog.waitFor'), 'Isolation does not wait for the real rendered component.');
assert(isolationSource.includes("data-cda-isolated-component"), 'Isolation does not mark the real component card.');
assert(isolationSource.includes("[data-cda-dashboard-feature-key=\"popout\"]"), 'Isolation does not prevent recursive pop-outs.');

assert(catalogSource.includes("return String(tabKey || '').trim() + '.' + String(componentKey || '').trim()"), 'Catalog lacks stable tab.component identities.');
assert(catalogSource.includes('data-cda-component-id'), 'Catalog does not stamp stable component identity.');
assert(catalogSource.includes('capabilities:{'), 'Catalog does not expose component capabilities.');
assert(catalogSource.includes('resolveCard'), 'Catalog does not expose card resolution.');
assert(catalogSource.includes('resolveTarget'), 'Catalog does not expose target resolution.');

assert(featuresSource.includes("key:'collapse', placement:'title'"), 'Collapse is not owned by the title placement.');
assert(!featuresSource.includes("key:'collapse', placement:'toolbar'"), 'Collapse is still registered as a toolbar feature.');
assert(titleToggleSource.includes('cdaDashboardTitleToggleV6555'), 'Shared title toggle service is missing.');
assert(titleToggleSource.includes('adapter.collapse'), 'Title toggle does not call the tab adapter.');
assert(titleToggleSource.includes("data-cda-dashboard-title-toggle"), 'Title toggle lacks an auditable identity.');

assert(rendererSource.includes('data-cda-component-id'), 'Replace renderer does not stamp component identities.');
assert(rendererSource.includes('titleToggle.mount'), 'Replace renderer does not mount title interactions.');
assert(decoratorSource.includes('catalog.stamp'), 'Decorator does not stamp existing cards.');
assert(decoratorSource.includes('titleToggle.mount'), 'Decorator does not mount title interactions.');

assert(remakeDefinition.includes("version:'v6.555'"), 'Remake definition is not v6.555.');
assert(tatDefinition.includes("version:'v6.555'"), 'TAT definition is not v6.555.');
assert(remakeDefinition.includes("tabButtonId:'remakeFactorTabBtn'"), 'Remake tab route lacks a tab button identity.');
assert(tatDefinition.includes("tabButtonId:'tatTabBtnV6509'"), 'TAT tab route lacks a tab button identity.');

let delegatedContext = null;
const isolation = {
  version:'v6.555',
  open(context) {
    delegatedContext = context;
    return true;
  },
  buildUrl(tabKey, componentKey) {
    return 'https://script.google.com/macros/s/test/dev?presentation=all&component=' + tabKey + '.' + componentKey;
  }
};
const context = {
  window:{cdaDashboardIsolationV6555:isolation},
  console,
  Object,
  String
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(firstScript('SharedDashboardPopoutV6548.html'), context, {
  filename:'SharedDashboardPopoutV6548.html'
});
const popout = context.window.cdaDashboardPopoutV6548;
assert(popout && popout.version === 'v6.555', 'Live pop-out service did not install.');
assert(popout.mode === 'same-application-live-component', 'Live pop-out mode is incorrect.');
const liveContext = {tab:{key:'tat'},component:{key:'monthly'}};
assert(popout.open(liveContext) === true, 'Live pop-out did not delegate successfully.');
assert(delegatedContext === liveContext, 'Live pop-out changed the component context.');
assert(/component=tat\.monthly/.test(popout.buildUrl('tat','monthly')), 'Live pop-out URL lacks the stable component route.');

console.log('Dashboard runtime contracts passed.');
console.log('Live same-application pop-out: passed');
console.log('No snapshot/image/outerHTML pop-out path: passed');
console.log('Stable tab.component catalog: passed');
console.log('Title-side collapse ownership: passed');
console.log('Renderer and decorator identity stamping: passed');
