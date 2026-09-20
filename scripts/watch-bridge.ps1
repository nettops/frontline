# scripts/watch-bridge.ps1
# Stream live interactions between Antigravity and Claude Code

param(
    [string]$Path = "docs\findings\agent-bridge.md"
)

Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   FRONTLINE: Antigravity <-> Claude Code Live Bridge Stream " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Streaming from: $Path" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop watching at any time.`n" -ForegroundColor DarkGray

if (-not (Test-Path $Path)) {
    Write-Host "Waiting for bridge file to be initialized..." -ForegroundColor DarkYellow
    while (-not (Test-Path $Path)) {
        Start-Sleep -Milliseconds 500
    }
}

Get-Content -Path $Path -Wait -Tail 30
