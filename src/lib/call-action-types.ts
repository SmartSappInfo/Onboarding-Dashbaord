/**
 * Shared action type metadata for call-centre scripts and campaigns.
 * Used by: ScriptBuilderClient, CampaignWizardClient, VisualScriptCanvas, InteractiveScriptView
 */
import type { CallActionType, MessageChannel } from './types';
import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare,
  Mail,
  MessageCircle,
  ClipboardList,
  GitBranch,
  Tag,
  Globe,
  StickyNote,
  Calendar,
  PhoneForwarded,
  User,
} from 'lucide-react';

export interface CallActionMeta {
  /** Human-readable label (e.g. "Send SMS") */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Tailwind bg-* color class for badges/nodes */
  colorClass: string;
  /** If this action requires a messaging template, which channel to filter by */
  channel?: MessageChannel;
  /** Badge label for campaign wizard add-action buttons */
  badgeLabel: string;
  /** Factory returning default params when a new rule of this type is created */
  defaultParams: () => Record<string, string | number>;
}

/**
 * Canonical Map of all call action types to their UI metadata.
 * Using Map for O(1) lookups (vercel-react: js-set-map-lookups).
 */
export const CALL_ACTION_META = new Map<CallActionType, CallActionMeta>([
  ['SEND_SMS', {
    label: 'Send SMS',
    icon: MessageSquare,
    colorClass: 'bg-emerald-500',
    channel: 'sms',
    badgeLabel: '+ Send SMS',
    defaultParams: () => ({ templateId: '' }),
  }],
  ['SEND_EMAIL', {
    label: 'Send Email',
    icon: Mail,
    colorClass: 'bg-blue-500',
    channel: 'email',
    badgeLabel: '+ Send Email',
    defaultParams: () => ({ templateId: '' }),
  }],
  ['SEND_WHATSAPP', {
    label: 'Send WhatsApp',
    icon: MessageCircle,
    colorClass: 'bg-green-500',
    channel: 'whatsapp',
    badgeLabel: '+ Send WhatsApp',
    defaultParams: () => ({ templateId: '' }),
  }],
  ['CREATE_TASK', {
    label: 'Create Follow-up Task',
    icon: ClipboardList,
    colorClass: 'bg-amber-500',
    badgeLabel: '+ Create Task',
    defaultParams: () => ({ taskTitle: 'Follow Up Call', taskPriority: 'medium' }),
  }],
  ['CHANGE_STAGE', {
    label: 'Change Pipeline Stage',
    icon: GitBranch,
    colorClass: 'bg-purple-500',
    badgeLabel: '+ Stage Change',
    defaultParams: () => ({ stageId: '' }),
  }],
  ['ADD_TAG', {
    label: 'Add Tag',
    icon: Tag,
    colorClass: 'bg-teal-500',
    badgeLabel: '+ Tag Contact',
    defaultParams: () => ({ tagId: '' }),
  }],
  ['REMOVE_TAG', {
    label: 'Remove Tag',
    icon: Tag,
    colorClass: 'bg-rose-400',
    badgeLabel: '+ Remove Tag',
    defaultParams: () => ({ tagId: '' }),
  }],
  ['WEBHOOK', {
    label: 'HTTP Webhook',
    icon: Globe,
    colorClass: 'bg-indigo-500',
    badgeLabel: '+ Webhook',
    defaultParams: () => ({ webhookUrl: '', webhookMethod: 'POST' }),
  }],
  ['LOG_NOTE', {
    label: 'Log Note',
    icon: StickyNote,
    colorClass: 'bg-yellow-500',
    badgeLabel: '+ Log Note',
    defaultParams: () => ({ noteContent: '' }),
  }],
  ['SCHEDULE_MEETING', {
    label: 'Schedule Meeting',
    icon: Calendar,
    colorClass: 'bg-cyan-500',
    badgeLabel: '+ Schedule Meeting',
    defaultParams: () => ({ meetingTypeId: '' }),
  }],
  ['TRANSFER_CALL', {
    label: 'Transfer Call',
    icon: PhoneForwarded,
    colorClass: 'bg-orange-500',
    badgeLabel: '+ Transfer Call',
    defaultParams: () => ({ transferTarget: '', transferMode: 'phone' }),
  }],
  ['UPDATE_CONTACT', {
    label: 'Update Contact',
    icon: User,
    colorClass: 'bg-blue-600',
    badgeLabel: '+ Update Contact',
    defaultParams: () => ({ contactName: '', contactEmail: '', contactPhone: '' }),
  }],
]);

/** Ordered array of all action types for dropdown rendering */
export const CALL_ACTION_TYPES: CallActionType[] = [...CALL_ACTION_META.keys()];

/** Get metadata with safe fallback for unknown types */
export function getActionMeta(type: CallActionType | string | undefined): CallActionMeta {
  if (!type) {
    return {
      label: 'Action',
      icon: Globe,
      colorClass: 'bg-muted',
      badgeLabel: '+ Action',
      defaultParams: () => ({}),
    };
  }
  return CALL_ACTION_META.get(type as CallActionType) ?? {
    label: type.replace(/_/g, ' '),
    icon: Globe,
    colorClass: 'bg-muted',
    badgeLabel: `+ ${type.replace(/_/g, ' ')}`,
    defaultParams: () => ({}),
  };
}
