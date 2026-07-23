'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const dashboardPath = path.join(repositoryRoot, 'Index.html');
const port = Number(process.env.PORT || 4173);

const previewInjection = `
  <script>
    window.CDA_LOCAL_PREVIEW = true;
    window.CDA_SERVER_PRESENTATION = { mode: 'all' };
  </script>
  <script src="/preview/mock-google-script-run.js"></script>
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
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function serveDashboard(response) {
  fs.readFile(dashboardPath, 'utf8', (error, source) => {
    if (error) {
      send(response, 500, `Could not read Index.html: ${error.message}`, 'text/plain; charset=utf-8');
      return;
    }

    const html = source.includes('</head>')
      ? source.replace('</head>', `${previewInjection}</head>`)
      : `${previewInjection}${source}`;

    send(response, 200, html, 'text/html; charset=utf-8');
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
  console.log(`Open: http://127.0.0.1:${port}/?presentation=all`);
  console.log('Press Ctrl+C to stop.');
  console.log('');
});
