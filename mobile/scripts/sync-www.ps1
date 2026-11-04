$ErrorActionPreference = "Stop"
$mobileDir = Split-Path $PSScriptRoot -Parent
$root = Split-Path $mobileDir -Parent
$dest = Join-Path $mobileDir "www"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest | Out-Null

$items = @(
  "index.html",
  "manifest.json",
  "sw.js",
  ".nojekyll",
  "css",
  "js",
  "icons"
)

foreach ($item in $items) {
  $src = Join-Path $root $item
  if (-not (Test-Path $src)) { throw "Falta no jogo: $item" }
  Copy-Item $src (Join-Path $dest $item) -Recurse -Force
}

Write-Host "www sincronizado de $root -> $dest"
