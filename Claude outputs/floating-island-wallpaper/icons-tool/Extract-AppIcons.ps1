# Pulls the real icons of Claude, Steam, VS Code and ChatGPT off this PC into the "icons" folder
# next to this script, as PNG files. Nothing is installed, changed or uploaded.
$ErrorActionPreference = 'Continue'
$out = Join-Path $PSScriptRoot 'icons'
New-Item -ItemType Directory -Force -Path $out | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class IconX {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern uint PrivateExtractIcons(string file, int index, int cx, int cy, IntPtr[] phicon, uint[] piconid, uint n, uint flags);
  [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr h);
}
"@

function Save-ExeIcon([string]$exe, [string]$dest) {
  if (-not (Test-Path $exe)) { return $false }
  try {
    $h = New-Object IntPtr[] 1; $id = New-Object uint32[] 1
    $n = [IconX]::PrivateExtractIcons($exe, 0, 256, 256, $h, $id, 1, 0)
    if ($n -lt 1 -or $h[0] -eq [IntPtr]::Zero) { return $false }
    $ic = [System.Drawing.Icon]::FromHandle($h[0]); $bmp = $ic.ToBitmap()
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); [IconX]::DestroyIcon($h[0]) | Out-Null
    return $true
  } catch { return $false }
}

# Store (MSIX) apps keep their logo PNGs next to the manifest: take the biggest one.
function Save-StoreLogo([string[]]$namePatterns, [string]$dest) {
  foreach ($pat in $namePatterns) {
    foreach ($pkg in (Get-AppxPackage -Name $pat -ErrorAction SilentlyContinue)) {
      $loc = $pkg.InstallLocation; if (-not $loc -or -not (Test-Path $loc)) { continue }
      try {
        [xml]$m = Get-Content (Join-Path $loc 'AppxManifest.xml') -Raw
        $ve = $m.GetElementsByTagName('uap:VisualElements') | Select-Object -First 1
        $cands = @()
        foreach ($a in 'Square150x150Logo', 'Square44x44Logo', 'Square310x310Logo') { if ($ve -and $ve.GetAttribute($a)) { $cands += $ve.GetAttribute($a) } }
        $best = $null
        foreach ($rel in $cands) {
          $full = Join-Path $loc $rel; $dir = Split-Path $full; $base = [IO.Path]::GetFileNameWithoutExtension($full)
          if (-not (Test-Path $dir)) { continue }
          $f = Get-ChildItem $dir -Filter "$base*.png" -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 1
          if ($f -and (-not $best -or $f.Length -gt $best.Length)) { $best = $f }
        }
        if ($best) { Copy-Item $best.FullName $dest -Force; return "$($pkg.Name) -> $($best.Name)" }
        foreach ($exe in (Get-ChildItem $loc -Filter *.exe -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -First 3)) {
          if (Save-ExeIcon $exe.FullName $dest) { return "$($pkg.Name) -> $($exe.Name)" }
        }
      } catch { }
    }
  }
  return $null
}
function Find-First([string[]]$paths) { foreach ($p in $paths) { if ($p -and (Test-Path $p)) { return $p } } return $null }

$results = [ordered]@{}

# Claude (Store package, or the older installer)
$r = Save-StoreLogo @('*Claude*') (Join-Path $out 'claude.png')
if (-not $r) {
  $exe = Find-First @((Get-ChildItem "$env:LOCALAPPDATA\AnthropicClaude" -Filter claude.exe -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -First 1).FullName, "$env:LOCALAPPDATA\Programs\Claude\Claude.exe")
  if ($exe -and (Save-ExeIcon $exe (Join-Path $out 'claude.png'))) { $r = $exe }
}
$results['Claude'] = $r

# Steam
$steamPath = $null; try { $steamPath = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction Stop).SteamPath } catch { }
$exe = Find-First @("$steamPath\steam.exe", "${env:ProgramFiles(x86)}\Steam\steam.exe", "$env:ProgramFiles\Steam\steam.exe")
$results['Steam'] = if ($exe -and (Save-ExeIcon $exe (Join-Path $out 'steam.png'))) { $exe } else { $null }

# VS Code
$exe = Find-First @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe", "$env:ProgramFiles\Microsoft VS Code\Code.exe", "${env:ProgramFiles(x86)}\Microsoft VS Code\Code.exe")
$results['VS Code'] = if ($exe -and (Save-ExeIcon $exe (Join-Path $out 'vscode.png'))) { $exe } else { $null }

# ChatGPT (Store package)
$r = Save-StoreLogo @('*ChatGPT*', 'OpenAI.*') (Join-Path $out 'chatgpt.png')
$results['ChatGPT'] = $r

Write-Host ''
foreach ($k in $results.Keys) { if ($results[$k]) { Write-Host ("  OK    {0,-8} {1}" -f $k, $results[$k]) -ForegroundColor Green } else { Write-Host ("  MISS  {0,-8} not found on this PC" -f $k) -ForegroundColor Yellow } }
Write-Host ''
Write-Host "Icons saved in: $out"
