$ErrorActionPreference = 'Stop'

$expectedBranch = 'agent/v6.544-shared-table-platform-5118'
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Wrong branch: $currentBranch. Expected: $expectedBranch"
}

$trackedChanges = @(git status --short --untracked-files=no)
if ($trackedChanges.Count -gt 0) {
  throw "Tracked changes already exist:`r`n$($trackedChanges -join "`r`n")"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8File {
  param([string]$Path)
  return [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path).Path, $utf8NoBom)
}

function Write-Utf8File {
  param([string]$Path, [string]$Text)
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path).Path, $Text, $utf8NoBom)
}

function Replace-ExactCount {
  param(
    [string]$Text,
    [string]$Old,
    [string]$New,
    [int]$ExpectedCount,
    [string]$Label
  )

  $count = [regex]::Matches($Text, [regex]::Escape($Old)).Count
  if ($count -ne $ExpectedCount) {
    throw "$Label expected $ExpectedCount occurrence(s); found $count."
  }
  return $Text.Replace($Old, $New)
}

$codePath = '.\Code.js'
$dashboardPath = '.\DashboardMainScript.html'
$editorPath = '.\SharedDashboardLayoutEditorV6593.html'
$footerPath = '.\SharedFooter.html'

$code = Read-Utf8File $codePath
$dashboard = Read-Utf8File $dashboardPath
$editor = Read-Utf8File $editorPath
$footer = Read-Utf8File $footerPath

$codeNl = if ($code.Contains("`r`n")) { "`r`n" } else { "`n" }
$dashboardNl = if ($dashboard.Contains("`r`n")) { "`r`n" } else { "`n" }
$editorNl = if ($editor.Contains("`r`n")) { "`r`n" } else { "`n" }

$code = Replace-ExactCount -Text $code -Old 'v6.641' -New 'v6.642' -ExpectedCount 8 -Label 'Code.js version stamp'
$code = Replace-ExactCount -Text $code -Old 'DEV-IFRAME-ROUTE-80' -New 'SERVER-ROUTE-AUTHORITY-81' -ExpectedCount 1 -Label 'Code.js build stamp'

$oldDoGetRoute = @(
  '  const presentationMode = getDashboardPresentationMode(e);'
  "  const template = HtmlService.createTemplateFromFile('Index');"
  '  template.dashboardBaseUrl = getDashboardBaseUrl();'
) -join $codeNl

$newDoGetRoute = @(
  '  const dashboardBaseUrl = getDashboardBaseUrl();'
  '  const presentationMode = getDashboardPresentationMode(e, dashboardBaseUrl);'
  "  const template = HtmlService.createTemplateFromFile('Index');"
  '  template.dashboardBaseUrl = dashboardBaseUrl;'
) -join $codeNl

$code = Replace-ExactCount -Text $code -Old $oldDoGetRoute -New $newDoGetRoute -ExpectedCount 1 -Label 'Server route bootstrap'
$code = Replace-ExactCount -Text $code -Old '    baseUrl: getDashboardBaseUrl()' -New '    baseUrl: dashboardBaseUrl' -ExpectedCount 1 -Label 'Presentation base URL'

$oldViewerRoute = @(
  "  const VERSION = 'v6.642';"
  '  function isDevelopmentUrlV6641(){'
  '    const candidates = ['
  '      window.location && window.location.href,'
  '      document.referrer,'
  '      window.CDA_SERVER_PRESENTATION && window.CDA_SERVER_PRESENTATION.baseUrl,'
  '      window.CDA_SERVER_REQUESTED_PRESENTATION && window.CDA_SERVER_REQUESTED_PRESENTATION.baseUrl'
  '    ];'
  '    try {'
  '      if (window.top && window.top !== window) candidates.push(window.top.location.href);'
  '    } catch (error) {}'
  '    return candidates.some(function(value){'
  "      return /\/dev(?:[/?#]|$)/i.test(String(value || ''));"
  '    });'
  '  }'
  '  const isDevelopmentUrl = isDevelopmentUrlV6641();'
  '  if (isDevelopmentUrl) {'
  "    window.CDA_DEPLOYMENT_REMAKE_VIEWER_VERSION = VERSION + '-dev-bypass';"
  '    return;'
  '  }'
  '  const root = document.documentElement;'
) -join $codeNl

