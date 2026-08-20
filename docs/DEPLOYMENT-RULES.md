# Deployment Rules

**Last updated:** 2026-08-20  
**Applies to:** All changes pushed to Apps Script for this project

## Mandatory version bump (every release, no exceptions)

Every release MUST bump the visible UI version in `SharedFooter.html` before it is pushed to Apps Script.

```javascript
const UI_VERSION = 'v6.643';  // must be higher than what /dev currently shows
const BUILD_LABEL = 'SHARED-FILTER-BAR-MODULE-1';  // short description of this release
```

### Rules

1. Bump version in the SAME commit as the code change, never as a follow-up
2. The new number must be HIGHER than what the LIVE `/dev` footer currently displays (not what git contains, because git and Apps Script can drift)
3. Ship every changed file together: one commit, one push
4. After `clasp push`, open `/dev` and read the footer FIRST. If it shows the old number, the push failed
5. Do NOT run `scripts/update-footer-version.js` (superseded migration)

### Why

The footer is the only way to verify a deployment actually took effect. Without a bump, you cannot distinguish "new code is live" from "browser cached the old version."

## Deployment workflow

```powershell
cd "C:\AppsScript\Overview Dashboard"
git fetch origin
git pull origin agent/v6.544-shared-table-platform-5118
git status --short
clasp.cmd --user work status
clasp.cmd --user work push
```

Then verify:
- Open `/dev` with `?presentation=all` and `Ctrl+Shift+R`
- Read footer: UI version must match the bumped version
- Only THEN review actual behavior

## Safety rules

- Never run `clasp pull` unless git is known to be behind Apps Script (one-time sync only)
- Never run `clasp push` after a failed workflow or broken code
- Never commit `.clasp.json`, credentials, service-account files, or customer data
- GitHub push and `clasp push` are separate actions. A GitHub push does NOT update Apps Script
- If `clasp push` fails with `invalid_grant` / `invalid_rapt`: run `clasp.cmd --user work login`, then retry

## State reporting (use these exact labels)

| State | Meaning |
|-------|--------|
| **Prepared only** | Files are ready; nothing has been pushed |
| **GitHub validated** | GitHub push completed; Apps Script has NOT necessarily changed |
| **Apps Script deployed** | `clasp push` completed AND `/dev` footer shows the new version |

## Never do

- Deploy without a footer bump
- Assume a GitHub push updated Apps Script
- Report "deployed" without verifying the footer on `/dev`
- Merge to `main` or deploy production without explicit approval
- Reset user's saved layout during testing
