/**
 * @fileOverview Constants, endpoint configurations, and UI options for webhook delivery.
 * 
 * ARCHITECTURAL DESIGN & RATIONALE:
 * This file contains pure configurations, types, and data definitions WITHOUT any
 * 'use server' directive. In Next.js App Router, modules marked with 'use server'
 * convert their exports into Server Action proxies on the client. By keeping data
 * constants here, both Client Components (like register-new-signup-form.tsx) and
 * Server Actions (like webhook-actions.ts) can import them safely as standard JS arrays.
 */

export type WebhookTargetOption = 'both' | 'smartsapp_automations' | 'pabbly' | 'none';

export interface WebhookEndpointConfig {
  readonly id: 'smartsapp_automations' | 'pabbly';
  readonly name: string;
  readonly type: 'internal' | 'external';
  readonly url: string;
}

export const SIGNUP_WEBHOOK_TARGETS: readonly WebhookEndpointConfig[] = [
  {
    id: 'smartsapp_automations',
    name: 'SmartSapp Automations (Internal)',
    type: 'internal',
    url: process.env.SMARTSAPP_SIGNUP_AUTOMATION_WEBHOOK_URL || 'https://go.smartsapp.com/api/automations/webhook/TSRkUBIo6neV20iL526t',
  },
  {
    id: 'pabbly',
    name: 'Pabbly Workflow (External)',
    type: 'external',
    url: process.env.PABBLY_SIGNUP_WEBHOOK_URL || 'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc',
  },
] as const;

export interface WebhookOptionMetadata {
  readonly value: WebhookTargetOption;
  readonly label: string;
  readonly category: 'Both' | 'Internal' | 'External' | 'Disabled';
  readonly description: string;
  readonly urls: readonly string[];
}

export const SIGNUP_WEBHOOK_OPTIONS: readonly WebhookOptionMetadata[] = [
  {
    value: 'both',
    label: 'All Endpoints (Internal + External)',
    category: 'Both',
    description: 'Pushes payload to both internal SmartSapp Automations and external Pabbly Workflow.',
    urls: [
      'https://go.smartsapp.com/api/automations/webhook/TSRkUBIo6neV20iL526t',
      'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc',
    ],
  },
  {
    value: 'smartsapp_automations',
    label: 'Internal Endpoint (SmartSapp Automations)',
    category: 'Internal',
    description: 'Pushes payload exclusively to internal automation workflow.',
    urls: ['https://go.smartsapp.com/api/automations/webhook/TSRkUBIo6neV20iL526t'],
  },
  {
    value: 'pabbly',
    label: 'External Endpoint (Pabbly Workflow)',
    category: 'External',
    description: 'Pushes payload exclusively to external Pabbly notification workflow.',
    urls: ['https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc'],
  },
  {
    value: 'none',
    label: 'None (Disable Webhooks)',
    category: 'Disabled',
    description: 'Skip webhook dispatch during submission.',
    urls: [],
  },
] as const;

export interface WebhookDispatchResult {
  id: string;
  name: string;
  url: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

export interface DispatchSignupWebhookResponse {
  success: boolean;
  dispatchedAt: string;
  results: WebhookDispatchResult[];
  error?: string;
}
