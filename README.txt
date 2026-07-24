OVERVIEW DASHBOARD - MODULAR TEST PROJECT
Generated from the uploaded working project on 2026-07-23.

PURPOSE
This is a test-only copy. It keeps the Remake and TAT interfaces in one browser page.
Both views remain loaded together, and existing tab switching remains client-side and instant.
No GitHub files or existing Apps Script deployment were changed.

WHAT CHANGED
- Index.html was reduced from 2,041,380 bytes to 217,453 bytes.
- 11 large inline style/script blocks were moved into HTML partial files.
- Their include directives remain in the exact original positions, preserving load order.
- Code.js now contains includeDashboardFile(filename, context).
- DashboardMainScript receives the same four template variables that Index.html previously used.
- Backend data/cache files were copied without edits.

FILES TO CREATE IN A NEW APPS SCRIPT PROJECT
Apps Script editor name                  ZIP file
Code.gs                                  Code.js
RemakeFactorCache.gs                     RemakeFactorCache.js
CaeramistRemakeProfiler.gs               CaeramistRemakeProfiler.js
TatDashboardCache.gs                     TatDashboardCache.js
Index.html                               Index.html
DashboardBaseStyles.html                 DashboardBaseStyles.html
DashboardMainScript.html                 DashboardMainScript.html
DashboardSupportScript01.html            DashboardSupportScript01.html
DashboardSupportScript02.html            DashboardSupportScript02.html
DashboardSupportScript03.html            DashboardSupportScript03.html
RemakeResponsiveStyles.html              RemakeResponsiveStyles.html
DashboardSupportScript04.html            DashboardSupportScript04.html
UnifiedControlsStyles.html               UnifiedControlsStyles.html
TatDashboardControllerScript.html        TatDashboardControllerScript.html
TatRemakeAliasStyles.html                TatRemakeAliasStyles.html
SharedTopParityStyles.html               SharedTopParityStyles.html
appsscript.json                         appsscript.json (show manifest in Project Settings)

MANUAL TEST SETUP
1. Create a separate standalone Apps Script project.
2. Enable the BigQuery advanced service in the test project.
3. Copy each .js file into a same-named .gs editor file as listed above.
4. Create every included .html file with the exact matching name.
5. Replace the test project's manifest with appsscript.json.
6. Deploy as a Web app using the same access policy appropriate for your domain.
7. Open the /dev test deployment first.
8. Verify Remake loads, TAT loads, switching tabs does not reload the page, and the browser console is clean.

IMPORTANT
- Do not paste this over the production project yet.
- The uploaded .clasp.json was deliberately excluded because it identifies the existing script project.
- This package does not change business logic; it changes source-file organization only.
- Apps Script evaluates all partials server-side into one final HTML document. It does not create separate pages.

VALIDATION PERFORMED
- Exact reconstruction: expanding all include directives reproduces the original Index.html byte-for-byte.
- Include count and extracted partial count match.
- Original template expressions in DashboardMainScript are preserved and receive explicit context.
