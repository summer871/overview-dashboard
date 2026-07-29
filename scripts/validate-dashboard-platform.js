#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const foundationPath = path.join(root, 'SharedComponentFoundation.html');
const requiredVersion = 'v6.548';
const blockedReferences = [
  'TatCleanPlatformScriptPart',
  'TatCleanPlatformStylesV6545',
  'SharedTableCardRendererV6544',
  'SharedTableCardRendererV6546'
];
const requiredIncludes = [
  'SharedDashboardColumnsV6548',
  'SharedDashboardPopoutV6548',
  'SharedDashboardToolbarV6548',
  'SharedDashboardDecoratorV6548',
  'RemakeDashboardAdapterV6548',
  'RemakeDashboardDefinitionV6548',
  'RemakeDashboardBootstrapV6548'
];

function fail(message) {
  console.error('ERROR: ' + message);
  process.exitCode = 1;
}

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    fail('Missing file: ' + path.relative(root, filePath));
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function count(text, regex) {
  return (text.match(regex) || []).length;
}

function validateHtmlPartial(fileName, text) {
  const scriptOpen = count(text, /<script\b/gi);
  const scriptClose = count(text, /<\/script>/gi);
  const styleOpen = count(text, /<style\b/gi);
  const styleClose = count(text, /<\/style>/gi);
  if (scriptOpen !== scriptClose) fail(fileName + ' has mismatched script tags.');
  if (styleOpen !== styleClose) fail(fileName + ' has mismatched style tags.');
  Array.from(text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).forEach((match, index) => {
    try { new vm.Script(match[1], { filename:fileName + '#script-' + (index + 1) }); }
    catch (error) { fail(error.message); }
  });
}

const foundation = read(foundationPath);
if (!foundation.includes(requiredVersion)) fail('SharedComponentFoundation.html does not contain ' + requiredVersion + '.');
blockedReferences.forEach(reference => {
  if (foundation.includes(reference)) fail('Active foundation references blocked legacy runtime: ' + reference);
});

const includes = Array.from(
  foundation.matchAll(/includeDashboardFile\(['"]([A-Za-z0-9_-]+)['"]\)/g)
).map(match => match[1]);
if (!includes.length) fail('No active dashboard includes were found.');
const duplicateIncludes = includes.filter((name, index) => includes.indexOf(name) !== index);
if (duplicateIncludes.length) fail('Duplicate active includes: ' + Array.from(new Set(duplicateIncludes)).join(', '));
requiredIncludes.forEach(name => {
  if (!includes.includes(name)) fail('Missing required v6.548 include: ' + name);
});

includes.forEach(name => {
  const fileName = name + '.html';
  const text = read(path.join(root, fileName));
  validateHtmlPartial(fileName, text);
  blockedReferences.forEach(reference => {
    if (text.includes(reference)) fail(fileName + ' references blocked legacy runtime: ' + reference);
  });
});

const footer = read(path.join(root, 'SharedFooter.html'));
const router = read(path.join(root, 'Code.js'));
const tatDefinition = read(path.join(root, 'TatDashboardDefinitionV6547.html'));
const featureCatalog = read(path.join(root, 'SharedDashboardFeaturesV6547.html'));
const renderer = read(path.join(root, 'SharedDashboardRendererV6547.html'));
validateHtmlPartial('SharedFooter.html', footer);
try { new vm.Script(router, { filename:'Code.js' }); }
catch (error) { fail(error.message); }

if (!footer.includes("'v6.548'")) fail('SharedFooter.html is not stamped v6.548.');
if (!router.includes("'v6.548'")) fail('Code.js is not stamped v6.548.');
if (!featureCatalog.includes("key:'comparePriorYear'")) fail('Prior-year comparison is not registered.');
if (!featureCatalog.includes("label:'↗'")) fail('Shared pop-out icon is not the outward arrow.');
if (!featureCatalog.includes("appearance:'plain'")) fail('More-actions is not configured as a plain button.');
if (/STANDARD_FEATURES\s*=\s*\[[^\]]*['"]year['"]/.test(tatDefinition)) fail('TAT still opts into the year feature.');
const decorator = read(path.join(root, 'SharedDashboardDecoratorV6548.html'));
if (!decorator.includes("mountMode !== 'decorate'")) fail('Shared decorator does not enforce decorate-mode tabs.');

if (!process.exitCode) {
  console.log('Dashboard platform validation passed.');
  console.log('Version: ' + requiredVersion);
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
