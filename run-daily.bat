@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================ >> update.log
echo [%date% %time%] update start >> update.log
rem 1) 뉴스 수집 + 대시보드 생성 (무료)
node fetch_news.js >> update.log 2>&1
rem 2) 아직 분석 안 된 기사 목록 생성
node make_pending.js >> update.log 2>&1
rem 3) 최신 claude.exe 자동 탐색 후 무인 AI 분석
set "CLAUDE="
for /f "delims=" %%v in ('dir /b /a:d /o-n "%APPDATA%\Claude\claude-code" 2^>nul') do if not defined CLAUDE set "CLAUDE=%APPDATA%\Claude\claude-code\%%v\claude.exe"
if defined CLAUDE (
  echo [%date% %time%] AI 분석 실행 >> update.log
  "%CLAUDE%" -p "@daily_prompt.md" --dangerously-skip-permissions --allowedTools Read Write Edit Bash Glob >> update.log 2>&1
) else (
  echo [%date% %time%] claude.exe 미발견 - AI 건너뜀 >> update.log
)
rem 4) 재수집 없이 분석만 반영해 대시보드 재빌드
node fetch_news.js --build-only >> update.log 2>&1
echo [%date% %time%] update done >> update.log