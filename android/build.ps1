param([string]$SdkRoot = $env:ANDROID_SDK_ROOT,[string]$JdkRoot = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
if (!$SdkRoot) { $SdkRoot = $env:ANDROID_HOME }
if (!$SdkRoot -or !$JdkRoot) { throw 'Set ANDROID_SDK_ROOT (or ANDROID_HOME) and JAVA_HOME, or pass -SdkRoot / -JdkRoot.' }
if (!$env:SUBWATCH_KEYSTORE_PASSWORD) { throw 'Set SUBWATCH_KEYSTORE_PASSWORD locally before building. Never commit the password or keystore.' }
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$android = [IO.Path]::GetFullPath($PSScriptRoot)
$build = [IO.Path]::GetFullPath((Join-Path $android 'build'))
if (!$build.StartsWith($android + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid build output path' }
$tools = Join-Path $SdkRoot 'build-tools\36.0.0'
$platform = Join-Path $SdkRoot 'platforms\android-36\android.jar'
$env:JAVA_HOME = $JdkRoot
$env:PATH = (Join-Path $JdkRoot 'bin') + ';' + $env:PATH
function Invoke-Checked([string]$Exe,[string[]]$Arguments) { & $Exe @Arguments; if ($LASTEXITCODE -ne 0) { throw "$Exe failed ($LASTEXITCODE)" } }
Push-Location $project
try {
  Invoke-Checked 'npm.cmd' @('run','check:runtime')
  Invoke-Checked 'npx.cmd' @('tsc','--noEmit')
  Invoke-Checked 'npx.cmd' @('vite','build','--config','native.vite.config.ts')
  & (Join-Path $android 'generate-widget-previews.ps1')
  if (Test-Path -LiteralPath $build) { Remove-Item -LiteralPath $build -Recurse -Force }
  New-Item -ItemType Directory -Path $build,(Join-Path $build 'classes'),(Join-Path $build 'dex'),(Join-Path $build 'generated') -Force | Out-Null
  Invoke-Checked (Join-Path $tools 'aapt2.exe') @('compile','--dir',(Join-Path $android 'res'),'-o',(Join-Path $build 'resources.zip'))
  Invoke-Checked (Join-Path $tools 'aapt2.exe') @('link','-o',(Join-Path $build 'unsigned.apk'),'--manifest',(Join-Path $android 'AndroidManifest.xml'),'-I',$platform,'--java',(Join-Path $build 'generated'),'-A',(Join-Path $android 'assets'),(Join-Path $build 'resources.zip'))
  $sources = @(Get-ChildItem -LiteralPath (Join-Path $android 'src') -Filter '*.java' -Recurse | ForEach-Object FullName) + @(Get-ChildItem -LiteralPath (Join-Path $build 'generated') -Filter '*.java' -Recurse | ForEach-Object FullName)
  $sourcesArg = Join-Path $build 'sources.txt'
  [IO.File]::WriteAllLines($sourcesArg,($sources | ForEach-Object { '"' + $_.Replace('\','/') + '"' }),[Text.UTF8Encoding]::new($false))
  Invoke-Checked (Join-Path $JdkRoot 'bin\javac.exe') @('-encoding','UTF-8','-source','8','-target','8','-classpath',$platform,'-d',(Join-Path $build 'classes'),('@'+$sourcesArg))
  Invoke-Checked (Join-Path $JdkRoot 'bin\jar.exe') @('--create','--file',(Join-Path $build 'classes.jar'),'-C',(Join-Path $build 'classes'),'.')
  Invoke-Checked (Join-Path $tools 'd8.bat') @('--release','--min-api','26','--lib',$platform,'--output',(Join-Path $build 'dex'),(Join-Path $build 'classes.jar'))
  Invoke-Checked (Join-Path $JdkRoot 'bin\jar.exe') @('--update','--file',(Join-Path $build 'unsigned.apk'),'-C',(Join-Path $build 'dex'),'classes.dex')
  Invoke-Checked 'python.exe' @((Join-Path $android 'normalize-apk.py'),(Join-Path $build 'unsigned.apk'))
  Invoke-Checked (Join-Path $tools 'zipalign.exe') @('-f','-p','4',(Join-Path $build 'unsigned.apk'),(Join-Path $build 'aligned.apk'))
  $keyDir = Join-Path $env:LOCALAPPDATA 'OnememUsage\signing'
  New-Item -ItemType Directory -Path $keyDir -Force | Out-Null
  $key = if ($env:SUBWATCH_KEYSTORE_PATH) { $env:SUBWATCH_KEYSTORE_PATH } else { Join-Path $keyDir 'local-release.jks' }
  if (!(Test-Path -LiteralPath $key)) { Invoke-Checked (Join-Path $JdkRoot 'bin\keytool.exe') @('-genkeypair','-keystore',$key,'-storepass:env','SUBWATCH_KEYSTORE_PASSWORD','-keypass:env','SUBWATCH_KEYSTORE_PASSWORD','-alias','usage','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=SubWatch Local') }
  New-Item -ItemType Directory -Path (Join-Path $project 'releases') -Force | Out-Null
  $apk = Join-Path $project 'releases\SubWatch-1.0.0.apk'
  Invoke-Checked (Join-Path $tools 'apksigner.bat') @('sign','--ks',$key,'--ks-key-alias','usage','--ks-pass','env:SUBWATCH_KEYSTORE_PASSWORD','--key-pass','env:SUBWATCH_KEYSTORE_PASSWORD','--out',$apk,(Join-Path $build 'aligned.apk'))
  Invoke-Checked (Join-Path $tools 'apksigner.bat') @('verify','--verbose',$apk)
  Write-Output "APK: $apk"
} finally { Pop-Location }
