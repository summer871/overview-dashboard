#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root,name),'utf8'); }
function assert(condition,message) { if (!condition) throw new Error(message); }

const foundation = read('SharedComponentFoundation.html');
const renderer = read('SharedDashboardRendererV6547.html');
const service = read('TatProductTableV6562.html');
const definition = read('TatDashboardDefinitionV6547.html');
const adapter = read('TatDashboardAdapterV6547.html');
const bootstrap = read('TatDashboardBootstrapV6547.html');
const audit = read('TatProductAuditV6562.html');
const controller = read('TatDashboardControllerScript.html');
const footer = read('SharedFooter.html');
const router = read('Code.js');

assert(foundation.includes('Version: v6.562'), 'Foundation is not v6.562.');
assert(foundation.includes("includeDashboardFile('TatProductTableV6562')"), 'TAT product service is not included.');
assert(foundation.includes("includeDashboardFile('TatProductAuditV6562')"), 'TAT product audit is not included.');
assert(foundation.indexOf("includeDashboardFile('TatProductTableV6562')") < foundation.indexOf("includeDashboardFile('TatDashboardDefinitionV6547')"), 'TAT product service must load before the definition.');
assert(foundation.indexOf("includeDashboardFile('TatProductAuditV6562')") < foundation.indexOf("includeDashboardFile('TatDashboardBootstrapV6547')"), 'TAT product audit must load before the bootstrap.');

assert(renderer.includes("version:'v6.562'"), 'Renderer is not v6.562.');
assert(renderer.includes('renderHeaderControls'), 'Renderer lacks first-class header controls.');
assert(renderer.includes('cdaDashboardHeaderActionsV6562'), 'Renderer lacks a shared header-actions owner.');

assert(service.includes("version:'v6.562'"), 'TAT product service is not v6.562.');
assert(service.includes("const TABLE_KEY = 'tatProduct'"), 'TAT product table key is missing.');
assert(service.includes("config.childRows = null"), 'Department child rows are not disabled.');
assert(service.includes("config.childRowClass = ''"), 'Department child-row styling is not disabled.');
assert(service.includes("data-tat-product-mode-v6562=\"product\""), 'Products mode button is missing.');
assert(service.includes("data-tat-product-mode-v6562=\"group\""), 'Groups mode button is missing.');
assert(service.includes("window.cdaTable.setRows = function(key,rows,options)"), 'TAT product rows do not follow department reporting rows.');
assert(service.includes("if (key === 'tatDepartment')"), 'Department row updates do not trigger the product table.');
assert(service.includes("filterKind:'product'"), 'TAT product table is not registered with the shared table module.');
assert(service.includes("modeV6562() === 'group' ? 'productGroup' : 'product'"), 'Products / Groups filtering is not mode-aware.');

assert(definition.includes("version:'v6.562'"), 'TAT definition is not v6.562.');
assert(definition.includes("key:'product',title:'Products'"), 'TAT Products component is missing.');
assert(definition.includes("tableKey:'tatProduct'"), 'TAT Products component does not use tatProduct.');
assert(definition.includes("targetId:'tatProductTableV6562'"), 'TAT Products target is missing.');
assert(definition.includes("renderHeaderControls:function(){ return productTable.headerMarkup(); }"), 'Products / Groups toggle is not a first-class header control.');
assert(definition.includes("[{label:'Department'}].concat(TAT_METRIC_HEADERS)"), 'Department header is not department-only.');
assert((definition.match(/key:'/g) || []).length >= 7, 'TAT definition does not contain seven components.');

assert(adapter.includes("version:'v6.562'"), 'TAT adapter is not v6.562.');
assert(adapter.includes("'tatProduct'"), 'TAT product table is not part of adapter lifecycle cleanup.');
assert(bootstrap.includes("version:'v6.562'"), 'TAT bootstrap is not v6.562.');
assert(bootstrap.includes('sevenComponents:definition.components.length === 7'), 'TAT bootstrap does not require seven components.');
assert(bootstrap.includes('productContract.ok'), 'TAT bootstrap does not require the product contract.');
assert(audit.includes('departmentOnly:departmentOnly'), 'TAT product audit does not expose department-only status.');
assert(audit.includes('noProductRowsInsideDepartment'), 'TAT product audit does not reject product drill-down rows.');
assert(audit.includes('modeButtonCount:modeButtons.length'), 'TAT product audit does not verify the two mode buttons.');

assert(controller.includes("childRows:function(row,selected)"), 'Expected legacy department childRows source was not found.');
assert(service.includes('ensureDepartmentOnlyV6562'), 'The legacy childRows source is not neutralized by the shared service.');
assert(footer.includes("'v6.562'"), 'Footer is not v6.562.');
assert(footer.includes('TAT-SEPARATE-PRODUCTS-14'), 'Footer build label is incorrect.');
assert(router.includes("'v6.562'"), 'Router is not v6.562.');

console.log('TAT product contracts passed.');
console.log('Department table has no product drill-down rows: passed');
console.log('Separate Products table registration: passed');
console.log('Products / Groups shared header toggle: passed');
console.log('Seven-component TAT definition: passed');
console.log('Shared table lifecycle and audit coverage: passed');
