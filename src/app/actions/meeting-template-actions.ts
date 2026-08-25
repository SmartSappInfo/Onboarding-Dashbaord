'use server';

/**
 * @fileoverview Server Actions for Meeting Templates Catalog & 1-Click Deployment.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Deploys standardized event types with preconfigured intake questions, duration, and reminders.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { MeetingTemplate } from '@/lib/meetings/types/templates';
import type { EventType, MeetingLocationType, ConferenceProvider } from '@/lib/meetings/types';
import { STANDARD_MEETING_TEMPLATES } from '@/lib/meetings/templates-catalog';

function mapProviderToLocationType(provider: ConferenceProvider): MeetingLocationType {
  switch (provider) {
    case 'google_meet': return 'google_meet';
    case 'zoom': return 'zoom';
    case 'microsoft_teams': return 'teams';
    case 'physical': return 'in_person';
    default: return 'custom';
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Retrieves all available meeting templates (built-in standard templates + workspace custom templates).
 */
export async function getMeetingTemplatesAction(
  workspaceId: string
): Promise<{ success: boolean; templates?: MeetingTemplate[]; error?: string }> {
  try {
    const customSnap = await adminDb
      .collection('meeting_templates')
      .where('workspaceId', '==', workspaceId)
      .get();

    const customTemplates: MeetingTemplate[] = customSnap.docs.map(doc => ({
      ...(doc.data() as MeetingTemplate),
      id: doc.id,
    }));

    return {
      success: true,
      templates: [...STANDARD_MEETING_TEMPLATES, ...customTemplates],
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Deploys a template into a real EventType on the workspace.
 */
export async function deployMeetingTemplateAction(
  workspaceId: string,
  templateId: string,
  customName?: string
): Promise<{ success: boolean; eventType?: EventType; error?: string }> {
  try {
    const template = STANDARD_MEETING_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      return { success: false, error: 'Template not found.' };
    }

    const eventName = customName?.trim() || template.name;
    const baseSlug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    const newEventTypeRef = adminDb.collection('eventTypes').doc();
    const now = new Date().toISOString();

    const newEventType: EventType = {
      id: newEventTypeRef.id,
      workspaceId,
      organizationId: '',
      name: eventName,
      slug,
      description: template.description,
      purpose: template.purpose,
      format: template.format,
      durationMinutes: template.durationMinutes,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 5,
      minimumNoticeMinutes: 120,
      maximumBookingHorizonDays: 30,
      locationType: mapProviderToLocationType(template.defaultProvider),
      customQuestions: template.defaultQuestions,
      confirmationMessage: template.confirmationMessage,
      color: template.accentColor || '#3b82f6',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await newEventTypeRef.set(newEventType);

    return { success: true, eventType: newEventType };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
