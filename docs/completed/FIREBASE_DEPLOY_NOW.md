 # Firebase App Hosting Deployment - Ready to Deploy! 🚀

## Current Status

✅ **Firebase CLI**: 15.11.0 (Latest installed)  
✅ **Project**: studio-9220106300-f74cb  
✅ **Build**: Passing (Next.js 16.2.1)  
✅ **Configuration**: App Hosting configured  

## Deployment Type: Firebase App Hosting

Your app uses **Firebase App Hosting** (NOT classic Hosting) because:
- Server-Side Rendering (SSR) with Next.js 16
- Dynamic API routes
- Cloud Functions integration
- Real-time Firebase features

## Quick Deploy (3 Steps)

### Step 1: Login to Firebase
```bash
firebase login
```

### Step 2: Verify Project
```bash
# Check current project
npx -y firebase-tools@latest projects:list

# Should show: studio-9220106300-f74cb (current)
```

### Step 3: Deploy
```bash
# Deploy to App Hosting
npx -y firebase-tools@latest deploy --only apphosting
```

That's it! Your app will be live at:
- `https://studio-9220106300-f74cb.web.app`
- `https://studio-9220106300-f74cb.firebaseapp.com`

## Alternative: Deploy Everything
```bash
# Deploy App Hosting + Firestore rules + Storage rules
npx -y firebase-tools@latest deploy
```

## Preview Before Going Live

### Create a Preview Channel
```bash
# Deploy to a preview channel first
npx -y firebase-tools@latest hosting:channel:deploy preview

# Returns a preview URL like:
# https://studio-9220106300-f74cb--preview-abc123.web.app
```

### Test Preview, Then Promote to Live
```bash
# After testing, promote preview to live
npx -y firebase-tools@latest hosting:clone studio-9220106300-f74cb:preview studio-9220106300-f74cb:live
```

## Environment Variables (IMPORTANT!)

Before deploying, ensure these are set in Firebase Console:

1. Go to: https://console.firebase.google.com/project/studio-9220106300-f74cb
2. Navigate to: **App Hosting** → **Settings** → **Environment Variables**
3. Add these variables:

### Required Variables
```bash
# Firebase Config (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=studio-9220106300-f74cb.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=studio-9220106300-f74cb
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Server-side - KEEP SECRET!)
FIREBASE_SERVICE_ACCOUNT_KEY=your_service_account_json

# External Services
RESEND_API_KEY=your_resend_key
MNOTIFY_API_KEY=your_mnotify_key
GOOGLE_GENAI_API_KEY=your_genai_key

# App URL
NEXT_PUBLIC_APP_URL=https://studio-9220106300-f74cb.web.app
```

## Deployment Checklist

### Pre-Deployment ✅
- [x] Build succeeds locally (`pnpm build`)
- [x] Firebase CLI installed (v15.11.0)
- [ ] Logged into Firebase (`firebase login`)
- [ ] Environment variables set in Firebase Console
- [ ] Git changes committed

### During Deployment
- [ ] Run `npx -y firebase-tools@latest deploy --only apphosting`
- [ ] Monitor build logs
- [ ] Wait for completion (5-10 minutes)
- [ ] Note the deployment URL

### Post-Deployment
- [ ] Test login at: `https://studio-9220106300-f74cb.web.app/login`
- [ ] Verify admin dashboard loads
- [ ] Check Firebase Authentication works
- [ ] Test Firestore queries
- [ ] Verify image uploads
- [ ] Test email/SMS sending
- [ ] Check all protected routes

## Troubleshooting

### Issue: "Not logged in"
```bash
firebase login
```

### Issue: "Project not found"
```bash
# Set the correct project
firebase use studio-9220106300-f74cb
```

### Issue: "Build fails"
```bash
# Test build locally first
pnpm build

# Check for errors in output
```

### Issue: "Environment variables not working"
- Environment variables MUST be set in Firebase Console
- .env files are NOT deployed
- Go to Console → App Hosting → Settings → Environment Variables

### Issue: "Functions timeout"
Update `firebase.json`:
```json
{
  "apphosting": {
    "backendId": "studio",
    "rootDir": "/",
    "runtime": "nodejs20",
    "timeout": "60s",
    "memory": "1GiB"
  }
}
```

## Monitoring After Deployment

### View Logs
```bash
# View function logs
npx -y firebase-tools@latest functions:log

# View recent deployments
npx -y firebase-tools@latest hosting:releases:list
```

### Firebase Console
1. Go to: https://console.firebase.google.com/project/studio-9220106300-f74cb
2. Navigate to: **App Hosting** → **Metrics**
3. Monitor:
   - Request count
   - Error rate
   - Response time
   - Function invocations

## Rollback (If Needed)

```bash
# List previous deployments
npx -y firebase-tools@latest hosting:releases:list

# Rollback to previous version
npx -y firebase-tools@latest hosting:rollback
```

## Cost Estimation

### Firebase Blaze Plan (Pay as you go)
For moderate traffic (~10K users/month):
- **Storage**: ~$1-5/month
- **Data Transfer**: ~$5-20/month
- **Functions**: ~$5-15/month
- **Total**: ~$10-40/month

Free tier includes:
- 10 GB storage
- 360 MB/day data transfer
- 125K function invocations/month

## Next Steps After Deployment

1. **Set up Custom Domain** (Optional)
   ```bash
   npx -y firebase-tools@latest hosting:sites:list
   # Then add domain in Firebase Console
   ```

2. **Enable App Check** (Recommended for security)
   - Prevents unauthorized API usage
   - See: https://firebase.google.com/docs/app-check

3. **Set up CI/CD** (Optional)
   - Automate deployments with GitHub Actions
   - See FIREBASE_DEPLOYMENT_GUIDE.md for GitHub Actions setup

4. **Monitor Performance**
   - Set up alerts in Firebase Console
   - Monitor error rates and response times

## Quick Reference Commands

```bash
# Login
firebase login

# Check project
npx -y firebase-tools@latest projects:list

# Deploy
npx -y firebase-tools@latest deploy --only apphosting

# Preview channel
npx -y firebase-tools@latest hosting:channel:deploy preview

# View logs
npx -y firebase-tools@latest functions:log

# Rollback
npx -y firebase-tools@latest hosting:rollback
```

## Support

- **Firebase Console**: https://console.firebase.google.com/project/studio-9220106300-f74cb
- **Firebase Docs**: https://firebase.google.com/docs/app-hosting
- **Next.js on Firebase**: https://firebase.google.com/docs/hosting/frameworks/nextjs

---

**Ready to Deploy!** 🚀  
Run: `npx -y firebase-tools@latest deploy --only apphosting`
