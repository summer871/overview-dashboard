#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const foundationPath = path.join(root, 'SharedComponentFoundation.html');
const requiredVersion = 'v6.553';
const blockedReferences = [
  'TatCleanPlatformScriptPart',
  'TatCleanPlatformStylesV6545',
  'SharedTableCardRendererV6544',
  'SharedTableCardRendererV6546'
];
const requiredIncludes = [
  'SharedDashboardThemeV6549',
  'SharedDashboardRegistryV6547',
  'SharedDashboardColumnsV6548',
  'SharedDashboardPopoutV6548',
  'SharedDashboardToolbarV6548',
  'SharedDashboardAuditV6550',
  'SharedDashboardDecoratorV6548',
  'RemakeDashboardAdapterV6548',
  'RemakeDashboardDefinitionV6548',
  'RemakeDashboardBootstrapV6548',
  'TatDashboardBindingsV6547',
  'TatDashboardBootstrapV6547'
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
    try {
      new vm.Script(match[1], {filename:fileName + '#script-' + (index + 1)});
    } catch (error) {
      fail(error.message);
    }
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
  if (!includes.includes(name)) fail('Missing required v6.553 include: ' + name);
});

includes.forEach(name => {
  const fileName = name + '.html';
  const text = read(path.join(root, fileName));
  validateHtmlPartial(fileName, text);
  if (text.includes('Bolean')) fail(fileName + ' contains the invalid Bolean identifier.');
  blockedReferences.forEach(reference => {
    if (text.includes(reference)) fail(fileName + ' references blocked legacy runtime: ' + reference);
  });
});

const footer = read(path.join(root, 'SharedFooter.html'));
const router = read(path.join(root, 'Code.js'));
const tatDefinition = read(path.join(root, 'TatDashboardDefinitionV6547.html'));
const registry = read(path.join(root, 'SharedDashboardRegistryV6547.html'));
const featureCatalog = read(path.join(root, 'SharedDashboardFeaturesV6547.html'));
const columns = read(path.join(root, 'SharedDashboardColumnsV6548.html'));
const toolbar = read(path.join(root, 'SharedDashboardToolbarV6548.html'));
const theme = read(path.join(root, 'SharedDashboardThemeV6549.html'));
const popover = read(path.join(root, 'SharedDashboardPopoverV6547.html'));
const popout = read(path.join(root, 'SharedDashboardPopoutV6548.html'));
const audit = read(path.join(root, 'SharedDashboardAuditV6550.html'));
const decorator = read(path.join(root, 'SharedDashboardDecoratorV6548.html'));
const remakeDefinition = read(path.join(root, 'RemakeDashboardDefinitionV6548.html'));
const remakeBootstrap = read(path.join(root, 'RemakeDashboardBootstrapV6548.html'));
const tatBindings = read(path.join(root, 'TatDashboardBindingsV6547.html'));
const tatBootstrap = read(path.join(root, 'TatDashboardBootstrapV6547.html'));

validateHtmlPartial('SharedFooter.html', footer);
try {
  new vm.Script(router, {filename:'Code.js'});
} catch (error) {
  fail(error.message);
}

