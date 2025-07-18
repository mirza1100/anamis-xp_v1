#!/bin/bash

# Anamis-XP Restore Script
# اسکریپت بازیابی پنل آنامیس-ایکس‌پی

set -e

# Configuration
BACKUP_DIR="/opt/anamis-xp/backups"
ANAMIS_DIR="/opt/anamis-xp"
TEMP_DIR="/tmp/anamis-restore"

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
    MSG_START="شروع بازیابی پنل آنامیس-ایکس‌پی..."
    MSG_SELECT_BACKUP="لطفاً فایل پشتیبان را انتخاب کنید:"
    MSG_INVALID_FILE="فایل نامعتبر است!"
    MSG_STOP_SERVICES="توقف سرویس‌ها..."
    MSG_EXTRACT="استخراج فایل پشتیبان..."
    MSG_RESTORE_CONFIG="بازیابی فایل‌های پیکربندی..."
    MSG_RESTORE_LOGS="بازیابی لاگ‌ها..."
    MSG_RESTORE_CORES="بازیابی هسته‌های VPN..."
    MSG_START_SERVICES="راه‌اندازی مجدد سرویس‌ها..."
    MSG_CLEANUP="پاکسازی فایل‌های موقت..."
    MSG_SUCCESS="بازیابی با موفقیت انجام شد!"
    MSG_ERROR="خطا در بازیابی!"
    MSG_CONFIRM="آیا مطمئن هستید که می‌خواهید بازیابی کنید؟ (y/N): "
    MSG_ABORT="بازیابی لغو شد."
else
    MSG_START="Starting Anamis-XP panel restore..."
    MSG_SELECT_BACKUP="Please select backup file:"
    MSG_INVALID_FILE="Invalid file!"
    MSG_STOP_SERVICES="Stopping services..."
    MSG_EXTRACT="Extracting backup file..."
    MSG_RESTORE_CONFIG="Restoring configuration files..."
    MSG_RESTORE_LOGS="Restoring logs..."
    MSG_RESTORE_CORES="Restoring VPN cores..."
    MSG_START_SERVICES="Restarting services..."
    MSG_CLEANUP="Cleaning up temporary files..."
    MSG_SUCCESS="Restore completed successfully!"
    MSG_ERROR="Restore failed!"
    MSG_CONFIRM="Are you sure you want to restore? (y/N): "
    MSG_ABORT="Restore aborted."
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

