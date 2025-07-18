# Anamis-XP VPN Panel Dockerfile
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV ANAMIS_DIR=/opt/anamis-xp

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    python3 \
    python3-pip \
    python3-venv \
    iptables \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Docker
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install VPN cores
RUN apt-get update && apt-get install -y \
    openvpn \
    nginx \
    wireguard \
    && rm -rf /var/lib/apt/lists/*

# Install Xray
RUN bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

# Create application directory
RUN mkdir -p $ANAMIS_DIR

# Copy application files
COPY . $ANAMIS_DIR/

# Set permissions
RUN chmod +x $ANAMIS_DIR/install.sh \
    && chmod +x $ANAMIS_DIR/cli/anamis-xp \
    && chmod +x $ANAMIS_DIR/test.sh

# Install web dependencies
WORKDIR $ANAMIS_DIR/web
RUN npm install --production

# Create necessary directories
RUN mkdir -p /var/log/xray \
    && mkdir -p /var/log/anamis-xp \
    && mkdir -p /etc/xray \
    && mkdir -p /etc/openvpn \
    && mkdir -p /etc/wireguard

# Copy configuration files
RUN cp $ANAMIS_DIR/cores/xray/config.json /etc/xray/ \
    && cp $ANAMIS_DIR/cores/openvpn/server.conf /etc/openvpn/ \
    && cp $ANAMIS_DIR/cores/wireguard/wg0.conf /etc/wireguard/

# Create systemd service file
RUN echo '[Unit]' > /etc/systemd/system/anamis-xp.service \
    && echo 'Description=Anamis-XP VPN Management Panel' >> /etc/systemd/system/anamis-xp.service \
    && echo 'After=network.target' >> /etc/systemd/system/anamis-xp.service \
    && echo '' >> /etc/systemd/system/anamis-xp.service \
    && echo '[Service]' >> /etc/systemd/system/anamis-xp.service \
    && echo 'Type=simple' >> /etc/systemd/system/anamis-xp.service \
    && echo 'User=root' >> /etc/systemd/system/anamis-xp.service \
    && echo "WorkingDirectory=$ANAMIS_DIR" >> /etc/systemd/system/anamis-xp.service \
    && echo 'ExecStart=/usr/bin/node /opt/anamis-xp/web/server.js' >> /etc/systemd/system/anamis-xp.service \
    && echo 'Restart=always' >> /etc/systemd/system/anamis-xp.service \
    && echo 'RestartSec=10' >> /etc/systemd/system/anamis-xp.service \
    && echo '' >> /etc/systemd/system/anamis-xp.service \
    && echo '[Install]' >> /etc/systemd/system/anamis-xp.service \
    && echo 'WantedBy=multi-user.target' >> /etc/systemd/system/anamis-xp.service

# Create CLI command
RUN echo '#!/bin/bash' > /usr/local/bin/anamis-xp \
    && echo "$ANAMIS_DIR/cli/anamis-xp \"\$@\"" >> /usr/local/bin/anamis-xp \
    && chmod +x /usr/local/bin/anamis-xp

# Create default configuration
RUN mkdir -p $ANAMIS_DIR/config \
    && echo '{' > $ANAMIS_DIR/config/config.json \
    && echo '  "panel": {' >> $ANAMIS_DIR/config/config.json \
    && echo '    "port": 3000,' >> $ANAMIS_DIR/config/config.json \
    && echo '    "username": "admin",' >> $ANAMIS_DIR/config/config.json \
    && echo '    "password": "admin123",' >> $ANAMIS_DIR/config/config.json \
    && echo '    "language": "en",' >> $ANAMIS_DIR/config/config.json \
    && echo '    "theme": "light"' >> $ANAMIS_DIR/config/config.json \
    && echo '  },' >> $ANAMIS_DIR/config/config.json \
    && echo '  "vpn": {' >> $ANAMIS_DIR/config/config.json \
    && echo '    "xray": {' >> $ANAMIS_DIR/config/config.json \
    && echo '      "enabled": true,' >> $ANAMIS_DIR/config/config.json \
    && echo '      "port": 443' >> $ANAMIS_DIR/config/config.json \
    && echo '    },' >> $ANAMIS_DIR/config/config.json \
    && echo '    "openvpn": {' >> $ANAMIS_DIR/config/config.json \
    && echo '      "enabled": true,' >> $ANAMIS_DIR/config/config.json \
    && echo '      "port": 1194' >> $ANAMIS_DIR/config/config.json \
    && echo '    },' >> $ANAMIS_DIR/config/config.json \
    && echo '    "ssh": {' >> $ANAMIS_DIR/config/config.json \
    && echo '      "enabled": true,' >> $ANAMIS_DIR/config/config.json \
    && echo '      "port": 22' >> $ANAMIS_DIR/config/config.json \
    && echo '    }' >> $ANAMIS_DIR/config/config.json \
    && echo '  },' >> $ANAMIS_DIR/config/config.json \
    && echo '  "tunnels": {' >> $ANAMIS_DIR/config/config.json \
    && echo '    "gaming": {' >> $ANAMIS_DIR/config/config.json \
    && echo '      "enabled": false,' >> $ANAMIS_DIR/config/config.json \
    && echo '      "port": 8080' >> $ANAMIS_DIR/config/config.json \
    && echo '    },' >> $ANAMIS_DIR/config/config.json \
    && echo '    "standard": {' >> $ANAMIS_DIR/config/config.json \
    && echo '      "enabled": false,' >> $ANAMIS_DIR/config/config.json \
    && echo '      "port": 8081' >> $ANAMIS_DIR/config/config.json \
    && echo '    }' >> $ANAMIS_DIR/config/config.json \
    && echo '  }' >> $ANAMIS_DIR/config/config.json \
    && echo '}' >> $ANAMIS_DIR/config/config.json

# Reload systemd
RUN systemctl daemon-reload

# Enable and start services
RUN systemctl enable anamis-xp

# Expose ports
EXPOSE 3000 443 1194 51820 8080 8081 22

# Set working directory
WORKDIR $ANAMIS_DIR

# Create entrypoint script
RUN echo '#!/bin/bash' > /entrypoint.sh \
    && echo 'set -e' >> /entrypoint.sh \
    && echo '' >> /entrypoint.sh \
    && echo '# Start systemd' >> /entrypoint.sh \
    && echo 'systemctl start systemd-sysctl' >> /entrypoint.sh \
    && echo '' >> /entrypoint.sh \
    && echo '# Start Docker' >> /entrypoint.sh \
    && echo 'systemctl start docker' >> /entrypoint.sh \
    && echo '' >> /entrypoint.sh \
    && echo '# Start Anamis-XP' >> /entrypoint.sh \
    && echo 'systemctl start anamis-xp' >> /entrypoint.sh \
    && echo '' >> /entrypoint.sh \
    && echo '# Keep container running' >> /entrypoint.sh \
    && echo 'exec "$@"' >> /entrypoint.sh \
    && chmod +x /entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/dashboard || exit 1

# Labels
LABEL maintainer="Anamis-XP Team" \
      version="1.0.0" \
      description="Anamis-XP VPN Management Panel"

# Entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash"]