'use server';

import { getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import type { BrandVoiceProfile, SocialPost } from '@/lib/types';

interface GenerateOptions {
  basePrompt: string;
  platform: string;
  workspaceId: string;
  orgId: string;
}

interface PublishOptions {
  workspaceId: string;
  orgId: string;
  campaignId?: string;
  title: string;
  baseCaption: string;
  mediaUrls: string[];
  variations: Record<string, {
    caption: string;
    mediaUrls: string[];
    hashtags: string[];
    scheduledTime: string;
    utmParams: {
      source: string;
      medium: string;
      campaign: string;
      content: string;
    };
  }>;
  status: 'draft' | 'scheduled' | 'published';
}

/**
 * Server Action: Generates a tailored platform variation of a base caption draft.
 * Integrates directly with active Brand Voice Profiles in Firestore and calls Gemini via Genkit.
 */
export async function generateSocialVariationAction(options: GenerateOptions): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const { basePrompt, platform, workspaceId, orgId } = options;

    // 1. Fetch default workspace Brand Voice Profile
    const docRef = adminDb.collection('brandVoiceProfiles').doc(workspaceId);
    const docSnap = await docRef.get();
    let voiceGuidelines = '';

    if (docSnap.exists) {
      const profile = docSnap.data() as BrandVoiceProfile;
      voiceGuidelines = `
Brand Voice Guidelines:
- Tone: ${profile.tone}
- Length Preference: ${profile.averageLength}
- Emoji Density: ${profile.emojiDensity}
${profile.targetAudience ? `- Target Audience: ${profile.targetAudience}` : ''}
${profile.missionStatement ? `- Core Mission: ${profile.missionStatement}` : ''}
${profile.productDescriptions ? `- Products/Offerings: ${profile.productDescriptions}` : ''}
${profile.mandatoryKeywords && profile.mandatoryKeywords.length > 0 ? `- Mandatory terms to include: ${profile.mandatoryKeywords.join(', ')}` : ''}
${profile.forbiddenWords && profile.forbiddenWords.length > 0 ? `- Words to strictly avoid: ${profile.forbiddenWords.join(', ')}` : ''}
`;
    }

    // 2. Fetch Gemini model with Key fallback
    const resolved = await getModel({
      provider: 'googleai',
      modelId: 'gemini-1.5-flash',
      organizationId: orgId,
    });

    const modelString = resolved.modelString;
    const customAi = resolved.customAi;

    // 3. Compile platform boundaries
    let platformRules = '';
    if (platform === 'x') {
      platformRules = 'Ensure the output is strictly under 280 characters. Use 1-2 relevant hashtags. Do not use double spaces.';
    } else if (platform === 'linkedin') {
      platformRules = 'Structure the post professionally with short paragraphs and spacing. Use clear bullet points if listing features. Keep hashtags high-value and professional.';
    } else if (platform === 'instagram') {
      platformRules = 'Keep the layout clean and highly visual. Place 5-10 relevant hashtags grouped at the very bottom.';
    } else if (platform === 'facebook') {
      platformRules = 'Use engaging copywriting suitable for parent communities and families. Include a warm and clear call to action.';
    } else if (platform === 'youtube') {
      platformRules = 'Format as a community post update. Focus on readability and direct reader engagement.';
    }

    const systemInstructions = `
You are an expert social media copywriter. 
Your task is to rewrite a base draft into an optimized variation specifically for the ${platform} platform.
${voiceGuidelines}
${platformRules}
`;

    const promptText = `
Base Draft: "${basePrompt}"
Rewrite the caption for ${platform}. Return ONLY the final caption copy. Do not add quotes, introductory messages, or explanation text.
`;

    let responseText = '';
    if (customAi) {
      const response = await customAi.generate({
        model: modelString,
        prompt: promptText,
        system: systemInstructions,
      });
      responseText = response.text || '';
    } else {
      responseText = `[Simulated copy for ${platform}] ${basePrompt}`;
    }

    return { success: true, text: responseText.trim() };
  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:GENERATE] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown generation error occurred';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Creates and writes a new social post document to Firestore.
 * Supports drafts, scheduled posts, and immediate publishing simulation.
 */
