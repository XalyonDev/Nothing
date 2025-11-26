#!/bin/bash

echo ""
echo "============================================"
echo "      Atom Worker2 Auto Installer"
echo "============================================"
echo ""

# -------------------------------------------------------
# 1. Update system
# -------------------------------------------------------
echo "[+] Updating apt packages..."
sudo apt update -y
sudo apt upgrade -y
sudo apt install -y curl wget git 

# -------------------------------------------------------
# 2. Install NVM if missing
# -------------------------------------------------------
if [ ! -d "$HOME/.nvm" ]; then
    echo "[+] Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
else
    echo "[✓] NVM already installed."
fi

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

# -------------------------------------------------------
# 3. Install Node.js 22
# -------------------------------------------------------
echo "[+] Installing Node.js 22..."
nvm install 22
nvm use 22
nvm alias default 22

echo "[✓] Node JS: $(node -v)"
echo "[✓] NPM: $(npm -v)"

# -------------------------------------------------------
# 4. Install PM2 if missing
# -------------------------------------------------------
if ! command -v pm2 &> /dev/null; then
    echo "[+] Installing PM2..."
    npm install -g pm2
else
    echo "[✓] PM2 already installed."
fi

# -------------------------------------------------------
# 5. Create worker directory
# -------------------------------------------------------
WORKER_DIR="$HOME/atom-worker"

if [ ! -d "$WORKER_DIR" ]; then
    echo "[+] Creating worker directory..."
    mkdir -p "$WORKER_DIR"
fi

cd "$WORKER_DIR" || exit

# -------------------------------------------------------
# 6. Download worker.js from GitHub
# -------------------------------------------------------
WORKER_JS_URL="https://xalyondev.github.io/Nothing/worker2.js"

echo "[+] Downloading worker2.js..."
curl -sSL "$WORKER_JS_URL" -o worker2.js || wget -qO worker.js "$WORKER_JS_URL"

# -------------------------------------------------------
# 7. Firewall rule for port 4000
# -------------------------------------------------------
echo "[+] Opening firewall port 7000..."
sudo ufw allow 7000/tcp >/dev/null 2>&1

# -------------------------------------------------------
# 8. Start worker via PM2
# -------------------------------------------------------
echo "[+] Starting worker using PM2..."
pm2 start worker2.js --name atom-worker2
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME"

# -------------------------------------------------------
# 9. Display details
# -------------------------------------------------------
SERVER_IP=$(curl -s ifconfig.me)

echo ""
echo "============================================"
echo "      Installation Completed Successfully"
echo "============================================"
echo ""
echo " Worker is running at:"
echo "   http://$SERVER_IP:7000/run-job"
echo ""
echo " View logs:"
echo "   pm2 logs atom-worker2"
echo ""
echo " Restart:"
echo "   pm2 restart atom-worker2"
echo ""
echo " Stop:"
echo "   pm2 stop atom-worker2"
echo ""
echo "============================================"