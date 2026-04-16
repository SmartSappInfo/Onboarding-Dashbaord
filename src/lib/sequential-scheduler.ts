'use server';

import { sendMessage } from './messaging-engine';
import type { EmailAttachment } from './resend-service';

/**
 * Input configuration for scheduling multi-entity messages
 */
export interface ScheduleMessageInput {
  templateId: string;
  senderProfileId: string;
  entityIds: string[]; // Array of entityIds
  variables: Record<string, any>;
  attachments?: EmailAttachment[];
  workspaceId?: string;
  scheduledAt?: string;
  delayMs?: number; // Default 500ms
  onProgress?: (sent: number, total: number, currentEntity: string) => void;
  onError?: (entityId: string, error: string) => void;
  // Optional: Multi-contact support (Requirement 2.6, 2.7, 2.8, 3.7)
  entityContactMap?: Record<string, string[]>; // Map of entityId to array of recipient emails/phones
  contactScope?: 'primary' | 'signatories' | 'all' | 'custom';
}

/**
 * Result of multi-entity message scheduling
 */
export interface ScheduleMessageResult {
  success: boolean;
  totalSent: number;
  totalFailed: number;
  failedEntities: Array<{ entityId: string; error: string }>;
  logIds: string[];
}

/**
 * Sequential_Scheduler orchestration layer
 * 
 * Orchestrates sequential message sending by calling the existing sendMessage function
 * for each selected entity. This function does NOT modify sendMessage behavior - it
 * simply calls it repeatedly with appropriate delays and error handling.
 * 
 * Requirements: 3.1, 3.3, 4.1, 4.2, 4.4, 10.6
 * 
 * @param input - Configuration for multi-entity message scheduling
 * @returns Result summary with success/failure counts and log IDs
 */
export async function scheduleMultiEntityMessages(
  input: ScheduleMessageInput
): Promise<ScheduleMessageResult> {
  const {
    templateId,
    senderProfileId,
    entityIds,
    variables,
    attachments,
    workspaceId,
    scheduledAt,
    delayMs = 500,
    onProgress,
    onError,
    entityContactMap,
    contactScope = 'primary'
  } = input;

  // Calculate total messages (considering multi-contact per entity)
  let totalMessages = entityIds.length;
  if (entityContactMap) {
    totalMessages = entityIds.reduce((sum, entityId) => {
      const contacts = entityContactMap[entityId] || [];
      return sum + Math.max(contacts.length, 1); // At least 1 message per entity
    }, 0);
  }

  // Validate queue size (Requirement 10.6)
  if (totalMessages > 500) {
    throw new Error('Maximum queue size of 500 messages exceeded');
  }

  const results: ScheduleMessageResult = {
    success: true,
    totalSent: 0,
    totalFailed: 0,
    failedEntities: [],
    logIds: []
  };

  let messagesSent = 0;

  // Sequential processing (Requirements 4.1, 4.2)
  for (let i = 0; i < entityIds.length; i++) {
    const entityId = entityIds[i];
    
    // Get contacts for this entity (Requirement 2.6, 2.7, 3.7)
    let entityContacts = entityContactMap?.[entityId] || [];
    
    // If scope is provided and no custom map, resolve contacts via adapter (Task 35.3)
    if (contactScope && !entityContactMap?.[entityId]) {
      const { resolveContact } = await import('./contact-adapter');
      const { getContactEmail, getContactPhone } = await import('./migration-status-utils');
      
      const contact = await resolveContact(entityId, workspaceId || 'onboarding');
      if (contact) {
        const channel = variables.channel || 'email'; // Need to know channel from somewhere
        // We actually get template channel in ComposerWizard, but here we can infer from variables if passed
        // Or better, we just resolve all potential contacts and sendMessage handles the rest
        
        if (contactScope === 'primary') {
             const email = getContactEmail(contact);
             const phone = getContactPhone(contact);
             entityContacts = channel === 'email' ? (email ? [email] : []) : (phone ? [phone] : []);
        } else if (contactScope === 'signatories') {
             entityContacts = (contact.contacts || [])
                 .filter(c => c.isSignatory)
                 .map(c => channel === 'email' ? c.email : c.phone)
                 .filter(v => !!v);
        } else if (contactScope === 'all') {
             entityContacts = (contact.contacts || [])
                 .map(c => channel === 'email' ? c.email : c.phone)
                 .filter(v => !!v);
        }
      }
    }
    
    // If no specific contacts, send one message (existing behavior)
    const recipients = entityContacts.length > 0 ? entityContacts : [''];
    
    // Send to each contact for this entity
    for (let j = 0; j < recipients.length; j++) {
      const recipient = recipients[j];
      
      try {
        // Call existing sendMessage function (Requirement 3.1, 3.3)
        // The existing function will:
        // 1. Resolve contact via Contact Adapter Layer (if recipient is empty)
        // 2. Resolve all variables (school, contact, tag, constants)
        // 3. Determine recipient email/phone from contact
        // 4. Create individual message log
        // 5. Send via gateway
        const result = await sendMessage({
          templateId,
          senderProfileId,
          recipient, // Specific contact or empty for auto-resolution
          variables,
          attachments,
          entityId: entityId,
          workspaceId,
          scheduledAt
        });

        if (result.success) {
          results.totalSent++;
          if (result.logId) results.logIds.push(result.logId);
        } else {
          // Non-fatal: log and continue (Requirement 4.3)
          results.totalFailed++;
          const errorKey = recipient ? `${entityId}:${recipient}` : entityId;
          results.failedEntities.push({
            entityId: errorKey,
            error: result.error || 'Unknown error'
          });
          if (onError) onError(errorKey, result.error || 'Unknown error');
        }

        messagesSent++;

        // Progress callback
        if (onProgress) {
          onProgress(messagesSent, totalMessages, entityId);
        }

        // Delay between messages (Requirement 4.4)
        // Skip delay after last message
        if (messagesSent < totalMessages) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (error: any) {
        // Unexpected error: log and continue (Requirement 4.3)
        results.totalFailed++;
        const errorKey = recipient ? `${entityId}:${recipient}` : entityId;
        results.failedEntities.push({
          entityId: errorKey,
          error: error.message
        });
        if (onError) onError(errorKey, error.message);
        
        messagesSent++;
        
        // Progress callback even on error
        if (onProgress) {
          onProgress(messagesSent, totalMessages, entityId);
        }
        
        // Continue with delay even after error
        if (messagesSent < totalMessages) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
  }

  results.success = results.totalFailed === 0;
  return results;
}
