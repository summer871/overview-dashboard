/**
 * Executive Overview Dashboard Router
 * Version: Code.gs v6.555 live component isolation
 * Date: 2026-07-29
 * Purpose: Serve the dashboard shell and inject a stable component route for live pop-out windows.
 */
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const page = params.page ? String(params.page).toLowerCase() : '';
  if (page === 'debug' || params.debug === '1') return renderDashboardDebugPage();

  const presentationMode = getDashboardPresentationMode(e);
  const componentRoute = getDashboardComponentRoute(e);
  const template = HtmlService.createTemplateFromFile('Index');
  template.dashboardBaseUrl = getDashboardBaseUrl();
  template.dashboardPresentationMode = presentationMode;
  template.dashboardPresentationVersion = 'v6.555';
  template.dashboardPresentationSource = 'Code.gs v6.555 live component isolation';

  const presentation = {
    mode: presentationMode,
    version: 'v6.555',
    source: 'Code.gs v6.555 live component isolation',
    baseUrl: getDashboardBaseUrl(),
    componentRoute: componentRoute,
    isComponentWindow: Boolean(componentRoute)
  };

  let html = template.evaluate().getContent();
  const configScript = '<script id="cdaServerPresentationV6555">window.CDA_SERVER_PRESENTATION=' +
    JSON.stringify(presentation).replace(/</g, '\\u003c') + ';</script>';
  html = html.indexOf('</head>') >= 0
    ? html.replace('</head>', configScript + '</head>')
    : configScript + html;

  return HtmlService.createHtmlOutput(html)
    .setTitle(componentRoute ? 'Dashboard Component' : 'Overview Dashboard')
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

function getDashboardComponentRoute(e) {
  const params = e && e.parameter ? e.parameter : {};
  const value = String(params.component || '').trim().toLowerCase();
  return /^(?:remake|tat)\.[a-z0-9_-]+$/.test(value) ? value : '';
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
    routerVersion: 'Code.gs v6.555 live component isolation',
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
