/**
 * Executive Overview Dashboard Router
 * Version: Code.gs v6.639 deployment Remake viewer
 * Date: 2026-08-06
 * Purpose: Serve the dashboard shell, inject presentation metadata, and lock normal deployments to a read-only Remake Factor view while preserving saved browser layout hydration.
 */
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const page = params.page ? String(params.page).toLowerCase() : '';
  if (page === 'debug' || params.debug === '1') return renderDashboardDebugPage();

  const presentationMode = getDashboardPresentationMode(e);
  const template = HtmlService.createTemplateFromFile('Index');
  template.dashboardBaseUrl = getDashboardBaseUrl();
  template.dashboardPresentationMode = presentationMode;
  template.dashboardPresentationVersion = 'v6.639';
  template.dashboardPresentationSource = 'Code.gs v6.639 deployment Remake viewer';

  const presentation = {
    mode: presentationMode,
    version: 'v6.639',
    source: 'Code.gs v6.639 deployment Remake viewer',
    baseUrl: getDashboardBaseUrl()
  };

  const viewerEnabled = presentationMode === 'remake';
  const releaseBootstrap = `<script id="cdaReleaseStampControllerV6638">
(function installCdaReleaseStampV6638(){
  'use strict';
  const VERSION = 'v6.639';
  const BUILD = 'REMAKE-DEPLOYMENT-VIEWER-78';
  let frame = 0;

  function stamp() {
    frame = 0;
    window.CDA_CURRENT_FRONTEND_VERSION = VERSION;
    window.CDA_SHARED_FOOTER_VERSION = VERSION;
    window.CDA_SHARED_FOOTER_BUILD = BUILD;
    const footer = document.getElementById('cdaSharedAppFooterV6531');
    if (!footer) return;
    Array.from(footer.querySelectorAll('[data-footer-item]')).forEach(function(item) {
      const text = String(item.textContent || '');
      if (/^UI:/i.test(text)) item.textContent = 'UI: ' + VERSION;
      if (/^Build:/i.test(text)) item.textContent = 'Build: ' + BUILD;
    });
  }

  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(stamp);
  }

  function start() {
    stamp();
    [50, 250, 750, 1800, 4000, 8000, 14000].forEach(function(delay) { window.setTimeout(stamp, delay); });
    if (window.MutationObserver && document.body) {
      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.cdaReleaseStampV6638 = Object.freeze({ version: VERSION, build: BUILD, stamp: stamp });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
</script>`;

  const viewerBootstrap = viewerEnabled
    ? `<style id="cdaDeploymentRemakeViewerStylesV6638">
html.cdaDeploymentRemakeViewerV6638 .managerTabs > :not(#remakeFactorTabBtn):not(#remakeTabFilterHostV6337),
html.cdaDeploymentRemakeViewerV6638 #tabOneBtn,
html.cdaDeploymentRemakeViewerV6638 #tatTabBtnV6509,
html.cdaDeploymentRemakeViewerV6638 .managerTabs > .tabGroup,
html.cdaDeploymentRemakeViewerV6638 #underConstructionBtn,
html.cdaDeploymentRemakeViewerV6638 #underConstructionMenu,
html.cdaDeploymentRemakeViewerV6638 #categoricalTabBtn,
html.cdaDeploymentRemakeViewerV6638 #overviewNavActions,
html.cdaDeploymentRemakeViewerV6638 #overviewOne,
html.cdaDeploymentRemakeViewerV6638 #overviewTwo,
html.cdaDeploymentRemakeViewerV6638 #categoricalPage,
html.cdaDeploymentRemakeViewerV6638 #tatDashboardPageV6509,
html.cdaDeploymentRemakeViewerV6638 #tatTabFilterHostV6509,
html.cdaDeploymentRemakeViewerV6638 #cdaLayoutEditButtonV6593,
html.cdaDeploymentRemakeViewerV6638 #cdaLayoutEditorBarV6593,
html.cdaDeploymentRemakeViewerV6638 #layoutEditButtonV6183,
html.cdaDeploymentRemakeViewerV6638 #layoutEditPanelV6183,
html.cdaDeploymentRemakeViewerV6638 #layoutCardEditorV6184 {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
html.cdaDeploymentRemakeViewerV6638 #remakeFactorTabBtn {
  display: inline-flex !important;
  visibility: visible !important;
  pointer-events: auto !important;
}
html.cdaDeploymentRemakeViewerV6638 #remakeFactorPage {
  display: block !important;
  visibility: visible !important;
}
</style>
<script id="cdaDeploymentRemakeViewerControllerV6638">
(function installCdaDeploymentRemakeViewerV6638(){
  'use strict';
  const VERSION = 'v6.639';
  const isDevelopmentUrl = /\/dev\/?$/i.test(String(window.location && window.location.pathname || ''));
  if (isDevelopmentUrl) {
    window.CDA_DEPLOYMENT_REMAKE_VIEWER_VERSION = VERSION + '-dev-bypass';
    return;
  }
  const root = document.documentElement;
  root.classList.add('cdaDeploymentRemakeViewerV6638');
  window.CDA_DEPLOYMENT_REMAKE_VIEWER_VERSION = VERSION;

  const hiddenIds = [
    'tabOneBtn',
    'tatTabBtnV6509',
    'underConstructionBtn',
    'underConstructionMenu',
    'categoricalTabBtn',
    'overviewNavActions',
    'overviewOne',
    'overviewTwo',
    'categoricalPage',
    'tatDashboardPageV6509',
    'tatTabFilterHostV6509',
    'cdaLayoutEditButtonV6593',
    'cdaLayoutEditorBarV6593',
    'layoutEditButtonV6183',
    'layoutEditPanelV6183',
    'layoutCardEditorV6184'
  ];

  function hideNode(id) {
    const node = document.getElementById(id);
    if (!node) return;
    node.hidden = true;
    node.setAttribute('aria-hidden', 'true');
    node.classList.remove('active');
  }

  function enforce() {
    root.classList.add('cdaDeploymentRemakeViewerV6638');
    root.classList.remove('cdaLayoutEditorActiveV6593', 'cdaLayoutInteractionActiveV6597');
    if (document.body) document.body.classList.add('cdaDeploymentRemakeViewerV6638', 'cdaExecRemakeOnlyV6243');
    hiddenIds.forEach(hideNode);

    const remakeButton = document.getElementById('remakeFactorTabBtn');
    if (remakeButton) {
      remakeButton.hidden = false;
      remakeButton.removeAttribute('aria-hidden');
      remakeButton.classList.add('active');
      remakeButton.setAttribute('aria-selected', 'true');
    }

    const remakePage = document.getElementById('remakeFactorPage');
    if (remakePage) {
      remakePage.hidden = false;
      remakePage.removeAttribute('aria-hidden');
      remakePage.classList.add('active');
    }

    try {
      if (window.state && typeof window.state === 'object') window.state.activeTab = 'remakeFactor';
    } catch (error) {}
  }

  function start() {
    enforce();
    [0, 50, 250, 750, 1800, 4000].forEach(function(delay) {
      window.setTimeout(enforce, delay);
    });
    if (window.MutationObserver && document.body) {
      const observer = new MutationObserver(function() { enforce(); });
      observer.observe(document.body, { childList: true, subtree: true });
      window.setTimeout(function() { observer.disconnect(); enforce(); }, 15000);
    }
  }

  window.cdaDeploymentRemakeViewerV6638 = Object.freeze({
    version: VERSION,
    enabled: true,
    enforce: enforce,
    audit: function() {
      const remakePage = document.getElementById('remakeFactorPage');
      const editButton = document.getElementById('cdaLayoutEditButtonV6593');
      const tatPage = document.getElementById('tatDashboardPageV6509');
      return {
        version: VERSION,
        remakeVisible: !!remakePage && !remakePage.hidden,
        tatHidden: !tatPage || tatPage.hidden,
        editHidden: !editButton || editButton.hidden,
        savedLayoutStorageKey: 'cdaDashboardPersonalLayout.v6611',
        ok: !!remakePage && !remakePage.hidden && (!tatPage || tatPage.hidden) && (!editButton || editButton.hidden)
      };
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
</script>`
    : '';

  let html = template.evaluate().getContent();
  const configScript = '<script id="cdaServerPresentationV6638">window.CDA_SERVER_PRESENTATION=' +
    JSON.stringify(presentation).replace(/</g, '\\u003c') +
    ';window.CDA_SERVER_REQUESTED_PRESENTATION=' +
    JSON.stringify(presentation).replace(/</g, '\\u003c') +
    ';</script>' + releaseBootstrap + viewerBootstrap;
  html = html.indexOf('</head>') >= 0
    ? html.replace('</head>', configScript + '</head>')
    : configScript + html;

  return HtmlService.createHtmlOutput(html)
    .setTitle('Overview Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function includeDashboardFile(filename, context) {
  const safeFilename = String(filename || '').trim();
  if (!safeFilename || !/^[A-Za-z0-9_-]+$/.test(safeFilename)) {
    throw new Error('Invalid dashboard include filename: ' + safeFilename);
  }
  const template = HtmlService.createTemplateFromFile(safeFilename);
  const values = context && typeof context === 'object' ? context : {};
  Object.keys(values).forEach(function(key) { template[key] = values[key]; });
  return template.evaluate().getContent();
}

