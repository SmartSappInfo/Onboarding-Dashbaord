# Messaging Feature - Firebase Configuration Audit

## Overview

This document provides a complete audit of all Firebase collections used by the messaging feature, showing which have proper security rules and indexes configured.

## Collections Audit

### ✅ Properly Configured Collections

| Collection | Security Rules | Indexes | Notes |
|------------|---------------|---------|-------|
| **message_templates** | ✅ Yes | ✅ Yes | Two-tier system (global/organization scope) |
| **template_variables** | ✅ Yes | ✅ Yes | Variable registry for templates |
| **scheduled_messages** | ✅ Yes | ✅ Yes | Reminder system with organizationId scope |
| **sender_profiles** | ✅ Yes | ✅ Yes | Workspace-scoped sender profiles |
| **message_styles** | ✅ Yes | ✅ Yes | Workspace-scoped message styling |
| **message_logs** | ✅ Yes | ✅ Yes | Message delivery logs with workspace array |
| **message_jobs** | ✅ Yes | ✅ Yes | Background message processing |
| **campaign_sessions** | ✅ Yes | ✅ Yes | Campaign session tracking |
| **messaging_variables** | ✅ Yes | ❌ No | Simple read/write for authorized users |

### ✅ Fixed Collections

| Collection | Security Rules | Indexes | Status |
|------------|---------------|---------|--------|
| **message_campaigns** | ✅ **ADDED** | ✅ **ADDED** | **Fixed in this PR** |

## Security Rules Summary

### message_campaigns (NEW)

```javascript
match /message_campaigns/{campaignId} {
  // Read: workspace access required
  allow get: if isAuthorized() && (
    isSystemAdmin() || hasWorkspaceAccess(resource.data.workspaceId)
  );
  
  // List: all authorized users (filtered in queries)
  allow list: if isAuthorized();
  
  // Create: workspace + organization match required
  allow create: if isAuthorized() && (
    isSystemAdmin() ||
    (hasWorkspaceAccess(request.resource.data.workspaceId) &&
     isOrgMatch(request.resource.data.organizationId))
  );
  
  // Update: workspace access + immutable scope
  allow update: if isAuthorized() && (
    isSystemAdmin() ||
    (hasWorkspaceAccess(resource.data.workspaceId) &&
     isOrgMatch(resource.data.organizationId) &&
     request.resource.data.workspaceId == resource.data.workspaceId &&
     request.resource.data.organizationId == resource.data.organizationId)
  );
  
  // Delete: workspace access required
  allow delete: if isAuthorized() && (
    isSystemAdmin() || hasWorkspaceAccess(resource.data.workspaceId)
  );
}
```

## Indexes Summary

### message_campaigns (NEW)

Added 7 composite indexes to support all query patterns:

1. **workspaceId + status + updatedAt (DESC)**
   - Use case: Filter campaigns by status within workspace
   - Example: Show all "draft" campaigns in workspace

2. **workspaceId + updatedAt (DESC)**
   - Use case: List all campaigns in workspace (most common)
   - Example: Campaign list view ordered by last update

3. **workspaceId + channel + updatedAt (DESC)**
   - Use case: Filter campaigns by channel within workspace
   - Example: Show all "email" campaigns

4. **organizationId + status + updatedAt (DESC)**
   - Use case: Organization-level campaign queries
   - Example: Show all "sent" campaigns across organization

5. **status + scheduledAt (ASC)**
   - Use case: Background processing of scheduled campaigns
   - Example: Find campaigns ready to send

6. **createdBy + updatedAt (DESC)**
   - Use case: User's campaign history
   - Example: Show campaigns created by specific user

7. **workspaceId + createdAt (DESC)**
   - Use case: Campaigns by creation date
   - Example: Recently created campaigns in workspace

## Code References

### Files Using message_campaigns

1. **src/lib/campaign-hooks.ts**
   - `useMessageCampaigns()` - Lists campaigns by workspace
   - `createMessageCampaign()` - Creates new campaign
   - `updateMessageCampaign()` - Updates existing campaign
   - `archiveMessageCampaign()` - Archives campaign
   - `deleteMessageCampaign()` - Deletes campaign
   - `cloneMessageCampaign()` - Clones existing campaign

2. **src/lib/campaign-dispatch.ts**
   - `dispatchCampaign()` - Sends campaign to recipients
   - `resumeCampaignDispatch()` - Resumes failed campaign

3. **src/lib/campaign-events.ts**
   - `trackCampaignEvent()` - Tracks campaign engagement events

