# Anamis-XP VPN Management Panel

A comprehensive VPN management panel with multiple VPN cores, CLI interface, and web panel.

## 🚀 Quick Installation

```bash
# نصب یک خطی / One-line installation
bash <(curl -Ls https://raw.githubusercontent.com/mirza1100/anamis-xp_v1/master/install.sh)
```

## Features

- Multiple VPN protocols (Xray, OpenVPN, WireGuard, SSH, WebSocket)
- CLI management interface with 15 options
- Web-based management panel with 7 main pages
- Multi-language support (Persian/English)
- Light/Dark theme support
- Docker support with Docker Compose
- Comprehensive documentation and API
- Backup and restore functionality
- Real-time monitoring and statistics

## Quick Start

### Method 1: One-Line Installation (Recommended)
```bash
# نصب یک خطی / One-line installation
bash <(curl -Ls https://raw.githubusercontent.com/mirza1100/anamis-xp_v1/master/install.sh)

# دسترسی / Access
# Username: admin
# Password: admin123
# URL: http://localhost:3000
```

### Method 2: Manual Installation
```bash
# Clone the repository
git clone https://github.com/your-username/anamis-xp.git
cd anamis-xp

# Run the installation script
sudo ./install.sh

# Access the web panel
# Username: admin
# Password: admin123
# URL: http://localhost:3000
```

### Method 3: Docker Installation
```bash
# Clone the repository
git clone https://github.com/your-username/anamis-xp.git
cd anamis-xp

# Build and run with Docker Compose
docker-compose up -d

# Access the web panel
# Username: admin
# Password: admin123
# URL: http://localhost:3000
```

### Method 4: Manual Installation
```bash
# Install dependencies
sudo apt update
sudo apt install -y curl wget git unzip nodejs npm python3 python3-pip

# Clone and setup
git clone https://github.com/your-username/anamis-xp.git
cd anamis-xp
sudo mkdir -p /opt/anamis-xp
sudo cp -r . /opt/anamis-xp/
cd /opt/anamis-xp/web
sudo npm install

# Start the service
sudo systemctl start anamis-xp
sudo systemctl enable anamis-xp
```

## CLI Usage

The Anamis-XP CLI provides 15 management options:

```bash
# Access CLI
anamis-xp

# Available options:
# 1. Install Anamis-XP
# 2. Update Anamis-XP
# 3. Reset credentials
# 4. Change panel port
# 5. Start panel
# 6. Stop panel
# 7. Restart panel
# 8. Check panel status
# 9. View panel logs
# 10. Install VPN cores
# 11. Start VPN cores
# 12. Stop VPN cores
# 13. Check VPN status
# 14. View VPN logs
# 15. Exit
```

## Web Panel

The web panel includes 7 main pages:

1. **Login** - Secure authentication
2. **Dashboard** - System overview and statistics
3. **Inbounds** - VPN inbound management
4. **Tunnels** - Tunnel configuration
5. **Settings** - Panel configuration
6. **Tunnel Settings** - Advanced tunnel options
7. **Logout** - Secure logout

### Features:
- Real-time system monitoring
- VPN core management
- User management
- Traffic statistics
- Log viewing
- Multi-language support (Persian/English)
- Theme switching (Light/Dark)

## User Management

Anamis-XP provides a powerful multi-protocol user management system accessible from the web panel:

- **Supported Protocols:**
  - Xray (VMess): Add/remove users by UUID, alterId, security
  - WireGuard: Add/remove users by PublicKey and AllowedIPs
  - SSH: Add/remove users with prefix `vpn_` (username/password)
  - OpenVPN: View connected users (add/remove via certificate management, not yet implemented)

### How to Use

1. Go to the **User Management** page from the sidebar in the web panel.
2. Select the desired protocol tab (Xray, WireGuard, OpenVPN, SSH).
3. View the list of users for each protocol.
4. For Xray, WireGuard, and SSH:
   - Fill out the add user form and submit to create a new user.
   - Click 'Remove' to delete a user.
5. For OpenVPN, view the list of currently connected users.

All changes are applied instantly and reflected in the VPN core configuration.

For advanced usage and API integration, see [docs/API.md](docs/API.md).

## VPN Cores

