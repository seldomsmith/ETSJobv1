# ⚡ ETS@Work Automated Sync Tool
param (
    [string]$Message = "chore: automated sync update"
)

Clear-Host
Write-Host "----------------------------------" -ForegroundColor Yellow
Write-Host "🚀 ETS@Work Auto-Sync Initiated" -ForegroundColor Yellow
Write-Host "----------------------------------" -ForegroundColor Yellow

# Check for git modifications
$status = git status --porcelain
if ([string]::IsNullOrEmpty($status)) {
    Write-Host "✅ No changes detected. Workspace is clean." -ForegroundColor Green
    exit
}

Write-Host "📦 Staging all active modifications..." -ForegroundColor Cyan
git add -A

Write-Host "✍️ Committing changes with message: '$Message'..." -ForegroundColor Cyan
git commit -m $Message

Write-Host "☁️ Uploading commits to remote origin (GitHub)..." -ForegroundColor Cyan
git push origin main

Write-Host "----------------------------------" -ForegroundColor Green
Write-Host "🎉 Sync Complete! Remote repository is updated." -ForegroundColor Green
Write-Host "👉 Go to your Codespace terminal and run: git pull" -ForegroundColor Green
Write-Host "----------------------------------" -ForegroundColor Green
