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
