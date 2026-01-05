@echo off
chcp 65001 > nul
echo Wrapping text lines to 52 characters...
echo.
bun run src/wrap-text-lines.ts
echo.
echo Press any key to exit...
pause > nul
