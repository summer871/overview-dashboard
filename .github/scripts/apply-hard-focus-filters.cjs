'use strict';

const fs = require('fs');

const dashboardPath = 'DashboardMainScript.html';
const topPath = 'SharedTopParityStyles.html';
const footerPath = 'SharedFooter.html';
const obsoletePath = 'SharedRemakeFilterSemanticsV6632.html';

let dashboard = fs.readFileSync(dashboardPath, 'utf8');
let top = fs.readFileSync(topPath, 'utf8');
let footer = fs.readFileSync(footerPath, 'utf8');

function countRegex(text, regex) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  return (text.match(new RegExp(regex.source, flags)) || []).length;
}

function replaceOne(text, regex, replacement, label) {
  const count = countRegex(text, regex);
  if (count !== 1) throw new Error(label + ': expected 1 match, found ' + count);
  return text.replace(regex, replacement);
}

function replaceCount(text, regex, replacement, expected, label) {
  const count = countRegex(text, regex);
  if (count !== expected) throw new Error(label + ': expected ' + expected + ' matches, found ' + count);
  return text.replace(regex, replacement);
}

// 1. Add ephemeral soft cross-filter state beside the existing hard dropdown state.
dashboard = replaceOne(
  dashboard,
  /(filterExclusionsV6389:\s*Object\.assign\(\{ year: \[\], department: \[\], product: \[\], productGroup: \[\], customer: \[\], reason: \[\] \}, readLocalJsonV6230\(FILTER_EXCLUSIONS_KEY_V6389, \{\}\)\),)/,
  "$1\n    crossFiltersV6634: { department: [], product: [], productGroup: [], customer: [], reason: [] },",
  'add cross-filter state'
);

// 2. Include soft cross-filters in undo snapshots, but not LocalStorage persistence.
dashboard = replaceOne(
  dashboard,
  /(filters: uiV6230\.filters \|\| \{\},\n)/,
  "$1      crossFiltersV6634: uiV6230.crossFiltersV6634 || {},\n",
  'snapshot cross-filters'
);

