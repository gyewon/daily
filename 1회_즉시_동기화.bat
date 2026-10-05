@echo off
chcp 65001 > nul
title 뱅크샐러드 즉시 1회 동기화
echo [뱅크샐러드 지메일 즉시 동기화 실행 중...]
python "d:\AI App\daily\banksalad_sync.py" --sync
echo.
echo 동기화 작업이 완료되었습니다. 아무 키나 누르면 창이 닫힙니다.
pause > nul
