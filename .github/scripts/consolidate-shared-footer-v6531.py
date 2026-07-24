from pathlib import Path
import re
import subprocess

EXPECTED_HEAD = 'aa01fb96bceef183293f7c019b6d598affd19d59'
INDEX_PATH = Path('Index.html')
FOOTER_PATH = Path('SharedFooter.html')
MARKER_START = '<!-- v6.530: unmistakable /dev-only build identity. Presentation only; no data, filter, chart, or cache behavior changes. -->'
STYLE_ID = 'cdaVisibleDevBuildMarkerStylesV6530'
SCRIPT_ID = 'cdaVisibleDevBuildMarkerScriptV6530'
SHARED_INCLUDE = "<?!= includeDashboardFile('SharedFooter') ?>"


def git_head() -> str:
    return subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()


def count_tags(text: str) -> dict[str, int]:
    return {
        'style_open': len(re.findall(r'<style\b', text, flags=re.I)),
        'style_close': len(re.findall(r'</style>', text, flags=re.I)),
        'script_open': len(re.findall(r'<script\b', text, flags=re.I)),
        'script_close': len(re.findall(r'</script>', text, flags=re.I)),
        'body_close': len(re.findall(r'</body>', text, flags=re.I)),
        'html_close': len(re.findall(r'</html>', text, flags=re.I)),
        'apps_script_code': text.count('<?'),
    }


