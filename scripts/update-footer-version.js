const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.argv[2] || 'Index.html');
const version = String(process.argv[3] || '').trim();
const expectedCount = Number(process.env.EXPECTED_FOOTER_COUNT || 2);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

if (!version) fail('A version argument is required, for example v6.530.');
if (!/^v\d+\.\d+$/.test(version)) fail(`Invalid version format: ${version}`);
if (!fs.existsSync(filePath)) fail(`File not found: ${filePath}`);

const original = fs.readFileSync(filePath, 'utf8');

if (original.includes('Full content omitted here due to size in this interface')) {
  fail('Index.html contains the known truncation placeholder. Restore the complete file before running this updater.');
}

if (original.length < 100000) {
  fail(`Index.html is unexpectedly small (${original.length} bytes). Refusing to edit a potentially incomplete file.`);
}

const oldWorker = 'Worker cache updated:';
const oldCache = 'Browser cache current:';
const currentPhrase = 'saved copy is current';
const versionPattern = /Version:\s*v\d+\.\d+/g;

const workerCount = countOccurrences(original, oldWorker);
const cacheCount = countOccurrences(original, oldCache);
const currentCount = countOccurrences(original, currentPhrase);
const existingVersionMatches = original.match(versionPattern) || [];

if (workerCount !== expectedCount) {
  fail(`Expected ${expectedCount} occurrences of "${oldWorker}" but found ${workerCount}.`);
}
if (cacheCount !== expectedCount) {
  fail(`Expected ${expectedCount} occurrences of "${oldCache}" but found ${cacheCount}.`);
}
if (currentCount !== expectedCount) {
  fail(`Expected ${expectedCount} occurrences of "${currentPhrase}" but found ${currentCount}.`);
}
if (existingVersionMatches.length !== 0) {
  fail(`Found ${existingVersionMatches.length} existing version label(s). Refusing to create duplicates.`);
}

let updated = original
  .split(oldWorker).join('Worker:')
  .split(oldCache).join('Cache:')
  .split(currentPhrase).join(`${currentPhrase} · Version: ${version}`);

const checks = [
  [countOccurrences(updated, oldWorker) === 0, `Old worker label still exists.`],
  [countOccurrences(updated, oldCache) === 0, `Old cache label still exists.`],
  [countOccurrences(updated, 'Worker:') >= expectedCount, `New worker label count is too low.`],
  [countOccurrences(updated, 'Cache:') >= expectedCount, `New cache label count is too low.`],
  [countOccurrences(updated, `Version: ${version}`) === expectedCount, `Version label count is not ${expectedCount}.`],
  [countOccurrences(updated, '<script') === countOccurrences(original, '<script'), 'Script tag count changed.'],
  [countOccurrences(updated, '</script>') === countOccurrences(original, '</script>'), 'Closing script tag count changed.'],
  [countOccurrences(updated, '<style') === countOccurrences(original, '<style'), 'Style tag count changed.'],
  [countOccurrences(updated, '</style>') === countOccurrences(original, '</style>'), 'Closing style tag count changed.'],
  [updated.length > original.length, 'Updated file did not grow as expected after adding version labels.']
];

for (const [passed, message] of checks) {
  if (!passed) fail(message);
}

fs.writeFileSync(filePath, updated, 'utf8');

console.log(`Updated ${path.basename(filePath)} successfully.`);
console.log(`Worker labels changed: ${workerCount}`);
console.log(`Cache labels changed: ${cacheCount}`);
console.log(`Version labels added: ${expectedCount}`);
console.log(`Version: ${version}`);
