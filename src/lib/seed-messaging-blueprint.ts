'use server';

import { adminDb } from './firebase-admin';
import type { 
    MessageTemplate, 
    MessageStyle, 
    TemplateCategory, 
    RecipientType, 
    MessageChannel, 
    TemplateTarget, 
    ContentMode, 
    TemplateStatus 
} from './types';

/**
 * PHASE 1: Seeding & Content Blueprint
 * Seeds 100 global templates and 5 audience-specific styles.
 */

interface BlueprintDefinition {
    category: TemplateCategory;
    recipientType: RecipientType;
    subject: string;
    body: string;
    shortBody: string;
}

const CATEGORIES: TemplateCategory[] = [
    'forms', 'surveys', 'meetings', 'agreements', 'campaigns', 
    'reminders', 'tasks', 'automations', 'qr_codes', 'general'
];

const RECIPIENT_TYPES: RecipientType[] = [
    'respondent', 'internal_alert', 'assignee', 'entity', 'external_alert'
];

/**
 * Generates a professional blueprint based on the category and recipient type.
 */
function getBlueprint(category: TemplateCategory, recipientType: RecipientType): BlueprintDefinition {
    // Default fallback
    let subject = `Update regarding ${category.replace('_', ' ')}`;
    let body = `Hello {{contact_name}},\n\nThis is an automated update regarding your ${category.replace('_', ' ')} interaction with {{org_name}}.\n\nThank you,\n{{org_name}}`;
    let shortBody = `Hi {{contact_name}}, update on your ${category.replace('_', ' ')} with {{org_name}}.`;

    // Contextual phrasings based on category
    switch (category) {
        case 'forms':
            if (recipientType === 'respondent') {
                subject = 'We received your {{form_name}} submission';
                body = 'Hello {{contact_name}},\n\nThank you for submitting the {{form_name}}. We have received your information and are currently reviewing it.\n\nYou can view your submission status here: {{action_url}}\n\nBest regards,\n{{org_name}}';
                shortBody = 'Hi {{contact_name}}, thanks for your {{form_name}} submission! View status: {{action_url}}';
            } else if (recipientType === 'internal_alert') {
                subject = 'New Form Submission: {{form_name}}';
                body = 'Team,\n\nA new submission has been received for the {{form_name}} from {{entity_name}}.\n\nReview details here: {{action_url}}';
                shortBody = 'New {{form_name}} submission from {{entity_name}}. Review: {{action_url}}';
            }
            break;
        case 'surveys':
            if (recipientType === 'respondent') {
                subject = 'Thank you for your feedback: {{survey_title}}';
                body = 'Hello {{contact_name}},\n\nThank you for completing our {{survey_title}}. Your feedback helps us improve our services for everyone.\n\nBest regards,\n{{org_name}}';
                shortBody = 'Hi {{contact_name}}, thanks for the feedback on {{survey_title}}! - {{org_name}}';
            }
            break;
        case 'meetings':
            if (recipientType === 'respondent' || recipientType === 'entity') {
                subject = 'Meeting Confirmed: {{meeting_title}}';
                body = 'Hello {{contact_name}},\n\nYour meeting "{{meeting_title}}" with {{org_name}} has been confirmed for {{meeting_time}}.\n\nLocation/Link: {{meeting_link}}\n\nWe look forward to seeing you!';
                shortBody = 'Meeting confirmed: {{meeting_title}} on {{meeting_time}}. Link: {{meeting_link}}';
            }
            break;
        case 'agreements':
            if (recipientType === 'respondent' || recipientType === 'entity') {
                subject = 'Signature Required: {{contract_name}}';
                body = 'Hello {{contact_name}},\n\n{{org_name}} has requested your signature on the following agreement: {{contract_name}}.\n\nPlease review and sign using the link below:\n{{action_url}}\n\nThank you!';
                shortBody = 'Action required: Please sign {{contract_name}} here: {{action_url}}';
            }
            break;
        case 'tasks':
            if (recipientType === 'assignee') {
                subject = 'New Task Assigned: {{task_title}}';
                body = 'Hello {{contact_name}},\n\nA new task has been assigned to you: {{task_title}}.\n\nPriority: {{task_priority}}\nDue Date: {{task_due_date}}\n\nDetails: {{action_url}}';
                shortBody = 'New task: {{task_title}}. Due: {{task_due_date}}. Details: {{action_url}}';
            }
            break;
        case 'reminders':
            subject = 'Reminder: {{reminder_title}}';
            body = 'Hello {{contact_name}},\n\nThis is a reminder regarding {{reminder_title}} which is scheduled for {{scheduled_time}}.\n\nAction Link: {{action_url}}';
            shortBody = 'Reminder: {{reminder_title}} at {{scheduled_time}}. Info: {{action_url}}';
            break;
        case 'qr_codes':
            subject = 'Scanned: {{qr_code_name}}';
            body = 'Hello {{contact_name}},\n\nYou recently scanned the {{qr_code_name}} QR code.\n\nYou can access the relevant information here: {{action_url}}\n\nBest,\n{{org_name}}';
            shortBody = 'Access your QR content for {{qr_code_name}} here: {{action_url}}';
            break;
        case 'automations':
            subject = 'Workflow Update: {{automation_name}}';
            body = 'Hello {{contact_name}},\n\nThis is an automated update regarding the {{automation_name}} workflow.\n\nStatus: {{status_update}}\n\nManage here: {{action_url}}';
            shortBody = 'Update on {{automation_name}}: {{status_update}}. Info: {{action_url}}';
            break;
    }

    return { category, recipientType, subject, body, shortBody };
}