# Function to list available backups
list_backups() {
    print_status "$MSG_SELECT_BACKUP"
    echo
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
    
    local backups=($(ls -1 "$BACKUP_DIR"/anamis-xp-backup-*.tar.gz 2>/dev/null | sort -r))
    
    if [ ${#backups[@]} -eq 0 ]; then
        print_error "No backup files found in $BACKUP_DIR"
        exit 1
    fi
    
    echo "Available backups:"
    for i in "${!backups[@]}"; do
        local filename=$(basename "${backups[$i]}")
        local size=$(du -h "${backups[$i]}" | cut -f1)
        local date=$(echo "$filename" | sed 's/anamis-xp-backup-\(.*\)\.tar\.gz/\1/')
        echo "  $((i+1)). $filename ($size) - $date"
    done
    
    echo
    read -p "Enter backup number (1-${#backups[@]}): " selection
    
    if [[ ! "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#backups[@]} ]; then
        print_error "Invalid selection"
        exit 1
    fi
    
    BACKUP_FILE="${backups[$((selection-1))]}"
}

# Function to validate backup file
validate_backup() {
    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    if [[ ! "$BACKUP_FILE" =~ \.tar\.gz$ ]]; then
        print_error "$MSG_INVALID_FILE"
        exit 1
    fi
    
    # Test if file is a valid tar.gz
    if ! tar -tzf "$BACKUP_FILE" >/dev/null 2>&1; then
        print_error "$MSG_INVALID_FILE"
        exit 1
    fi
}

# Function to confirm restore
confirm_restore() {
    echo
    print_warning "This will overwrite current configuration and may stop running services."
    read -p "$MSG_CONFIRM" -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "$MSG_ABORT"
        exit 0
    fi
}

# Function to stop services
stop_services() {
    print_status "$MSG_STOP_SERVICES"
    
    systemctl stop anamis-xp 2>/dev/null || true
    systemctl stop xray 2>/dev/null || true
    systemctl stop openvpn@server 2>/dev/null || true
    systemctl stop wg-quick@wg0 2>/dev/null || true
    
    sleep 2
}

# Function to extract backup
extract_backup() {
    print_status "$MSG_EXTRACT"
    
    # Create temporary directory
    rm -rf "$TEMP_DIR"
    mkdir -p "$TEMP_DIR"
    
    # Extract backup
    tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
}

# Function to restore configuration
restore_config() {
    print_status "$MSG_RESTORE_CONFIG"
    
    if [ -d "$TEMP_DIR/anamis-config-backup" ]; then
        # Backup current config
        if [ -d "$ANAMIS_DIR/config" ]; then
            mv "$ANAMIS_DIR/config" "$ANAMIS_DIR/config.backup.$(date +%Y%m%d_%H%M%S)"
        fi
        
        # Restore config
        cp -r "$TEMP_DIR/anamis-config-backup" "$ANAMIS_DIR/config"
        print_success "Configuration restored"
    else
        print_warning "No configuration backup found"
    fi
}

# Function to restore logs
restore_logs() {
    print_status "$MSG_RESTORE_LOGS"
    
    if [ -d "$TEMP_DIR/anamis-logs-backup" ]; then
        # Restore Anamis-XP logs
        if [ -d "$TEMP_DIR/anamis-logs-backup/anamis-xp" ]; then
            cp -r "$TEMP_DIR/anamis-logs-backup/anamis-xp" "/var/log/"
        fi
        
        # Restore Xray logs
        if [ -d "$TEMP_DIR/anamis-logs-backup/xray" ]; then
            cp -r "$TEMP_DIR/anamis-logs-backup/xray" "/var/log/"
        fi
        
        print_success "Logs restored"
    else
        print_warning "No logs backup found"
    fi
}

# Function to restore VPN cores
restore_cores() {
    print_status "$MSG_RESTORE_CORES"
    
    if [ -d "$TEMP_DIR/anamis-cores-backup" ]; then
        # Restore Xray configuration
        if [ -f "$TEMP_DIR/anamis-cores-backup/xray-config.json" ]; then
            cp "$TEMP_DIR/anamis-cores-backup/xray-config.json" "/etc/xray/config.json"
        fi
        
        # Restore OpenVPN configuration
        if [ -f "$TEMP_DIR/anamis-cores-backup/openvpn-server.conf" ]; then
            cp "$TEMP_DIR/anamis-cores-backup/openvpn-server.conf" "/etc/openvpn/server.conf"
        fi
        
        # Restore WireGuard configuration
        if [ -f "$TEMP_DIR/anamis-cores-backup/wireguard-wg0.conf" ]; then
            cp "$TEMP_DIR/anamis-cores-backup/wireguard-wg0.conf" "/etc/wireguard/wg0.conf"
        fi
        
        # Restore systemd service files
        if [ -f "$TEMP_DIR/anamis-cores-backup/anamis-xp.service" ]; then
            cp "$TEMP_DIR/anamis-cores-backup/anamis-xp.service" "/etc/systemd/system/"
            systemctl daemon-reload
        fi
        
        print_success "VPN cores restored"
    else
        print_warning "No cores backup found"
    fi
}

# Function to start services
start_services() {
    print_status "$MSG_START_SERVICES"
    
    # Start Anamis-XP
    systemctl start anamis-xp 2>/dev/null || true
    
    # Start VPN cores (optional, user can start manually)
    print_warning "VPN cores restored. You may need to start them manually."
    echo "  - Xray: systemctl start xray"
    echo "  - OpenVPN: systemctl start openvpn@server"
    echo "  - WireGuard: systemctl start wg-quick@wg0"
}

# Function to cleanup
cleanup() {
    print_status "$MSG_CLEANUP"
    rm -rf "$TEMP_DIR"
}

# Function to display restore information
display_restore_info() {
    print_success "$MSG_SUCCESS"
    echo -e "${GREEN}Restored from:${NC} $BACKUP_FILE"
    echo -e "${GREEN}Restore time:${NC} $(date)"
    
    # Check service status
    echo -e "${BLUE}Service status:${NC}"
    systemctl is-active anamis-xp >/dev/null 2>&1 && echo "  ✓ Anamis-XP: Active" || echo "  ✗ Anamis-XP: Inactive"
    systemctl is-active xray >/dev/null 2>&1 && echo "  ✓ Xray: Active" || echo "  ✗ Xray: Inactive"
    systemctl is-active openvpn@server >/dev/null 2>&1 && echo "  ✓ OpenVPN: Active" || echo "  ✗ OpenVPN: Inactive"
    systemctl is-active wg-quick@wg0 >/dev/null 2>&1 && echo "  ✓ WireGuard: Active" || echo "  ✗ WireGuard: Inactive"
}

# Main restore function
main() {
    print_status "$MSG_START"
    
    # Check if running as root
    check_root
    
    # List and select backup
    list_backups
    
    # Validate backup file
    validate_backup
    
    # Confirm restore
    confirm_restore
    
    # Stop services
    stop_services
    
    # Extract backup
    extract_backup
    
    # Restore components
    restore_config
    restore_logs
    restore_cores
    
    # Start services
    start_services
    
    # Cleanup
    cleanup
    
    # Display results
    display_restore_info
}

# Run main function
main "$@"