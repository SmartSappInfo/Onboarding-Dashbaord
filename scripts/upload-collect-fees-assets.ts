/**
 * Uploads the "Collect Your Fees Within 4 Weeks" landing page assets
 * (extracted from the Kartra MHTML backup) to Firebase Storage and
 * registers each one in the `media` Firestore collection.
 *
 * Usage: pnpm tsx scripts/upload-collect-fees-assets.ts
 *
 * Outputs src/app/collect-fees-within-four-weeks/assets.json mapping
 * asset keys -> public download URLs for the page component to consume.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const STAGING_DIR = '/tmp/cf_assets';
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'app', 'collect-fees-within-four-weeks', 'assets.json');

interface AssetSpec {
  key: string;
  file: string;       // relative to STAGING_DIR
  type: 'image' | 'video';
  mimeType: string;
}

const ASSETS: AssetSpec[] = [
  { key: 'logo',            file: 'images/smartsapp-logo-with-name.png',                    type: 'image', mimeType: 'image/png' },
  { key: 'heroThumb',       file: 'images/thumb-fee-collection-hero.gif',                   type: 'image', mimeType: 'image/gif' },
  { key: 'frustratedAdmin', file: 'images/administrator-frustrated-fee-collection-delays.gif', type: 'image', mimeType: 'image/gif' },
  { key: 'seriousAdmin',    file: 'images/serious-administrator.gif',                       type: 'image', mimeType: 'image/gif' },
  { key: 'salesThumb',      file: 'images/thumb-how-to-collect-fees.gif',                   type: 'image', mimeType: 'image/gif' },
  { key: 'billNotify',      file: 'images/bill-notify-collect.png',                         type: 'image', mimeType: 'image/png' },
  { key: 'paymentMethods',  file: 'images/payment-methods.png',                             type: 'image', mimeType: 'image/png' },
  { key: 'businesswomanBg', file: 'images/happy-businesswoman-office.jpg',                  type: 'image', mimeType: 'image/jpeg' },
  { key: 'guaranteeBadge',  file: 'images/guarantee-badge.png',                             type: 'image', mimeType: 'image/png' },
  { key: 'faqBg',           file: 'images/faq-illustration.png',                            type: 'image', mimeType: 'image/png' },
  { key: 'sectionBg',       file: 'images/section-bg-pattern.png',                          type: 'image', mimeType: 'image/png' },
  { key: 'berthaThumb',     file: 'images/thumb-bertha-northhills.gif',                     type: 'image', mimeType: 'image/gif' },
  { key: 'derekThumb',      file: 'images/thumb-derek-sunflower.jpg',                       type: 'image', mimeType: 'image/jpeg' },
  { key: 'evansThumb',      file: 'images/thumb-evans-exquisite.jpg',                       type: 'image', mimeType: 'image/jpeg' },
  { key: 'williamThumb',    file: 'images/thumb-william-aristoland.jpg',                    type: 'image', mimeType: 'image/jpeg' },
  { key: 'heroVideo',       file: 'videos/hero-campaign-fee-collection.mp4',                type: 'video', mimeType: 'video/mp4' },
  { key: 'salesVideo',      file: 'videos/fee-payment-sales-video.mp4',                     type: 'video', mimeType: 'video/mp4' },
  { key: 'berthaVideo',     file: 'videos/testimonial-bertha-northhills.mp4',               type: 'video', mimeType: 'video/mp4' },
  { key: 'derekVideo',      file: 'videos/testimonial-derek-sunflower.mp4',                 type: 'video', mimeType: 'video/mp4' },
  { key: 'evansVideo',      file: 'videos/testimonial-evans-exquisite.mp4',                 type: 'video', mimeType: 'video/mp4' },
  { key: 'williamVideo',    file: 'videos/testimonial-william-aristoland.mp4',              type: 'video', mimeType: 'video/mp4' },
];

async function initApp() {
  if (getApps().length) return getApps()[0];
  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (keyJson && keyJson.trim().startsWith('{')) {
    return initializeApp({ credential: cert(JSON.parse(keyJson)) });
  }
  if (keyPath) {
    return initializeApp({ credential: cert(keyPath) });
  }
  throw new Error('No FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH set.');
}

async function resolveBucket(app: ReturnType<typeof initializeApp>) {
  const candidates = [
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    'studio-9220106300-f74cb.firebasestorage.app',
    'studio-9220106300-f74cb.appspot.com',
  ].filter(Boolean) as string[];

  for (const name of candidates) {
    const bucket = getStorage(app).bucket(name);
    try {
      const [exists] = await bucket.exists();
      if (exists) {
        console.log(`Using bucket: ${name}`);
        return bucket;
      }
      console.warn(`Bucket not found: ${name}`);
    } catch (e) {
      console.warn(`Bucket check failed for ${name}:`, (e as Error).message);
    }
  }
  throw new Error('No usable storage bucket found.');
}

async function main() {
  const app = await initApp();
  const bucket = await resolveBucket(app);
  const db = getFirestore(app);

  // Load partial progress so re-runs skip already-uploaded assets.
  let urlMap: Record<string, string> = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    urlMap = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  }

  for (const asset of ASSETS) {
    if (urlMap[asset.key]) {
      console.log(`SKIP  ${asset.key} (already uploaded)`);
      continue;
    }
    const localPath = path.join(STAGING_DIR, asset.file);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Missing staged file: ${localPath}`);
    }
    const filename = path.basename(asset.file);
    const storagePath = `media/${asset.type}/${Date.now()}-${filename}`;
    const token = randomUUID();
    const size = fs.statSync(localPath).size;

    console.log(`UPLOAD ${asset.key} -> ${storagePath} (${(size / 1e6).toFixed(1)} MB)`);
    await bucket.upload(localPath, {
      destination: storagePath,
      resumable: size > 10_000_000,
      metadata: {
        contentType: asset.mimeType,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

    await db.collection('media').add({
      name: filename,
      originalName: filename,
      url,
      fullPath: storagePath,
      type: asset.type,
      mimeType: asset.mimeType,
      size,
      uploadedBy: 'script:upload-collect-fees-assets',
      workspaceIds: ['onboarding'],
      createdAt: new Date().toISOString(),
    });

    urlMap[asset.key] = url;
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(urlMap, null, 2));
    console.log(`DONE  ${asset.key}`);
  }

  console.log(`\nAll ${ASSETS.length} assets uploaded. Map written to ${OUTPUT_PATH}`);
}

main().catch(e => {
  console.error('FAILED:', e);
  process.exit(1);
});
