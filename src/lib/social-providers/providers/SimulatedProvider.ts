import { ISocialProvider, SocialPublishResult, SocialMediaUpload, SocialAnalyticsData } from '../social-provider-types';

export class SimulatedSocialProvider implements ISocialProvider {
  private platform: string;

  constructor(platform: string) {
    this.platform = platform;
  }

  async refreshToken(tokenData: Record<string, unknown>): Promise<{ accessToken: string; expiresAt?: number }> {
    return {
      accessToken: `simulated-access-token-${this.platform}-${Date.now()}`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async publishPost(
    accessToken: string,
    content: { caption: string; mediaUrls: string[] }
  ): Promise<SocialPublishResult> {
    const publishedPostId = `sim_post_${Math.random().toString(36).substring(2, 11)}`;
    return {
      publishedPostId,
      url: `https://www.${this.platform}.com/simulated-post/${publishedPostId}`,
      rawResponse: {
        status: 'success',
        simulated: true,
        publishedAt: new Date().toISOString(),
        captionLength: content.caption.length,
      },
    };
  }

  async uploadMedia(accessToken: string, fileUrl: string): Promise<SocialMediaUpload> {
    const platformMediaId = `sim_media_${Math.random().toString(36).substring(2, 11)}`;
    return {
      url: fileUrl,
      thumbnailUrl: fileUrl,
      platformMediaId,
    };
  }

  async fetchInboxItems(accessToken: string, sinceId?: string): Promise<Record<string, unknown>[]> {
    // Generate realistic inquiries for a school/organization
    const mockItems: Record<string, unknown>[] = [
      {
        platformItemId: `item_${Math.random().toString(36).substring(2, 9)}`,
        platformSenderId: `sender_${Math.random().toString(36).substring(2, 9)}`,
        senderName: 'Sarah Jenkins',
        senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        content: 'Hi! We are looking to enroll our daughter in Grade 3 this Fall. Are there still openings, and when can we tour the campus?',
        itemType: 'message',
        sentiment: 'positive',
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
      {
        platformItemId: `item_${Math.random().toString(36).substring(2, 9)}`,
        platformSenderId: `sender_${Math.random().toString(36).substring(2, 9)}`,
        senderName: 'David Chen',
        senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        content: 'The new STEM lab looks incredible! My kids can\'t wait for classes to start.',
        itemType: 'comment',
        sentiment: 'positive',
        createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      },
      {
        platformItemId: `item_${Math.random().toString(36).substring(2, 9)}`,
        platformSenderId: `sender_${Math.random().toString(36).substring(2, 9)}`,
        senderName: 'Marcus Aurelius',
        senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        content: 'Very disappointed with the communication regarding the bus route changes. Took 30 minutes to get a reply.',
        itemType: 'comment',
        sentiment: 'negative',
        createdAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
      }
    ];

    return mockItems;
  }

  async sendReply(accessToken: string, threadId: string, messageContent: string): Promise<Record<string, unknown>> {
    return {
      status: 'success',
      replyId: `sim_reply_${Math.random().toString(36).substring(2, 11)}`,
      content: messageContent,
      createdAt: new Date().toISOString(),
    };
  }

  async fetchAnalytics(accessToken: string, options: { startDate: string; endDate: string }): Promise<SocialAnalyticsData> {
    const daysDiff = Math.max(1, Math.floor((new Date(options.endDate).getTime() - new Date(options.startDate).getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      impressions: 1250 * daysDiff,
      reach: 980 * daysDiff,
      engagement: 145 * daysDiff,
      clicks: 85 * daysDiff,
      followerCount: 2400 + (12 * daysDiff),
    };
  }
}
