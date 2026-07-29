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

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach(value => this.values.add(String(value))); }
  remove(...values) { values.forEach(value => this.values.delete(String(value))); }
  contains(value) { return this.values.has(String(value)); }
  toggle(value, force) {
    const key = String(value);
    const next = force === undefined ? !this.values.has(key) : !!force;
    if (next) this.values.add(key); else this.values.delete(key);
    return next;
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.children = [];
    this.className = '';
    this.classList = new FakeClassList();
    this.attributes = Object.create(null);
    this.listeners = Object.create(null);
    this.textContent = '';
    this.checked = false;
    this.disabled = false;
    this.type = '';
  }
  appendChild(node) { this.children.push(node); return node; }
  append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
}

class FakeCell extends FakeElement {
  constructor(text) { super('td'); this.textContent = text; }
}

class FakeRow {
  constructor(values) { this.cells = values.map(value => new FakeCell(value)); }
}

class FakeTable extends FakeElement {
  constructor(id, headers, rows) {
    super('table');
    this.id = id;
    this.headerRow = new FakeRow(headers);
    this.tHead = {rows:[this.headerRow]};
    this.rows = [this.headerRow].concat(rows.map(values => new FakeRow(values)));
  }
  closest(selector) { return selector === 'table' ? this : null; }
  querySelectorAll(selector) {
    if (selector === 'col') return [];
    if (selector === '.columnHiddenV6357') {
      return this.rows.flatMap(row => row.cells).filter(cell => cell.classList.contains('columnHiddenV6357'));
    }
    return [];
  }
  rerender(rows) { this.rows = [this.headerRow].concat(rows.map(values => new FakeRow(values))); }
}

function countTag(rootNode, tagName) {
  const wanted = String(tagName).toUpperCase();
  let count = rootNode.tagName === wanted ? 1 : 0;
  (rootNode.children || []).forEach(child => { count += countTag(child, wanted); });
  return count;
}

