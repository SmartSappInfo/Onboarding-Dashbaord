'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, SenderProfile, MessageStyle, MessageLog } from './types';

/**
 * Resolves variables in a text string using {{variable_name}} syntax.
 */
export function resolveVariables(text: string, variables: Record<string, any>): string {
  if (!text) return '';
  return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const cleanKey = key.trim();
    const value = variables[cleanKey];
    return value !== undefined ? String(value) : match;
  });
}

interface SendMessageInput {
  templateId: string;
  senderProfileId: string;
  recipient: string;
  variables: Record<string, any>;
}

/**
 * Main entry point for sending a single message via the messaging engine.
 */
export async function sendMessage(input: SendMessageInput): Promise<{ success: boolean; error?: string; logId?: string }> {
  const { templateId, senderProfileId, recipient, variables } = input;

  try {
    // 1. Fetch Core Assets
    const [templateSnap, senderSnap] = await Promise.all([
      adminDb.collection('message_templates').doc(templateId).get(),
      adminDb.collection('sender_profiles').doc(senderProfileId).get(),
    ]);

    if (!templateSnap.exists) throw new Error(`Template not found: ${templateId}`);
    if (!senderSnap.exists) throw new Error(`Sender Profile not found: ${senderProfileId}`);

    const template = { id: templateSnap.id, ...templateSnap.data() } as MessageTemplate;
    const sender = { id: senderSnap.id, ...senderSnap.data() } as SenderProfile;

    if (!sender.isActive) throw new Error(`Sender Profile "${sender.name}" is inactive.`);
    if (!template.isActive) throw new Error(`Template "${template.name}" is inactive.`);
    if (template.channel !== sender.channel) throw new Error(`Channel mismatch: Template is ${template.channel}, but Sender is ${sender.channel}.`);

    // 2. Resolve Subject & Body
    let resolvedSubject = template.channel === 'email' ? resolveVariables(template.subject || '', variables) : undefined;
    let resolvedBody = resolveVariables(template.body, variables);

    // 3. Apply Style (Email only)
    if (template.channel === 'email' && template.styleId) {
      const styleSnap = await adminDb.collection('message_styles').doc(template.styleId).get();
      if (styleSnap.exists) {
        const style = styleSnap.data() as MessageStyle;
        if (style.htmlWrapper.includes('{{content}}')) {
          resolvedBody = style.htmlWrapper.replace('{{content}}', resolvedBody);
        }
      }
    }

    // 4. Perform Actual Delivery (Integration Point)
    // NOTE: In a production environment, this is where you call SendGrid, Twilio, etc.
    // For now, we simulate success and log the outcome.
    console.log(`>>> [MESSAGING] Dispatching via ${sender.identifier} (${sender.channel}) to ${recipient}`);
    console.log(`>>> [BODY]: ${resolvedBody.substring(0, 100)}...`);

    // 5. Create Audit Log
    const logData: Omit<MessageLog, 'id'> = {
      templateId: template.id,
      templateName: template.name,
      senderProfileId: sender.id,
      senderName: sender.name,
      channel: sender.channel,
      recipient,
      subject: resolvedSubject,
      body: resolvedBody,
      status: 'sent',
      sentAt: new Date().toISOString(),
      variables
    };

    const logRef = await adminDb.collection('message_logs').add(logData);

    return { success: true, logId: logRef.id };

  } catch (error: any) {
    console.error(">>> [MESSAGING] FAILED TO SEND:", error.message);
    
    // Attempt to log failure if we have enough context
    try {
        await adminDb.collection('message_logs').add({
            templateId,
            senderProfileId,
            recipient,
            status: 'failed',
            error: error.message,
            sentAt: new Date().toISOString(),
            variables
        });
    } catch (logError) {
        console.error(">>> [MESSAGING] Could not record failure log.");
    }

    return { success: false, error: error.message };
  }
}
