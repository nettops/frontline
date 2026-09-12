# Headless smoke test, no Editor GUI, no human required - the Whitebox
# pattern applied to this project. Runs the actual game startup path
# (-game, not the Editor) with no renderer, watches for the one log line
# tonyCharacter::BeginPlay prints, and reports pass/fail on its own.
#
# What this catches: "does it even run" bugs - a missing component, a
# crash on startup, a value that's obviously wrong. What it does NOT
# catch: anything about how it looks or feels. That still needs eyes on
# a real Play session.
#
# Close the Editor before running this - a second Unreal process against
# the same project's Saved/DerivedDataCache while the Editor has it open
# will contend for the same file locks that blocked Live Coding earlier.

param(
    [string]$EnginePath = "A:\UE_5.8",
    [int]$TimeoutSeconds = 25
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$UProject = Join-Path $ProjectRoot "tony.uproject"
$Editor = Join-Path $EnginePath "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$LogFile = Join-Path $ProjectRoot "Saved\Logs\tony.log"

if (-not (Test-Path $Editor)) {
    Write-Error "UnrealEditor-Cmd.exe not found at $Editor - pass -EnginePath if UE isn't at A:\UE_5.8"
    exit 1
}

# Stale log from a previous run would make a crash-before-BeginPlay look
# like a pass, so start from nothing.
if (Test-Path $LogFile) { Remove-Item $LogFile -Force }

Write-Host "Launching headless: $Editor"
Write-Host "  Project: $UProject"
Write-Host "  Timeout: $TimeoutSeconds seconds"

$proc = Start-Process -FilePath $Editor -ArgumentList @(
    "`"$UProject`""
    "/Game/TopDown/Lvl_TopDown"
    "-game"
    "-nullrhi"
    "-unattended"
    "-nosplash"
    # NOT -stdout: with -WindowStyle Hidden and no redirect, the process
    # has nowhere to put that output. It deadlocks the instant the OS pipe
    # buffer fills (reliably right after the ControlRig Python init log
    # burst) waiting forever on a write nobody's reading. The log file
    # below doesn't need this flag at all.
    "-FORCELOGFLUSH"
) -PassThru -WindowStyle Hidden

$exited = $proc.WaitForExit($TimeoutSeconds * 1000)
if (-not $exited) {
    Write-Host "Process still running after timeout - stopping it (expected; this template has no auto-quit)."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 500

if (-not (Test-Path $LogFile)) {
    Write-Host "FAIL: no log file produced at all - the process likely never started. Check the engine path." -ForegroundColor Red
    exit 1
}

$smokeLines = Select-String -Path $LogFile -Pattern "LogFrontlineSmoke" -ErrorAction SilentlyContinue

if (-not $smokeLines) {
    Write-Host "FAIL: BeginPlay never logged. Character didn't spawn, or crashed before BeginPlay ran." -ForegroundColor Red
    Write-Host "Last 20 log lines:"
    Get-Content $LogFile -Tail 20
    exit 1
}

$hadError = $smokeLines | Where-Object { $_.Line -match "Error:" }
if ($hadError) {
    Write-Host "FAIL:" -ForegroundColor Red
    $hadError | ForEach-Object { Write-Host $_.Line -ForegroundColor Red }
    exit 1
}

Write-Host "PASS" -ForegroundColor Green
$smokeLines | ForEach-Object { Write-Host $_.Line }
exit 0
