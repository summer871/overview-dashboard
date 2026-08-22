'use strict';

const fs = require('fs');

function patchFile(file) {
  let text = fs.readFileSync(file, 'utf8');
  const replacements = [
    ["parentContent = parentContent.replace(directive, content);", "parentContent = parentContent.replace(directive, function() { return content; });"],
    ["const reconstructed = baseText.replace(parentDirective, parentContent);", "const reconstructed = baseText.replace(parentDirective, function() { return parentContent; });"],
    ["const reconstructed = main.replace(parentDirective, parentContent);", "const reconstructed = main.replace(parentDirective, function() { return parentContent; });"]
  ];
  let changed = false;
  replacements.forEach(function(pair) {
    if (text.includes(pair[0])) {
      text = text.split(pair[0]).join(pair[1]);
      changed = true;
    }
  });
  if (!changed) throw new Error('No literal-reassembly replacement targets found in ' + file);
  fs.writeFileSync(file, text, 'utf8');
}

patchFile('scripts/validate-dashboard-main-composition.js');
patchFile('.github/scripts/upgrade-dashboard-main-chain-validator.cjs');
console.log('DashboardMain literal source reassembly enabled in validators.');
