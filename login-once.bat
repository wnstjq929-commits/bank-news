@echo off
chcp 65001 >nul
set "CLAUDE="
for /f "delims=" %%v in ('dir /b /a:d /o-n "%APPDATA%\Claude\claude-code" 2^>nul') do if not defined CLAUDE set "CLAUDE=%APPDATA%\Claude\claude-code\%%v\claude.exe"
if not defined CLAUDE ( echo claude.exe 를 찾지 못했습니다. & pause & exit /b )
echo ================================================================
echo  매일 자동 AI 분석을 켜려면 이 창에서 한 번만 로그인하면 됩니다.
echo  Claude Code가 열리면  /login  을 입력하고 안내에 따라 로그인하세요.
echo  로그인이 끝나면 이 창을 닫으면 됩니다.
echo ================================================================
echo.
"%CLAUDE%"