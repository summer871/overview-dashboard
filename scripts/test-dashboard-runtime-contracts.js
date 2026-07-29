#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function scriptBody(fileName) {
  const text = fs.readFileSync(path.join(root, fileName), 'utf8');
  const match = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  assert(match, fileName + ' has no executable script block.');
  return match[1];
}

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(String(value)); }
  remove(value) { this.values.delete(String(value)); }
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
    this.tHead = { rows:[this.headerRow] };
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

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); }
};

const calls = [];
let managedVisible = true;
const managedConfig = { tableId:'tatDepartmentTableV6509' };
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
        calls.push(['toggleColumn', key, field, visible]);
        if (key === 'tatDepartment' && field === 'soldUnits') managedVisible = visible;
      },
      resetColumns(key) {
        calls.push(['resetColumns', key]);
        if (key === 'tatDepartment') managedVisible = true;
      }
    },
    MutationObserver:null,
    requestAnimationFrame(fn) { fn(); }
  },
  localStorage,
  document,
  Set,
  Map,
  Object,
  Array,
  String,
  Boolean,
  JSON
};
context.window.window = context.window;
context.window.document = document;
vm.createContext(context);

vm.runInContext(scriptBody('SharedDashboardColumnsV6548.html'), context, {
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
columns.setVisible(managedContext, managedSources[0].id, 'soldUnits', false);
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
columns.setVisible(domContext, domSources[0].id, remakeField, false);
assert(remakeTable.rows[1].cells[1].classList.contains('cdaDashboardColumnHiddenV6548'), 'DOM column was not hidden.');
assert(localStorage.getItem('cdaDashboardColumns.v6550').includes(remakeField), 'DOM visibility was not persisted.');
remakeTable.rerender([['Practice C','3.8%']]);
columns.apply(domContext);
assert(remakeTable.rows[1].cells[1].classList.contains('cdaDashboardColumnHiddenV6548'), 'DOM visibility did not survive rerender.');
columns.reset(domContext);
assert(!remakeTable.rows[1].cells[1].classList.contains('cdaDashboardColumnHiddenV6548'), 'DOM reset did not restore the column.');

function makePopover(){
  const state = { panels:[] };
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
assert(columns.open(Object.assign({}, managedContext, {button:new FakeElement('button'), popover:managedPopover})), 'Managed chooser did not open.');
assert(columns.open(Object.assign({}, domContext, {button:new FakeElement('button'), popover:domPopover})), 'DOM chooser did not open.');
assert(countTag(managedPopover.state.panels[0], 'label') === 2, 'Managed chooser did not render its columns.');
assert(countTag(domPopover.state.panels[0], 'label') === 2, 'DOM chooser did not render its columns.');
assert(managedPopover.state.panels[0].children[0].className === domPopover.state.panels[0].children[0].className, 'Managed and DOM choosers use different section markup.');
assert(managedPopover.state.panels[0].children[1].className === domPopover.state.panels[0].children[1].className, 'Managed and DOM choosers use different footer markup.');

vm.runInContext(scriptBody('SharedDashboardThemeV6549.html'), context, {
  filename:'SharedDashboardThemeV6549.html'
});
vm.runInContext(scriptBody('SharedDashboardPopoutV6548.html'), context, {
  filename:'SharedDashboardPopoutV6548.html'
});
const theme = context.window.cdaDashboardThemeV6549;
const popout = context.window.cdaDashboardPopoutV6548;
assert(theme && theme.version === 'v6.550', 'Shared theme v6.550 did not install.');
assert(popout && popout.themeVersion === 'v6.550', 'Pop-out is not bound to shared theme v6.550.');
const popoutHtml = popout.documentHtml('Test','<table></table>');
[
  theme.tokens.page,
  theme.tokens.title,
  theme.tokens.surface,
  theme.tokens.borderStrong,
  theme.tokens.divider,
  theme.tokens.tableHeader,
  theme.tokens.onDark,
  theme.tokens.radiusCard,
  theme.tokens.fontUi,
  theme.tokens.fontPopoutTitle,
  theme.tokens.fontPopoutTable
].forEach(token => assert(popoutHtml.includes(token), 'Pop-out omitted shared theme token: ' + token));

const featureSource = fs.readFileSync(path.join(root, 'SharedDashboardFeaturesV6547.html'), 'utf8');
const toolbarSource = fs.readFileSync(path.join(root, 'SharedDashboardToolbarV6548.html'), 'utf8');
const columnsSource = fs.readFileSync(path.join(root, 'SharedDashboardColumnsV6548.html'), 'utf8');
const popoutSource = fs.readFileSync(path.join(root, 'SharedDashboardPopoutV6548.html'), 'utf8');
assert(featureSource.includes("icon:'popout'") && featureSource.includes("icon:'more'"), 'Features do not reference shared icons.');
assert(toolbarSource.includes('theme.icon(feature.icon)'), 'Toolbar does not resolve icons through the shared theme.');
assert(!columnsSource.includes('Bolean'), 'The Bolean runtime typo is present.');
assert(!columnsSource.includes('.toggleChooser('), 'Columns still delegates to the old chooser UI.');
assert(!/#[0-9a-f]{3,8}/i.test(popoutSource), 'Pop-out contains a hardcoded color literal.');

console.log('Dashboard runtime contracts passed.');
console.log('Managed Columns path: passed');
console.log('Remake DOM hide, persistence, rerender, reset: passed');
console.log('Managed and DOM chooser markup parity: passed');
console.log('Shared theme, icons, and pop-out ownership: passed');
