/**
 * @fileOverview Domain schemas and types for Workspace Messaging Governance Settings.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any, schema-narrowed unknown.
 * - Rule 8: Multi-tenant configuration boundaries.
 * - Rule 18: TOCTOU concurrency protection with integer document version.
 * - Rule 23: Explicit bounds on templates (max 8) and prompts (max 6, <=120 chars).
 */

import { z } from 'zod';

export const ChannelKillSwitchesSchema = z.object({
  sms: z.boolean().default(false).describe('Pause all SMS outbound dispatches for maintenance'),
  whatsapp: z.boolean().default(false).describe('Pause all WhatsApp outbound dispatches for maintenance'),
  email: z.boolean().default(false).describe('Pause all Email outbound dispatches for maintenance'),
});

export type ChannelKillSwitches = z.infer<typeof ChannelKillSwitchesSchema>;

export const WorkspaceMessagingSettingsSchema = z.object({
  version: z
    .number()
    .int()
    .nonnegative()
    .default(1)
    .describe('Optimistic concurrency document version (Rule 18 TOCTOU protection)'),
  lowBalanceThreshold: z
    .number()
    .int()
    .min(0, 'Threshold cannot be negative')
    .default(100)
    .describe('SMS unit balance threshold below which warning badges are displayed'),
  quickTemplateIds: z
    .array(z.string())
    .min(1, 'At least one quick template must be selected')
    .max(8, 'Maximum 8 quick templates allowed')
    .default(['tpl_welcome', 'tpl_fee', 'tpl_event', 'tpl_update'])
    .describe('List of template IDs displayed in the dashboard Quick Templates card'),
  aiPromptStarters: z
    .array(z.string().min(5).max(120))
    .max(6, 'Maximum 6 prompt starters allowed')
    .default([
      'Draft a warm welcome note for new enrollments',
      'Remind parents about the upcoming PTA meeting',
      'Send a polite tuition fee reminder for this term',
      'Announce the inter-school sports gala this Friday',
    ])
    .describe('Custom AI prompt suggestions rendered in the Hero Greeting card'),
  channelKillSwitches: ChannelKillSwitchesSchema.default({
    sms: false,
    whatsapp: false,
    email: false,
  }),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});

export type WorkspaceMessagingSettings = z.infer<typeof WorkspaceMessagingSettingsSchema>;

export const DEFAULT_MESSAGING_SETTINGS: WorkspaceMessagingSettings = {
  version: 1,
  lowBalanceThreshold: 100,
  quickTemplateIds: ['tpl_welcome', 'tpl_fee', 'tpl_event', 'tpl_update'],
  aiPromptStarters: [
    'Draft a warm welcome note for new enrollments',
    'Remind parents about the upcoming PTA meeting',
    'Send a polite tuition fee reminder for this term',
    'Announce the inter-school sports gala this Friday',
  ],
  channelKillSwitches: {
    sms: false,
    whatsapp: false,
    email: false,
  },
};
