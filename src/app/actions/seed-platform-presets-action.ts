/**
 * @fileoverview Comprehensive 15-Domain Platform Template Master Preset Seeder
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Seeds canonical, high-production-grade templates across all 15 platform domains.
 * - Enforces chunked batch writes (<= 30 items per batch) with 50ms intervals to prevent Firestore batch overload.
 * - Single source of truth: all template tokens adhere to `FieldsVariablesService` canonical variable tags.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Exported server action `seedAllPlatformTemplatesAction` verified in `template-presets-seeder.test.ts`.
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { ALL_TEMPLATES } from '@/lib/page-builder/templates';
import { STATIC_SECTION_TEMPLATES } from '@/lib/page-builder/templates/sections';
import { authorizeBackoffice } from '@/lib/backoffice/backoffice-auth';
import { logBackofficeAction } from '@/lib/backoffice/audit-logger';
import { getErrorMessage } from '@/lib/backoffice/backoffice-errors';
import { chunkArray } from '@/lib/backoffice/template-propagation-engine';
import type { PlatformTemplate, PlatformTemplateType } from '@/lib/backoffice/backoffice-types';
import { CANONICAL_ROLE_BLUEPRINTS } from '@/lib/role-blueprint-presets';
import { SYSTEM_POSTER_TEMPLATES } from '@/lib/poster-templates';

export interface SeedDomainResult {
  pages: number;
  sections: number;
  messaging: number;
  meetings: number;
  surveys: number;
  forms: number;
  automations: number;
  pipelines: number;
  portals: number;
  pdfs: number;
  dunning: number;
  credentials: number;
  qr_templates?: number;
  governance: number;
  total: number;
}

export async function seedAllPlatformTemplatesAction(idToken: string): Promise<{
  success: boolean;
  seededCount?: SeedDomainResult;
  error?: string;
}> {
  try {
    const actor = await authorizeBackoffice(idToken, 'templates', 'create');
    const timestamp = new Date().toISOString();
    const allPresets: PlatformTemplate[] = [];

    // Helper to generate standard platform template record
    const createTemplate = (
      id: string,
      type: PlatformTemplateType,
      name: string,
      description: string,
      category: string,
      content: Record<string, unknown>,
      defaultForNewOrgs = false
    ): PlatformTemplate => ({
      id,
      type,
      name,
      description,
      category,
      scope: 'system',
      version: 1,
      versionHistory: [
        {
          version: 1,
          content,
          publishedAt: timestamp,
          publishedBy: actor.email,
          changelog: 'Initial standard system preset release.',
        },
      ],
      content,
      status: 'published',
      defaultForNewOrgs,
      visibilityRules: {
        orgIds: [],
        workspaceTypes: [],
      },
      usageCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: actor.userId,
    });

    // 1. Pages & CMS Templates
    const blankPage = {
      id: 'blank-page',
      name: 'Blank Page Canvas',
      description: 'Start from scratch with an unconstrained design canvas.',
      goal: 'information',
      isGlobal: true,
      structureJson: { sections: [] },
      industry: 'all',
    };
    allPresets.push(createTemplate('blank-page', 'page', 'Blank Page Canvas', blankPage.description, 'General', blankPage, true));

    for (const page of ALL_TEMPLATES) {
      allPresets.push(createTemplate(page.id, 'page', page.name, page.description || 'Page builder starter layout.', page.goal || 'General', page as unknown as Record<string, unknown>));
    }

    // 2. Sections
    for (const section of STATIC_SECTION_TEMPLATES) {
      const docId = `section-${section.id}`;
      const desc = ('description' in section && typeof (section as Record<string, unknown>).description === 'string')
        ? (section as Record<string, unknown>).description as string
        : 'Modular page section preset.';
      allPresets.push(createTemplate(docId, 'section', section.name, desc, section.category, section as unknown as Record<string, unknown>));
    }

    // 3. Messaging Templates (Email, SMS, WhatsApp, Push)
    allPresets.push(
      createTemplate('msg-welcome-email', 'messaging', 'Client Welcome & Onboarding Email', 'Automated greeting with dynamic portal links and account briefing.', 'Onboarding', {
        channel: 'email',
        subject: 'Welcome to {{entity_name}}, {{contact_name}}!',
        body: 'Hello {{contact_name}},\n\nWelcome to {{entity_name}}! We are thrilled to have you on board.\n\nYou can access your personalized client portal here:\n{{portal_url}}\n\nBest regards,\nThe {{entity_name}} Team',
        variables: ['contact_name', 'entity_name', 'portal_url'],
      }, true),
      createTemplate('msg-consultation-sms', 'messaging', 'Meeting Booking SMS Confirmation', 'Concise SMS dispatch with instant calendar link.', 'Meetings', {
        channel: 'sms',
        body: 'Hi {{contact_name}}, your consultation with {{entity_name}} is confirmed for {{meeting_time}}. Join: {{meeting_url}}',
        variables: ['contact_name', 'entity_name', 'meeting_time', 'meeting_url'],
      }),
      createTemplate('msg-whatsapp-booking', 'messaging', 'WhatsApp Interactive Session Pass', 'Rich WhatsApp template with interactive confirmation buttons.', 'Meetings', {
        channel: 'whatsapp',
        body: '👋 Hi {{contact_name}}, your upcoming session with *{{entity_name}}* is scheduled!\n\n📅 Date: {{meeting_date}}\n⏰ Time: {{meeting_time}}\n🔗 Link: {{meeting_url}}',
        variables: ['contact_name', 'entity_name', 'meeting_date', 'meeting_time', 'meeting_url'],
      }),
      createTemplate('msg-urgent-push-notice', 'messaging', 'Priority Action Push Notification', 'Instant mobile push alert for task deadlines and assignments.', 'Alerts', {
        channel: 'push',
        title: 'Priority Notice: {{entity_name}}',
        body: '{{contact_name}}, action is required on your account regarding {{task_title}}.',
        variables: ['contact_name', 'entity_name', 'task_title'],
      })
    );

    // 4. Meeting Blueprints
    allPresets.push(
      createTemplate('meeting-discovery-demo', 'meeting', 'Product Discovery & Demo Session', 'Structured 30-minute introductory meeting with auto-briefing recording.', 'Sales', {
        durationMinutes: 30,
        provider: 'zoom',
        requiresApproval: false,
        reminderCascade: ['24h_before', '1h_before', '10m_before'],
        agenda: ['Introductions (5m)', 'Needs Discovery (10m)', 'Live Platform Walkthrough (10m)', 'Next Steps & Q&A (5m)'],
      }),
      createTemplate('meeting-onboarding-webinar', 'meeting', 'Cohort Onboarding Webinar', '60-minute interactive broadcast session with live Q&A moderation.', 'Education', {
        durationMinutes: 60,
        provider: 'google_meet',
        isBroadcast: true,
        maxParticipants: 500,
        reminderCascade: ['48h_before', '24h_before', '1h_before', 'live_now'],
      }),
      createTemplate('meeting-support-triage', 'meeting', '15-Minute Rapid Support Drop-In', 'Rapid technical triage room with instant screen-sharing.', 'Support', {
        durationMinutes: 15,
        provider: 'daily',
        requiresApproval: false,
      })
    );

    // 5. Surveys & Assessments
    allPresets.push(
      createTemplate('survey-csat-standard', 'survey', 'Customer Satisfaction Score (CSAT)', 'Standardized 5-point satisfaction rating with open feedback prompt.', 'Feedback', {
        type: 'csat',
        questions: [
          { id: 'q1', type: 'rating_5', title: 'How satisfied are you with {{entity_name}} services?' },
          { id: 'q2', type: 'text', title: 'What could we have done better to improve your experience?' },
        ],
        scoringEnabled: false,
      }),
      createTemplate('survey-nps-loyalty', 'survey', 'Net Promoter Score (NPS) Benchmark', '0-10 loyalty assessment isolating Promoters, Passives, and Detractors.', 'Benchmarking', {
        type: 'nps',
        questions: [
          { id: 'q1', type: 'nps_10', title: 'On a scale from 0-10, how likely are you to recommend {{entity_name}} to a colleague?' },
          { id: 'q2', type: 'text', title: 'What is the primary reason for your score?' },
        ],
        scoringEnabled: true,
      })
    );

    // 6. Dynamic Forms
    allPresets.push(
      createTemplate('form-lead-capture', 'form', 'High-Converting Lead Capture Form', 'Streamlined 3-field contact intake form with instant auto-enrichment.', 'Lead Generation', {
        fields: [
          { id: 'name', type: 'text', label: 'Full Name', required: true },
          { id: 'email', type: 'email', label: 'Work Email', required: true },
          { id: 'phone', type: 'phone', label: 'Phone Number', required: false },
          { id: 'notes', type: 'textarea', label: 'How can we help?', required: false },
        ],
        submitButtonText: 'Get Started Now',
      }),
      createTemplate('form-event-rsvp', 'form', 'VIP Event Registration & RSVP', 'Intake form capturing dietary restrictions and guest counts.', 'Events', {
        fields: [
          { id: 'name', type: 'text', label: 'Attendee Name', required: true },
          { id: 'email', type: 'email', label: 'Email Address', required: true },
          { id: 'guest_count', type: 'select', label: 'Number of Guests', options: ['1', '2', '3+'], required: true },
        ],
        submitButtonText: 'Confirm RSVP',
      })
    );

    // 7. Automations & Workflows (.aflow)
    allPresets.push(
      createTemplate('auto-inactivity-drip', 'automation', 'Inactivity 14-Day Re-engagement Cascade', 'Multi-step automated sequence triggered when an enrolled lead goes dormant.', 'Retention', {
        trigger: 'lead_inactivity_14d',
        steps: [
          { step: 1, action: 'send_email', templateId: 'msg-welcome-email' },
          { step: 2, action: 'delay', durationHours: 72 },
          { step: 3, action: 'send_sms', templateId: 'msg-consultation-sms' },
          { step: 4, action: 'create_task', title: 'Executive Phone Outreach' },
        ],
      }),
      createTemplate('auto-post-meeting-followup', 'automation', 'Post-Meeting Survey & Deal Progression', 'Triggers immediately after meeting completion to capture feedback and advance deal stage.', 'Sales', {
        trigger: 'meeting_completed',
        steps: [
          { step: 1, action: 'send_survey', templateId: 'survey-csat-standard' },
          { step: 2, action: 'advance_pipeline_stage', targetStage: 'Proposal Sent' },
        ],
      })
    );

    // 8. Kanban Deal Pipelines
    allPresets.push(
      createTemplate('pipe-saas-sales', 'pipeline', 'SaaS B2B Sales Pipeline', 'Standard 5-stage B2B revenue pipeline with automated probability multipliers.', 'Revenue', {
        stages: [
          { id: 'stg_lead', name: 'New Lead', probability: 10 },
          { id: 'stg_discovery', name: 'Discovery Call', probability: 30 },
          { id: 'stg_demo', name: 'Product Demo', probability: 50 },
          { id: 'stg_proposal', name: 'Proposal Delivered', probability: 75 },
          { id: 'stg_won', name: 'Closed Won', probability: 100 },
        ],
      }),
      createTemplate('pipe-school-admissions', 'pipeline', 'Academy Admissions Enrollment Pipeline', 'Specialized stages for student inquiry, assessment, and enrollment confirmation.', 'Education', {
        stages: [
          { id: 'stg_inquiry', name: 'Prospective Inquiry', probability: 15 },
          { id: 'stg_visit', name: 'Campus Tour', probability: 40 },
          { id: 'stg_intake', name: 'Assessment & Intake', probability: 70 },
          { id: 'stg_enrolled', name: 'Enrolled & Paid', probability: 100 },
        ],
      })
    );

    // 9. Portals & Themes
    allPresets.push(
      createTemplate('portal-academy-theme', 'theme', 'Academy & Student Learning Portal Theme', 'Pre-configured modern theme with course directory and video lessons layout.', 'Design', {
        mode: 'academy',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        borderRadius: '16px',
        features: ['courses', 'assessments', 'credentials', 'community'],
      }),
      createTemplate('portal-enterprise-hub', 'theme', 'Enterprise Client Operations Portal', 'High-security client dashboard with document signatures and active invoice tracking.', 'Design', {
        mode: 'enterprise',
        primaryColor: '#0F172A',
        secondaryColor: '#6366F1',
        borderRadius: '12px',
        features: ['contracts', 'invoices', 'meetings', 'support_tickets'],
      })
    );

    // 10. PDF Contracts & Agreements
    allPresets.push(
      createTemplate('pdf-msa-agreement', 'pdf', 'Standard Master Services Agreement (MSA)', 'Comprehensive legal service contract with dynamic variable tokens and signature blocks.', 'Legal', {
        documentType: 'msa',
        governingLaw: 'Delaware / Global SaaS Terms',
        signatureRequired: true,
        defaultSections: ['Scope of Services', 'Payment Terms', 'Intellectual Property', 'Confidentiality', 'Limitation of Liability'],
      })
    );

    // 11. Dunning Cascades
    allPresets.push(
      createTemplate('dunning-7stage-cascade', 'dunning', '7-Stage Automated Delinquency Escalation', 'Smart receivable recovery cascade with graceful grace-period notices.', 'Finance', {
        stages: [
          { day: 1, channel: 'email', tone: 'friendly_reminder' },
          { day: 3, channel: 'sms', tone: 'direct_notice' },
          { day: 7, channel: 'email', tone: 'urgent_action_required' },
          { day: 14, channel: 'call_centre', tone: 'executive_escalation' },
        ],
      })
    );

    // 12. QR Badges & Credentials
    allPresets.push(
      createTemplate('qr-event-vip-pass', 'qr_credential', 'Verifiable Event VIP Pass', 'Dynamic high-resolution QR badge with instant cryptographic verification token.', 'Credentials', {
        credentialType: 'event_pass',
        expiryDays: 3,
        showBadgeWatermark: true,
        fields: ['attendee_name', 'entity_name', 'pass_tier', 'verified_qr'],
      })
    );

    // 13. Brand Voices
    allPresets.push(
      createTemplate('brand-voice-executive', 'brand_voice', 'Executive Leadership Tone Profile', 'Authoritative, concise, high-trust communication profile for B2B contracts and updates.', 'Branding', {
        tone: 'executive',
        vocabulary: ['strategic', 'streamlined', 'performance', 'accelerated'],
        guidelines: 'Maintain clear, unambiguous sentences with professional conciseness.',
      })
    );

    // 14. Role Architectures (All 22 Multi-Industry Canonical Blueprints)
    for (const roleBlueprint of CANONICAL_ROLE_BLUEPRINTS) {
      allPresets.push({
        ...roleBlueprint,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: actor.userId,
        versionHistory: [
          {
            version: 1,
            content: roleBlueprint.content,
            publishedAt: timestamp,
            publishedBy: actor.email,
            changelog: 'Initial multi-industry role preset release.',
          },
        ],
      });
    }

    // 15. AI Prompts & Tasks
    allPresets.push(
      createTemplate('prompt-sales-drafter', 'prompt', 'AI Sales Outreach & Proposal Drafter', 'Generates customized sales follow-ups leveraging entity context and meeting summaries.', 'AI', {
        modelTarget: 'gemini-1.5-pro',
        systemPrompt: 'You are an elite B2B sales development representative for {{entity_name}}. Draft an engaging, value-oriented follow-up message for {{contact_name}}.',
        temperature: 0.7,
      }),
      createTemplate('task-support-resolver', 'task', 'Priority Incident Resolution Workflow', 'Checklist task sequence for rapidly remediating tenant support tickets.', 'Operations', {
        checklist: [
          'Verify tenant health scorecard',
          'Inspect dead-letter queue for failed outbound webhooks',
          'Validate token sentinel expiration status',
          'Launch audit-logged support sandbox session',
        ],
      })
    );

    // 16. QR Code Studio & Poster Canvas Templates (System Presets)
    for (const posterTpl of SYSTEM_POSTER_TEMPLATES) {
      allPresets.push(
        createTemplate(
          `qr-tpl-${posterTpl.id}`,
          'qr_template',
          posterTpl.name,
          posterTpl.description,
          posterTpl.category,
          {
            canvasWidth: posterTpl.canvasWidth,
            canvasHeight: posterTpl.canvasHeight,
            backgroundColor: posterTpl.backgroundColor,
            elements: posterTpl.elements,
          },
          true
        )
      );
    }

    // Ingest all presets into Firestore in bounded chunks of <= 30 items
    const chunks = chunkArray(allPresets, 30);
    for (const chunk of chunks) {
      const batch = adminDb.batch();
      for (const tpl of chunk) {
        const ref = adminDb.collection('platform_templates').doc(tpl.id);
        batch.set(ref, tpl);
      }
      await batch.commit();
      // Inter-batch pause to prevent Firestore rate limits
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const seededCount: SeedDomainResult = {
      pages: allPresets.filter((p) => p.type === 'page').length,
      sections: allPresets.filter((p) => p.type === 'section').length,
      messaging: allPresets.filter((p) => p.type === 'messaging').length,
      meetings: allPresets.filter((p) => p.type === 'meeting').length,
      surveys: allPresets.filter((p) => p.type === 'survey').length,
      forms: allPresets.filter((p) => p.type === 'form').length,
      automations: allPresets.filter((p) => p.type === 'automation').length,
      pipelines: allPresets.filter((p) => p.type === 'pipeline').length,
      portals: allPresets.filter((p) => p.type === 'theme').length,
      pdfs: allPresets.filter((p) => p.type === 'pdf').length,
      dunning: allPresets.filter((p) => p.type === 'dunning').length,
      credentials: allPresets.filter((p) => p.type === 'qr_credential').length,
      qr_templates: allPresets.filter((p) => p.type === 'qr_template').length,
      governance: allPresets.filter((p) => ['role_architecture', 'brand_voice', 'prompt', 'task'].includes(p.type)).length,
      total: allPresets.length,
    };

    await logBackofficeAction(actor, 'template.seed_presets', 'platform_template', 'global_catalog', {
      metadata: { seededCount },
    });

    return {
      success: true,
      seededCount,
    };
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error);
    console.error('[SEED_PLATFORM_PRESETS] Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
