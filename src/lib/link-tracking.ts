
import { adminDb, FieldValue } from './firebase-admin';
import { nanoid } from 'nanoid';
import { getBaseUrl } from './utils/url-helpers';

/**
 * Generates a compact Base62-like link ID.
 * Using nanoid with a custom alphabet to keep URLs short for SMS.
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateShortId = () => nanoid(8); // 8 characters is enough for billions of combinations

interface TrackedLink {
  id: string;
  originalUrl: string;
  campaignId: string;
  jobId: string;
  taskId: string;
  clickCount: number;
  createdAt: string;
}

/**
 * Creates a tracked link entry in Firestore and returns the short URL.
 */
export async function createTrackedLink(params: {
  originalUrl: string;
  campaignId: string;
  jobId: string;
  taskId: string;
}): Promise<string> {
  const { originalUrl, campaignId, jobId, taskId } = params;
  const id = generateShortId();
  
  const linkData: TrackedLink = {
    id,
    originalUrl,
    campaignId,
    jobId,
    taskId,
    clickCount: 0,
    createdAt: new Date().toISOString(),
  };

  await adminDb.collection('tracked_links').doc(id).set(linkData);

  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/l/${id}`;
}

/**
 * Records a click for a tracked link and increments campaign stats.
 */
export async function recordLinkClick(linkId: string): Promise<string | null> {
  try {
    const linkRef = adminDb.collection('tracked_links').doc(linkId);
    const linkSnap = await linkRef.get();
    
    if (!linkSnap.exists) return null;
    const link = linkSnap.data() as TrackedLink;

    // 1. Increment link click count
    await linkRef.update({
      clickCount: FieldValue.increment(1)
    });

    // 2. Increment campaign stats (Real-time)
    if (link.campaignId) {
        const { updateCampaignRealtimeStat } = await import('./campaign-analytics');
        await updateCampaignRealtimeStat(link.campaignId, 'totalClicked');
    }

    // 3. Update task status (if not already opened/clicked)
    if (link.jobId && link.taskId) {
        const taskRef = adminDb.collection('message_jobs').doc(link.jobId).collection('tasks').doc(link.taskId);
        await taskRef.update({
            status: 'clicked',
            clickedAt: new Date().toISOString()
        });

        // 4. Trigger automation hooks
        const { emitSingleCampaignEvent } = await import('./campaign-events');
        await emitSingleCampaignEvent({
            campaignId: link.campaignId,
            entityId: (await taskRef.get()).data()?.entityId,
            event: 'campaign_clicked'
        });
    }

    return link.originalUrl;
  } catch (error) {
    console.error(`[LINK-TRACKING] Error recording click for ${linkId}:`, error);
    return null;
  }
}

/**
 * Transforms all URLs in a text body into tracked links.
 */
export async function transformBodyWithTracking(params: {
  body: string;
  campaignId: string;
  jobId: string;
  taskId: string;
}): Promise<string> {
  const { body, campaignId, jobId, taskId } = params;
  
  // URL regex (simplified for common patterns)
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  
  const urls = body.match(urlRegex);
  if (!urls) return body;

  let transformedBody = body;
  
  // Use for...of to handle async properly
  for (const url of urls) {
    // Avoid double tracking if the same URL appears twice (though unlikely in personalized content)
    const trackedUrl = await createTrackedLink({ originalUrl: url, campaignId, jobId, taskId });
    transformedBody = transformedBody.replace(url, trackedUrl);
  }

  return transformedBody;
}
