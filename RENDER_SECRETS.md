# WeShop4U Render Deployment - Environment Variables Guide

## How to Add These to Render

1. Go to your Render service dashboard
2. Click **Settings** → **Environment**
3. Add each variable below by clicking **Add Environment Variable**
4. Copy the key and value exactly as shown
5. Click **Save** and Render will redeploy automatically

---

## Required Environment Variables

### Database & Core

| Key | Value | Source | Notes |
|-----|-------|--------|-------|
| `NODE_ENV` | `production` | Set this | Always production for Render |
| `PORT` | `3000` | Set this | Port Render will use |
| `DATABASE_URL` | `mysql://TRWPPSjpVsMrzts.root:6u6DKIK69yYYzUvaMY42@gateway02.us-east-1.prod.aws.tidbcloud.com:4000/HH4sKdeJGjocgFW8dJxnCN?ssl={"rejectUnauthorized":true}` | Manus Secrets | Your TiDB Cloud connection |
| `PRIMARY_DATABASE_URL` | Same as `DATABASE_URL` | Manus Secrets | Backup database URL |
| `DATABASE_URL_BACKUP` | Same as `DATABASE_URL` | Manus Secrets | Backup database URL |

### Authentication & OAuth

| Key | Value | Source | Notes |
|-----|-------|--------|-------|
| `JWT_SECRET` | [Click pencil in Manus] | Manus Secrets | Keep this secret! |
| `OAUTH_SERVER_URL` | `https://api.manus.im` | Set this | OAuth provider URL |

### Twilio (SMS/Voice)

| Key | Value | Source | Notes |
|-----|-------|--------|-------|
| `TWILIO_ACCOUNT_SID` | [Click pencil in Manus] | Manus Secrets | From Twilio Console |
| `TWILIO_AUTH_TOKEN` | [Click pencil in Manus] | Manus Secrets | From Twilio Console |
| `TWILIO_PHONE_NUMBER` | [Click pencil in Manus] | Manus Secrets | Your Twilio phone number |
| `TWILIO_VERIFY_SERVICE_SID` | [Click pencil in Manus] | Manus Secrets | For SMS verification |

### Elavon (Payment Processing)

| Key | Value | Source | Notes |
|-----|-------|--------|-------|
| `ELAVON_PROCESSOR_ID` | [Click pencil in Manus] | Manus Secrets | Payment processor ID |
| `ELAVON_SECRET_KEY` | [Click pencil in Manus] | Manus Secrets | Keep this secret! |
| `ELAVON_MERCHANT_ALIAS` | [Click pencil in Manus] | Manus Secrets | Your merchant alias |
| `ELAVON_PUBLIC_KEY` | [Click pencil in Manus] | Manus Secrets | Public key for payments |

### Google Maps (Location & Delivery Tracking)

| Key | Value | Source | Notes |
|-----|-------|--------|-------|
| `GOOGLE_MAPS_API_KEY` | [Click pencil in Manus] | Manus Secrets | From Google Cloud Console |

### Frontend URLs

| Key | Value | Source | Notes |
|-----|-------|--------|-------|
| `EXPO_PUBLIC_API_BASE_URL` | `https://weshop4u-ie.onrender.com` | Set this | Your Render domain |
| `PUBLIC_URL` | `https://weshop4u-ie.onrender.com` | Set this | Your Render domain |
| `VITE_FRONTEND_FORGE_API_URL` | `https://weshop4u-ie.onrender.com/api` | Set this | API endpoint |

---

## Step-by-Step Instructions

### 1. Get Values from Manus Secrets

Go to your Manus project → Settings → Application secrets

For each secret below, click the **pencil icon** to reveal the value:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `TWILIO_VERIFY_SERVICE_SID`
- `ELAVON_PROCESSOR_ID`
- `ELAVON_SECRET_KEY`
- `ELAVON_MERCHANT_ALIAS`
- `ELAVON_PUBLIC_KEY`
- `GOOGLE_MAPS_API_KEY`
- `JWT_SECRET`
- `PRIMARY_DATABASE_URL`
- `DATABASE_URL_BACKUP`

### 2. Add to Render

1. Go to https://render.com
2. Select your **weshop4u-backend** service
3. Click **Settings**
4. Scroll to **Environment**
5. Click **Add Environment Variable** for each one
6. Copy the key and value exactly
7. Click **Save** when done

### 3. Render Will Auto-Deploy

Once you save, Render will:
- Pull latest code from GitHub
- Run: `pnpm install --frozen-lockfile && npx expo export --platform web --output-dir web-dist --clear && pnpm run build`
- Start the server with `node dist/index.js`
- Deploy to production

---

## Verification

After deployment, test these endpoints:

- **Health Check**: `https://weshop4u-ie.onrender.com/api/health`
- **Stores API**: `https://weshop4u-ie.onrender.com/api/trpc/stores.list`
- **Web App**: `https://weshop4u-ie.onrender.com/api/web/`

All should return data successfully!

---

## Troubleshooting

**If deployment fails:**
1. Check Render logs for error messages
2. Verify all environment variables are set correctly
3. Ensure DATABASE_URL is exactly as shown above
4. Check that Twilio and Elavon credentials are valid

**If web app shows blank page:**
1. Check browser console for errors
2. Verify `EXPO_PUBLIC_API_BASE_URL` is set to your Render domain
3. Clear browser cache and reload

**If API calls fail:**
1. Verify `DATABASE_URL` is correct
2. Check TiDB Cloud connection is active
3. Verify JWT_SECRET matches what's in Manus
