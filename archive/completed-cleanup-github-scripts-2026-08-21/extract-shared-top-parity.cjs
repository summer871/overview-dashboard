'use strict';

const fs = require('fs');
const crypto = require('crypto');

const indexPath = 'Index.html';
const modulePath = 'SharedTopParityControllerV6527.html';
const includeLine = "<?!= includeDashboardFile('SharedTopParityControllerV6527') ?>";

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }

const original = fs.readFileSync(indexPath, 'utf8');
const moduleText = fs.readFileSync(modulePath, 'utf8');
const startMarker = '<script id="cdaSharedTopParityV6527Controller">';
const start = original.indexOf(startMarker);
if (start < 0) fail('Shared top parity controller start marker not found.');
const endStart = original.indexOf('</script>', start);
if (endStart < 0) fail('Shared top parity controller end marker not found.');
let end = endStart + '</script>'.length;
if (original[end] === '\r' && original[end + 1] === '\n') end += 2;
else if (original[end] === '\n') end += 1;

const block = original.slice(start, end);
if (block !== moduleText) fail('Extracted Index block does not exactly match SharedTopParityControllerV6527.html.');
if (original.indexOf(startMarker, start + 1) >= 0) fail('Multiple shared top parity controller blocks found.');
if (original.includes(includeLine)) fail('Shared top parity include already present.');

const next = original.slice(0, start) + includeLine + '\n' + original.slice(end);
if (next.includes(startMarker)) fail('Inline shared top parity controller remains after replacement.');
if (!next.includes(includeLine)) fail('Shared top parity include missing after replacement.');

fs.writeFileSync(indexPath, next, 'utf8');
fs.writeFileSync('docs/INDEX-SHARED-TOP-PARITY-EXTRACTION-2026-08-21.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: indexPath,
  target: modulePath,
  sourceSha256Before: sha256(original),
  sourceSha256After: sha256(next),
  extractedBlockSha256: sha256(block),
  moduleSha256: sha256(moduleText),
  extractedBytes: Buffer.byteLength(block, 'utf8'),
  reconstructionVerified: original === next.replace(includeLine + '\n', moduleText),
  behaviorChangeIntended: false
}, null, 2) + '\n', 'utf8');

const report = JSON.parse(fs.readFileSync('docs/INDEX-SHARED-TOP-PARITY-EXTRACTION-2026-08-21.json', 'utf8'));
if (!report.reconstructionVerified) fail('Byte-for-byte reconstruction verification failed.');
console.log(JSON.stringify(report, null, 2));
