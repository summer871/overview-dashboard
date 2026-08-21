'use strict';

const fs = require('fs');
const crypto = require('crypto');

const sourcePath = 'Index.html';
const outputDir = 'docs/ai-readable/index';
const manifestPath = `${outputDir}/manifest.json`;
const partPrefix = 'IndexPart';
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

function chunkPath(index) {
  return `${outputDir}/${partPrefix}${String(index + 1).padStart(2, '0')}.html.txt`;
}

const source = read(sourcePath);
const sourceSha = sha256(source);
const sourceBytes = bytes(source);

if (sourceBytes <= maxAiReadableBytes) {
  fail(`${sourcePath} is already below the AI-readable threshold.`);
}

const chunks = buildChunks(source);
if (chunks.length < 2) fail('Expected multiple Index inspection chunks.');

const reconstructed = chunks.join('');
if (reconstructed !== source) fail('Chunk reconstruction is not byte-for-byte identical to Index.html.');
if (sha256(reconstructed) !== sourceSha) fail('Chunk reconstruction hash mismatch.');

chunks.forEach((chunk, index) => {
  const size = bytes(chunk);
  if (size > maxAiReadableBytes) {
    fail(`${chunkPath(index)} exceeds ${maxAiReadableBytes} bytes: ${size}`);
  }
});

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const generatedFiles = chunks.map((chunk, index) => {
  const file = chunkPath(index);
  fs.writeFileSync(file, chunk, 'utf8');
  return {
    file,
    bytes: bytes(chunk),
    sha256: sha256(chunk),
    aiReadable: true
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  authoritativeSource: sourcePath,
  authoritativeSourceBytes: sourceBytes,
  authoritativeSourceSha256: sourceSha,
  maxAiReadableBytes,
  targetBytes,
  chunkCount: chunks.length,
  chunks: generatedFiles,
  byteForByteReconstructionVerified: reconstructed === source && sha256(reconstructed) === sourceSha,
  runtimeSourceChanged: false,
  behaviorChangeIntended: false,
  note: 'Inspection mirror only. These .txt chunks are not Apps Script runtime files and must never be included by Index.html.'
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(manifest, null, 2));
