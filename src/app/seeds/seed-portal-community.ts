/**
 * {{Org_name}} Experience Platform — Seed Portal Community
 *
 * Seeds community spaces, interactive posts, and discussions into the Academy portal.
 *
 * Usage:
 *   npx tsx src/app/seeds/seed-portal-community.ts [orgId]
 */

import { adminDb } from '@/lib/firebase-admin';
import { CommunityService } from '@/lib/services/community-service';

export async function seedPortalCommunity(targetOrgId: string = 'smartsapp-hq') {
  console.log(`\n🚀 [SEED] Starting Portal Community seed for org: ${targetOrgId}...`);

  // Find Academy portal
  const academySnap = await adminDb
    .collection('portals')
    .where('organizationId', '==', targetOrgId)
    .where('slug', '==', 'academy')
    .limit(1)
    .get();

  if (academySnap.empty) {
    console.log('ℹ️ [SEED] Academy portal not found. Please run seed-experience-portals.ts first.');
    return;
  }

  const academyPortal = academySnap.docs[0].data();
  const portalId = academyPortal.id;
  const workspaceIds = academyPortal.workspaceIds || ['onboarding'];

  // 1. Create Spaces with Deterministic IDs
  const now = new Date().toISOString();
  
  const space1Ref = adminDb.collection('community_spaces').doc(`space_${portalId}_general`);
  const space1 = {
    id: space1Ref.id,
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    name: 'General Discussion',
    slug: 'general',
    description: 'Open discussion forum for all school heads, bursars, and administrators.',
    icon: '💬',
    visibility: 'members_only',
    allowedPlanIds: [],
    order: 1,
    postCount: 1,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
  await space1Ref.set(space1, { merge: true });
  console.log(`✅ [SEED] Created Space: "${space1.name}"`);

  const space2Ref = adminDb.collection('community_spaces').doc(`space_${portalId}_announcements`);
  const space2 = {
    id: space2Ref.id,
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    name: 'Announcements',
    slug: 'announcements',
    description: 'Official masterclass updates, feature releases, and upcoming live AMAs.',
    icon: '📢',
    visibility: 'public',
    allowedPlanIds: [],
    order: 2,
    postCount: 0,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  await space2Ref.set(space2, { merge: true });
  console.log(`✅ [SEED] Created Space: "${space2.name}"`);

  const space3Ref = adminDb.collection('community_spaces').doc(`space_${portalId}_wins`);
  const space3 = {
    id: space3Ref.id,
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    name: 'Wins & Celebrations',
    slug: 'wins',
    description: 'Share recovered tuition fees, enrollment milestones, and bursary achievements!',
    icon: '🎉',
    visibility: 'members_only',
    allowedPlanIds: [],
    order: 3,
    postCount: 0,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  await space3Ref.set(space3, { merge: true });
  console.log(`✅ [SEED] Created Space: "${space3.name}"`);

  const space4Ref = adminDb.collection('community_spaces').doc(`space_${portalId}_tuition_qa`);
  const space4 = {
    id: space4Ref.id,
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    name: 'Tuition & Fee Q&A',
    slug: 'tuition-fee-qa',
    description: 'Get help with WhatsApp payment reminders, bank settlement reconciliation, and parent inquiries.',
    icon: '💳',
    visibility: 'members_only',
    allowedPlanIds: [],
    order: 4,
    postCount: 0,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  await space4Ref.set(space4, { merge: true });
  console.log(`✅ [SEED] Created Space: "${space4.name}"`);

  // 2. Create Flagship Post with Interactive Poll
  const post1Ref = adminDb.collection('community_posts').doc(`post_${portalId}_parent_payment_channel_2026`);
  const post1 = {
    id: post1Ref.id,
    organizationId: targetOrgId,
    portalId,
    spaceId: space1.id,
    workspaceIds,
    authorId: 'system_admin',
    authorName: 'Dr. Kwame Mensah',
    authorRole: 'instructor',
    type: 'poll',
    title: 'What payment channel do your school parents prefer most in 2026?',
    slug: 'parent-payment-channel-preference-2026',
    content: `We are benchmarking collection speed across 50+ private schools. Please vote in the poll below and share what challenges you face with bank reconciliation in the comments!`,
    poll: {
      question: 'Which payment option settles tuition fastest at your institution?',
      options: [
        { id: 'opt_1', text: 'WhatsApp Direct Payment Links (Mobile Money)', votesCount: 28, voterUserIds: [] },
        { id: 'opt_2', text: 'Bank Counter Cash Deposits', votesCount: 14, voterUserIds: [] },
        { id: 'opt_3', text: 'Point of Sale (POS) Terminals on Campus', votesCount: 6, voterUserIds: [] },
        { id: 'opt_4', text: 'Direct Bank Cheques', votesCount: 2, voterUserIds: [] },
      ],
      totalVotes: 50,
      isClosed: false,
    },
    likesCount: 19,
    likedByUserIds: [],
    commentsCount: 1,
    isPinned: true,
    isLocked: false,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  };
  await post1Ref.set(post1, { merge: true });
  console.log(`✅ [SEED] Created Post with Poll: "${post1.title}"`);

  // 3. Create Seed Comments on Post 1
  const comment1Ref = adminDb.collection('community_comments').doc(`comment_${portalId}_post1_feedback`);
  const comment1 = {
    id: comment1Ref.id,
    organizationId: targetOrgId,
    portalId,
    spaceId: space1.id,
    postId: post1.id,
    authorId: 'system_admin',
    authorName: 'Sister Mary Teresa',
    authorRole: 'member',
    content: 'Switching to automated WhatsApp payment links reduced our uncollected fees by 42% in Term 1 alone! The parents love the instant receipts.',
    likesCount: 7,
    likedByUserIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await comment1Ref.set(comment1, { merge: true });

  console.log(`\n✨ [SEED] Portal Community seeding complete!\n`);
}

// Execute if run directly
if (process.argv[1]?.includes('seed-portal-community')) {
  const orgArg = process.argv[2] || 'smartsapp-hq';
  seedPortalCommunity(orgArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ [SEED] Error seeding community:', err);
      process.exit(1);
    });
}
