# Mahaffeys Auto-Recovery (Windows)
# -----------------------------------
# Waits for internet, pulls the latest code from GitHub, installs/builds if
# anything changed, then starts the production server — and restarts it if it
# ever stops. Intended to run at system boot via install-auto-start.ps1 so the
# yard comes back online by itself after a power loss.

param(
  [string]$RepoDir = "",
  [string]$Branch = "main",
  [int]$RestartDelaySeconds = 5
)

if (-not $RepoDir) { $RepoDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path }

$LogDir = Join-Path $RepoDir "scripts\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "auto-recover.log"

function Log([string]$Message) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

function Wait-ForInternet([int]$TimeoutMinutes = 10) {
  $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri "https://github.com" -UseBasicParsing -TimeoutSec 5 | Out-Null
      return $true
    } catch { Start-Sleep -Seconds 5 }
  }
  return $false
}

# Returns $true when the working copy moved to a new commit.
function Update-FromGithub {
  try {
    git -C $RepoDir fetch origin $Branch 2>&1 | Out-Null
    $before = [string](git -C $RepoDir rev-parse HEAD 2>$null)
    git -C $RepoDir pull --ff-only origin $Branch 2>&1 | Out-Null
    $after = [string](git -C $RepoDir rev-parse HEAD 2>$null)
    return ($before -ne $after)
  } catch {
    Log "git update failed: $_"
    return $false
  }
}

Log "=== Mahaffeys auto-recovery starting (repo: $RepoDir, branch: $Branch) ==="

# Boot after power loss: DHCP may take a minute — wait (bounded) for network.
$online = Wait-ForInternet
if ($online) { Log "Internet available." } else { Log "No internet after 10 min - starting local copy." }

$changed = Update-FromGithub
if ($changed) { Log "GitHub update applied." } else { Log "No GitHub changes (or offline) - continuing with local copy." }

$serverEntry = Join-Path $RepoDir ".output\server\index.mjs"
$nodeModules = Join-Path $RepoDir "node_modules"

if ($changed -or -not (Test-Path $nodeModules)) {
  Log "Installing dependencies..."
  Push-Location $RepoDir
  & npm install 2>&1 | ForEach-Object { Add-Content -Path $LogFile -Value $_ }
  Pop-Location
}
if ($changed -or -not (Test-Path $serverEntry)) {
  Log "Building production server..."
  Push-Location $RepoDir
  & npm run build 2>&1 | ForEach-Object { Add-Content -Path $LogFile -Value $_ }
  Pop-Location
}

# Watchdog loop — a crashed or killed server restarts automatically, pulling
# fresh code first so remote fixes propagate without anyone touching the box.
while ($true) {
  if (-not (Test-Path $serverEntry)) {
    Log "ERROR: $serverEntry missing - build may have failed. Retrying in 60 s."
    Start-Sleep -Seconds 60
    continue
  }
  Log "Starting server..."
  $proc = Start-Process -FilePath "node" -ArgumentList "`"$serverEntry`"" -WorkingDirectory $RepoDir -PassThru -NoNewWindow
  Wait-Process -Id $proc.Id
  Log "Server exited (code $($proc.ExitCode)) - restarting in $RestartDelaySeconds s."
  Start-Sleep -Seconds $RestartDelaySeconds
  if (Wait-ForInternet -TimeoutMinutes 1) {
    if (Update-FromGithub) {
      Log "New code pulled - reinstalling and rebuilding before restart."
      Push-Location $RepoDir
      & npm install 2>&1 | Out-Null
      & npm run build 2>&1 | Out-Null
      Pop-Location
    }
  }
}
