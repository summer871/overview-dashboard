'use strict';

const fs = require('fs');
const path = require('path');

const reportPath = 'docs/LEGACY-DASHBOARD-RUNTIME-DEPENDENCY-AUDIT-2026-08-21.json';

function read(file) {
  if (!fs.existsSync(file)) throw new Error('Missing required file: ' + file);
  return fs.readFileSync(file, 'utf8');
}
function readOptional(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
function escapeRegex(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function countPattern(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}
function countToken(text, name) {
  return countPattern(text, new RegExp('\\b' + escapeRegex(name) + '\\b', 'g'));
}
function countBareCalls(text, name) {
  return countPattern(text, new RegExp('(?<![\\w$.])' + escapeRegex(name) + '\\s*\\(', 'g'));
}
function countTypeof(text, name) {
  return countPattern(text, new RegExp('\\btypeof\\s+' + escapeRegex(name) + '\\b', 'g'));
}
function countWindow(text, name) {
  return countPattern(text, new RegExp('\\bwindow\\.' + escapeRegex(name) + '\\b', 'g'));
}
function declarations(text) {
  const names = new Set();
  const patterns = [
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g,
    /\bclass\s+([A-Za-z_$][\w$]*)\b/g,
    /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g
  ];
  patterns.forEach(function(re) {
    let match;
    while ((match = re.exec(text))) names.add(match[1]);
  });
  return names;
}
function loadReport(file) {
  return JSON.parse(read(file));
}
function composeParent(report) {
  let parent = read(report.parentModule.path);
  (report.modules || []).forEach(function(module) {
    const directive = "<?!= includeDashboardFile('" + module.name + "') ?>";
    const content = read(module.path);
    if ((parent.split(directive).length - 1) !== 1) throw new Error('Unexpected include count for ' + module.name);
    parent = parent.replace(directive, function() { return content; });
  });
  return parent;
}

const legacyReport = loadReport('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json');
const remakeReport = loadReport('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json');
const legacyText = composeParent(legacyReport);
const remakeText = composeParent(remakeReport);
const tatFiles = [
  'TatDashboardControllerScript.html',
  'TatSharedFilterAdapterV6646.html',
  'TatDashboardBootstrapV6547.html',
  'TatDashboardDefinitionV6547.html'
];
const tatText = tatFiles.map(readOptional).join('\n');
const activeText = remakeText + '\n' + tatText;

const legacyDeclared = declarations(legacyText);
const activeDeclared = declarations(activeText);
const candidates = [];
const bareGlobalCandidates = [];
legacyDeclared.forEach(function(name) {
  if (activeDeclared.has(name)) return;
  const remakeReferences = countToken(remakeText, name);
  const tatReferences = countToken(tatText, name);
  if (!remakeReferences && !tatReferences) return;
  const entry = {
    name,
    remakeReferences,
    tatReferences,
    totalReferences: remakeReferences + tatReferences,
    legacyDeclarationCount: countToken(legacyText, name)
  };
  candidates.push(entry);

  const remakeBareCalls = countBareCalls(remakeText, name);
  const tatBareCalls = countBareCalls(tatText, name);
  const remakeTypeof = countTypeof(remakeText, name);
  const tatTypeof = countTypeof(tatText, name);
  if (remakeBareCalls || tatBareCalls || remakeTypeof || tatTypeof) {
    bareGlobalCandidates.push(Object.assign({}, entry, {
      remakeBareCalls,
      tatBareCalls,
      remakeTypeof,
      tatTypeof,
      guardedOnly: (remakeBareCalls + tatBareCalls) <= (remakeTypeof + tatTypeof)
    }));
  }
});
candidates.sort(function(a, b) { return b.totalReferences - a.totalReferences || a.name.localeCompare(b.name); });
bareGlobalCandidates.sort(function(a, b) {
  const aSignal = a.remakeBareCalls + a.tatBareCalls + a.remakeTypeof + a.tatTypeof;
  const bSignal = b.remakeBareCalls + b.tatBareCalls + b.remakeTypeof + b.tatTypeof;
  return bSignal - aSignal || b.totalReferences - a.totalReferences || a.name.localeCompare(b.name);
});

const explicitWindowExports = [];
const windowRe = /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g;
let windowMatch;
const seenWindow = new Set();
while ((windowMatch = windowRe.exec(legacyText))) {
  const name = windowMatch[1];
  if (seenWindow.has(name)) continue;
  seenWindow.add(name);
  const remakeReferences = countToken(remakeText, name);
  const tatReferences = countToken(tatText, name);
  if (remakeReferences || tatReferences) {
    explicitWindowExports.push({
      name,
      remakeReferences,
      tatReferences,
      shadowedByActiveDeclaration: activeDeclared.has(name),
      activeWindowReferences: countWindow(activeText, name)
    });
  }
}
explicitWindowExports.sort(function(a, b) { return (b.remakeReferences + b.tatReferences) - (a.remakeReferences + a.tatReferences) || a.name.localeCompare(b.name); });

const unshadowedWindowExports = explicitWindowExports.filter(function(item) { return !item.shadowedByActiveDeclaration; });
const unguardedBareGlobals = bareGlobalCandidates.filter(function(item) {
  return (item.remakeBareCalls + item.tatBareCalls) > 0 && item.guardedOnly !== true;
});

const report = {
  datePt: '2026-08-21',
  purpose: 'Conservative static audit before removing the staged legacy/paused Overview runtime from active execution.',
  behaviorChangeIntended: false,
  legacyDomain: legacyReport.domain,
  legacyBytes: Buffer.byteLength(legacyText, 'utf8'),
  remakeBytesAudited: Buffer.byteLength(remakeText, 'utf8'),
  tatFilesAudited: tatFiles.filter(function(file) { return fs.existsSync(file); }),
  legacyDeclaredSymbolCount: legacyDeclared.size,
  activeDeclaredSymbolCount: activeDeclared.size,
  candidateCrossDomainSymbolCount: candidates.length,
  candidateCrossDomainSymbols: candidates,
  bareGlobalCandidateCount: bareGlobalCandidates.length,
  bareGlobalCandidates,
  unguardedBareGlobalCandidateCount: unguardedBareGlobals.length,
  unguardedBareGlobalCandidates: unguardedBareGlobals,
  referencedLegacyWindowExportCount: explicitWindowExports.length,
  referencedLegacyWindowExports: explicitWindowExports,
  unshadowedLegacyWindowExportCount: unshadowedWindowExports.length,
  unshadowedLegacyWindowExports: unshadowedWindowExports,
  allReferencedLegacyWindowExportsShadowedByActiveDeclarations: unshadowedWindowExports.length === 0,
  interpretation: 'Property calls such as Math.abs, window.open, and platform.util.escapeHtml are excluded from bare-call signals. A legacy removal blocker must be either an unshadowed window export or an unguarded bare global that is truly resolved from the legacy runtime after contextual trace.',
  runtimeFilesChanged: false
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  candidateCrossDomainSymbolCount: report.candidateCrossDomainSymbolCount,
  bareGlobalCandidateCount: report.bareGlobalCandidateCount,
  unguardedBareGlobalCandidateCount: report.unguardedBareGlobalCandidateCount,
  unshadowedLegacyWindowExportCount: report.unshadowedLegacyWindowExportCount,
  bareGlobalCandidates: report.bareGlobalCandidates,
  windowExports: report.referencedLegacyWindowExports
}, null, 2));
