#!/usr/bin/env tsx
// @ts-nocheck
/**
 * Seed Script: Global Default Message Templates
 *
 * Usage:
 *   USE_EMULATOR=true npx tsx scripts/seed-global-templates.ts
 *   DRY_RUN=true USE_EMULATOR=true npx tsx scripts/seed-global-templates.ts
 *
 * What it does:
 *   Creates the full set of global default templates across all categories:
 *   - Meetings (invitation, confirmation, cancellation, update)
 *   - Meeting Reminders (15min, 1hr, 2hr, 1day, time_up)
 *   - Forms (invitation, submission_confirmation, submission_reminder)
 *   - Surveys (invitation, completion, reminder)
 *   - Agreements (contract_sent, signed, pending, reminder)
 *   - General (welcome, stage_change, assignment_notification, status_update)
 *
 *   All seeded templates are set to:
 *     scope: 'global', status: 'approved', isActive: true, version: 1
 *
 * Idempotent: skips any template where (scope=global, category, templateType, channel)
 * already exists.
 *
 * IMPORTANT: This script requires USE_EMULATOR=true to run against the Firebase emulator.
 * Make sure the emulator is running first: pnpm firebase emulators:start
 */

import * as dotenv from 'dotenv';
dotenv.config();

// Require emulator for safety
if (process.env.USE_EMULATOR !== 'true') {
  console.error('\n❌ Error: This script must be run with USE_EMULATOR=true for safety.');
  console.error('   Make sure Firebase emulator is running, then run:');
  console.error('   USE_EMULATOR=true npx tsx scripts/seed-global-templates.ts\n');
  process.exit(1);
}

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
console.log('🔧 Using Firestore Emulator at localhost:8080\n');

import { adminDb } from '../src/lib/firebase-admin';
import type { MessageTemplate, TemplateCategory, VariableContext, ReminderConfig } from '../src/lib/types';

const DRY_RUN = process.env.DRY_RUN === 'true';
const SEED_ACTOR = 'seed-script';
const NOW = new Date().toISOString();

// ---------------------------------------------------------------------------
// Template definition shape (without id / timestamps)
// ---------------------------------------------------------------------------

interface TemplateDef {
  name: string;
  category: TemplateCategory;
  templateType: string;
  channel: 'email' | 'sms';
  subject?: string;
  body: string;
  variableContext: VariableContext;
  declaredVariables: string[];
  reminderConfig?: ReminderConfig;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const TEMPLATES: TemplateDef[] = [

  // ── Meetings ──────────────────────────────────────────────────────────────

  {
    name: 'Meeting Invitation (Email)',
    category: 'meetings',
    templateType: 'meeting_invitation',
    channel: 'email',
    subject: 'You\'re invited: {{meeting_title}}',
    body: `Hi {{contact_name}},

You are invited to join {{meeting_title}}.

📅 Date & Time: {{meeting_time}}
🔗 Join Link: {{meeting_link}}
👤 Organizer: {{organizer_name}}

We look forward to seeing you there.

Best regards,
{{organization_name}}`,
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organizer_name', 'organization_name'],
  },

  {
    name: 'Meeting Invitation (SMS)',
    category: 'meetings',
    templateType: 'meeting_invitation',
    channel: 'sms',
    body: 'Hi {{contact_name}}, you\'re invited to {{meeting_title}} on {{meeting_time}}. Join here: {{meeting_link}}',
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link'],
  },

  {
    name: 'Meeting Confirmation (Email)',
    category: 'meetings',
    templateType: 'meeting_confirmation',
    channel: 'email',
    subject: 'Confirmed: {{meeting_title}}',
    body: `Hi {{contact_name}},

Your attendance for {{meeting_title}} has been confirmed.

📅 Date & Time: {{meeting_time}}
🔗 Join Link: {{meeting_link}}

See you there!

{{organization_name}}`,
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organization_name'],
  },

  {
    name: 'Meeting Cancellation (Email)',
    category: 'meetings',
    templateType: 'meeting_cancellation',
    channel: 'email',
    subject: 'Cancelled: {{meeting_title}}',
    body: `Hi {{contact_name}},

We regret to inform you that {{meeting_title}} scheduled for {{meeting_time}} has been cancelled.

{{cancellation_reason}}

We apologise for any inconvenience caused. We will be in touch to reschedule.

{{organization_name}}`,
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'cancellation_reason', 'organization_name'],
  },

