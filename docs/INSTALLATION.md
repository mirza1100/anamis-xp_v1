# Anamis-XP VPN Panel Installation Guide

## مقدمه / Introduction

این راهنمای نصب برای پنل مدیریتی VPN آنامیس-ایکس‌پی است که شامل تمام مراحل نصب و راه‌اندازی می‌شود.

This installation guide covers all steps to install and set up the Anamis-XP VPN Management Panel.

## پیش‌نیازها / Prerequisites

### سیستم عامل / Operating System
- Ubuntu 20.04 LTS یا بالاتر / Ubuntu 20.04 LTS or higher
- Debian 11 یا بالاتر / Debian 11 or higher

### حداقل مشخصات / Minimum Requirements
- CPU: 1 Core
- RAM: 1 GB
- Storage: 10 GB
- Network: 1 Mbps

### توصیه شده / Recommended
- CPU: 2+ Cores
- RAM: 2+ GB
- Storage: 20+ GB
- Network: 10+ Mbps

## نصب سریع / Quick Installation

### روش 1: نصب با یک خط کد / Method 1: One-line Installation

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mirza1100/anamis-xp_v1/master/install.sh)
```

### روش 2: نصب دستی / Method 2: Manual Installation

1. **دانلود پروژه / Download the project**
```bash
git clone https://github.com/mirza1100/anamis-xp_v1.git
cd anamis-xp_v1
```

2. **اجرای اسکریپت نصب / Run installation script**
```bash
sudo bash install.sh
```

## مراحل نصب / Installation Steps

### 1. بررسی سیستم / System Check
- بررسی دسترسی root / Check root access
- بررسی سیستم عامل / Check operating system
- بررسی اتصال اینترنت / Check internet connection

### 2. نصب وابستگی‌ها / Install Dependencies
- به‌روزرسانی سیستم / Update system
- نصب بسته‌های ضروری / Install essential packages
- نصب Node.js و npm / Install Node.js and npm
- نصب Python3 / Install Python3
- نصب Docker / Install Docker

### 3. نصب هسته‌های VPN / Install VPN Cores
- نصب Xray / Install Xray
- نصب OpenVPN / Install OpenVPN
- نصب Nginx / Install Nginx
- نصب WireGuard / Install WireGuard

### 4. راه‌اندازی پنل / Setup Panel
- ایجاد ساختار پروژه / Create project structure
- نصب وابستگی‌های وب / Install web dependencies
- ایجاد سرویس سیستم / Create system service
- ایجاد دستور CLI / Create CLI command

### 5. تنظیمات اولیه / Initial Configuration
- تنظیم نام کاربری و رمز عبور / Set username and password
- تنظیم پورت پنل / Set panel port
- تنظیم زبان و تم / Set language and theme

## دسترسی به پنل / Accessing the Panel

### CLI Access
```bash
anamis-xp
```

### Web Panel Access
```
http://YOUR_SERVER_IP:3000
```

### اطلاعات ورود پیش‌فرض / Default Login
- Username: `admin`
- Password: `admin123`

## تنظیمات پس از نصب / Post-Installation Configuration

### 1. تغییر رمز عبور / Change Password
```bash
anamis-xp
# Select option 6: Reset&Change Username & Password
```

### 2. تنظیم فایروال / Configure Firewall
```bash
# Allow panel port
sudo ufw allow 3000

# Allow VPN ports
sudo ufw allow 443
sudo ufw allow 1194
sudo ufw allow 8080
sudo ufw allow 8081

# Enable firewall
sudo ufw enable
```

### 3. تنظیم SSL / Configure SSL
```bash
# Install Certbot
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com
```

## مدیریت سرویس / Service Management

### شروع سرویس / Start Service
```bash
sudo systemctl start anamis-xp
```

### توقف سرویس / Stop Service
```bash
sudo systemctl stop anamis-xp
```

### راه‌اندازی مجدد سرویس / Restart Service
```bash
sudo systemctl restart anamis-xp
```

### بررسی وضعیت سرویس / Check Service Status
```bash
sudo systemctl status anamis-xp
```

### فعال‌سازی سرویس / Enable Service
```bash
sudo systemctl enable anamis-xp
```

## عیب‌یابی / Troubleshooting

### مشکلات رایج / Common Issues

#### 1. خطای دسترسی / Permission Error
```bash
sudo chmod +x /opt/anamis-xp/install.sh
sudo chmod +x /opt/anamis-xp/cli/anamis-xp
```

#### 2. خطای پورت / Port Error
```bash
# Check if port is in use
sudo netstat -tlnp | grep :3000

# Kill process using port
sudo kill -9 PID
```

#### 3. خطای Node.js / Node.js Error
```bash
# Reinstall Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 4. خطای وابستگی‌ها / Dependency Error
```bash
cd /opt/anamis-xp/web
npm install
```

### لاگ‌ها / Logs
```bash
# Panel logs
sudo journalctl -u anamis-xp -f

# Xray logs
sudo tail -f /var/log/xray/error.log

# OpenVPN logs
sudo tail -f /var/log/openvpn.log
```

## به‌روزرسانی / Updates

### به‌روزرسانی پنل / Update Panel
```bash
anamis-xp
# Select option 2: Update
```

### به‌روزرسانی منو / Update Menu
```bash
anamis-xp
# Select option 3: Update Menu
```

## حذف / Uninstallation

### حذف کامل / Complete Uninstallation
```bash
anamis-xp
# Select option 5: Uninstall
```

### حذف دستی / Manual Uninstallation
```bash
# Stop and disable service
sudo systemctl stop anamis-xp
sudo systemctl disable anamis-xp

# Remove service file
sudo rm /etc/systemd/system/anamis-xp.service

# Remove CLI command
sudo rm /usr/local/bin/anamis-xp

# Remove application directory
sudo rm -rf /opt/anamis-xp

# Reload systemd
sudo systemctl daemon-reload
```

## پشتیبانی / Support

### منابع / Resources
- GitHub: https://github.com/mirza1100/anamis-xp_v1
- Documentation: https://github.com/mirza1100/anamis-xp_v1/docs
- Issues: https://github.com/mirza1100/anamis-xp_v1/issues

### تماس / Contact
- Email: support@anamis-xp.com
- Telegram: @anamis_xp_support

## مجوز / License

این پروژه تحت مجوز MIT منتشر شده است.

This project is licensed under the MIT License.