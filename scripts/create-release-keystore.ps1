param(
    [string]$Alias = "pora-dom-release",
    [string]$DistinguishedName = "CN=Pora Dom, OU=Mobile, O=Pora Dom, L=Moscow, C=RU"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot "android"
$signingDirectory = Join-Path $androidRoot "signing"
$secretDirectory = Join-Path $projectRoot ".release-secrets"
$keystorePath = Join-Path $signingDirectory "pora-dom-release.jks"
$propertiesPath = Join-Path $androidRoot "keystore.properties"
$recoveryPath = Join-Path $secretDirectory "keystore-recovery.txt"

if ((Test-Path -LiteralPath $keystorePath) -or (Test-Path -LiteralPath $propertiesPath)) {
    throw "Release signing files already exist. They were not overwritten."
}

$keytoolCommand = Get-Command keytool -ErrorAction SilentlyContinue
$javaHomeKeytool = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\keytool.exe" } else { "" }
$keytool = if ($keytoolCommand) {
    $keytoolCommand.Source
} elseif ($javaHomeKeytool -and (Test-Path -LiteralPath $javaHomeKeytool)) {
    $javaHomeKeytool
} else {
    throw "keytool was not found in PATH or JAVA_HOME."
}
$characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%_-"
$randomBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
$password = -join ($randomBytes | ForEach-Object { $characters[$_ % $characters.Length] })

New-Item -ItemType Directory -Force -Path $signingDirectory, $secretDirectory | Out-Null

& $keytool -genkeypair -v `
    -keystore $keystorePath `
    -storepass $password `
    -keypass $password `
    -alias $Alias `
    -keyalg RSA `
    -keysize 4096 `
    -validity 10000 `
    -dname $DistinguishedName

if ($LASTEXITCODE -ne 0) { throw "keytool failed with exit code $LASTEXITCODE" }

$relativeStorePath = "signing/pora-dom-release.jks"
$properties = @(
    "storeFile=$relativeStorePath"
    "storePassword=$password"
    "keyAlias=$Alias"
    "keyPassword=$password"
) -join [Environment]::NewLine
[System.IO.File]::WriteAllText($propertiesPath, $properties + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

$recovery = @(
    "ПОРА: ДОМ — КЛЮЧ ПОДПИСИ ANDROID"
    "Создан: $([DateTimeOffset]::Now.ToString('yyyy-MM-dd HH:mm:ss zzz'))"
    "Keystore: $keystorePath"
    "Alias: $Alias"
    "Password: $password"
    ""
    "Потеря этого файла и keystore не позволит выпускать обновления приложения."
    "Скопируйте оба файла в два независимых защищённых хранилища."
) -join [Environment]::NewLine
[System.IO.File]::WriteAllText($recoveryPath, $recovery + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

Write-Host "Release keystore created successfully."
Write-Host "Keystore: $keystorePath"
Write-Host "Recovery information: $recoveryPath"
Write-Host "The password was intentionally not printed."
