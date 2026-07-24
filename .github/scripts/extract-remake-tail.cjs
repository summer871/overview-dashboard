'use strict';

const crypto = require('crypto');
const fs = require('fs');

const basePath = 'DashboardBaseStyles.html';
const indexPath = 'Index.html';
const targetPath = 'RemakeTailStyles.html';

const expectedBaseSha256 = 'a72de1213e81b8154fff7a0d13a8dc1e97ab6f5fa2a548413a3bf806d93dcf03';
const startMarker = '    .remakeTrendList {';
const baseInclude = "  <?!= includeDashboardFile('DashboardBaseStyles') ?>";
const tailInclude = "  <?!= includeDashboardFile('RemakeTailStyles') ?>";
const requiredSelectors = [
  '.remakeTrendList',
  '.remakeTrendRow',
  '.remakeTrendMonth',
  '.remakeTrendBarTrack',
  '.remakeTrendBar',
  '.remakeTrendValue',
  '.remakeDirectionalNote',
  '.remakeFilterBar',
  '.remakeKpis',
  '.remakeGrid',
  '.remakeHeader',
  '.remakeActions',
  '.remakeRefreshStamp'
];

function fail(message) {
  throw new Error(message);
}

function read(path) {
  if (!fs.existsSync(path)) fail(`Missing required file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

const originalBase = read(basePath);
const originalIndex = read(indexPath);

if (sha256(originalBase) !== expectedBaseSha256) {
  fail(`Unexpected ${basePath} baseline. Refusing extraction.`);
}
if (fs.existsSync(targetPath)) fail(`${targetPath} already exists.`);
if (count(originalBase, startMarker) !== 1) fail(`Expected one ${startMarker} marker.`);
if (count(originalIndex, baseInclude) !== 1) fail('Expected one DashboardBaseStyles include.');
if (originalIndex.includes(tailInclude)) fail('RemakeTailStyles include already exists.');
if (!/<\/style>\s*$/.test(originalBase)) fail(`${basePath} must end with </style>.`);

const start = originalBase.indexOf(startMarker);
const end = originalBase.lastIndexOf('\n</style>');
if (start < 0 || end <= start) fail('Could not isolate the Remake tail CSS.');

const tailCss = originalBase.slice(start, end).replace(/\s+$/, '');
const basePrefix = originalBase.slice(0, start).replace(/\s+$/, '');

requiredSelectors.forEach((selector) => {
  if (!tailCss.includes(selector)) fail(`Tail is missing expected selector: ${selector}`);
});
if (!tailCss.includes('@media (max-width: 1100px)')) {
  fail('Tail is missing the final responsive media block.');
}

const nextBase = `${basePrefix}\n\n</style>\n`;
const nextTail = `<style id="cdaRemakeTailStylesV6529">\n${tailCss}\n</style>\n`;
const nextIndex = originalIndex.replace(baseInclude, `${baseInclude}\n${tailInclude}`);

if (count(nextIndex, baseInclude) !== 1 || count(nextIndex, tailInclude) !== 1) {
  fail('Include insertion validation failed.');
}
if (nextIndex.indexOf(tailInclude) !== nextIndex.indexOf(baseInclude) + baseInclude.length + 1) {
  fail('RemakeTailStyles must load immediately after DashboardBaseStyles.');
}
requiredSelectors.forEach((selector) => {
  if (nextBase.includes(selector)) fail(`Selector remained in ${basePath}: ${selector}`);
  if (!nextTail.includes(selector)) fail(`Selector missing from ${targetPath}: ${selector}`);
});

// Splitting one style block into two adjacent style blocks must preserve the exact CSS payload order.
const reconstructedCss = `${nextBase.slice(0, nextBase.lastIndexOf('\n</style>'))}\n\n${nextTail
  .replace(/^<style[^>]*>\n/, '')
  .replace(/\n<\/style>\n$/, '')}`;
const originalCss = originalBase.slice(0, originalBase.lastIndexOf('\n</style>'));
if (reconstructedCss !== originalCss) {
  fail('The reconstructed CSS payload is not byte-for-byte identical to the original payload.');
}

fs.writeFileSync(basePath, nextBase, 'utf8');
fs.writeFileSync(targetPath, nextTail, 'utf8');
fs.writeFileSync(indexPath, nextIndex, 'utf8');

console.log(JSON.stringify({
  status: 'prepared',
  changedFiles: [basePath, indexPath, targetPath],
  extractedBytes: Buffer.byteLength(tailCss, 'utf8'),
  selectorsPreserved: requiredSelectors,
  cssPayloadOrderPreserved: true,
  javascriptChanged: false
}, null, 2));
