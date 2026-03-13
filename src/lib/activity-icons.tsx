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
  PlusCircle
} from 'lucide-react';
import type { Activity } from '@/lib/types';

export const getActivityIcon = (type: Activity['type']): React.ElementType => {
  const iconMap: Record<Activity['type'], React.ElementType> = {
    note: MessageSquare,
    call: Phone,
    visit: Building,
    email: Mail,
    meeting_created: CalendarPlus,
    pipeline_stage_changed: Workflow,
    school_updated: PenSquare,
    form_submission: BadgeCheck,
    notification_sent: Bell,
    school_created: PlusCircle,
    school_assigned: User,
    pdf_uploaded: FileText,
    pdf_published: FileText,
    pdf_form_submitted: FileText,
    pdf_status_changed: BadgeCheck,
    task_created: PlusCircle,
    task_completed: CheckCircle2
  };
  return iconMap[type] || Bot;
};
