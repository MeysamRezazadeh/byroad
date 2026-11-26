# Builds dist/byroad-<version>.zip from the extension folder, ready for the Chrome Web Store.
# Run from anywhere:  ./tools/pack.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ext = Join-Path $root 'extension'
$version = (Get-Content (Join-Path $ext 'manifest.json') -Raw | ConvertFrom-Json).version
$dist = Join-Path $root 'dist'
$zip = Join-Path $dist "byroad-$version.zip"

New-Item -ItemType Directory -Force $dist | Out-Null
if (Test-Path $zip) { Remove-Item $zip -Force -Confirm:$false }

# tar (built into Windows 10+) writes forward-slash paths, which the Web Store expects.
Push-Location $ext
try { tar -a -c -f $zip * } finally { Pop-Location }

Write-Host "Created $zip"
tar -t -f $zip