$newViewerRoute = @(
  "  const VERSION = 'v6.642';"
  '  const root = document.documentElement;'
) -join $codeNl

$code = Replace-ExactCount -Text $code -Old $oldViewerRoute -New $newViewerRoute -ExpectedCount 1 -Label 'Viewer client route bypass'

$oldModeFunction = @(
  'function getDashboardPresentationMode(e) {'
  '  const params = e && e.parameter ? e.parameter : {};'
  "  const normalized = String(params.presentation || params.view || params.mode || '').trim().toLowerCase();"
  "  if (['all','dev','devall','alltabs','full'].indexOf(normalized) >= 0) return 'all';"
  "  if (['overview','overviewonly','overview-only'].indexOf(normalized) >= 0) return 'overview';"
  "  return 'remake';"
  '}'
) -join $codeNl

$newModeFunction = @(
  'function getDashboardPresentationMode(e, dashboardBaseUrl) {'
  '  const params = e && e.parameter ? e.parameter : {};'
  "  const normalized = String(params.presentation || params.view || params.mode || '').trim().toLowerCase();"
  "  if (['all','dev','devall','alltabs','full'].indexOf(normalized) >= 0) return 'all';"
  "  if (['overview','overviewonly','overview-only'].indexOf(normalized) >= 0) return 'overview';"
  "  if (['remake','remakeonly','remake-only','viewer'].indexOf(normalized) >= 0) return 'remake';"
  "  if (/\/dev\/?$/i.test(String(dashboardBaseUrl || ''))) return 'all';"
  "  return 'remake';"
  '}'
) -join $codeNl

$code = Replace-ExactCount -Text $code -Old $oldModeFunction -New $newModeFunction -ExpectedCount 1 -Label 'Server presentation mode owner'

$oldDashboardRoute = @(
  '    // v6.641: Apps Script renders inside an iframe, so pathname alone cannot identify /dev.'
  '    // Use the iframe URL, referrer, server base URL, and accessible top URL as route signals.'
  '    function cdaIsDevelopmentRouteV6641(){'
  '      var candidates = ['
  '        window.location && window.location.href,'
  '        document.referrer,'
  '        window.CDA_SERVER_PRESENTATION && window.CDA_SERVER_PRESENTATION.baseUrl,'
  '        window.CDA_SERVER_REQUESTED_PRESENTATION && window.CDA_SERVER_REQUESTED_PRESENTATION.baseUrl'
  '      ];'
  '      try {'
  '        if (window.top && window.top !== window) candidates.push(window.top.location.href);'
  '      } catch (error) {}'
  '      return candidates.some(function(value){'
  "        return /\/dev(?:[/?#]|$)/i.test(String(value || ''));"
  '      });'
  '    }'
  '    window.CDA_IS_DEVELOPMENT_ROUTE_V6641 = cdaIsDevelopmentRouteV6641();'
  '    if (window.CDA_IS_DEVELOPMENT_ROUTE_V6641) {'
  "      window.CDA_SERVER_PRESENTATION.mode = 'all';"
  '    }'
  "    window.CDA_SERVER_PRESENTATION.startTab = 'remakeFactor';"
) -join $dashboardNl

$newDashboardRoute = @(
  '    // v6.642: Code.js owns presentation mode using the Apps Script service URL.'
  '    // The client consumes the server result and does not guess /dev from iframe URLs.'
  "    window.CDA_IS_DEVELOPMENT_ROUTE_V6642 = window.CDA_SERVER_PRESENTATION.mode === 'all';"
  "    window.CDA_SERVER_PRESENTATION.startTab = 'remakeFactor';"
) -join $dashboardNl

$dashboard = Replace-ExactCount -Text $dashboard -Old $oldDashboardRoute -New $newDashboardRoute -ExpectedCount 1 -Label 'Dashboard client route override'

