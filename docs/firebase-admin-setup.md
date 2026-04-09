# Firebase Admin SDK Setup Guide

## The Error
```
Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.
```

This error occurs when the Firebase Admin SDK cannot find valid service account credentials.

## Solution Options

### Option 1: Using Service Account Key JSON (Recommended for Development)

1. **Download Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings (gear icon) → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file as `serviceAccountKey.json` in your project root

2. **Add to .gitignore** (IMPORTANT - Never commit this file!):
   ```bash
   echo "serviceAccountKey.json" >> .gitignore
   ```

3. **Set Environment Variable**:
   
   Add to your `.env.local` file:
   ```bash
   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
   ```

   OR use the JSON content directly (better for production):
   ```bash
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
   ```

### Option 2: Using Environment Variable (Recommended for Production)

1. Copy the entire content of your service account JSON file

2. Add to `.env.local` (development) or your hosting platform's environment variables (production):
   ```bash
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"studio-9220106300-f74cb","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'
   ```

### Option 3: Using Application Default Credentials (Production Only)

For Google Cloud Platform deployments (Cloud Run, App Engine, etc.):
- No configuration needed
- The platform automatically provides credentials
- This won't work in local development

## Verifying Your Setup

After setting up credentials, restart your development server:

```bash
# Stop the server (Ctrl+C)
# Then restart
pnpm dev
```

## Troubleshooting

### Issue: "Could not load the default credentials"
- **Cause**: No service account key configured
- **Fix**: Follow Option 1 or 2 above

### Issue: "Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY"
- **Cause**: Invalid JSON in environment variable
- **Fix**: Ensure the JSON is properly escaped and on a single line

### Issue: "Permission denied"
- **Cause**: Service account doesn't have proper permissions
- **Fix**: In Firebase Console → IAM & Admin, ensure the service account has "Firebase Admin SDK Administrator Service Agent" role

### Issue: Environment variable not loading
- **Cause**: Using `.env` instead of `.env.local` in development
- **Fix**: Create `.env.local` file (this is automatically loaded by Next.js and not committed to git)

## Security Best Practices

1. ✅ **DO**: Use `.env.local` for local development
2. ✅ **DO**: Add `serviceAccountKey.json` to `.gitignore`
3. ✅ **DO**: Use environment variables in production
4. ❌ **DON'T**: Commit service account keys to version control
5. ❌ **DON'T**: Share service account keys publicly
6. ❌ **DON'T**: Use the same service account for development and production

## Quick Fix for Development

If you need to get up and running quickly:

```bash
# 1. Download your service account key from Firebase Console
# 2. Save it as serviceAccountKey.json in project root
# 3. Add to .env.local:
echo 'FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json' >> .env.local

# 4. Restart your dev server
pnpm dev
```

## For Production Deployment

When deploying to Vercel, Netlify, or other platforms:

1. Go to your project's environment variables settings
2. Add `FIREBASE_SERVICE_ACCOUNT_KEY` with the full JSON content
3. Make sure to escape special characters properly
4. Redeploy your application

## Testing Your Setup

Create a test file to verify credentials are working:

```typescript
// test-firebase-admin.ts
import { adminDb } from './src/lib/firebase-admin';

async function testConnection() {
  try {
    const orgsRef = adminDb.collection('organizations');
    const snapshot = await orgsRef.limit(1).get();
    console.log('✅ Firebase Admin SDK connected successfully!');
    console.log(`Found ${snapshot.size} organization(s)`);
  } catch (error) {
    console.error('❌ Firebase Admin SDK connection failed:', error);
  }
}

testConnection();
```

Run with:
```bash
npx tsx test-firebase-admin.ts
```
