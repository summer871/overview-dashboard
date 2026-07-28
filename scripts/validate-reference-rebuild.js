#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = {
  foundation: path.join(root, 'SharedComponentFoundation.html'),
  cardModule: path.join(root, 'SharedCardModule.html'),
  cardStyles: path.join(root, 'SharedCardStyles.html'),
  tableModule: path.join(root, 'SharedTableModule.html'),
  department: path.join(root, 'TatDepartmentComponentV6544.html'),
  controller: path.join(root, 'TatDashboardControllerScript.html')
};

let failed = false;

function fail(message) {
  failed = true;
  console.error(`Reference rebuild validation failed: ${message}`);
}

function read(name) {
  const file = files[name];
  if (!fs.existsSync(file)) {
    fail(`missing ${path.relative(root, file)}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

const foundation = read('foundation');
const cardModule = read('cardModule');
const cardStyles = read('cardStyles');
const tableModule = read('tableModule');
const department = read('department');
const controller = read('controller');

for (const marker of [
  "includeDashboardFile('SharedCardStyles')",
  "includeDashboardFile('SharedCardModule')",
  "includeDashboardFile('SharedChartStyles')",
  "includeDashboardFile('SharedChartModule')",
  "includeDashboardFile('TatDepartmentComponentV6544')"
]) {
  if (!foundation.includes(marker)) fail(`SharedComponentFoundation is missing ${marker}`);
}

for (const marker of [
  "window.cdaCard = apiV6544",
  "render: renderV6544",
  "setState: setStateV6544",
  "setCollapsed: setCollapsedV6544",
  "document.createElement('article')"
]) {
  if (!cardModule.includes(marker)) fail(`SharedCardModule is missing ${marker}`);
}

for (const marker of [
  '.cdaCardV6544[data-cda-card-managed="v6544"]',
  '.cdaCardHeaderV6544',
  '.cdaCardActionsV6544',
  '.cdaCardBodyV6544',
  '.cdaCardStateV6544'
]) {
  if (!cardStyles.includes(marker)) fail(`SharedCardStyles is missing ${marker}`);
}

for (const marker of [
  "var COMPONENT_KEY_V6544 = 'tat.department'",
  "var TABLE_BODY_ID_V6544 = 'tatDepartmentTableV6509'",
  "window.cdaCard.render({",
  "document.createElement('table')",
  "document.createElement('tbody')",
  "legacyCard.parentNode.removeChild(legacyCard)",
  "window.auditTatDepartmentComponentV6544"
]) {
  if (!department.includes(marker)) fail(`TatDepartmentComponentV6544 is missing ${marker}`);
}

for (const forbidden of [
  'MutationObserver',
  'new Proxy',
  'Proxy(',
  'Chart.getChart',
  'createChart: function(){ return chart;',
  'adoptDistributionChart',
  'adapter'
]) {
  if (department.includes(forbidden)) fail(`TatDepartmentComponentV6544 contains forbidden migration pattern ${forbidden}`);
}

if (!controller.includes("key:'tatDepartment',tableId:'tatDepartmentTableV6509'")) {
  fail('TAT controller no longer supplies rows to the stable shared-table target');
}

if (!controller.includes("renderDepartmentTable();")) {
  fail('TAT render flow no longer calls renderDepartmentTable');
}

if (!tableModule.includes("table.setAttribute('data-cda-managed', 'v6543')")) {
  fail('SharedTableModule is missing the managed-table marker');
}

const legacyDepartmentMarkupCount = (controller.match(/Department Summary/g) || []).length;
if (legacyDepartmentMarkupCount !== 1) {
  fail(`expected one legacy Department Summary source marker before runtime replacement, found ${legacyDepartmentMarkupCount}`);
}

if (!failed) {
  console.log('Reference rebuild valid: TAT Department uses new shared card and table DOM, preserves the stable data target, and contains no adapter/proxy/observer migration code.');
} else {
  process.exitCode = 1;
}
