#!/bin/bash
# Commands to reset database and run seed script on Render
# Copy and paste these commands into the Render shell

# Navigate to project directory
cd ~/project/src || cd src || exit

# Step 1: Backup existing database (optional - comment out if you don't want a backup)
if [ -f "../../database.sqlite" ]; then
  cp ../../database.sqlite ../../database.sqlite.backup.$(date +%Y%m%d_%H%M%S)
  echo "Database backed up"
fi

# Step 2: Remove existing database
rm -f ../../database.sqlite
rm -f database.sqlite
echo "Database deleted"

# Step 3: Run the new seed script
node -e "require('./config/seed-new').seedDatabase();"

echo "Database reset and seeded successfully!"

