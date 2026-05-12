'use server';

import { seedGlobalMessagingBlueprint } from '@/lib/seed-messaging-blueprint';
import { TemplateCategory, VariableContext, ReminderConfig } from '@/lib/types';

interface TemplateDef {
  name: string;
  category: TemplateCategory;
  templateType: string;
  channel: 'email' | 'sms' | 'in_app' | 'push';
  recipientType?: string;
  subject?: string;
  body: string;
  variableContext: VariableContext;
  declaredVariables: string[];
  reminderConfig?: ReminderConfig;
}

const TEMPLATES: TemplateDef[] = [
  // ── Meetings ──────────────────────────────────────────────────────────────
  {
    name: 'Meeting Invitation (Email)', category: 'meetings', templateType: 'meeting_invitation', channel: 'email',
    subject: "You're invited: {{meeting_title}}",
    body: `Hi {{contact_name}},\n\nYou are invited to join {{meeting_title}}.\n\n📅 Date & Time: {{meeting_time}}\n🔗 Join Link: {{meeting_link}}\n👤 Organizer: {{organizer_name}}\n\nWe look forward to seeing you there.\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organizer_name', 'organization_name'],
  },
  {
    name: 'Meeting Invitation (SMS)', category: 'meetings', templateType: 'meeting_invitation', channel: 'sms',
    body: "Hi {{contact_name}}, you're invited to {{meeting_title}} on {{meeting_time}}. Join: {{meeting_link}}",
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link'],
  },
  {
    name: 'Meeting Confirmation (Email)', category: 'meetings', templateType: 'meeting_confirmation', channel: 'email',
    subject: 'Confirmed: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nYour attendance for {{meeting_title}} has been confirmed.\n\n📅 Date & Time: {{meeting_time}}\n🔗 Join Link: {{meeting_link}}\n\nSee you there!\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organization_name'],
  },
  {
    name: 'Meeting Cancellation (Email)', category: 'meetings', templateType: 'meeting_cancellation', channel: 'email',
    subject: 'Cancelled: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nWe regret to inform you that {{meeting_title}} scheduled for {{meeting_time}} has been cancelled.\n\n{{cancellation_reason}}\n\nWe apologise for any inconvenience. We will be in touch to reschedule.\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'cancellation_reason', 'organization_name'],
  },
  {
    name: 'Meeting Cancellation (SMS)', category: 'meetings', templateType: 'meeting_cancellation', channel: 'sms',
    body: "Hi {{contact_name}}, {{meeting_title}} on {{meeting_time}} has been cancelled. We'll be in touch to reschedule.",
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_time'],
  },
  {
    name: 'Meeting Update (Email)', category: 'meetings', templateType: 'meeting_update', channel: 'email',
    subject: 'Updated: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nThe details for {{meeting_title}} have been updated.\n\nPrevious time: {{old_meeting_time}}\nNew time: {{new_meeting_time}}\n🔗 Join Link: {{meeting_link}}\n\nPlease update your calendar accordingly.\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'old_meeting_time', 'new_meeting_time', 'meeting_link', 'organization_name'],
  },
  {
    name: 'Meeting Update (SMS)', category: 'meetings', templateType: 'meeting_update', channel: 'sms',
    body: 'Hi {{contact_name}}, {{meeting_title}} rescheduled from {{old_meeting_time}} to {{new_meeting_time}}. Link: {{meeting_link}}',
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'old_meeting_time', 'new_meeting_time', 'meeting_link'],
  },

  // ── Meeting Registration Confirmation ──────────────────────────────────
  {
    name: 'Meeting Registration Confirmation (Email)', category: 'meetings', templateType: 'meeting_registration_confirmation', channel: 'email',
    subject: 'Registration Confirmed: {{meeting_title}}',
    body: `Dear {{contact_name}},\n\nThank you for registering for {{meeting_title}}.\n\nYour registration has been received successfully, and we're excited to have you join us.\n\n📅 Date: {{meeting_date}}\n⏰ Time: {{meeting_time}}\n📍 Platform: {{meeting_type}}\n🔗 Access Link: {{meeting_link}}\n\nPlease save this information for easy access on the day of the session.\n\nIf there are any updates or additional instructions before the event, we will share them with you.\n\nWe look forward to having you participate.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_type', 'meeting_link', 'organization_name'],
  },
  {
    name: 'Meeting Registration Confirmation – Short (Email)', category: 'meetings', templateType: 'meeting_registration_confirmation_short', channel: 'email',
    subject: 'Confirmed: {{meeting_title}}',
    body: `Dear {{contact_name}},\n\nYour registration for {{meeting_title}} has been confirmed successfully.\n\n📅 {{meeting_date}}\n⏰ {{meeting_time}}\n🔗 {{meeting_link}}\n\nWe look forward to having you join us.\n\nRegards,\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_link', 'organization_name'],
  },
  {
    name: 'Meeting Registration Confirmation (SMS)', category: 'meetings', templateType: 'meeting_registration_confirmation', channel: 'sms',
    body: `Hello {{contact_name}}, thank you for registering for {{meeting_title}}. Your registration has been confirmed successfully.\n\nDate: {{meeting_date}}\nTime: {{meeting_time}}\nJoin here: {{meeting_link}}\n\nWe look forward to having you join us.\n\n— {{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_link', 'organization_name'],
  },

  // ── Meeting Internal Team Notification ─────────────────────────────────
  {
    name: 'New Meeting Registration Alert (Email)', category: 'meetings', templateType: 'meeting_new_registration_alert', channel: 'email',
    recipientType: 'internal_alert',
    subject: 'New Registration: {{meeting_title}}',
    body: `Dear {{organizer_name}},\n\nA new registration has been received for {{meeting_title}}.\n\nRegistrant Details:\n\n• Name: {{contact_name}}\n• Phone: {{contact_phone}}\n• Email: {{contact_email}}\n• Organization: {{entity_name}}\n• Registration Date: {{current_date}}\n\nPlease review and follow up if necessary.\n\nRegards,\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['organizer_name', 'meeting_title', 'contact_name', 'contact_phone', 'contact_email', 'entity_name', 'current_date', 'organization_name'],
  },
  {
    name: 'New Meeting Registration Alert (SMS)', category: 'meetings', templateType: 'meeting_new_registration_alert', channel: 'sms',
    recipientType: 'internal_alert',
    body: `New registration for {{meeting_title}}.\n\nName: {{contact_name}}\nPhone: {{contact_phone}}\nEmail: {{contact_email}}\nOrganization: {{entity_name}}`,
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'contact_name', 'contact_phone', 'contact_email', 'entity_name'],
  },

  // ── Meeting Reminders ─────────────────────────────────────────────────────
  {
    name: 'Meeting Reminder – 15 Minutes (Email)', category: 'reminders', templateType: 'meeting_reminder_15min', channel: 'email',
    subject: 'Starting in 15 minutes: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nYour meeting {{meeting_title}} starts in 15 minutes.\n\n🔗 Join now: {{meeting_link}}\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 15, offsetLabel: '15 minutes before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 15 Minutes (SMS)', category: 'reminders', templateType: 'meeting_reminder_15min', channel: 'sms',
    body: '⏰ {{meeting_title}} starts in 15 minutes. Join: {{meeting_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'meeting_link'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 15, offsetLabel: '15 minutes before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 1 Hour (Email)', category: 'reminders', templateType: 'meeting_reminder_1hour', channel: 'email',
    subject: 'Starting in 1 hour: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nA reminder that {{meeting_title}} starts in 1 hour.\n\n📅 Time: {{meeting_time}}\n🔗 Join Link: {{meeting_link}}\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 60, offsetLabel: '1 hour before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 1 Hour (SMS)', category: 'reminders', templateType: 'meeting_reminder_1hour', channel: 'sms',
    body: '⏰ {{meeting_title}} starts in 1 hour at {{meeting_time}}. Join: {{meeting_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'meeting_time', 'meeting_link'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 60, offsetLabel: '1 hour before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 2 Hours (Email)', category: 'reminders', templateType: 'meeting_reminder_2hours', channel: 'email',
    subject: 'Starting in 2 hours: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nA reminder that {{meeting_title}} starts in 2 hours.\n\n📅 Time: {{meeting_time}}\n🔗 Join Link: {{meeting_link}}\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 120, offsetLabel: '2 hours before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 2 Hours (SMS)', category: 'reminders', templateType: 'meeting_reminder_2hours', channel: 'sms',
    body: '⏰ {{meeting_title}} starts in 2 hours at {{meeting_time}}. Join: {{meeting_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'meeting_time', 'meeting_link'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 120, offsetLabel: '2 hours before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 1 Day (Email)', category: 'reminders', templateType: 'meeting_reminder_1day', channel: 'email',
    subject: 'Tomorrow: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nThis is a reminder that {{meeting_title}} is scheduled for tomorrow.\n\n📅 Time: {{meeting_time}}\n🔗 Join Link: {{meeting_link}}\n\nWe look forward to seeing you.\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 1440, offsetLabel: '1 day before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 1 Day (SMS)', category: 'reminders', templateType: 'meeting_reminder_1day', channel: 'sms',
    body: '📅 Reminder: {{meeting_title}} is tomorrow at {{meeting_time}}. Join: {{meeting_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'meeting_time', 'meeting_link'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 1440, offsetLabel: '1 day before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Starting Now (Email)', category: 'reminders', templateType: 'meeting_time_up', channel: 'email',
    subject: 'Starting Now: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\n{{meeting_title}} is starting right now!\n\n🔗 Join immediately: {{meeting_link}}\n\nDon't miss out!\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_link', 'organization_name'],
    reminderConfig: { triggerType: 'on_deadline', offsetMinutes: 0, offsetLabel: 'At event time', eventType: 'meeting' },
  },
  {
    name: 'Meeting Time Up (SMS)', category: 'reminders', templateType: 'meeting_time_up', channel: 'sms',
    body: '🔔 {{meeting_title}} is starting now! Join: {{meeting_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'meeting_link'],
    reminderConfig: { triggerType: 'on_deadline', offsetMinutes: 0, offsetLabel: 'At event time', eventType: 'meeting' },
  },

  // ── Post-Event Follow-Up ────────────────────────────────────────────────
  {
    name: 'Post-Meeting Follow-Up (Email)', category: 'meetings', templateType: 'meeting_post_event', channel: 'email',
    subject: 'Thank you for attending {{meeting_title}}',
    body: `Dear {{contact_name}},\n\nThank you for attending {{meeting_title}}. We hope you found the session valuable.\n\nIf you have any questions or need further information, please don't hesitate to reach out.\n\nWe look forward to seeing you at future events.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'organization_name'],
  },
  {
    name: 'Post-Meeting Follow-Up (SMS)', category: 'meetings', templateType: 'meeting_post_event', channel: 'sms',
    body: 'Thank you for attending {{meeting_title}}! We hope you found it valuable. — {{organization_name}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'organization_name'],
  },

  // ── Facilitator Templates ───────────────────────────────────────────────
  {
    name: 'Facilitator Pre-Event Briefing (Email)', category: 'meetings', templateType: 'facilitator_reminder', channel: 'email',
    recipientType: 'internal_alert',
    subject: 'Facilitator Briefing: {{meeting_title}}',
    body: `Hi {{user_name}},\n\nThis is your facilitator reminder for {{meeting_title}}.\n\n📅 Date: {{meeting_date}}\n⏰ Time: {{meeting_time}}\n🔗 Meeting Link: {{meeting_link}}\n📊 Registrants: {{registrant_count}}\n\nPlease ensure you are prepared and available to join 5 minutes early.\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['user_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_link', 'registrant_count', 'organization_name'],
  },
  {
    name: 'Facilitator Post-Event Debrief (Email)', category: 'meetings', templateType: 'facilitator_debrief', channel: 'email',
    recipientType: 'internal_alert',
    subject: 'Debrief: {{meeting_title}} Complete',
    body: `Hi {{user_name}},\n\n{{meeting_title}} has concluded.\n\nAttendance Summary:\n• Total Registrations: {{registrant_count}}\n• Attended: {{attendee_count}}\n• No-Shows: {{no_show_count}}\n\nPlease review the registrant list and follow up with any action items.\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['user_name', 'meeting_title', 'registrant_count', 'attendee_count', 'no_show_count', 'organization_name'],
  },

  // ── Forms ─────────────────────────────────────────────────────────────────
  {
    name: 'Form Invitation (Email)', category: 'forms', templateType: 'form_invitation', channel: 'email',
    subject: 'Action required: {{form_name}}',
    body: `Hi {{respondent_name}},\n\nYou have been invited to complete: {{form_name}}.\n\n🔗 Access the form: {{form_link}}\n⏰ Deadline: {{submission_deadline}}\n\nPlease complete it at your earliest convenience.\n\n{{organization_name}}`,
    variableContext: 'form', declaredVariables: ['respondent_name', 'form_name', 'form_link', 'submission_deadline', 'organization_name'],
  },
  {
    name: 'Form Invitation (SMS)', category: 'forms', templateType: 'form_invitation', channel: 'sms',
    body: 'Hi {{respondent_name}}, please complete {{form_name}} by {{submission_deadline}}: {{form_link}}',
    variableContext: 'form', declaredVariables: ['respondent_name', 'form_name', 'submission_deadline', 'form_link'],
  },
  {
    name: 'Form Submission Confirmation (Email)', category: 'forms', templateType: 'submission_confirmation', channel: 'email',
    subject: 'Submission received: {{form_name}}',
    body: `Hi {{respondent_name}},\n\nThank you! We have received your submission for {{form_name}}.\n\n📅 Submitted on: {{submission_date}}\n\n{{organization_name}}`,
    variableContext: 'form', declaredVariables: ['respondent_name', 'form_name', 'submission_date', 'organization_name'],
  },
  {
    name: 'Form Submission Reminder (Email)', category: 'forms', templateType: 'submission_reminder', channel: 'email',
    subject: 'Reminder: {{form_name}} due soon',
    body: `Hi {{respondent_name}},\n\n{{form_name}} is due soon.\n\n⏰ Deadline: {{deadline}}\n📅 Days remaining: {{days_remaining}}\n🔗 Complete it here: {{form_link}}\n\n{{organization_name}}`,
    variableContext: 'form', declaredVariables: ['respondent_name', 'form_name', 'deadline', 'days_remaining', 'form_link', 'organization_name'],
  },
  {
    name: 'Form Submission Reminder (SMS)', category: 'forms', templateType: 'submission_reminder', channel: 'sms',
    body: 'Reminder: {{form_name}} is due in {{days_remaining}} day(s). Complete it: {{form_link}}',
    variableContext: 'form', declaredVariables: ['form_name', 'days_remaining', 'form_link'],
  },

  // ── Surveys ───────────────────────────────────────────────────────────────
  {
    name: 'Survey Invitation (Email)', category: 'surveys', templateType: 'survey_invitation', channel: 'email',
    subject: "We'd love your feedback: {{survey_title}}",
    body: `Hi {{respondent_name}},\n\nWe invite you to participate in our survey: {{survey_title}}.\n\nYour feedback is important and will only take a few minutes.\n\n🔗 Start the survey: {{survey_link}}\n\nThank you for your time.\n\n{{organization_name}}`,
    variableContext: 'survey', declaredVariables: ['respondent_name', 'survey_title', 'survey_link', 'organization_name'],
  },
  {
    name: 'Survey Invitation (SMS)', category: 'surveys', templateType: 'survey_invitation', channel: 'sms',
    body: "Hi {{respondent_name}}, we'd love your feedback on {{survey_title}}. Take the survey: {{survey_link}}",
    variableContext: 'survey', declaredVariables: ['respondent_name', 'survey_title', 'survey_link'],
  },
  {
    name: 'Survey Completion (Email)', category: 'surveys', templateType: 'survey_completion', channel: 'email',
    subject: 'Thank you for completing {{survey_title}}',
    body: `Hi {{respondent_name}},\n\nThank you for completing {{survey_title}}!\n\n📅 Completed on: {{completion_date}}\n🏆 Your score: {{score}}\n\n{{result_message}}\n\nWe appreciate your valuable feedback.\n\n{{organization_name}}`,
    variableContext: 'survey', declaredVariables: ['respondent_name', 'survey_title', 'completion_date', 'score', 'result_message', 'organization_name'],
  },
  {
    name: 'Survey Reminder (Email)', category: 'surveys', templateType: 'survey_reminder', channel: 'email',
    subject: "Reminder: {{survey_title}} — still waiting for your response",
    body: `Hi {{respondent_name}},\n\nWe noticed you haven't completed {{survey_title}} yet.\n\n🔗 Complete the survey: {{survey_link}}\n📅 Days remaining: {{days_remaining}}\n\n{{organization_name}}`,
    variableContext: 'survey', declaredVariables: ['respondent_name', 'survey_title', 'survey_link', 'days_remaining', 'organization_name'],
  },
  {
    name: 'Survey Reminder (SMS)', category: 'surveys', templateType: 'survey_reminder', channel: 'sms',
    body: "Hi {{respondent_name}}, don't forget to complete {{survey_title}}. {{days_remaining}} day(s) left: {{survey_link}}",
    variableContext: 'survey', declaredVariables: ['respondent_name', 'survey_title', 'days_remaining', 'survey_link'],
  },

  // ── Agreements ────────────────────────────────────────────────────────────
  {
    name: 'Contract Sent (Email)', category: 'agreements', templateType: 'contract_sent', channel: 'email',
    subject: 'Contract ready for your signature: {{contract_name}}',
    body: `Hi {{signatory_name}},\n\nA contract has been prepared for your review and signature: {{contract_name}}.\n\n🔗 Review and sign: {{contract_link}}\n⏰ Deadline: {{deadline}}\n\n{{organization_name}}`,
    variableContext: 'agreement', declaredVariables: ['signatory_name', 'contract_name', 'contract_link', 'deadline', 'organization_name'],
  },
  {
    name: 'Contract Signed (Email)', category: 'agreements', templateType: 'contract_signed', channel: 'email',
    subject: 'Contract signed: {{contract_name}}',
    body: `Hi {{signatory_name}},\n\nThank you! {{contract_name}} has been successfully signed.\n\n📅 Signed on: {{signing_date}}\n\nA copy has been saved to your records.\n\n{{organization_name}}`,
    variableContext: 'agreement', declaredVariables: ['signatory_name', 'contract_name', 'signing_date', 'organization_name'],
  },
  {
    name: 'Contract Pending (Email)', category: 'agreements', templateType: 'contract_pending', channel: 'email',
    subject: 'Action required: {{contract_name}} awaiting signature',
    body: `Hi {{signatory_name}},\n\n{{contract_name}} is still awaiting your signature.\n\n⏰ Deadline: {{deadline}}\n📅 Days remaining: {{days_remaining}}\n🔗 Sign here: {{contract_link}}\n\n{{organization_name}}`,
    variableContext: 'agreement', declaredVariables: ['signatory_name', 'contract_name', 'deadline', 'days_remaining', 'contract_link', 'organization_name'],
  },
  {
    name: 'Contract Pending (SMS)', category: 'agreements', templateType: 'contract_pending', channel: 'sms',
    body: 'Hi {{signatory_name}}, {{contract_name}} is awaiting your signature. Deadline: {{deadline}}. Sign: {{contract_link}}',
    variableContext: 'agreement', declaredVariables: ['signatory_name', 'contract_name', 'deadline', 'contract_link'],
  },
  {
    name: 'Contract Reminder (Email)', category: 'agreements', templateType: 'contract_reminder', channel: 'email',
    subject: 'Reminder: {{contract_name}} expires soon',
    body: `Hi {{signatory_name}},\n\nThis is a reminder that {{contract_name}} requires your signature before the deadline.\n\n⏰ Deadline: {{deadline}}\n🔗 Sign here: {{contract_link}}\n\n{{organization_name}}`,
    variableContext: 'agreement', declaredVariables: ['signatory_name', 'contract_name', 'deadline', 'contract_link', 'organization_name'],
  },
  {
    name: 'Contract Reminder (SMS)', category: 'agreements', templateType: 'contract_reminder', channel: 'sms',
    body: 'Reminder: {{contract_name}} deadline is {{deadline}}. Sign here: {{contract_link}}',
    variableContext: 'agreement', declaredVariables: ['contract_name', 'deadline', 'contract_link'],
  },

  // ── General ───────────────────────────────────────────────────────────────
  {
    name: 'Welcome Message (Email)', category: 'general', templateType: 'welcome_message', channel: 'email',
    subject: "Welcome to {{organization_name}}!",
    body: `Hi {{contact_name}},\n\nWelcome to {{organization_name}}! We're thrilled to have you on board.\n\nYou've been added to {{workspace_name}} and your account is now active.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'common', declaredVariables: ['contact_name', 'organization_name', 'workspace_name'],
  },
  {
    name: 'Stage Change (Email)', category: 'general', templateType: 'stage_change', channel: 'email',
    subject: 'Update: {{entity_name}} has moved to {{new_stage}}',
    body: `Hi {{user_name}},\n\n{{entity_name}} has been moved to a new stage.\n\nPrevious stage: {{old_stage}}\nNew stage: {{new_stage}}\nAssigned to: {{assigned_to}}\n\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['user_name', 'entity_name', 'old_stage', 'new_stage', 'assigned_to', 'organization_name'],
  },
  {
    name: 'Stage Change (SMS)', category: 'general', templateType: 'stage_change', channel: 'sms',
    body: '{{entity_name}} moved from {{old_stage}} to {{new_stage}}. Assigned to: {{assigned_to}}.',
    variableContext: 'entity', declaredVariables: ['entity_name', 'old_stage', 'new_stage', 'assigned_to'],
  },
  {
    name: 'Assignment Notification (Email)', category: 'general', templateType: 'assignment_notification', channel: 'email',
    subject: '{{entity_name}} has been assigned to you',
    body: `Hi {{assigned_to}},\n\n{{entity_name}} has been assigned to you by {{assigner_name}}.\n\nPlease log in to review the details and take the next steps.\n\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['assigned_to', 'entity_name', 'assigner_name', 'organization_name'],
  },
  {
    name: 'Status Update (Email)', category: 'general', templateType: 'status_update', channel: 'email',
    subject: 'Status update: {{entity_name}}',
    body: `Hi {{user_name}},\n\nThe status of {{entity_name}} has been updated.\n\nPrevious status: {{old_status}}\nNew status: {{new_status}}\n\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['user_name', 'entity_name', 'old_status', 'new_status', 'organization_name'],
  },
  {
    name: 'Status Update (SMS)', category: 'general', templateType: 'status_update', channel: 'sms',
    body: '{{entity_name}} status changed from {{old_status}} to {{new_status}}.',
    variableContext: 'entity', declaredVariables: ['entity_name', 'old_status', 'new_status'],
  },
  
  // ── Tasks ─────────────────────────────────────────────────────────────────
  {
    name: 'New Task Assigned (Email)', category: 'tasks', templateType: 'task_assigned', channel: 'email', recipientType: 'assignee',
    subject: 'Action Required: You have been assigned a new task',
    body: `Hi {{assignee_name}},\n\nA new task has been assigned to you by {{assigner_name}}.\n\n📋 Task: {{task_name}}\n⏰ Due Date: {{task_due_date}}\n🔗 View Details: {{task_link}}\n\nPlease review the task and update the status accordingly.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['assignee_name', 'assigner_name', 'task_name', 'task_due_date', 'task_link', 'organization_name'],
  },
  {
    name: 'New Task Assigned (In-App)', category: 'tasks', templateType: 'task_assigned', channel: 'in_app', recipientType: 'assignee',
    body: `You have a new task: {{task_name}} due on {{task_due_date}}. Assigned by {{assigner_name}}.`,
    variableContext: 'entity', declaredVariables: ['task_name', 'task_due_date', 'assigner_name'],
  },
  {
    name: 'New Task Assigned (Push)', category: 'tasks', templateType: 'task_assigned', channel: 'push', recipientType: 'assignee',
    body: `New task assigned: {{task_name}}`,
    variableContext: 'entity', declaredVariables: ['task_name'],
  },
  {
    name: 'Task Reminder - 1 Day Before (Email)', category: 'tasks', templateType: 'task_reminder_1day', channel: 'email', recipientType: 'assignee',
    subject: 'Reminder: Task "{{task_name}}" is due tomorrow',
    body: `Hi {{assignee_name}},\n\nThis is a reminder that the following task is due tomorrow:\n\n📋 Task: {{task_name}}\n⏰ Due Date: {{task_due_date}}\n🔗 View Details: {{task_link}}\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['assignee_name', 'task_name', 'task_due_date', 'task_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 1440, offsetLabel: '1 day before', eventType: 'task_reminder' },
  },
  {
    name: 'Task Reminder - Overdue (Email)', category: 'tasks', templateType: 'task_overdue', channel: 'email', recipientType: 'assignee',
    subject: 'Urgent: Task "{{task_name}}" is overdue',
    body: `Hi {{assignee_name}},\n\nThe following task is now overdue:\n\n📋 Task: {{task_name}}\n⏰ Original Due Date: {{task_due_date}}\n🔗 View Details: {{task_link}}\n\nPlease address this as soon as possible.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['assignee_name', 'task_name', 'task_due_date', 'task_link', 'organization_name'],
    reminderConfig: { triggerType: 'after_failure', offsetMinutes: 1440, offsetLabel: '1 day after', eventType: 'task_reminder' },
  },
  {
    name: 'Task Completed (Email)', category: 'tasks', templateType: 'task_completed', channel: 'email', recipientType: 'internal_alert',
    subject: 'Task Completed: {{task_name}}',
    body: `Hi,\n\nThe following task has been marked as completed by {{assignee_name}}.\n\n📋 Task: {{task_name}}\n📅 Completed On: {{completion_date}}\n🔗 View Details: {{task_link}}\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['assignee_name', 'task_name', 'completion_date', 'task_link', 'organization_name'],
    reminderConfig: { triggerType: 'after_completion', offsetMinutes: 0, offsetLabel: 'On completion', eventType: 'task_reminder' },
  },

  // ── Automations ───────────────────────────────────────────────────────────
  {
    name: 'Automation Failed (Email)', category: 'automations', templateType: 'automation_failed', channel: 'email', recipientType: 'internal_alert',
    subject: 'Alert: Automation Workflow Failed',
    body: `Hello,\n\nThe automation workflow "{{workflow_name}}" encountered an error and failed to execute successfully.\n\n🔴 Error Details: {{error_message}}\n⏰ Time of Failure: {{failure_time}}\n🔗 Review Workflow: {{workflow_link}}\n\nPlease investigate the issue promptly to ensure operations continue smoothly.\n\n{{organization_name}}`,
    variableContext: 'common', declaredVariables: ['workflow_name', 'error_message', 'failure_time', 'workflow_link', 'organization_name'],
  },
  {
    name: 'Automation Failed (Push)', category: 'automations', templateType: 'automation_failed', channel: 'push', recipientType: 'internal_alert',
    body: `Workflow Failed: {{workflow_name}}`,
    variableContext: 'common', declaredVariables: ['workflow_name'],
  },
  {
    name: 'Automation Completed (In-App)', category: 'automations', templateType: 'automation_completed', channel: 'in_app', recipientType: 'internal_alert',
    body: `Workflow "{{workflow_name}}" has successfully completed.`,
    variableContext: 'common', declaredVariables: ['workflow_name'],
  },

  // ── QR Codes ──────────────────────────────────────────────────────────────
  {
    name: 'QR Code Scan Alert (Email)', category: 'qr_codes', templateType: 'qr_scan_alert', channel: 'email', recipientType: 'internal_alert',
    subject: 'Notification: New QR Code Scan',
    body: `Hello,\n\nA new scan has been registered for your QR code.\n\n📱 QR Code: {{qr_name}}\n⏰ Scan Time: {{scan_time}}\n📍 Location: {{scan_location}}\n\n{{organization_name}}`,
    variableContext: 'common', declaredVariables: ['qr_name', 'scan_time', 'scan_location', 'organization_name'],
  },
  {
    name: 'QR Code Scan Alert (Push)', category: 'qr_codes', templateType: 'qr_scan_alert', channel: 'push', recipientType: 'internal_alert',
    body: `New scan for {{qr_name}}`,
    variableContext: 'common', declaredVariables: ['qr_name'],
  },

  // ── Forms & Surveys (Push/In-App Additions) ───────────────────────────────
  {
    name: 'Form Invitation (Push)', category: 'forms', templateType: 'form_invitation', channel: 'push', recipientType: 'respondent',
    body: 'Action required: Please complete {{form_name}} by {{submission_deadline}}.',
    variableContext: 'form', declaredVariables: ['form_name', 'submission_deadline'],
  },
  {
    name: 'Form Submission Confirmation (In-App)', category: 'forms', templateType: 'submission_confirmation', channel: 'in_app', recipientType: 'respondent',
    body: 'Thank you! We have received your submission for {{form_name}}.',
    variableContext: 'form', declaredVariables: ['form_name'],
  },
  {
    name: 'Survey Invitation (Push)', category: 'surveys', templateType: 'survey_invitation', channel: 'push', recipientType: 'respondent',
    body: "We'd love your feedback on {{survey_title}}.",
    variableContext: 'survey', declaredVariables: ['survey_title'],
  },
  {
    name: 'Survey Completion (In-App)', category: 'surveys', templateType: 'survey_completion', channel: 'in_app', recipientType: 'respondent',
    body: 'Thank you for completing {{survey_title}}!',
    variableContext: 'survey', declaredVariables: ['survey_title'],
  },
];

export interface SeedGlobalTemplatesResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
}

export async function seedGlobalTemplatesAction(): Promise<{ total: number; created: number; skipped: number; failed: number; errors: any[] }> {
  const result = await seedGlobalMessagingBlueprint();
  
  if (result.success) {
    return {
      total: result.templates,
      created: result.templates,
      skipped: 0,
      failed: 0,
      errors: []
    };
  } else {
    return {
      total: 0,
      created: 0,
      skipped: 0,
      failed: 1,
      errors: [{ name: 'Global Blueprint', error: result.error || 'Unknown error' }]
    };
  }
}
