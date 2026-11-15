#!/usr/bin/env bash
# Cap nhat code moi tu GitHub len VPS: sao luu -> pull -> cai goi -> khoi dong lai.
# Chay bang root:  bash /home/nhahang/app/deploy/cap-nhat.sh
set -euo pipefail
APP=/home/nhahang/app
/usr/local/bin/nhahang-sao-luu
sudo -u nhahang git -C "$APP" pull --ff-only
sudo -u nhahang bash -c "cd '$APP' && npm ci --omit=dev && .venv/bin/pip install -q -r ml_service/requirements.txt && pm2 startOrReload deploy/ecosystem.config.js && pm2 save"
echo "Da cap nhat. Log: sudo -u nhahang pm2 logs nhahang"
