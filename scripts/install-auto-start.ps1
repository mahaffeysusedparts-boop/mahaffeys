# Registers the Mahaffeys auto-recovery task so the server starts on every
# boot (including unattended restarts after power loss).
#
# RUN ONCE from an elevated (Administrator) PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\scripts\install-auto-start.ps1

$ErrorActionPreference = "Stop"

$taskName = "Mahaffeys Auto Recovery"
$script = Join-Path $PSScriptRoot "auto-recover.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtStartup
# S4U lets the task run right at boot without anyone logging in.
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Registered scheduled task '$taskName'."
Write-Host "The server will now auto-start on every boot and pull the latest code from GitHub."
Write-Host "Logs: .\scripts\logs\auto-recover.log"
Write-Host ""
Write-Host "Test it right now (starts recovery in this window):"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$script`""
