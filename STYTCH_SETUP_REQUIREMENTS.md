# Stytch Setup Requirements

Before implementing Stytch authentication, please provide the following information and complete these steps:

## Required Information from You

### 1. Stytch Dashboard Access
- Create a Stytch account at https://stytch.com
- Create a new Consumer project (or use existing one)
- Provide the following credentials from your Stytch Dashboard:

### 2. Required Stytch Credentials
Please provide these values from your Stytch Dashboard (https://stytch.com/dashboard):

- **Project ID**: Found in Dashboard → API Keys section
- **Secret Key**: Found in Dashboard → API Keys section (Test environment)
- **Public Token**: Found in Dashboard → API Keys section (Test environment)
  - This is labeled as "Publishable token" in the dashboard

### 3. Environment Configuration
- **Environment**: Will you be using "test" or "live" mode initially?
  - Test mode is recommended for development

## Steps You Need to Complete in Stytch Dashboard

### Step 1: Enable Email Magic Links Product
1. Go to https://stytch.com/dashboard
2. Navigate to "Products" or "Settings"
3. Enable "Email Magic Links" product
4. Confirm it's activated for your project

### Step 2: Configure Redirect URLs
1. Go to Dashboard → Redirect URLs or Email Magic Links settings
2. Add the following redirect URLs:
   - **Development**: `http://localhost:3000/authenticate.html`
   - **Production**: `https://your-render-app.onrender.com/authenticate.html`
     (Replace `your-render-app` with your actual Render service URL)

### Step 3: Enable Frontend SDKs
1. Go to Dashboard → Settings → SDK Configuration
2. Enable "Frontend SDKs" for your project
3. This allows the Stytch JavaScript SDK to run in the browser

### Step 4: Configure Email Templates (Optional)
- You can customize the magic link email template if desired
- Default template will work fine for initial setup

## What Will Be Configured

Once you provide the credentials, I will:
1. Add environment variables to `.env` file
2. Add environment variables to Render dashboard for production
3. Configure the Stytch client in the code
4. Set up the authentication flow

## Security Notes

- Keep your Stytch Secret key secure (never commit to git)
- The Secret key will only be used server-side
- The Public token is safe to expose in frontend code
- All credentials will be added to `.gitignore` protected files

## Testing Checklist

After implementation, we'll test:
- [ ] New user registration with Stytch magic link
- [ ] Magic link email delivery
- [ ] Authentication callback processing
- [ ] JWT token generation after Stytch auth
- [ ] Existing password users can still log in
- [ ] Role-based dashboard redirects work correctly

---

**Please provide the Stytch credentials once you have them set up in the dashboard.**