function runColumnsContracts() {
  const storage = new Map();
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  };
  const calls = [];
  let managedVisible = true;
  const managedConfig = {tableId:'tatDepartmentTableV6509'};
  const remakeTable = new FakeTable(
    'remakeCustomerTable',
    ['Customer','Remake %'],
    [['Practice A','4.2%'],['Practice B','5.1%']]
  );
  const nodes = new Map([[remakeTable.id, remakeTable]]);
  const document = {
    documentElement:{},
    getElementById(id) { return nodes.get(id) || null; },
    createElement(tagName) { return new FakeElement(tagName); }
  };
  const context = {
    console,
    window:{
      localStorage,
      cdaTable:{
        config(key) { return key === 'tatDepartment' ? managedConfig : null; },
        columns() {
          return [
            {field:'department',label:'Department',title:'Department',hideable:false,visible:true},
            {field:'soldUnits',label:'Sold Units',title:'Sold Units',hideable:true,visible:managedVisible}
          ];
        },
        toggleColumn(key, field, visible) {
          calls.push(['toggleColumn',key,field,visible]);
          if (key === 'tatDepartment' && field === 'soldUnits') managedVisible = visible;
        },
        resetColumns(key) {
          calls.push(['resetColumns',key]);
          if (key === 'tatDepartment') managedVisible = true;
        }
      },
      MutationObserver:null,
      requestAnimationFrame(fn) { fn(); }
    },
    localStorage,document,Set,Map,Object,Array,String,Boolean,JSON
  };
  context.window.window = context.window;
  context.window.document = document;
  vm.createContext(context);
  vm.runInContext(firstScript('SharedDashboardColumnsV6548.html'), context, {
    filename:'SharedDashboardColumnsV6548.html'
  });

  const columns = context.window.cdaDashboardColumnsV6548;
  assert(columns && columns.version === 'v6.550', 'Shared Columns v6.550 did not install.');
  assert(columns.mode === 'single-shared-chooser', 'Shared Columns is not the sole chooser owner.');

  const managedContext = {
    tab:{key:'tat'},
    component:{key:'department',title:'Department Summary',tableKey:'tatDepartment'}
  };
  const managedSources = columns.describe(managedContext);
  assert(managedSources.length === 1 && managedSources[0].type === 'managed', 'Managed table contract was not resolved.');
  columns.setVisible(managedContext,managedSources[0].id,'soldUnits',false);
  assert(managedVisible === false, 'Managed column visibility was not updated.');
  columns.reset(managedContext);
  assert(managedVisible === true, 'Managed column reset was not updated.');
  assert(calls.some(call => call[0] === 'toggleColumn' && call[1] === 'tatDepartment'), 'Managed path did not use cdaTable.toggleColumn.');
  assert(calls.some(call => call[0] === 'resetColumns' && call[1] === 'tatDepartment'), 'Managed path did not use cdaTable.resetColumns.');

  const domContext = {
    tab:{key:'remake'},
    component:{key:'customer',title:'Customers',tableIds:['remakeCustomerTable']}
  };
  const domSources = columns.describe(domContext);
  assert(domSources.length === 1 && domSources[0].type === 'dom', 'Remake DOM table contract was not resolved.');
  const remakeField = domSources[0].columns[1].field;
  columns.setVisible(domContext,domSources[0].id,remakeField,false);
  assert(remakeTable.rows[1].cells[1].classList.contains('cdaDashboardColumnHiddenV6548'), 'DOM column was not hidden.');
  assert(localStorage.getItem('cdaDashboardColumns.v6550').includes(remakeField), 'DOM visibility was not persisted.');
  remakeTable.rerender([['Practice C','3.8%']]);
  columns.apply(domContext);
  assert(remakeTable.rows[1].cells[1].classList.contains('cdaDashboardColumnHiddenV6548'), 'DOM visibility did not survive rerender.');
  columns.reset(domContext);
  assert(!remakeTable.rows[1].cells[1].classList.contains('cdaDashboardColumnHiddenV6548'), 'DOM reset did not restore the column.');

  function makePopover() {
    const state = {panels:[]};
    return {
      state,
      isOpenFor() { return false; },
      open() { const panel = new FakeElement('div'); state.panels.push(panel); return panel; },
      close() {},
      position() {}
    };
  }
  const managedPopover = makePopover();
  const domPopover = makePopover();
  assert(columns.open(Object.assign({},managedContext,{button:new FakeElement('button'),popover:managedPopover})), 'Managed chooser did not open.');
  assert(columns.open(Object.assign({},domContext,{button:new FakeElement('button'),popover:domPopover})), 'DOM chooser did not open.');
  assert(countTag(managedPopover.state.panels[0],'label') === 2, 'Managed chooser did not render its columns.');
  assert(countTag(domPopover.state.panels[0],'label') === 2, 'DOM chooser did not render its columns.');
  assert(managedPopover.state.panels[0].children[0].className === domPopover.state.panels[0].children[0].className,
    'Managed and DOM choosers use different section markup.');
  assert(managedPopover.state.panels[0].children[1].className === domPopover.state.panels[0].children[1].className,
    'Managed and DOM choosers use different footer markup.');
}

