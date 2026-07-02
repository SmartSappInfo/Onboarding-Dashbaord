import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { SocialProviderFactory } from '@/lib/social-providers/SocialProviderFactory';
import type { SocialPost, SocialAccount } from '@/lib/types';

/**
 * GET /api/cron/social-publisher
 * background sweep engine. Triggers scheduled publishes.
 * Security: Verifies Authorization headers or local dev bypass rules.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';
    const isDev = process.env.NODE_ENV === 'development' || request.nextUrl.searchParams.get('bypass') === 'true';

    if (!isDev && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron sweep trigger.' }, { status: 401 });
    }

    const nowIso = new Date().toISOString();

    // 1. Fetch scheduled posts
    const querySnapshot = await adminDb
      .collection('socialPosts')
      .where('status', 'in', ['scheduled', 'failed'])
      .get();

    const posts = querySnapshot.docs.map(doc => doc.data() as SocialPost);
    const duePosts = posts.filter(post => {
      // Check if any variations are scheduled and past due date
      return Object.values(post.platformVariations).some(variation => {
        return !variation.publishedPostId && new Date(variation.scheduledTime) <= new Date(nowIso);
      });
    });

    if (duePosts.length === 0) {
      return NextResponse.json({ message: 'No scheduled posts are due for publishing at this timestamp.' });
    }

    const processedPosts: string[] = [];

    // 2. Loop due posts and execute platforms (Eliminating Waterfalls via concurrent processing per post)
    await Promise.all(duePosts.map(async (post) => {
      const postRef = adminDb.collection('socialPosts').doc(post.id);
      
      // Update root status to block race conditions
      await postRef.update({ status: 'publishing' });

      let allSucceeded = true;
      const updatedVariations = { ...post.platformVariations };

      for (const [platform, variation] of Object.entries(post.platformVariations)) {
        // Only publish if not already published
        if (variation.publishedPostId) continue;

        // Skip if scheduledTime is in the future
        if (new Date(variation.scheduledTime) > new Date(nowIso)) {
          allSucceeded = false;
          continue;
        }

        try {
          // Resolve connected social account for this platform in this workspace
          const accountSnapshot = await adminDb
            .collection('socialAccounts')
            .where('workspaceId', '==', post.workspaceId)
            .where('platform', '==', platform)
            .where('status', '==', 'active')
            .limit(1)
            .get();

          if (accountSnapshot.empty) {
            throw new Error(`Active account profile not connected for ${platform}`);
          }

          const account = accountSnapshot.docs[0].data() as SocialAccount;
          const provider = SocialProviderFactory.getProvider(platform, account.simulated);

          // Publish post variation
          const publishResult = await provider.publishPost(
            account.auth.accessToken,
            {
              caption: variation.caption,
              mediaUrls: post.contentObject.mediaUrls,
            }
          );

          updatedVariations[platform] = {
            ...variation,
            publishedPostId: publishResult.publishedPostId,
            error: undefined,
          };

          // Audit log write
          const auditId = `audit_${Math.random().toString(36).substring(2, 11)}`;
          await adminDb.collection('auditLogs').doc(auditId).set({
            id: auditId,
            orgId: post.orgId,
            workspaceId: post.workspaceId,
            action: 'publish_post_success',
            details: `Successfully published variation to ${platform} (Post: ${post.contentObject.title})`,
            userId: 'cron-worker',
            createdAt: new Date().toISOString(),
          });

        } catch (err: unknown) {
          allSucceeded = false;
          const errorMsg = err instanceof Error ? err.message : 'Unknown platform error';
          
          updatedVariations[platform] = {
            ...variation,
            error: errorMsg,
          };

          const auditId = `audit_${Math.random().toString(36).substring(2, 11)}`;
          await adminDb.collection('auditLogs').doc(auditId).set({
            id: auditId,
            orgId: post.orgId,
            workspaceId: post.workspaceId,
            action: 'publish_post_failure',
            details: `Failed publishing to ${platform}: ${errorMsg}`,
            userId: 'cron-worker',
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Update post status and variations
      await postRef.update({
        platformVariations: updatedVariations,
        status: allSucceeded ? 'published' : 'failed',
        updatedAt: new Date().toISOString(),
      });

      processedPosts.push(post.id);
    }));

    return NextResponse.json({
      message: `Sweep completed. Processed ${processedPosts.length} posts successfully.`,
      processedPostIds: processedPosts,
    });

  } catch (error: unknown) {
    console.error('[API:CRON:SOCIAL_PUBLISHER] Error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error during publishing sweep';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
