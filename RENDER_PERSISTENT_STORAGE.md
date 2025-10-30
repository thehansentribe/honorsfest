# Render Persistent Storage Setup Guide

## The Problem
Without persistent storage, Render's file system is **ephemeral** - meaning it gets wiped on every deployment. This causes your database to be recreated and reseeded each time you push code.

## The Solution
Add a **persistent disk** to your Render service that survives deployments.

## Step-by-Step Instructions

### For Existing Services (Your Current Setup)

1. **Go to your Render dashboard**
   - Navigate to https://render.com/dashboard
   - Click on your `honorsfest` service

2. **Add a Persistent Disk**
   - Click on the **"Disks"** tab
   - Click **"Connect Disk"**
   - Fill in the details:
     - **Name**: `database-disk`
     - **Size**: `1 GB`
     - **Mount Path**: `/var/lib/render`
   - Click **"Connect"**
   - Wait for it to finish connecting

3. **Update Environment Variables**
   - Click on the **"Environment"** tab
   - Add a new variable:
     - **Key**: `DATABASE_PATH`
     - **Value**: `/var/lib/render/database.sqlite`
   - Click **"Save Changes"**

4. **Redeploy Your Service**
   - Go back to "Dashboard"
   - Click **"Manual Deploy"** → **"Deploy latest commit"**
   - Wait for deployment to complete

5. **Verify It's Working**
   - After deployment, your database will be at `/var/lib/render/database.sqlite`
   - Create some test data
   - Push a minor code change (or manually redeploy)
   - Your data should still be there!

### For New Services

The `render.yaml` file I created will automatically configure persistent storage for any new deployments. Just make sure to:
- Follow the steps in `DEPLOYMENT.md`
- The disk will be created automatically

## Verification Commands

You can verify your disk is set up correctly by using Render's Shell:

1. In Render dashboard, go to your service
2. Click **"Shell"**
3. Run these commands:

```bash
# Check that the disk is mounted
ls -la /var/lib/render

# Check your database path
echo $DATABASE_PATH

# If database exists, check its size
ls -lh /var/lib/render/database.sqlite
```

## Troubleshooting

### "Disk not found" or permission errors
- Make sure the disk name exactly matches `database-disk`
- Ensure mount path is exactly `/var/lib/render`
- Redeploy the service after adding the disk

### Database still getting wiped
- Verify `DATABASE_PATH` environment variable is set to `/var/lib/render/database.sqlite`
- Check that the disk is actually connected in the "Disks" tab
- Try manually creating a file on the disk: `echo "test" > /var/lib/render/test.txt` in the shell
- If that file disappears on redeploy, the disk isn't connected properly

### Database exists but is empty after adding disk
- This is expected on the first deploy with the disk
- The database needs to be recreated from scratch:
  ```bash
  rm /var/lib/render/database.sqlite
  ```
- Then redeploy - the seed script will populate it

## Important Notes

- **Free tier**: Persistent disks on Render's free tier may have limitations
- **Cost**: Disk storage may incur charges on paid plans (1GB is typically free/low cost)
- **Backups**: You should still back up your database regularly - consider adding automated backups
- **Database size**: The 1GB disk is plenty for now, but monitor disk usage as your data grows

## Next Steps After Setup

1. Test that your data persists across deployments
2. Consider setting up automated database backups
3. Monitor disk usage in the Render dashboard
4. Keep your `DEPLOYMENT.md` updated with any changes

