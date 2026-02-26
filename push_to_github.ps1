param(
    [string]$RemoteUrl
)

function Fail($msg){ Write-Host $msg -ForegroundColor Red; exit 1 }

# Ensure git is available
try { git --version > $null 2>&1 } catch { Fail "git not found. Install Git for Windows: https://git-scm.com/download/win" }

$pwdPath = (Get-Location).Path
Write-Host "Working in: $pwdPath"

# Initialize repo if needed
if (!(Test-Path (Join-Path $pwdPath ".git"))) {
    git init || Fail "git init failed"
    Write-Host "Initialized empty git repo"
} else {
    Write-Host ".git already exists"
}

# Add files and commit
git add index.html style.css script.js || Fail "git add failed"
# Only commit if there are changes
$changes = git status --porcelain
if ($changes) {
    git commit -m "Add Monkey Escape – Animal Mode game" || Fail "git commit failed"
    Write-Host "Committed files"
} else {
    Write-Host "No changes to commit"
}

# Ensure main branch
git branch -M main 2>$null | Out-Null

if ($RemoteUrl) {
    # set or update remote
    $existing = git remote get-url origin 2>$null
    if ($LASTEXITCODE -eq 0) {
        git remote set-url origin $RemoteUrl
        Write-Host "Updated remote origin to $RemoteUrl"
    } else {
        git remote add origin $RemoteUrl
        Write-Host "Added remote origin $RemoteUrl"
    }

    Write-Host "Pushing to origin main..."
    git push -u origin main || Fail "git push failed. Check credentials or remote URL."
    Write-Host "Push complete"
} else {
    Write-Host "No remote URL provided. To push, run: git remote add origin <URL> ; git push -u origin main"
}
