#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'SharedDashboardColumnWidthsV6581.html');
const text = fs.readFileSync(file, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const script = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
assert(script, 'Column-width script block is missing.');
new vm.Script(script[1], {filename:'SharedDashboardColumnWidthsV6581.html'});

assert(text.includes("const VERSION_V6581 = 'v6.584';"), 'Data-grid service is not v6.584.');
assert(text.includes("mode: 'opt-in-standard-data-grid-column-widths'"), 'Standard data-grid mode is missing.');
assert(text.includes('.cdaDashboardDataGridHostV6584'), 'Dedicated data-grid host is missing.');
assert(text.includes("host.style.setProperty('overflow', 'hidden', 'important')"), 'Legacy outer scroll owner is not disabled.');
assert(text.includes('.cdaDashboardTableViewportV6581'), 'Dedicated grid viewport is missing.');
assert(/overflow:\s*auto\s*!important/.test(text), 'The grid viewport does not own both scroll axes.');
assert(text.includes('max-height: inherit'), 'The grid viewport does not inherit the table height constraint.');
assert(text.includes('position: sticky !important'), 'Sticky table headers are missing.');
assert(text.includes('top: 0 !important'), 'Sticky headers are not pinned to the grid top.');
assert(!text.includes('cdaColumnWidthBottomRailV6583'), 'The rejected duplicate bottom rail remains.');
assert(!text.includes('scrollbar-width: none'), 'The native horizontal scrollbar is still hidden.');
assert(text.includes('measureTextV6584'), 'Readable text measurement is missing.');
assert(text.includes('renderedContentFloorV6584'), 'Header/value-aware width defaults are missing.');
assert(text.includes('Math.floor(direct - 1)'), 'The no-overflow border allowance is missing.');
assert(text.includes("table.style.setProperty('max-width', pixels, 'important')"), 'Exact summed table width is not enforced.');
assert(text.includes('freshBindingV6583'), 'Refresh-safe resize bindings are missing.');
assert(text.includes('saveWidthMapV6581'), 'Complete width persistence is missing.');
assert(text.includes('auditV6584'), 'Runtime grid audit is missing.');
assert(text.includes('reset: resetV6581'), 'Reset-to-default API is missing.');

const flush = text.match(/function flushDragFrameV6581\(drag\)\{([\s\S]*?)\n  \}/);
assert(flush, 'Drag frame function is missing.');
assert(flush[1].includes('setColWidthV6581(drag.col, width)'), 'Drag does not update only the active col element.');
assert(flush[1].includes('drag.startTableWidth + delta'), 'Table width is not changed by the exact selected-column delta.');
assert(!flush[1].includes('applyWidthMapV6581'), 'Drag rewrites all column widths.');
assert(!flush[1].includes('forEach'), 'Drag loops over neighboring columns.');

const move = text.match(/drag\.move = function\(moveEvent\)\{([\s\S]*?)\n    \};/);
assert(move, 'Pointer move handler is missing.');
assert(!move[1].includes('getBoundingClientRect'), 'Pointer movement performs layout measurement.');
assert(move[1].includes('scheduleDragFrameV6581'), 'Pointer movement is not animation-frame batched.');

console.log('Shared data-grid static contracts passed.');
console.log('One native two-axis scroll owner: passed');
console.log('Sticky header contract: passed');
console.log('Native bottom horizontal scrollbar remains visible: passed');
console.log('Independent selected-column resizing: passed');
console.log('No neighbor/final-column compensation: passed');
console.log('Refresh-safe persistence and readable reset defaults: passed');
