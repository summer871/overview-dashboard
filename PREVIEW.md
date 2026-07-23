# Local dashboard preview

This preview runs the existing `Index.html` in a local browser without pushing files to Google Apps Script.

## Start the preview

```powershell
cd "C:\AppsScript\Overview Dashboard"
git fetch origin
git switch refactor/flatten-index
git pull
npm run preview
```

Open the URL printed in PowerShell:

```text
http://127.0.0.1:4173/?presentation=all
```

Stop the server with `Ctrl+C`.

## What is real in the preview

- The repository's current `Index.html`
- Chart.js rendering
- Animations and hover behavior
- Overview filters, sorting, tables, menus, tabs, and responsive layout
- Browser-side export and display behavior

## What is simulated

- `google.script.run`
- Overview data returned by Apps Script
- Cache refresh responses

The first fixture contains sample Overview data only. The Remake and Ceramist tabs intentionally report that their local fixtures are not loaded yet.

A fixed badge reading `LOCAL PREVIEW · SAMPLE DATA` identifies the local version. No Apps Script project, BigQuery data, Drive cache, trigger, or production deployment is changed by this preview.