$oldEditorRoute = @(
  '  function layoutEditorAllowedV6639(){'
  '    try {'
  '      if (window.CDA_IS_DEVELOPMENT_ROUTE_V6641 === true) return true;'
  '      const candidates = ['
  '        window.location && window.location.href,'
  '        document.referrer,'
  '        window.CDA_SERVER_PRESENTATION && window.CDA_SERVER_PRESENTATION.baseUrl,'
  '        window.CDA_SERVER_REQUESTED_PRESENTATION && window.CDA_SERVER_REQUESTED_PRESENTATION.baseUrl'
  '      ];'
  '      try {'
  '        if (window.top && window.top !== window) candidates.push(window.top.location.href);'
  '      } catch (error) {}'
  '      return candidates.some(function(value){'
  "        return /\/dev(?:[/?#]|$)/i.test(String(value || ''));"
  '      });'
  '    } catch (error) {'
  '      return false;'
  '    }'
  '  }'
) -join $editorNl

$newEditorRoute = @(
  '  function layoutEditorAllowedV6639(){'
  '    try {'
  "      return !!(window.CDA_SERVER_PRESENTATION && window.CDA_SERVER_PRESENTATION.mode === 'all');"
  '    } catch (error) {'
  '      return false;'
  '    }'
  '  }'
) -join $editorNl

$editor = Replace-ExactCount -Text $editor -Old $oldEditorRoute -New $newEditorRoute -ExpectedCount 1 -Label 'Layout editor server-mode guard'

$footer = Replace-ExactCount -Text $footer -Old 'v6.641' -New 'v6.642' -ExpectedCount 5 -Label 'SharedFooter version stamp'
$footer = Replace-ExactCount -Text $footer -Old 'DEV-IFRAME-ROUTE-80' -New 'SERVER-ROUTE-AUTHORITY-81' -ExpectedCount 1 -Label 'SharedFooter build stamp'

Write-Utf8File -Path $codePath -Text $code
Write-Utf8File -Path $dashboardPath -Text $dashboard
Write-Utf8File -Path $editorPath -Text $editor
Write-Utf8File -Path $footerPath -Text $footer

$codeCheck = Read-Utf8File $codePath
$dashboardCheck = Read-Utf8File $dashboardPath
$editorCheck = Read-Utf8File $editorPath

if ([regex]::Matches($codeCheck, 'function getDashboardPresentationMode\(e, dashboardBaseUrl\)').Count -ne 1) {
  throw 'Server presentation-mode function was not installed exactly once.'
}
if ([regex]::Matches($codeCheck, "if \(/\\/dev\\/\?\$/i\.test\(String\(dashboardBaseUrl \|\| ''\)\)\) return 'all';").Count -ne 1) {
  throw 'Server /dev route rule was not installed exactly once.'
}
if ([regex]::Matches($dashboardCheck, 'CDA_IS_DEVELOPMENT_ROUTE_V6642').Count -ne 1) {
  throw 'Dashboard server-mode marker was not installed exactly once.'
}
if ([regex]::Matches($editorCheck, "CDA_SERVER_PRESENTATION\.mode === 'all'").Count -ne 1) {
  throw 'Layout editor server-mode guard was not installed exactly once.'
}
if ($codeCheck.Contains('isDevelopmentUrlV6641') -or $dashboardCheck.Contains('cdaIsDevelopmentRouteV6641')) {
  throw 'Legacy iframe route guessing still exists.'
}

$diffCheck = @(git diff --check 2>&1)
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check failed:`r`n$($diffCheck -join "`r`n")"
}

Write-Host ''
Write-Host 'v6.642 server-route repair prepared.'
git diff --stat -- Code.js DashboardMainScript.html SharedDashboardLayoutEditorV6593.html SharedFooter.html

git add -- Code.js DashboardMainScript.html SharedDashboardLayoutEditorV6593.html SharedFooter.html
git commit -m 'v6.642 make Apps Script server authoritative for dev route'
git push origin $expectedBranch

clasp.cmd --user work status
clasp.cmd --user work push

Write-Host ''
Write-Host 'Apps Script @HEAD updated. Production /exec remains pinned to @51; do not run clasp deploy.'
