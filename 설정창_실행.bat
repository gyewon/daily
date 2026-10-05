@echo off
chcp 65001 > nul
title 뱅크샐러드 자동 동기화 설정
echo [뱅크샐러드 메일 자동 동기화 설정창을 실행합니다...]
python "d:\AI App\daily\banksalad_sync.py" --gui
pause
