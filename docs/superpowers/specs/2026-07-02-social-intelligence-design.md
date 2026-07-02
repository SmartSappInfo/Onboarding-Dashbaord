# SmartSapp Social Intelligence Product Requirements & Design Specification

**Status**: Approved  
**Author**: Antigravity AI  
**Date**: 2026-07-02  

---

## 1. Product Vision & Module Breakdown

SmartSapp Social Intelligence is an AI-first social media operations suite integrated into the SmartSapp multi-tenant growth platform. It is designed to manage the entire content lifecycle and directly attribute social media engagement to core business actions (e.g., student admissions, invoice payments, CRM lead conversion, and customer support ticket resolutions).

The suite is comprised of 15 core functional modules:

| ID | Module Name | Functional Focus |
|----|-------------|------------------|
| 1 | **Social Dashboard** | Single command center displaying connected accounts, scheduled queue, mentions, unread inbox items, brand health score, and suggested actions. |
| 2 | **Account Management** | Multi-profile authorization (Facebook, Instagram, LinkedIn, X, TikTok, YouTube, GBP) supporting role-based access control (RBAC) and team workspaces. |
| 3 | **Universal Content Composer** | "Write Once, Adapt Everywhere" engine translating a base content draft into optimized variations matching character limits, hashtags, and image aspect ratios per platform. |
| 4 | **AI Content Studio** | Campaign generators, script builders (Reels/TikTok), 30-day content calendar generators, and Brand Voice AI learning. |
| 5 | **Visual Content Studio** | Lightweight brand-kit manager (logos, typography, school colors) integrating AI image generation (e.g., mockups) and automated template resizing. |
| 6 | **Smart Content Calendar** | Interactive day/week/month drag-and-drop planning view supporting content pillar categorizations and approval workflow indicators. |
| 7 | **AI Scheduling Engine** | Signal-based recommendation engine adjusting posting times according to historical follower engagement, regional holidays, and platform traffic trends. |
| 8 | **Publishing Engine** | Event-driven background worker executing immediate, scheduled, or queued publishes with robust failover retries and audit logging. |
| 9 | **Social Inbox** | Unified cross-platform stream of comments, mentions, DMs, and reviews, mapped directly to CRM Contacts with AI-suggested replies. |
| 10 | **Social Listening** | Phrase, hashtag, and competitor brand monitoring with negative sentiment thresholds and alert notifications. |
| 11 | **Reputation Management** | Specialised GBP & Facebook Review responder with SLA timers, auto-draft replies, and feedback solicitation tools. |
| 12 | **Analytics & ROI Hub** | Engagement tracking mapped directly to pipeline stages, admissions forms, and Stripe fee payments. |
| 13 | **Competitor Intelligence** | Growth benchmarks, share-of-voice charts, and posting frequency comparisons. |
| 14 | **AI Assistant** | "Social Employee" agent accepting conversational instructions (e.g., "Analyze competitor posting times and adjust our queue"). |
| 15 | **Automation Builder** | Flow-trigger engine connecting social webhooks to CRM events (e.g., "Comment containing 'pricing' -> Send DM info -> Create Lead"). |

---

## 2. Technical Architecture & Data Flow

```
+----------------------------------------------------------------------------+
|                               Next.js App UI                               |
|                (src/app/admin/social/*: Dashboard, Composer, Inbox)        |
+----------------------------------------------------------------------------+
                                      |
                                      v
+----------------------------------------------------------------------------+
|                        Provider Abstraction Layer                          |
|             (ISocialProvider: Simulated vs. Real Native Clients)           |
+----------------------------------------------------------------------------+
       |                                                      |
       +-----------------( If Simulated )                     +----( If Real )
       |                                                      |
       v                                                      v
+------------------------------+                       +---------------------+
|   Simulated Provider Mock    |                       | Platform Adapters   |
|   (Logs dummy publishes,     |                       | (Graph API,         |
|    generates mock metrics)   |                       | LinkedIn MDP, etc.) |
+------------------------------+                       +---------------------+
       |                                                      |
       +--------------------------+---------------------------+
                                  |
                                  v
+----------------------------------------------------------------------------+
|                            Data & State Storage                            |
|                          (Multi-tenant Firestore)                          |
+----------------------------------------------------------------------------+
```

---

## 3. Database Schema (Firestore Collections)

All documents are keyed by `orgId` and `workspaceId` to ensure multi-tenancy isolation.

### `/socialAccounts`
```typescript
interface SocialAccount {
  id: string;            // Document ID
  orgId: string;
  workspaceId: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'tiktok' | 'youtube' | 'pinterest' | 'google_business';
  platformAccountId: string; 
  displayName: string;
  username: string;
  avatarUrl: string;
  status: 'active' | 'expired' | 'revoked';
  auth: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;  // Epoch timestamp
    scopes: string[];
  };
  simulated: boolean;    // Uses SimulatedSocialProvider if true
  createdAt: string;
  updatedAt: string;
}
```

