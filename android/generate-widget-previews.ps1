$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$output = Join-Path $PSScriptRoot 'res/drawable-nodpi'
New-Item -ItemType Directory -Path $output -Force | Out-Null
function Round-Path([float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
  $path=[Drawing.Drawing2D.GraphicsPath]::new();$d=$r*2
  $path.AddArc($x,$y,$d,$d,180,90);$path.AddArc(($x+$w-$d),$y,$d,$d,270,90)
  $path.AddArc(($x+$w-$d),($y+$h-$d),$d,$d,0,90);$path.AddArc($x,($y+$h-$d),$d,$d,90,90);$path.CloseFigure();return $path
}
foreach ($wide in @($false,$true)) {
  $width = if ($wide) { 700 } else { 460 }
  $height = if ($wide) { 340 } else { 460 }
  $bitmap = [Drawing.Bitmap]::new($width,$height)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([Drawing.Color]::White)
  $font = [Drawing.Font]::new('Microsoft YaHei',22,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
  $small = [Drawing.Font]::new('Microsoft YaHei',18,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
  $ink = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#333333'))
  $muted = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#85878b'))
  $accent = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#c86b48'))
  $groupWidth=$width-80;$segmentWidth=($groupWidth-8)/3
  $group=Round-Path 14 14 $groupWidth 48 10;$selected=Round-Path 18 18 $segmentWidth 40 7
  $border=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#e9ebef'),1)
  $graphics.DrawPath($border,$group);$graphics.FillPath($accent,$selected)
  $center=[Drawing.StringFormat]::new();$center.Alignment=[Drawing.StringAlignment]::Center;$center.LineAlignment=[Drawing.StringAlignment]::Center
  $graphics.DrawString('总览',$small,[Drawing.Brushes]::White,[Drawing.RectangleF]::new(18,18,$segmentWidth,40),$center)
  $graphics.DrawString('5h',$small,$ink,[Drawing.RectangleF]::new((18+$segmentWidth),18,$segmentWidth,40),$center)
  $graphics.DrawString('7d',$small,$ink,[Drawing.RectangleF]::new((18+$segmentWidth*2),18,$segmentWidth,40),$center)
  $refresh=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#555555'),3);$graphics.DrawArc($refresh,($width-50),25,24,24,20,300);$graphics.DrawLine($refresh,($width-25),25,($width-25),35);$graphics.DrawLine($refresh,($width-25),35,($width-35),35)
  $diameter = if ($wide) { 200 } else { 188 }
  $top = ($height-$diameter)/2+18
  $track = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#eeeae6'),26)
  $green = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#389e0d'),26)
  $amber = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#d48806'),26)
  foreach ($pen in @($green,$amber)) { $pen.StartCap=[Drawing.Drawing2D.LineCap]::Round; $pen.EndCap=[Drawing.Drawing2D.LineCap]::Round }
  $graphics.DrawEllipse($track,24,$top,$diameter,$diameter)
  $graphics.DrawArc($green,24,$top,$diameter,$diameter,-90,104)
  $graphics.DrawEllipse($track,53,($top+29),($diameter-58),($diameter-58))
  $graphics.DrawArc($amber,53,($top+29),($diameter-58),($diameter-58),-90,245)
  $left = $diameter+52
  $graphics.DrawString('5h  01:24  29%',$small,$ink,$left,($top+20))
  $graphics.DrawString('12.4M Token',$small,$muted,$left,($top+55))
  $graphics.DrawString('7d  4d20h  68%',$small,$ink,$left,($top+106))
  $graphics.DrawString('80.2M Token',$small,$muted,$left,($top+141))
  $graphics.DrawString('SubWatch',$small,$muted,($width-118),($height-30))
  $name = if ($wide) { 'widget_preview_wide.png' } else { 'widget_preview_compact.png' }
  $bitmap.Save((Join-Path $output $name),[Drawing.Imaging.ImageFormat]::Png)
  foreach ($resource in @($track,$green,$amber,$font,$small,$ink,$muted,$accent,$graphics,$bitmap,$group,$selected,$border,$center,$refresh)) { $resource.Dispose() }
}
