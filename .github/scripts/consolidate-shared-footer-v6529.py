from __future__ import annotations

import re
from pathlib import Path

INDEX_PATH = Path('Index.html')
VERSION = 'v6.529'
STYLE_ID = 'cdaSharedAppFooterStylesV6529'
SCRIPT_ID = 'cdaSharedAppFooterControllerV6529'

STYLE_BLOCK = r'''
<style id="cdaSharedAppFooterStylesV6529">
  #remakeCeramistStatusV6342,
  #remakeLastRefresh,
  #tatStampV6509 {
    display:none !important;
    visibility:hidden !important;
  }
  #cdaSharedAppFooterV6529 {
    width:100%;
    box-sizing:border-box;
    display:flex;
    justify-content:center;
    align-items:center;
    flex-wrap:wrap;
    gap:0;
    padding:14px 16px 18px;
    color:#667085;
    font:700 11px/1.35 Roboto,Arial,sans-serif;
    text-align:center;
  }
  #cdaSharedAppFooterV6529 [data-footer-item] {
    display:inline-flex;
    align-items:center;
    white-space:nowrap;
  }
  #cdaSharedAppFooterV6529 [data-footer-item] + [data-footer-item]::before {
    content:'•';
    display:inline-block;
    margin:0 10px;
    color:#c1c7d0;
  }
  #cdaSharedAppFooterV6529 .cdaSharedFooterVersionV6529 {
    color:#475467;
  }
  @media(max-width:700px) {
    #cdaSharedAppFooterV6529 {
      align-items:flex-start;
      flex-direction:column;
      gap:4px;
      padding-left:14px;
      text-align:left;
    }
    #cdaSharedAppFooterV6529 [data-footer-item] + [data-footer-item]::before {
      display:none;
    }
  }
</style>
'''.strip()

SCRIPT_BLOCK = r'''
<script id="cdaSharedAppFooterControllerV6529">
(function installCdaSharedAppFooterV6529(){
  'use strict';
  const APP_VERSION_V6529 = 'v6.529';
  const FOOTER_ID_V6529 = 'cdaSharedAppFooterV6529';
  let renderQueuedV6529 = false;

  window.CDA_APP_SHELL_VERSION = APP_VERSION_V6529;

  function byIdV6529(id){ return document.getElementById(id); }
  function cleanV6529(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function stripPrefixV6529(value, patterns){
    let text = cleanV6529(value);
    patterns.forEach(function(pattern){ text = text.replace(pattern, ''); });
    return cleanV6529(text);
  }
  function simpleWorkerV6529(value){
    const raw = cleanV6529(value);
    if (!raw) return 'Not loaded';
    if (/loading|waiting|updating/i.test(raw)) return 'Loading';
    if (/failed|unavailable/i.test(raw)) return 'Unavailable';
    let text = stripPrefixV6529(raw, [
      /^Worker cache updated:\s*/i,
      /^Worker cache:\s*/i,
      /^Worker:\s*/i
    ]);
    text = text.replace(/\s*[·•]\s*(saved browser copy|nightly source|saved copy is current).*$/i, '');
    return cleanV6529(text) || 'Not loaded';
  }
  function simpleCacheV6529(value){
    const raw = cleanV6529(value);
    if (!raw) return 'Not loaded';
    if (/loading/i.test(raw)) return 'Loading';
    if (/failed|unavailable/i.test(raw)) return 'Unavailable';
    let text = stripPrefixV6529(raw, [
      /^Browser cache current:\s*/i,
      /^Browser cache:\s*/i,
      /^Saved browser cache:\s*/i,
      /^Last refreshed:\s*/i,
      /^Using saved data:\s*/i,
      /^Cache:\s*/i
    ]);
    text = text.replace(/\s*[·•]\s*optimized cache rebuilding.*$/i, '');
    return cleanV6529(text) || 'Not loaded';
  }
  function isTatActiveV6529(){
    const button = byIdV6529('tatTabBtnV6509');
    const page = byIdV6529('tatDashboardPageV6509');
    if (button && button.classList.contains('active')) return true;
    if (!page) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(page) : null;
    return !!(style && style.display !== 'none' && style.visibility !== 'hidden');
  }
  function ensureFooterV6529(){
    let footer = byIdV6529(FOOTER_ID_V6529);
    if (!footer) {
      footer = document.createElement('footer');
      footer.id = FOOTER_ID_V6529;
      footer.setAttribute('aria-label', 'Dashboard status and version');
      footer.setAttribute('aria-live', 'polite');
    }
    if (footer.parentNode !== document.body || footer !== document.body.lastElementChild) {
      document.body.appendChild(footer);
    }
    return footer;
  }
  function itemV6529(label, value, className){
    return '<span data-footer-item class="' + (className || '') + '">' + label + ': ' + value + '</span>';
  }
  function renderV6529(){
    renderQueuedV6529 = false;
    if (!document.body) return;
    const footer = ensureFooterV6529();
    let html = '';
    if (isTatActiveV6529()) {
      const tat = byIdV6529('tatStampV6509');
      html += itemV6529('Cache', simpleCacheV6529(tat && tat.textContent));
    } else {
      const worker = byIdV6529('remakeCeramistStatusV6342');
      const cache = byIdV6529('remakeLastRefresh');
      html += itemV6529('Worker', simpleWorkerV6529(worker && worker.textContent));
      html += itemV6529('Cache', simpleCacheV6529(cache && cache.textContent));
    }
    html += itemV6529('Version', APP_VERSION_V6529, 'cdaSharedFooterVersionV6529');
    if (footer.innerHTML !== html) footer.innerHTML = html;
  }
  function queueRenderV6529(){
    if (renderQueuedV6529) return;
    renderQueuedV6529 = true;
    window.requestAnimationFrame(renderV6529);
  }
  function startV6529(){
    renderV6529();
    const observer = new MutationObserver(function(mutations){
      const relevant = mutations.some(function(mutation){
        const target = mutation.target && mutation.target.nodeType === 3 ? mutation.target.parentElement : mutation.target;
        if (target && target.closest && target.closest('#' + FOOTER_ID_V6529)) return false;
        return true;
      });
      if (relevant) queueRenderV6529();
    });
    observer.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','style','hidden']});
    document.addEventListener('click', function(event){
      const target = event.target && event.target.closest ? event.target.closest('#remakeFactorTabBtn,#tatTabBtnV6509') : null;
      if (target) window.setTimeout(queueRenderV6529, 0);
    }, true);
    window.addEventListener('resize', queueRenderV6529, {passive:true});
  }

  window.renderCdaSharedAppFooterV6529 = renderV6529;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startV6529, {once:true});
  else startV6529();
})();
</script>
'''.strip()


