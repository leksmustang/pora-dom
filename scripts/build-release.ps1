param(
    [string]$SupportEmail = "",
    [string]$YandexAdUnitId = "",
    [string]$MonetizationApiOrigin = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$apkArtifactPath = Join-Path $projectRoot "artifacts\Pora-Dom-1.0.1-v16-release.apk"
$aabArtifactPath = Join-Path $projectRoot "artifacts\Pora-Dom-1.0.1-v16-release.aab"
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
        $gradleArgs = @("assembleRelease", "bundleRelease")
        if ($YandexAdUnitId) { $gradleArgs += "-PYANDEX_AD_UNIT_ID=$YandexAdUnitId" }
        & .\gradlew.bat @gradleArgs
        if ($LASTEXITCODE -ne 0) { throw "Android release build failed." }
    } finally {
        Pop-Location
    }

    Copy-Item -Force (Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk") $apkArtifactPath
    Copy-Item -Force (Join-Path $projectRoot "android\app\build\outputs\bundle\release\app-release.aab") $aabArtifactPath
} finally {
    Remove-Item Env:PORA_DOM_SUPPORT_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:PORA_DOM_MONETIZATION_API_ORIGIN -ErrorAction SilentlyContinue
    Remove-Item Env:PORA_DOM_FAMILY_ENABLED -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Host "Release APK: $apkArtifactPath"
Write-Host "Release AAB: $aabArtifactPath"
if (-not $YandexAdUnitId) { Write-Warning "Production Yandex ad unit was not supplied; the release banner is disabled." }
if (-not $MonetizationApiOrigin) { Write-Warning "Monetization API was not supplied; direct sponsor and CPA placements are disabled." }
if (-not $SupportEmail) { Write-Warning "Support email was not supplied; add it before store upload." }
