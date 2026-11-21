param(
    [string]$SupportEmail = "",
    [string]$MonetizationApiOrigin = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactPath = Join-Path $projectRoot "artifacts\Pora-Dom-1.0.1-v16-visual-test.apk"
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE ".gradle" }

Push-Location $projectRoot
try {
    $env:PORA_DOM_SUPPORT_EMAIL = $SupportEmail
    $env:PORA_DOM_MONETIZATION_API_ORIGIN = $MonetizationApiOrigin
    $env:PORA_DOM_FAMILY_ENABLED = "false"
    Remove-Item Env:PORA_DOM_API_ORIGIN -ErrorAction SilentlyContinue
    & (Join-Path $PSScriptRoot "generate-android-assets.ps1")
    & pnpm run android:sync
    if ($LASTEXITCODE -ne 0) { throw "Android web synchronization failed." }

    Push-Location (Join-Path $projectRoot "android")
    try {
        & .\gradlew.bat assembleRelease "-PYANDEX_AD_UNIT_ID=demo-banner-yandex"
        if ($LASTEXITCODE -ne 0) { throw "Android test release build failed." }
    } finally {
        Pop-Location
    }

    Copy-Item -Force (Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk") $artifactPath
} finally {
    Remove-Item Env:PORA_DOM_SUPPORT_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:PORA_DOM_MONETIZATION_API_ORIGIN -ErrorAction SilentlyContinue
    Remove-Item Env:PORA_DOM_FAMILY_ENABLED -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Host "Test APK with mediation adapters and Yandex demo demand: $artifactPath"
Write-Warning "Testing only. Do not upload this APK to a store: demo-banner-yandex is not a production ad unit."
