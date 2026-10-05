@echo off
chcp 65001 > nul
title 뱅크샐러드 실시간 자동 동기화 데몬
echo ===================================================
echo   ⚡ 뱅크샐러드 지메일 실시간 자동 감지 및 업로드 데몬
echo ===================================================
echo.
python "d:\AI App\daily\banksalad_sync.py"
pause
