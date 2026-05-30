import { TemplateCategory, VariableContext, ReminderConfig } from './types';

export interface TemplateDef {
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

// ── Canonical Meeting Variable Registry (Risk 2 mitigation: Variable Name Drift) ──
export const MEETING_VARIABLES = {
  participant: ['contact_name', 'contact_email', 'contact_phone', 'entity_name'],
  event: ['meeting_title', 'meeting_date', 'meeting_time', 'meeting_timezone', 'meeting_type'],
  links: ['meeting_link', 'calendar_link', 'dashboard_link', 'recording_link', 'resource_link', 'feedback_form_link'],
  facilitator: ['user_name', 'registrant_count', 'attendee_count', 'no_show_count', 'registration_time'],
  system: ['organization_name', 'support_contact'],
} as const;

export const TEMPLATES: TemplateDef[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // ── MEETING LIFECYCLE TEMPLATES (24 total: 12 email + 12 SMS) ──────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── 0. Meeting Invitation (Three-Axis: Inform → Motivate → Direct) ─────
  {
    name: 'Meeting Invitation (Email)', category: 'meetings', templateType: 'meeting_invitation', channel: 'email',
    recipientType: 'external_alert',
    subject: 'You\'re Invited: {{meeting_title}} — {{meeting_date}}',
    body: `Dear {{contact_name}},\n\nWe would like to invite you to an upcoming session that has been organized for your benefit.\n\n📋 What: {{meeting_title}}\n📅 Date: {{meeting_date}}\n⏰ Time: {{meeting_time}} ({{meeting_timezone}})\n📍 Format: {{meeting_type}}\n\nThis session is designed to keep you informed about key developments and provide an opportunity for meaningful engagement. Your participation will make a difference.\n\n🔗 Register Now: [Click Here to Register]({{meeting_registrant_one_click_link}})\n📆 Add to Calendar: [Add to Calendar]({{calendar_link}})\n\nPlease confirm your attendance at your earliest convenience.\n\nWe look forward to welcoming you.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_timezone', 'meeting_type', 'meeting_registrant_one_click_link', 'calendar_link', 'organization_name'],
  },
  {
    name: 'Meeting Invitation (SMS)', category: 'meetings', templateType: 'meeting_invitation', channel: 'sms',
    recipientType: 'external_alert',
    body: `Hi {{contact_name}}, you're invited to {{meeting_title}} on {{meeting_date}} at {{meeting_time}} ({{meeting_timezone}}). Register: {{meeting_registrant_one_click_link}} — {{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_timezone', 'meeting_registrant_one_click_link', 'organization_name'],
  },

