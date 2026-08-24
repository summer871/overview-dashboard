'use strict';

const fs = require('fs');
const crypto = require('crypto');

const indexPath = 'Index.html';
const adapterPath = 'RemakeSharedFilterAdapterV6646.html';
const reportPath = 'docs/REMAKE-SHARED-FILTER-ACTIVATION-v6.646.json';
const expectedIndexSha256 = 'ea9d79d1622d5387af8ad89747e47967d9a73418e62b315790758e113c858780';
const adapterInclude = "<?!= includeDashboardFile('RemakeSharedFilterAdapterV6646') ?>";

function fail(message){ throw new Error(message); }
function sha256(value){ return crypto.createHash('sha256').update(value,'utf8').digest('hex'); }
function count(value,needle){ return value.split(needle).length-1; }

const original = fs.readFileSync(indexPath,'utf8');
if (sha256(original) !== expectedIndexSha256) fail(`Unexpected ${indexPath} baseline. Refusing activation.`);
if (!fs.existsSync(adapterPath)) fail(`Missing ${adapterPath}.`);
if (original.includes(adapterInclude)) fail('Remake shared filter adapter is already included.');

const marker = "includeDashboardFile('DashboardMainScript'";
if (count(original, marker) !== 1) fail('Expected exactly one DashboardMainScript include marker.');
const markerIndex = original.indexOf(marker);
const tagStart = original.lastIndexOf('<?', markerIndex);
const tagEnd = original.indexOf('?>', markerIndex);
if (tagStart < 0 || tagEnd < 0) fail('Could not isolate DashboardMainScript template include.');
const insertion = tagEnd + 2;
const next = original.slice(0,insertion) + '\n' + adapterInclude + original.slice(insertion);
if (count(next, adapterInclude) !== 1) fail('Adapter include insertion failed.');
if (next.indexOf(adapterInclude) <= next.indexOf(marker)) fail('Adapter must load after DashboardMainScript.');

fs.writeFileSync(indexPath,next,'utf8');
const report={
  generatedAt:new Date().toISOString(),
  version:'v6.646',
  source:indexPath,
  sourceSha256Before:expectedIndexSha256,
  sourceSha256After:sha256(next),
  adapter:adapterPath,
  adapterSha256:sha256(fs.readFileSync(adapterPath,'utf8')),
  adapterLoadsAfterDashboardMain:true,
  legacyFilterDeleted:false,
  compactLegacyControlsRetained:true,
  desktopLegacyFilterHiddenOnlyAfterSharedMount:true,
  behaviorIntent:'Preserve existing Remake filter state/business logic while moving desktop dropdown/header presentation and interaction ownership to SharedFilterBar.',
  productionDeployment:false
};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
