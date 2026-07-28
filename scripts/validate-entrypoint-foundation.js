#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const codePath = path.join(root, 'Code.js');
const foundationPath = path.join(root, 'SharedComponentFoundation.html');

let failed = false;

function fail(message) {
  failed = true;
  console.error(`Entrypoint validation failed: ${message}`);
}

if (!fs.existsSync(codePath)) fail('missing Code.js');
if (!fs.existsSync(foundationPath)) fail('missing SharedComponentFoundation.html');

const code = fs.existsSync(codePath) ? fs.readFileSync(codePath, 'utf8') : '';
const foundation = fs.existsSync(foundationPath) ? fs.readFileSync(foundationPath, 'utf8') : '';

for (const marker of [
  "const sharedComponentFoundation = includeDashboardFile('SharedComponentFoundation');",
  "dashboardHtml + '\\n' + sharedComponentFoundation",
  'HtmlService.createHtmlOutput('
]) {
  if (!code.includes(marker)) fail(`Code.js is missing ${marker}`);
}

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

if (!failed) {
  console.log('Entrypoint valid: Code.js appends the evaluated shared component foundation to the rendered dashboard HTML.');
} else {
  process.exitCode = 1;
}
