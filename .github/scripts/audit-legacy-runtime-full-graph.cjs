'use strict';

const fs = require('fs');
const path = require('path');

const reportPath = 'docs/LEGACY-DASHBOARD-FULL-RUNTIME-GRAPH-AUDIT-2026-08-21.json';
const legacyReportPath = 'docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json';
const remakeReportPath = 'docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json';

function read(file) {
  if (!fs.existsSync(file)) throw new Error('Missing required file: ' + file);
  return fs.readFileSync(file, 'utf8');
}
function escapeRegex(name) { return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function count(text, re) { const hits = text.match(re); return hits ? hits.length : 0; }
function tokenCount(text, name) { return count(text, new RegExp('\\b' + escapeRegex(name) + '\\b', 'g')); }
function bareCallCount(text, name) { return count(text, new RegExp('(?<![\\w$.])' + escapeRegex(name) + '\\s*\\(', 'g')); }
function typeofCount(text, name) { return count(text, new RegExp('\\btypeof\\s+' + escapeRegex(name) + '\\b', 'g')); }
function windowCount(text, name) { return count(text, new RegExp('\\bwindow\\.' + escapeRegex(name) + '\\b', 'g')); }
function handlerCount(text, name) { return count(text, new RegExp('on(?:click|change|input|keydown|keyup|submit)\\s*=\\s*["\\'][^"\\']*\\b' + escapeRegex(name) + '\\s*\\(', 'gi')); }
function declarations(text) {
  const names = new Set();
  const patterns = [
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g,
    /\bclass\s+([A-Za-z_$][\w$]*)\b/g,
    /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g
  ];
  patterns.forEach(function(re) { let m; while ((m = re.exec(text))) names.add(m[1]); });
  return names;
}
function compose(report) {
  let parent = read(report.parentModule.path);
  (report.modules || []).forEach(function(module) {
    const directive = "<?!= includeDashboardFile('" + module.name + "') ?>";
    const content = read(module.path);
    if ((parent.split(directive).length - 1) !== 1) throw new Error('Unexpected include count: ' + module.name);
    parent = parent.replace(directive, function() { return content; });
  });
  return parent;
}
function includeNames(text) {
  const names = [];
  const re = /includeDashboardFile\(\s*['"]([A-Za-z0-9_-]+)['"]/g;
  let m;
  while ((m = re.exec(text))) names.push(m[1]);
  return names;
}

const legacyReport = JSON.parse(read(legacyReportPath));
const remakeReport = JSON.parse(read(remakeReportPath));
const legacyText = compose(legacyReport);
const legacyNames = new Set([legacyReport.parentModule.name].concat((legacyReport.modules || []).map(function(m) { return m.name; })));
const runtimeFiles = new Map();
const queue = ['Index'];
const visited = new Set();
while (queue.length) {
  const name = queue.shift();
  if (visited.has(name) || legacyNames.has(name)) continue;
  visited.add(name);
  const file = name + '.html';
  if (!fs.existsSync(file)) continue;
  const text = read(file);
  runtimeFiles.set(file, text);
  includeNames(text).forEach(function(child) { if (!visited.has(child) && !legacyNames.has(child)) queue.push(child); });
}

// DashboardMain is included with a template context, and its nested Remake parent must be traced.
if (!runtimeFiles.has('DashboardMainScript.html')) runtimeFiles.set('DashboardMainScript.html', read('DashboardMainScript.html'));
includeNames(read('DashboardMainScript.html')).forEach(function(name) {
  if (legacyNames.has(name)) return;
  const file = name + '.html';
  if (fs.existsSync(file)) {
    const text = read(file);
    runtimeFiles.set(file, text);
    includeNames(text).forEach(function(child) {
      if (legacyNames.has(child)) return;
      const childFile = child + '.html';
      if (fs.existsSync(childFile)) runtimeFiles.set(childFile, read(childFile));
    });
  }
});

// Ensure every Remake semantic child is included even though it is nested in a raw composition parent.
(runtimeFiles.has(remakeReport.parentModule.path) ? [] : [remakeReport.parentModule.path]).forEach(function(file) { runtimeFiles.set(file, read(file)); });
(remakeReport.modules || []).forEach(function(module) { runtimeFiles.set(module.path, read(module.path)); });

const activeCombined = Array.from(runtimeFiles.values()).join('\n');
const activeDeclared = declarations(activeCombined);
const legacyDeclared = declarations(legacyText);

const windowExports = [];
const windowRe = /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g;
let wm;
const seenWindow = new Set();
while ((wm = windowRe.exec(legacyText))) {
  const name = wm[1];
  if (seenWindow.has(name)) continue;
  seenWindow.add(name);
  const fileRefs = [];
  runtimeFiles.forEach(function(text, file) {
    const refs = tokenCount(text, name);
    if (refs) fileRefs.push({ file, refs, windowRefs: windowCount(text, name), bareCalls: bareCallCount(text, name), handlers: handlerCount(text, name) });
  });
  if (!fileRefs.length) continue;
  windowExports.push({ name, shadowedByActiveDeclaration: activeDeclared.has(name), fileRefs });
}

const bareCandidates = [];
legacyDeclared.forEach(function(name) {
  if (activeDeclared.has(name)) return;
  const fileRefs = [];
  runtimeFiles.forEach(function(text, file) {
    const bareCalls = bareCallCount(text, name);
    const typeofs = typeofCount(text, name);
    const handlers = handlerCount(text, name);
    if (bareCalls || typeofs || handlers) fileRefs.push({ file, bareCalls, typeofs, handlers });
  });
  if (fileRefs.length) bareCandidates.push({ name, fileRefs });
});

const blockers = bareCandidates.filter(function(candidate) {
  return candidate.fileRefs.some(function(ref) { return ref.bareCalls > ref.typeofs || ref.handlers > 0; });
});
const unshadowedWindowExports = windowExports.filter(function(item) { return !item.shadowedByActiveDeclaration; });

const report = {
  datePt: '2026-08-21',
  purpose: 'Full active runtime graph audit before removing LegacyDashboardRuntime from DashboardMain.',
  behaviorChangeIntended: false,
  legacyBytes: Buffer.byteLength(legacyText, 'utf8'),
  activeRuntimeFileCount: runtimeFiles.size,
  activeRuntimeFiles: Array.from(runtimeFiles.keys()).sort(),
  legacyDeclaredSymbolCount: legacyDeclared.size,
  activeDeclaredSymbolCount: activeDeclared.size,
  referencedLegacyWindowExportCount: windowExports.length,
  referencedLegacyWindowExports: windowExports,
  unshadowedLegacyWindowExportCount: unshadowedWindowExports.length,
  unshadowedLegacyWindowExports: unshadowedWindowExports,
  bareGlobalCandidateCount: bareCandidates.length,
  bareGlobalCandidates: bareCandidates,
  removalBlockerCandidateCount: blockers.length,
  removalBlockerCandidates: blockers,
  interpretation: 'This audit traverses Index includes recursively, excludes the staged legacy runtime itself, includes nested Remake semantic modules, and reports exact active files for each possible legacy dependency. Candidates still require contextual review because function parameters and local callbacks can resemble globals without an AST.',
  runtimeFilesChanged: false
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  activeRuntimeFileCount: report.activeRuntimeFileCount,
  referencedLegacyWindowExportCount: report.referencedLegacyWindowExportCount,
  unshadowedLegacyWindowExportCount: report.unshadowedLegacyWindowExportCount,
  bareGlobalCandidateCount: report.bareGlobalCandidateCount,
  removalBlockerCandidateCount: report.removalBlockerCandidateCount,
  removalBlockerCandidates: report.removalBlockerCandidates
}, null, 2));
