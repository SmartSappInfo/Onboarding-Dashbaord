/**
 * Migration script: Seed starter tags for a workspace.
 *
 * Usage:
 *   ts-node --project tsconfig.json src/app/seeds/migrate-tags.ts \
 *     --workspaceId <id> --organizationId <id>
 *
 * This script ONLY creates tag definitions in the `tags` collection.
 * It does NOT apply any tags to existing contacts.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Tag, TagCategory } from '../../lib/types';

// ---------------------------------------------------------------------------
// Firebase Admin initialisation (mirrors src/lib/firebase-admin.ts)
// ---------------------------------------------------------------------------

function initAdmin() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'studio-9220106300-f74cb.appspot.com';

  if (serviceAccountKey?.trim().startsWith('{')) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      return initializeApp({ credential: cert(serviceAccount), storageBucket });
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // Fallback: ambient credentials (e.g. Application Default Credentials)
  return initializeApp({ storageBucket });
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { workspaceId: string; organizationId: string } {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const workspaceId = get('--workspaceId');
  const organizationId = get('--organizationId');

  if (!workspaceId || !organizationId) {
    console.error(
      'Usage: ts-node src/app/seeds/migrate-tags.ts --workspaceId <id> --organizationId <id>'
    );
    process.exit(1);
  }

  return { workspaceId, organizationId };
}

// ---------------------------------------------------------------------------
// Starter tag definitions
// ---------------------------------------------------------------------------

interface StarterTag {
  name: string;
  slug: string;
  category: TagCategory;
  color: string;
  description?: string;
}

const STARTER_TAGS: StarterTag[] = [
  // Status / lifecycle tags
  {
    name: 'Hot Lead',
    slug: 'hot-lead',
    category: 'status',
    color: '#ef4444',
    description: 'High-priority prospect showing strong buying signals',
  },
  {
    name: 'Active Customer',
    slug: 'active-customer',
    category: 'status',
    color: '#22c55e',
    description: 'Currently active and paying customer',
  },
  {
    name: 'Churned',
    slug: 'churned',
    category: 'status',
    color: '#6b7280',
    description: 'Previously active customer who has cancelled',
  },
  {
    name: 'VIP',
    slug: 'vip',
    category: 'status',
    color: '#f59e0b',
    description: 'High-value account requiring white-glove treatment',
  },
  {
    name: 'Onboarding',
    slug: 'onboarding',
    category: 'status',
    color: '#3b82f6',
    description: 'Currently going through the onboarding process',
  },

  // Engagement tags
  {
    name: 'Highly Engaged',
    slug: 'highly-engaged',
    category: 'engagement',
    color: '#8b5cf6',
    description: 'Frequently interacts with content and communications',
  },
  {
    name: 'Inactive',
    slug: 'inactive',
    category: 'engagement',
    color: '#9ca3af',
    description: 'No meaningful engagement in the past 90 days',
  },
  {
    name: 'Re-engaged',
    slug: 're-engaged',
    category: 'engagement',
    color: '#06b6d4',
    description: 'Previously inactive contact who has re-engaged',
  },

  // Behavioral tags
  {
    name: 'Attended Demo',
    slug: 'attended-demo',
    category: 'behavioral',
    color: '#ec4899',
    description: 'Has attended a product demonstration',
  },
  {
    name: 'Downloaded Brochure',
    slug: 'downloaded-brochure',
    category: 'behavioral',
    color: '#f97316',
    description: 'Has downloaded a product or service brochure',
  },
  {
    name: 'Visited Pricing',
    slug: 'visited-pricing',
    category: 'behavioral',
    color: '#84cc16',
    description: 'Has viewed the pricing page or requested pricing info',
  },

  // Interest tags
  {
    name: 'Interested in Analytics',
    slug: 'interested-in-analytics',
    category: 'interest',
    color: '#14b8a6',
    description: 'Expressed interest in analytics features or reports',
  },
  {
    name: 'Wants Training',
    slug: 'wants-training',
    category: 'interest',
    color: '#a855f7',
    description: 'Has requested or expressed interest in training sessions',
  },
  {
    name: 'Wants Consulting',
    slug: 'wants-consulting',
    category: 'interest',
    color: '#0ea5e9',
    description: 'Interested in consulting or professional services',
  },
];

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function main() {
  const { workspaceId, organizationId } = parseArgs();

  console.log(`\n🏷️  Tag Migration Script`);
  console.log(`   Workspace:    ${workspaceId}`);
  console.log(`   Organization: ${organizationId}`);
  console.log(`   Tags to seed: ${STARTER_TAGS.length}\n`);

  initAdmin();
  const db = getFirestore();

  // Fetch existing slugs for this workspace (idempotency check)
  const existingSnap = await db
    .collection('tags')
    .where('workspaceId', '==', workspaceId)
    .get();

  const existingSlugs = new Set(
    existingSnap.docs.map((d) => d.data().slug as string)
  );

  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  for (const starter of STARTER_TAGS) {
    if (existingSlugs.has(starter.slug)) {
      console.log(`  ⏭  Skipped  "${starter.name}" (slug already exists)`);
      skipped++;
      continue;
    }

    const tagRef = db.collection('tags').doc();
    const tag: Tag = {
      id: tagRef.id,
      workspaceId,
      organizationId,
      name: starter.name,
      slug: starter.slug,
      description: starter.description,
      category: starter.category,
      color: starter.color,
      isSystem: false,
      usageCount: 0,
      createdBy: 'migration-script',
      createdAt: now,
      updatedAt: now,
    };

    await tagRef.set(tag);
    console.log(`  ✅ Created  "${starter.name}" [${starter.category}]`);
    created++;
  }

  console.log(`\n📊 Summary`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total:   ${STARTER_TAGS.length}\n`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
