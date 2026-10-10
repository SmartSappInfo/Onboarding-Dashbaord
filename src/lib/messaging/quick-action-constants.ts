/**
 * @fileOverview SmartSapp Messaging Dashboard — Quick Action & Feature Directory Manifest
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Centralized, immutable registry of all messaging sub-tools and shortcuts.
 * - Enforces Rule 8 (Strict Relative Navigation): all routes begin with a single '/' and prohibit external schemes.
 * - Enforces Rule 4 (Strict Typing: zero any/any[]).
 * - Enforces Rule 19 (HITL Approval Gate): links route to interactive wizards; zero autonomous sends.
 */

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  href: string;
  iconName: 'Megaphone' | 'Send' | 'FileText' | 'Clock';
  accentColor: 'purple' | 'blue' | 'emerald' | 'orange';
  badgeLabel?: string;
}

export interface FeatureDirectoryItem {
  id: string;
  title: string;
  description: string;
  href: string;
  iconName: string;
  badgeLabel?: string;
}

export interface FeatureDirectoryCategory {
  clusterId: 'outbound' | 'inbound' | 'operations';
  title: string;
  description: string;
  items: FeatureDirectoryItem[];
}

/**
 * Validates that a route string is a safe relative internal URL (Rule 8).
 * Rejects protocol schemes (http:, https:, javascript:), double slashes (//), or path-traversal slashes (/\\).
 */
export function isValidRelativeRoute(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('/') && !url.startsWith('//') && !url.includes(':') && !url.startsWith('/\\');
}

/**
 * The 4 primary task shortcuts rendered on the main dashboard grid matching visual mockup.
 */
export const PRIMARY_QUICK_ACTIONS: readonly QuickActionItem[] = [
  {
    id: 'new_campaign',
    title: 'New Campaign',
    description: 'Create and launch a multi-channel campaign to engage your contacts.',
    href: '/admin/messaging/campaigns/new',
    iconName: 'Megaphone',
    accentColor: 'purple',
    badgeLabel: 'Multi-channel',
  },
  {
    id: 'start_message',
    title: 'Start Message',
    description: 'Draft and dispatch a single message or announcement directly.',
    href: '/admin/messaging/composer',
    iconName: 'Send',
    accentColor: 'blue',
    badgeLabel: 'Instant',
  },
  {
    id: 'message_templates',
    title: 'Message Templates',
    description: 'Browse, customize and standardize institutional message layouts.',
    href: '/admin/messaging/templates',
    iconName: 'FileText',
    accentColor: 'emerald',
    badgeLabel: 'Reusable',
  },
  {
    id: 'manage_queue',
    title: 'Manage Queue',
    description: 'Monitor scheduled dispatches, approvals, and active retry queues.',
    href: '/admin/messaging/scheduled',
    iconName: 'Clock',
    accentColor: 'orange',
    badgeLabel: 'Live',
  },
] as const;

/**
 * The comprehensive directory of all messaging features rendered in the "View all features" modal.
 */
export const ALL_MESSAGING_FEATURES: readonly FeatureDirectoryCategory[] = [
  {
    clusterId: 'outbound',
    title: 'Outbound & Broadcasts',
    description: 'Tools for creating, designing, styling, and scheduling outreach at scale.',
    items: [
      {
        id: 'feat-campaigns',
        title: 'Campaign Studio',
        description: 'Multi-step campaign builder with segmentation, scheduling, and A/B tracking.',
        href: '/admin/messaging/campaigns',
        iconName: 'Megaphone',
      },
      {
        id: 'feat-composer',
        title: 'Message Composer',
        description: 'High-speed single and batch message authoring with variable tokens.',
        href: '/admin/messaging/composer',
        iconName: 'Send',
      },
      {
        id: 'feat-templates',
        title: 'Template Workshop',
        description: 'Design visual email templates, SMS blurbs, and WhatsApp message templates.',
        href: '/admin/messaging/templates',
        iconName: 'FileText',
      },
      {
        id: 'feat-styles',
        title: 'Message Styles',
        description: 'Standardize organization email branding, headers, footers, typography, and color themes.',
        href: '/admin/messaging/styles',
        iconName: 'Palette',
      },
      {
        id: 'feat-scheduled',
        title: 'Scheduled Broadcasts',
        description: 'View upcoming time-locked dispatches and pending supervisor approvals.',
        href: '/admin/messaging/scheduled',
        iconName: 'Clock',
      },
      {
        id: 'feat-jobs',
        title: 'Bulk Dispatch Jobs',
        description: 'Monitor asynchronous queue workers, batch progress, and dead-letter retries.',
        href: '/admin/messaging/jobs',
        iconName: 'Layers',
      },
    ],
  },
  {
    clusterId: 'inbound',
    title: 'Inbound & Audience',
    description: 'Conversational channels, contact segments, template tokens, and automated workflows.',
    items: [
      {
        id: 'feat-inbox',
        title: 'Conversations & Inbox',
        description: 'Real-time two-way WhatsApp and SMS communication hub with contact history.',
        href: '/admin/messaging/conversations',
        iconName: 'Inbox',
      },
      {
        id: 'feat-triggers',
        title: 'Automation Triggers',
        description: 'Event-driven triggers sending messages on status changes, birthdays, and deadlines.',
        href: '/admin/messaging/triggers',
        iconName: 'Zap',
      },
      {
        id: 'feat-audiences',
        title: 'Target Audiences',
        description: 'Build dynamic audience filters, contact tag segments, and saved recipient groups.',
        href: '/admin/messaging/audiences',
        iconName: 'Users',
      },
      {
        id: 'feat-variables',
        title: 'Template Variables',
        description: 'Explore standardized variables, customer tokens, and dynamic data bindings.',
        href: '/admin/messaging/variables',
        iconName: 'Code2',
      },
    ],
  },
  {
    clusterId: 'operations',
    title: 'Operations & Audit',
    description: 'Delivery telemetry, sender identities, carrier configurations, and billing governance.',
    items: [
      {
        id: 'feat-logs',
        title: 'Dispatch Audit Logs',
        description: 'Complete immutable audit trail of sent messages with provider delivery receipts.',
        href: '/admin/messaging/logs',
        iconName: 'ListFilter',
      },
      {
        id: 'feat-profiles',
        title: 'Sender Profiles',
        description: 'Manage verified SMS sender IDs, email from-addresses, and sender routing identities.',
        href: '/admin/messaging/profiles',
        iconName: 'UserCheck',
      },
      {
        id: 'feat-gateways',
        title: 'Gateway Provider Settings',
        description: 'Manage mNotify SMS and Meta WhatsApp Cloud API credentials and routing.',
        href: '/admin/settings?tab=messaging',
        iconName: 'Sliders',
      },
      {
        id: 'feat-billing',
        title: 'SMS Units & Billing',
        description: 'Purchase SMS credits, monitor bundle consumption, and view transaction receipts.',
        href: '/admin/settings?tab=billing',
        iconName: 'CreditCard',
      },
    ],
  },
] as const;
