# Installs the Floating Island hotkeys:
#   Ctrl + Alt + W          wallpaper on / off (off frees its memory)
#   Ctrl + Alt + Shift + W  pause / resume (instant)
# It copies the two helper scripts to %LOCALAPPDATA%\FloatingIsland and makes two Start-menu
# shortcuts with those keys (Windows runs a shortcut's "Shortcut key" from anywhere).
# Run it with "Install hotkeys.cmd". Run it again with -Uninstall to remove everything.
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $env:LOCALAPPDATA 'FloatingIsland'
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Floating Island'

if ($Uninstall) {
    Remove-Item -Recurse -Force $menu -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
    Write-Host 'Floating Island hotkeys removed.' -ForegroundColor Green
    return
}

New-Item -ItemType Directory -Force -Path $dest, $menu | Out-Null
Copy-Item -Force (Join-Path $here 'FloatingIsland-Hotkey.ps1'), (Join-Path $here 'run-hidden.vbs') $dest
Remove-Item (Join-Path $dest '*-path.txt'), (Join-Path $dest 'lively-target.txt') -ErrorAction SilentlyContinue   # forget old lookups

$shell = New-Object -ComObject WScript.Shell
function New-HotkeyShortcut([string]$name, [string]$action, [string]$keys, [string]$about) {
    $lnk = $shell.CreateShortcut((Join-Path $menu "$name.lnk"))
    $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $lnk.Arguments = ('"{0}" {1}' -f (Join-Path $dest 'run-hidden.vbs'), $action)
    $lnk.WorkingDirectory = $dest
    $lnk.Hotkey = $keys
    $lnk.WindowStyle = 7
    $lnk.Description = $about
    $lnk.IconLocation = (Join-Path $env:WINDIR 'System32\imageres.dll') + ',-183'
    $lnk.Save()
}
New-HotkeyShortcut 'Floating Island on-off' 'Toggle' 'CTRL+ALT+W' 'Turn the Floating Island wallpaper on or off (Ctrl+Alt+W)'
New-HotkeyShortcut 'Floating Island pause-play' 'Pause' 'CTRL+ALT+SHIFT+W' 'Pause or resume the Floating Island wallpaper (Ctrl+Alt+Shift+W)'

# Check now that Lively and the wallpaper can be found and that Lively answers, rather than on the first key press.
$check = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'FloatingIsland-Hotkey.ps1') -Action Check
$ok = $LASTEXITCODE -eq 0
$check | ForEach-Object { if ($_ -like 'PROBLEM*') { Write-Host $_ -ForegroundColor Yellow } else { Write-Host $_ } }

Write-Host ''
Write-Host 'Hotkeys installed:' -ForegroundColor Green
Write-Host '  Ctrl + Alt + W          wallpaper on / off'
Write-Host '  Ctrl + Alt + Shift + W  pause / resume'
if (-not $ok) { Write-Host 'Fix the message above, then run this again.' -ForegroundColor Yellow }
Write-Host 'If a key does nothing at first, sign out and back in once so Windows picks up the new shortcuts.'
