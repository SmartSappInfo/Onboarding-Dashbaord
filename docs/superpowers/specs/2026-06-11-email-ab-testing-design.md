# Technical Design Spec: Email A/B Testing

## 1. Executive Summary

This spec details the architecture for adding Email A/B testing capabilities to both **Campaigns** (batch sends) and **Automations** (drip-flows). 

Campaigns will support:
- **Simple 50/50 Splits**: Randomly divides the audience list.
- **Winner-Take-All Splits**: Dispatches Variant A and Variant B to a test percentage of the list, waits for a designated timeframe, automatically determines a winner based on Open, Click, or Unsubscribe metrics, and sends the winning variant to the remaining audience.
- **Manual Winner Splits**: Allows the marketer to review real-time testing analytics and manually dispatch the preferred variant early.

Automations will support:
- **A/B Split Nodes**: Routes contacts down two branching paths (Path A or Path B) based on a configured split ratio (e.g. 50/50). Split routing is sticky by contact and node.

---

## 2. Firestore Schema Upgrades

### 2.1 `message_campaigns`
Each campaign document will hold an array of variants and A/B configurations.

```typescript
export interface MessageCampaign {
  id: string;
  workspaceId: string;
  organizationId: string;
  internalName: string;
  status: 'draft' | 'scheduled' | 'testing' | 'sending' | 'completed' | 'archived';
  channel: 'email' | 'sms';
  target: 'all' | 'filtered';
  audienceDefinition: any;

  // A/B testing flag and configuration
  abTestEnabled: boolean;
  abTestConfig?: {
    testSizePercentage: number;   // e.g. 20 (meaning 10% get A, 10% get B, 80% remainder)
    testDurationHours: number;    // e.g. 4 (wait 4 hours before evaluating winner)
    winnerMetric: 'open_rate' | 'click_rate' | 'low_unsubscribe_rate';
    winnerSelectedAt?: string;    // ISO timestamp
    winningVariantId?: 'A' | 'B';
    evaluationJobId?: string;     // Reference to scheduler job
  };

  // Variants configuration
  variants: CampaignVariant[];
  
  // Accumulated global stats across all variants
  stats: CampaignStats;
}

export interface CampaignVariant {
  id: 'A' | 'B';
  templateId?: string;
  templateName?: string;
  customSubject?: string;
  customBody?: string;
  customBlocks?: any[];
  ratio: number;                  // Split ratio (e.g. 50 for 50%)
  stats: CampaignStats;           // Stats isolated to this variant
}

export interface CampaignStats {
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
}
```

### 2.2 `message_logs`
Enriched to link webhooks (opens, clicks) back to the variant.

```typescript
export interface MessageLog {
  id: string;
  messageId: string; // Resend ID
  recipientId: string;
  workspaceId: string;
  campaignId?: string;
  campaignVariantId?: 'A' | 'B'; // Identifies which variant was sent
  // ... standard log fields
}
```

---

## 3. Automation Split Node (`abSplitNode`)

### 3.1 Canvas Modeling
- **Type**: `abSplitNode`
- **Output Handles**: Two handles labeled `Variant A` (`sourceHandle: 'a'`) and `Variant B` (`sourceHandle: 'b'`).
- **Configuration**:
  - `splitRatio`: number between `1` and `99` (denotes percentage of traffic routed to Path A).

### 3.2 Sticky Routing Execution
To avoid storing state or queries, the executor evaluates the split path deterministically:
1. Compute a hash using the contact's ID (`entityId`), the automation's ID (`automationId`), and the split node's ID (`nodeId`):
   ```typescript
   import crypto from 'crypto';
   
   function getSplitAssignment(entityId: string, automationId: string, nodeId: string, splitRatio: number): 'a' | 'b' {
     const input = `${entityId}:${automationId}:${nodeId}`;
     const hash = crypto.createHash('md5').update(input).digest('hex');
     const percent = parseInt(hash.substring(0, 8), 16) % 100;
     return percent < splitRatio ? 'a' : 'b';
   }
   ```
2. In `traverseNodes`:
   ```typescript
   if (currentNode.type === 'abSplitNode') {
     const splitRatio = (currentNode.data?.config?.splitRatio as number) ?? 50;
     const path = getSplitAssignment(context.entityId, context.automationId, currentNode.id, splitRatio);
     outgoingEdges = outgoingEdges.filter(e => e.sourceHandle === path);
   }
   ```

---

## 4. Campaign A/B Send & Evaluation Cycle

### 4.1 Simple Split Sending
- If `abTestEnabled` is true but `testSizePercentage` is not set (or is set to 100% split):
  - Segment the audience list into two equal parts using index parity (`index % 2 === 0` gets Variant A, else Variant B).
  - Dispatch corresponding templates via the Resend sender.

### 4.2 Winner-Take-All Sending
When a Winner-Take-All campaign is executed:
1. **Test Segment Dispatch**:
   - Calculate test group size: `TotalAudience * (testSizePercentage / 100)`.
   - Divide this test group in half: half receives Variant A, half receives Variant B.
   - For example, if test size is 20%, 10% receive Variant A and 10% receive Variant B.
2. **Schedule Winner Evaluation**:
   - Write a document to `automation_jobs` with `targetNodeId: '__campaign_ab_evaluate__'`, `executeAt: Now + testDurationHours`, and `payload: { campaignId }`.
   - Update campaign status to `testing`.
3. **Heartbeat Evaluation Worker**:
   - When the scheduler triggers the evaluation job:
     - Load Variant A stats and Variant B stats.
     - Calculate metric scores:
       - **Open Rate**: `Opened / Sent`
       - **Click Rate**: `Clicked / Sent`
       - **Low Unsubscribe Rate**: `(Sent - Unsubscribed) / Sent`
     - Compare Variant A and Variant B. If scores are tied, default to Variant A.
     - Update campaign document with `winningVariantId`.
     - Dispatch the winning variant to the remaining 80% of the audience list.
     - Update campaign status to `completed`.

---

## 5. Unsubscribe Webhook Integration

* **Unsubscribe Links**: Append `cmp=campaignId` and `v=variantId` to the query parameters in email signatures (e.g. `https://smartsapp.com/unsubscribe/123?ws=ws_id&cmp=camp_123&v=A`).
* **Route Upgrade**: When POSTing to `/api/messaging/unsubscribe`, if `campaignId` and `variantId` are present in the request body, increment the corresponding variant's `stats.totalUnsubscribed` counts in Firestore.
