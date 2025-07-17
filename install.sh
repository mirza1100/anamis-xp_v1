#!/bin/bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# نصب پیش‌نیازها
apt update && apt install -y curl wget git sudo lsb-release ca-certificates gnupg python3 python3-pip python3-venv iptables net-tools

# نصب Node.js
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
fi

# نصب Docker
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

# نصب Xray
if [ ! -f /usr/local/bin/xray ]; then
  bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
fi

# نصب OpenVPN
if ! command -v openvpn >/dev/null 2>&1; then
  apt install -y openvpn
fi

# نصب WireGuard
if ! command -v wg >/dev/null 2>&1; then
  apt install -y wireguard
fi

# نصب وابستگی‌های وب
cd web
npm install --production
cd ..

# کپی فایل‌های config نمونه اگر وجود ندارند
mkdir -p /etc/xray /etc/openvpn /etc/wireguard /var/log/xray /var/log/anamis-xp
[ -f /etc/xray/config.json ] || cp cores/xray/config.json /etc/xray/config.json
[ -f /etc/openvpn/server.conf ] || cp cores/openvpn/server.conf /etc/openvpn/server.conf
[ -f /etc/wireguard/wg0.conf ] || cp cores/wireguard/wg0.conf /etc/wireguard/wg0.conf

# کپی فایل سرویس systemd
cp systemd/anamis-xp.service /etc/systemd/system/anamis-xp.service
systemctl daemon-reload
systemctl enable anamis-xp

# مجوز اجرایی به CLI
chmod +x cli/anamis-xp
ln -sf /opt/anamis-xp/cli/anamis-xp /usr/local/bin/anamis-xp

# نصب SSH
if ! command -v sshd >/dev/null 2>&1; then
  apt install -y openssh-server
fi
mkdir -p /etc/ssh
[ -f /etc/ssh/sshd_config ] || cp cores/ssh/sshd_config /etc/ssh/sshd_config
systemctl enable ssh
systemctl restart ssh

# راه‌اندازی سرویس
systemctl restart anamis-xp

# پیام موفقیت
IP=$(curl -s ifconfig.me || echo 'localhost')
echo -e "\n${GREEN}✅ نصب و راه‌اندازی با موفقیت انجام شد!${NC}"
echo "آدرس پنل: http://$IP:3000"
echo "یوزر: admin"
echo "پسورد: admin123"
echo "برای مدیریت CLI: anamis-xp"
echo "---------------------------------------------"