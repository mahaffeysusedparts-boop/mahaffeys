# Self-Hosting ScrapFlow on a Linux Server

This guide provides comprehensive instructions for deploying, managing, and reinstalling the ScrapFlow application on a dedicated Linux server (Ubuntu/Debian recommended) on your local network.

## 1. Initial Server Preparation

Before deploying, ensure your server is up-to-date and has the necessary software.

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (v20+), Nginx, Git, and build tools
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git build-essential

# 3. Install PM2 process manager globally to keep the app running
sudo npm install -g pm2
```

## 2. Fresh Installation

Follow these steps to deploy the application for the first time.

#### Step 1: Clone the Repository
```bash
# Navigate to your web root directory
cd /var/www

# Clone your project from your Git repository
sudo git clone <YOUR_REPO_URL> scrapflow

# Enter the new directory
cd scrapflow
```
> **Note:** Replace `<YOUR_REPO_URL>` with your actual Git repository URL.

#### Step 2: Install & Build
```bash
# Install all required npm packages
sudo npm install

# Build the optimized production application
sudo npm run build
```

#### Step 3: Configure Nginx
Nginx will act as a reverse proxy to serve your application.

1.  Copy the example configuration to your Nginx sites directory:
    ```bash
    sudo cp nginx.conf.example /etc/nginx/sites-available/scrapflow
    ```
2.  **Edit the file** to set your server's IP address:
    ```bash
    sudo nano /etc/nginx/sites-available/scrapflow
    # Find and replace '192.168.1.100' with your server's static LAN IP.
    ```
3.  Enable the site and restart Nginx:
    ```bash
    sudo ln -s /etc/nginx/sites-available/scrapflow /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    ```

#### Step 4: Launch with PM2
```bash
# From your app directory (/var/www/scrapflow)
pm2 start "npm" --name "scrapflow-app" -- run preview

# Save the process list to have it auto-start on server boot
pm2 save
pm2 startup
# (Run the command outputted by the terminal to complete setup)
```

Your application is now live on your server's IP address!

## 3. Updating the Application

To deploy new changes from your repository:

```bash
cd /var/www/scrapflow

# 1. Pull the latest code
git pull origin main

# 2. Re-install dependencies and rebuild
npm install
npm run build

# 3. Restart the application process
pm2 restart scrapflow-app
```

## 4. Complete Wipe & Reinstall

If you need to completely remove the old installation and start fresh, you can use the provided script.

**WARNING:** This is a destructive operation. It will create a backup of your database but will delete all other application files.

```bash
# Make the script executable
chmod +x scripts/reinstall.sh

# Run the script
./scripts/reinstall.sh
```
The script will guide you through the backup, removal, and reinstallation process. You will need to provide your Git repository URL and server IP inside the script file itself.