#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const optional = name => fs.existsSync(path.join(root, name)) ? read(name) : '';
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const widths = read('TatTableWidthsV6563.html');
const audit = read('TatProductAuditV6562.html');
const bootstrap = read('TatDashboardBootstrapV6547.html');
const editor = read('SharedDashboardLayoutEditorV6593.html');
for (const [name, text] of [
  ['TatTableWidthsV6563.html', widths],
  ['TatProductAuditV6562.html', audit],
  ['TatDashboardBootstrapV6547.html', bootstrap]
]) {
  for (const match of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    new vm.Script(match[1], { filename: name });
  }
}

assert(widths.includes("version:'v6.595'"), 'TAT width facade is not v6.595');
assert(widths.includes("mode:'delegated-to-dashboard-wide-table-surfaces'"), 'TAT widths are not delegated');
assert(!widths.includes('nth-child'), 'Legacy TAT percentage widths remain');
assert(audit.includes("tableSurfaces.version === 'v6.595'"), 'TAT audit does not require v6.595');
assert(audit.includes('dashboard-wide-collapse-aware-fit-paired-table-surfaces'), 'TAT audit does not require stable-fit mode');
for (const id of ['tatDepartmentTableV6509','tatLateTableV6509','tatProductTableV6562','tatCustomerTableV6509','tatQualityTableV6509']) {
  assert(audit.includes(id), `TAT audit missing ${id}`);
}
assert(bootstrap.includes("widths.version === 'v6.595'"), 'TAT bootstrap width facade version incorrect');
assert(bootstrap.includes("layoutEditor.version === 'v6.608'"), 'TAT bootstrap does not require v6.608 layout editor');
assert(editor.includes('repairTatTablesV6593'), 'TAT bottom-table recovery missing');
assert(editor.includes("renderRegisteredTableV6593('tatCustomer'"), 'TAT Customer restoration missing');
assert(editor.includes("'tatQuality'"), 'TAT quality restoration missing');
assert(editor.includes('autoSelectQualityIssueV6593'), 'TAT quality automatic detail selection missing');
const definition = optional('TatDashboardDefinitionV6547.html');
if (definition) {
  assert(definition.includes('tatLateTableV6509'), 'TAT Promise table missing');
  assert(definition.includes("key:'performance'"), 'Unified TAT Performance missing');
}

console.log('v6.595 TAT table contracts with v6.608 layout editor passed.');
console.log('TAT percentage width overrides removed: passed');
console.log('All five TAT table surfaces enforced: passed');
console.log('TAT Promise and Products use the shared full-width collapse-aware fit engine: passed');

console.log('TAT Customers restoration and Data Quality detail recovery: passed');