/**
 * Seeds the global messaging blueprint.
 */
export async function seedGlobalMessagingBlueprint(): Promise<{ success: boolean; templates: number; styles: number; error?: string }> {
    try {
        const batch = adminDb.batch();
        const timestamp = new Date().toISOString();
        let templatesCount = 0;
        let stylesCount = 0;

        // 1. Seed Global Styles (one for each recipientType)
        const styleWrapper = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
                    .header { padding: 40px; text-align: center; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                    .logo { max-height: 48px; width: auto; }
                    .content { padding: 40px; background: #ffffff; }
                    .footer { padding: 40px; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0; }
                    .footer-text { font-size: 12px; color: #64748b; margin-bottom: 16px; }
                    .unsub { font-size: 11px; color: #94a3b8; text-decoration: underline; }
                    .btn { display: inline-block; padding: 12px 24px; background: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="{{org_logo_url}}" alt="{{org_name}}" class="logo" />
                    </div>
                    <div class="content">
                        {{content}}
                    </div>
                    <div class="footer">
                        <div class="footer-text">
                            <strong>{{org_name}}</strong><br/>
                            {{org_address}}
                        </div>
                        <a href="{{unsubscribe_link}}" class="unsub">Unsubscribe from these emails</a>
                    </div>
                </div>
            </body>
            </html>
        `;

        for (const type of RECIPIENT_TYPES) {
            const styleId = `global_style_${type}`;
            const styleRef = adminDb.collection('message_styles').doc(styleId);
            batch.set(styleRef, {
                id: styleId,
                name: `Global ${type.replace('_', ' ')} Style`,
                htmlWrapper: styleWrapper,
                workspaceIds: [], // Global
                createdAt: timestamp,
                updatedAt: timestamp
            });
            stylesCount++;
        }

        // 2. Seed Templates (100 total: 10 categories * 5 recipientTypes * 2 channels)
        for (const category of CATEGORIES) {
            for (const recipientType of RECIPIENT_TYPES) {
                const blueprint = getBlueprint(category, recipientType);

                // Variant 1: STANDARD (Recommended) - EMAIL
                const standardId = `global_${category}_${recipientType}_standard_email`;
                const standardRef = adminDb.collection('message_templates').doc(standardId);
                batch.set(standardRef, {
                    id: standardId,
                    scope: 'global',
                    category,
                    channel: 'email',
                    target: recipientType === 'internal_alert' ? 'internal_team' : 'external_client',
                    name: `${category.charAt(0).toUpperCase() + category.slice(1)} - ${recipientType.replace('_', ' ')} (Standard)`,
                    contentMode: 'plain_text',
                    subject: blueprint.subject,
                    body: blueprint.body,
                    templateType: `${category}_${recipientType}_standard`,
                    recipientType,
                    styleId: `global_style_${recipientType}`,
                    status: 'active',
                    version: 1,
                    isActive: true,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    createdBy: 'system_seed'
                });
                templatesCount++;

                // Variant 2: SHORT (Mobile-Friendly) - EMAIL
                const shortId = `global_${category}_${recipientType}_short_email`;
                const shortRef = adminDb.collection('message_templates').doc(shortId);
                batch.set(shortRef, {
                    id: shortId,
                    scope: 'global',
                    category,
                    channel: 'email',
                    target: recipientType === 'internal_alert' ? 'internal_team' : 'external_client',
                    name: `${category.charAt(0).toUpperCase() + category.slice(1)} - ${recipientType.replace('_', ' ')} (Short)`,
                    contentMode: 'plain_text',
                    subject: blueprint.subject,
                    body: blueprint.shortBody,
                    templateType: `${category}_${recipientType}_short`,
                    recipientType,
                    styleId: `global_style_${recipientType}`,
                    status: 'active',
                    version: 1,
                    isActive: true,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    createdBy: 'system_seed'
                });
                templatesCount++;
            }
        }

        await batch.commit();
        console.log(`✅ Seeded ${templatesCount} templates and ${stylesCount} styles.`);
        return { success: true, templates: templatesCount, styles: stylesCount };

    } catch (error: any) {
        console.error('❌ Seeding failed:', error.message);
        return { success: false, templates: 0, styles: 0, error: error.message };
    }
}
