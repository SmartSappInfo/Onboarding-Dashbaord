# Firebase Deployment Guide - Next.js 16 App

## Current Configuration

**Project ID**: `studio-9220106300-f74cb`  
**Backend ID**: `studio`  
**Deployment Type**: Firebase App Hosting (with Cloud Functions)

## Prerequisites

### 1. Install Firebase CLI
```bash
# Install globally using npm
npm install -g firebase-tools

# Or using pnpm
pnpm add -g firebase-tools

# Verify installation
firebase --version
```

### 2. Login to Firebase
```bash
firebase login
```

## Deployment Methods

### Method 1: Firebase App Hosting (Recommended for Next.js 16)

Firebase App Hosting is designed for full-stack frameworks like Next.js and automatically handles:
- Server-side rendering (SSR)
- API routes
- Dynamic content
- Image optimization
- Cloud Functions deployment

#### Step 1: Ensure Build Success
```bash
# Run production build locally first
pnpm build

# Verify no errors
```

#### Step 2: Deploy to App Hosting
```bash
# Deploy using Firebase CLI
firebase deploy --only apphosting

# Or deploy everything
firebase deploy
```

#### Step 3: Monitor Deployment
The CLI will show:
- Build progress
- Function deployment status
- Hosting URL
- Any errors or warnings

### Method 2: Manual Deployment via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `studio-9220106300-f74cb`
3. Navigate to **App Hosting** section
4. Click **Deploy** or **Create new backend**
5. Connect to GitHub repository
6. Configure build settings:
   - **Root directory**: `/`
   - **Build command**: `pnpm build`
   - **Output directory**: `.next`
7. Deploy

## Configuration Files

### firebase.json (Current)
```json
{
  "apphosting": {
    "backendId": "studio",
    "rootDir": "/",
    "ignore": [
      "node_modules",
      ".git",
      "firebase-debug.log",
      "firebase-debug.*.log",
      "functions"
    ]
  }
}
```

### .firebaserc (Current)
```json
{
  "projects": {
    "default": "studio-9220106300-f74cb"
  }
}
```

## Environment Variables

### Required for Production

You need to set these in Firebase Console:

1. Go to **App Hosting** → **Settings** → **Environment Variables**
2. Add the following:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=studio-9220106300-f74cb
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Server-side)
FIREBASE_SERVICE_ACCOUNT_KEY=your_service_account_json

# Other Services
RESEND_API_KEY=your_resend_key
MNOTIFY_API_KEY=your_mnotify_key
GOOGLE_GENAI_API_KEY=your_genai_key

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-app-url.web.app
```

## Build Configuration

### next.config.ts
Your current configuration is already optimized for Firebase:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone', // ✅ Required for App Hosting
  allowedDevOrigins: ['10.155.120.120'],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  // ... rest of config
};
```

## Deployment Checklist

### Pre-Deployment
- [x] ✅ Build succeeds locally (`pnpm build`)
- [x] ✅ All tests pass (`pnpm test:run`)
- [x] ✅ TypeScript checks pass (`pnpm typecheck`)
- [x] ✅ Linting passes (`pnpm lint`)
- [ ] Environment variables configured in Firebase Console
- [ ] Firebase CLI installed and authenticated
- [ ] Git changes committed and pushed

### During Deployment
- [ ] Run `firebase deploy --only apphosting`
- [ ] Monitor build logs for errors
- [ ] Wait for deployment to complete (usually 5-10 minutes)
- [ ] Note the deployment URL

### Post-Deployment
- [ ] Test login functionality
- [ ] Verify admin dashboard loads
- [ ] Check Firebase Authentication integration
- [ ] Test Firestore queries
- [ ] Verify image uploads work
- [ ] Test email/SMS sending
- [ ] Check all protected routes
- [ ] Monitor Cloud Functions logs

## Deployment Commands

### Full Deployment
```bash
# Deploy everything (App Hosting + Firestore rules + Storage rules)
firebase deploy
```

### App Hosting Only
```bash
# Deploy just the Next.js app
firebase deploy --only apphosting
```

### With Preview
```bash
# Create a preview deployment (doesn't affect production)
firebase hosting:channel:deploy preview
```

### Rollback
```bash
# List previous deployments
firebase hosting:releases:list

# Rollback to a specific version
firebase hosting:rollback
```

## Troubleshooting

### Issue: Build Fails
**Solution**: Check build logs in Firebase Console
```bash
# Test build locally first
pnpm build

# Check for errors in .next/build-manifest.json
```

### Issue: Environment Variables Not Working
**Solution**: Ensure they're set in Firebase Console, not just .env file
- App Hosting doesn't read .env files
- Must be configured in Console → App Hosting → Settings

### Issue: Functions Timeout
**Solution**: Increase timeout in firebase.json
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

### Issue: Cold Start Performance
**Solution**: Enable minimum instances
```json
{
  "apphosting": {
    "backendId": "studio",
    "rootDir": "/",
    "minInstances": 1
  }
}
```

### Issue: Image Optimization Fails
**Solution**: Ensure Firebase Storage rules allow public read
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Performance Optimization

### 1. Enable Caching
Add to `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  // ... existing config
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],
};
```

### 2. Optimize Images
Already configured in your app:
- Using Next.js Image component
- Firebase Storage integration
- Automatic optimization

### 3. Enable Compression
Firebase App Hosting automatically enables:
- Brotli compression
- Gzip fallback
- Asset minification

## Monitoring & Logs

### View Deployment Logs
```bash
# View recent deployments
firebase hosting:releases:list

# View function logs
firebase functions:log
```

### Firebase Console Monitoring
1. Go to Firebase Console
2. Navigate to **App Hosting** → **Metrics**
3. Monitor:
   - Request count
   - Error rate
   - Response time
   - Function invocations

### Set Up Alerts
1. Go to **Monitoring** → **Alerts**
2. Create alerts for:
   - High error rate
   - Slow response times
   - Function failures

## CI/CD Integration (Optional)

### GitHub Actions
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: studio-9220106300-f74cb
```

## Cost Estimation

### Firebase App Hosting Pricing
- **Free Tier**: 
  - 10 GB storage
  - 360 MB/day data transfer
  - 125K function invocations/month

- **Blaze Plan** (Pay as you go):
  - $0.026 per GB storage
  - $0.15 per GB data transfer
  - $0.40 per million function invocations

### Estimated Monthly Cost
For a typical app with moderate traffic:
- Storage: ~$1-5
- Data Transfer: ~$5-20
- Functions: ~$5-15
- **Total**: ~$10-40/month

## Support Resources

- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Next.js on Firebase](https://firebase.google.com/docs/hosting/frameworks/nextjs)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Firebase Console](https://console.firebase.google.com/)

## Quick Start Commands

```bash
# 1. Install Firebase CLI
pnpm add -g firebase-tools

# 2. Login
firebase login

# 3. Verify project
firebase projects:list

# 4. Build locally
pnpm build

# 5. Deploy
firebase deploy --only apphosting

# 6. View deployment
firebase hosting:sites:list
```

---

**Status**: Ready for Deployment 🚀  
**Last Updated**: 2026-03-23  
**Next.js Version**: 16.2.1  
**Firebase Project**: studio-9220106300-f74cb