export async function createSocialPostAction(options: PublishOptions): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const { workspaceId, orgId, campaignId, title, baseCaption, mediaUrls, variations, status } = options;

    const postId = `post_${Math.random().toString(36).substring(2, 11)}`;
    const postRef = adminDb.collection('socialPosts').doc(postId);

    const platformVariations: Record<string, {
      caption: string;
      mediaUrls: string[];
      hashtags: string[];
      scheduledTime: string;
      publishedPostId?: string;
      error?: string;
      utmParams: {
        source: string;
        medium: string;
        campaign: string;
        content: string;
      };
    }> = {};

    // For immediate published posts, simulate live platform publish success ids
    for (const [platform, val] of Object.entries(variations)) {
      platformVariations[platform] = {
        ...val,
        publishedPostId: status === 'published' ? `sim_pub_${platform}_${Math.random().toString(36).substring(2, 10)}` : undefined,
      };
    }

    const payload: SocialPost = {
      id: postId,
      orgId,
      workspaceId,
      campaignId: campaignId || '',
      status,
      contentObject: {
        title,
        baseCaption,
        mediaUrls,
      },
      platformVariations,
      aiOptimized: false,
      approvalStatus: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await postRef.set(payload);

    return { success: true, postId };
  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:POST] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to write social post';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Updates the scheduledTime of a specific platform variation of a post.
 * Respects strict types and updates Firestore atomically.
 */
export async function updatePostScheduleAction(
  postId: string,
  platform: string,
  newScheduledTime: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const postRef = adminDb.collection('socialPosts').doc(postId);
    const docSnap = await postRef.get();

    if (!docSnap.exists) {
      return { success: false, error: 'Post document not found' };
    }

    const post = docSnap.data() as SocialPost;
    const variation = post.platformVariations[platform];

    if (!variation) {
      return { success: false, error: `Platform variation "${platform}" not configured on this post` };
    }

    // Update scheduledTime
    const updatedVariations = {
      ...post.platformVariations,
      [platform]: {
        ...variation,
        scheduledTime: newScheduledTime,
      },
    };

    await postRef.update({
      platformVariations: updatedVariations,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:UPDATE_SCHEDULE] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to reschedule post';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Suggests the optimal scheduling timing for a platform based on historical engagements.
 * Falls back to standard averages and queries Gemini via Genkit for explanation text.
 */
export async function recommendBestTimeAction(
  platform: string,
  workspaceId: string,
  orgId: string
): Promise<{ success: boolean; time?: string; reason?: string; error?: string }> {
  try {
    // 1. Fetch up to 30 published posts for the active workspace to aggregate metrics
    const postsSnap = await adminDb.collection('socialPosts')
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', 'published')
      .limit(30)
      .get();

    const posts = postsSnap.docs.map(docSnap => docSnap.data() as SocialPost);

    // Heuristics: find the hour with highest aggregate engagements
    const hourBuckets = new Array<number>(24).fill(0);
    let hasHistory = false;

    posts.forEach(post => {
      const variation = post.platformVariations[platform];
      if (variation) {
        const time = new Date(variation.scheduledTime);
        const hour = time.getHours();
        if (!isNaN(hour)) {
          hourBuckets[hour] += 1;
          hasHistory = true;
        }
      }
    });

    let peakHour = 18; // Default 6:00 PM
    if (hasHistory) {
      let maxCount = -1;
      for (let h = 0; h < 24; h++) {
        if (hourBuckets[h] > maxCount) {
          maxCount = hourBuckets[h];
          peakHour = h;
        }
      }
    } else {
      if (platform === 'linkedin') peakHour = 9; // 9 AM
      else if (platform === 'instagram') peakHour = 19; // 7 PM
      else if (platform === 'x') peakHour = 12; // 12 PM
      else if (platform === 'facebook') peakHour = 14; // 2 PM
    }

    const recDate = new Date();
    recDate.setDate(recDate.getDate() + 1);
    recDate.setHours(peakHour, 15, 0, 0); // Recommend peakHour:15
    const recommendedTimeStr = recDate.toISOString();

    // 2. Query Gemini via Genkit
    const resolved = await getModel({
      provider: 'googleai',
      modelId: 'gemini-1.5-flash',
      organizationId: orgId,
    });

    const modelString = resolved.modelString;
    const customAi = resolved.customAi;

    const timeDisplay = `${peakHour}:15 ${peakHour >= 12 ? 'PM' : 'AM'}`;
    const promptText = `
Platform: ${platform}
Recommended Timing: tomorrow at ${timeDisplay}
Has Historical Engagement Data: ${hasHistory}

Write a 1-sentence professional explanation for this recommended time. Focus on parent engagement or audience activity.
Output ONLY the sentence. No quotes, no intro.
`;

    const systemInstructions = 'You are a professional social media marketing analyst for schools and organizations.';

    let reason = '';
    if (customAi) {
      const response = await customAi.generate({
        model: modelString,
        prompt: promptText,
        system: systemInstructions,
      });
      reason = response.text || '';
    } else {
      reason = `Recommended based on platform averages showing high engagement rates for ${platform} around ${timeDisplay}.`;
    }

    return {
      success: true,
      time: recommendedTimeStr,
      reason: reason.trim(),
    };
  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:RECOMMEND_TIME] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to calculate optimal time';
    return { success: false, error: msg };
  }
}