if (!footer.includes("'v6.553'")) fail('SharedFooter.html is not stamped v6.553.');
if (!footer.includes('STATEFUL-SHARED-ICONS-05')) fail('SharedFooter.html build label is not v6.553.');
if (!router.includes("'v6.553'")) fail('Code.js is not stamped v6.553.');
if (!registry.includes("const VERSION_V6547 = 'v6.550'")) fail('Shared dashboard registry is not stamped v6.550.');
if (!featureCatalog.includes("CDA_DASHBOARD_FEATURES_VERSION = 'v6.550'")) fail('Feature catalog is not stamped v6.550.');
if (!featureCatalog.includes("icon:'popout'") || !featureCatalog.includes("icon:'more'")) fail('Shared feature icons are not registry-based.');
if (!toolbar.includes('theme.icon(feature.icon)')) fail('Toolbar does not resolve icons through the shared theme.');
if (!toolbar.includes("version:'v6.550'")) fail('Shared toolbar is not stamped v6.550.');
if (!theme.includes("version:'v6.550'")) fail('Shared theme is not stamped v6.550.');
if (!theme.includes("popout:'↗'") || !theme.includes("more:'⋮'") ||
    !theme.includes("collapse:'▾'") || !theme.includes("expand:'▸'")) {
  fail('Shared theme icon registry is incomplete.');
}
if (columns.includes('.toggleChooser(')) fail('Shared Columns still delegates to the legacy chooser UI.');
if (!columns.includes("mode:'single-shared-chooser'")) fail('Shared Columns is not marked as the sole chooser owner.');
if (!columns.includes("version:'v6.550'")) fail('Shared Columns is not stamped v6.550.');
if (!popover.includes("themeVersion:'v6.550'")) fail('Shared popover is not bound to theme v6.550.');
if (!popout.includes('themeVersion:theme.version')) fail('Shared pop-out does not publish its theme binding.');
if (/#[0-9a-f]{3,8}/i.test(popout)) fail('Shared pop-out contains a hardcoded color literal.');
if (!audit.includes("version:'v6.553'")) fail('Rendered shared-control audit is not stamped v6.553.');
if (!audit.includes("data-cda-dashboard-icon-state")) fail('Rendered audit does not support stateful icons.');
if (!audit.includes('expectedIconName')) fail('Rendered audit does not resolve the current icon state.');
if (!audit.includes('commonFeatureStyleParity') || !audit.includes('legacyControlsHidden')) fail('Rendered shared-control audit is incomplete.');
if (!decorator.includes("version:'v6.551'")) fail('Shared decorator is not stamped v6.551.');
if (!decorator.includes('missingComponents')) fail('Shared decorator does not report missing components.');
if (!remakeDefinition.includes("version:'v6.552'")) fail('Remake definition is not stamped v6.552.');
if (remakeDefinition.includes("key:'trend'")) fail('Remake definition still requires the inactive trend card.');
const remakeComponentMatches = remakeDefinition.match(/\n\s*key:'(?:reason|department|product|customer|ceramist)'/g) || [];
if (remakeComponentMatches.length !== 5) fail('Remake definition does not contain exactly five active components.');
if (!remakeBootstrap.includes("version:'v6.553'")) fail('Remake bootstrap is not stamped v6.553.');
if (!remakeBootstrap.includes('expectedActiveComponents:5')) fail('Remake audit does not publish the five-component contract.');
if (!remakeBootstrap.includes('activeComponentModelCorrect')) fail('Remake audit does not validate the active component model.');
if (!remakeBootstrap.includes('base.toolbarCount === base.expectedToolbarCount')) fail('Remake success does not require exact toolbar count.');
if (!remakeBootstrap.includes('ok:registrationAudit.ok')) fail('Remake audit does not expose an overall pass/fail value.');
if (!tatBindings.includes("version:'v6.553'")) fail('TAT bindings are not stamped v6.553.');
if (!tatBindings.includes("theme.icon(iconName)")) fail('TAT collapse state does not resolve through the shared theme.');
if (!tatBindings.includes("data-cda-dashboard-icon-state")) fail('TAT collapse state does not publish its current icon.');
if (!tatBootstrap.includes("version:'v6.553'")) fail('TAT bootstrap is not stamped v6.553.');
if (!tatBootstrap.includes('sharedControlsValidated')) fail('TAT audit does not include rendered shared-control validation.');
if (/STANDARD_FEATURES\s*=\s*\[[^\]]*['"]year['"]/.test(tatDefinition)) fail('TAT still opts into the year feature.');

if (!process.exitCode) {
  try {
    childProcess.execFileSync(process.execPath, [path.join(root, 'scripts', 'test-dashboard-runtime-contracts.js')], {
      cwd:root,
      stdio:'inherit'
    });
  } catch (error) {
    fail('Dashboard runtime contracts failed.');
  }
}

if (!process.exitCode) {
  console.log('Dashboard platform validation passed.');
  console.log('Version: ' + requiredVersion);
  console.log('Active Remake component model: 5 cards');
  console.log('Stateful shared icon contract: passed');
  console.log('Active includes: ' + includes.length);
  includes.forEach(name => console.log('  - ' + name + '.html'));
}
