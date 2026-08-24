/**
 * Executive Dashboard Router
 * Version: Code.gs v6.568 raw include expansion
 * Date: 2026-08-23
 * Purpose: Serve the dashboard shell and inject presentation metadata.
 */
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const page = params.page ? String(params.page).toLowerCase() : '';
  if (page === 'debug' || params.debug === '1') return renderDashboardDebugPage();

  const presentationMode = getDashboardPresentationMode(e);
  const template = HtmlService.createTemplateFromFile('Index');
  template.dashboardBaseUrl = getDashboardBaseUrl();
  template.dashboardPresentationMode = presentationMode;
  template.dashboardPresentationVersion = 'v6.568';
  template.dashboardPresentationSource = 'Code.gs v6.568 raw include expansion';

  const presentation = {
    mode: presentationMode,
    version: 'v6.568',
    source: 'Code.gs v6.568 raw include expansion',
    baseUrl: getDashboardBaseUrl()
  };

  let html = template.evaluate().getContent();
  const configScript = '<script id="cdaServerPresentationV6567">window.CDA_SERVER_PRESENTATION=' +
    JSON.stringify(presentation).replace(/</g, '\\u003c') + ';</script>';
  html = html.indexOf('</head>') >= 0
    ? html.replace('</head>', configScript + '</head>')
    : configScript + html;

  return HtmlService.createHtmlOutput(html)
    .setTitle('Overview Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function includeDashboardFile(filename, context) {
  const safeFilename = normalizeDashboardIncludeFilename(filename);
  const values = context && typeof context === 'object' ? context : {};
  const expandedContent = expandDashboardIncludeFile(safeFilename, []);

  if (!Object.keys(values).length && expandedContent.indexOf('<?') < 0) {
    return expandedContent;
  }

  const template = HtmlService.createTemplate(expandedContent);
  Object.keys(values).forEach(function(key) { template[key] = values[key]; });
  return template.evaluate().getContent();
}

function expandDashboardIncludeFile(filename, stack) {
  const safeFilename = normalizeDashboardIncludeFilename(filename);
  const chain = Array.isArray(stack) ? stack : [];
  if (chain.indexOf(safeFilename) >= 0) {
    throw new Error('Circular dashboard include: ' + chain.concat([safeFilename]).join(' -> '));
  }

  const rawContent = HtmlService.createTemplateFromFile(safeFilename).getRawContent();
  const nextChain = chain.concat([safeFilename]);
  const includePattern = /<\?!=\s*includeDashboardFile\(\s*(['"])([A-Za-z0-9_-]+)\1\s*\)\s*;?\s*\?>/g;

  return rawContent.replace(includePattern, function(match, quote, childFilename) {
    return expandDashboardIncludeFile(childFilename, nextChain);
  });
}

function normalizeDashboardIncludeFilename(filename) {
  const safeFilename = String(filename || '').trim();
  if (!safeFilename || !/^[A-Za-z0-9_-]+$/.test(safeFilename)) {
    throw new Error('Invalid dashboard include filename: ' + safeFilename);
  }
  return safeFilename;
}

function getDashboardPresentationMode(e) {
  return 'remaketat';
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
    routerVersion: 'Code.gs v6.568 raw include expansion',
    timestamp: new Date().toISOString(),
    scriptTimeZone: Session.getScriptTimeZone(),
    dashboardBaseUrl: getDashboardBaseUrl(),
    functions: {
      getRemakeFactorData: typeof getRemakeFactorData,
      refreshRemakeFactorCache: typeof refreshRemakeFactorCache,
      debugRemakeFactorCacheHealth: typeof debugRemakeFactorCacheHealth,
      getTatDashboardData: typeof getTatDashboardData,
      refreshTatDashboardCache: typeof refreshTatDashboardCache,
      debugTatDashboardCacheHealth: typeof debugTatDashboardCacheHealth
    },
    cache: {
      remake: {},
      tat: {}
    }
  };

  try {
    health.cache.remake = typeof debugRemakeFactorCacheHealth === 'function'
      ? debugRemakeFactorCacheHealth()
      : { ok:false, message:'debugRemakeFactorCacheHealth is missing from RemakeFactorCache.js' };
  } catch (error) {
    health.cache.remake = {
      ok:false,
      message:error && error.message ? error.message : String(error),
      stack:error && error.stack ? error.stack : ''
    };
  }

  try {
    health.cache.tat = typeof debugTatDashboardCacheHealth === 'function'
      ? debugTatDashboardCacheHealth()
      : { ok:false, message:'debugTatDashboardCacheHealth is missing from TatDashboardCache.js' };
  } catch (error) {
    health.cache.tat = {
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