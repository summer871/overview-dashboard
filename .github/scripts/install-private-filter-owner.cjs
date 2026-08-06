'use strict';

const fs = require('fs');

const dashboardPath = 'DashboardMainScript.html';
const foundationPath = 'SharedComponentFoundation.html';
const topPath = 'SharedTopParityStyles.html';
const footerPath = 'SharedFooter.html';
const deadOwnerPath = 'SharedRemakeFilterLifecycleV6636.html';
const privateOwnerPath = 'RemakePrivateFilterLifecycleV6637.html';

let dashboard = fs.readFileSync(dashboardPath, 'utf8');
let foundation = fs.readFileSync(foundationPath, 'utf8');
let top = fs.readFileSync(topPath, 'utf8');
let footer = fs.readFileSync(footerPath, 'utf8');

const includeLine = "<?!= includeDashboardFile('RemakePrivateFilterLifecycleV6637') ?>";
const closeIndex = dashboard.toLowerCase().lastIndexOf('</script>');
if (closeIndex < 0) throw new Error('DashboardMainScript final </script> was not found.');
if (!dashboard.includes('function rowsForFiltersV6230')) throw new Error('Dashboard private filter scope marker was not found.');
if (!dashboard.includes('function populateFiltersV6230')) throw new Error('Dashboard populateFilters owner was not found.');
if (!dashboard.includes('window.renderRemakeDropdownListV6245')) throw new Error('Dashboard dropdown list owner was not found.');

if (!dashboard.includes(includeLine)) {
  dashboard = dashboard.slice(0, closeIndex) + '\n  ' + includeLine + '\n' + dashboard.slice(closeIndex);
}
if (dashboard.indexOf(includeLine) !== dashboard.lastIndexOf(includeLine)) {
  throw new Error('Private owner include appears more than once in DashboardMainScript.');
}

foundation = foundation
  .replace(/\n?<!-- v6\.636: final Remake filter owner[^\n]*-->\n?/g, '\n')
  .replace(/\n?<\?!= includeDashboardFile\('SharedRemakeFilterLifecycleV6636'\) \?>\n?/g, '\n')
  .replace(/Version: v6\.636/g, 'Version: v6.637');

const controllerStart = top.indexOf('<script id="cdaRemakeCascadingFiltersControllerV6635">');
if (controllerStart >= 0) {
  const controllerEnd = top.indexOf('</script>', controllerStart);
  if (controllerEnd < 0) throw new Error('SharedTopParity cascading controller closing tag was not found.');
  top = top.slice(0, controllerStart) + top.slice(controllerEnd + '</script>'.length);
}
top = top.replace(/Version: v6\.635/g, 'Version: v6.637');

footer = footer
  .replace(/Version: v6\.635/g, 'Version: v6.637')
  .replace(/Version: v6\.636/g, 'Version: v6.637')
  .replace(/'v6\.635'/g, "'v6.637'")
  .replace(/'v6\.636'/g, "'v6.637'")
  .replace(/REMAKE-CASCADING-SYNC-74/g, 'REMAKE-PRIVATE-FILTER-OWNER-76')
  .replace(/REMAKE-FINAL-FILTER-OWNER-75/g, 'REMAKE-PRIVATE-FILTER-OWNER-76');

if (!dashboard.includes(includeLine)) throw new Error('Private owner include was not installed.');
if (foundation.includes('SharedRemakeFilterLifecycleV6636')) throw new Error('Dead external lifecycle include remains.');
if (top.includes('cdaRemakeCascadingFiltersControllerV6635')) throw new Error('Dead early cascading controller remains.');
if (!footer.includes("const UI_VERSION = 'v6.637';")) throw new Error('Footer UI version was not updated to v6.637.');
if (!footer.includes("const BUILD_LABEL = 'REMAKE-PRIVATE-FILTER-OWNER-76';")) throw new Error('Footer build label was not updated.');

fs.writeFileSync(dashboardPath, dashboard, 'utf8');
fs.writeFileSync(foundationPath, foundation, 'utf8');
fs.writeFileSync(topPath, top, 'utf8');
fs.writeFileSync(footerPath, footer, 'utf8');

if (fs.existsSync(deadOwnerPath)) fs.unlinkSync(deadOwnerPath);

console.log(JSON.stringify({
  ok: true,
  version: 'v6.637',
  build: 'REMAKE-PRIVATE-FILTER-OWNER-76',
  includeInstalled: includeLine,
  removedExternalOwner: deadOwnerPath,
  privateOwner: privateOwnerPath
}, null, 2));
