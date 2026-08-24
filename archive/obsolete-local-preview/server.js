'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const dashboardPath = path.join(repositoryRoot, 'Index.html');
const port = Number(process.env.PORT || 4173);
const localBaseUrl = `http://127.0.0.1:${port}/`;

const previewInjection = `
  <script>
    window.CDA_LOCAL_PREVIEW = true;
    window.CDA_LOCAL_PREVIEW_VERSION = 'v3-template-rendering';
  </script>
  <script src="/preview/mock-google-script-run.js?v=3"></script>
`;

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  return 'application/octet-stream';
}

function send(response, statusCode, body, type) {
  response.writeHead(statusCode, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  response.end(body);
}

function renderAppsScriptTemplate(source) {
  let rendered = source;

  rendered = rendered.replace(
    /<\?!=\s*dashboardBaseUrl\s*\?>/g,
    localBaseUrl
  );

  rendered = rendered.replace(
    /<\?!=\s*JSON\.stringify\(dashboardPresentationVersion\s*\|\|\s*'[^']*'\)\s*\?>/g,
    JSON.stringify('local-preview-v3')
  );

  rendered = rendered.replace(
    /<\?!=\s*JSON\.stringify\(dashboardPresentationMode\s*\|\|\s*'[^']*'\)\s*\?>/g,
    JSON.stringify('remake')
  );

  rendered = rendered.replace(
    /<\?!=\s*JSON\.stringify\(dashboardPresentationSource\s*\|\|\s*'[^']*'\)\s*\?>/g,
    JSON.stringify('Local preview server')
  );

  const unresolved = rendered.match(/<\?[!=]?[^?]*\?>/g);
  if (unresolved && unresolved.length) {
    throw new Error(`Unresolved Apps Script template expressions: ${unresolved.join(', ')}`);
  }

  return rendered;
}

function serveDashboard(response) {
  fs.readFile(dashboardPath, 'utf8', (error, source) => {
    if (error) {
      send(response, 500, `Could not read Index.html: ${error.message}`, 'text/plain; charset=utf-8');
      return;
    }

    try {
      const renderedSource = renderAppsScriptTemplate(source);
      const html = renderedSource.includes('</head>')
        ? renderedSource.replace('</head>', `${previewInjection}</head>`)
        : `${previewInjection}${renderedSource}`;

      send(response, 200, html, 'text/html; charset=utf-8');
    } catch (templateError) {
      send(
        response,
        500,
        `Could not render the local Apps Script template: ${templateError.message}`,
        'text/plain; charset=utf-8'
      );
    }
  });
}

function safeLocalPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = decoded.replace(/^\/+/, '');
  const resolved = path.resolve(repositoryRoot, relativePath);
  return resolved.startsWith(repositoryRoot + path.sep) ? resolved : null;
}

const server = http.createServer((request, response) => {
  const requestPath = request.url || '/';

  if (requestPath === '/' || requestPath.startsWith('/?') || requestPath === '/Index.html') {
    serveDashboard(response);
    return;
  }

  const filePath = safeLocalPath(requestPath);
  if (!filePath) {
    send(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, 404, 'Not found', 'text/plain; charset=utf-8');
      return;
    }
    send(response, 200, data, contentType(filePath));
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log('');
  console.log('Overview Dashboard local preview is running.');
  console.log(`Open: ${localBaseUrl}?presentation=all`);
  console.log('Apps Script template expressions were rendered locally.');
  console.log('Press Ctrl+C to stop.');
  console.log('');
});