function getDashboardPresentationMode(e) {
  const params = e && e.parameter ? e.parameter : {};
  const normalized = String(params.presentation || params.view || params.mode || '').trim().toLowerCase();
  if (['all','dev','devall','alltabs','full'].indexOf(normalized) >= 0) return 'all';
  if (['overview','overviewonly','overview-only'].indexOf(normalized) >= 0) return 'overview';
  return 'remake';
}

function getDashboardBaseUrl() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (error) { return ''; }
}

function renderDashboardDebugPage() {
  const health = debugDashboardServerHealth();
  const html = `<!DOCTYPE html><html><head><base target="_top"><style>body{margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#172033}.box{margin:20px;padding:18px;border:2px solid #172033;border-radius:10px;background:#fff}pre{white-space:pre-wrap;background:#111827;color:#fff;padding:12px;border-radius:8px;overflow:auto}a{display:inline-block;margin-right:8px;background:#172033;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:900}</style></head><body><div class="box"><h1>Executive Dashboard Debug</h1><p><a href="?">Open single shell</a></p><pre>${escapeDashboardDebugHtml(JSON.stringify(health,null,2))}</pre></div></body></html>`;
  return HtmlService.createHtmlOutput(html)
    .setTitle('Executive Dashboard Debug')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function debugDashboardServerHealth() {
  const health = {
    ok: true,
    routerVersion: 'Code.gs v6.639 deployment Remake viewer',
    timestamp: new Date().toISOString(),
    scriptTimeZone: Session.getScriptTimeZone(),
    dashboardBaseUrl: getDashboardBaseUrl(),
    functions: {
      getOverviewDashboardData: typeof getOverviewDashboardData,
      refreshOverviewDashboardCache: typeof refreshOverviewDashboardCache,
      testOverviewDashboardCacheShape: typeof testOverviewDashboardCacheShape,
      debugOverviewDashboardCacheHealth: typeof debugOverviewDashboardCacheHealth
    },
    cache: {}
  };
  try {
    health.cache = typeof debugOverviewDashboardCacheHealth === 'function'
      ? debugOverviewDashboardCacheHealth()
      : { ok:false, message:'debugOverviewDashboardCacheHealth is missing from OverviewDashboardCache.gs' };
  } catch (error) {
    health.cache = {
      ok:false,
      message:error && error.message ? error.message : String(error),
      stack:error && error.stack ? error.stack : ''
    };
  }
  return health;
}

function escapeDashboardDebugHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
