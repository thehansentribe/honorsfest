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

3. **Set Environment Variables**
   - Click "Environment" tab
   - Add these variables:
   
   | Key | Value | Description |
   |-----|-------|-------------|
   | `JWT_SECRET` | (generate random string) | Secret for JWT tokens |
   | `NODE_ENV` | `production` | Environment setting |
   
   To generate JWT_SECRET:
   ```bash
   openssl rand -base64 32
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (~5 minutes)

### Initial Login

After deployment is complete:

- **Username**: `admin`
- **Password**: `password123`

**⚠️ IMPORTANT**: Change this password immediately after first login!

### Troubleshooting

#### "Invalid credentials" error

If you cannot log in after deployment:

1. Check the logs in Render dashboard
2. Look for "Created default admin user" message
3. If not present, the database needs to be recreated:
   - In Render dashboard, go to your service
   - Click "Shell"
   - Run: `rm database.sqlite`
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

### Optional
- `PORT`: Server port (defaults to 3000)
- `DATABASE_PATH`: Path to SQLite database (defaults to `./database.sqlite`)

