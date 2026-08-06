'use strict';

const fs = require('fs');

const dashboardPath = 'DashboardMainScript.html';
const footerPath = 'SharedFooter.html';

const dashboard = fs.readFileSync(dashboardPath, 'utf8');
const footer = fs.readFileSync(footerPath, 'utf8');

const closeMarker = 'popup.document.close();';
const closeIndex = dashboard.indexOf(closeMarker);
if (closeIndex < 0) {
  throw new Error('Guard failed: popup.document.close() marker was not found.');
}

const writeIndex = dashboard.lastIndexOf('popup.document.write(', closeIndex);
if (writeIndex < 0) {
  throw new Error('Guard failed: popup.document.write() was not found before popup.document.close().');
}

const popupSegment = dashboard.slice(writeIndex, closeIndex);
const literalClosePattern = /<\/script>/gi;
const literalMatches = popupSegment.match(literalClosePattern) || [];
const escapedMatches = popupSegment.match(/<\\\/script>/gi) || [];

let nextDashboard = dashboard;
let replacementCount = 0;

if (literalMatches.length === 1) {
  const repairedSegment = popupSegment.replace(literalClosePattern, function () {
    replacementCount += 1;
    return '<\\/script>';
  });
  nextDashboard = dashboard.slice(0, writeIndex) + repairedSegment + dashboard.slice(closeIndex);
} else if (literalMatches.length === 0 && escapedMatches.length >= 1) {
  console.log('Dashboard popup script boundary is already escaped; no dashboard rewrite needed.');
} else {
  throw new Error(
    'Guard failed: expected exactly one literal </script> inside the popup write segment, found ' +
    literalMatches.length + '.'
  );
}

const nextCloseIndex = nextDashboard.indexOf(closeMarker);
const nextWriteIndex = nextDashboard.lastIndexOf('popup.document.write(', nextCloseIndex);
const nextPopupSegment = nextDashboard.slice(nextWriteIndex, nextCloseIndex);
if (/<\/script>/i.test(nextPopupSegment)) {
  throw new Error('Validation failed: literal </script> remains inside the popup write segment.');
}
if (!/<\\\/script>/i.test(nextPopupSegment)) {
  throw new Error('Validation failed: escaped <\\/script> was not found in the popup write segment.');
}
if (!nextPopupSegment.includes('cdaDashboardPopupMountV6558')) {
  throw new Error('Validation failed: popup mount marker is missing from the repaired segment.');
}

let nextFooter = footer;
const requiredFooterReplacements = [
  [/'v6\.633'/g, "'v6.634'"],
  [/Version: v6\.633/g, 'Version: v6.634'],
  [/REMAKE-FILTER-SEMANTICS-72/g, 'REMAKE-HTML-BOUNDARY-73']
];

requiredFooterReplacements.forEach(function (entry) {
  const pattern = entry[0];
  const replacement = entry[1];
  if (!pattern.test(nextFooter)) {
    throw new Error('Guard failed: footer marker was not found for ' + String(pattern));
  }
  pattern.lastIndex = 0;
  nextFooter = nextFooter.replace(pattern, replacement);
});

if (!nextFooter.includes("const UI_VERSION = 'v6.634';")) {
  throw new Error('Validation failed: UI_VERSION was not updated to v6.634.');
}
if (!nextFooter.includes("const BUILD_LABEL = 'REMAKE-HTML-BOUNDARY-73';")) {
  throw new Error('Validation failed: build label was not updated.');
}
if (!nextFooter.includes("window.CDA_REMAKE_REFRESH_STATUS_VERSION='v6.634';")) {
  throw new Error('Validation failed: refresh-status version was not updated.');
}

if (nextDashboard !== dashboard) fs.writeFileSync(dashboardPath, nextDashboard, 'utf8');
if (nextFooter !== footer) fs.writeFileSync(footerPath, nextFooter, 'utf8');

console.log(JSON.stringify({
  ok: true,
  replacementCount: replacementCount,
  popupWriteStart: writeIndex,
  popupCloseMarker: closeIndex,
  uiVersion: 'v6.634',
  build: 'REMAKE-HTML-BOUNDARY-73'
}, null, 2));
