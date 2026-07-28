#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const registryPath = path.join(root, 'scripts', 'dashboard-component-registry.json');
const requiredFiles = [
  path.join(root, 'SharedTableModule.html'),
  path.join(root, 'SharedTableStyles.html'),
  path.join(root, 'SharedChartModule.html'),
  path.join(root, 'SharedChartStyles.html')
];

function fail(message) {
  console.error(`Component contract validation failed: ${message}`);
  process.exitCode = 1;
}

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) fail(`missing ${path.relative(root, file)}`);
}

if (!fs.existsSync(registryPath)) {
  fail('missing scripts/dashboard-component-registry.json');
  process.exit();
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const tables = Array.isArray(registry.tables) ? registry.tables : [];
const charts = Array.isArray(registry.charts) ? registry.charts : [];

if (tables.length !== 13) fail(`expected 13 primary tables, found ${tables.length}`);
if (charts.length !== 14) fail(`expected 14 primary charts, found ${charts.length}`);

function validateItems(items, kind) {
  const keys = new Set();
  for (const item of items) {
    if (!item || !item.key) fail(`${kind} is missing a key`);
    else if (keys.has(item.key)) fail(`duplicate ${kind} key ${item.key}`);
    else keys.add(item.key);
    if (!item.tab) fail(`${kind} ${item.key || '(unknown)'} is missing tab`);
    if (!item.name) fail(`${kind} ${item.key || '(unknown)'} is missing name`);
    if (!Array.isArray(item.ownerFiles) || !item.ownerFiles.length) fail(`${kind} ${item.key || '(unknown)'} is missing ownerFiles`);
    if (!Array.isArray(item.requiredControls)) fail(`${kind} ${item.key || '(unknown)'} is missing requiredControls`);
    if (!Array.isArray(item.requiredInteractions)) fail(`${kind} ${item.key || '(unknown)'} is missing requiredInteractions`);
    if (!Array.isArray(item.customFeatures)) fail(`${kind} ${item.key || '(unknown)'} is missing customFeatures`);
    if (!item.targetRenderer) fail(`${kind} ${item.key || '(unknown)'} is missing targetRenderer`);
    if (!item.migrationStatus) fail(`${kind} ${item.key || '(unknown)'} is missing migrationStatus`);
  }
}

validateItems(tables, 'table');
validateItems(charts, 'chart');

const chartModulePath = path.join(root, 'SharedChartModule.html');
if (fs.existsSync(chartModulePath)) {
  const chartModule = fs.readFileSync(chartModulePath, 'utf8');
  for (const marker of [
    "version: VERSION_V6544",
    'register: registerV6544',
    'setData: setDataV6544',
    'setState: setStateV6544',
    'setSelection: setSelectionV6544',
    'clearSelection: clearSelectionV6544',
    'exportCsv: exportCsvV6544',
    'savePng: savePngV6544',
    'copyImage: copyImageV6544',
    'extendChartConfig',
    'createChart'
  ]) {
    if (!chartModule.includes(marker)) fail(`SharedChartModule is missing ${marker}`);
  }
}

if (!process.exitCode) {
  console.log(`Component contract valid: ${tables.length} tables, ${charts.length} charts, shared table and chart modules present.`);
}
