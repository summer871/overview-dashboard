'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const sourcePath = 'Index.html';
const expectedBlobSha = 'ed756e1cf1037f2c074dade1aa99b9c2db595b05';
const archiveDir = path.join('archive', 'overview-paused-2026-08-21');
const archivePath = path.join(archiveDir, 'Index.pre-smooth-polish-overview-removal.html');
const reportPath = path.join('docs', 'OVERVIEW-INDEX-SMOOTH-POLISH-CLEANUP-2026-08-21.json');
const styleOpen = '<style id="cdaSmoothAtomicPolishV6424">';
const scriptOpen = '<script>\n(function installSmoothAtomicPolishV6424(){';

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function countLiteral(text, token) {
  return text.split(token).length - 1;
}

function findExactBlock(source, openMarker, closeMarker, label) {
  const start = source.indexOf(openMarker);
  if (start < 0) fail(label + ': opening marker not found.');
  if (source.indexOf(openMarker, start + openMarker.length) >= 0) fail(label + ': opening marker appears more than once.');
  const endStart = source.indexOf(closeMarker, start + openMarker.length);
  if (endStart < 0) fail(label + ': closing marker not found.');
  const end = endStart + closeMarker.length;
  return { start, end, text: source.slice(start, end) };
}

function splitSelectorList(selector) {
  const parts = [];
  let current = '';
  let quote = '';
  let escaped = false;
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      current += ch;
      quote = ch;
      continue;
    }
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '[') bracketDepth += 1;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function findNextTopDelimiter(css, start) {
  let quote = '';
  let escaped = false;
  let inComment = false;
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let i = start; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1] || '';
    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '[') bracketDepth += 1;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (parenDepth === 0 && bracketDepth === 0 && (ch === '{' || ch === ';')) {
      return { index: i, delimiter: ch };
    }
  }
  if (quote || inComment || parenDepth || bracketDepth) fail('Unterminated CSS token while scanning smooth-polish style.');
  return null;
}

function findMatchingBrace(css, openIndex) {
  let depth = 1;
  let quote = '';
  let escaped = false;
  let inComment = false;
  for (let i = openIndex + 1; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1] || '';
    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  fail('Unmatched CSS opening brace in smooth-polish style.');
}

function leadingTrivia(rawHeader) {
  const match = rawHeader.match(/^((?:\s|\/\*[\s\S]*?\*\/)*)/);
  return match ? match[1] : '';
}

function stripLeadingTrivia(rawHeader) {
  return rawHeader.slice(leadingTrivia(rawHeader).length).trim();
}

function isNestedRuleAtRule(header) {
  return /^@(media|supports|container|layer|scope|document)\b/i.test(header);
}