### `/socialPosts`
```typescript
interface SocialPost {
  id: string;
  orgId: string;
  workspaceId: string;
  campaignId?: string;   
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  contentObject: {
    title: string;
    baseCaption: string;
    mediaUrls: string[];
  };
  platformVariations: {
    [platformId: string]: {
      caption: string;
      mediaUrls: string[];
      hashtags: string[];
      scheduledTime: string;  // ISO
      publishedPostId?: string;
      error?: string;
      utmParams: {
        source: string;
        medium: 'social';
        campaign: string;
        content: string;
      };
    };
  };
  aiOptimized: boolean;
  approvalStatus: 'none' | 'pending' | 'approved' | 'rejected';
  approverId?: string;
  createdAt: string;
  updatedAt: string;
}
```

### `/brandVoiceProfiles`
```typescript
interface BrandVoiceProfile {
  id: string;
  orgId: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  description: string;
  tone: 'professional' | 'casual' | 'inspiring' | 'bold' | 'educational' | 'witty';
  emojiDensity: 'none' | 'low' | 'medium' | 'high';
  averageLength: 'short' | 'medium' | 'long';
  forbiddenWords: string[];
  mandatoryKeywords: string[];
  targetAudience: string;
  productDescriptions: string;
  missionStatement: string;
  extractedStyleTokens: string[]; 
  samplePosts: string[];         
  createdAt: string;
  updatedAt: string;
}
```

### `/socialInbox`
```typescript
interface SocialInboxItem {
  id: string;
  orgId: string;
  workspaceId: string;
  socialAccountId: string;
  platform: string;
  itemType: 'message' | 'comment' | 'mention' | 'review';
  platformItemId: string;
  platformSenderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  rating?: number; 
  status: 'unread' | 'pending' | 'resolved' | 'snoozed';
  assignedUserId?: string;
  crmContactId?: string;   
  sentiment: 'positive' | 'neutral' | 'negative';
  replies: Array<{
    id: string;
    sender: 'user' | 'platform_user' | 'ai';
    senderName: string;
    content: string;
    createdAt: string;
    wasAutoSent?: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Provider Abstraction Layer (PAL)

### Standard Interface (`ISocialProvider`)
```typescript
export interface SocialPublishResult {
  publishedPostId: string;
  url?: string;
  rawResponse: any;
}

export interface SocialMediaUpload {
  url: string;
  thumbnailUrl?: string;
  platformMediaId?: string;
}

export interface ISocialProvider {
  refreshToken(tokenData: any): Promise<{ accessToken: string; expiresAt?: number }>;
  publishPost(accessToken: string, content: { caption: string; mediaUrls: string[] }): Promise<SocialPublishResult>;
  uploadMedia(accessToken: string, fileUrl: string): Promise<SocialMediaUpload>;
  fetchInboxItems(accessToken: string, sinceId?: string): Promise<any[]>;
  sendReply(accessToken: string, threadId: string, messageContent: string): Promise<any>;
  fetchAnalytics(accessToken: string, options: { startDate: string; endDate: string }): Promise<{
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
    followerCount: number;
  }>;
}
```

### Simulated Mode Execution
When `simulated == true`:
* Accounts bypass actual OAuth redirects and write state directly to Firestore mock records.
* Publishing generates virtual audit logs and updates Firestore state to simulated `published` indices.
* Background listeners seed dummy leads, messages, and review items containing common questions (e.g. *"What are the tuition rates for the upcoming semester?"*).
* Replies trigger auto-generated followups from simulated clients 10 seconds later.

---

## 5. CRM Conversion & Marketing Automation Integration

```
Social Post Click (UTM Link)
           |
           v
User Lands on Public Portal / Form
           |
           v
Sign Up Complete -> Firestore Lead Document Created
(UTM Parameters preserved: Source, Campaign, Content)
           |
           v
Invoice Generated / Paid -> Stripe Callback
           |
           v
Admissions Conversion Processed
           |
           v
Cloud Function maps Conversion Payment Amount to matching SocialPost.id
```

### Automation Webhooks trigger
Social webhook comments/messages are fed into the standard Automation Engine rules. Users can build flows:
* **Trigger**: *New Comment containing keyword "enroll"*
* **Action**: *Auto-reply to comment* AND *Send Instagram DM template* AND *Create Contact in CRM*

---

## 6. Implementation Phasing Plan

We will proceed with the rollout in five modular phases:

* **Phase 1: Foundation & Social Composer (Active Focus)**
  * Register Firestore schema integrations.
  * Scaffold `ISocialProvider` interface and set up the `SimulatedSocialProvider`.
  * Establish Brand Voice Profiles collection.
  * Build the Universal Content Composer UI with platform toggle cards and Gemini API variator prompts.
  * Integrate simulated account authorization wizard inside settings.
* **Phase 2: Publishing Engine & Smart Calendar**
  * Cron-based publishing Cloud Function.
  * Interactive drag-and-drop calendar planner layout.
  * Queue scheduler and best-time calculator.
* **Phase 3: Unified Inbox & Reputation**
  * Social Inbox UI with DM/Comment message threads.
  * LLM-based sentiment tagger and AI reply drafter.
  * CRM Quick-Link resolver.
* **Phase 4: ROI Analytics & Listening**
  * Competitor metrics comparison graphs.
  * Conversion/UTM attribution dashboard.
  * Alerts rules setup.
* **Phase 5: Automation Builder & Media Kits**
  * Canvas-resize tools, Brand kit color pickers.
  * Webhook flow-trigger automation.
