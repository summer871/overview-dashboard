$ErrorActionPreference = 'Stop'

function Stop-WithMessage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  Write-Host ''
  Write-Host $Message -ForegroundColor Red
  exit 1
}

$expectedBranch = 'refactor/flatten-index'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host 'Overview Dashboard sync' -ForegroundColor Cyan
Write-Host "Project: $projectRoot"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Stop-WithMessage 'Git is not installed or is not available in PATH.'
}

if (-not (Get-Command clasp.cmd -ErrorAction SilentlyContinue)) {
  Stop-WithMessage 'clasp.cmd is not installed or is not available in PATH.'
}

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  Stop-WithMessage 'Could not determine the current Git branch.'
}

if ($branch -ne $expectedBranch) {
  Stop-WithMessage "Wrong branch: $branch. Switch to $expectedBranch before pushing."
}

$status = & git status --porcelain
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'git status failed.'
}

if ($status) {
  Write-Host ''
  Write-Host 'Local uncommitted changes were found:' -ForegroundColor Yellow
  $status | ForEach-Object { Write-Host $_ }
  Stop-WithMessage 'Commit, discard, or stash the local changes before syncing.'
}

Write-Host ''
Write-Host 'Pulling the latest approved GitHub changes...' -ForegroundColor Cyan
& git pull --ff-only
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'git pull failed. No Apps Script push was attempted.'
}

Write-Host ''
Write-Host 'Checking clasp authorization...' -ForegroundColor Cyan
$authOutput = & clasp.cmd --user work show-authorized-user --json 2>&1
$authExitCode = $LASTEXITCODE

if ($authExitCode -ne 0 -or ($authOutput -join "`n") -match 'invalid_rapt|invalid_grant|not logged in|loggedIn.?false') {
  Write-Host ''
  Write-Host 'Your Google Workspace clasp session needs to be renewed.' -ForegroundColor Yellow
  Write-Host 'Run:'
  Write-Host '  clasp.cmd logout --user work' -ForegroundColor White
  Write-Host '  clasp.cmd login --no-localhost --user work --creds "C:\Users\user\Downloads\_Project\clasp-oauth-client.json.json"' -ForegroundColor White
  Write-Host 'Then run .\push-dashboard.cmd again.'
  exit 2
}

Write-Host ''
Write-Host 'Pushing tracked Apps Script files...' -ForegroundColor Cyan
$pushOutput = & clasp.cmd --user work push 2>&1
$pushExitCode = $LASTEXITCODE
$pushText = $pushOutput -join "`n"
$pushOutput | ForEach-Object { Write-Host $_ }

if ($pushExitCode -ne 0) {
  if ($pushText -match 'invalid_rapt|invalid_grant') {
    Write-Host ''
    Write-Host 'Google expired the clasp session during the push.' -ForegroundColor Yellow
    Write-Host 'Re-run the two login commands shown above, then run .\push-dashboard.cmd again.'
    exit 2
  }

  Stop-WithMessage 'clasp push failed.'
}

Write-Host ''
Write-Host 'Done. GitHub changes are synced to Apps Script.' -ForegroundColor Green
