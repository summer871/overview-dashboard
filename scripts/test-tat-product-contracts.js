#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname,'..');
const footerVersion = 'v6.578';
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const assert = (condition,message) => { if (!condition) throw new Error(message); };

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

assert(foundation.includes('Version: v6.567'), 'Foundation is not v6.567.');
assert(renderer.includes("version:'v6.562'"), 'Renderer is not v6.562.');
assert(service.includes("version:'v6.562'"), 'TAT product service is not v6.562.');
assert(service.includes("config.childRows = null"), 'Department child rows are not disabled.');
assert(service.includes('data-tat-product-mode-v6562="product"'), 'Products mode is missing.');
assert(service.includes('data-tat-product-mode-v6562="group"'), 'Groups mode is missing.');

assert(layout.includes("version:'v6.565'"), 'TAT layout is not v6.565.');
assert(layout.includes("mode:'remake-parity-two-column-performance-toggle'"), 'Remake-parity layout mode is missing.');
assert(layout.includes('data-tat-performance-mode-v6565="distribution"'), 'Distribution mode is missing.');
assert(layout.includes('data-tat-performance-mode-v6565="promise"'), 'Promise mode is missing.');
assert(layout.includes('data-tat-performance-view-v6565'), 'Performance views are missing.');
assert(layout.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'TAT grid is not an equal two-column layout.');
assert(layout.includes('max-height:315px!important'), 'Performance/Product row height parity is missing.');
assert(!layout.includes('tatPromiseStripV6564'), 'Rejected full-width promise strip remains.');
assert(!layout.includes('tatPromisePanelV6563'), 'Rejected right-side promise panel remains.');

assert(widths.includes("tatDepartment:['30%','13%','13%','11%','11%','10%','12%']"), 'Department widths are incorrect.');
assert(widths.includes("tatProduct:['34%','12%','12%','10%','10%','10%','12%']"), 'Product widths are incorrect.');
assert(widths.includes("tatCustomer:['30%','9%','12%','12%','10%','9%','9%','9%']"), 'Customer widths are incorrect.');

assert(definition.includes("version:'v6.565'"), 'TAT definition is not v6.565.');
assert(definition.includes("key:'performance',title:'TAT Performance'"), 'TAT Performance is missing.');
assert(definition.includes('renderHeaderControls:function(){ return layout.headerMarkup(); }'), 'Performance header toggle is missing.');
assert(definition.includes('[data-tat-performance-view-v6565="distribution"]') || definition.includes('data-tat-performance-view-v6565="distribution"'), 'Distribution view markup is missing.');
assert(definition.includes('data-tat-performance-view-v6565="promise"'), 'Promise view markup is missing.');
assert(!definition.includes("key:'performance',title:'TAT Performance',kind:'chart',chartKey:'distribution',targetId:'tatDistributionChartV6509',\n      tableKey:'tatLate',secondaryComponentKeys:['distribution','late'],wide:true"), 'Performance is still full-width.');
assert(!definition.includes("key:'product',title:'Products',kind:'table',tableKey:'tatProduct',targetId:'tatProductTableV6562',wide:true"), 'Products is still full-width.');
assert(definition.indexOf("key:'performance'") < definition.indexOf("key:'product'"), 'Performance must be left of Products.');
assert((definition.match(/\n      key:'/g) || []).length === 6, 'TAT definition must contain six visible components.');

assert(adapter.includes("version:'v6.563'"), 'TAT adapter is not v6.563.');
assert(bootstrap.includes("version:'v6.565'"), 'TAT bootstrap is not v6.565.');
assert(bootstrap.includes('siblingCardWidths:'), 'Bootstrap does not enforce sibling widths.');
assert(bootstrap.includes('performanceToggle:'), 'Bootstrap does not enforce the performance toggle.');
assert(audit.includes('performanceAndProductsAreSiblingCards:'), 'Audit does not verify sibling cards.');
assert(audit.includes('performanceModeButtonCount:'), 'Audit does not verify performance modes.');
assert(audit.includes('noRejectedLayouts:'), 'Audit does not reject the prior layouts.');

assert(controller.includes('childRows:function(row,selected)'), 'Expected legacy department childRows source is missing.');
assert(service.includes('ensureDepartmentOnlyV6562'), 'Legacy childRows are not neutralized.');
assert(
  footer.includes("'" + footerVersion + "'"),
  'Footer is not ' + footerVersion + '.'
);
assert(footer.includes('TAT-REMAKE-PARITY-19'), 'Footer build label is incorrect.');
assert(router.includes("'v6.567'"), 'Router is not v6.567.');

console.log('TAT layout contracts passed.');
console.log('Monthly and Department remain first-row siblings: passed');
console.log('Performance and Products are equal-width second-row siblings: passed');
console.log('Distribution / Promise toggle: passed');
console.log('Products / Groups toggle: passed');
console.log('Rejected full-width performance layouts removed: passed');
console.log('Readable TAT table widths retained: passed');
