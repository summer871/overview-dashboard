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
const layout = read('TatDashboardLayoutV6563.html');
const widths = read('TatTableWidthsV6563.html');
const definition = read('TatDashboardDefinitionV6547.html');
const adapter = read('TatDashboardAdapterV6547.html');
const bootstrap = read('TatDashboardBootstrapV6547.html');
const audit = read('TatProductAuditV6562.html');
const controller = read('TatDashboardControllerScript.html');
const footer = read('SharedFooter.html');
const router = read('Code.js');

assert(foundation.includes('Version: v6.563'), 'Foundation is not v6.563.');
assert(foundation.includes("includeDashboardFile('TatProductTableV6562')"), 'TAT product service is not included.');
assert(foundation.includes("includeDashboardFile('TatDashboardLayoutV6563')"), 'TAT layout service is not included.');
assert(foundation.includes("includeDashboardFile('TatTableWidthsV6563')"), 'TAT table-width service is not included.');
assert(foundation.includes("includeDashboardFile('TatProductAuditV6562')"), 'TAT layout audit is not included.');
assert(foundation.indexOf("includeDashboardFile('TatDashboardLayoutV6563')") < foundation.indexOf("includeDashboardFile('TatDashboardDefinitionV6547')"), 'TAT layout must load before the definition.');
assert(foundation.indexOf("includeDashboardFile('TatTableWidthsV6563')") < foundation.indexOf("includeDashboardFile('TatDashboardDefinitionV6547')"), 'TAT widths must load before the definition.');

assert(renderer.includes("version:'v6.562'"), 'Renderer is not v6.562.');
assert(renderer.includes('renderHeaderControls'), 'Renderer lacks first-class header controls.');

assert(service.includes("version:'v6.562'"), 'TAT product service is not v6.562.');
assert(service.includes("const TABLE_KEY = 'tatProduct'"), 'TAT product table key is missing.');
assert(service.includes("config.childRows = null"), 'Department child rows are not disabled.');
assert(service.includes("data-tat-product-mode-v6562=\"product\""), 'Products mode button is missing.');
assert(service.includes("data-tat-product-mode-v6562=\"group\""), 'Groups mode button is missing.');

assert(layout.includes("version:'v6.563'"), 'TAT layout is not v6.563.');
assert(layout.includes('tatPerformanceLayoutV6563'), 'Combined performance layout is missing.');
assert(layout.includes('tatPromiseHeadlineV6563'), 'Promise headline renderer is missing.');
assert(layout.includes('tatPromiseStackSegmentV6563'), 'Promise stacked summary is missing.');
assert(layout.includes("isolation.card('tat.performance')"), 'Combined performance pop-out awareness is missing.');

assert(widths.includes("version:'v6.563'"), 'TAT width service is not v6.563.');
assert(widths.includes("tatDepartment:['30%','13%','13%','11%','11%','10%','12%']"), 'Department width contract is incorrect.');
assert(widths.includes("tatProduct:['34%','12%','12%','10%','10%','10%','12%']"), 'Product width contract is incorrect.');
assert(widths.includes("tatCustomer:['30%','9%','12%','12%','10%','9%','9%','9%']"), 'Customer width contract is incorrect.');

assert(definition.includes("version:'v6.563'"), 'TAT definition is not v6.563.');
assert(definition.includes("key:'product',title:'Products'"), 'TAT Products component is missing.');
assert(definition.includes("key:'performance',title:'TAT Performance'"), 'Combined TAT Performance component is missing.');
assert(definition.includes("chartKey:'distribution'"), 'Performance component does not retain the distribution chart.');
assert(definition.includes("tableKey:'tatLate'"), 'Performance component does not retain promise data.');
assert(definition.includes('tatPromiseHeadlineV6563'), 'Promise summary markup is missing.');
assert(!definition.includes("key:'late',title:'Promise Performance'"), 'Standalone Promise Performance card remains.');
assert(!definition.includes("key:'distribution',title:'TAT Distribution'"), 'Standalone Distribution card remains.');
assert(definition.includes("key:'product',title:'Products',kind:'table',tableKey:'tatProduct',targetId:'tatProductTableV6562',wide:true"), 'Products is not full-width.');
assert(definition.includes("[{label:'Department'}].concat(TAT_METRIC_HEADERS)"), 'Department header is not department-only.');
assert((definition.match(/\n      key:'/g) || []).length === 6, 'TAT definition does not contain six visible components.');

assert(adapter.includes("version:'v6.563'"), 'TAT adapter is not v6.563.');
assert(adapter.includes("context.component.key === 'performance'"), 'Combined performance controls are not handled.');
assert(adapter.includes("window.clearTatComponentV6509('distribution')"), 'Performance reset does not clear distribution selection.');
assert(adapter.includes("window.clearTatComponentV6509('late')"), 'Performance reset does not clear promise selection.');
assert(adapter.includes("'tatProduct'"), 'TAT product table is not part of adapter lifecycle cleanup.');

assert(bootstrap.includes("version:'v6.563'"), 'TAT bootstrap is not v6.563.');
assert(bootstrap.includes('sixComponents:definition.components.length === 6'), 'TAT bootstrap does not require six components.');
assert(bootstrap.includes('combinedPerformance:'), 'TAT bootstrap does not require combined performance.');
assert(bootstrap.includes('readableTableWidths:productContract.widthsCorrect'), 'TAT bootstrap does not require readable widths.');
assert(audit.includes('performancePresent:performancePresent'), 'TAT audit does not verify the combined performance card.');
assert(audit.includes('noStandalonePromiseCard:noStandalonePromiseCard'), 'TAT audit does not reject old performance cards.');
assert(audit.includes('widthsCorrect:widthsCorrect'), 'TAT audit does not verify table widths.');

assert(controller.includes("childRows:function(row,selected)"), 'Expected legacy department childRows source was not found.');
assert(service.includes('ensureDepartmentOnlyV6562'), 'The legacy childRows source is not neutralized.');
assert(footer.includes("'v6.563'"), 'Footer is not v6.563.');
assert(footer.includes('TAT-COMBINED-PERFORMANCE-15'), 'Footer build label is incorrect.');
assert(router.includes("'v6.563'"), 'Router is not v6.563.');

console.log('TAT layout contracts passed.');
console.log('Department table remains department-only: passed');
console.log('Products table is full-width with Products / Groups: passed');
console.log('Distribution and Promise are one TAT Performance card: passed');
console.log('Six-component TAT definition: passed');
console.log('Readable Department, Product, and Customer widths: passed');
