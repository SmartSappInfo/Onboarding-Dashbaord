'use server';

import { getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import type { BrandVoiceProfile, SocialPost, SocialInboxItem, SocialInboxItemReply, SocialListeningRule } from '@/lib/types';

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
      modelId: 'gemini-3-flash-preview',
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
        config: { maxOutputTokens: 600 },
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
      modelId: 'gemini-3-flash-preview',
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
        config: { maxOutputTokens: 200 },
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

/**
 * Server Action: Simulates an inbound message.
 * Classifies sentiment using Gemini and executes automation behaviors.
 */
export async function simulateInboundMessageAction(
  platform: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'tiktok' | 'youtube' | 'pinterest' | 'google_business',
  workspaceId: string,
  orgId: string
): Promise<{ success: boolean; threadId?: string; error?: string }> {
  try {
    const mockInquiries = [
      {
        senderName: 'Sarah Jenkins',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        content: 'Hi there! We attended the school open house last night and were so impressed by the campus and teachers. Thank you for putting together such a wonderful event!',
      },
      {
        senderName: 'David Chen',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        content: 'Could you please share the current tuition rates and schedule of fees for the upcoming 2026 school year?',
      },
      {
        senderName: 'Marcus Brodie',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        content: "I am extremely frustrated that nobody has responded to my email about the uniform exchange program. It has been three days. Can someone from administration contact me?",
      },
      {
        senderName: 'Elena Rostova',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
        content: 'Do you offer school bus routing or transportation options for children living in the southern sector near the heights?',
      },
      {
        senderName: 'Rachel Green',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
        content: 'We absolutely love the track and field program here! The coaches have gone above and beyond to support our daughter this semester.',
      }
    ];

    const idx = Math.floor(Math.random() * mockInquiries.length);
    const mock = mockInquiries[idx];

    // 1. Resolve Brand Voice Profile for settings
    const profileSnap = await adminDb
      .collection('brandVoiceProfiles')
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    let voiceProfile: BrandVoiceProfile | undefined = undefined;
    if (!profileSnap.empty) {
      voiceProfile = profileSnap.docs[0].data() as BrandVoiceProfile;
    }
    const mode = voiceProfile?.automationMode || 'manual';

    // 2. Classify sentiment using Gemini
    const aiResolved = await getModel({
      provider: 'googleai',
      modelId: 'gemini-3-flash-preview',
      organizationId: orgId,
    });

    const modelString = aiResolved.modelString;
    const customAi = aiResolved.customAi;

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (customAi) {
      const sentimentResponse = await customAi.generate({
        model: modelString,
        prompt: `Classify the sentiment of this school parent inquiry. Answer with exactly one word: "positive", "neutral", or "negative".\nInquiry: "${mock.content}"`,
        config: { maxOutputTokens: 10 },
      });
      const parsedText = (sentimentResponse.text || '').toLowerCase().trim();
      if (parsedText.includes('positive')) sentiment = 'positive';
      else if (parsedText.includes('negative')) sentiment = 'negative';
    } else {
      const text = mock.content.toLowerCase();
      if (text.includes('impressed') || text.includes('love') || text.includes('thank')) sentiment = 'positive';
      else if (text.includes('frustrated') || text.includes('unanswered') || text.includes('nobody')) sentiment = 'negative';
    }

    const threadId = `thread_${Math.random().toString(36).substring(2, 11)}`;
    const replies: SocialInboxItemReply[] = [];
    let suggestedReplies: string[] | undefined = undefined;

    // 3. Process Automation Modes
    if (mode === 'autopilot' && customAi) {
      const systemMsg = `You are a helpful school administration AI. Answer the parent inquiry politely, matching this tone rule: ${voiceProfile?.tone || 'professional'}. Max 2 sentences.`;
      const replyResponse = await customAi.generate({
        model: modelString,
        prompt: mock.content,
        system: systemMsg,
        config: { maxOutputTokens: 200 },
      });

      replies.push({
        id: `rep_${Math.random().toString(36).substring(2, 10)}`,
        sender: 'ai',
        senderName: 'SmartSapp AI',
        content: (replyResponse.text || 'Thank you for your message. We will check on this and get back to you shortly.').trim(),
        createdAt: new Date().toISOString(),
        wasAutoSent: true,
      });
    } else if (mode === 'suggest' && customAi) {
      const suggestPrompt = `Given the parent inquiry below, suggest exactly three distinct short reply template options (each under 5 words) as clickable buttons. Format your response as a simple comma-separated list without quotes.
Inquiry: "${mock.content}"
Example suggestions: "Request Phone Number, Ask for Grade Level, Send Tuition Form"`;
      
      const suggestResponse = await customAi.generate({
        model: modelString,
        prompt: suggestPrompt,
        config: { maxOutputTokens: 100 },
      });
      const parsedList = (suggestResponse.text || '')
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(s => s.length > 0);

      suggestedReplies = parsedList.length >= 3 ? parsedList.slice(0, 3) : ['Request Info', 'Schedule Tour', 'Reply Later'];
    }

    const payload: SocialInboxItem = {
      id: threadId,
      orgId,
      workspaceId,
      socialAccountId: `acc_${Math.random().toString(36).substring(2, 10)}`,
      platform,
      itemType: 'message',
      platformItemId: `msg_${Math.random().toString(36).substring(2, 12)}`,
      platformSenderId: `sender_${Math.random().toString(36).substring(2, 10)}`,
      senderName: mock.senderName,
      senderAvatar: mock.avatar,
      content: mock.content,
      status: replies.length > 0 ? 'resolved' : 'unread',
      sentiment,
      replies,
      suggestedReplies,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('socialInbox').doc(threadId).set(payload);

    return { success: true, threadId };
  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:SIMULATE_INBOX] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to simulate inbound message';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Generates an on-demand AI reply for an inbox thread.
 */
export async function generateInboxReplyAction(
  threadId: string,
  workspaceId: string,
  orgId: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const threadDoc = await adminDb.collection('socialInbox').doc(threadId).get();
    if (!threadDoc.exists) {
      return { success: false, error: 'Thread not found' };
    }

    const thread = threadDoc.data() as SocialInboxItem;

    // Load workspace voice rules
    const profileSnap = await adminDb
      .collection('brandVoiceProfiles')
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    let voiceProfile: BrandVoiceProfile | undefined = undefined;
    if (!profileSnap.empty) {
      voiceProfile = profileSnap.docs[0].data() as BrandVoiceProfile;
    }

    const aiResolved = await getModel({
      provider: 'googleai',
      modelId: 'gemini-3-flash-preview',
      organizationId: orgId,
    });

    const modelString = aiResolved.modelString;
    const customAi = aiResolved.customAi;

    if (!customAi) {
      return { success: true, text: 'Thank you for contacting us. We have received your inquiry and will follow up shortly.' };
    }

    const conversationContext = `
Parent Inquiry: ${thread.content}
Previous Thread Logs:
${thread.replies.map(r => `${r.senderName}: ${r.content}`).join('\n')}
`;

    const systemMsg = `You are a helpful school administration AI. Answer the parent inquiry politely, matching the tone: ${voiceProfile?.tone || 'professional'}. Max 2-3 sentences. Do not use forbidden words: ${(voiceProfile?.forbiddenWords || []).join(', ')}.`;

    const response = await customAi.generate({
      model: modelString,
      prompt: conversationContext,
      system: systemMsg,
      config: { maxOutputTokens: 300 },
    });

    return { success: true, text: (response.text || '').trim() };

  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:GENERATE_INBOX_REPLY] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate AI reply';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Appends a user manual reply to an inbox thread.
 */
export async function sendInboxManualReplyAction(
  threadId: string,
  messageContent: string,
  senderName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const threadRef = adminDb.collection('socialInbox').doc(threadId);
    const threadDoc = await threadRef.get();

    if (!threadDoc.exists) {
      return { success: false, error: 'Thread not found' };
    }

    const thread = threadDoc.data() as SocialInboxItem;

    const newReply: SocialInboxItemReply = {
      id: `rep_${Math.random().toString(36).substring(2, 10)}`,
      sender: 'user',
      senderName,
      content: messageContent,
      createdAt: new Date().toISOString(),
    };

    await threadRef.update({
      replies: [...thread.replies, newReply],
      status: 'resolved',
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:SEND_INBOX_MANUAL] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to post manual reply';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Connects/disconnects an inbox thread to/from a CRM contact profile.
 */
export async function linkInboxToCRMAction(
  threadId: string,
  crmContactId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const threadRef = adminDb.collection('socialInbox').doc(threadId);
    await threadRef.update({
      crmContactId: crmContactId || null,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:LINK_CRM] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update CRM link';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Simulates traffic, CRM lead signups, and Stripe tuition invoice payments
 * attributed to a social post via UTM campaign codes.
 */
export async function simulateSocialConversionsAction(
  workspaceId: string,
  orgId: string,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const postRef = adminDb.collection('socialPosts').doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return { success: false, error: 'Social post not found' };
    }

    const post = postSnap.data() as SocialPost;

    const updatedVariations = { ...post.platformVariations };
    for (const [platform, variation] of Object.entries(post.platformVariations)) {
      updatedVariations[platform] = {
        ...variation,
        hashtags: variation.hashtags || [],
      };
    }

    await postRef.update({
      platformVariations: updatedVariations,
      aiOptimized: true,
      updatedAt: new Date().toISOString(),
    });

    const mockParents = [
      { firstName: 'James', lastName: 'Wilson', email: 'james.wilson@example.com', phone: '555-0145', campaign: postId, source: 'linkedin', revenue: 1500 },
      { firstName: 'Alice', lastName: 'Kaufman', email: 'alice.k@example.com', phone: '555-0812', campaign: postId, source: 'facebook', revenue: 2400 },
      { firstName: 'Bruce', lastName: 'Wayne', email: 'bruce@waynecorp.example.com', phone: '555-1939', campaign: postId, source: 'x', revenue: 0 },
    ];

    for (const parent of mockParents) {
      const contactId = `contact_${Math.random().toString(36).substring(2, 11)}`;
      const displayName = `${parent.firstName} ${parent.lastName}`;

      const newLead = {
        id: contactId,
        organizationId: orgId,
        workspaceId,
        entityId: contactId,
        entityType: 'person',
        displayName,
        primaryEmail: parent.email,
        primaryPhone: parent.phone,
        status: 'active',
        workspaceTags: ['social-lead', parent.source],
        entityContacts: [],
        utmSource: parent.source,
        utmCampaign: parent.campaign,
        utmMedium: 'social',
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adminDb.collection('workspace_entities').doc(contactId).set(newLead);

      if (parent.revenue > 0) {
        const invoiceId = `inv_${Math.random().toString(36).substring(2, 11)}`;
        const newInvoice = {
          id: invoiceId,
          invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          entityId: contactId,
          entityType: 'person',
          periodId: 'current',
          periodName: 'Admissions cycle 2026',
          nominalRoll: 1,
          packageId: 'pkg_tuition',
          packageName: 'Tuition Program',
          ratePerStudent: parent.revenue,
          currency: 'USD',
          subtotal: parent.revenue,
          discount: 0,
          levyAmount: 0,
          vatAmount: 0,
          arrearsAdded: 0,
          creditDeducted: 0,
          totalPayable: parent.revenue,
          status: 'paid',
          items: [],
          paymentInstructions: 'Auto-processed via Social ROI simulation.',
          signatureName: 'Stripe Auto-Broker',
          signatureDesignation: 'Broker',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          workspaceIds: [workspaceId],
          billingProfileId: 'profile_default',
        };

        await adminDb.collection('invoices').doc(invoiceId).set(newInvoice);
      }
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:SIMULATE_ROI] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to seed conversion metrics';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Simulates a public social brand mention or competitor feed post.
 * Checks for rule keyword matches and triggers notifications.
 */
export async function simulateListeningMentionAction(
  workspaceId: string,
  orgId: string
): Promise<{ success: boolean; alertId?: string; error?: string }> {
  try {
    const mockMentions = [
      { author: 'CompetitiveSchool Fan', platform: 'x', content: 'Vibe Academy is charging too much for preschool tuition. Switched my son to competitor yesterday.', sentiment: 'negative' as const, matchingKeyword: 'tuition' },
      { author: 'LocalParent99', platform: 'facebook', content: 'Heard the admissions office at Vibe Academy is hosting a tour this Saturday. Is registration required?', sentiment: 'neutral' as const, matchingKeyword: 'admissions' },
      { author: 'TeacherReviewer', platform: 'linkedin', content: 'Vibe Academy has standard teacher salaries, but their classroom learning resources are unmatched.', sentiment: 'positive' as const, matchingKeyword: 'learning' },
    ];

    const idx = Math.floor(Math.random() * mockMentions.length);
    const mock = mockMentions[idx];

    const rulesSnap = await adminDb
      .collection('socialListeningRules')
      .where('workspaceId', '==', workspaceId)
      .where('active', '==', true)
      .limit(1)
      .get();

    if (rulesSnap.empty) {
      return { success: false, error: 'No active Social Listening rule profiles set up. Please configure rule keywords first.' };
    }

    const rule = rulesSnap.docs[0].data() as SocialListeningRule;

    const matchesKeyword = rule.trackKeywords.some(
      (kw) => kw.toLowerCase() === mock.matchingKeyword.toLowerCase()
    );

    const isExcluded = (rule.excludeKeywords || []).some(
      (ex) => mock.content.toLowerCase().includes(ex.toLowerCase())
    );

    if (!matchesKeyword || isExcluded) {
      return { success: false, error: `Simulated post containing keyword "${mock.matchingKeyword}" does not match active rule filters.` };
    }

    const alertId = `alert_${Math.random().toString(36).substring(2, 11)}`;

    await adminDb.collection('socialListeningAlerts').doc(alertId).set({
      id: alertId,
      orgId,
      workspaceId,
      author: mock.author,
      platform: mock.platform,
      content: mock.content,
      sentiment: mock.sentiment,
      matchingKeyword: mock.matchingKeyword,
      createdAt: new Date().toISOString(),
    });

    if (rule.notifyInApp) {
      const notifId = `notif_${Math.random().toString(36).substring(2, 11)}`;
      await adminDb.collection('notifications').doc(notifId).set({
        id: notifId,
        workspaceId,
        title: `Social Alert: ${mock.author} (${mock.platform})`,
        message: `Mentions keyword "${mock.matchingKeyword}" with ${mock.sentiment} sentiment: "${mock.content}"`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true, alertId };
  } catch (error: unknown) {
    console.error('[ACTIONS:SOCIAL:SIMULATE_LISTENING] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to process listening mention';
    return { success: false, error: msg };
  }
}

