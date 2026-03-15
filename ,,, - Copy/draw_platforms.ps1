Add-Type -AssemblyName System.Drawing

$mapPath = '.\Megabonk map.png'
$outPath = '.\Megabonk map.png'

$img = [System.Drawing.Image]::FromFile($mapPath)
$bmp = New-Object System.Drawing.Bitmap($img)
$img.Dispose()

$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 0, 255, 0))
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 255, 0), 2)

$platforms = @(
    @{ Name="Main Floor"; X1=0; Y1=3; X2=31; Y2=4 },
    @{ Name="Bottom Left"; X1=0; Y1=4; X2=4; Y2=6 },
    @{ Name="Bottom Right"; X1=27; Y1=4; X2=31; Y2=6 },
    @{ Name="Middle Left"; X1=2; Y1=9; X2=10; Y2=11 },
    @{ Name="Middle Right"; X1=21; Y1=9; X2=29; Y2=11 },
    @{ Name="Center Platform"; X1=10; Y1=13; X2=21; Y2=15 },
    @{ Name="Top Platform"; X1=13; Y1=19; X2=18; Y2=21 }
)

foreach ($p in $platforms) {
    # 1 cell = 32 pixels
    $x = $p.X1 * 32
    $y = 1024 - ($p.Y2 * 32) - 16 # shifted 16 pixels higher
    $w = ($p.X2 - $p.X1) * 32
    $h = ($p.Y2 - $p.Y1) * 32
    
    $rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
    $graphics.FillRectangle($brush, $rect)
    $graphics.DrawRectangle($pen, $rect)
}

$graphics.Dispose()
$brush.Dispose()
$pen.Dispose()

$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Successfully added platforms to $outPath"
