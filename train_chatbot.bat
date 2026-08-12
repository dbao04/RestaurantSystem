@echo off
REM Huan luyen bo phan loai y dinh cua chatbot va in bang so sanh mo hinh.
REM Bang in ra dung truc tiep cho phan thuc nghiem trong bao cao.
title Huan luyen chatbot
cd /d %~dp0
python -m ml_service.chatbot.train
pause
