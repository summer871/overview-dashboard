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

assert(foundation.includes('Version: v6.564'), 'Foundation is not v6.564.');
assert(foundation.includes("includeDashboardFile('TatProductTableV6562')"), 'TAT product service is not included.');
assert(foundation.includes("includeDashboardFile('TatDashboardLayoutV6563')"), 'TAT layout service is not included.');
assert(foundation.includes("includeDashboardFile('TatTableWidthsV6563')"), 'TAT table-width service is not included.');
assert(foundation.includes("includeDashboardFile('TatProductAuditV6562')"), 'TAT layout audit is not included.');

assert(renderer.includes("version:'v6.562'"), 'Renderer is not v6.562.');
assert(service.includes("version:'v6.562'"), 'TAT product service is not v6.562.');
assert(service.includes("config.childRows = null"), 'Department child rows are not disabled.');
assert(service.includes("data-tat-product-mode-v6562=\"product\""), 'Products mode button is missing.');
assert(service.includes("data-tat-product-mode-v6562=\"group\""), 'Groups mode button is missing.');

assert(layout.includes("version:'v6.564'"), 'TAT layout is not v6.564.');
assert(layout.includes("mode:'analysis-first-promise-strip-and-full-width-distribution'"), 'Analysis-first layout mode is missing.');
assert(layout.includes('tatPromiseStripV6564'), 'Compact promise strip is missing.');
assert(layout.includes('tatPerformanceChartPanelV6564'), 'Full-width distribution panel is missing.');
assert(layout.includes('tatPromiseEmptyV6564'), 'Zero-data promise state is missing.');
assert(layout.includes('max-height:360px!important'), 'Products dashboard height was not reduced.');
assert(!layout.includes('tatPromisePanelV6563'), 'Rejected right-side promise panel remains.');

assert(widths.includes("version:'v6.563'"), 'TAT width service is not v6.563.');
assert(widths.includes("tatDepartment:['30%','13%','13%','11%','11%','10%','12%']"), 'Department width contract is incorrect.');
assert(widths.includes("tatProduct:['34%','12%','12%','10%','10%','10%','12%']"), 'Product width contract is incorrect.');
assert(widths.includes("tatCustomer:['30%','9%','12%','12%','10%','9%','9%','9%']"), 'Customer width contract is incorrect.');

assert(definition.includes("version:'v6.564'"), 'TAT definition is not v6.564.');
assert(definition.includes("key:'performance',title:'TAT Performance'"), 'TAT Performance component is missing.');
assert(definition.includes('tatPromiseHeadlineV6564'), 'Compact promise summary markup is missing.');
assert(definition.includes('tatPerformanceChartPanelV6564'), 'Full-width distribution markup is missing.');
assert(definition.indexOf("key:'performance'") < definition.indexOf("key:'product'"), 'Performance must render before Products.');
assert(!definition.includes("key:'late',title:'Promise Performance'"), 'Standalone Promise Performance card remains.');
assert(!definition.includes("key:'distribution',title:'TAT Distribution'"), 'Standalone Distribution card remains.');
assert(definition.includes("key:'product',title:'Products',kind:'table',tableKey:'tatProduct',targetId:'tatProductTableV6562',wide:true"), 'Products is not full-width.');
assert((definition.match(/\n      key:'/g) || []).length === 6, 'TAT definition does not contain six visible components.');

assert(adapter.includes("version:'v6.563'"), 'TAT adapter is not v6.563.');
assert(adapter.includes("context.component.key === 'performance'"), 'Combined performance controls are not handled.');
assert(bootstrap.includes("version:'v6.564'"), 'TAT bootstrap is not v6.564.');
assert(bootstrap.includes('performanceBeforeProducts:'), 'TAT bootstrap does not require analysis-first ordering.');
assert(bootstrap.includes('analysisFirstLayout:'), 'TAT bootstrap does not require the new layout mode.');
assert(audit.includes('performanceBeforeProducts:performanceBeforeProducts'), 'TAT audit does not verify component order.');
assert(audit.includes('compactPromiseStrip:'), 'TAT audit does not verify the compact strip.');
assert(audit.includes('fullWidthDistribution:'), 'TAT audit does not verify the full-width chart.');

assert(controller.includes("childRows:function(row,selected)"), 'Expected legacy department childRows source was not found.');
assert(service.includes('ensureDepartmentOnlyV6562'), 'The legacy childRows source is not neutralized.');
assert(footer.includes("'v6.564'"), 'Footer is not v6.564.');
assert(footer.includes('TAT-ANALYSIS-FIRST-16'), 'Footer build label is incorrect.');
assert(router.includes("'v6.564'"), 'Router is not v6.564.');

console.log('TAT layout contracts passed.');
console.log('Performance appears before Products: passed');
console.log('Compact promise strip above full-width distribution: passed');
console.log('Zero-eligible promise state: passed');
console.log('Products table is full-width and shorter: passed');
console.log('Readable Department, Product, and Customer widths: passed');
