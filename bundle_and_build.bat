@echo off
set JAVA_HOME=G:\Uschat\jdk17\jdk-17.0.10+7
set ANDROID_HOME=G:\Uschat\android-sdk
set GRADLE_USER_HOME=G:\Uschat\.gradle
set PATH=%JAVA_HOME%\bin;%PATH%

cd /d G:\Uschat\frontend

echo Cleaning old assets...
if exist "android\app\src\main\assets\index.android.bundle" del /f /q "android\app\src\main\assets\index.android.bundle"
if not exist "android\app\src\main\assets" mkdir "android\app\src\main\assets"

echo Bundling Standalone Offline JavaScript assets...
call node node_modules/react-native/cli.js bundle --platform android --dev false --entry-file node_modules/expo/AppEntry.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res --reset-cache

cd /d G:\Uschat\frontend\android
echo Cleaning and Assembling Standalone Offline APK...
call gradlew.bat clean assembleDebug

echo Copying APK to G:\Uschat\uschat.apk and uploads directory...
if not exist "G:\Uschat\uploads" mkdir "G:\Uschat\uploads"
copy /y G:\Uschat\frontend\android\app\build\outputs\apk\debug\app-debug.apk G:\Uschat\uschat.apk
copy /y G:\Uschat\frontend\android\app\build\outputs\apk\debug\app-debug.apk G:\Uschat\uploads\uschat.apk