  // ── 1. Registration Acknowledgement ────────────────────────────────────
  {
    name: 'Registration Acknowledgement (Email)', category: 'meetings', templateType: 'meeting_registration_ack', channel: 'email',
    recipientType: 'external_alert',
    subject: 'Registration Confirmed: {{meeting_title}}',
    body: `Dear {{contact_name}},\n\nThank you for registering for {{meeting_title}}.\n\nYour registration has been confirmed successfully.\n\nEvent Details\n📅 Date: {{meeting_date}}\n⏰ Time: {{meeting_time}}\n🌍 Time Zone: {{meeting_timezone}}\n📍 Platform: {{meeting_type}}\n🔗 Join Link: [Click Here to Join now]({{registrant_join_link}})\n\n📆 Add to Calendar: [Click To Add Now!]({{calendar_link}})\n\nPlease save this information for easy access on the day of the session.\n\nWe look forward to having you participate.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_timezone', 'meeting_type', 'registrant_join_link', 'calendar_link', 'organization_name'],
  },
  {
    name: 'Registration Acknowledgement (SMS)', category: 'meetings', templateType: 'meeting_registration_ack', channel: 'sms',
    recipientType: 'external_alert',
    body: `Hi {{contact_name}}, your registration for {{meeting_title}} is confirmed. {{meeting_date}} at {{meeting_time}} ({{meeting_timezone}}). Join: {{registrant_join_link}} — {{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_timezone', 'registrant_join_link', 'organization_name'],
  },

  // ── 2. Facilitator: New Registration Alert ─────────────────────────────
  {
    name: 'New Registration Alert (Email)', category: 'meetings', templateType: 'meeting_facilitator_new_registration', channel: 'email',
    recipientType: 'internal_alert',
    subject: 'New Registration: {{meeting_title}}',
    body: `Dear {{user_name}},\n\nA new registration has been received for {{meeting_title}}.\n\nRegistrant Details:\n• Name: {{contact_name}}\n• Email: {{contact_email}}\n• Phone: {{contact_phone}}\n• Organization: {{entity_name}}\n• Registration Time: {{registration_time}}\n\nTotal Registrations: {{registrant_count}}\n\n🔗 Dashboard: [View Dashboard]({{dashboard_link}})\n\nRegards,\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['user_name', 'meeting_title', 'contact_name', 'contact_email', 'contact_phone', 'entity_name', 'registration_time', 'registrant_count', 'dashboard_link', 'organization_name'],
  },
  {
    name: 'New Registration Alert (SMS)', category: 'meetings', templateType: 'meeting_facilitator_new_registration', channel: 'sms',
    recipientType: 'internal_alert',
    body: `New registration for {{meeting_title}}: {{contact_name}} ({{contact_email}}). Total: {{registrant_count}}`,
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'contact_name', 'contact_email', 'registrant_count'],
  },

  // ── 3. Pre-Event Reminders (all use category='meetings' + recipientType='external_alert') ──
  // Note: templateTypePrefix='meeting_reminder' isolates these in ReminderSlotRow dropdowns
  {
    name: 'Meeting Reminder – 2 Days (Email)', category: 'meetings', templateType: 'meeting_reminder_2days', channel: 'email',
    recipientType: 'external_alert',
    subject: 'In 2 Days: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nThis is a reminder that {{meeting_title}} is coming up in 2 days.\n\n📅 Date: {{meeting_date}}\n⏰ Time: {{meeting_time}}\n🌍 Time Zone: {{meeting_timezone}}\n🔗 Join Link: [Click Here to Join now]({{registrant_join_link}})\n\n📆 Add to Calendar: [Click To Add Now!]({{calendar_link}})\n\nWe look forward to seeing you.\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_timezone', 'registrant_join_link', 'calendar_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 2880, offsetLabel: '2 days before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 2 Days (SMS)', category: 'meetings', templateType: 'meeting_reminder_2days', channel: 'sms',
    recipientType: 'external_alert',
    body: '📅 Reminder: {{meeting_title}} is in 2 days — {{meeting_date}} at {{meeting_time}}. Join: {{registrant_join_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'meeting_date', 'meeting_time', 'registrant_join_link'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 2880, offsetLabel: '2 days before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 1 Day (Email)', category: 'meetings', templateType: 'meeting_reminder_1day', channel: 'email',
    recipientType: 'external_alert',
    subject: 'Tomorrow: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nThis is a reminder that {{meeting_title}} is scheduled for tomorrow.\n\n📅 Date: {{meeting_date}}\n⏰ Time: {{meeting_time}}\n🌍 Time Zone: {{meeting_timezone}}\n🔗 Join Link: [Click Here to Join now]({{registrant_join_link}})\n\n📆 Add to Calendar: [Click To Add Now!]({{calendar_link}})\n\nWe look forward to seeing you.\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_timezone', 'registrant_join_link', 'calendar_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 1440, offsetLabel: '1 day before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 1 Day (SMS)', category: 'meetings', templateType: 'meeting_reminder_1day', channel: 'sms',
    recipientType: 'external_alert',
    body: '📅 Reminder: {{meeting_title}} is tomorrow at {{meeting_time}}. Join: {{registrant_join_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'meeting_time', 'registrant_join_link'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 1440, offsetLabel: '1 day before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 1 Hour (Email)', category: 'meetings', templateType: 'meeting_reminder_1hour', channel: 'email',
    recipientType: 'external_alert',
    subject: 'Starting in 1 hour: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\nA reminder that {{meeting_title}} starts in 1 hour.\n\n📅 Time: {{meeting_time}} ({{meeting_timezone}})\n🔗 Join Link: [Click Here to Join now]({{registrant_join_link}})\n\n📆 Add to Calendar: [Click To Add Now!]({{calendar_link}})\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'meeting_time', 'meeting_timezone', 'registrant_join_link', 'calendar_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 60, offsetLabel: '1 hour before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 1 Hour (SMS)', category: 'meetings', templateType: 'meeting_reminder_1hour', channel: 'sms',
    recipientType: 'external_alert',
    body: '⏰ {{meeting_title}} starts in 1 hour at {{meeting_time}}. Join: {{registrant_join_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'meeting_time', 'registrant_join_link'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 60, offsetLabel: '1 hour before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 15 Minutes (Email)', category: 'meetings', templateType: 'meeting_reminder_15min', channel: 'email',
    recipientType: 'external_alert',
    subject: 'Starting in 15 minutes: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\n{{meeting_title}} starts in 15 minutes.\n\n🔗 Join now: [Click Here to Join now]({{registrant_join_link}})\n\nDon't miss it!\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'registrant_join_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 15, offsetLabel: '15 minutes before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Reminder – 15 Minutes (SMS)', category: 'meetings', templateType: 'meeting_reminder_15min', channel: 'sms',
    recipientType: 'external_alert',
    body: '⏰ {{meeting_title}} starts in 15 minutes. Join: {{registrant_join_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'registrant_join_link'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 15, offsetLabel: '15 minutes before', eventType: 'meeting' },
  },
  {
    name: 'Meeting Starting Now (Email)', category: 'meetings', templateType: 'meeting_time_up', channel: 'email',
    recipientType: 'external_alert',
    subject: 'Starting Now: {{meeting_title}}',
    body: `Hi {{contact_name}},\n\n{{meeting_title}} is starting right now!\n\n🔗 Join immediately: [Click Here to Join now]({{registrant_join_link}})\n\nDon't miss out!\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'registrant_join_link', 'organization_name'],
    reminderConfig: { triggerType: 'on_deadline', offsetMinutes: 0, offsetLabel: 'At event time', eventType: 'meeting' },
  },
  {
    name: 'Meeting Starting Now (SMS)', category: 'meetings', templateType: 'meeting_time_up', channel: 'sms',
    recipientType: 'external_alert',
    body: '🔔 {{meeting_title}} is starting now! Join: {{registrant_join_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'registrant_join_link'],
    reminderConfig: { triggerType: 'on_deadline', offsetMinutes: 0, offsetLabel: 'At event time', eventType: 'meeting' },
  },

  // ── 4. Post-Event: Thank You (Attendees) ────────────────────────────────
  {
    name: 'Post-Event Thank You (Email)', category: 'meetings', templateType: 'meeting_post_event_thankyou', channel: 'email',
    recipientType: 'external_alert',
    subject: 'Thank you for attending {{meeting_title}}',
    body: `Dear {{contact_name}},\n\nThank you for attending {{meeting_title}}. We hope you found the session valuable.\n\n📹 Recording: [Watch Recording]({{recording_link}})\n📂 Resources: [View Resources]({{resource_link}})\n📝 Share Your Feedback: [Complete Feedback]({{feedback_form_link}})\n\nIf you have any questions, please don't hesitate to reach out.\n\nWe look forward to seeing you at future events.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'recording_link', 'resource_link', 'feedback_form_link', 'organization_name'],
  },
  {
    name: 'Post-Event Thank You (SMS)', category: 'meetings', templateType: 'meeting_post_event_thankyou', channel: 'sms',
    recipientType: 'external_alert',
    body: 'Thank you for attending {{meeting_title}}! Recording: {{recording_link}} — {{organization_name}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'recording_link', 'organization_name'],
  },

  // ── 5. Post-Event: Absentee Follow-Up ───────────────────────────────────
  {
    name: 'Absentee Follow-Up (Email)', category: 'meetings', templateType: 'meeting_post_event_absentee', channel: 'email',
    recipientType: 'external_alert',
    subject: 'We missed you at {{meeting_title}}',
    body: `Dear {{contact_name}},\n\nWe noticed you were unable to attend {{meeting_title}}. We understand things come up, and we wanted to make sure you don't miss out.\n\n📹 Recording: [Watch Recording]({{recording_link}})\n📂 Resources: [View Resources]({{resource_link}})\n\nWe hope to see you at our next session.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'recording_link', 'resource_link', 'organization_name'],
  },
  {
    name: 'Absentee Follow-Up (SMS)', category: 'meetings', templateType: 'meeting_post_event_absentee', channel: 'sms',
    recipientType: 'external_alert',
    body: 'Hi {{contact_name}}, we missed you at {{meeting_title}}. Catch the recording: {{recording_link}} — {{organization_name}}',
    variableContext: 'meeting', declaredVariables: ['contact_name', 'meeting_title', 'recording_link', 'organization_name'],
  },

  // ── 6. Facilitator: Pre-Event Briefing ──────────────────────────────────
  {
    name: 'Facilitator Pre-Event Briefing (Email)', category: 'meetings', templateType: 'meeting_facilitator_pre_event', channel: 'email',
    recipientType: 'internal_alert',
    subject: 'Facilitator Briefing: {{meeting_title}}',
    body: `Hi {{user_name}},\n\nThis is your facilitator reminder for {{meeting_title}}.\n\n📅 Date: {{meeting_date}}\n⏰ Time: {{meeting_time}} ({{meeting_timezone}})\n🔗 Meeting Link: [Join Meeting]({{facilitator_join_link}})\n📊 Registrants: {{registrant_count}}\n\nPlease ensure you are prepared and available to join 5 minutes early.\n\n🔗 Dashboard: [View Dashboard]({{dashboard_link}})\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['user_name', 'meeting_title', 'meeting_date', 'meeting_time', 'meeting_timezone', 'facilitator_join_link', 'registrant_count', 'dashboard_link', 'organization_name'],
  },
  {
    name: 'Facilitator Pre-Event Briefing (SMS)', category: 'meetings', templateType: 'meeting_facilitator_pre_event', channel: 'sms',
    recipientType: 'internal_alert',
    body: 'Facilitator alert: {{meeting_title}} starts at {{meeting_time}}. {{registrant_count}} registered. Join: {{facilitator_join_link}}',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'meeting_time', 'registrant_count', 'facilitator_join_link'],
  },

  // ── 7. Facilitator: Post-Event Debrief ──────────────────────────────────
  {
    name: 'Facilitator Post-Event Debrief (Email)', category: 'meetings', templateType: 'meeting_facilitator_post_event', channel: 'email',
    recipientType: 'internal_alert',
    subject: 'Debrief: {{meeting_title}} Complete',
    body: `Hi {{user_name}},\n\n{{meeting_title}} has concluded.\n\nAttendance Summary:\n• Total Registrations: {{registrant_count}}\n• Attended: {{attendee_count}}\n• No-Shows: {{no_show_count}}\n\nPlease review the registrant list and follow up with any action items.\n\n🔗 Dashboard: [View Dashboard]({{dashboard_link}})\n\n{{organization_name}}`,
    variableContext: 'meeting', declaredVariables: ['user_name', 'meeting_title', 'registrant_count', 'attendee_count', 'no_show_count', 'dashboard_link', 'organization_name'],
  },
  {
    name: 'Facilitator Post-Event Debrief (SMS)', category: 'meetings', templateType: 'meeting_facilitator_post_event', channel: 'sms',
    recipientType: 'internal_alert',
    body: '{{meeting_title}} complete. Attended: {{attendee_count}}/{{registrant_count}}. No-shows: {{no_show_count}}.',
    variableContext: 'meeting', declaredVariables: ['meeting_title', 'attendee_count', 'registrant_count', 'no_show_count'],
  },

  // ── Forms ────────────────────────────────═════════════════════════════════
  {
    name: 'Form Invitation (Email)', category: 'forms', templateType: 'form_invitation', channel: 'email',
    subject: 'Action required: {{form_name}}',
    body: `Hi {{respondent_name}},\n\nYou have been invited to complete: {{form_name}}.\n\n🔗 Access the form: [Complete Form]({{form_link}})\n⏰ Deadline: {{submission_deadline}}\n\nPlease complete it at your earliest convenience.\n\n{{organization_name}}`,
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
    body: `Hi {{respondent_name}},\n\n{{form_name}} is due soon.\n\n⏰ Deadline: {{deadline}}\n📅 Days remaining: {{days_remaining}}\n🔗 Complete it here: [Complete Form]({{form_link}})\n\n{{organization_name}}`,
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
    body: `Hi {{respondent_name}},\n\nWe invite you to participate in our survey: {{survey_title}}.\n\nYour feedback is important and will only take a few minutes.\n\n🔗 Start the survey: [Start Survey]({{survey_link}})\n\nThank you for your time.\n\n{{organization_name}}`,
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
    body: `Hi {{respondent_name}},\n\nWe noticed you haven't completed {{survey_title}} yet.\n\n🔗 Complete the survey: [Start Survey]({{survey_link}})\n📅 Days remaining: {{days_remaining}}\n\n{{organization_name}}`,
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
    body: `Hi {{signatory_name}},\n\nA contract has been prepared for your review and signature: {{contract_name}}.\n\n🔗 Review and sign: [Review and Sign]({{contract_link}})\n⏰ Deadline: {{deadline}}\n\n{{organization_name}}`,
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
    body: `Hi {{signatory_name}},\n\n{{contract_name}} is still awaiting your signature.\n\n⏰ Deadline: {{deadline}}\n📅 Days remaining: {{days_remaining}}\n🔗 Sign here: [Review and Sign]({{contract_link}})\n\n{{organization_name}}`,
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
    body: `Hi {{signatory_name}},\n\nThis is a reminder that {{contract_name}} requires your signature before the deadline.\n\n⏰ Deadline: {{deadline}}\n🔗 Sign here: [Review and Sign]({{contract_link}})\n\n{{organization_name}}`,
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
    body: `Hi {{assignee_name}},\n\nA new task has been assigned to you by {{assigner_name}}.\n\n📋 Task: {{task_name}}\n⏰ Due Date: {{task_due_date}}\n🔗 View Details: [View Task]({{task_link}})\n\nPlease review the task and update the status accordingly.\n\nBest regards,\n{{organization_name}}`,
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
    body: `Hi {{assignee_name}},\n\nThis is a reminder that the following task is due tomorrow:\n\n📋 Task: {{task_name}}\n⏰ Due Date: {{task_due_date}}\n🔗 View Details: [View Task]({{task_link}})\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['assignee_name', 'task_name', 'task_due_date', 'task_link', 'organization_name'],
    reminderConfig: { triggerType: 'before_event', offsetMinutes: 1440, offsetLabel: '1 day before', eventType: 'task_reminder' },
  },
  {
    name: 'Task Reminder - Overdue (Email)', category: 'tasks', templateType: 'task_overdue', channel: 'email', recipientType: 'assignee',
    subject: 'Urgent: Task "{{task_name}}" is overdue',
    body: `Hi {{assignee_name}},\n\nThe following task is now overdue:\n\n📋 Task: {{task_name}}\n⏰ Original Due Date: {{task_due_date}}\n🔗 View Details: [View Task]({{task_link}})\n\nPlease address this as soon as possible.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['assignee_name', 'task_name', 'task_due_date', 'task_link', 'organization_name'],
    reminderConfig: { triggerType: 'after_failure', offsetMinutes: 1440, offsetLabel: '1 day after', eventType: 'task_reminder' },
  },
  {
    name: 'Task Completed (Email)', category: 'tasks', templateType: 'task_completed', channel: 'email', recipientType: 'internal_alert',
    subject: 'Task Completed: {{task_name}}',
    body: `Hi,\n\nThe following task has been marked as completed by {{assignee_name}}.\n\n📋 Task: {{task_name}}\n📅 Completed On: {{completion_date}}\n🔗 View Details: [View Task]({{task_link}})\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'entity', declaredVariables: ['assignee_name', 'task_name', 'completion_date', 'task_link', 'organization_name'],
    reminderConfig: { triggerType: 'after_completion', offsetMinutes: 0, offsetLabel: 'On completion', eventType: 'task_reminder' },
  },

  // ── Automations ───────────────────────────────────────────────────────────
  {
    name: 'Automation Failed (Email)', category: 'automations', templateType: 'automation_failed', channel: 'email', recipientType: 'internal_alert',
    subject: 'Alert: Automation Workflow Failed',
    body: `Hello,\n\nThe automation workflow "{{workflow_name}}" encountered an error and failed to execute successfully.\n\n🔴 Error Details: {{error_message}}\n⏰ Time of Failure: {{failure_time}}\n🔗 Review Workflow: [View Workflow]({{workflow_link}})\n\nPlease investigate the issue promptly to ensure operations continue smoothly.\n\n{{organization_name}}`,
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

  // ── Users ──────────────────────────────────────────────────────────────────
  {
    name: 'User Invitation (Email)',
    category: 'users',
    templateType: 'user_invitation',
    channel: 'email',
    recipientType: 'internal_alert',
    subject: 'Invitation to join {{organization_name}}',
    body: `Dear {{user_name}},\n\nYou have been invited to join {{organization_name}} as a team member.\n\nHere are your login credentials:\n• Email: {{user_email}}\n• Temporary Password: {{temp_password}}\n\n🔗 Login here: [Get Started Now!]({{login_link}})\n\nPlease make sure to change your password after your first login.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'users',
    declaredVariables: ['user_name', 'user_email', 'temp_password', 'login_link', 'organization_name'],
  },
  {
    name: 'User Invitation (SMS)',
    category: 'users',
    templateType: 'user_invitation',
    channel: 'sms',
    recipientType: 'internal_alert',
    body: `Hi {{user_name}}, you've been invited to join {{organization_name}}. Email: {{user_email}}, Temp Password: {{temp_password}}. Login: {{login_link}}`,
    variableContext: 'users',
    declaredVariables: ['user_name', 'user_email', 'temp_password', 'login_link', 'organization_name'],
  },
  {
    name: 'User Password Reset (Email)',
    category: 'users',
    templateType: 'user_password_reset',
    channel: 'email',
    recipientType: 'internal_alert',
    subject: 'Password Reset for {{organization_name}}',
    body: `Dear {{user_name}},\n\nAn administrator has reset your password for {{organization_name}}.\n\nHere are your new temporary credentials:\n• Email: {{user_email}}\n• Temporary Password: {{temp_password}}\n\n🔗 Login here: [Login to your account]({{login_link}})\n\nPlease make sure to change your password immediately upon logging in.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'users',
    declaredVariables: ['user_name', 'user_email', 'temp_password', 'login_link', 'organization_name'],
  },
  {
    name: 'User Password Reset (SMS)',
    category: 'users',
    templateType: 'user_password_reset',
    channel: 'sms',
    recipientType: 'internal_alert',
    body: `Hi {{user_name}}, your password for {{organization_name}} has been reset. Temp Password: {{temp_password}}. Login: {{login_link}}`,
    variableContext: 'users',
    declaredVariables: ['user_name', 'user_email', 'temp_password', 'login_link', 'organization_name'],
  },
  {
    name: 'Access Cancellation (Email)',
    category: 'users',
    templateType: 'user_access_cancellation',
    channel: 'email',
    recipientType: 'internal_alert',
    subject: 'Access Revoked for {{organization_name}}',
    body: `Dear {{user_name}},\n\nThis is to notify you that your access to {{organization_name}} has been deactivated.\n\nIf you believe this is an error or have any questions, please contact your workspace administrator.\n\nBest regards,\n{{organization_name}}`,
    variableContext: 'users',
    declaredVariables: ['user_name', 'organization_name'],
  },
  {
    name: 'Access Cancellation (SMS)',
    category: 'users',
    templateType: 'user_access_cancellation',
    channel: 'sms',
    recipientType: 'internal_alert',
    body: `Hi {{user_name}}, your access to {{organization_name}} has been deactivated. Please contact your administrator if you have questions.`,
    variableContext: 'users',
    declaredVariables: ['user_name', 'organization_name'],
  },
];
