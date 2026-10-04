/**
 * @fileOverview Pre-Built Enterprise Workflow Template: Deal Review & Approval Flow (Phase 7 Milestone 5)
 *
 * Implements a 4-step deal approval workflow:
 * 1. fetch_deal: Retrieves deal entity details
 * 2. calculate_discount: Computes margin impact and proposed discount
 * 3. vp_approval_gate: Pauses in WAITING state if discount > 20% requiring VP sign-off
 * 4. send_approval_notification: Dispatches status update notification
 */

import type { WorkflowTemplateDefinition } from './workflow-template-types';

export const DealReviewWorkflow: WorkflowTemplateDefinition = {
  id: 'deal_review_v1',
  version: '1.0.0',
  name: 'Deal Review & Approval Flow',
  description:
    '4-step high-value enterprise deal evaluation with VP approval gate for discounts > 20%.',
  category: 'sales',
  parameters: [
    {
      name: 'dealId',
      type: 'string',
      description: 'Identifier of the CRM deal',
      required: true,
    },
    {
      name: 'discountPercent',
      type: 'number',
      description: 'Requested discount percentage',
      required: true,
    },
  ],
  steps: [
    {
      id: 'fetch_deal',
      name: 'Fetch Deal Data',
      description: 'Retrieves current deal stage, value, and account tier from CRM',
      capabilityId: 'crm.get_deal',
      dependsOn: [],
      isMutating: false,
      riskLevel: 'L0_READ',
      timeoutSeconds: 60,
      maxAttempts: 3,
      inputMapping: {
        dealId: '{{inputs.dealId}}',
      },
    },
    {
      id: 'calculate_discount',
      name: 'Evaluate Discount Margins',
      description: 'Computes gross margin threshold and validates business justification',
      capabilityId: 'sales.evaluate_pricing',
      dependsOn: ['fetch_deal'],
      isMutating: false,
      riskLevel: 'L0_READ',
      timeoutSeconds: 60,
      maxAttempts: 3,
      inputMapping: {
        dealId: '{{inputs.dealId}}',
        discount: '{{inputs.discountPercent}}',
      },
    },
    {
      id: 'vp_approval_gate',
      name: 'VP Sales Approval Gate',
      description: 'Halts execution for two-phase human review if discount exceeds 20%',
      capabilityId: 'policy.request_approval',
      dependsOn: ['calculate_discount'],
      isMutating: false,
      waitCondition: {
        type: 'approval',
        details: {
          requiredRole: 'vp_sales',
          thresholdPercent: 20,
        },
      },
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      timeoutSeconds: 300,
      maxAttempts: 1,
      inputMapping: {
        dealId: '{{inputs.dealId}}',
        discount: '{{inputs.discountPercent}}',
      },
    },
    {
      id: 'send_approval_notification',
      name: 'Send Approval Notification',
      description: 'Alerts account executive and deal stakeholders of the outcome',
      capabilityId: 'messaging.send_notification',
      dependsOn: ['vp_approval_gate'],
      isMutating: true,
      riskLevel: 'L2_STATE_MUTATION',
      timeoutSeconds: 120,
      maxAttempts: 3,
      inputMapping: {
        dealId: '{{inputs.dealId}}',
      },
    },
  ],
};