def main() -> None:
    original = INDEX_PATH.read_text(encoding='utf-8')
    if STYLE_ID in original or SCRIPT_ID in original:
        raise SystemExit('Shared footer v6.529 already exists. No file was changed.')

    required_markers = [
        'id="remakeCeramistStatusV6342"',
        'id="remakeLastRefresh"',
        'id="tatStampV6509"',
        "button.id='tatTabBtnV6509'",
        "window.CDA_REMAKE_TAT_ONLY_VERSION = 'v6.528';",
    ]
    missing = [marker for marker in required_markers if marker not in original]
    if missing:
        raise SystemExit(f'Missing expected dashboard markers: {missing}. No file was changed.')

    close_body_count = len(re.findall(r'</body>', original, flags=re.I))
    if close_body_count < 1:
        raise SystemExit('Missing </body>. No file was changed.')
    close_body_index = original.lower().rfind('</body>')

    insertion = '\n\n<!-- v6.529: one shared outer footer for Remake and TAT; tab code keeps data state but no longer owns visible footer placement. -->\n' + STYLE_BLOCK + '\n' + SCRIPT_BLOCK + '\n\n'
    text = original[:close_body_index] + insertion + original[close_body_index:]

    text = text.replace("window.CDA_REMAKE_TAT_ONLY_VERSION = 'v6.528';", "window.CDA_REMAKE_TAT_ONLY_VERSION = 'v6.529';", 1)
    text = text.replace("window.CDA_TAT_DASHBOARD_VERSION = 'v3.3-v6.528-kpi-header-parity';", "window.CDA_TAT_DASHBOARD_VERSION = 'v3.3-v6.529-shared-shell-footer';", 1)
    text = text.replace("window.CDA_TAT_KPI_HEADER_PARITY_VERSION='v6.528';", "window.CDA_TAT_KPI_HEADER_PARITY_VERSION='v6.528';\nwindow.CDA_SHARED_SHELL_FOOTER_VERSION='v6.529';", 1)

    validations = {
        STYLE_ID: text.count(STYLE_ID),
        SCRIPT_ID: text.count(SCRIPT_ID),
        'visible version literal': text.count("Version', APP_VERSION_V6529"),
        'app shell version': text.count("window.CDA_APP_SHELL_VERSION = APP_VERSION_V6529"),
        'remake version 6.529': text.count("window.CDA_REMAKE_TAT_ONLY_VERSION = 'v6.529';"),
        'tat version 6.529': text.count("window.CDA_TAT_DASHBOARD_VERSION = 'v3.3-v6.529-shared-shell-footer';"),
    }
    bad = {key: value for key, value in validations.items() if value != 1}
    if bad:
        raise SystemExit(f'Shared footer validation failed: {bad}. No file was changed.')

    before_markers = {
        'style_open': len(re.findall(r'<style\b', original, flags=re.I)),
        'style_close': len(re.findall(r'</style>', original, flags=re.I)),
        'script_open': len(re.findall(r'<script\b', original, flags=re.I)),
        'script_close': len(re.findall(r'</script>', original, flags=re.I)),
        'body_close': len(re.findall(r'</body>', original, flags=re.I)),
        'html_close': len(re.findall(r'</html>', original, flags=re.I)),
        'apps_script_print': original.count('<?='),
        'apps_script_code': original.count('<?'),
    }
    after_markers = {
        'style_open': len(re.findall(r'<style\b', text, flags=re.I)),
        'style_close': len(re.findall(r'</style>', text, flags=re.I)),
        'script_open': len(re.findall(r'<script\b', text, flags=re.I)),
        'script_close': len(re.findall(r'</script>', text, flags=re.I)),
        'body_close': len(re.findall(r'</body>', text, flags=re.I)),
        'html_close': len(re.findall(r'</html>', text, flags=re.I)),
        'apps_script_print': text.count('<?='),
        'apps_script_code': text.count('<?'),
    }
    expected_after = dict(before_markers)
    expected_after['style_open'] += 1
    expected_after['style_close'] += 1
    expected_after['script_open'] += 1
    expected_after['script_close'] += 1
    if after_markers != expected_after:
        raise SystemExit(f'Structural marker validation failed: expected {expected_after}, got {after_markers}. No file was changed.')

    INDEX_PATH.write_text(text, encoding='utf-8', newline='\n')
    print('Installed one shared Remake/TAT footer with Version: v6.529.')


if __name__ == '__main__':
    main()
