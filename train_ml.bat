@echo off
REM Huan luyen lai toan bo mo hinh va in bang chi so danh gia (dung cho bao cao)
title Huan luyen mo hinh AI/ML
cd /d %~dp0
python -m ml_service.train
pause