function runLiveComponentContracts() {
  const popoutSource = read('SharedDashboardPopoutV6548.html');
  const isolationSource = read('SharedDashboardIsolationV6555.html');
  const catalogSource = read('SharedDashboardCatalogV6555.html');
  const featuresSource = read('SharedDashboardFeaturesV6547.html');
  const titleToggleSource = read('SharedDashboardTitleToggleV6555.html');
  const rendererSource = read('SharedDashboardRendererV6547.html');
  const decoratorSource = read('SharedDashboardDecoratorV6548.html');
  const remakeDefinition = read('RemakeDashboardDefinitionV6548.html');
  const tatDefinition = read('TatDashboardDefinitionV6547.html');

  ['toBase64Image','toDataURL','outerHTML','documentHtml','document.write'].forEach(marker => {
    assert(!popoutSource.includes(marker), 'Pop-out still contains snapshot marker: ' + marker);
  });
  assert(popoutSource.includes("mode:'same-application-live-component'"), 'Pop-out is not marked as a live same-application component.');
  assert(popoutSource.includes('isolation.open(context)'), 'Pop-out does not delegate to live isolation.');
  assert(isolationSource.includes("url.searchParams.set('component'"), 'Isolation route does not include component identity.');
  assert(isolationSource.includes("url.searchParams.set('presentation','all')"), 'Isolation route does not load the complete application.');
  assert(isolationSource.includes('catalog.waitFor'), 'Isolation does not wait for the real rendered component.');
  assert(isolationSource.includes('data-cda-isolated-component'), 'Isolation does not mark the real component card.');
  assert(isolationSource.includes('[data-cda-dashboard-feature-key="popout"]'), 'Isolation does not prevent recursive pop-outs.');
  assert(catalogSource.includes("return String(tabKey || '').trim() + '.' + String(componentKey || '').trim()"),
    'Catalog lacks stable tab.component identities.');
  ['data-cda-component-id','capabilities:{','resolveCard','resolveTarget','waitFor'].forEach(marker => {
    assert(catalogSource.includes(marker), 'Catalog is missing ' + marker + '.');
  });
  assert(featuresSource.includes("key:'collapse', placement:'title'"), 'Collapse is not title-owned.');
  assert(!featuresSource.includes("key:'collapse', placement:'toolbar'"), 'Collapse is still toolbar-owned.');
  assert(titleToggleSource.includes('adapter.collapse'), 'Title toggle does not call the tab adapter.');
  assert(titleToggleSource.includes('data-cda-dashboard-title-toggle'), 'Title toggle lacks an auditable identity.');
  assert(rendererSource.includes('data-cda-component-id'), 'Replace renderer does not stamp component identities.');
  assert(rendererSource.includes('titleToggle.mount'), 'Replace renderer does not mount title interactions.');
  assert(decoratorSource.includes('catalog.stamp'), 'Decorator does not stamp existing cards.');
  assert(decoratorSource.includes('titleToggle.mount'), 'Decorator does not mount title interactions.');
  assert(remakeDefinition.includes("version:'v6.555'"), 'Remake definition is not v6.555.');
  assert(tatDefinition.includes("version:'v6.555'"), 'TAT definition is not v6.555.');
  assert(remakeDefinition.includes("tabButtonId:'remakeFactorTabBtn'"), 'Remake lacks a stable tab route.');
  assert(tatDefinition.includes("tabButtonId:'tatTabBtnV6509'"), 'TAT lacks a stable tab route.');

  let delegatedContext = null;
  const isolation = {
    version:'v6.555',
    open(context) { delegatedContext = context; return true; },
    buildUrl(tabKey, componentKey) {
      return 'https://script.google.com/macros/s/test/dev?presentation=all&component=' + tabKey + '.' + componentKey;
    }
  };
  const context = {window:{cdaDashboardIsolationV6555:isolation},console,Object,String};
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
}

const columnsSource = read('SharedDashboardColumnsV6548.html');
assert(!columnsSource.includes('Bolean'), 'The Bolean runtime typo is present.');
assert(!columnsSource.includes('.toggleChooser('), 'Columns still delegates to the old chooser UI.');
runColumnsContracts();
runLiveComponentContracts();

console.log('Dashboard runtime contracts passed.');
console.log('Managed Columns path: passed');
console.log('Remake DOM hide, persistence, rerender, reset: passed');
console.log('Managed and DOM chooser markup parity: passed');
console.log('Live same-application pop-out: passed');
console.log('No snapshot/image/outerHTML pop-out path: passed');
console.log('Stable tab.component catalog: passed');
console.log('Title-side collapse ownership: passed');
console.log('Renderer and decorator identity stamping: passed');
