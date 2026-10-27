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

$enc = New-Object System.Text.UTF8Encoding($false)  # UTF-8 without BOM

function Write-UTF8 {
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

# ---- portfolio path: fixed inside astro-study/workspace/ ----
$portfolio = Join-Path $AppDir "workspace\my-portfolio"
New-Item -ItemType Directory -Force (Split-Path $portfolio -Parent) | Out-Null

Write-Host "[1/3] my-portfolio: $portfolio" -ForegroundColor DarkGray

# ---- npm install if node_modules missing ----
if (-not (Test-Path "$portfolio\node_modules")) {
    Write-Host "[2/3] Running npm install (first time only)..." -ForegroundColor Cyan
    Push-Location $portfolio
    & $npmCmd install
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Error] npm install failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "[2/3] npm install done." -ForegroundColor Green
} else {
    Write-Host "[2/3] node_modules already exists, skipping." -ForegroundColor DarkGray
}

# ---- start astro dev if not running on 4321 ----
$portBusy = (netstat -ano 2>$null | Where-Object { $_ -match ":4321\s.*LISTENING" }).Count -gt 0
if ($portBusy) {
    Write-Host "[3/3] astro dev already running on :4321" -ForegroundColor DarkGray
} else {
    Write-Host "[3/3] Starting astro dev..." -ForegroundColor Cyan
    Start-Process -WindowStyle Minimized -FilePath "cmd" -ArgumentList "/c cd /d `"$portfolio`" && `"$npmCmd`" run dev"
    Write-Host "[3/3] astro dev started." -ForegroundColor Green
}

# ---- start study server if not running on 8787 ----
$port8787Busy = (netstat -ano 2>$null | Where-Object { $_ -match ":8787\s.*LISTENING" }).Count -gt 0
if ($port8787Busy) {
    Write-Host "[srv] Study server already running on :8787" -ForegroundColor DarkGray
} else {
    Write-Host "[srv] Starting study server..." -ForegroundColor Cyan
    $env:LOCAL_MODE = "1"
    Start-Process -WindowStyle Minimized -FilePath $nodeExe -ArgumentList "`"$AppDir\server.js`"" -WorkingDirectory $AppDir
    Write-Host "[srv] Study server started on :8787" -ForegroundColor Green
}
