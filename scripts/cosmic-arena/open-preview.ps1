param([int]$Port = 4318)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$url = "http://127.0.0.1:$Port/"
$alreadyRunning = $false
try { $alreadyRunning = (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1).StatusCode -eq 200 } catch {}
if (-not $alreadyRunning) {
  Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList @("$PSScriptRoot/serve.mjs") -WorkingDirectory $root
  Start-Sleep -Milliseconds 350
}
Start-Process $url
Write-Host "Cosmic arena preview: $url"
