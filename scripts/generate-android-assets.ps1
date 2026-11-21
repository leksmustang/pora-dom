$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot "assets\icon-512.png"
$resourceRoot = Join-Path $projectRoot "android\app\src\main\res"
$brandColor = [System.Drawing.ColorTranslator]::FromHtml("#123F3A")
$source = [System.Drawing.Image]::FromFile($sourcePath)

function Save-ScaledPng([string]$Path, [int]$Width, [int]$Height, [double]$Scale = 1.0, [bool]$BrandBackground = $false) {
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bitmap.SetResolution(96, 96)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        if ($BrandBackground) { $graphics.Clear($brandColor) } else { $graphics.Clear([System.Drawing.Color]::Transparent) }
        $targetSize = [int]([Math]::Min($Width, $Height) * $Scale)
        $x = [int](($Width - $targetSize) / 2)
        $y = [int](($Height - $targetSize) / 2)
        $graphics.DrawImage($source, $x, $y, $targetSize, $targetSize)
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$densitySizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($entry in $densitySizes.GetEnumerator()) {
    $directory = Join-Path $resourceRoot $entry.Key
    Save-ScaledPng (Join-Path $directory "ic_launcher.png") $entry.Value $entry.Value
    Save-ScaledPng (Join-Path $directory "ic_launcher_round.png") $entry.Value $entry.Value
    $foregroundSize = [int]($entry.Value * 2.25)
    Save-ScaledPng (Join-Path $directory "ic_launcher_foreground.png") $foregroundSize $foregroundSize 0.68 $true
}

Get-ChildItem $resourceRoot -Recurse -Filter "splash.png" | ForEach-Object {
    $existing = [System.Drawing.Image]::FromFile($_.FullName)
    try { $width = $existing.Width; $height = $existing.Height } finally { $existing.Dispose() }
    Save-ScaledPng $_.FullName $width $height 0.28 $true
}

$source.Dispose()
Write-Host "Android launcher and splash assets generated from assets/icon-512.png."
