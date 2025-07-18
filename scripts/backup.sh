#!/bin/bash

# Anamis-XP Backup Script
# اسکریپت پشتیبان‌گیری از پنل آنامیس-ایکس‌پی

set -e

# Configuration
BACKUP_DIR="/opt/anamis-xp/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="anamis-xp-backup-$DATE.tar.gz"
ANAMIS_DIR="/opt/anamis-xp"
RETENTION_DAYS=7

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Language detection
if [[ "$LANG" == *"fa"* ]] || [[ "$LANG" == *"persian"* ]]; then
    LANG="fa"
else
    LANG="en"
fi

# Messages
if [ "$LANG" = "fa" ]; then
    MSG_START="شروع پشتیبان‌گیری از پنل آنامیس-ایکس‌پی..."
    MSG_CREATE_DIR="ایجاد دایرکتوری پشتیبان‌گیری..."
    MSG_BACKUP_CONFIG="پشتیبان‌گیری از فایل‌های پیکربندی..."
    MSG_BACKUP_LOGS="پشتیبان‌گیری از لاگ‌ها..."
    MSG_BACKUP_CORES="پشتیبان‌گیری از هسته‌های VPN..."
    MSG_CREATE_ARCHIVE="ایجاد فایل آرشیو..."
    MSG_CLEANUP="پاکسازی فایل‌های قدیمی..."
    MSG_SUCCESS="پشتیبان‌گیری با موفقیت انجام شد!"
    MSG_ERROR="خطا در پشتیبان‌گیری!"
    MSG_BACKUP_SIZE="حجم فایل پشتیبان:"
    MSG_BACKUP_LOCATION="مسیر فایل پشتیبان:"
    MSG_OLD_BACKUPS="حذف پشتیبان‌های قدیمی..."
else
    MSG_START="Starting Anamis-XP panel backup..."
    MSG_CREATE_DIR="Creating backup directory..."
    MSG_BACKUP_CONFIG="Backing up configuration files..."
    MSG_BACKUP_LOGS="Backing up logs..."
    MSG_BACKUP_CORES="Backing up VPN cores..."
    MSG_CREATE_ARCHIVE="Creating archive file..."
    MSG_CLEANUP="Cleaning up old backups..."
    MSG_SUCCESS="Backup completed successfully!"
    MSG_ERROR="Backup failed!"
    MSG_BACKUP_SIZE="Backup file size:"
    MSG_BACKUP_LOCATION="Backup file location:"
    MSG_OLD_BACKUPS="Removing old backups..."
fi

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

# Function to create backup directory
create_backup_dir() {
    print_status "$MSG_CREATE_DIR"
    mkdir -p "$BACKUP_DIR"
}

# Function to backup configuration files
backup_config() {
    print_status "$MSG_BACKUP_CONFIG"
    
    if [ -d "$ANAMIS_DIR/config" ]; then
        cp -r "$ANAMIS_DIR/config" "/tmp/anamis-config-backup"
    else
        print_warning "Configuration directory not found"
    fi
}

# Function to backup logs
backup_logs() {
    print_status "$MSG_BACKUP_LOGS"
    
    # Create logs backup directory
    mkdir -p "/tmp/anamis-logs-backup"
    
    # Backup Anamis-XP logs
    if [ -d "/var/log/anamis-xp" ]; then
        cp -r "/var/log/anamis-xp" "/tmp/anamis-logs-backup/"
    fi
    
    # Backup Xray logs
    if [ -d "/var/log/xray" ]; then
        cp -r "/var/log/xray" "/tmp/anamis-logs-backup/"
    fi
    
    # Backup system logs related to VPN services
    journalctl -u anamis-xp --no-pager -n 1000 > "/tmp/anamis-logs-backup/anamis-xp-journal.log" 2>/dev/null || true
    journalctl -u xray --no-pager -n 1000 > "/tmp/anamis-logs-backup/xray-journal.log" 2>/dev/null || true
    journalctl -u openvpn@server --no-pager -n 1000 > "/tmp/anamis-logs-backup/openvpn-journal.log" 2>/dev/null || true
    journalctl -u wg-quick@wg0 --no-pager -n 1000 > "/tmp/anamis-logs-backup/wireguard-journal.log" 2>/dev/null || true
}

# Function to backup VPN cores
backup_cores() {
    print_status "$MSG_BACKUP_CORES"
    
    # Create cores backup directory
    mkdir -p "/tmp/anamis-cores-backup"
    
    # Backup Xray configuration
    if [ -f "/etc/xray/config.json" ]; then
        cp "/etc/xray/config.json" "/tmp/anamis-cores-backup/xray-config.json"
    fi
    
    # Backup OpenVPN configuration
    if [ -f "/etc/openvpn/server.conf" ]; then
        cp "/etc/openvpn/server.conf" "/tmp/anamis-cores-backup/openvpn-server.conf"
    fi
    
    # Backup WireGuard configuration
    if [ -f "/etc/wireguard/wg0.conf" ]; then
        cp "/etc/wireguard/wg0.conf" "/tmp/anamis-cores-backup/wireguard-wg0.conf"
    fi
    
    # Backup systemd service files
    if [ -f "/etc/systemd/system/anamis-xp.service" ]; then
        cp "/etc/systemd/system/anamis-xp.service" "/tmp/anamis-cores-backup/anamis-xp.service"
    fi
}

# Function to create archive
create_archive() {
    print_status "$MSG_CREATE_ARCHIVE"
    
    cd /tmp
    tar -czf "$BACKUP_DIR/$BACKUP_NAME" \
        anamis-config-backup \
        anamis-logs-backup \
        anamis-cores-backup 2>/dev/null || true
    
    # Clean up temporary files
    rm -rf /tmp/anamis-config-backup
    rm -rf /tmp/anamis-logs-backup
    rm -rf /tmp/anamis-cores-backup
}

# Function to cleanup old backups
cleanup_old_backups() {
    print_status "$MSG_CLEANUP"
    
    find "$BACKUP_DIR" -name "anamis-xp-backup-*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
}

# Function to display backup information
display_backup_info() {
    if [ -f "$BACKUP_DIR/$BACKUP_NAME" ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)
        print_success "$MSG_SUCCESS"
        echo -e "${GREEN}$MSG_BACKUP_SIZE${NC} $BACKUP_SIZE"
        echo -e "${GREEN}$MSG_BACKUP_LOCATION${NC} $BACKUP_DIR/$BACKUP_NAME"
        
        # List all backups
        echo -e "${BLUE}Available backups:${NC}"
        ls -lh "$BACKUP_DIR"/anamis-xp-backup-*.tar.gz 2>/dev/null || echo "No backups found"
    else
        print_error "$MSG_ERROR"
        exit 1
    fi
}

# Main backup function
main() {
    print_status "$MSG_START"
    
    # Check if running as root
    check_root
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    backup_config
    backup_logs
    backup_cores
    
    # Create archive
    create_archive
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Display results
    display_backup_info
}

# Run main function
main "$@"