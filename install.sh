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

# اگر دایرکتوری web یا cores یا systemd وجود ندارد، کل پروژه را دانلود کن
if [ ! -d web ] || [ ! -d cores ] || [ ! -d systemd ]; then
  echo -e "${RED}برخی دایرکتوری‌های اصلی پروژه (web/cores/systemd) پیدا نشد. در حال دانلود کل پروژه از گیت...${NC}"
  if ! command -v git >/dev/null 2>&1; then
    apt update && apt install -y git
  fi
  if [ -d anamis-xp-tmp ]; then rm -rf anamis-xp-tmp; fi
  git clone https://github.com/mirza1100/anamis-xp_v1.git anamis-xp-tmp
  # کپی همه دایرکتوری‌های اصلی
  for d in web cores config systemd; do
    if [ -d anamis-xp-tmp/$d ]; then
      rm -rf $d
      cp -r anamis-xp-tmp/$d ./
    fi
  done
  rm -rf anamis-xp-tmp
  # اگر باز هم web یا cores نبود، نصب را متوقف کن
  if [ ! -d web ] || [ ! -d cores ]; then
    echo -e "${RED}دانلود خودکار پروژه موفق نبود. لطفاً پروژه را به صورت کامل clone کنید.${NC}"
    exit 1
  fi
fi
cd web || { echo -e "${RED}خطا: دایرکتوری web هنوز وجود ندارد!${NC}"; exit 1; }
npm install --production
cd ..

# کپی فایل‌های config نمونه اگر وجود ندارند
mkdir -p /etc/xray /etc/openvpn /etc/wireguard /var/log/xray /var/log/anamis-xp
if [ -f cores/xray/config.json ]; then
  [ -f /etc/xray/config.json ] || cp cores/xray/config.json /etc/xray/config.json
else
  echo -e "${RED}هشدار: فایل cores/xray/config.json وجود ندارد!${NC}"
fi
if [ -f cores/openvpn/server.conf ]; then
  [ -f /etc/openvpn/server.conf ] || cp cores/openvpn/server.conf /etc/openvpn/server.conf
else
  echo -e "${RED}هشدار: فایل cores/openvpn/server.conf وجود ندارد!${NC}"
fi
if [ -f cores/wireguard/wg0.conf ]; then
  [ -f /etc/wireguard/wg0.conf ] || cp cores/wireguard/wg0.conf /etc/wireguard/wg0.conf
else
  echo -e "${RED}هشدار: فایل cores/wireguard/wg0.conf وجود ندارد!${NC}"
fi

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