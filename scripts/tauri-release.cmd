@echo off
setlocal EnableExtensions

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "VSINSTALL="
if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSINSTALL=%%i"
)
if not defined VSINSTALL set "VSINSTALL=%ProgramFiles%\Microsoft Visual Studio\2022\Community"

set "VCDIR="
for /f "delims=" %%d in ('dir /b /ad /o-n "%VSINSTALL%\VC\Tools\MSVC" 2^>nul') do (
  set "VCDIR=%VSINSTALL%\VC\Tools\MSVC\%%d"
  goto :havevc
)
:havevc
if not exist "%VCDIR%\lib\x64\" (
  echo ERROR: MSVC libs not found. Install "Desktop development with C++".
  exit /b 1
)

call "%VSINSTALL%\Common7\Tools\VsDevCmd.bat" -arch=amd64 -host_arch=amd64 || exit /b 1
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
set "LIB=%VCDIR%\lib\x64;%LIB%"

cd /d "%~dp0.." || exit /b 1
npm run tauri build %*
exit /b %ERRORLEVEL%
