'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sourcePath = 'DashboardMainScript.html';
const outputDir = 'docs/ai-readable/dashboard-main';
const chunkPrefix = 'DashboardMainScript-Part';
const targetChunkBytes = 70000;

function fail(message) {
  throw new Error(message);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing required file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function splitByWholeLines(source) {
  if (byteLength(source) <= targetChunkBytes) return [source];
  const lines = source.split(/(?<=\n)/);
  const chunks = [];
  let current = '';

  for (const line of lines) {
    if (current && byteLength(current) + byteLength(line) > targetChunkBytes) {
      chunks.push(current);
      current = '';
    }
    current += line;
  }

  if (current) chunks.push(current);
  return chunks;
}

const source = read(sourcePath);
const sourceBytes = byteLength(source);
const sourceSha = sha256(source);
const chunks = splitByWholeLines(source);
if (!chunks.length) fail('Expected at least one readable DashboardMain inspection chunk.');
if (chunks.join('') !== source) fail('Generated chunks do not reconstruct the source byte-for-byte.');
if (sha256(chunks.join('')) !== sourceSha) fail('Generated chunks do not match the source SHA-256.');
chunks.forEach((chunk, index) => {
  if (byteLength(chunk) > targetChunkBytes) fail(`Chunk ${index + 1} exceeds the configured readability target.`);
});

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const entries = chunks.map((chunk, index) => {
  const fileName = `${chunkPrefix}${String(index + 1).padStart(2, '0')}.txt`;
  const relativePath = path.posix.join(outputDir, fileName);
  fs.writeFileSync(relativePath, chunk, 'utf8');
  return {
    part: index + 1,
    file: relativePath,
    bytes: byteLength(chunk),
    sha256: sha256(chunk)
  };
});

const manifest = {
  generatedAtUtc: new Date().toISOString(),
  authoritativeSource: sourcePath,
  authoritativeSourceBytes: sourceBytes,
  authoritativeSourceSha256: sourceSha,
  targetChunkBytes,
  chunkCount: entries.length,
  chunks: entries,
  byteForByteReconstructionVerified: true,
  runtimeFilesChanged: false,
  purpose: sourceBytes <= targetChunkBytes
    ? 'Read-only inspection mirror. DashboardMainScript.html is itself below the AI readability target after semantic extraction.'
    : 'Read-only AI inspection mirror for legacy cleanup. These chunks are generated evidence, not runtime owners and must never be edited directly.'
};

fs.writeFileSync(
  path.posix.join(outputDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8'
);

const readme = `# DashboardMainScript AI-readable mirror\n\nThis directory is generated from \`${sourcePath}\` for inspection only.\n\n- Authoritative runtime source: \`${sourcePath}\`\n- Source SHA-256: \`${sourceSha}\`\n- Source bytes: ${sourceBytes}\n- Generated parts: ${entries.length}\n- Reconstruction: byte-for-byte verified\n\nDo not edit these part files. Regenerate them with \`.github/scripts/split-dashboard-main-for-ai.cjs\`.\n`;
fs.writeFileSync(path.posix.join(outputDir, 'README.md'), readme, 'utf8');

console.log(JSON.stringify(manifest, null, 2));
