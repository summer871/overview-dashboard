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

function firstScript(fileName) {
  const match = read(fileName).match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  assert(match, fileName + ' has no executable script.');
  return match[1];
}

function runTitleContract() {
  const context = {
    console,
    window:{
      cdaDashboardPlatformV6547:{getTab(){ return null; }},
      cdaDashboardThemeV6549:{icon(name){ return name === 'expand' ? '▸' : '▾'; }}
    },
    document:{},
    setTimeout,
    Object,String,Array,RegExp
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(firstScript('SharedDashboardTitleToggleV6555.html'), context, {
    filename:'SharedDashboardTitleToggleV6555.html'
  });
  const service = context.window.cdaDashboardTitleToggleV6555;
  assert(service && service.version === 'v6.556', 'Title toggle service version is incorrect.');
  assert(service.cleanTitleText('Customers ▾') === 'Customers', 'Trailing legacy arrow was not removed.');
  assert(service.cleanTitleText('▸ Technicians') === 'Technicians', 'Leading legacy arrow was not removed.');
  assert(service.cleanTitleText('Customers ▼') === 'Customers', 'Alternate legacy arrow was not removed.');
}

function runPopoutContract() {
  const fakeLocation = {
    href:'https://n-test-script.googleusercontent.com/userCodeAppPanel?x=1',
    hash:'',
    ancestorOrigins:[]
  };
  const context = {
    console,
    URL,
    URLSearchParams,
    Date,
    Promise,
    Event:function Event(name){ this.type = name; },
    setInterval(){ return 1; },
    clearInterval(){},
    setTimeout,
    window:{
      location:fakeLocation,
      CDA_SERVER_PRESENTATION:{baseUrl:'',componentRoute:''},
      addEventListener(){},
      requestAnimationFrame(fn){ fn(); }
    },
    document:{
      readyState:'loading',
      referrer:'',
      addEventListener(){},
      documentElement:{classList:{add(){}},setAttribute(){}},
      getElementById(){ return null; }
    },
    Object,String,Array,RegExp
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(firstScript('SharedDashboardIsolationV6555.html'), context, {
    filename:'SharedDashboardIsolationV6555.html'
  });
  const service = context.window.cdaDashboardIsolationV6555;
  assert(service && service.version === 'v6.557', 'Isolation service version is incorrect.');
  assert(service.mode === 'same-build-live-component', 'Isolation mode is incorrect.');
  const url = service.buildUrl('tat','department');
  assert(/^https:\/\/n-test-script\.googleusercontent\.com\//.test(url), 'Current frame URL was not used.');
  assert(/#component=tat\.department/.test(url), 'Hash component route is missing.');
  fakeLocation.hash = '#component=remake.customer&popout=1';
  const route = service.route();
  assert(route && route.tabKey === 'remake' && route.componentKey === 'customer', 'Hash route was not parsed.');
}

function runRemakeHostContract() {
  const adapter = read('RemakeDashboardAdapterV6548.html');
  assert(adapter.includes("version:'v6.557'"), 'Remake adapter is not v6.557.');
  assert(adapter.includes("data-cda-dashboard-shared-host','true'"), 'Dedicated shared host marker is missing.');
  assert(adapter.includes("header.querySelector(':scope > .cdaDashboardDecoratedActionsV6548')"),
    'Remake toolbar host is not a direct header child.');
  assert(!adapter.includes("header.querySelector('.remakeCardActionsV6230')"),
    'Remake toolbar still uses the legacy action container.');
  assert(adapter.includes('pointer-events:auto!important'), 'Remake shared host does not enforce pointer ownership.');
}

function runColumnsRegressionGuards() {
  const columns = read('SharedDashboardColumnsV6548.html');
  assert(!columns.includes('Bolean'), 'The Bolean runtime typo is present.');
  assert(!columns.includes('.toggleChooser('), 'Columns delegates to the old chooser UI.');
  assert(columns.includes('single-shared-chooser'), 'Columns is not marked as the shared chooser owner.');
}

function runSnapshotGuards() {
  const popout = read('SharedDashboardPopoutV6548.html');
  ['toBase64Image','toDataURL','outerHTML','documentHtml'].forEach(marker => {
    assert(!popout.includes(marker), 'Static pop-out marker remains: ' + marker);
  });
  assert(popout.includes("mode:'same-build-live-component'"), 'Pop-out facade mode is incorrect.');
}

runTitleContract();
runPopoutContract();
runRemakeHostContract();
runColumnsRegressionGuards();
runSnapshotGuards();

console.log('Dashboard runtime contracts passed.');
console.log('Canonical one-chevron title cleanup: passed');
console.log('Same-build frame pop-out URL and hash route: passed');
console.log('Dedicated Remake shared pointer host: passed');
console.log('Columns regression guards: passed');
console.log('Static snapshot pop-out guard: passed');
