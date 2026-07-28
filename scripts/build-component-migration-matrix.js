#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const reportsDir = path.join(root, 'reports');
const registryPath = path.join(root, 'scripts', 'dashboard-component-registry.json');
const inventoryPath = path.join(reportsDir, 'dashboard-component-inventory.json');

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Required file not found: ${path.relative(root, filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function value(input) {
  return String(input == null || input === '' ? '—' : input).replace(/\|/g, '\\|');
}

function isDynamicId(id) {
  return !id || /(?:\+|\$\{|<%|%>)/.test(id);
}

function tableEvidence(component, inventory) {
  const ids = new Set(component.domIds || []);
  return inventory.tables.filter((item) => {
    const found = [item.id, ...(item.descendantIds || [])].filter(Boolean);
    return found.some((id) => ids.has(id));
  });
}

function chartEvidence(component, inventory) {
  const ids = new Set(component.canvasIds || []);
  return inventory.canvases.filter((item) => ids.has(item.id));
}

function registrationEvidence(component, inventory) {
  const keys = new Set(component.registrationKeys || []);
  return inventory.tableRegistrations.filter((item) => keys.has(item.key));
}

function buildComponent(component, kind, inventory) {
  const evidence = kind === 'table' ? tableEvidence(component, inventory) : chartEvidence(component, inventory);
  const registrations = kind === 'table' ? registrationEvidence(component, inventory) : [];
  return {
    ...component,
    kind,
    found: evidence.length > 0,
    shared: kind === 'table' && (registrations.length > 0 || evidence.some((item) => item.shared)),
    evidence: evidence.map((item) => ({
      file: item.file,
      line: item.line,
      id: item.id || (item.descendantIds || []).join(', ')
    })),
    registrations: registrations.map((item) => ({
      file: item.file,
      line: item.line,
      key: item.key,
      features: item.features
    }))
  };
}

function knownTableReplica(item, registry) {
  return (registry.knownReplicas.tables || []).some((replica) => {
    if (replica.file && replica.file !== item.file) return false;
    if (replica.line && replica.line !== item.line) return false;
    if (replica.domIds) {
      const ids = [item.id, ...(item.descendantIds || [])].filter(Boolean);
      if (!ids.some((id) => replica.domIds.includes(id))) return false;
    }
    return true;
  });
}

function sourceDuplicates(inventory, registry) {
  const ignored = new Set(registry.knownReplicas.duplicateIds || []);
  return inventory.duplicateIds
    .filter((item) => !isDynamicId(item.id) && !ignored.has(item.id))
    .map((item) => ({
      ...item,
      classification: item.locations.some((location) => location.file === 'DashboardMainScript.html')
        && item.locations.some((location) => location.file === 'Index.html')
        ? 'source-template duplicate; verify runtime owner'
        : 'possible runtime duplicate'
    }));
}

function markdown(report, registry) {
  const lines = [
    '# v6.544 dashboard component migration matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This is the authoritative component checklist. The raw inventory remains evidence only and includes pop-out templates, generated HTML strings, and legacy fallback markup.',
    '',
    '## Canonical scope',
    '',
    '| Measure | Count |',
    '|---|---:|',
    `| Primary tables | ${report.summary.primaryTables} |`,
    `| Tables already using shared behavior | ${report.summary.sharedTables} |`,
    `| Primary charts | ${report.summary.primaryCharts} |`,
    `| Charts using shared chart behavior | ${report.summary.sharedCharts} |`,
    `| Unmapped raw table tags | ${report.summary.unmappedRawTables} |`,
    `| Unmapped raw canvases | ${report.summary.unmappedRawCanvases} |`,
    `| Source duplicate IDs requiring cleanup | ${report.summary.sourceDuplicateIds} |`,
    '',
    '## Base table contract',
    ''
  ];

  for (const item of registry.baseContracts.table.visual) lines.push(`- Visual: ${item}`);
  for (const item of registry.baseContracts.table.behavior) lines.push(`- Behavior: ${item}`);
  lines.push('', '## Base chart contract', '');
  for (const item of registry.baseContracts.chart.visual) lines.push(`- Visual: ${item}`);
  for (const item of registry.baseContracts.chart.behavior) lines.push(`- Behavior: ${item}`);

  function section(title, components) {
    lines.push(
      '',
      `## ${title}`,
      '',
      '| Tab | Component | Found | Shared now | Current renderer | Controls to retain | Interactions to retain | Custom features to retain | Target | Status |',
      '|---|---|---|---|---|---|---|---|---|---|'
    );
    for (const item of components) {
      lines.push(`| ${[
        item.tab,
        item.name,
        item.found ? 'Yes' : 'No',
        item.shared ? 'Yes' : 'No',
        item.currentRenderer,
        (item.requiredControls || []).join(', '),
        (item.requiredInteractions || []).join(', '),
        (item.customFeatures || []).join(', '),
        item.targetRenderer,
        item.migrationStatus
      ].map(value).join(' | ')} |`);
    }
  }

  section('Tables', report.tables);
  section('Charts', report.charts);

  lines.push('', '## Known replicas and false positives', '');
  lines.push('- Pop-out table and chart markup is tracked as a replica, not as a primary dashboard component.');
  lines.push('- Dynamic IDs assembled inside JavaScript strings are not treated as literal duplicate DOM IDs.');
  lines.push('- The Remake markup found in both `Index.html` and `DashboardMainScript.html` is a source-template duplication. It must be reduced to one runtime owner during migration.');

  lines.push('', '## Unmapped raw discoveries', '');
  if (!report.unmappedTables.length && !report.unmappedCanvases.length) lines.push('None.');
  for (const item of report.unmappedTables) lines.push(`- Table: ${item.file}:${item.line} — ${item.id || (item.descendantIds || []).join(', ') || 'no ID'}`);
  for (const item of report.unmappedCanvases) lines.push(`- Canvas: ${item.file}:${item.line} — ${item.id || 'no ID'}`);

  lines.push('', '## Source duplicate IDs', '');
  if (!report.sourceDuplicateIds.length) lines.push('None.');
  for (const item of report.sourceDuplicateIds) {
    lines.push(`- \`${item.id}\` — ${item.classification}: ${item.locations.map((location) => `${location.file}:${location.line}`).join(', ')}`);
  }

  lines.push('', '## Migration gate', '');
  lines.push('A component is complete only when its required controls, interactions, custom features, responsive behavior, loading/empty/error states, and visual contract are verified in `/dev`.');
  lines.push('');
  return lines.join('\n');
}

const registry = loadJson(registryPath);
const inventory = loadJson(inventoryPath);
const tables = registry.tables.map((item) => buildComponent(item, 'table', inventory));
const charts = registry.charts.map((item) => buildComponent(item, 'chart', inventory));
const mappedTableIds = new Set(registry.tables.flatMap((item) => item.domIds || []));
const mappedCanvasIds = new Set(registry.charts.flatMap((item) => item.canvasIds || []));
const knownCanvasReplicas = new Set(registry.knownReplicas.canvases || []);

const unmappedTables = inventory.tables.filter((item) => {
  if (knownTableReplica(item, registry)) return false;
  const ids = [item.id, ...(item.descendantIds || [])].filter(Boolean);
  return !ids.some((id) => mappedTableIds.has(id));
});

const unmappedCanvases = inventory.canvases.filter((item) => {
  if (knownCanvasReplicas.has(item.id) || isDynamicId(item.id)) return false;
  return !mappedCanvasIds.has(item.id);
});

const duplicateIds = sourceDuplicates(inventory, registry);
const report = {
  generatedAt: new Date().toISOString(),
  release: registry.release,
  summary: {
    primaryTables: tables.length,
    sharedTables: tables.filter((item) => item.shared).length,
    primaryCharts: charts.length,
    sharedCharts: charts.filter((item) => item.shared).length,
    unmappedRawTables: unmappedTables.length,
    unmappedRawCanvases: unmappedCanvases.length,
    sourceDuplicateIds: duplicateIds.length
  },
  tables,
  charts,
  unmappedTables,
  unmappedCanvases,
  sourceDuplicateIds: duplicateIds
};

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir, 'v6.544-component-migration-matrix.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(reportsDir, 'v6.544-component-migration-matrix.md'), `${markdown(report, registry)}\n`);
console.log(`Canonical scope: ${report.summary.primaryTables} tables and ${report.summary.primaryCharts} charts.`);
console.log(`Shared now: ${report.summary.sharedTables} tables and ${report.summary.sharedCharts} charts.`);
console.log(`Unmapped raw discoveries: ${report.summary.unmappedRawTables} tables and ${report.summary.unmappedRawCanvases} canvases.`);
console.log('Wrote reports/v6.544-component-migration-matrix.json and reports/v6.544-component-migration-matrix.md');
