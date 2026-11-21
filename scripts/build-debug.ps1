$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE ".gradle" }

Push-Location $projectRoot
try {
    & (Join-Path $PSScriptRoot "generate-android-assets.ps1")
    & pnpm run android:sync
    if ($LASTEXITCODE -ne 0) { throw "Android web synchronization failed." }
    Push-Location (Join-Path $projectRoot "android")
    try {
        & .\gradlew.bat assembleDebug
        if ($LASTEXITCODE -ne 0) { throw "Android debug build failed." }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}

Write-Host "Debug APK: android/app/build/outputs/apk/debug/app-debug.apk"
