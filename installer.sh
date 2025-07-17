#!/bin/bash
set -e

# رنگ‌ها
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# فقط با دسترسی root اجرا شود
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}لطفاً اسکریپت را با دسترسی root اجرا کنید (sudo).${NC}"
  exit 1
fi

# مسیر نصب
INSTALL_DIR="/opt/anamis-xp"
REPO_URL="https://github.com/mirza1100/Anamis-XP_v1.git"

# 1. کلون پروژه
if [ ! -d "$INSTALL_DIR" ]; then
  echo -e "${GREEN}در حال کلون پروژه...${NC}"
  git clone $REPO_URL $INSTALL_DIR || { echo -e "${RED}کلون پروژه با خطا مواجه شد!${NC}"; exit 2; }
else
  echo -e "${GREEN}پروژه قبلاً کلون شده است.${NC}"
fi

cd $INSTALL_DIR

# 2. مجوز اجرایی به اسکریپت‌ها
chmod +x install.sh || true
chmod +x cli/anamis-xp || true
chmod +x test.sh || true

# 3. نصب jq اگر وجود ندارد
if ! command -v jq >/dev/null 2>&1; then
  echo -e "${GREEN}در حال نصب jq...${NC}"
  apt update && apt install -y jq
fi

# 4. اجرای نصب اصلی
./install.sh || { echo -e "${RED}نصب اصلی با خطا مواجه شد!${NC}"; exit 3; }

# 5. پیام موفقیت
IP=$(curl -s ifconfig.me || echo 'localhost')
echo -e "\n${GREEN}✅ نصب با موفقیت انجام شد!${NC}"
echo "آدرس پنل: http://$IP:3000"
echo "یوزر: admin"
echo "پسورد: admin123"
echo "برای مدیریت CLI: anamis-xp"
echo "---------------------------------------------"