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

$codeNewline = if ($code.Contains("`r`n")) { "`r`n" } else { "`n" }
$dashboardNewline = if ($dashboard.Contains("`r`n")) { "`r`n" } else { "`n" }
$editorNewline = if ($editor.Contains("`r`n")) { "`r`n" } else { "`n" }

$code = Replace-ExactCount -Text $code -Old 'v6.639' -New 'v6.641' -ExpectedCount 8 -Label 'Code.js version stamp'
$code = Replace-ExactCount -Text $code -Old 'REMAKE-DEPLOYMENT-VIEWER-78' -New 'DEV-IFRAME-ROUTE-80' -ExpectedCount 1 -Label 'Code.js build stamp'

$oldCodeRoute = "  const isDevelopmentUrl = /\/dev\/?$/i.test(String(window.location && window.location.pathname || ''));"
$newCodeRoute = @(
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
) -join $codeNewline

$code = Replace-ExactCount -Text $code -Old $oldCodeRoute -New $newCodeRoute -ExpectedCount 1 -Label 'Code.js iframe route detection'

$oldDashboardRoute = @(
  '    // v6.640: Plain /dev is the full administrative dashboard.'
  '    // Normal deployed /exec continues to respect the server-owned Remake-only mode.'
  "    if (/\/dev\/?$/i.test(String(window.location && window.location.pathname || ''))) {"
  "      window.CDA_SERVER_PRESENTATION.mode = 'all';"
  '    }'
  "    window.CDA_SERVER_PRESENTATION.startTab = 'remakeFactor';"
) -join $dashboardNewline

$newDashboardRoute = @(
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
) -join $dashboardNewline

$dashboard = Replace-ExactCount -Text $dashboard -Old $oldDashboardRoute -New $newDashboardRoute -ExpectedCount 1 -Label 'DashboardMainScript iframe route detection'

$oldEditorRoute = @(
  '  function layoutEditorAllowedV6639(){'
  '    try {'
  "      return /\/dev\/?$/i.test(String(window.location && window.location.pathname || ''));"
  '    } catch (error) {'
  '      return false;'
  '    }'
  '  }'
) -join $editorNewline

$newEditorRoute = @(
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
) -join $editorNewline

$editor = Replace-ExactCount -Text $editor -Old $oldEditorRoute -New $newEditorRoute -ExpectedCount 1 -Label 'Layout editor iframe route detection'

$footer = Replace-ExactCount -Text $footer -Old 'v6.640' -New 'v6.641' -ExpectedCount 5 -Label 'SharedFooter version stamp'
$footer = Replace-ExactCount -Text $footer -Old 'DEV-FULL-EXEC-VIEWER-79' -New 'DEV-IFRAME-ROUTE-80' -ExpectedCount 1 -Label 'SharedFooter build stamp'

Write-Utf8File -Path $codePath -Text $code
Write-Utf8File -Path $dashboardPath -Text $dashboard
Write-Utf8File -Path $editorPath -Text $editor
Write-Utf8File -Path $footerPath -Text $footer

$codeCheck = Read-Utf8File $codePath
$dashboardCheck = Read-Utf8File $dashboardPath
$editorCheck = Read-Utf8File $editorPath

if ([regex]::Matches($codeCheck, 'function isDevelopmentUrlV6641\(\)').Count -ne 1) {
  throw 'Code.js development-route helper was not installed exactly once.'
}
if ([regex]::Matches($dashboardCheck, 'function cdaIsDevelopmentRouteV6641\(\)').Count -ne 1) {
  throw 'Dashboard development-route helper was not installed exactly once.'
}
if ([regex]::Matches($editorCheck, 'CDA_IS_DEVELOPMENT_ROUTE_V6641').Count -ne 1) {
  throw 'Layout editor development-route guard was not installed exactly once.'
}

$diffCheck = @(git diff --check 2>&1)
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check failed:`r`n$($diffCheck -join "`r`n")"
}

Write-Host ''
Write-Host 'v6.641 iframe-route repair prepared.'
git diff --stat -- Code.js DashboardMainScript.html SharedDashboardLayoutEditorV6593.html SharedFooter.html

git add -- Code.js DashboardMainScript.html SharedDashboardLayoutEditorV6593.html SharedFooter.html
git commit -m 'v6.641 detect dev route inside Apps Script iframe'
git push origin $expectedBranch

clasp.cmd --user work status
clasp.cmd --user work push

Write-Host ''
Write-Host 'Source pushed to Apps Script @HEAD. Do not run clasp deploy; production /exec remains pinned to @51.'
