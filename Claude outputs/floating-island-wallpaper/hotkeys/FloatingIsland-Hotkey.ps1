# Floating Island: hotkey actions for Lively Wallpaper.
#   -Action Toggle  wallpaper on/off. Off closes it, which frees its memory; on loads it again (a few seconds).
#   -Action Pause   pause/resume. It stays loaded, so this is instant, but the memory is kept.
#   -Action On | Off | Play | Stop   one-way versions of the above.
#   -Action Check   finds Lively and the wallpaper and runs a harmless command (used by the installer).
# Run by the Start-menu shortcuts that "Install hotkeys.cmd" creates. It sends Lively the
# commands from Lively's "Command Line Controls" wiki (setwp / closewp / app --play).
#   Installer version: through Livelycu.exe (or Lively.exe) in its install folder.
#   Microsoft Store version: it has no Livelycu.exe, so Lively itself is activated with the
#   command as its arguments. A second Lively.exe hands its arguments to the running one
#   over Lively's named pipe and exits (Lively's App.xaml.cs), so nothing new opens.
# Written for Windows PowerShell 5.1.
param([ValidateSet('Toggle', 'Pause', 'On', 'Off', 'Play', 'Stop', 'Check')][string]$Action = 'Toggle')

$ErrorActionPreference = 'Stop'
$dataDir = Join-Path $env:LOCALAPPDATA 'FloatingIsland'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$logFile = Join-Path $dataDir 'hotkey.log'
function Write-Log([string]$msg) { Add-Content -Path $logFile -Value ('{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $msg) }

# How to reach Lively. Returns @{ Kind = 'exe'; Path = ... } or @{ Kind = 'app'; Aumid = ... }.
function Find-Lively {
    $cache = Join-Path $dataDir 'lively-target.txt'
    if (Test-Path $cache) {
        $saved = (Get-Content $cache -Raw).Trim()
        if ($saved -like 'app:*') { return @{ Kind = 'app'; Aumid = $saved.Substring(4) } }
        if ($saved -like 'exe:*' -and (Test-Path $saved.Substring(4))) { return @{ Kind = 'exe'; Path = $saved.Substring(4) } }
    }
    # 1. Installer version (or a Livelycu.exe on PATH).
    $candidates = @()
    foreach ($base in @("$env:LOCALAPPDATA\Programs", $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($base) { $candidates += (Join-Path $base 'Lively Wallpaper\Livelycu.exe'), (Join-Path $base 'Lively Wallpaper\Lively.exe') }
    }
    $hit = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if (-not $hit) { $cmd = Get-Command 'livelycu' -ErrorAction SilentlyContinue; if ($cmd) { $hit = $cmd.Source } }
    if ($hit) { Set-Content -Path $cache -Value "exe:$hit"; return @{ Kind = 'exe'; Path = $hit } }
    # 2. Microsoft Store version: activate the packaged app with the command as arguments.
    $pkg = $null
    try { $pkg = Get-AppxPackage -Name '*LivelyWallpaper*' -ErrorAction SilentlyContinue | Select-Object -First 1 } catch { }
    if ($pkg) {
        $appId = 'App'
        try { $ids = @((Get-AppxPackageManifest $pkg).Package.Applications.Application | ForEach-Object { $_.Id }); if ($ids.Count -gt 0 -and $ids[0]) { $appId = $ids[0] } } catch { }
        $aumid = "$($pkg.PackageFamilyName)!$appId"
        Set-Content -Path $cache -Value "app:$aumid"
        return @{ Kind = 'app'; Aumid = $aumid }
    }
    throw 'Could not find Lively Wallpaper. Is it installed?'
}

# Starts a packaged app with arguments (IApplicationActivationManager), keeping its package identity.
function Start-PackagedApp([string]$aumid, [string]$arguments) {
    if (-not ('FloatingIsland.Activator' -as [type])) {
        Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
namespace FloatingIsland {
  [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IApplicationActivationManager {
    int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [MarshalAs(UnmanagedType.LPWStr)] string arguments, int options, out uint processId);
  }
  [ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")] class ApplicationActivationManager { }
  public static class Activator {
    public static uint Activate(string aumid, string args) {
      var mgr = (IApplicationActivationManager)new ApplicationActivationManager();
      uint pid; int hr = mgr.ActivateApplication(aumid, args, 0x2 /* AO_NOERRORUI */, out pid);
      if (hr < 0) Marshal.ThrowExceptionForHR(hr);
      return pid;
    }
  }
}
"@
    }
    return [FloatingIsland.Activator]::Activate($aumid, $arguments)
}

# The Floating Island folder inside Lively's library (the one holding its LivelyInfo.json).
function Find-Wallpaper {
    $cache = Join-Path $dataDir 'wallpaper-path.txt'
    if (Test-Path $cache) {
        $saved = (Get-Content $cache -Raw).Trim()
        if ($saved -and (Test-Path (Join-Path $saved 'LivelyInfo.json'))) { return $saved }
    }
    $roots = @(Join-Path $env:LOCALAPPDATA 'Lively Wallpaper\Library\wallpapers')
    $roots += Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Packages') -Directory -Filter '*LivelyWallpaper*' -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName 'LocalCache\Local\Lively Wallpaper\Library\wallpapers' }
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        foreach ($info in Get-ChildItem -Path $root -Recurse -Depth 2 -Filter 'LivelyInfo.json' -ErrorAction SilentlyContinue) {
            try {
                $json = Get-Content $info.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($json.Title -eq 'Floating Island') {
                    # Store version: Lively wants its own view of the path (Lively's wiki), i.e.
                    # ...\Packages\<pkg>\LocalCache\Local\Lively Wallpaper\... -> %LOCALAPPDATA%\Lively Wallpaper\...
                    $dir = $info.DirectoryName
                    $m = [regex]::Match($dir, '\\Packages\\[^\\]*LivelyWallpaper[^\\]*\\LocalCache\\Local\\(.*)$')
                    if ($m.Success) { $dir = Join-Path $env:LOCALAPPDATA $m.Groups[1].Value }
                    Set-Content -Path $cache -Value $dir
                    return $dir
                }
            } catch { }
        }
    }
    throw 'Could not find the Floating Island wallpaper in Lively''s library. Add Floating-Island-Lively.zip in Lively first.'
}

function Invoke-Lively([string]$arguments) {
    $target = Find-Lively
    if ($target.Kind -eq 'app') {
        Write-Log "activate $($target.Aumid)  $arguments"
        $null = Start-PackagedApp $target.Aumid $arguments
        Start-Sleep -Milliseconds 400          # let the hand-off reach the running Lively
        return 0
    }
    Write-Log "$($target.Path)  $arguments"
    $hide = @{}; if ($PSVersionTable.PSEdition -ne 'Core' -or $IsWindows) { $hide.WindowStyle = 'Hidden' }
    $p = Start-Process -FilePath $target.Path -ArgumentList $arguments -PassThru -Wait @hide
    if ($p.ExitCode -ne 0) { Write-Log "  exit code $($p.ExitCode)" }
    return $p.ExitCode
}

$stateFile = Join-Path $dataDir 'state.txt'      # "on" or "off" (assumed on until a hotkey says otherwise)
$pauseFile = Join-Path $dataDir 'paused.txt'     # present while paused
$state = 'on'
if (Test-Path $stateFile) { $state = (Get-Content $stateFile -Raw).Trim() }

try {
    switch ($Action) {
        'Toggle' { if ($state -eq 'off') { $Action = 'On' } else { $Action = 'Off' } }
        'Pause'  { if (Test-Path $pauseFile) { $Action = 'Play' } else { $Action = 'Stop' } }
    }
    switch ($Action) {
        'Off'  { $null = Invoke-Lively 'closewp --monitor -1'; Set-Content $stateFile 'off'; Remove-Item $pauseFile -ErrorAction SilentlyContinue }
        'On'   { $null = Invoke-Lively ('setwp --file "{0}"' -f (Find-Wallpaper)); $null = Invoke-Lively 'app --play true'; Set-Content $stateFile 'on'; Remove-Item $pauseFile -ErrorAction SilentlyContinue }
        'Stop' { $null = Invoke-Lively 'app --play false'; Set-Content $pauseFile 'paused' }
        'Play' { $null = Invoke-Lively 'app --play true'; Remove-Item $pauseFile -ErrorAction SilentlyContinue }
        'Check' {
            $t = Find-Lively
            if ($t.Kind -eq 'app') { Write-Output ('Lively (Microsoft Store app): ' + $t.Aumid) } else { Write-Output ('Lively: ' + $t.Path) }
            Write-Output ('Floating Island wallpaper: ' + (Find-Wallpaper))
            $code = Invoke-Lively 'app --volume +0'          # changes nothing; proves Lively answers
            if ($code -ne 0) { throw "Lively answered with error $code. Is Lively running?" }
            Write-Output 'Lively answered. All good.'
        }
    }
    Write-Log "done: $Action"
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    if ($Action -eq 'Check') { Write-Output ('PROBLEM: ' + $_.Exception.Message) }
    exit 1
}
