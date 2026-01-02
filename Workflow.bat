@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

title Eve Burst Error Translation Tool

:menu
cls
echo ========================================
echo   Eve Burst Error Translation Tool
echo ========================================
echo.
echo Available Commands:
echo.
echo   [d] Decompress Japanese CC files
echo   [c] Compress English CC files
echo   [e] Extract Japanese text
echo   [i] Inject English text
echo   [h] Import CC files to HDI image
echo   [a] Run all (Inject + Compress + Import to HDI)
echo   [q] Quit
echo.
set /p choice="Enter your choice (d/c/e/i/h/a/q): "

if /i "%choice%"=="d" goto decompress
if /i "%choice%"=="c" goto compress
if /i "%choice%"=="e" goto extract
if /i "%choice%"=="i" goto inject
if /i "%choice%"=="h" goto hdi
if /i "%choice%"=="a" goto all
if /i "%choice%"=="q" goto end
if /i "%choice%"=="0" goto end

echo.
echo Invalid choice! Please try again.
pause
goto menu

:decompress
echo.
echo ========================================
echo   Decompressing Japanese CC Files
echo ========================================
echo.
bun start d
echo.
pause
goto menu

:compress
echo.
echo ========================================
echo   Compressing English CC Files
echo ========================================
echo.
bun start c
echo.
pause
goto menu

:extract
echo.
echo ========================================
echo   Extracting Japanese Text
echo ========================================
echo.
bun start e
echo.
pause
goto menu

:inject
echo.
echo ========================================
echo   Injecting English Text
echo ========================================
echo.
bun start i
echo.
pause
goto menu

:hdi
echo.
echo ========================================
echo   Importing CC Files to HDI Image
echo ========================================
echo.
bun start h
echo.
pause
goto menu

:all
echo.
echo ========================================
echo   Running All Commands
echo   (Inject + Compress + HDI Import)
echo ========================================
echo.
bun all
echo.
pause
goto menu

:end
cls
echo.
echo ========================================
echo   Thank you for using!
echo ========================================
echo.
timeout /t 2 >nul
exit
