'use strict';

const fs = require('fs');
const crypto = require('crypto');

const sourcePath = 'DashboardMainScript.html';
const indexPath = 'Index.html';
const chunkPrefix = 'DashboardMainScriptPart';
const maxChunkBytes = 90000;

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

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function splitAtSafeBoundaries(source) {
  const lines = source.split(/(?<=\n)/);
  const chunks = [];
  let current = '';
  let scriptDepth = 0;

  function flush() {
    if (!current) return;
    chunks.push(current);
    current = '';
  }

  for (const line of lines) {
    current += line;
    const opens = (line.match(/<script(?:\s|>)/gi) || []).length;
    const closes = (line.match(/<\/script>/gi) || []).length;
    scriptDepth += opens - closes;

    if (byteLength(current) >= maxChunkBytes && scriptDepth === 0) {
      flush();
    }
  }

  flush();
  return chunks;
}

const source = read(sourcePath);
const index = read(indexPath);
const sourceSha = sha256(source);
const sourceBytes = byteLength(source);

if (sourceBytes < maxChunkBytes) {
  fail(`${sourcePath} is already below the configured AI readability threshold.`);
}

const includePattern = /<\?!= includeDashboardFile\('DashboardMainScript', \{dashboardBaseUrl: dashboardBaseUrl, dashboardPresentationVersion: dashboardPresentationVersion, dashboardPresentationMode: dashboardPresentationMode, dashboardPresentationSource: dashboardPresentationSource\}\) \?>/;
const includeMatch = index.match(includePattern);
if (!includeMatch) fail('Could not find the canonical DashboardMainScript include in Index.html.');
if ((index.match(includePattern) || []).length !== 1) fail('Expected exactly one DashboardMainScript include.');

const chunks = splitAtSafeBoundaries(source);
if (chunks.length < 2) fail('Expected more than one output chunk.');

chunks.forEach((chunk, i) => {
  const bytes = byteLength(chunk);
  if (bytes > maxChunkBytes * 1.15) {
    fail(`Chunk ${i + 1} is unexpectedly large at ${bytes} bytes.`);
  }
});

const rebuilt = chunks.join('');
if (rebuilt !== source) fail('Split output does not reconstruct the original source byte-for-byte.');
if (sha256(rebuilt) !== sourceSha) fail('Split output hash does not match the source hash.');

const includeLines = chunks.map((_, i) => {
  const file = `${chunkPrefix}${String(i + 1).padStart(2, '0')}`;
  return `<?!= includeDashboardFile('${file}', {dashboardBaseUrl: dashboardBaseUrl, dashboardPresentationVersion: dashboardPresentationVersion, dashboardPresentationMode: dashboardPresentationMode, dashboardPresentationSource: dashboardPresentationSource}) ?>`;
});

const nextIndex = index.replace(includePattern, includeLines.join('\n'));
if (nextIndex === index) fail('Index include replacement did not change the file.');

chunks.forEach((chunk, i) => {
  const file = `${chunkPrefix}${String(i + 1).padStart(2, '0')}.html`;
  if (fs.existsSync(file)) fail(`Refusing to overwrite existing file: ${file}`);
  fs.writeFileSync(file, chunk, 'utf8');
});
fs.writeFileSync(indexPath, nextIndex, 'utf8');
fs.unlinkSync(sourcePath);

const manifest = {
  generatedAt: new Date().toISOString(),
  sourcePath,
  sourceBytes,
  sourceSha256: sourceSha,
  maxChunkBytes,
  chunkCount: chunks.length,
  chunks: chunks.map((chunk, i) => ({
    file: `${chunkPrefix}${String(i + 1).padStart(2, '0')}.html`,
    bytes: byteLength(chunk),
    sha256: sha256(chunk)
  })),
  byteForByteReconstructionVerified: true,
  behaviorChangeIntended: false,
  note: 'Mechanical source split only. No logic, markup, styles, strings, or ordering changed inside DashboardMainScript payload.'
};

fs.writeFileSync('docs/DASHBOARD-MAIN-AI-SPLIT-MANIFEST.json', JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(manifest, null, 2));
