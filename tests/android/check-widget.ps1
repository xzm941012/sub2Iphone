param([string]$Serial='emulator-5556',[string]$SdkRoot=$env:ANDROID_SDK_ROOT,[string]$JdkRoot=$env:JAVA_HOME)
$ErrorActionPreference='Stop'
if (!$Serial.StartsWith('emulator-')) { throw 'Use an emulator: this fixture must never access the user phone.' }
$project=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$build=Join-Path $project 'android/build/widget-qa'
if (!$SdkRoot) { $SdkRoot=$env:ANDROID_HOME }
if (!$SdkRoot -or !$JdkRoot -or !$env:SUBWATCH_KEYSTORE_PASSWORD) { throw 'Set ANDROID_SDK_ROOT, JAVA_HOME and SUBWATCH_KEYSTORE_PASSWORD.' }
$jdk=$JdkRoot;$tools=Join-Path $SdkRoot 'build-tools/36.0.0';$platform=Join-Path $SdkRoot 'platforms/android-36/android.jar'
$adb=Join-Path $SdkRoot 'platform-tools/adb.exe'
$env:JAVA_HOME=$jdk;$env:PATH=(Join-Path $jdk 'bin')+';'+$env:PATH
function Checked([string]$Exe,[string[]]$Arguments){& $Exe @Arguments;if($LASTEXITCODE-ne 0){throw "$Exe failed"}}
New-Item -ItemType Directory -Path $build,(Join-Path $build 'classes'),(Join-Path $build 'dex') -Force | Out-Null
Checked (Join-Path $tools 'aapt2.exe') @('link','-o',(Join-Path $build 'unsigned.apk'),'--manifest',(Join-Path $PSScriptRoot 'AndroidManifest.xml'),'-I',$platform,(Join-Path $project 'android/build/resources.zip'))
Checked (Join-Path $jdk 'bin/javac.exe') @('-encoding','UTF-8','-source','8','-target','8','-classpath',($platform+';'+(Join-Path $project 'android/build/classes.jar')),'-d',(Join-Path $build 'classes'),(Join-Path $PSScriptRoot 'WidgetRenderCheck.java'),(Join-Path $PSScriptRoot 'WidgetThemeCheck.java'))
Copy-Item -LiteralPath (Join-Path $project 'android/build/classes.jar') -Destination (Join-Path $build 'classes.jar') -Force
Checked (Join-Path $jdk 'bin/jar.exe') @('--update','--file',(Join-Path $build 'classes.jar'),'-C',(Join-Path $build 'classes'),'.')
Checked (Join-Path $tools 'd8.bat') @('--release','--min-api','26','--lib',$platform,'--output',(Join-Path $build 'dex'),(Join-Path $build 'classes.jar'))
Checked (Join-Path $jdk 'bin/jar.exe') @('--update','--file',(Join-Path $build 'unsigned.apk'),'-C',(Join-Path $build 'dex'),'classes.dex')
Checked (Join-Path $tools 'zipalign.exe') @('-f','-p','4',(Join-Path $build 'unsigned.apk'),(Join-Path $build 'aligned.apk'))
$key=if($env:SUBWATCH_KEYSTORE_PATH){$env:SUBWATCH_KEYSTORE_PATH}else{Join-Path $env:LOCALAPPDATA 'OnememUsage/signing/local-release.jks'}
Checked (Join-Path $tools 'apksigner.bat') @('sign','--ks',$key,'--ks-key-alias','usage','--ks-pass','env:SUBWATCH_KEYSTORE_PASSWORD','--key-pass','env:SUBWATCH_KEYSTORE_PASSWORD','--out',(Join-Path $build 'check.apk'),(Join-Path $build 'aligned.apk'))
Checked $adb @('-s',$Serial,'install','-r',(Join-Path $build 'check.apk'))
Checked $adb @('-s',$Serial,'shell','am','force-stop','cc.onemem.usage.qa')
$run=[guid]::NewGuid().ToString('N')
Checked $adb @('-s',$Serial,'shell','am','start','-W','-n','cc.onemem.usage.qa/cc.onemem.usage.WidgetRenderCheck','--es','run',$run)
Start-Sleep -Milliseconds 1500
$result=& $adb -s $Serial logcat -d -s 'SubWatchWidgetQA:I' '*:S'
$result | Select-Object -Last 20
if (!($result -match ('PASS: '+$run))) { throw 'Native widget rendering check did not pass.' }
Checked $adb @('-s',$Serial,'shell','am','start','-W','-n','cc.onemem.usage.qa/cc.onemem.usage.WidgetThemeCheck','--es','run',$run)
Start-Sleep -Milliseconds 1000
$themeResult=& $adb -s $Serial logcat -d -s 'SubWatchWidgetQA:I' '*:S'
$themeResult | Select-Object -Last 10
if (!($themeResult -match ('THEME PASS: '+$run))) { throw 'Native widget theme check did not pass.' }
Checked $adb @('-s',$Serial,'pull','/sdcard/Android/data/cc.onemem.usage.qa/files', (Join-Path $project 'qa/widget-native'))