def main() -> None:
    if git_head() != EXPECTED_HEAD:
        raise SystemExit(f'Unexpected branch head. Expected {EXPECTED_HEAD}, got {git_head()}. No files were changed.')
    if FOOTER_PATH.exists():
        raise SystemExit('SharedFooter.html already exists. No files were changed.')

    original = INDEX_PATH.read_text(encoding='utf-8')
    required_index_markers = [
        "includeDashboardFile('RemakeTailStyles')",
        'id="remakeCeramistStatusV6342"',
        'id="remakeLastRefresh"',
        'id="tatStampV6509"',
        STYLE_ID,
        SCRIPT_ID,
    ]
    missing = [marker for marker in required_index_markers if original.count(marker) != 1]
    if missing:
        raise SystemExit(f'Index baseline markers are missing or duplicated: {missing}. No files were changed.')
    if original.count(MARKER_START) != 1:
        raise SystemExit(f'Expected one temporary marker block, found {original.count(MARKER_START)}. No files were changed.')
    if SHARED_INCLUDE in original:
        raise SystemExit('Shared footer include already exists. No files were changed.')

    start = original.index(MARKER_START)
    suffix = original[start:]
    if not suffix.rstrip().endswith('</script>'):
        raise SystemExit('Temporary marker is not the final Index block. No files were changed.')
    if suffix.count('<style') != 1 or suffix.count('</style>') != 1:
        raise SystemExit('Unexpected temporary marker style structure. No files were changed.')
    if suffix.count('<script') != 1 or suffix.count('</script>') != 1:
        raise SystemExit('Unexpected temporary marker script structure. No files were changed.')

    replacement = '\n\n<!-- v6.531: shared application footer ownership for Remake and TAT. -->\n' + SHARED_INCLUDE + '\n'
    updated_index = original[:start].rstrip() + replacement

    before = count_tags(original)
    after = count_tags(updated_index)
    expected = dict(before)
    expected['style_open'] -= 1
    expected['style_close'] -= 1
    expected['script_open'] -= 1
    expected['script_close'] -= 1
    expected['apps_script_code'] += 1
    if after != expected:
        raise SystemExit(f'Index structural validation failed: expected {expected}, got {after}. No files were changed.')

    shared_footer = r'''<!-- SharedFooter.html v6.531
One shared body-level footer for Remake and TAT.
Owns visible cache/build identity only; source status elements retain their existing data behavior.
-->
<style id="cdaSharedFooterStylesV6531">
  #remakeCeramistStatusV6342,
  #remakeLastRefresh,
  #tatStampV6509,
  .remakePageFooterV6338 {
    display:none !important;
    visibility:hidden !important;
  }

  #cdaSharedAppFooterV6531 {
    width:100%;
    box-sizing:border-box;
    display:flex;
    justify-content:center;
    align-items:center;
    flex-wrap:wrap;
    gap:0;
    padding:13px 16px 16px;
    color:#667085;
    background:transparent;
    font:700 10.5px/1.35 Roboto,Arial,sans-serif;
    text-align:center;
  }

  #cdaSharedAppFooterV6531 [data-footer-item] {
    display:inline-flex;
    align-items:center;
    white-space:nowrap;
  }

  #cdaSharedAppFooterV6531 [data-footer-item] + [data-footer-item]::before {
    content:'•';
    display:inline-block;
    margin:0 9px;
    color:#c1c7d0;
  }

  #cdaSharedAppFooterV6531 .cdaSharedFooterIdentityV6531 {
    color:#475467;
    font-weight:800;
  }

  @media(max-width:760px) {
    #cdaSharedAppFooterV6531 {
      align-items:flex-start;
      flex-direction:column;
      gap:4px;
      padding:11px 14px 15px;
      text-align:left;
    }

    #cdaSharedAppFooterV6531 [data-footer-item] + [data-footer-item]::before {
      display:none;
    }
  }
</style>
<script id="cdaSharedFooterControllerV6531">
(function installCdaSharedFooterV6531(){
  'use strict';

  const UI_VERSION_V6531 = 'v6.531';
  const BUILD_LABEL_V6531 = 'SHARED-FOOTER-01';
  const BASE_COMMIT_V6531 = 'aa01fb9';
  const FOOTER_ID_V6531 = 'cdaSharedAppFooterV6531';
  const SOURCE_SELECTOR_V6531 = '#remakeCeramistStatusV6342,#remakeLastRefresh,#tatStampV6509';
  let renderFrameV6531 = 0;

  window.CDA_CURRENT_FRONTEND_VERSION = UI_VERSION_V6531;
  window.CDA_SHARED_FOOTER_VERSION = UI_VERSION_V6531;
  window.CDA_SHARED_FOOTER_BUILD = BUILD_LABEL_V6531;
  window.CDA_SHARED_FOOTER_BASE = BASE_COMMIT_V6531;

  function byIdV6531(id){
    return document.getElementById(id);
  }

  function cleanV6531(value){
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function stripPrefixV6531(value, patterns){
    let text = cleanV6531(value);
    patterns.forEach(function(pattern){ text = text.replace(pattern, ''); });
    return cleanV6531(text);
  }

  function simpleWorkerV6531(value){
    const raw = cleanV6531(value);
    if (!raw) return 'Not loaded';
    if (/loading|waiting|updating/i.test(raw)) return 'Loading';
    if (/failed|unavailable/i.test(raw)) return 'Unavailable';
    let text = stripPrefixV6531(raw, [
      /^Worker cache updated:\s*/i,
      /^Worker cache:\s*/i,
      /^Worker:\s*/i
    ]);
    text = text.replace(/\s*[·•]\s*(saved browser copy|nightly source|saved copy is current).*$/i, '');
    return cleanV6531(text) || 'Not loaded';
  }

  function simpleCacheV6531(value){
    const raw = cleanV6531(value);
    if (!raw) return 'Not loaded';
    if (/loading|waiting|updating/i.test(raw)) return 'Loading';
    if (/failed|unavailable/i.test(raw)) return 'Unavailable';
    let text = stripPrefixV6531(raw, [
      /^Browser cache current:\s*/i,
      /^Browser cache:\s*/i,
      /^Saved browser cache:\s*/i,
      /^Last refreshed:\s*/i,
      /^Using saved data:\s*/i,
      /^Cache:\s*/i
    ]);
    text = text.replace(/\s*[·•]\s*optimized cache rebuilding.*$/i, '');
    return cleanV6531(text) || 'Not loaded';
  }

  function routerLabelV6531(){
    const presentation = window.CDA_SERVER_PRESENTATION || {};
    const source = cleanV6531(presentation.source || '');
    const match = source.match(/Code\.gs\s+v[0-9.]+/i);
    return match ? match[0] : 'Router unknown';
  }

  function isTatActiveV6531(){
    const button = byIdV6531('tatTabBtnV6509');
    const page = byIdV6531('tatDashboardPageV6509');
    if (button && button.classList.contains('active')) return true;
    if (!page || !window.getComputedStyle) return false;
    const style = window.getComputedStyle(page);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function ensureFooterV6531(){
    let footer = byIdV6531(FOOTER_ID_V6531);
    if (!footer) {
      footer = document.createElement('footer');
      footer.id = FOOTER_ID_V6531;
      footer.setAttribute('aria-label', 'Dashboard status and build identity');
      footer.setAttribute('aria-live', 'polite');
    }
    if (footer.parentNode !== document.body || footer !== document.body.lastElementChild) {
      document.body.appendChild(footer);
    }
    return footer;
  }

  function appendItemV6531(footer, label, value, className){
    const item = document.createElement('span');
    item.setAttribute('data-footer-item', '');
    if (className) item.className = className;
    item.textContent = label + ': ' + value;
    footer.appendChild(item);
  }

  function renderV6531(){
    renderFrameV6531 = 0;
    if (!document.body) return;

    const footer = ensureFooterV6531();
    footer.replaceChildren();

    if (isTatActiveV6531()) {
      const tat = byIdV6531('tatStampV6509');
      appendItemV6531(footer, 'Cache', simpleCacheV6531(tat && tat.textContent));
    } else {
      const worker = byIdV6531('remakeCeramistStatusV6342');
      const cache = byIdV6531('remakeLastRefresh');
      appendItemV6531(footer, 'Worker', simpleWorkerV6531(worker && worker.textContent));
      appendItemV6531(footer, 'Cache', simpleCacheV6531(cache && cache.textContent));
    }

    appendItemV6531(footer, 'UI', UI_VERSION_V6531, 'cdaSharedFooterIdentityV6531');
    appendItemV6531(footer, 'Router', routerLabelV6531(), 'cdaSharedFooterIdentityV6531');
    appendItemV6531(footer, 'Build', BUILD_LABEL_V6531, 'cdaSharedFooterIdentityV6531');
    appendItemV6531(footer, 'Base', BASE_COMMIT_V6531, 'cdaSharedFooterIdentityV6531');
  }

  function scheduleRenderV6531(){
    if (renderFrameV6531) return;
    renderFrameV6531 = window.requestAnimationFrame(renderV6531);
  }

  function mutationTouchesSourcesV6531(mutation){
    const target = mutation.target && mutation.target.nodeType === 3
      ? mutation.target.parentElement
      : mutation.target;
    if (target && target.closest && target.closest(SOURCE_SELECTOR_V6531)) return true;

    return Array.from(mutation.addedNodes || []).some(function(node){
      if (!node || node.nodeType !== 1) return false;
      if (node.matches && node.matches(SOURCE_SELECTOR_V6531)) return true;
      return !!(node.querySelector && node.querySelector(SOURCE_SELECTOR_V6531));
    });
  }

  function startV6531(){
    renderV6531();

    if (window.MutationObserver) {
      const observer = new MutationObserver(function(mutations){
        if (mutations.some(mutationTouchesSourcesV6531)) scheduleRenderV6531();
      });
      observer.observe(document.body, {childList:true, subtree:true, characterData:true});
    }

    document.addEventListener('click', function(event){
      const target = event.target && event.target.closest
        ? event.target.closest('#remakeFactorTabBtn,#tatTabBtnV6509')
        : null;
      if (target) window.setTimeout(scheduleRenderV6531, 0);
    }, true);

    window.addEventListener('pageshow', scheduleRenderV6531);
    window.addEventListener('resize', scheduleRenderV6531, {passive:true});
  }

  window.renderCdaSharedFooterV6531 = renderV6531;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startV6531, {once:true});
  } else {
    startV6531();
  }
})();
</script>
'''

    required_footer_markers = [
        'id="cdaSharedFooterStylesV6531"',
        'id="cdaSharedFooterControllerV6531"',
        "const UI_VERSION_V6531 = 'v6.531';",
        "const BUILD_LABEL_V6531 = 'SHARED-FOOTER-01';",
        "const BASE_COMMIT_V6531 = 'aa01fb9';",
        "const FOOTER_ID_V6531 = 'cdaSharedAppFooterV6531';",
        'window.CDA_CURRENT_FRONTEND_VERSION = UI_VERSION_V6531;',
        '.remakePageFooterV6338',
        '#tatStampV6509',
    ]
    invalid = [marker for marker in required_footer_markers if shared_footer.count(marker) != 1]
    if invalid:
        raise SystemExit(f'Shared footer validation failed for markers: {invalid}. No files were changed.')
    if shared_footer.count('<style') != 1 or shared_footer.count('</style>') != 1:
        raise SystemExit('Shared footer style structure is invalid. No files were changed.')
    if shared_footer.count('<script') != 1 or shared_footer.count('</script>') != 1:
        raise SystemExit('Shared footer script structure is invalid. No files were changed.')

    INDEX_PATH.write_text(updated_index, encoding='utf-8', newline='\n')
    FOOTER_PATH.write_text(shared_footer, encoding='utf-8', newline='\n')
    print('Created SharedFooter.html v6.531 and replaced the temporary floating marker with one include.')


if __name__ == '__main__':
    main()