function transformCss(css, stats) {
  let cursor = 0;
  let output = '';
  while (cursor < css.length) {
    const delimiter = findNextTopDelimiter(css, cursor);
    if (!delimiter) {
      output += css.slice(cursor);
      break;
    }
    if (delimiter.delimiter === ';') {
      output += css.slice(cursor, delimiter.index + 1);
      cursor = delimiter.index + 1;
      continue;
    }

    const openIndex = delimiter.index;
    const closeIndex = findMatchingBrace(css, openIndex);
    const rawHeader = css.slice(cursor, openIndex);
    const cleanHeader = stripLeadingTrivia(rawHeader);
    const body = css.slice(openIndex + 1, closeIndex);
    if (!cleanHeader) fail('Empty CSS rule header in smooth-polish style.');

    if (cleanHeader.startsWith('@')) {
      if (isNestedRuleAtRule(cleanHeader)) {
        const nested = transformCss(body, stats);
        output += rawHeader + '{' + nested + '}';
      } else {
        output += rawHeader + '{' + body + '}';
      }
      cursor = closeIndex + 1;
      continue;
    }

    const selectors = splitSelectorList(cleanHeader);
    if (!selectors.length) fail('Unable to parse smooth-polish selector list: ' + cleanHeader);
    const overviewSelectors = selectors.filter(function(selector) { return /#overviewOne\b/.test(selector); });
    const keepSelectors = selectors.filter(function(selector) { return !/#overviewOne\b/.test(selector); });
    stats.overviewSelectorBranchesRemoved += overviewSelectors.length;

    if (!keepSelectors.length) {
      stats.rulesRemoved += 1;
      output += leadingTrivia(rawHeader);
    } else if (overviewSelectors.length) {
      stats.mixedRulesNarrowed += 1;
      output += leadingTrivia(rawHeader) + keepSelectors.join(',\n  ') + ' {' + body + '}';
    } else {
      output += rawHeader + '{' + body + '}';
    }
    cursor = closeIndex + 1;
  }
  return output;
}

const actualBlobSha = execFileSync('git', ['hash-object', sourcePath], { encoding: 'utf8' }).trim();
if (actualBlobSha !== expectedBlobSha) {
  fail('Index.html Git blob guard failed. Expected ' + expectedBlobSha + ' but found ' + actualBlobSha + '. Re-audit before cleanup.');
}

const original = fs.readFileSync(sourcePath, 'utf8');
const overviewOneBefore = countLiteral(original, '#overviewOne');
const overviewTwoBefore = countLiteral(original, '#overviewTwo');
if (overviewOneBefore !== 26) fail('Expected 26 remaining #overviewOne references before cleanup, found ' + overviewOneBefore + '.');
if (overviewTwoBefore !== 3) fail('Expected 3 #overviewTwo references to remain untouched, found ' + overviewTwoBefore + '.');

const protectedBefore = {
  remakeFactorPage: countLiteral(original, '#remakeFactorPage'),
  remakeDropdownButton: countLiteral(original, '.remakeDropdownButtonV6245'),
  remakeDropdownPanel: countLiteral(original, '.remakeDropdownPanelV6245'),
  tatFilterHost: countLiteral(original, '#tatTabFilterHostV6509'),
  sharedFilterInclude: countLiteral(original, "includeDashboardFile('SharedFilterBar')"),
  remakeAdapterInclude: countLiteral(original, "includeDashboardFile('RemakeSharedFilterAdapterV6646')"),
  tatControllerInclude: countLiteral(original, "includeDashboardFile('TatDashboardControllerScript')"),
  tatAdapterInclude: countLiteral(original, "includeDashboardFile('TatSharedFilterAdapterV6646')")
};

const styleBlock = findExactBlock(original, styleOpen, '</style>', 'smooth-polish style');
const styleInnerStart = styleBlock.start + styleOpen.length;
const styleInnerEnd = styleBlock.end - '</style>'.length;
const styleInner = original.slice(styleInnerStart, styleInnerEnd);
if (countLiteral(styleInner, '#overviewOne') < 1) fail('Smooth-polish style contains no #overviewOne references; refusing unexpected cleanup.');
if (!styleInner.includes('#remakeFactorPage :is(button,.remakeButton,.remakeDropdownButtonV6245,.remakeTabToolButtonV6337)')) {
  fail('Expected live Remake transition selector is missing from smooth-polish style.');
}
if (!styleInner.includes('#remakeFactorPage .remakeDropdownPanelV6245')) {
  fail('Expected live Remake dropdown transform rule is missing from smooth-polish style.');
}

const styleStats = { overviewSelectorBranchesRemoved: 0, rulesRemoved: 0, mixedRulesNarrowed: 0 };
const nextStyleInner = transformCss(styleInner, styleStats);
if (countLiteral(nextStyleInner, '#overviewOne') !== 0) fail('Overview selector remains in transformed smooth-polish style.');
if (!nextStyleInner.includes('#remakeFactorPage :is(button,.remakeButton,.remakeDropdownButtonV6245,.remakeTabToolButtonV6337)')) {
  fail('Live Remake transition selector was lost during style cleanup.');
}
if (!nextStyleInner.includes('#remakeFactorPage .remakeDropdownPanelV6245')) {
  fail('Live Remake dropdown transform rule was lost during style cleanup.');
}
if (!nextStyleInner.includes('#remakeFactorPage *')) fail('Live Remake reduced-motion rule was lost during style cleanup.');

let next = original.slice(0, styleInnerStart) + nextStyleInner + original.slice(styleInnerEnd);
const scriptBlock = findExactBlock(next, scriptOpen, '</script>', 'smooth-polish script');
const originalScript = scriptBlock.text;
[
  'function animateOverviewUpdateV6424()',
  'function scheduleOverviewUpdateV6424()',
  'function installPillObserverV6424()',
  'const previousRenderAllV6424',
  'const previousHandleDataV6424',
  "target.closest('#overviewOne,#remakeFactorPage,#categoricalPage')",
  "document.querySelectorAll('#overviewOne canvas')"
].forEach(function(token) {
  if (!originalScript.includes(token)) fail('Expected Overview smooth-polish script token missing: ' + token);
});
[
  'function animateOpenPanelV6424(panel)',
  'function animateActivePageV6424()',
  ".dropdownButton,.remakeDropdownButtonV6245,.tabBtn"
].forEach(function(token) {
  if (!originalScript.includes(token)) fail('Expected live Remake/tab animation token missing: ' + token);
});

const nextScript = `<script>
(function installSmoothAtomicPolishV6424(){
  'use strict';
  if (window.__cdaSmoothAtomicPolishV6424) return;
  window.__cdaSmoothAtomicPolishV6424 = true;
  window.CDA_CURRENT_FRONTEND_VERSION = 'v6.424';
  window.CDA_SMOOTH_ATOMIC_VERSION = 'v6.424';
  window.CDA_FILTER_PILLS_BELOW_KPIS_VERSION = 'v6.424';

  const reducedMotionV6424 = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const runningAnimationsV6424 = new WeakMap();

  function cancelNodeAnimationV6424(node){
    const current = runningAnimationsV6424.get(node);
    if (!current) return;
    try { current.cancel(); } catch (error) {}
    runningAnimationsV6424.delete(node);
  }

  function animateNodeV6424(node, keyframes, options){
    if (reducedMotionV6424 || !node || typeof node.animate !== 'function') return;
    cancelNodeAnimationV6424(node);
    try {
      const animation = node.animate(keyframes, options);
      runningAnimationsV6424.set(node, animation);
      const clear = function(){
        if (runningAnimationsV6424.get(node) === animation) runningAnimationsV6424.delete(node);
      };
      animation.addEventListener('finish', clear, { once: true });
      animation.addEventListener('cancel', clear, { once: true });
    } catch (error) {}
  }

  function animateOpenPanelV6424(panel){
    if (!panel || !panel.classList || !panel.classList.contains('open')) return;
    animateNodeV6424(panel, [
      { opacity: 0, transform: 'translateY(-5px) scale(.995)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], {
      duration: 170,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'none'
    });
  }

  function animateActivePageV6424(){
    const page = document.querySelector('.tabPage.active, #remakeFactorPage.active');
    if (!page) return;
    animateNodeV6424(page, [
      { opacity: .88 },
      { opacity: 1 }
    ], {
      duration: 190,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'none'
    });
  }

  document.addEventListener('click', function(event){
    const target = event.target && event.target.closest ? event.target.closest('.dropdownButton,.remakeDropdownButtonV6245,.tabBtn') : null;
    if (!target) return;
    window.requestAnimationFrame(function(){
      if (target.classList.contains('tabBtn')) {
        animateActivePageV6424();
        return;
      }
      const panelId = target.getAttribute('onclick') || '';
      const match = panelId.match(/['\\\"]([^'\\\"]+Panel[^'\\\"]*)['\\\"]/i);
      if (match && match[1]) animateOpenPanelV6424(document.getElementById(match[1]));
      else {
        const card = target.closest('.dropdownCard,.remakeDropdownV6245');
        if (card) animateOpenPanelV6424(card.querySelector('.dropdownPanel.open,.remakeDropdownPanelV6245.open'));
      }
    });
  }, false);
})();
</script>`;

if (countLiteral(nextScript, '#overviewOne') !== 0) fail('Replacement smooth-polish script unexpectedly contains #overviewOne.');
[
  'function animateOpenPanelV6424(panel)',
  'function animateActivePageV6424()',
  ".dropdownButton,.remakeDropdownButtonV6245,.tabBtn",
  'window.CDA_SMOOTH_ATOMIC_VERSION'
].forEach(function(token) {
  if (!nextScript.includes(token)) fail('Replacement script lost required live token: ' + token);
});

next = next.slice(0, scriptBlock.start) + nextScript + next.slice(scriptBlock.end);
if (countLiteral(next, '#overviewOne') !== 0) fail('Index still contains #overviewOne after scoped smooth-polish cleanup.');
if (countLiteral(next, '#overviewTwo') !== overviewTwoBefore) fail('#overviewTwo count changed during #overviewOne-only cleanup.');

const protectedAfter = {
  remakeFactorPage: countLiteral(next, '#remakeFactorPage'),
  remakeDropdownButton: countLiteral(next, '.remakeDropdownButtonV6245'),
  remakeDropdownPanel: countLiteral(next, '.remakeDropdownPanelV6245'),
  tatFilterHost: countLiteral(next, '#tatTabFilterHostV6509'),
  sharedFilterInclude: countLiteral(next, "includeDashboardFile('SharedFilterBar')"),
  remakeAdapterInclude: countLiteral(next, "includeDashboardFile('RemakeSharedFilterAdapterV6646')"),
  tatControllerInclude: countLiteral(next, "includeDashboardFile('TatDashboardControllerScript')"),
  tatAdapterInclude: countLiteral(next, "includeDashboardFile('TatSharedFilterAdapterV6646')")
};

['remakeDropdownButton','remakeDropdownPanel','tatFilterHost','sharedFilterInclude','remakeAdapterInclude','tatControllerInclude','tatAdapterInclude'].forEach(function(key) {
  if (protectedBefore[key] !== protectedAfter[key]) {
    fail('Protected live token count changed for ' + key + ': ' + protectedBefore[key] + ' -> ' + protectedAfter[key]);
  }
});
if (protectedAfter.remakeFactorPage >= protectedBefore.remakeFactorPage || protectedBefore.remakeFactorPage - protectedAfter.remakeFactorPage !== 1) {
  fail('Expected exactly one dead #remakeFactorPage occurrence to disappear with the removed Overview-only activity detector; found ' + protectedBefore.remakeFactorPage + ' -> ' + protectedAfter.remakeFactorPage + '.');
}

const scriptOpensBefore = (original.match(/<script\b/gi) || []).length;
const scriptClosesBefore = (original.match(/<\/script>/gi) || []).length;
const scriptOpensAfter = (next.match(/<script\b/gi) || []).length;
const scriptClosesAfter = (next.match(/<\/script>/gi) || []).length;
if (scriptOpensBefore !== scriptOpensAfter || scriptClosesBefore !== scriptClosesAfter || scriptOpensAfter !== scriptClosesAfter) {
  fail('Index script tag boundaries changed unexpectedly.');
}
const styleOpensBefore = (original.match(/<style\b/gi) || []).length;
const styleClosesBefore = (original.match(/<\/style>/gi) || []).length;
const styleOpensAfter = (next.match(/<style\b/gi) || []).length;
const styleClosesAfter = (next.match(/<\/style>/gi) || []).length;
if (styleOpensBefore !== styleOpensAfter || styleClosesBefore !== styleClosesAfter || styleOpensAfter !== styleClosesAfter) {
  fail('Index style tag boundaries changed unexpectedly.');
}

fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(archivePath)) fail('Archive Index snapshot already exists; refusing overwrite.');
fs.writeFileSync(archivePath, original, 'utf8');
if (sha256(fs.readFileSync(archivePath, 'utf8')) !== sha256(original)) fail('Index archive byte-for-byte verification failed.');
fs.writeFileSync(sourcePath, next, 'utf8');

const report = {
  datePt: '2026-08-21',
  checkpoint: 'Remove paused Overview branches from mixed smooth atomic polish block',
  source: sourcePath,
  behaviorChangeIntended: false,
  sourceGitBlobShaBefore: actualBlobSha,
  sourceSha256Before: sha256(original),
  sourceSha256After: sha256(next),
  bytesBefore: Buffer.byteLength(original, 'utf8'),
  bytesAfter: Buffer.byteLength(next, 'utf8'),
  bytesRemoved: Buffer.byteLength(original, 'utf8') - Buffer.byteLength(next, 'utf8'),
  archivePath,
  archiveByteForByteVerified: true,
  overviewOneReferencesBefore: overviewOneBefore,
  overviewOneReferencesAfter: countLiteral(next, '#overviewOne'),
  overviewTwoReferencesBefore: overviewTwoBefore,
  overviewTwoReferencesAfter: countLiteral(next, '#overviewTwo'),
  styleOverviewSelectorBranchesRemoved: styleStats.overviewSelectorBranchesRemoved,
  styleRulesRemoved: styleStats.rulesRemoved,
  styleMixedRulesNarrowed: styleStats.mixedRulesNarrowed,
  removedOverviewScriptHooks: [
    'animateOverviewUpdateV6424',
    'scheduleOverviewUpdateV6424',
    'installPillObserverV6424',
    'renderAll v6.424 wrapper',
    'handleData v6.424 wrapper',
    'Overview activity detector/listeners'
  ],
  preservedLiveBehavior: [
    'Remake button/dropdown paint transitions',
    'Remake dropdown transform origin',
    'Remake reduced-motion handling',
    'Remake dropdown open animation',
    'active tab animation'
  ],
  protectedTokenCountsBefore: protectedBefore,
  protectedTokenCountsAfter: protectedAfter,
  scriptTagBoundaryCountsPreserved: true,
  styleTagBoundaryCountsPreserved: true,
  productionDeployment: false
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  bytesRemoved: report.bytesRemoved,
  overviewOneReferencesAfter: report.overviewOneReferencesAfter,
  overviewTwoReferencesAfter: report.overviewTwoReferencesAfter,
  styleOverviewSelectorBranchesRemoved: report.styleOverviewSelectorBranchesRemoved
}, null, 2));
