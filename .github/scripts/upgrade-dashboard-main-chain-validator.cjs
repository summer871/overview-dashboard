'use strict';

const fs = require('fs');

function expandFunctionSource() {
  return `function expandSemanticReport(baseText, report, label) {
  const archive = read(report.archivePath);
  const parent = report.parentModule || null;
  if (!parent || !parent.name || !parent.path) throw new Error(label + ' report is missing parentModule metadata.');
  let parentContent = read(parent.path);
  assert(Buffer.byteLength(parentContent, 'utf8') <= Number(report.maxModuleBytes || 75000), parent.name + ': exceeds semantic-module byte limit.');
  assert(sha256(parentContent) === parent.sha256, parent.name + ': SHA-256 no longer matches ' + label + ' report.');
  const modules = Array.isArray(report.modules) ? report.modules : [];
  assert(modules.length > 0, label + ' report has no child modules.');
  modules.forEach(module => {
    const content = read(module.path);
    const directive = \`<?!= includeDashboardFile('\${module.name}') ?>\`;
    const occurrences = parentContent.split(directive).length - 1;
    assert(occurrences === 1, module.name + ': expected exactly one parent include directive, found ' + occurrences + '.');
    assert(Buffer.byteLength(content, 'utf8') <= Number(report.maxModuleBytes || 75000), module.name + ': exceeds semantic-module byte limit.');
    assert(sha256(content) === module.sha256, module.name + ': SHA-256 no longer matches ' + label + ' report.');
    if (module.rawJavaScriptFragment === true) {
      try { new vm.Script(content, { filename: module.path }); }
      catch (error) { failures.push(module.name + ': raw JavaScript fragment no longer parses: ' + error.message); }
    }
    parentContent = parentContent.replace(directive, content);
  });
  const parentDirective = \`<?!= includeDashboardFile('\${parent.name}') ?>\`;
  const parentOccurrences = baseText.split(parentDirective).length - 1;
  assert(parentOccurrences === 1, parent.name + ': expected exactly one parent include directive, found ' + parentOccurrences + '.');
  const reconstructed = baseText.replace(parentDirective, parentContent);
  assert(reconstructed === archive, label + ' composition is not byte-for-byte identical to its archived outgoing runtime.');
  assert(sha256(reconstructed) === report.sourceSha256Before, label + ' composed SHA-256 does not match pre-extraction runtime.');
  assert(Buffer.byteLength(reconstructed, 'utf8') === report.sourceBytesBefore, label + ' composed byte count does not match pre-extraction runtime.');
  assert(sha256(baseText) === report.sourceSha256After, label + ' composition source changed since extraction report.');
  notes.push(label + ' composition verified: parent ' + parent.name + ' + ' + modules.length + ' modules.');
  return reconstructed;
}

function composedDashboardMainVerification() {
  const main = read('DashboardMainScript.html');
  let reconstructed = main;
  let composed = false;
  let report = null;

  const legacyText = readOptional('docs/DASHBOARD-MAIN-LEGACY-SEMANTIC-EXTRACTION-2026-08-21.json');
  if (legacyText) {
    try {
      const legacyReport = JSON.parse(legacyText);
      reconstructed = expandSemanticReport(reconstructed, legacyReport, 'DashboardMain legacy');
      composed = true;
      report = legacyReport;
    } catch (error) {
      failures.push('DashboardMain legacy extraction report could not be validated: ' + error.message);
    }
  }

  const remakeText = readOptional('docs/DASHBOARD-MAIN-REMAKE-SEMANTIC-EXTRACTION-2026-08-21.json');
  if (remakeText) {
    try {
      const remakeReport = JSON.parse(remakeText);
      reconstructed = expandSemanticReport(reconstructed, remakeReport, 'DashboardMain Remake');
      composed = true;
      report = remakeReport;
    } catch (error) {
      failures.push('DashboardMain Remake extraction report could not be validated: ' + error.message);
    }
  }

  return { text: reconstructed, currentText: main, composed, report };
}`;
}

const file = 'scripts/validate-cleanup-checkpoint.js';
let text = fs.readFileSync(file, 'utf8');
const start = text.indexOf('function composedDashboardMainVerification() {');
const end = text.indexOf('\n\nconst requiredRuntimeFiles', start);
if (start < 0 || end < 0) throw new Error('Could not locate DashboardMain verification function in cleanup validator.');
text = text.slice(0, start) + expandFunctionSource() + text.slice(end);
fs.writeFileSync(file, text, 'utf8');
console.log('Cleanup validator upgraded for chained DashboardMain composition.');