### Supported Protocols:
- **Xray** - VMess, VLESS, Trojan, Shadowsocks
- **OpenVPN** - UDP/TCP protocols
- **WireGuard** - Modern VPN protocol
- **SSH** - Secure shell tunneling
- **WebSocket** - WebSocket proxy
- **Nginx** - Reverse proxy

### Configuration:
Each VPN core has its own configuration directory:
- Xray: `/etc/xray/config.json`
- OpenVPN: `/etc/openvpn/server.conf`
- WireGuard: `/etc/wireguard/wg0.conf`

## API Documentation

The panel provides a comprehensive REST API:

- **Authentication**: JWT-based authentication
- **Dashboard**: System statistics and VPN status
- **Inbounds**: VPN inbound management
- **Tunnels**: Tunnel configuration
- **Settings**: Panel configuration
- **Core Management**: VPN core control
- **Logs**: System and VPN logs

See `docs/API.md` for detailed API documentation.

## Backup and Restore

### Automatic Backup:
```bash
# Create backup
sudo /opt/anamis-xp/scripts/backup.sh

# Restore from backup
sudo /opt/anamis-xp/scripts/restore.sh
```

### Manual Backup:
```bash
# Backup configuration
sudo tar -czf anamis-xp-backup-$(date +%Y%m%d_%H%M%S).tar.gz \
    /opt/anamis-xp/config \
    /var/log/anamis-xp \
    /etc/xray \
    /etc/openvpn \
    /etc/wireguard
```

## Docker Support

### Docker Compose Services:
- **anamis-xp**: Main application
- **nginx**: Reverse proxy (optional)
- **redis**: Session storage (optional)
- **postgres**: Database (optional)

### Environment Variables:
```yaml
NODE_ENV: production
ANAMIS_DIR: /opt/anamis-xp
```

### Ports:
- 3000: Web Panel
- 443: Xray HTTPS
- 1194: OpenVPN
- 51820: WireGuard
- 8080: Gaming Tunnel
- 8081: Standard Tunnel
- 22: SSH

## Configuration

### Main Configuration File:
`/opt/anamis-xp/config/config.json`

```json
{
  "panel": {
    "port": 3000,
    "username": "admin",
    "password": "admin123",
    "language": "en",
    "theme": "light"
  },
  "vpn": {
    "xray": {
      "enabled": true,
      "port": 443
    },
    "openvpn": {
      "enabled": true,
      "port": 1194
    }
  },
  "tunnels": {
    "gaming": {
      "enabled": false,
      "port": 8080
    },
    "standard": {
      "enabled": false,
      "port": 8081
    }
  }
}
```

## Security

### Features:
- JWT authentication
- Rate limiting
- Input validation
- SQL injection protection
- XSS protection
- CSRF protection
- Secure headers

### Best Practices:
- Change default credentials
- Use HTTPS in production
- Regular security updates
- Firewall configuration
- Log monitoring

## Monitoring

### System Metrics:
- CPU usage
- Memory usage
- Disk usage
- Network traffic
- Active connections

### VPN Metrics:
- Connection status
- User count
- Traffic statistics
- Error rates

## Troubleshooting

### Common Issues:

1. **Service won't start**:
   ```bash
   sudo systemctl status anamis-xp
   sudo journalctl -u anamis-xp -f
   ```

2. **Port conflicts**:
   ```bash
   sudo netstat -tulpn | grep :3000
   sudo lsof -i :3000
   ```

3. **Permission issues**:
   ```bash
   sudo chown -R root:root /opt/anamis-xp
   sudo chmod -R 755 /opt/anamis-xp
   ```

### Log Locations:
- Panel logs: `/var/log/anamis-xp/`
- Xray logs: `/var/log/xray/`
- System logs: `journalctl -u anamis-xp`

## Development

### Prerequisites:
- Node.js 18+
- Python 3.8+
- Git

### Setup:
```bash
git clone https://github.com/your-username/anamis-xp.git
cd anamis-xp/web
npm install
npm run dev
```

### Testing:
```bash
# Run tests
./test.sh

# Check structure
find . -type f | wc -l
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: See `docs/` directory
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Wiki**: GitHub Wiki

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Acknowledgments

- Xray Core Team
- OpenVPN Project
- WireGuard Project
- Bootstrap Team
- Node.js Community