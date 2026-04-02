# WeShop4U Deployment Guide

## Production Deployment (Render.com)

### Live Website
**URL:** https://weshop4u-ie.onrender.com

### Architecture
- **Backend:** Node.js/Express on Render.com (always-on)
- **Database:** TiDB Cloud (MySQL-compatible)
- **Frontend:** React web app (built fresh on Render)
- **Mobile App:** React Native (APK via Expo)

---

## Critical Deployment Lesson

### The Problem We Solved
When deploying an Expo web app to a new host, **never use a pre-built web-dist** from the development environment. The compiled JavaScript contains hardcoded URLs from the original build environment.

**Example of what went wrong:**
- Built web-dist on Manus sandbox (port 8081)
- Deployed to Render
- Frontend still tried to call `3000-xxxxx.manus.computer` instead of the Render backend
- Manus sandbox hibernated → website died

### The Solution
**Always rebuild web-dist on the target deployment server**, not locally.

---

## Deployment Steps for Render.com

### 1. Connect Repository
- Push code to GitHub
- Connect GitHub repo to Render.com

### 2. Set Environment Variables
In Render dashboard, set these variables:

```
DATABASE_URL=mysql://username:password@gateway02.us-east-1.prod.aws.tidbcloud.com:4000/weshop4u?ssl={"rejectUnauthorized":true}
NODE_ENV=production
JWT_SECRET=your-secret-key
OAUTH_SERVER_URL=https://api.manus.im
```

### 3. Configure Build Command
Set the build command to rebuild web-dist fresh:

```bash
pnpm install --frozen-lockfile && npx expo export --platform web --output-dir web-dist --clear && pnpm run build
```

This ensures:
- Dependencies are installed
- Web app is compiled fresh with correct URLs
- Backend is built and ready

### 4. Configure Start Command
```bash
node dist/index.js
```

### 5. Critical Server Configuration
In `server/_core/index.ts`, ensure the server binds to all interfaces:

```typescript
server.listen(port, '0.0.0.0', () => {
  console.log(`[Server] listening on port ${port}`);
});
```

**Why:** Render requires services to listen on `0.0.0.0`, not just `localhost`.

---

## Verification Checklist

After deployment:

- [ ] Website loads at https://weshop4u-ie.onrender.com
- [ ] All 5 stores display correctly
- [ ] Products load from each store
- [ ] Search functionality works
- [ ] Login/authentication works
- [ ] No console errors in browser DevTools
- [ ] API calls go to Render backend, not Manus
- [ ] Database connection is healthy

---

## Troubleshooting

### Website shows "Cannot GET /api/web/"
- Check that web-dist was rebuilt during deployment
- Verify build command includes `npx expo export --platform web --output-dir web-dist --clear`
- Check Render build logs for errors

### API calls fail or timeout
- Verify DATABASE_URL in Render environment variables
- Check TiDB Cloud connection is active
- Verify JWT_SECRET is set
- Check Render logs for database errors

### Server won't start
- Ensure `server.listen(port, '0.0.0.0')` is used
- Check that all environment variables are set
- Review Render deployment logs

---

## Local Development

To test locally before deploying:

```bash
# Install dependencies
pnpm install

# Start dev server (runs both backend and metro)
pnpm dev

# Or run separately:
pnpm dev:server    # Backend on port 3000
pnpm dev:metro     # Frontend on port 8081
```

Access at: http://localhost:8081

---

## Mobile App Deployment

The APK is built separately and doesn't depend on the web deployment:

```bash
# Build APK
eas build --platform android --profile preview

# Or locally
pnpm android
```

The APK connects directly to TiDB Cloud, so it works independently of the website.

---

## Database Management

### TiDB Cloud Connection
- Host: `gateway02.us-east-1.prod.aws.tidbcloud.com`
- Port: `4000`
- Database: `weshop4u`
- User: `TRWPPSjpVsMrzts.root`

### Backup Strategy
- TiDB Cloud provides automatic backups
- Monitor database health in TiDB Cloud dashboard
- Keep connection credentials secure

---

## Future Deployments

When redeploying to Render:

1. Push changes to GitHub
2. Render automatically rebuilds and deploys
3. Build process will:
   - Install dependencies
   - Rebuild web-dist fresh (with correct URLs)
   - Build backend
   - Start server

**No manual steps needed** — just push and Render handles the rest.

---

## Performance Notes

- Website loads in ~2-3 seconds (first load)
- Subsequent loads cached by browser
- API responses typically <500ms
- Database queries optimized with indexes on frequently searched fields

---

## Support & Monitoring

- Monitor Render dashboard for deployment status
- Check TiDB Cloud dashboard for database health
- Review server logs in Render for errors
- Test website regularly to ensure uptime

