@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 최신 은행 뉴스를 수집하고 분석하는 중입니다. 잠시만 기다려 주세요...
node fetch_news.js
node make_pending.js
set "CLAUDE="
for /f "delims=" %%v in ('dir /b /a:d /o-n "%APPDATA%\Claude\claude-code" 2^>nul') do if not defined CLAUDE set "CLAUDE=%APPDATA%\Claude\claude-code\%%v\claude.exe"
if defined CLAUDE (
  echo AI 분석 생성 중... 기사 수에 따라 다소 걸릴 수 있습니다.
  "%CLAUDE%" -p "@daily_prompt.md" --dangerously-skip-permissions --allowedTools Read Write Edit Bash Glob
) else (
  echo [알림] 로컬 Claude 로그인이 안 되어 있어 AI 분석은 건너뜁니다. login-once.bat 로 1회 로그인하세요.
)
node fetch_news.js --build-only
echo.
echo 갱신 완료! 대시보드를 엽니다.
start "" "index.html"