# USCHAT Backend Deployment Guide (VPS)

This guide provides step-by-step instructions for deploying the USCHAT backend to a standard Linux Virtual Private Server (VPS) running Ubuntu 20.04/22.04 or Debian.

## 1. Prerequisites

Before you start, make sure you have SSH access to your server and a domain name pointing to your VPS IP address (e.g., `backend.uschat.fun`).

Install the necessary dependencies:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx redis-server coturn build-essential
```

Install Node.js (v18 or v20 recommended):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Install PM2 globally (for process management):
```bash
sudo npm install -g pm2
```

## 2. Clone the Repository & Setup

Navigate to the directory where you want to host the backend (e.g., `/var/www/uschat-backend`):

```bash
sudo mkdir -p /var/www/uschat
sudo chown -R $USER:$USER /var/www/uschat
cd /var/www/uschat
git clone <your-repository-url> .
cd backend
```

Install the Node.js dependencies:
```bash
npm install
```

## 3. Environment Variables Setup

Copy the example environment file and edit it to match your production settings:

```bash
cp .env.example .env
nano .env
```

Ensure the following important settings are configured:
- `PORT=4000`
- `NODE_ENV=production`
- `DATABASE_URL=file:./uschat.db`
- `REDIS_URL=redis://localhost:6379`
- `JWT_SECRET` and `JWT_REFRESH_SECRET` (Use securely generated random strings)
- Update Firebase service account paths if applicable.

## 4. Database Initialization

Since USCHAT uses Prisma (with SQLite configured by default), run the database migrations and generate the client:

```bash
npx prisma generate
npx prisma migrate deploy
```

## 5. Build and Start the Application

Compile the TypeScript code to JavaScript:
```bash
npm run build
```

Start the application with PM2 to ensure it stays online and restarts on crash/reboot:
```bash
pm2 start dist/index.js --name "uschat-backend"
pm2 save
pm2 startup
```

*(Run the command provided by `pm2 startup` to configure PM2 to start on boot).*

## 6. Nginx Reverse Proxy Configuration

To expose your app to the internet and handle WebSocket connections correctly, configure Nginx as a reverse proxy.

Create a new Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/uschat
```

Add the following configuration (replace `backend.uschat.fun` with your actual domain):

```nginx
server {
    listen 80;
    server_name backend.uschat.fun;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/uschat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 7. Secure with SSL (Let's Encrypt)

Install Certbot and obtain an SSL certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d backend.uschat.fun
```
Certbot will automatically modify your Nginx configuration to support HTTPS.

## 8. STUN/TURN Setup for WebRTC Calling (Optional but Recommended)

For reliable P2P voice calling, configure the `coturn` server you installed earlier:

```bash
sudo nano /etc/turnserver.conf
```
Uncomment and adjust the following lines:
```
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=username:password
realm=backend.uschat.fun
```

Restart coturn:
```bash
sudo systemctl enable coturn
sudo systemctl restart coturn
```

## Maintenance Commands
- View logs: `pm2 logs uschat-backend`
- Restart app: `pm2 restart uschat-backend`
- Monitor processes: `pm2 monit`
