'use strict';

const fs = require('fs');
const crypto = require('crypto');

const sourcePath = 'Index.html';
const shellPath = 'IndexShell.html';
const codePath = 'Code.js';
const manifestPath = 'docs/INDEX-AI-STRUCTURAL-SPLIT-2026-08-21.json';
const partPrefix = 'IndexRuntimePart';
const maxAiReadableBytes = 75000;
const targetBytes = 62000;

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

function bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function safeSplitPositions(source) {
  const positions = [0];
  let scriptDepth = 0;
  let styleDepth = 0;
  let templateDepth = 0;
  let last = 0;
  let index = 0;

  while (index < source.length) {
    if (source.startsWith('<?', index)) {
      templateDepth += 1;
      index += 2;
      continue;
    }
    if (source.startsWith('?>', index) && templateDepth > 0) {
      templateDepth -= 1;
      index += 2;
      continue;
    }

    if (templateDepth === 0) {
      const rest = source.slice(index);
      const openScript = rest.match(/^<script(?:\s|>)/i);
      if (openScript) {
        scriptDepth += 1;
        index += openScript[0].length;
        continue;
      }
      if (rest.match(/^<\/script\s*>/i)) {
        scriptDepth = Math.max(0, scriptDepth - 1);
      }
      const openStyle = rest.match(/^<style(?:\s|>)/i);
      if (openStyle) {
        styleDepth += 1;
        index += openStyle[0].length;
        continue;
      }
      if (rest.match(/^<\/style\s*>/i)) {
        styleDepth = Math.max(0, styleDepth - 1);
      }
    }

    if (source[index] === '\n' && scriptDepth === 0 && styleDepth === 0 && templateDepth === 0) {
      const position = index + 1;
      if (bytes(source.slice(last, position)) >= targetBytes) {
        positions.push(position);
        last = position;
      }
    }
    index += 1;
  }

  if (positions[positions.length - 1] !== source.length) positions.push(source.length);
  return positions;
}

function buildChunks(source) {
  const positions = safeSplitPositions(source);
  const chunks = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    const chunk = source.slice(positions[i], positions[i + 1]);
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function chunkName(index) {
  return `${partPrefix}${String(index + 1).padStart(2, '0')}`;
}

const source = read(sourcePath);
const originalCode = read(codePath);
const sourceSha = sha256(source);
const sourceBytes = bytes(source);

if (sourceBytes <= maxAiReadableBytes) {
  fail(`${sourcePath} is already below the AI-readable threshold.`);
}

const chunks = buildChunks(source);
if (chunks.length < 2) fail('Expected multiple Index runtime chunks.');

const reconstructed = chunks.join('');
if (reconstructed !== source) fail('Chunk reconstruction is not byte-for-byte identical to Index.html.');
if (sha256(reconstructed) !== sourceSha) fail('Chunk reconstruction hash mismatch.');

chunks.forEach((chunk, index) => {
  const size = bytes(chunk);
  if (size > maxAiReadableBytes) {
    fail(`${chunkName(index)}.html exceeds ${maxAiReadableBytes} bytes: ${size}`);
  }
});

const context = '{dashboardBaseUrl: dashboardBaseUrl, dashboardPresentationVersion: dashboardPresentationVersion, dashboardPresentationMode: dashboardPresentationMode, dashboardPresentationSource: dashboardPresentationSource}';
const shell = chunks.map((_, index) => `<?!= includeDashboardFile('${chunkName(index)}', ${context}) ?>`).join('');

const oldTemplateCall = "HtmlService.createTemplateFromFile('Index')";
const newTemplateCall = "HtmlService.createTemplateFromFile('IndexShell')";
if (count(originalCode, oldTemplateCall) !== 1) fail('Expected exactly one Code.js Index template call.');
if (originalCode.includes(newTemplateCall)) fail('Code.js already points at IndexShell.');
const nextCode = originalCode.replace(oldTemplateCall, newTemplateCall);

for (let i = 0; i < chunks.length; i += 1) {
  const path = `${chunkName(i)}.html`;
  if (fs.existsSync(path)) fail(`Refusing to overwrite existing generated file: ${path}`);
  fs.writeFileSync(path, chunks[i], 'utf8');
}
fs.writeFileSync(shellPath, shell, 'utf8');
fs.writeFileSync(codePath, nextCode, 'utf8');

const generatedFiles = chunks.map((chunk, index) => ({
  file: `${chunkName(index)}.html`,
  bytes: bytes(chunk),
  sha256: sha256(chunk),
  aiReadable: true
}));
generatedFiles.push({ file: shellPath, bytes: bytes(shell), sha256: sha256(shell), aiReadable: true });
generatedFiles.push({ file: codePath, bytes: bytes(nextCode), sha256: sha256(nextCode), aiReadable: true });

const manifest = {
  generatedAt: new Date().toISOString(),
  sourcePath,
  sourceBytes,
  sourceSha256: sourceSha,
  maxAiReadableBytes,
  targetBytes,
  chunkCount: chunks.length,
  generatedFiles,
  byteForByteReconstructionVerified: reconstructed === source && sha256(reconstructed) === sourceSha,
  originalIndexUntouched: true,
  entryPointChangedFrom: 'Index',
  entryPointChangedTo: 'IndexShell',
  behaviorChangeIntended: false,
  overviewRemoved: false,
  legacyCodeRemoved: false,
  note: 'Mechanical composition split only. Original Index.html remains intact as a rollback reference. Cleanup/removal happens only after the generated parts are readable and audited.'
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(manifest, null, 2));
