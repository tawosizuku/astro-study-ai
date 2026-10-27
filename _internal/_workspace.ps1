# $AppDir = astro-study-ai/ (parent of _internal/)
$AppDir = Split-Path $PSScriptRoot -Parent

# ---- resolve Node.js (portable > system > auto-download) ----
$nodeDir = Join-Path $AppDir "_node"
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd  = Join-Path $nodeDir "npm.cmd"

if (Test-Path $nodeExe) {
    # portable node already downloaded
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
    # system node available
    $nodeExe = (Get-Command node).Source
    $npmCmd = Join-Path (Split-Path $nodeExe -Parent) "npm.cmd"
    if (-not (Test-Path $npmCmd)) { $npmCmd = "npm.cmd" }
    Write-Host "[node] Using system Node.js." -ForegroundColor DarkGray
} else {
    # download portable Node.js
    Write-Host "[node] Node.js not found. Downloading portable version (~35MB)..." -ForegroundColor Cyan
    try {
        $index = Invoke-RestMethod "https://nodejs.org/dist/index.json" -UseBasicParsing
        $lts = $index | Where-Object { $_.lts -ne $false } | Select-Object -First 1
        $ver = $lts.version
    } catch {
        Write-Host "[Error] Could not fetch Node.js info. Check your internet connection." -ForegroundColor Red
        Read-Host "  Press Enter to close"
        exit 1
    }
    $url = "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip"
    $zip = Join-Path $env:TEMP "node-portable.zip"
    Write-Host "[node] Downloading Node.js $ver from nodejs.org..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest $url -OutFile $zip -UseBasicParsing
    } catch {
        Write-Host "[Error] Download failed. Check your internet connection." -ForegroundColor Red
        Read-Host "  Press Enter to close"
        exit 1
    }
    Write-Host "[node] Extracting..." -ForegroundColor Cyan
    $tmp = Join-Path $env:TEMP "node-extract-$(Get-Random)"
    Expand-Archive $zip -DestinationPath $tmp -Force
    $extracted = Get-ChildItem $tmp -Directory | Select-Object -First 1
    if (-not $extracted) {
        Write-Host "[Error] Extraction failed." -ForegroundColor Red
        exit 1
    }
    Move-Item $extracted.FullName $nodeDir
    Remove-Item $zip -ErrorAction SilentlyContinue
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    $nodeExe = Join-Path $nodeDir "node.exe"
    $npmCmd  = Join-Path $nodeDir "npm.cmd"
    Write-Host "[node] Node.js $ver ready in _node/" -ForegroundColor Green
}

# ---- create desktop shortcut on first run ----
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$name = 'Astro' + [char]0x307E + [char]0x306A + [char]0x3073 + [char]0x30CE + [char]0x30FC + [char]0x30C8
$lnk = Join-Path $desktop ($name + '.lnk')
$batFile = Join-Path $AppDir 'START-Windows.bat'
# also recreate shortcuts that still point at the old launcher name
if (-not (Test-Path $lnk) -or $ws.CreateShortcut($lnk).TargetPath -ne $batFile) {
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = $batFile
    $sc.WorkingDirectory = $AppDir
    $sc.Description = 'Astro Study Note'
    $sc.Save()
    Write-Host "[setup] Desktop shortcut created." -ForegroundColor Green
}

# ---- start study server if not running on 8787 ----
# The learner now chooses where to create the project, from the web UI (changed 2026-10-27).
# This script used to npm-install and start astro dev in a hardcoded workspace\my-portfolio.
# That folder does not exist in a fresh clone, so Push-Location failed and npm install ran
# in the app root, and `cd /d "<missing>" && npm run dev` short-circuited, meaning the
# preview silently never started. Project creation is now POST /api/workspace/create and
# the preview is started from the study screen.
$port8787Busy = (netstat -ano 2>$null | Where-Object { $_ -match ":8787\s.*LISTENING" }).Count -gt 0
if ($port8787Busy) {
    Write-Host "[srv] Study server already running on :8787" -ForegroundColor DarkGray
} else {
    Write-Host "[srv] Starting study server..." -ForegroundColor Cyan
    $env:LOCAL_MODE = "1"
    # Put the Node folder first on PATH. With the portable Node in _node\ this is required,
    # otherwise node_modules\.bin\astro cannot find node and the preview fails to start.
    $env:PATH = (Split-Path $nodeExe -Parent) + ';' + $env:PATH
    Start-Process -WindowStyle Minimized -FilePath $nodeExe -ArgumentList "`"$AppDir\server.js`"" -WorkingDirectory $AppDir
}

# ---- wait until the server answers, so the browser does not open on a dead port ----
# The first run may download Node.js, so wait for a real response instead of a fixed delay.
$ready = $false
foreach ($i in 1..30) {
    Start-Sleep -Milliseconds 500
    try {
        Invoke-WebRequest "http://127.0.0.1:8787/index.html" -UseBasicParsing -TimeoutSec 2 | Out-Null
        $ready = $true
        break
    } catch {
        # not up yet; try again on the next pass
    }
}
if (-not $ready) {
    Write-Host "[Error] Study server did not start on :8787." -ForegroundColor Red
    Read-Host "  Press Enter to close"
    exit 1
}
Write-Host "[srv] Ready on http://localhost:8787" -ForegroundColor Green
