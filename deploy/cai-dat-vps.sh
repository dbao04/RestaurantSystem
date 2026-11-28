#!/usr/bin/env bash
# =============================================================================
#  CAI DAT TOAN BO HE THONG NHA HANG LEN MOT VPS UBUNTU 22.04 / 24.04 MOI
#
#  Chay voi quyen root, SAU KHI da tai goi du lieu (deploy-goi.zip) len /root:
#
#     bash cai-dat-vps.sh <ten-mien> <email-nhan-thong-bao-ssl>
#     vd: bash cai-dat-vps.sh nhahangbaodoan.vn ban@gmail.com
#
#  Script lam het: Node 24, MariaDB, nginx, Python + dich vu AI, pm2, chung chi
#  HTTPS (Let's Encrypt), tuong lua, sao luu CSDL hang dem. Chay lai lan hai
#  khong hong gi (moi buoc deu kiem tra da lam chua).
# =============================================================================
set -euo pipefail

TEN_MIEN="${1:?Thieu ten mien. vd: bash cai-dat-vps.sh nhahangbaodoan.vn ban@gmail.com}"
EMAIL_SSL="${2:?Thieu email nhan thong bao chung chi SSL}"
REPO="${REPO:-https://github.com/dbao04/RestaurantSystem.git}"
NHANH="${NHANH:-main}"
NGUOI_CHAY="nhahang"                 # user he thong chay ung dung (khong chay bang root)
THU_MUC="/home/$NGUOI_CHAY/app"
GOI="${GOI:-/root/deploy-goi.zip}"   # goi du lieu tao bang deploy/dong-goi-du-lieu.ps1
DB_TEN="gs_restaurant"
DB_USER="nhahang"

buoc() { echo; echo "==> $*"; }
[ "$(id -u)" -eq 0 ] || { echo "Can chay bang root (sudo -i)"; exit 1; }
[ -f "$GOI" ] || { echo "Khong thay $GOI - tai goi du lieu len truoc (xem HUONG_DAN_DEPLOY.md)"; exit 1; }

buoc "1/9 Cai goi he thong"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git unzip nginx mariadb-server python3-venv python3-pip \
  libgl1 libglib2.0-0 ufw certbot python3-certbot-nginx
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2
timedatectl set-timezone Asia/Ho_Chi_Minh || true
# May mien phi it RAM (vd Oracle E2.1.Micro 1GB): them 2GB swap de pip/npm
# va dich vu AI khong bi he dieu hanh giet vi het bo nho.
RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$RAM_MB" -lt 3000 ] && ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

buoc "2/9 Tao user he thong '$NGUOI_CHAY'"
id "$NGUOI_CHAY" >/dev/null 2>&1 || useradd -m -s /bin/bash "$NGUOI_CHAY"

buoc "3/9 Lay ma nguon ($REPO, nhanh $NHANH)"
if [ -d "$THU_MUC/.git" ]; then
  sudo -u "$NGUOI_CHAY" git -C "$THU_MUC" fetch origin "$NHANH"
  sudo -u "$NGUOI_CHAY" git -C "$THU_MUC" checkout "$NHANH"
  sudo -u "$NGUOI_CHAY" git -C "$THU_MUC" pull --ff-only origin "$NHANH"
else
  sudo -u "$NGUOI_CHAY" git clone --branch "$NHANH" "$REPO" "$THU_MUC"
fi
cd "$THU_MUC"
sudo -u "$NGUOI_CHAY" npm ci --omit=dev

buoc "4/9 Giai nen goi du lieu"
TAM=$(mktemp -d)
unzip -q -o "$GOI" -d "$TAM"
[ -f "$TAM/gs_restaurant.sql" ] || { echo "Goi thieu gs_restaurant.sql"; exit 1; }

buoc "5/9 MariaDB: tao CSDL, tai khoan rieng, nap du lieu"
systemctl enable --now mariadb
# Cau hinh InnoDB du lon (ban XAMPP mac dinh 16MB / log 5MB tung gay crash).
# Bo dem = 1/4 RAM, toi da 512MB (may 1GB -> 256MB).
BP_MB=$(( RAM_MB / 4 )); [ "$BP_MB" -gt 512 ] && BP_MB=512; [ "$BP_MB" -lt 128 ] && BP_MB=128
cat > /etc/mysql/mariadb.conf.d/60-nhahang.cnf <<CNF
[mysqld]
innodb_buffer_pool_size = ${BP_MB}M
innodb_log_file_size    = 128M
max_allowed_packet      = 64M
character-set-server    = utf8mb4
collation-server        = utf8mb4_unicode_ci
bind-address            = 127.0.0.1
CNF
systemctl restart mariadb
if [ -f /root/.nhahang_db_pass ]; then
  DB_PASS=$(cat /root/.nhahang_db_pass)
else
  DB_PASS=$(openssl rand -hex 20); echo "$DB_PASS" > /root/.nhahang_db_pass; chmod 600 /root/.nhahang_db_pass
fi
mysql -e "CREATE DATABASE IF NOT EXISTS $DB_TEN CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_TEN.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;"
SO_BANG=$(mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_TEN'")
if [ "$SO_BANG" -eq 0 ]; then
  mysql "$DB_TEN" < "$TAM/gs_restaurant.sql"
  echo "   da nap $(mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_TEN'") bang"
else
  echo "   CSDL da co $SO_BANG bang - KHONG nap de (muon nap lai: xoa CSDL truoc)"
