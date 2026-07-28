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
  chartModule: path.join(root, 'SharedChartModule.html'),
  department: path.join(root, 'TatDepartmentComponentV6544.html'),
  distribution: path.join(root, 'TatDistributionComponentV6544.html'),
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
const chartModule = read('chartModule');
const department = read('department');
const distribution = read('distribution');
const controller = read('controller');

for (const marker of [
  "includeDashboardFile('SharedCardStyles')",
  "includeDashboardFile('SharedCardModule')",
  "includeDashboardFile('SharedChartStyles')",
  "includeDashboardFile('SharedChartModule')",
  "includeDashboardFile('TatDepartmentComponentV6544')",
  "includeDashboardFile('TatDistributionComponentV6544')"
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
  'register: registerV6544',
  'render: renderV6544',
  "new window.Chart(canvas.getContext('2d'), chartConfig)",
  'exportCsv: exportCsvV6544',
  'savePng: savePngV6544',
  'copyImage: copyImageV6544'
]) {
  if (!chartModule.includes(marker)) fail(`SharedChartModule is missing ${marker}`);
}

for (const marker of [
  "var COMPONENT_KEY_V6544 = 'tat.department'",
  "var TABLE_BODY_ID_V6544 = 'tatDepartmentTableV6509'",
  'window.cdaCard.render({',
  "document.createElement('table')",
  "document.createElement('tbody')",
  'legacyCard.parentNode.removeChild(legacyCard)',
  'window.auditTatDepartmentComponentV6544'
]) {
  if (!department.includes(marker)) fail(`TatDepartmentComponentV6544 is missing ${marker}`);
}

for (const marker of [
  "var COMPONENT_KEY_V6544 = 'tat.distribution'",
  "var LEGACY_CANVAS_ID_V6544 = 'tatDistributionChartV6509'",
  "var CANVAS_ID_V6544 = 'tatDistributionChartSharedV6544'",
  'window.cdaChart.register({',
  "document.createElement('canvas')",
  'legacyCard.parentNode.removeChild(legacyCard)',
  "document.addEventListener('cdaTableRendered'",
  'window.auditTatDistributionComponentV6544',
  "modeV6544 = 'percent'",
  "['cases','percent','cumulative']"
]) {
  if (!distribution.includes(marker)) fail(`TatDistributionComponentV6544 is missing ${marker}`);
}

for (const [name, source] of [['TatDepartmentComponentV6544', department], ['TatDistributionComponentV6544', distribution]]) {
  for (const forbidden of [
    'MutationObserver',
    'new Proxy',
    'Proxy(',
    'Chart.getChart',
    'createChart: function(){ return chart;',
    'adoptDistributionChart',
    'adapter'
  ]) {
    if (source.includes(forbidden)) fail(`${name} contains forbidden migration pattern ${forbidden}`);
  }
}

if (distribution.includes("canvas.id = LEGACY_CANVAS_ID_V6544")) {
  fail('TAT Distribution reuses the legacy canvas ID');
}

if (distribution.includes('state.charts[') || distribution.includes('new Chart(')) {
  fail('TAT Distribution bypasses SharedChartModule chart ownership');
}

if (!controller.includes("key:'tatDepartment',tableId:'tatDepartmentTableV6509'")) {
  fail('TAT controller no longer supplies rows to the stable shared-table target');
}

if (!controller.includes('renderDepartmentTable();')) {
  fail('TAT render flow no longer calls renderDepartmentTable');
}

if (!controller.includes('renderDistribution();')) {
  fail('TAT render flow no longer provides the reference render event sequence');
}

if (!tableModule.includes("table.setAttribute('data-cda-managed', 'v6543')")) {
  fail('SharedTableModule is missing the managed-table marker');
}

const legacyDepartmentMarkupCount = (controller.match(/Department Summary/g) || []).length;
if (legacyDepartmentMarkupCount !== 1) {
  fail(`expected one legacy Department Summary source marker before runtime replacement, found ${legacyDepartmentMarkupCount}`);
}

const legacyDistributionMarkupCount = (controller.match(/TAT Distribution/g) || []).length;
if (legacyDistributionMarkupCount < 1) {
  fail('expected the legacy Distribution source marker to remain available for deterministic runtime replacement');
}

if (!failed) {
  console.log('Reference rebuild valid: TAT Department and TAT Distribution create new shared DOM, preserve dashboard data/filter behavior, and contain no adapter/proxy/observer or legacy-chart reuse code.');
} else {
  process.exitCode = 1;
}