  {
    name: 'Meeting Cancellation (SMS)',
    category: 'meetings',
    templateType: 'meeting_cancellation',
    channel: 'sms',
    body: 'Hi {{contact_name}}, {{meeting_title}} on {{meeting_time}} has been cancelled. We\'ll be in touch to reschedule.',
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'meeting_time'],
  },

  {
    name: 'Meeting Update (Email)',
    category: 'meetings',
    templateType: 'meeting_update',
    channel: 'email',
    subject: 'Updated: {{meeting_title}}',
    body: `Hi {{contact_name}},

The details for {{meeting_title}} have been updated.

Previous time: {{old_meeting_time}}
New time: {{new_meeting_time}}
🔗 Join Link: {{meeting_link}}

Please update your calendar accordingly.

{{organization_name}}`,
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'old_meeting_time', 'new_meeting_time', 'meeting_link', 'organization_name'],
  },

  {
    name: 'Meeting Update (SMS)',
    category: 'meetings',
    templateType: 'meeting_update',
    channel: 'sms',
    body: 'Hi {{contact_name}}, {{meeting_title}} has been rescheduled from {{old_meeting_time}} to {{new_meeting_time}}. Link: {{meeting_link}}',
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'old_meeting_time', 'new_meeting_time', 'meeting_link'],
  },

  // ── Meeting Reminders ─────────────────────────────────────────────────────

  {
    name: 'Meeting Reminder – 15 Minutes (Email)',
    category: 'reminders',
    templateType: 'meeting_reminder_15min',
    channel: 'email',
    subject: 'Starting in 15 minutes: {{meeting_title}}',
    body: `Hi {{contact_name}},

Your meeting {{meeting_title}} starts in 15 minutes.

🔗 Join now: {{meeting_link}}

{{organization_name}}`,
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'meeting_link', 'organization_name'],
    reminderConfig: {
      triggerType: 'before_event',
      offsetMinutes: 15,
      offsetLabel: '15 minutes before',
      eventType: 'meeting',
    },
  },

  {
    name: 'Meeting Reminder – 15 Minutes (SMS)',
    category: 'reminders',
    templateType: 'meeting_reminder_15min',
    channel: 'sms',
    body: '⏰ {{meeting_title}} starts in 15 minutes. Join: {{meeting_link}}',
    variableContext: 'meeting',
    declaredVariables: ['meeting_title', 'meeting_link'],
    reminderConfig: {
      triggerType: 'before_event',
      offsetMinutes: 15,
      offsetLabel: '15 minutes before',
      eventType: 'meeting',
    },
  },

  {
    name: 'Meeting Reminder – 1 Hour (Email)',
    category: 'reminders',
    templateType: 'meeting_reminder_1hour',
    channel: 'email',
    subject: 'Starting in 1 hour: {{meeting_title}}',
    body: `Hi {{contact_name}},

A reminder that {{meeting_title}} starts in 1 hour.

📅 Time: {{meeting_time}}
🔗 Join Link: {{meeting_link}}

{{organization_name}}`,
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organization_name'],
    reminderConfig: {
      triggerType: 'before_event',
      offsetMinutes: 60,
      offsetLabel: '1 hour before',
      eventType: 'meeting',
    },
  },

  {
    name: 'Meeting Reminder – 1 Hour (SMS)',
    category: 'reminders',
    templateType: 'meeting_reminder_1hour',
    channel: 'sms',
    body: '⏰ Reminder: {{meeting_title}} starts in 1 hour at {{meeting_time}}. Join: {{meeting_link}}',
    variableContext: 'meeting',
    declaredVariables: ['meeting_title', 'meeting_time', 'meeting_link'],
    reminderConfig: {
      triggerType: 'before_event',
      offsetMinutes: 60,
      offsetLabel: '1 hour before',
      eventType: 'meeting',
    },
  },

  {
    name: 'Meeting Reminder – 2 Hours (Email)',
    category: 'reminders',
    templateType: 'meeting_reminder_2hours',
    channel: 'email',
    subject: 'Starting in 2 hours: {{meeting_title}}',
    body: `Hi {{contact_name}},

A reminder that {{meeting_title}} starts in 2 hours.

📅 Time: {{meeting_time}}
🔗 Join Link: {{meeting_link}}

{{organization_name}}`,
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organization_name'],
    reminderConfig: {
      triggerType: 'before_event',
      offsetMinutes: 120,
      offsetLabel: '2 hours before',
      eventType: 'meeting',
    },
  },

  {
    name: 'Meeting Reminder – 2 Hours (SMS)',
    category: 'reminders',
    templateType: 'meeting_reminder_2hours',
    channel: 'sms',
    body: '⏰ Reminder: {{meeting_title}} starts in 2 hours at {{meeting_time}}. Join: {{meeting_link}}',
    variableContext: 'meeting',
    declaredVariables: ['meeting_title', 'meeting_time', 'meeting_link'],
    reminderConfig: {
      triggerType: 'before_event',
      offsetMinutes: 120,
      offsetLabel: '2 hours before',
      eventType: 'meeting',
    },
  },

  {
    name: 'Meeting Reminder – 1 Day (Email)',
    category: 'reminders',
    templateType: 'meeting_reminder_1day',
    channel: 'email',
    subject: 'Tomorrow: {{meeting_title}}',
    body: `Hi {{contact_name}},

This is a reminder that {{meeting_title}} is scheduled for tomorrow.

📅 Time: {{meeting_time}}
🔗 Join Link: {{meeting_link}}

We look forward to seeing you.

{{organization_name}}`,
    variableContext: 'meeting',
    declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organization_name'],
    reminderConfig: {
      triggerType: 'before_event',
      offsetMinutes: 1440,
      offsetLabel: '1 day before',
      eventType: 'meeting',
    },
  },

  {
    name: 'Meeting Time Up (SMS)',
    category: 'reminders',
    templateType: 'meeting_time_up',
    channel: 'sms',
    body: '🔔 {{meeting_title}} is starting now! Join here: {{meeting_link}}',
    variableContext: 'meeting',
    declaredVariables: ['meeting_title', 'meeting_link'],
    reminderConfig: {
      triggerType: 'on_deadline',
      offsetMinutes: 0,
      offsetLabel: 'At event time',
      eventType: 'meeting',
    },
  },

  // ── Forms ─────────────────────────────────────────────────────────────────

  {
    name: 'Form Invitation (Email)',
    category: 'forms',
    templateType: 'form_invitation',
    channel: 'email',
    subject: 'Action required: {{form_name}}',
    body: `Hi {{respondent_name}},

You have been invited to complete the following form: {{form_name}}.

🔗 Access the form here: {{form_link}}

⏰ Deadline: {{submission_deadline}}

Please complete it at your earliest convenience.

{{organization_name}}`,
    variableContext: 'form',
    declaredVariables: ['respondent_name', 'form_name', 'form_link', 'submission_deadline', 'organization_name'],
  },

  {
    name: 'Form Invitation (SMS)',
    category: 'forms',
    templateType: 'form_invitation',
    channel: 'sms',
    body: 'Hi {{respondent_name}}, please complete {{form_name}} by {{submission_deadline}}: {{form_link}}',
    variableContext: 'form',
    declaredVariables: ['respondent_name', 'form_name', 'submission_deadline', 'form_link'],
  },

  {
    name: 'Form Submission Confirmation (Email)',
    category: 'forms',
    templateType: 'submission_confirmation',
    channel: 'email',
    subject: 'Submission received: {{form_name}}',
    body: `Hi {{respondent_name}},

Thank you! We have received your submission for {{form_name}}.

📅 Submitted on: {{submission_date}}

If you have any questions, please don't hesitate to reach out.

{{organization_name}}`,
    variableContext: 'form',
    declaredVariables: ['respondent_name', 'form_name', 'submission_date', 'organization_name'],
  },

  {
    name: 'Form Submission Reminder (Email)',
    category: 'forms',
    templateType: 'submission_reminder',
    channel: 'email',
    subject: 'Reminder: {{form_name}} due soon',
    body: `Hi {{respondent_name}},

This is a reminder that {{form_name}} is due soon.

⏰ Deadline: {{deadline}}
📅 Days remaining: {{days_remaining}}
🔗 Complete it here: {{form_link}}

{{organization_name}}`,
    variableContext: 'form',
    declaredVariables: ['respondent_name', 'form_name', 'deadline', 'days_remaining', 'form_link', 'organization_name'],
  },

  {
    name: 'Form Submission Reminder (SMS)',
    category: 'forms',
    templateType: 'submission_reminder',
    channel: 'sms',
    body: 'Reminder: {{form_name}} is due in {{days_remaining}} day(s). Complete it here: {{form_link}}',
    variableContext: 'form',
    declaredVariables: ['form_name', 'days_remaining', 'form_link'],
  },

  // ── Surveys ───────────────────────────────────────────────────────────────

  {
    name: 'Survey Invitation (Email)',
    category: 'surveys',
    templateType: 'survey_invitation',
    channel: 'email',
    subject: 'We\'d love your feedback: {{survey_title}}',
    body: `Hi {{respondent_name}},

We invite you to participate in our survey: {{survey_title}}.

Your feedback is important to us and will only take a few minutes.

🔗 Start the survey: {{survey_link}}

Thank you for your time.

{{organization_name}}`,
    variableContext: 'survey',
    declaredVariables: ['respondent_name', 'survey_title', 'survey_link', 'organization_name'],
  },

  {
    name: 'Survey Invitation (SMS)',
    category: 'surveys',
    templateType: 'survey_invitation',
    channel: 'sms',
    body: 'Hi {{respondent_name}}, we\'d love your feedback on {{survey_title}}. Take the survey: {{survey_link}}',
    variableContext: 'survey',
    declaredVariables: ['respondent_name', 'survey_title', 'survey_link'],
  },

  {
    name: 'Survey Completion (Email)',
    category: 'surveys',
    templateType: 'survey_completion',
    channel: 'email',
    subject: 'Thank you for completing {{survey_title}}',
    body: `Hi {{respondent_name}},

Thank you for completing {{survey_title}}!

📅 Completed on: {{completion_date}}
🏆 Your score: {{score}}

{{result_message}}

We appreciate your valuable feedback.

{{organization_name}}`,
    variableContext: 'survey',
    declaredVariables: ['respondent_name', 'survey_title', 'completion_date', 'score', 'result_message', 'organization_name'],
  },

  {
    name: 'Survey Reminder (Email)',
    category: 'surveys',
    templateType: 'survey_reminder',
    channel: 'email',
    subject: 'Reminder: {{survey_title}} — still waiting for your response',
    body: `Hi {{respondent_name}},

We noticed you haven't completed {{survey_title}} yet.

Your feedback matters! It only takes a few minutes.

🔗 Complete the survey: {{survey_link}}
📅 Days remaining: {{days_remaining}}

{{organization_name}}`,
    variableContext: 'survey',
    declaredVariables: ['respondent_name', 'survey_title', 'survey_link', 'days_remaining', 'organization_name'],
  },

  {
    name: 'Survey Reminder (SMS)',
    category: 'surveys',
    templateType: 'survey_reminder',
    channel: 'sms',
    body: 'Hi {{respondent_name}}, don\'t forget to complete {{survey_title}}. {{days_remaining}} day(s) left: {{survey_link}}',
    variableContext: 'survey',
    declaredVariables: ['respondent_name', 'survey_title', 'days_remaining', 'survey_link'],
  },

  // ── Agreements ────────────────────────────────────────────────────────────

  {
    name: 'Contract Sent (Email)',
    category: 'agreements',
    templateType: 'contract_sent',
    channel: 'email',
    subject: 'Contract ready for your signature: {{contract_name}}',
    body: `Hi {{signatory_name}},

A contract has been prepared for your review and signature: {{contract_name}}.

🔗 Review and sign here: {{contract_link}}
⏰ Deadline: {{deadline}}

Please review the document carefully before signing.

{{organization_name}}`,
    variableContext: 'agreement',
    declaredVariables: ['signatory_name', 'contract_name', 'contract_link', 'deadline', 'organization_name'],
  },

  {
    name: 'Contract Signed (Email)',
    category: 'agreements',
    templateType: 'contract_signed',
    channel: 'email',
    subject: 'Contract signed: {{contract_name}}',
    body: `Hi {{signatory_name}},

Thank you! {{contract_name}} has been successfully signed.

📅 Signed on: {{signing_date}}

A copy of the signed contract has been saved to your records.

{{organization_name}}`,
    variableContext: 'agreement',
    declaredVariables: ['signatory_name', 'contract_name', 'signing_date', 'organization_name'],
  },

  {
    name: 'Contract Pending (Email)',
    category: 'agreements',
    templateType: 'contract_pending',
    channel: 'email',
    subject: 'Action required: {{contract_name}} awaiting signature',
    body: `Hi {{signatory_name}},

{{contract_name}} is still awaiting your signature.

⏰ Deadline: {{deadline}}
📅 Days remaining: {{days_remaining}}
🔗 Sign here: {{contract_link}}

Please sign at your earliest convenience.

{{organization_name}}`,
    variableContext: 'agreement',
    declaredVariables: ['signatory_name', 'contract_name', 'deadline', 'days_remaining', 'contract_link', 'organization_name'],
  },

  {
    name: 'Contract Pending (SMS)',
    category: 'agreements',
    templateType: 'contract_pending',
    channel: 'sms',
    body: 'Hi {{signatory_name}}, {{contract_name}} is awaiting your signature. Deadline: {{deadline}}. Sign: {{contract_link}}',
    variableContext: 'agreement',
    declaredVariables: ['signatory_name', 'contract_name', 'deadline', 'contract_link'],
  },

  {
    name: 'Contract Reminder (Email)',
    category: 'agreements',
    templateType: 'contract_reminder',
    channel: 'email',
    subject: 'Reminder: {{contract_name}} expires soon',
    body: `Hi {{signatory_name}},

This is a reminder that {{contract_name}} requires your signature before the deadline.

⏰ Deadline: {{deadline}}
🔗 Sign here: {{contract_link}}

{{organization_name}}`,
    variableContext: 'agreement',
    declaredVariables: ['signatory_name', 'contract_name', 'deadline', 'contract_link', 'organization_name'],
  },

  {
    name: 'Contract Reminder (SMS)',
    category: 'agreements',
    templateType: 'contract_reminder',
    channel: 'sms',
    body: 'Reminder: {{contract_name}} deadline is {{deadline}}. Sign here: {{contract_link}}',
    variableContext: 'agreement',
    declaredVariables: ['contract_name', 'deadline', 'contract_link'],
  },

  // ── General ───────────────────────────────────────────────────────────────

  {
    name: 'Welcome Message (Email)',
    category: 'general',
    templateType: 'welcome_message',
    channel: 'email',
    subject: 'Welcome to {{organization_name}}!',
    body: `Hi {{contact_name}},

Welcome to {{organization_name}}! We're thrilled to have you on board.

You've been added to {{workspace_name}} and your account is now active.

If you have any questions, please don't hesitate to reach out to us.

Best regards,
{{organization_name}}`,
    variableContext: 'common',
    declaredVariables: ['contact_name', 'organization_name', 'workspace_name'],
  },

  {
    name: 'Stage Change (Email)',
    category: 'general',
    templateType: 'stage_change',
    channel: 'email',
    subject: 'Update: {{entity_name}} has moved to {{new_stage}}',
    body: `Hi {{user_name}},

{{entity_name}} has been moved to a new stage.

Previous stage: {{old_stage}}
New stage: {{new_stage}}
Assigned to: {{assigned_to}}

Log in to view the full details.

{{organization_name}}`,
    variableContext: 'entity',
    declaredVariables: ['user_name', 'entity_name', 'old_stage', 'new_stage', 'assigned_to', 'organization_name'],
  },

  {
    name: 'Stage Change (SMS)',
    category: 'general',
    templateType: 'stage_change',
    channel: 'sms',
    body: '{{entity_name}} moved from {{old_stage}} to {{new_stage}}. Assigned to: {{assigned_to}}.',
    variableContext: 'entity',
    declaredVariables: ['entity_name', 'old_stage', 'new_stage', 'assigned_to'],
  },

  {
    name: 'Assignment Notification (Email)',
    category: 'general',
    templateType: 'assignment_notification',
    channel: 'email',
    subject: '{{entity_name}} has been assigned to you',
    body: `Hi {{assigned_to}},

{{entity_name}} has been assigned to you by {{assigner_name}}.

Please log in to review the details and take the next steps.

{{organization_name}}`,
    variableContext: 'entity',
    declaredVariables: ['assigned_to', 'entity_name', 'assigner_name', 'organization_name'],
  },

  {
    name: 'Status Update (Email)',
    category: 'general',
    templateType: 'status_update',
    channel: 'email',
    subject: 'Status update: {{entity_name}}',
    body: `Hi {{user_name}},

The status of {{entity_name}} has been updated.

Previous status: {{old_status}}
New status: {{new_status}}

{{organization_name}}`,
    variableContext: 'entity',
    declaredVariables: ['user_name', 'entity_name', 'old_status', 'new_status', 'organization_name'],
  },

  {
    name: 'Status Update (SMS)',
    category: 'general',
    templateType: 'status_update',
    channel: 'sms',
    body: '{{entity_name}} status changed from {{old_status}} to {{new_status}}.',
    variableContext: 'entity',
    declaredVariables: ['entity_name', 'old_status', 'new_status'],
  },
];