fi

buoc "6/9 File .env, du lieu khuon mat, mo hinh AI"
if [ ! -f "$THU_MUC/.env" ]; then
  cp "$THU_MUC/.env.example" "$THU_MUC/.env"
  dat() { if grep -q "^$1=" "$THU_MUC/.env"; then sed -i "s|^$1=.*|$1=$2|" "$THU_MUC/.env"; else echo "$1=$2" >> "$THU_MUC/.env"; fi; }
  dat DB_HOST localhost; dat DB_PORT 3306; dat DB_USER "$DB_USER"; dat DB_PASS "$DB_PASS"; dat DB_NAME "$DB_TEN"
  dat PORT 3000; dat NODE_ENV production; dat SESSION_SECRET "$(openssl rand -hex 32)"
  dat BAT_HTTPS 0; dat TRUST_PROXY ""; dat PAYMENT_SIMULATION 0; dat PAYMENT_SIMULATION_KHACH 0
  dat APP_URL "https://$TEN_MIEN"; dat QR_BASE_URL "https://$TEN_MIEN"
  # Thong tin email / ngan hang tu may cu (neu goi co kem).
  if [ -f "$TAM/env-giu-lai.txt" ]; then
    while IFS='=' read -r k v; do [ -n "$k" ] && dat "$k" "$v"; done < "$TAM/env-giu-lai.txt"
  fi
fi
chmod 600 "$THU_MUC/.env"
[ -d "$TAM/du_lieu_khuon_mat" ] && cp -rn "$TAM/du_lieu_khuon_mat" "$THU_MUC/" || true
[ -d "$TAM/mo_hinh_khuon_mat" ] && mkdir -p "$THU_MUC/ml_service/mo_hinh_khuon_mat" && cp -n "$TAM/mo_hinh_khuon_mat/"* "$THU_MUC/ml_service/mo_hinh_khuon_mat/" || true
[ -d "$TAM/uploads" ] && mkdir -p "$THU_MUC/public/uploads" && cp -rn "$TAM/uploads/." "$THU_MUC/public/uploads/" || true
chown -R "$NGUOI_CHAY:$NGUOI_CHAY" "$THU_MUC"
rm -rf "$TAM"

buoc "7/9 Dich vu AI (Python) va web (pm2)"
if [ ! -d "$THU_MUC/.venv" ]; then sudo -u "$NGUOI_CHAY" python3 -m venv "$THU_MUC/.venv"; fi
sudo -u "$NGUOI_CHAY" "$THU_MUC/.venv/bin/pip" install -q --upgrade pip
sudo -u "$NGUOI_CHAY" "$THU_MUC/.venv/bin/pip" install -q -r "$THU_MUC/ml_service/requirements.txt"
sudo -u "$NGUOI_CHAY" bash -c "cd '$THU_MUC' && pm2 startOrReload deploy/ecosystem.config.js && pm2 save"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$NGUOI_CHAY" --hp "/home/$NGUOI_CHAY" >/dev/null

buoc "8/9 nginx + HTTPS cho $TEN_MIEN"
sed "s/__TEN_MIEN__/$TEN_MIEN/g" "$THU_MUC/deploy/nginx.conf" > /etc/nginx/sites-available/nhahang
ln -sf /etc/nginx/sites-available/nhahang /etc/nginx/sites-enabled/nhahang
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
# Anh Ubuntu cua Oracle Cloud da co san luat iptables chan moi cong tru 22 va
# khuyen KHONG dung ufw (xung dot). Nhan ra bang file rules.v4 co REJECT.
if [ -f /etc/iptables/rules.v4 ] && grep -q REJECT /etc/iptables/rules.v4; then
  for CONG in 80 443; do
    iptables -C INPUT -p tcp --dport $CONG -m state --state NEW -j ACCEPT 2>/dev/null \
      || iptables -I INPUT 6 -p tcp --dport $CONG -m state --state NEW -j ACCEPT
  done
  netfilter-persistent save >/dev/null 2>&1 || iptables-save > /etc/iptables/rules.v4
  echo "   (Oracle Cloud) da mo cong 80/443 trong iptables - nho mo ca trong Security List cua VCN"
else
  ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null
fi
certbot --nginx -d "$TEN_MIEN" -d "www.$TEN_MIEN" --non-interactive --agree-tos -m "$EMAIL_SSL" --redirect \
  || certbot --nginx -d "$TEN_MIEN" --non-interactive --agree-tos -m "$EMAIL_SSL" --redirect \
  || echo "   !! Chua lay duoc chung chi - kiem tra ban ghi DNS A da tro ve IP may nay chua, roi chay lai script."

buoc "9/9 Sao luu CSDL moi dem (giu 14 ngay)"
install -m 700 "$THU_MUC/deploy/sao-luu.sh" /usr/local/bin/nhahang-sao-luu
echo "0 2 * * * root /usr/local/bin/nhahang-sao-luu" > /etc/cron.d/nhahang-sao-luu

echo
echo "================================================================"
echo " XONG. Mo trinh duyet: https://$TEN_MIEN"
echo " Mat khau CSDL luu o /root/.nhahang_db_pass"
echo " Xem log web : sudo -u $NGUOI_CHAY pm2 logs nhahang"
echo " Cap nhat code: bash $THU_MUC/deploy/cap-nhat.sh"
echo "================================================================"
