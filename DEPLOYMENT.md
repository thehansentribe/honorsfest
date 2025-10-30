# Deployment Instructions

## Render.com Deployment

### Prerequisites
- GitHub repository pushed
- Account on https://render.com

### Steps

1. **Create New Web Service**
   - Go to https://render.com/dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select the `honorsfest` repository

2. **Configure Service**
   - **Name**: honorsfest (or any name you prefer)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`

3. **Configure Persistent Storage (CRITICAL)**
   - Click "Disks" tab
   - Click "Connect Disk" or "Add Disk"
   - **Name**: `database-disk`
   - **Size**: 1 GB
   - **Mount Path**: `/var/lib/render`
   - Click "Connect"
   
   **Without this disk, your database will be wiped on every redeploy!**

4. **Set Environment Variables**
   - Click "Environment" tab
   - Add these variables:
   
   | Key | Value | Description |
   |-----|-------|-------------|
   | `JWT_SECRET` | (generate random string) | Secret for JWT tokens |
   | `NODE_ENV` | `production` | Environment setting |
   | `DATABASE_PATH` | `/var/lib/render/database.sqlite` | Path to persisted database |
   
   To generate JWT_SECRET:
   ```bash
   openssl rand -base64 32
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (~5 minutes)

### Initial Login

After deployment is complete:

- **Username**: `admin`
- **Password**: `password123`

**⚠️ IMPORTANT**: Change this password immediately after first login!

### Troubleshooting

#### "Data is being wiped on every deploy" error

**This is the most common issue!** Without persistent storage, Render resets your data on each redeploy.

**Solution**: Follow step 3 above to add a persistent disk. After adding the disk:
1. Go to your service in Render dashboard
2. Click "Shell" 
3. If the database exists but is empty, run: `rm /var/lib/render/database.sqlite` to force re-seed
4. Redeploy the service
5. Your data will now persist across deployments

#### "Invalid credentials" error

If you cannot log in after deployment:

1. Check the logs in Render dashboard
2. Look for "Created default admin user" message
3. If not present, the database needs to be recreated:
   - In Render dashboard, go to your service
   - Click "Shell"
   - Run: `rm /var/lib/render/database.sqlite` (or `rm database.sqlite` if no persistent disk)
   - Redeploy the service

#### Database schema errors

The database will be created automatically on first run. If you see schema errors:
- The app will auto-create all tables
- Run `npm run seed` locally first to test

### Updating the Application

Simply push changes to the `main` branch on GitHub. Render will automatically redeploy.

## Local Development

```bash
# Install dependencies
npm install

# Seed the database
npm run seed

# Start development server
npm run dev
```

The app will be available at http://localhost:3000

## Environment Variables

### Required for Production
- `JWT_SECRET`: Random string (32+ characters recommended)
- `NODE_ENV`: Set to `production`
- `DATABASE_PATH`: Path to SQLite database (set to `/var/lib/render/database.sqlite` when using persistent disk)

### Optional
- `PORT`: Server port (defaults to 3000)

