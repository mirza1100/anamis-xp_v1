const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = util.promisify(exec);

class VPNCoreManager {
    constructor() {
        this.cores = {
            xray: {
                name: 'Xray',
                service: 'xray',
                config: '/usr/local/etc/xray/config.json',
                status: false
            },
            openvpn: {
                name: 'OpenVPN',
                service: 'openvpn@server',
                config: '/etc/openvpn/server.conf',
                status: false
            },
            wireguard: {
                name: 'WireGuard',
                service: 'wg-quick@wg0',
                config: '/etc/wireguard/wg0.conf',
                status: false
            }
        };
    }

    async checkCoreStatus(coreName) {
        try {
            const core = this.cores[coreName];
            if (!core) {
                throw new Error(`Unknown core: ${coreName}`);
            }

            const { stdout } = await execAsync(`systemctl is-active ${core.service}`);
            this.cores[coreName].status = stdout.trim() === 'active';
            return this.cores[coreName].status;
        } catch (error) {
            this.cores[coreName].status = false;
            return false;
        }
    }

    async startCore(coreName) {
        try {
            const core = this.cores[coreName];
            if (!core) {
                throw new Error(`Unknown core: ${coreName}`);
            }

            await execAsync(`systemctl start ${core.service}`);
            this.cores[coreName].status = true;
            return true;
        } catch (error) {
            console.error(`Failed to start ${coreName}:`, error);
            return false;
        }
    }

    async stopCore(coreName) {
        try {
            const core = this.cores[coreName];
            if (!core) {
                throw new Error(`Unknown core: ${coreName}`);
            }

            await execAsync(`systemctl stop ${core.service}`);
            this.cores[coreName].status = false;
            return true;
        } catch (error) {
            console.error(`Failed to stop ${coreName}:`, error);
            return false;
        }
    }

    async restartCore(coreName) {
        try {
            const core = this.cores[coreName];
            if (!core) {
                throw new Error(`Unknown core: ${coreName}`);
            }

            await execAsync(`systemctl restart ${core.service}`);
            this.cores[coreName].status = true;
            return true;
        } catch (error) {
            console.error(`Failed to restart ${coreName}:`, error);
            return false;
        }
    }

    async getAllStatus() {
        const status = {};
        for (const [name, core] of Object.entries(this.cores)) {
            status[name] = await this.checkCoreStatus(name);
        }
        return status;
    }

    async updateXrayConfig(config) {
        try {
            const configPath = this.cores.xray.config;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await this.restartCore('xray');
            return true;
        } catch (error) {
            console.error('Failed to update Xray config:', error);
            return false;
        }
    }

    async updateOpenVPNConfig(config) {
        try {
            const configPath = this.cores.openvpn.config;
            fs.writeFileSync(configPath, config);
            await this.restartCore('openvpn');
            return true;
        } catch (error) {
            console.error('Failed to update OpenVPN config:', error);
            return false;
        }
    }

    async updateWireGuardConfig(config) {
        try {
            const configPath = this.cores.wireguard.config;
            fs.writeFileSync(configPath, config);
            await this.restartCore('wireguard');
            return true;
        } catch (error) {
            console.error('Failed to update WireGuard config:', error);
            return false;
        }
    }

    async getCoreLogs(coreName, lines = 100) {
        try {
            const core = this.cores[coreName];
            if (!core) {
                throw new Error(`Unknown core: ${coreName}`);
            }

            const { stdout } = await execAsync(`journalctl -u ${core.service} --no-pager -n ${lines}`);
            return stdout.split('\n');
        } catch (error) {
            console.error(`Failed to get logs for ${coreName}:`, error);
            return [];
        }
    }

    async getSystemStats() {
        try {
            const { stdout: cpuInfo } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
            const { stdout: memInfo } = await execAsync("free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'");
            const { stdout: diskInfo } = await execAsync("df / | tail -1 | awk '{print $5}' | sed 's/%//'");
            
            return {
                cpu: parseFloat(cpuInfo.trim()),
                memory: parseFloat(memInfo.trim()),
                disk: parseFloat(diskInfo.trim())
            };
        } catch (error) {
            console.error('Failed to get system stats:', error);
            return { cpu: 0, memory: 0, disk: 0 };
        }
    }

    async getNetworkStats() {
        try {
            const { stdout } = await execAsync("ss -tuln | grep -E ':(443|1194|51820|8080|8081)' | wc -l");
            const activeConnections = parseInt(stdout.trim());
            
            return {
                activeConnections,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to get network stats:', error);
            return { activeConnections: 0, timestamp: new Date().toISOString() };
        }
    }
}

module.exports = VPNCoreManager;