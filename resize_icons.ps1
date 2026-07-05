Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "logo.png"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source file logo.png not found"
    exit
}

$srcImg = [System.Drawing.Image]::FromFile($sourcePath)
Write-Host "Loaded logo.png: Width=$($srcImg.Width), Height=$($srcImg.Height)"

$targets = @(
    @{ file = "favicon-32x32.png"; width = 32; height = 32 }
    @{ file = "favicon-48x48.png"; width = 48; height = 48 }
    @{ file = "favicon-96x96.png"; width = 96; height = 96 }
    @{ file = "favicon-144x144.png"; width = 144; height = 144 }
    @{ file = "icon-192.png"; width = 192; height = 192 }
    @{ file = "icon-512.png"; width = 512; height = 512 }
    @{ file = "favicon.png"; width = 512; height = 512 }
    @{ file = "favicon.ico"; width = 48; height = 48 }
)

foreach ($target in $targets) {
    $destPath = Join-Path $PSScriptRoot $target.file
    Write-Host "Resizing to $($target.width)x$($target.height) -> $($target.file)..."
    
    # Remove existing file if it exists to avoid conflicts
    if (Test-Path $destPath) {
        Remove-Item $destPath -Force
    }
    
    $bmp = New-Object System.Drawing.Bitmap($target.width, $target.height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Set high quality settings
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $g.DrawImage($srcImg, 0, 0, $target.width, $target.height)
    $g.Dispose()
    
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  Saved $($target.file) ($( (Get-Item $destPath).Length ) bytes)"
}

$srcImg.Dispose()
Write-Host "Done!"
