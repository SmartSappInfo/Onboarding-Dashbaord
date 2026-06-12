
import { NextRequest, NextResponse } from 'next/server';
import { suppressRecipient } from '@/lib/suppression-service';

/**
 * API route to process unsubscribe requests from the preference center.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, workspaceId, channels, reason, campaignId, variantId } = body;

    if (!id || !workspaceId || !channels) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Add suppressions for each selected channel
    for (const channel of channels) {
      await suppressRecipient({
        recipient: id,
        workspaceId,
        channel: channel as 'email' | 'sms' | 'all',
        reason: reason || 'unsubscribed_from_preference_center',
        entityId: id.includes('@') ? undefined : id
      });
    }

    if (campaignId && variantId) {
      const { updateCampaignUnsubscribeStat } = await import('@/lib/campaign-analytics');
      await updateCampaignUnsubscribeStat(campaignId, variantId as 'A' | 'B');
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('[API-UNSUBSCRIBE] Failed:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
