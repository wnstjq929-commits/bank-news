@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 은행 뉴스 웹서버를 시작합니다. 브라우저가 자동으로 열립니다.
echo (종료하려면 이 창에서 Ctrl+C)
timeout /t 1 >nul
start "" "http://localhost:8787"
node server.js