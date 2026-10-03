/**
 * @fileoverview Single Source of Truth (SSOT) Validation Schema for Session & Webinar Builders.
 * Shared across Create Session (/new) and Edit Session (/[id]/edit).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Never define separate schemas in new/page.tsx or edit/page.tsx.
 * - Zero 'any' policy strictly enforced.
 * - Default registration fields are supplied by getDefaultRegistrationFields().
 */

import * as z from 'zod';
import type { 
  WorkspaceEntity, 
  MeetingType, 
  MeetingRegistrationField, 
  MeetingMessagingConfig,
  Meeting
} from '@/lib/types';
import { getDefaultRegistrationFields } from '@/lib/meeting-tokens';
import { getDefaultMeetingMessagingConfig } from '@/lib/types';

export const sessionFormSchema = z.object({
  // Basic Info
  title: z.string().min(1, 'Internal title is required.').default('New Webinar'),
  entity: z.custom<WorkspaceEntity>().optional().nullable(),
  meetingSlug: z.string()
    .min(3, 'Slug must be at least 3 characters.')
    .regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
  meetingTime: z.date({
    required_error: "A meeting time is required.",
  }),
  type: z.custom<MeetingType>().refine(value => !!value, { message: "Meeting type is required." }),
  meetingLink: z.string().url({ message: 'Please enter a valid Google Meet or Video URL.' }),
  
  // Branding Controls
  logoUrl: z.string().url().optional().or(z.literal('')),
  brandingName: z.string().optional().or(z.literal('')),
  brandingSlogan: z.string().optional().or(z.literal('')),
  brandingEnabled: z.boolean().default(true),
  heroLayout: z.enum(['image', 'form']).default('image'),

  // Banner Controls
  bannerType: z.enum(['none', 'image', 'embed']).default('none'),
  bannerImageUrl: z.string().url().optional().or(z.literal('')),
  bannerEmbedCode: z.string().optional().or(z.literal('')),

  // Registration & Guest Gate
  registrationEnabled: z.boolean().default(false),
  registrationRequiredToJoin: z.boolean().default(false),
  registrationMode: z.enum(['open', 'approval_required']).default('open'),
  registrationFields: z.array(z.custom<MeetingRegistrationField>()).default(getDefaultRegistrationFields()),
  registrationSuccessMessage: z.string().optional(),
  capacityLimit: z.number().int().min(0).optional(),
  waitlistEnabled: z.boolean().default(false),
  collectAttendeeDetails: z.boolean().default(false),

  // Hero Section
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  heroTitle: z.string().optional().or(z.literal('')),
  heroDescription: z.string().optional().or(z.literal('')),
  heroTagline: z.string().optional().or(z.literal('')),
  heroCtaLabel: z.string().optional().or(z.literal('')),

  // SEO & Social Sharing
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    keywords: z.string().optional(),
    ogImageMode: z.enum(['asset', 'entity_logo', 'custom']).optional(),
    ogImageUrl: z.string().optional(),
    useContentFallback: z.boolean().optional(),
    noIndex: z.boolean().optional(),
  }).optional(),

  // Options & Collateral
  recordingUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  brochureUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  resourceUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  feedbackFormUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  durationMinutes: z.number().int().min(0).optional(),
  
  // Legacy alerts & reminders
  adminAlertsEnabled: z.boolean().default(false),
  adminAlertChannel: z.enum(['email', 'sms', 'whatsapp', 'both']).default('both'),
  adminAlertNotifyManager: z.boolean().default(false),
  adminAlertSpecificUserIds: z.array(z.string()).default([]),
  adminAlertEmailTemplateId: z.string().optional(),
  adminAlertSmsTemplateId: z.string().optional(),
  adminAlertWhatsappTemplateId: z.string().optional(),
  enabledReminders: z.array(z.string()).default([]),
  
  entityId: z.string().optional(),
  entityType: z.enum(['institution', 'family', 'person']).optional(),

  // Lead Capture
  createEntity: z.boolean().default(false),
  entityMapping: z.object({
    nameField: z.string().default(''),
    primaryContactField: z.string().optional().default(''),
    emailField: z.string().optional().default(''),
    phoneField: z.string().optional().default(''),
    additionalMappings: z.array(z.object({
      sourceField: z.string(),
      targetProperty: z.string(),
    })).default([]),
  }).default({}),
  autoTags: z.array(z.string()).default([]),
  
  // Facilitators
  facilitators: z.array(z.object({
    id: z.string(),
    type: z.enum(['workspace_user', 'custom']),
    userId: z.string().optional(),
    name: z.string(),
    role: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    image: z.string().optional(),
    joinLink: z.string()
  })).default([]),

  // Messaging Config
  messagingConfig: z.custom<MeetingMessagingConfig>().optional(),

  // Webhook Config
  registrationWebhookEnabled: z.boolean().default(false),
  registrationWebhookUrl: z.string().optional().default(''),
  registrationWebhookSecret: z.string().optional().default(''),

  // Publish Status
  publishStatus: z.enum(['draft', 'published', 'archived']).default('published'),
});

export type SessionFormValues = z.infer<typeof sessionFormSchema>;

/**
 * Returns default form values for a new session.
 */