// ---------------------------------------------------------------------------
// Seeding logic
// ---------------------------------------------------------------------------

interface SeedStats {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
}

async function seedTemplates(): Promise<void> {
  console.log(`\n🌱 Seeding global default templates${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const stats: SeedStats = {
    total: TEMPLATES.length,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const def of TEMPLATES) {
    try {
      console.log(`\n  🔄 Processing: ${def.name}`);
      console.log(`     Category: ${def.category}, Type: ${def.templateType}, Channel: ${def.channel}`);
      
      // Check if a global template with this category + templateType + channel already exists
      console.log(`     Checking for existing template...`);
      const existing = await adminDb
        .collection('message_templates')
        .where('scope', '==', 'global')
        .where('category', '==', def.category)
        .where('templateType', '==', def.templateType)
        .where('channel', '==', def.channel)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log(`  ⏭  Skipped (exists): ${def.name}`);
        stats.skipped++;
        continue;
      }

      console.log(`     Creating new template document...`);
      const ref = adminDb.collection('message_templates').doc();

      const template: MessageTemplate = {
        id: ref.id,
        scope: 'global',
        category: def.category,
        templateType: def.templateType,
        name: def.name,
        channel: def.channel,
        subject: def.subject,
        body: def.body,
        variableContext: def.variableContext,
        declaredVariables: def.declaredVariables,
        reminderConfig: def.reminderConfig,
        status: 'approved',
        isActive: true,
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
        createdBy: SEED_ACTOR,
      };

      console.log(`     Template object created with ID: ${ref.id}`);
      console.log(`     Template data:`, JSON.stringify(template, null, 2));

      if (DRY_RUN) {
        console.log(`  🔍 Would create: ${def.name}`);
      } else {
        console.log(`     Writing to Firestore...`);
        await ref.set(template);
        console.log(`  ✅ Created: ${def.name}`);
      }

      stats.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error(`\n  ❌ FAILED: ${def.name}`);
      console.error(`     Error Message: ${message}`);
      console.error(`     Error Type: ${err?.constructor?.name || 'Unknown'}`);
      if (err && typeof err === 'object') {
        console.error(`     Error Details:`, JSON.stringify(err, null, 2));
      }
      if (stack) {
        console.error(`     Stack Trace:\n${stack}`);
      }
      stats.failed++;
      stats.errors.push({ name: def.name, error: message });
    }
  }

  // Summary
  console.log('\n─────────────────────────────────────────');
  console.log(`📊 Seed Summary${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`   Total definitions : ${stats.total}`);
  console.log(`   Created           : ${stats.created}`);
  console.log(`   Skipped (exists)  : ${stats.skipped}`);
  console.log(`   Failed            : ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const e of stats.errors) {
      console.log(`   • ${e.name}: ${e.error}`);
    }
    process.exit(1);
  }

  console.log('\n✅ Done.\n');
}

seedTemplates().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
