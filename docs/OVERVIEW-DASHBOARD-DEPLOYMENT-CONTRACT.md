# Executive Overview Dashboard Deployment Contract

## Current verified release

- Release: `v6.639`
- Git commit implementing the viewer split: `1e536b2`
- Existing Apps Script `/exec` deployment ID: `AKfycbyq4gzsy25t1_6zzRBvp47cI5ppQmLxuMA100sn1I5Ay8VZjLekOBSarE2HN68WxUf6`
- Verified deployment version: `@51`
- Verification date: 2026-08-06

## Presentation contract

The two Apps Script routes have different purposes and must remain separate.

### Administrative route

`/dev?presentation=all`

- Shows the full dashboard, including Remake Factor and TAT.
- Allows layout editing.
- Is the required route for development and release verification.
- Must display the new footer version before a release is considered deployed.

### Viewer route

The normal deployed `/exec` URL:

- Shows Remake Factor only.
- Does not show the TAT tab.
- Does not show the `Edit Remake layout` button or layout-editor controls.
- Still hydrates and applies the previously saved browser layout.

## Code ownership

### Server presentation mode

`Code.js` is the authoritative owner of presentation mode.

- Normal requests default to `remake`.
- Explicit administrative query values such as `presentation=all` may enable the full dashboard.
- Client code must not replace the server-owned mode.

`DashboardMainScript.html` must not contain an override such as:

```javascript
window.CDA_SERVER_PRESENTATION.mode = 'remaketat';
```

That override previously caused the deployed `/exec` URL to expose both Remake Factor and TAT.

### Layout persistence versus editing

`SharedDashboardLayoutEditorV6593.html` has two separate responsibilities that must not be conflated:

1. Hydrate and apply saved layouts.
2. Mount interactive layout-editing controls.

Saved-layout hydration must remain available on both `/dev` and `/exec`.

Layout-editor controls may mount only when `window.location.pathname` ends in `/dev`. The production `/exec` route must remain read-only.

## Deployment workflow

GitHub and Apps Script are separate systems.

1. Commit and push the complete release to the correct GitHub branch.
2. Verify the clasp-managed file set with:

```powershell
clasp.cmd --user work status
```

3. Push the Apps Script source from the authenticated local session:

```powershell
clasp.cmd --user work push
```

4. Update the existing deployment ID rather than creating a new deployment:

```powershell
clasp.cmd --user work deploy -i "AKfycbyq4gzsy25t1_6zzRBvp47cI5ppQmLxuMA100sn1I5Ay8VZjLekOBSarE2HN68WxUf6" -d "vX.XXX release description"
```

Updating the existing deployment preserves the same `/exec` URL.

## Required verification

A release is not complete until both routes have been checked with a hard refresh.

### `/dev?presentation=all`

- Footer shows the new release version.
- Full dashboard is available.
- Layout editor is available.
- Real data loads successfully.

### `/exec`

- Remake Factor is the only visible tab.
- TAT is not visible.
- Layout-editing controls are not visible.
- The saved browser layout remains applied.
- Real data loads successfully.

Do not report `Apps Script deployed` until the actual `/exec` deployment has been verified, not merely the `/dev` route or the GitHub commit.

## Automation boundary

ChatGPT can prepare and push GitHub changes, inspect repository state, identify the correct Apps Script deployment, and provide guarded deployment commands. The final `clasp` push and deployment commands run in Summer's locally authenticated PowerShell session unless a separately approved CI/CD deployment workflow is established.