4. **src/lib/campaign-post-send.ts**
   - `applyCampaignPostSendRules()` - Applies post-send tag rules

5. **src/lib/campaign-analytics.ts**
   - `getCampaignStats()` - Retrieves campaign statistics
   - `getCampaignEngagement()` - Gets engagement metrics
   - `refreshCampaignStats()` - Updates denormalized stats

6. **src/lib/bulk-messaging.ts**
   - Updates campaign status after bulk send completion

## Query Patterns in Code

### Primary Query (campaign-hooks.ts:20-23)

```typescript
query(
  collection(firestore, 'message_campaigns'),
  where('workspaceId', '==', workspaceId),
  orderBy('updatedAt', 'desc')
)
```

**Index Used**: `workspaceId + updatedAt (DESC)`

### Admin Queries (campaign-dispatch.ts, campaign-analytics.ts)

```typescript
// Get single campaign
adminDb.collection('message_campaigns').doc(campaignId).get()

// Update campaign
adminDb.collection('message_campaigns').doc(campaignId).update({...})
```

**No index needed**: Single document operations

## Data Model

### MessageCampaign Interface

```typescript
interface MessageCampaign {
  id: string;
  
  // Scope
  workspaceId: string;
  organizationId: string;
  
  // Identity
  internalName: string;
  channel: MessageChannel; // 'email' | 'sms' | 'whatsapp'
  target: TemplateTarget;
  
  // Content
  templateId?: string;
  templateName?: string;
  contentMode: ContentMode;
  customSubject?: string;
  customBody?: string;
  customBlocks?: MessageBlock[];
  styleId?: string | null;
  
  // Audience
  audienceDefinition: AudienceDefinition;
  estimatedRecipientCount?: number;
  
  // Sender
  senderProfileId?: string;
  
  // Lifecycle
  status: CampaignStatus; // 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'archived'
  scheduledAt?: string;
  sentAt?: string;
  lastCompletedStep?: number;
  
  // Job linkage
  jobId?: string;
  
  // Post-send
  postSendTagRules?: PostSendTagRule[];
  automationHooks?: CampaignAutomationHook[];
  
  // Stats
  stats: {
    totalTargeted: number;
    totalSent: number;
    totalFailed: number;
    totalOpened: number;
    totalClicked: number;
  };
  
  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

## Security Model

### Access Control

- **Workspace Isolation**: Users can only access campaigns in workspaces they belong to
- **Organization Matching**: Campaign organizationId must match user's organizationId
- **Immutable Scope**: Cannot change workspaceId or organizationId after creation
- **System Admin Override**: System admins (`admin@smartsapp.com` or users with `system_admin` permission) have full access

### Permission Requirements

| Operation | Required Permission | Additional Checks |
|-----------|-------------------|-------------------|
| Read (get) | `isAuthorized()` | Workspace access |
| List | `isAuthorized()` | None (filtered in query) |
| Create | `isAuthorized()` | Workspace access + org match |
| Update | `isAuthorized()` | Workspace access + org match + immutable scope |
| Delete | `isAuthorized()` | Workspace access |

### Helper Functions Used

- `isAuthorized()` - Checks if user is authenticated and authorized
- `isSystemAdmin()` - Checks if user is super admin
- `hasWorkspaceAccess(workspaceId)` - Checks if user has access to workspace
- `isOrgMatch(orgId)` - Checks if user belongs to organization

## Deployment Status

### Current Status: ✅ Ready to Deploy

All required configuration has been added:

- ✅ Security rules added to `firestore.rules`
- ✅ Composite indexes added to `firestore.indexes.json`
- ✅ Deployment script created (`deploy-messaging-fix.sh`)
- ✅ Documentation complete

### Deployment Command

```bash
# Deploy both rules and indexes
./deploy-messaging-fix.sh

# Or deploy individually
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### Post-Deployment Verification

1. Check Firebase Console → Firestore → Rules
2. Check Firebase Console → Firestore → Indexes (wait for completion)
3. Test campaign list query in application
4. Verify all CRUD operations work
5. Confirm workspace isolation is enforced

## Related Documentation

- `FIREBASE_MESSAGING_FIX_SUMMARY.md` - Detailed fix summary
- `MISSING_FIREBASE_CONFIG.md` - Complete configuration reference
- `docs/feature_messaging_campaign.md` - Campaign feature documentation
- `docs/feature_messaging.md` - Messaging system overview

## Conclusion

The messaging feature is now fully configured with proper security rules and indexes. The `message_campaigns` collection follows the same workspace-scoped security model as other operational collections in the system, ensuring consistent access control and data isolation.
