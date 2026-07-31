#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'DashboardMainScript.html');
let failed = false;

function pass(message) {
  console.log('PASS: ' + message);
}

function fail(message) {
  console.error('ERROR: ' + message);
  failed = true;
}

if (!fs.existsSync(mainPath)) {
  fail('Missing DashboardMainScript.html.');
} else {
  const main = fs.readFileSync(mainPath, 'utf8');
  const forbidden = [
    'Click to filter the dashboard',
    'Click selected row again to clear',
    'Click again to clear this selection',
    'Select this worker',
    'remakeCeramistPanelHintV6350'
  ];

  forbidden.forEach(function(marker) {
    if (main.includes(marker)) fail('Technician action-instruction copy remains: ' + marker);
    else pass('Removed technician action-instruction copy: ' + marker);
  });

  const required = [
    "titleParts.push('No CERAMICS task assigned: '",
    "titleParts.push('No remake case ID found: '",
    "titleParts.push('Remake cases: '",
    "escV6230(rowTooltip)",
    "const masterTitleV6399 = isUnassignedV6399 ? unassignedTitleV6569 : label;",
    'v6.572: Keep technician hover copy informational'
  ];

  required.forEach(function(marker) {
    if (!main.includes(marker)) fail('Missing required informative technician tooltip marker: ' + marker);
    else pass('Informative technician tooltip marker present: ' + marker);
  });
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('Technician tooltip copy validation passed.');
  console.log('Version: v6.572');
  console.log('Action instructions removed: passed');
  console.log('Case numbers and attribution reasons preserved: passed');
}
