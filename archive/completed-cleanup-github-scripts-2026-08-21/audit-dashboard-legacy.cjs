'use strict';

const fs = require('fs');

const files = [
  'Index.html',
  'DashboardMainScript.html',
  'DashboardBaseStyles.html',
  'DashboardSupportScript01.html',
  'DashboardSupportScript02.html',
  'DashboardSupportScript03.html',
  'DashboardSupportScript04.html',
  'TatDashboardControllerScript.html',
  'SharedFilterBar.html',
  'SharedTopParityStyles.html',
  'SharedTableModule.html',
  'SharedDashboardTablePlatformV6586.html'
].filter(fs.existsSync);

const groups = {
  overview: [
    'overviewOne', 'overviewTwo', 'overviewNavActions', 'tabOneBtn',
    'renderOverview', 'Overview One', 'Overview Two'
  ],
  legacyFilterHeader: [
    'remakeTabFilterHostV6337', 'tatTabFilterHostV6509',
    'remakeDropdownHeaderV6245', 'remakeDropdownButtonV6245',
    'remakeDropdownPanelV6245', 'remakeDropdownSearchV6245',
    'remakeDropdownCountV6245', 'remakeFilterBarV6230',
    'multiFilterMarkupV6245', 'allOptionsForDropdownV6245',
    'applyRemakeFactorFilters', 'updateDropdownLabels',
    'clearDropdownSearch', 'prepareDropdownAction'
  ],
  sharedFilter: [
    'SharedFilterBar', 'CDA_SHARED_FILTER_BAR', 'cdaFilterBar_',
    'syncLinked', 'getPopulationKeys'
  ],
  tableOwners: [
    'SharedTableModule', 'SharedDashboardTablePlatform',
    'renderCustomerTable', 'renderRemakeTable', 'renderProductTable',
    'renderStandardTable', 'renderTables'
  ]
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function occurrences(text, term) {
  const result = [];
  let from = 0;
  while (from < text.length) {
    const index = text.indexOf(term, from);
    if (index < 0) break;
    result.push(lineNumberAt(text, index));
    from = index + term.length;
  }
  return result;
}

function normalizeFamily(name) {
  return name
    .replace(/V\d+(?:_\d+)?$/i, '')
    .replace(/v\d+(?:_\d+)?$/i, '')
    .replace(/\d+$/i, '');
}

const report = [];
report.push('# Dashboard Legacy Ownership Audit — 2026-08-21');
report.push('');
report.push('Current-source audit only. No runtime files are modified by this audit.');
report.push('');

for (const [groupName, terms] of Object.entries(groups)) {
  report.push(`## ${groupName}`);
  report.push('');
  for (const file of files) {
    const text = read(file);
    const hits = [];
    for (const term of terms) {
      const lines = occurrences(text, term);
      if (lines.length) hits.push(`${term}: ${lines.length} hit(s) at line(s) ${lines.slice(0, 24).join(', ')}${lines.length > 24 ? ', ...' : ''}`);
    }
    if (hits.length) {
      report.push(`### ${file}`);
      hits.forEach(hit => report.push(`- ${hit}`));
      report.push('');
    }
  }
}

report.push('## Function definition duplicates and version families');
report.push('');
for (const file of files) {
  if (!/\.(html|js)$/.test(file)) continue;
  const text = read(file);
  const defs = [];
  const re = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = re.exec(text))) {
    defs.push({ name: match[1], line: lineNumberAt(text, match.index) });
  }
  const byName = new Map();
  const byFamily = new Map();
  for (const def of defs) {
    if (!byName.has(def.name)) byName.set(def.name, []);
    byName.get(def.name).push(def.line);
    const family = normalizeFamily(def.name);
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(def);
  }
  const exactDupes = [...byName.entries()].filter(([, lines]) => lines.length > 1);
  const versionFamilies = [...byFamily.entries()]
    .filter(([, members]) => new Set(members.map(item => item.name)).size > 1)
    .sort((a, b) => b[1].length - a[1].length);
  if (!exactDupes.length && !versionFamilies.length) continue;
  report.push(`### ${file}`);
  if (exactDupes.length) {
    report.push('**Exact repeated function declarations**');
    exactDupes.slice(0, 80).forEach(([name, lines]) => report.push(`- ${name}: ${lines.length} declarations at ${lines.join(', ')}`));
  }
  if (versionFamilies.length) {
    report.push('**Version-stacked function families**');
    versionFamilies.slice(0, 120).forEach(([family, members]) => {
      const names = members.map(item => `${item.name}@${item.line}`);
      report.push(`- ${family}: ${names.join(', ')}`);
    });
  }
  report.push('');
}

const index = read('Index.html');
report.push('## Index inline style/script ownership candidates');
report.push('');
const idRe = /<(style|script)\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi;
let idMatch;
while ((idMatch = idRe.exec(index))) {
  const id = idMatch[2];
  if (/(overview|remake|tat|filter|header|table|shared)/i.test(id)) {
    report.push(`- ${idMatch[1]} #${id} — line ${lineNumberAt(index, idMatch.index)}`);
  }
}
report.push('');

report.push('## Source sizes');
report.push('');
files.forEach(file => report.push(`- ${file}: ${fs.statSync(file).size} bytes`));
report.push('');

fs.mkdirSync('docs/audits', { recursive: true });
fs.writeFileSync('docs/audits/DASHBOARD-LEGACY-OWNERSHIP-AUDIT-2026-08-21.md', report.join('\n') + '\n', 'utf8');
console.log(`Wrote audit for ${files.length} files.`);