dashboard = replaceOne(
  dashboard,
  /(\['year','department','product','productGroup','customer','reason'\]\.forEach\(kind => \{\n\s*const raw = uiV6230\.filters\[kind\];\n\s*uiV6230\.filters\[kind\] = Array\.isArray\(raw\) \? raw\.map\(String\) : \(raw \? \[String\(raw\)\] : \[\]\);\n\s*\}\);\n)(\s*uiV6230\.selectedMonths = new Set\()/,
  "$1      uiV6230.crossFiltersV6634 = Object.assign({ department: [], product: [], productGroup: [], customer: [], reason: [] }, snapshot.crossFiltersV6634 || {});\n      ['department','product','productGroup','customer','reason'].forEach(function(kind){\n        const raw = uiV6230.crossFiltersV6634[kind];\n        uiV6230.crossFiltersV6634[kind] = Array.isArray(raw) ? raw.map(String).filter(Boolean) : (raw ? [String(raw)] : []);\n      });\n$2",
  'restore cross-filters'
);

// 3. Add one canonical helper set for soft click cross-filters.
dashboard = replaceOne(
  dashboard,
  /(function filterIsNoneV6308\(kind\) \{ const values = filterValuesV6245\(kind\); return values\.length === 1 && values\[0\] === REMAKE_NONE_FILTER_VALUE_V6308; \}\n)/,
  "$1  function crossFilterValuesV6634(kind) { const raw = uiV6230.crossFiltersV6634 ? uiV6230.crossFiltersV6634[kind] : []; if (Array.isArray(raw)) return raw.map(String).filter(Boolean); if (!raw) return []; return [String(raw)]; }\n  function setCrossFilterValuesV6634(kind, values) { if (!uiV6230.crossFiltersV6634) uiV6230.crossFiltersV6634 = { department: [], product: [], productGroup: [], customer: [], reason: [] }; const seen = new Set(); const clean = []; (Array.isArray(values) ? values : [values]).forEach(function(value){ const text = String(value == null ? '' : value).trim(); if (text && !seen.has(text)) { seen.add(text); clean.push(text); } }); uiV6230.crossFiltersV6634[kind] = clean; return clean; }\n  function clearAllCrossFiltersV6634() { uiV6230.crossFiltersV6634 = { department: [], product: [], productGroup: [], customer: [], reason: [] }; }\n  window.CDA_REMAKE_HARD_FOCUS_VERSION = 'v6.634';\n",
  'add cross-filter helpers'
);

// 4. Replace the row predicate so hard dropdowns always apply, while a source
//    table can ignore only its own soft cross-filter by passing kind:false.
const rowsFunction = `  function rowsForFiltersV6230(rows, options) {
    const includeMonths = !options || options.months !== false;
    const includeYear = !(options && options.year === false);
    const includeHardDepartment = !(options && options.hardDepartment === false);
    const includeHardProduct = !(options && options.hardProduct === false);
    const includeHardProductGroup = !(options && options.hardProductGroup === false);
    const includeHardCustomer = !(options && options.hardCustomer === false);
    const includeHardReason = !(options && options.hardReason === false);
    const includeCrossFilters = !(options && options.crossFilters === false);
    const includeCrossDepartment = includeCrossFilters && !(options && options.department === false);
    const includeCrossProduct = includeCrossFilters && !(options && options.product === false);
    const includeCrossProductGroup = includeCrossFilters && !(options && options.productGroup === false);
    const includeCrossCustomer = includeCrossFilters && !(options && options.customer === false);
    const includeCrossReason = includeCrossFilters && !(options && options.reason === false);
    const selectedMonths = uiV6230.selectedMonths || new Set();

    const compiledHardV6634 = {};
    ['year','department','product','productGroup','customer','reason'].forEach(function(kind) {
      const values = filterValuesV6245(kind).map(String);
      const excluded = excludedFilterValuesV6389(kind).map(String);
      compiledHardV6634[kind] = {
        none: values.length === 1 && values[0] === REMAKE_NONE_FILTER_VALUE_V6308,
        values: values.length ? new Set(values) : null,
        excluded: excluded.length ? new Set(excluded) : null
      };
    });
    function matchesHardV6634(kind, value) {
      const filter = compiledHardV6634[kind];
      if (!filter || filter.none) return false;
      const text = String(value);
      if (filter.values) return filter.values.has(text);
      return !filter.excluded || !filter.excluded.has(text);
    }

    const compiledCrossV6634 = {};
    ['department','product','productGroup','customer','reason'].forEach(function(kind) {
      const values = crossFilterValuesV6634(kind);
      compiledCrossV6634[kind] = values.length ? new Set(values.map(String)) : null;
    });
    function matchesCrossV6634(kind, value) {
      const selected = compiledCrossV6634[kind];
      return !selected || selected.has(String(value));
    }

    return (rows || []).filter(row =>
      (!includeYear || matchesHardV6634('year', row.year)) &&
      (!includeHardDepartment || matchesHardV6634('department', row.department)) &&
      (!includeHardProduct || matchesHardV6634('product', row.productKey)) &&
      (!includeHardProductGroup || matchesHardV6634('productGroup', row.productGroup || 'Unassigned')) &&
      (!includeHardCustomer || matchesHardV6634('customer', row.customerKey)) &&
      (!includeHardReason || matchesHardV6634('reason', row.remakeReason)) &&
      (!includeCrossDepartment || matchesCrossV6634('department', row.department)) &&
      (!includeCrossProduct || matchesCrossV6634('product', row.productKey)) &&
      (!includeCrossProductGroup || matchesCrossV6634('productGroup', row.productGroup || 'Unassigned')) &&
      (!includeCrossCustomer || matchesCrossV6634('customer', row.customerKey)) &&
      (!includeCrossReason || matchesCrossV6634('reason', row.remakeReason)) &&
      (!includeMonths || !selectedMonths.size || selectedMonths.has(row.month))
    );
  }

  /* v6.252 denominator logic:`;

dashboard = replaceOne(
  dashboard,
  /  function rowsForFiltersV6230\(rows, options\) \{[\s\S]*?\n  \}\n\n  \/\* v6\.252 denominator logic:/,
  rowsFunction,
  'replace row filter pipeline'
);

// Reason filters remain remake-only for KPI denominators, whether hard or soft.
dashboard = replaceOne(
  dashboard,
  /function rowsForBaseFiltersV6252\(rows, options\) \{\n\s*return rowsForFiltersV6230\(rows, Object\.assign\(\{\}, options \|\| \{\}, \{ reason: false \}\)\);\n\s*\}/,
  "function rowsForBaseFiltersV6252(rows, options) {\n    return rowsForFiltersV6230(rows, Object.assign({}, options || {}, { reason: false, hardReason: false }));\n  }",
  'preserve remake-only reason denominator'
);

// 5. Table and chart category clicks now update only the soft state.
const tableClickFunction = `  window.applyRemakeTableFilterV6230 = function applyRemakeTableFilterV6230(kind, value, event) {
    if (!kind) return;
    showRemakeClickFeedbackV6301(event);
    pushRemakeUndoV6266();

    const val = String(value);
    const current = new Set(crossFilterValuesV6634(kind));

    if (additiveV6230(event)) {
      if (current.has(val)) current.delete(val);
      else current.add(val);
      setCrossFilterValuesV6634(kind, Array.from(current));
    } else {
      if (current.size === 1 && current.has(val)) setCrossFilterValuesV6634(kind, []);
      else setCrossFilterValuesV6634(kind, [val]);
    }

    renderDashboardV6230();
  };`;

dashboard = replaceOne(
  dashboard,
  /  window\.applyRemakeTableFilterV6230 = function applyRemakeTableFilterV6230\(kind, value, event\) \{[\s\S]*?\n  \};/,
  tableClickFunction,
  'replace table click handler'
);

// 6. Selection highlighting is soft-state-only. Hard focus naturally removes
//    unavailable rows rather than dimming them.
dashboard = replaceCount(
  dashboard,
  /const activeValues = filterKind \? new Set\(filterValuesV6245\(filterKind\)\.map\(String\)\) : new Set\(\);/g,
  "const activeValues = filterKind ? new Set(crossFilterValuesV6634(filterKind).map(String)) : new Set();",
  2,
  'table active values'
);

dashboard = replaceOne(
  dashboard,
  /const selectedCustomers = new Set\(filterValuesV6245\('customer'\)\.map\(String\)\);/,
  "const selectedCustomers = new Set(crossFilterValuesV6634('customer').map(String));",
  'customer active values'
);

// Reset All clears both layers. Individual hard-filter chips clear only focus.
dashboard = replaceOne(
  dashboard,
  /(if \(kind === 'all'\) \{\n\s*uiV6230\.filters = \{ year: \[\], department: \[\], product: \[\], productGroup: \[\], customer: \[\], reason: \[\] \};\n\s*uiV6230\.filterExclusionsV6389 = \{ year: \[\], department: \[\], product: \[\], productGroup: \[\], customer: \[\], reason: \[\] \};\n)/,
  "$1      clearAllCrossFiltersV6634();\n",
  'reset all cross-filters'
);

// Expose a small runtime audit for /dev acceptance.
dashboard = replaceOne(
  dashboard,
  /(window\.CDA_REMAKE_HARD_FOCUS_VERSION = 'v6\.634';\n)/,
  "$1  window.cdaRemakeHardFocusV6634 = Object.freeze({ version:'v6.634', audit:function(){ return { version:'v6.634', hardDepartment:filterValuesV6245('department'), softDepartment:crossFilterValuesV6634('department'), hardProduct:filterValuesV6245('product'), softProduct:crossFilterValuesV6634('product'), ok:true }; } });\n",
  'add hard-focus audit'
);

// 7. Cascading dropdown inventories use hard filters only and ignore their own
//    hard dimension. Temporary soft clicks never change dropdown availability.
top = replaceOne(
  top,
  /function rowsForFacetV6631\(rows,kind\)\{\n\s*const options=\{months:false\};\n\s*options\[kind\]=false;\n\s*return rowsForFiltersV6230\(rows,options\);\n\s*\}/,
  "function rowsForFacetV6631(rows,kind){\n      const hardKey='hard'+kind.charAt(0).toUpperCase()+kind.slice(1);\n      const options={months:false,crossFilters:false};\n      options[hardKey]=false;\n      return rowsForFiltersV6230(rows,options);\n    }",
  'cascading hard-only inventory'
);

top = top.replace(/row\.productGroup\|\|row\.department\|\|'Unassigned'/g, "row.productGroup||'Unassigned'");
top = top.replace(/v6\.631/g, 'v6.634');

// 8. Visible release identity must match the tested branch release.
if (!footer.includes("const UI_VERSION = 'v6.633';")) throw new Error('footer is not at expected v6.633 baseline');
footer = footer.replace(/v6\.633/g, 'v6.634');
footer = footer.replace(/REMAKE-FILTER-SEMANTICS-72/g, 'REMAKE-HARD-FOCUS-73');

// 9. Remove the disconnected overlay; the behavior now lives in the owner.
if (fs.existsSync(obsoletePath)) fs.unlinkSync(obsoletePath);

// Validation guards.
if (!dashboard.includes('crossFiltersV6634')) throw new Error('cross-filter state marker missing');
if (!dashboard.includes("includeHardDepartment")) throw new Error('hard department predicate missing');
if (!dashboard.includes("const activeValues = filterKind ? new Set(crossFilterValuesV6634")) throw new Error('soft highlight marker missing');
if (!dashboard.includes("setCrossFilterValuesV6634(kind, [val])")) throw new Error('soft click handler missing');
if (!top.includes("crossFilters:false")) throw new Error('dropdown inventory still sees soft filters');
if (!top.includes("options[hardKey]=false")) throw new Error('dropdown inventory does not ignore its own hard dimension');
if (!footer.includes("const UI_VERSION = 'v6.634';")) throw new Error('footer UI version missing');
if (!footer.includes("const BUILD_LABEL = 'REMAKE-HARD-FOCUS-73';")) throw new Error('footer build marker missing');

fs.writeFileSync(dashboardPath, dashboard, 'utf8');
fs.writeFileSync(topPath, top, 'utf8');
fs.writeFileSync(footerPath, footer, 'utf8');

console.log(JSON.stringify({
  ok: true,
  version: 'v6.634',
  build: 'REMAKE-HARD-FOCUS-73',
  files: [dashboardPath, topPath, footerPath],
  removed: obsoletePath
}, null, 2));
