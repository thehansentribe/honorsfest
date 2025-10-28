# Honors Festival - Setup Instructions

## Installation

### Option 1: Install with Build Tools (Recommended)

**For macOS:**
```bash
# Install Xcode Command Line Tools (if not already installed)
xcode-select --install

# Navigate to project directory
cd /Users/jasonhansen/Documents/Honorsfest

# Install dependencies (this will compile better-sqlite3)
npm install
```

**If npm install fails with better-sqlite3 compilation errors:**

### Option 2: Use Prebuilt Binary

Try installing a pre-built version:
```bash
npm install better-sqlite3@8.6.0 --save
npm install
```

### Option 3: Install with nvm (Node Version Manager)

```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 20 (more stable with better-sqlite3)
nvm install 20
nvm use 20

# Now try installing
npm install
```

### Option 4: Force Install

```bash
npm install --force
```

### Option 5: Use Docker (Bypass Native Compilation Issues)

Create a `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
```

Then run:
```bash
docker build -t honors-festival .
docker run -p 3000:3000 honors-festival
```

## Database Initialization

After successfully installing dependencies:

```bash
# This will:
# 1. Create the database
# 2. Load 527 honors
# 3. Create default admin account
npm run seed
```

Expected output:
```
Database schema initialized
Inserted 527 honors
Created default admin user: admin / password123
Database seeding completed successfully
```

## Starting the Server

```bash
# Development mode (with auto-reload on file changes)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## Verification

1. Visit `http://localhost:3000`
2. You should see the login page
3. Login with:
   - **Username**: `admin`
   - **Password**: `password123`
4. You'll be redirected to the Admin dashboard

## Troubleshooting

### "Module better-sqlite3 not found"
- Make sure `npm install` completed successfully
- Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

### "Cannot find module 'better-sqlite3'"
- Run `npm install better-sqlite3 --save`
- If it fails to compile, see Option 3 above (use Node.js 20)

### Database locked errors
- Delete `database.sqlite` file
- Run `npm run seed` again

### Port 3000 already in use
- Change port in `.env` file: `PORT=3001`
- Or kill the process using port 3000: `lsof -ti:3000 | xargs kill`

## Next Steps

1. Create an event via the Admin dashboard
2. Add locations, clubs, and timeslots
3. Add users (students, teachers)
4. Create classes (assign honors to teachers)
5. Students can register for classes
6. Teachers can mark attendance
7. Generate CSV reports

## Alternative SQL Database

If you continue to have issues with better-sqlite3, you can switch to PostgreSQL for production:

1. Install PostgreSQL
2. Update `.env` with PostgreSQL connection string
3. Update `src/config/db.js` to use pg instead of better-sqlite3
4. Most of the model layer will need to be converted to async/await

The current implementation is optimized for SQLite for ease of deployment.
