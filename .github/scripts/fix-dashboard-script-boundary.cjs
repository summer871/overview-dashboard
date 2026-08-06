'use strict';

const fs = require('fs');
const path = require('path');

const footerPath = 'SharedFooter.html';
const popupMarker = 'cdaDashboardPopupMountV6558';
const broadMarker = 'popup.document';
const writeMarker = 'popup.document.write(';
const closeMarkers = ['popup.document.close();', 'popup.document.close()'];

function listHtmlFiles(directory) {
  const results = [];
  fs.readdirSync(directory, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === '.git' || entry.name === 'node_modules') return;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push.apply(results, listHtmlFiles(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) results.push(fullPath.replace(/\\/g, '/'));
  });
  return results;
}

const htmlFiles = listHtmlFiles('.');
const exactOwners = htmlFiles.filter(function (filePath) {
  return fs.readFileSync(filePath, 'utf8').includes(popupMarker);
});
const broadOwners = htmlFiles.map(function (filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const index = content.indexOf(broadMarker);
  if (index < 0) return null;
  return {
    filePath: filePath,
    index: index,
    snippet: content.slice(Math.max(0, index - 180), Math.min(content.length, index + 520)).replace(/\s+/g, ' ')
  };
}).filter(Boolean);

if (exactOwners.length !== 1) {
  console.error(JSON.stringify({
    exactOwnerCount: exactOwners.length,
    exactOwners: exactOwners,
    broadOwnerCount: broadOwners.length,
    broadOwners: broadOwners
  }, null, 2));
  throw new Error('Diagnostic guard: exact popup owner unresolved. Review broadOwners output.');
}

const dashboardPath = exactOwners[0];
const dashboard = fs.readFileSync(dashboardPath, 'utf8');
const footer = fs.readFileSync(footerPath, 'utf8');
const markerIndex = dashboard.indexOf(popupMarker);
const writeIndex = dashboard.lastIndexOf(writeMarker, markerIndex);
if (writeIndex < 0) throw new Error('Guard failed: popup.document.write() was not found before the popup marker.');

let closeIndex = -1;
let closeMarker = '';
closeMarkers.forEach(function (candidate) {
  const index = dashboard.indexOf(candidate, markerIndex);
  if (index >= 0 && (closeIndex < 0 || index < closeIndex)) { closeIndex = index; closeMarker = candidate; }
});
if (closeIndex < 0) throw new Error('Guard failed: popup.document.close() was not found after the popup marker.');

const popupSegment = dashboard.slice(writeIndex, closeIndex);
const literalClosePattern = /<\/script>/gi;
const escapedClosePattern = /<\\\/script>/gi;
const literalMatches = popupSegment.match(literalClosePattern) || [];
const escapedMatches = popupSegment.match(escapedClosePattern) || [];
let nextDashboard = dashboard;
let replacementCount = 0;
if (literalMatches.length === 1) {
  const repairedSegment = popupSegment.replace(literalClosePattern, function () { replacementCount += 1; return '<\\/script>'; });
  nextDashboard = dashboard.slice(0, writeIndex) + repairedSegment + dashboard.slice(closeIndex);
} else if (literalMatches.length === 0 && escapedMatches.length >= 1) {
  console.log('Popup script boundary is already escaped in ' + dashboardPath + '.');
} else {
  throw new Error('Guard failed: expected exactly one literal </script> in the popup segment, found ' + literalMatches.length + '.');
}

const nextMarkerIndex = nextDashboard.indexOf(popupMarker);
const nextWriteIndex = nextDashboard.lastIndexOf(writeMarker, nextMarkerIndex);
let nextCloseIndex = -1;
closeMarkers.forEach(function (candidate) {
  const index = nextDashboard.indexOf(candidate, nextMarkerIndex);
  if (index >= 0 && (nextCloseIndex < 0 || index < nextCloseIndex)) nextCloseIndex = index;
});
const nextPopupSegment = nextDashboard.slice(nextWriteIndex, nextCloseIndex);
if (/<\/script>/i.test(nextPopupSegment)) throw new Error('Validation failed: literal </script> remains in popup segment.');
if (!/<\\\/script>/i.test(nextPopupSegment)) throw new Error('Validation failed: escaped <\\/script> was not found.');

let nextFooter = footer;
if (nextFooter.includes("const UI_VERSION = 'v6.633';")) {
  nextFooter = nextFooter
    .replace(/Version: v6\.633/g, 'Version: v6.634')
    .replace(/'v6\.633'/g, "'v6.634'")
    .replace(/REMAKE-FILTER-SEMANTICS-72/g, 'REMAKE-HTML-BOUNDARY-73');
} else if (!nextFooter.includes("const UI_VERSION = 'v6.634';")) {
  throw new Error('Guard failed: footer is neither v6.633 nor v6.634.');
}
if (!nextFooter.includes("const UI_VERSION = 'v6.634';")) throw new Error('Validation failed: UI version.');
if (!nextFooter.includes("const BUILD_LABEL = 'REMAKE-HTML-BOUNDARY-73';")) throw new Error('Validation failed: build label.');
if (!nextFooter.includes("window.CDA_REMAKE_REFRESH_STATUS_VERSION='v6.634';")) throw new Error('Validation failed: refresh status version.');

if (nextDashboard !== dashboard) fs.writeFileSync(dashboardPath, nextDashboard, 'utf8');
if (nextFooter !== footer) fs.writeFileSync(footerPath, nextFooter, 'utf8');
fs.writeFileSync('.github/dashboard-script-boundary-target.txt', dashboardPath + '\n', 'utf8');
console.log(JSON.stringify({ok:true,ownerFile:dashboardPath,replacementCount:replacementCount,popupCloseMarker:closeMarker,uiVersion:'v6.634',build:'REMAKE-HTML-BOUNDARY-73'},null,2));
