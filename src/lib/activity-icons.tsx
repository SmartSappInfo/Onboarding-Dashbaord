'use client';
import {
  MessageSquare,
  Phone,
  Building,
  Mail,
  CalendarPlus,
  Workflow,
  PenSquare,
  BadgeCheck,
  Bell,
  User,
  Bot,
  FileText,
  CheckCircle2,
  PlusCircle,
  UserCheck,
  UserCog,
  UserMinus,
  Megaphone,
  BookOpen,
  Sparkles,
  MousePointerClick
} from 'lucide-react';
import type { Activity } from '@/lib/types';

/**
 * Resolves the appropriate icon component for an activity based on its type, channel metadata, or description.
 * Channel-aware for notifications and messaging so emails show Mail, SMS/WhatsApp show MessageSquare, and calls show Phone.
 */
export const getActivityIcon = (
  type?: Activity['type'] | string | null,
  metadata?: Record<string, unknown> | null,
  description?: string | null
): React.ElementType => {
  const channel = (typeof metadata?.channel === 'string' ? metadata.channel : '').toLowerCase();
  const desc = (description || '').toLowerCase();
  const actType = (type || '').toLowerCase();

  // Channel-aware overrides for generic notification/communication events
  if (
    actType === 'notification_sent' ||
    actType === 'notification_scheduled' ||
    actType === 'message' ||
    actType === 'message_sent' ||
    !actType
  ) {
    if (channel === 'email' || desc.includes('email') || desc.includes('mail')) return Mail;
    if (channel === 'whatsapp' || channel === 'sms' || desc.includes('whatsapp') || desc.includes('sms')) return MessageSquare;
    if (channel === 'call' || desc.includes('phone') || desc.includes('call')) return Phone;
  }

  const iconMap: Record<string, React.ElementType> = {
    // Notes & Comms
    note: MessageSquare,
    note_added: MessageSquare,
    email: Mail,
    email_sent: Mail,
    email_delivered: Mail,
    whatsapp: MessageSquare,
    whatsapp_sent: MessageSquare,
    sms: MessageSquare,
    sms_sent: MessageSquare,
    message: MessageSquare,
    message_sent: MessageSquare,
    notification_sent: Bell,
    notification_scheduled: Bell,

    // Calls
    call: Phone,
    call_completed: Phone,
    campaign_call: Phone,
    call_logged: Phone,

    // Meetings
    meeting: CalendarPlus,
    meeting_created: CalendarPlus,
    meeting_scheduled: CalendarPlus,
    meeting_updated: CalendarPlus,

    // Pipeline & Deals
    pipeline_stage_changed: Workflow,
    deal_stage_changed: Workflow,
    deal_stage_updated: Workflow,
    deal_progressed: Workflow,
    stage_changed: Workflow,
    deal_created: PlusCircle,
    deal_won: BadgeCheck,
    deal_lost: Workflow,

    // Automations & Campaigns
    automation_entered: Workflow,
    campaign_event: Megaphone,

    // Entities & Schools
    visit: Building,
    school_updated: PenSquare,
    entity_updated: PenSquare,
    school_created: PlusCircle,
    entity_created: PlusCircle,
    school_assigned: User,
    entity_assigned: User,
    form_submission: BadgeCheck,

    // Documents & PDFs
    pdf_uploaded: FileText,
    pdf_published: FileText,
    pdf_form_submitted: FileText,
    pdf_status_changed: BadgeCheck,
    document_opened: BookOpen,
    document_page_viewed: BookOpen,
    document_completed: CheckCircle2,
    document_hotspot_clicked: MousePointerClick,
    document_lead_captured: Sparkles,

    // Tasks & Scoring
    task_created: PlusCircle,
    task_completed: CheckCircle2,
    score_changed: Sparkles,

    // Contacts
    contact_added: UserCheck,
    contact_updated: UserCog,
    contact_removed: UserMinus
  };

  if (actType && iconMap[actType]) {
    return iconMap[actType];
  }

  // Fallback heuristic based on description or type keywords
  if (desc.includes('email') || desc.includes('mail')) return Mail;
  if (desc.includes('call') || desc.includes('phone')) return Phone;
  if (desc.includes('meeting') || desc.includes('schedule')) return CalendarPlus;
  if (desc.includes('stage') || desc.includes('pipeline') || desc.includes('deal')) return Workflow;
  if (desc.includes('whatsapp') || desc.includes('sms') || desc.includes('text message')) return MessageSquare;
  if (desc.includes('task')) return CheckCircle2;

  return Bot;
};