export function getDefaultSessionFormValues(defaultType?: MeetingType): Partial<SessionFormValues> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);

  return {
    title: 'New Executive Session',
    meetingSlug: `session-${Date.now().toString(36)}`,
    meetingTime: tomorrow,
    type: defaultType,
    meetingLink: '',
    brandingEnabled: true,
    heroLayout: 'image',
    bannerType: 'none',
    registrationEnabled: false,
    registrationRequiredToJoin: false,
    registrationMode: 'open',
    registrationFields: getDefaultRegistrationFields(),
    collectAttendeeDetails: false,
    adminAlertsEnabled: false,
    adminAlertChannel: 'both',
    adminAlertNotifyManager: false,
    adminAlertSpecificUserIds: [],
    enabledReminders: [],
    createEntity: false,
    autoTags: [],
    facilitators: [],
    messagingConfig: getDefaultMeetingMessagingConfig(),
    registrationWebhookEnabled: false,
    registrationWebhookUrl: '',
    registrationWebhookSecret: '',
    publishStatus: 'published',
  };
}

/**
 * Converts an existing Firestore Meeting document into populated SessionFormValues.
 */
export function mapMeetingToFormValues(meeting: Meeting): SessionFormValues {
  const meetingDate = meeting.meetingTime ? new Date(meeting.meetingTime) : new Date();

  return {
    title: meeting.title || '',
    entity: null,
    meetingSlug: meeting.meetingSlug || `session-${meeting.id.slice(0, 8)}`,
    meetingTime: isNaN(meetingDate.getTime()) ? new Date() : meetingDate,
    type: meeting.type,
    meetingLink: meeting.meetingLink || '',
    logoUrl: meeting.logoUrl || '',
    brandingName: meeting.brandingName || '',
    brandingSlogan: meeting.brandingSlogan || '',
    brandingEnabled: meeting.brandingEnabled ?? true,
    heroLayout: meeting.heroLayout || 'image',
    bannerType: meeting.bannerType || 'none',
    bannerImageUrl: meeting.bannerImageUrl || '',
    bannerEmbedCode: meeting.bannerEmbedCode || '',
    registrationEnabled: meeting.registrationEnabled ?? false,
    registrationRequiredToJoin: meeting.registrationRequiredToJoin ?? false,
    registrationMode: meeting.registrationMode || 'open',
    registrationFields: meeting.registrationFields || getDefaultRegistrationFields(),
    registrationSuccessMessage: meeting.registrationSuccessMessage || '',
    capacityLimit: meeting.capacityLimit,
    waitlistEnabled: meeting.waitlistEnabled ?? false,
    collectAttendeeDetails: meeting.collectAttendeeDetails ?? false,
    heroImageUrl: meeting.heroImageUrl || '',
    heroTitle: meeting.heroTitle || '',
    heroDescription: meeting.heroDescription || '',
    heroTagline: meeting.heroTagline || '',
    heroCtaLabel: meeting.heroCtaLabel || '',
    seo: meeting.seo,
    recordingUrl: meeting.recordingUrl || '',
    brochureUrl: meeting.brochureUrl || '',
    resourceUrl: meeting.resourceUrl || '',
    feedbackFormUrl: meeting.feedbackFormUrl || '',
    durationMinutes: meeting.durationMinutes || meeting.duration || 60,
    adminAlertsEnabled: meeting.adminAlertsEnabled ?? false,
    adminAlertChannel: meeting.adminAlertChannel || 'both',
    adminAlertNotifyManager: meeting.adminAlertNotifyManager ?? false,
    adminAlertSpecificUserIds: meeting.adminAlertSpecificUserIds || [],
    adminAlertEmailTemplateId: meeting.adminAlertEmailTemplateId,
    adminAlertSmsTemplateId: meeting.adminAlertSmsTemplateId,
    adminAlertWhatsappTemplateId: meeting.adminAlertWhatsappTemplateId,
    enabledReminders: meeting.enabledReminders || [],
    entityId: meeting.entityId,
    entityType: meeting.entityType,
    createEntity: meeting.createEntity ?? false,
    entityMapping: {
      nameField: meeting.entityMapping?.nameField || '',
      primaryContactField: meeting.entityMapping?.primaryContactField || '',
      emailField: meeting.entityMapping?.emailField || '',
      phoneField: meeting.entityMapping?.phoneField || '',
      additionalMappings: (meeting.entityMapping?.additionalMappings || []).map(m => ({
        sourceField: m.sourceField || m.fieldKey || '',
        targetProperty: m.targetProperty || m.targetField || '',
      })),
    },
    autoTags: meeting.autoTags || [],
    facilitators: (meeting.facilitators || []).map(f => ({
      id: f.id || `fac_${Math.random().toString(36).slice(2, 7)}`,
      type: f.type || 'workspace_user',
      userId: f.userId,
      name: f.name || '',
      role: f.role || '',
      email: f.email || '',
      phone: f.phone || '',
      image: f.image || '',
      joinLink: f.joinLink || meeting.meetingLink || '',
    })),
    messagingConfig: meeting.messagingConfig || getDefaultMeetingMessagingConfig(),
    registrationWebhookEnabled: meeting.messagingConfig?.registrationWebhookEnabled ?? false,
    registrationWebhookUrl: meeting.messagingConfig?.registrationWebhookUrl || '',
    registrationWebhookSecret: meeting.messagingConfig?.registrationWebhookSecret || '',
    publishStatus: meeting.publishStatus || 'published',
  };
}
