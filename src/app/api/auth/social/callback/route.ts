import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/auth/social/callback
 * Universal callback for social network OAuth loops.
 * Integrates simulated logins by writing mock account credentials to Firestore.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state') || '';
    const platform = (searchParams.get('platform') as 'linkedin' | 'facebook' | 'instagram' | 'x' | 'youtube') || 'linkedin';
    const workspaceId = searchParams.get('workspaceId') || 'default_workspace';
    const orgId = searchParams.get('orgId') || 'default_org';

    // Simulated path triggers local testing integrations
    if (state.includes('simulated') || !code) {
      const mockAccountId = `sim_acc_${Math.random().toString(36).substring(2, 11)}`;
      
      const newAccountRef = adminDb.collection('socialAccounts').doc(mockAccountId);
      
      let displayName = 'Simulated Educator Profile';
      let username = 'simulated_educator';
      let avatarUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150';

      if (platform === 'facebook') {
        displayName = 'Simulated Facebook Page';
        username = 'simulated_fb_page';
        avatarUrl = 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150';
      } else if (platform === 'instagram') {
        displayName = 'Simulated Instagram Business';
        username = 'simulated_insta_biz';
        avatarUrl = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150';
      } else if (platform === 'x') {
        displayName = 'Simulated X Account';
        username = 'simulated_x_handle';
        avatarUrl = 'https://images.unsplash.com/photo-1611605698335-8b15d27e03f2?w=150';
      }

      await newAccountRef.set({
        id: mockAccountId,
        orgId,
        workspaceId,
        platform,
        platformAccountId: `mock_usr_${Date.now()}`,
        displayName,
        username,
        avatarUrl,
        status: 'active',
        auth: {
          accessToken: `mock-token-${platform}-${Date.now()}`,
          scopes: ['publish_post', 'read_metrics', 'read_messages'],
        },
        simulated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const redirectUrl = new URL(`/admin/social/accounts`, request.url);
      redirectUrl.searchParams.set('track', workspaceId);
      redirectUrl.searchParams.set('success', 'true');
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.json(
      { error: 'Production OAuth redirection requires active API client credentials.' },
      { status: 501 }
    );
  } catch (error: unknown) {
    console.error('[API:AUTH:SOCIAL:CALLBACK] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
