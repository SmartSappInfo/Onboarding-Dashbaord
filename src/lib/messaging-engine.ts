
'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, SenderProfile, MessageStyle, MessageLog } from './types';
import { resolveVariables } from './messaging-utils';
import { logActivity } from './activity-logger';
import { sendSms } from './mnotify-service';

interface SendMessageInput {
  templateId: string;
  senderProfileId: string;
  recipient: string;
  variables: Record<string, any>;
  schoolId?: string;
  scheduledAt?: string; // ISO string
}

/**
 * Main entry point for sending a single message via the messaging engine.
 * Decouples the application logic from the underlying gateway (mNotify).
 */
export async function sendMessage(input: SendMessageInput): Promise<{ success: boolean; error?: string; logId?: string }> {
  const { templateId, senderProfileId, recipient, variables, schoolId, scheduledAt } = input;

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
    if (template.channel !== sender.channel) throw new Error(`Channel mismatch: ${template.channel} vs ${sender.channel}.`);

    // 2. Resolve Subject & Body
    // FIXED: Ensure resolvedSubject is null instead of undefined for SMS to avoid Firestore crashes
    let resolvedSubject = template.channel === 'email' ? resolveVariables(template.subject || '', variables) : null;
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

    // 4. Perform Actual Delivery
    let providerResponse = null;
    const scheduleDate = scheduledAt ? new Date(scheduledAt) : undefined;
    
    if (template.channel === 'sms') {
        providerResponse = await sendSms({
            recipient,
            message: resolvedBody,
            sender: sender.identifier,
            scheduleDate
        });
    } else {
        // Email placeholder for next phase
        console.log(`>>> [MESSAGING] Email dispatch simulation: ${sender.identifier} to ${recipient}`);
    }

    // 5. Create Audit Log
    // Clean variables to remove any 'undefined' values which Firestore rejects
    const cleanedVariables = JSON.parse(JSON.stringify(variables));

    const logData: Omit<MessageLog, 'id'> = {
      templateId: template.id,
      templateName: template.name,
      senderProfileId: sender.id,
      senderName: sender.name,
      channel: sender.channel,
      recipient,
      subject: resolvedSubject || null,
      body: resolvedBody,
      status: scheduledAt ? 'scheduled' : 'sent',
      sentAt: scheduledAt || new Date().toISOString(),
      variables: cleanedVariables,
      schoolId: schoolId || variables.schoolId || variables.school_id || null,
      providerId: providerResponse?.summary?._id || null, // Store mNotify ID if available
    };

    // Robust sanitization: remove any key that is explicitly undefined
    const sanitizedLogData = Object.fromEntries(
        Object.entries(logData).filter(([_, v]) => v !== undefined)
    );

    const logRef = await adminDb.collection('message_logs').add(sanitizedLogData);

    // 6. Sync with Activity Timeline
    await logActivity({
        schoolId: (logData.schoolId as string) || '',
        userId: null, 
        type: 'notification_sent',
        source: 'system',
        description: `${scheduledAt ? 'Scheduled' : 'Sent'} ${template.channel} "${template.name}" to ${recipient}`,
        metadata: { 
            logId: logRef.id, 
            channel: template.channel, 
            templateName: template.name,
            mNotifyStatus: providerResponse?.status,
            scheduledAt: scheduledAt
        }
    });

    return { success: true, logId: logRef.id };

  } catch (error: any) {
    console.error(">>> [MESSAGING] DISPATCH ERROR:", error.message);
    
    return { success: false, error: error.message };
  }
}
