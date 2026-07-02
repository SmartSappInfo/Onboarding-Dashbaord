export interface SocialPublishResult {
  publishedPostId: string;
  url?: string;
  rawResponse: Record<string, unknown>;
}

export interface SocialMediaUpload {
  url: string;
  thumbnailUrl?: string;
  platformMediaId?: string;
}

export interface SocialAnalyticsData {
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  followerCount: number;
}

export interface ISocialProvider {
  /**
   * Refreshes OAuth 2.0 access tokens.
   */
  refreshToken(tokenData: Record<string, unknown>): Promise<{ accessToken: string; expiresAt?: number }>;

  /**
   * Publishes a formatted post variation.
   */
  publishPost(
    accessToken: string,
    content: { caption: string; mediaUrls: string[] }
  ): Promise<SocialPublishResult>;

  /**
   * Uploads media assets to the platform storage registry.
   */
  uploadMedia(accessToken: string, fileUrl: string): Promise<SocialMediaUpload>;

  /**
   * Fetches latest direct messages and comment threads.
   */
  fetchInboxItems(accessToken: string, sinceId?: string): Promise<Record<string, unknown>[]>;

  /**
   * Posts a reply back to a comment, message, or review.
   */
  sendReply(accessToken: string, threadId: string, messageContent: string): Promise<Record<string, unknown>>;

  /**
   * Fetches core platform performance metrics.
   */
  fetchAnalytics(accessToken: string, options: { startDate: string; endDate: string }): Promise<SocialAnalyticsData>;
}
