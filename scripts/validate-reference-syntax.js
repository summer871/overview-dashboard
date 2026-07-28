#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.cwd();
const targets = [
  'SharedCardModule.html',
  'SharedCardStyles.html',
  'SharedChartModule.html',
  'SharedChartStyles.html',
  'SharedTableModule.html',
  'TatDashboardControllerScript.html',
  'TatDepartmentComponentV6544.html',
  'TatDistributionComponentV6544.html',
  'SharedComponentFoundation.html'
];

let failed = false;
let scriptCount = 0;
let styleCount = 0;

function fail(message) {
  failed = true;
  console.error(`Reference syntax validation failed: ${message}`);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function countMatches(text, expression) {
  return (text.match(expression) || []).length;
}

function assertBalancedCss(css, label) {
  let depth = 0;
  let quote = '';
  let blockComment = false;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1] || '';

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) quote = '';
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth < 0) {
      fail(`${label} has an unmatched closing brace`);
      return;
    }
  }

  if (blockComment) fail(`${label} has an unterminated block comment`);
  if (quote) fail(`${label} has an unterminated quoted string`);
  if (depth !== 0) fail(`${label} has unbalanced braces (${depth})`);
}

for (const relativePath of targets) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`missing ${relativePath}`);
    continue;
  }

  const source = fs.readFileSync(fullPath, 'utf8');
  if (source.includes('\uFFFD')) fail(`${relativePath} contains a Unicode replacement character`);
  if (source.includes('\u0000')) fail(`${relativePath} contains a NUL byte`);

  const openScripts = countMatches(source, /<script\b/gi);
  const closeScripts = countMatches(source, /<\/script>/gi);
  const openStyles = countMatches(source, /<style\b/gi);
  const closeStyles = countMatches(source, /<\/style>/gi);

  if (openScripts !== closeScripts) fail(`${relativePath} has ${openScripts} opening and ${closeScripts} closing script tags`);
  if (openStyles !== closeStyles) fail(`${relativePath} has ${openStyles} opening and ${closeStyles} closing style tags`);

  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  let fileScriptIndex = 0;
  while ((scriptMatch = scriptPattern.exec(source)) !== null) {
    fileScriptIndex += 1;
    scriptCount += 1;
    try {
      new vm.Script(scriptMatch[1], {
        filename: `${relativePath}#script-${fileScriptIndex}`,
        displayErrors: true
      });
    } catch (error) {
      fail(`${relativePath} script ${fileScriptIndex}: ${error.message}`);
    }
  }

  const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  let fileStyleIndex = 0;
  while ((styleMatch = stylePattern.exec(source)) !== null) {
    fileStyleIndex += 1;
    styleCount += 1;
    assertBalancedCss(styleMatch[1], `${relativePath} style ${fileStyleIndex}`);
  }

  console.log(`${sha256(source)}  ${relativePath}`);
}

const foundationPath = path.join(root, 'SharedComponentFoundation.html');
if (fs.existsSync(foundationPath)) {
  const foundation = fs.readFileSync(foundationPath, 'utf8');
  const expectedOrder = [
    "includeDashboardFile('SharedCardStyles')",
    "includeDashboardFile('SharedCardModule')",
    "includeDashboardFile('SharedChartStyles')",
    "includeDashboardFile('SharedChartModule')",
    "includeDashboardFile('TatDepartmentComponentV6544')",
    "includeDashboardFile('TatDistributionComponentV6544')"
  ];
  let previous = -1;
  for (const marker of expectedOrder) {
    const current = foundation.indexOf(marker);
    if (current < 0) fail(`SharedComponentFoundation is missing ${marker}`);
    if (current >= 0 && current <= previous) fail(`SharedComponentFoundation include order is incorrect at ${marker}`);
    previous = current;
  }
}

if (!failed) {
  console.log(`Reference syntax valid: ${targets.length} exact files, ${scriptCount} script blocks, and ${styleCount} style blocks parsed successfully.`);
} else {
  process.exitCode = 1;
}
