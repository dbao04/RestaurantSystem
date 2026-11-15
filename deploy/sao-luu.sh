#!/usr/bin/env bash
# Sao luu CSDL + du lieu khuon mat / anh tai len. cron chay moi dem 2:00.
set -euo pipefail
THU_MUC_SL=/var/backups/nhahang
APP=/home/nhahang/app
mkdir -p "$THU_MUC_SL"; chmod 700 "$THU_MUC_SL"
NGAY=$(date +%F)
mysqldump --single-transaction --routines --triggers gs_restaurant | gzip > "$THU_MUC_SL/db_$NGAY.sql.gz"
tar -czf "$THU_MUC_SL/files_$NGAY.tar.gz" -C "$APP" du_lieu_khuon_mat public/uploads 2>/dev/null || true
find "$THU_MUC_SL" -type f -mtime +14 -delete
