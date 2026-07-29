/**
 * Executive Overview Dashboard Router
 * Version: Code.gs v6.545 clean shared-component runtime
 * Date: 2026-07-29
 * Purpose: Serve the single Index.html dashboard shell without appending duplicate
 * shared-component scripts after the document has already included them.
 */
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const page = params.page ? String(params.page).toLowerCase() : '';

  if (page === 'debug' || params.debug === '1') {
    return renderDashboardDebugPage();
  }

  const presentationMode = getDashboardPresentationMode(e);
  const template = HtmlService.createTemplateFromFile('Index');
  template.dashboardBaseUrl = getDashboardBaseUrl();
  template.dashboardPresentationMode = presentationMode;
  template.dashboardPresentationVersion = 'v6.545';
  template.dashboardPresentationSource = 'Code.gs v6.545 clean shared-component runtime';

  return HtmlService
    .createHtmlOutput(template.evaluate().getContent())
    .setTitle('Overview Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Evaluates an HTML partial and returns its rendered content.
 * Context is copied onto the child template so existing Apps Script
 * template expressions continue to work after modularization.
 */
function includeDashboardFile(filename, context) {
  const safeFilename = String(filename || '').trim();
  if (!safeFilename || !/^[A-Za-z0-9_-]+$/.test(safeFilename)) {
    throw new Error('Invalid dashboard include filename: ' + safeFilename);
  }

  const template = HtmlService.createTemplateFromFile(safeFilename);
  const values = context && typeof context === 'object' ? context : {};
  Object.keys(values).forEach(function(key) {
    template[key] = values[key];
  });
  return template.evaluate().getContent();
}

function getDashboardPresentationMode(e) {
  const params = e && e.parameter ? e.parameter : {};
  const rawPresentation = params.presentation || params.view || params.mode || '';
  const normalized = String(rawPresentation || '').trim().toLowerCase();

  if (
    normalized === 'all' ||
    normalized === 'dev' ||
    normalized === 'devall' ||
    normalized === 'alltabs' ||
    normalized === 'full'
  ) {
    return 'all';
  }

  if (
    normalized === 'overview' ||
    normalized === 'overviewonly' ||
    normalized === 'overview-only'
  ) {
    return 'overview';
  }

  return 'remake';
}

function getDashboardBaseUrl() {
  try {
    const serviceUrl = ScriptApp.getService().getUrl();
    return serviceUrl || '';
  } catch (error) {
    return '';
  }
}

function renderDashboardDebugPage() {
  const health = debugDashboardServerHealth();
  const html = `<!DOCTYPE html><html><head><base target="_top"><style>
    body{margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#172033}.box{margin:20px;padding:18px;border:2px solid #172033;border-radius:10px;background:#fff}pre{white-space:pre-wrap;background:#111827;color:#fff;padding:12px;border-radius:8px;overflow:auto}a{display:inline-block;margin-right:8px;background:#172033;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:900}
  </style></head><body><div class="box"><h1>Executive Dashboard Debug</h1><p><a href="?">Open single shell</a></p><pre>${escapeDashboardDebugHtml(JSON.stringify(health,null,2))}</pre></div></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('Executive Dashboard Debug').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function debugDashboardServerHealth() {
  const health = {
    ok: true,
    routerVersion: 'Code.gs v6.545 clean shared-component runtime',
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
      : { ok: false, message: 'debugOverviewDashboardCacheHealth is missing from OverviewDashboardCache.gs' };
  } catch (error) {
    health.cache = {
      ok: false,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : ''
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
