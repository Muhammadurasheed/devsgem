@echo off
REM DevGem Backend Starter
REM Fixes Windows console encoding for Unicode output

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
chcp 65001 > nul

echo Starting DevGem Backend...
python app.py
