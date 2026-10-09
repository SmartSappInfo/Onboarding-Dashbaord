'use server';

/**
 * @fileOverview Authenticated Server Action for Direct 1-to-1 Quick Message Dispatch.
 * 
 * Part of SmartSapp Communications Hub (Phase 5).
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1: Strict TypeScript typing (zero any/any[]).
 * - Rule 8 & 18: Fail-closed multi-tenancy via requireWorkspace(workspaceId).
 * - Rule 19: Human-in-the-loop single-target recipient guard (blocks mass blasts).
 * - Rule 20: Replay / duplicate delivery protection via Firestore-persisted idempotency.
 * - Rule 21: Graceful degradation and error classification (e.g. WHATSAPP_SESSION_CLOSED).
 */

import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { requireWorkspace } from '@/lib/auth/require-auth';
import { sendRawMessage } from '@/lib/messaging-engine';

export const QuickDirectMessageInputSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  channel: z.enum(['sms', 'whatsapp', 'email']),
  recipient: z.string().min(1, 'Recipient is required'),
  body: z.string().min(1, 'Message body is required').max(2000, 'Message body cannot exceed 2000 characters'),
  subject: z.string().optional(),
  clientRequestId: z.string().min(1, 'Client request ID is required for idempotency'),
});

export type QuickDirectMessageInput = z.infer<typeof QuickDirectMessageInputSchema>;

export interface QuickDirectMessageResult {
  success: boolean;
  logId?: string;
  isDuplicate?: boolean;
  error?: string;
  code?: string;
}

const IDEMPOTENCY_COLLECTION = 'quick_message_idempotency';

/**
 * Validates that recipient input represents a single target (Rule 19 single-target guard).
 * Allows formatted phone numbers with spaces without false-positive blast rejections.
 */
function validateSingleRecipient(recipient: string, channel: 'sms' | 'whatsapp' | 'email'): { valid: boolean; error?: string } {
  const trimmed = recipient.trim();
  if (!trimmed) {
    return { valid: false, error: 'Recipient cannot be empty.' };
  }

  // Comma, semicolon, or newline clearly signals multiple recipients
  if (/[,;\n]/.test(trimmed)) {
    return { valid: false, error: 'Quick Compose supports a single recipient only. Use Campaign Wizard for bulk messages.' };
  }

  if (channel === 'email') {
    if (/\s/.test(trimmed)) {
      return { valid: false, error: 'Quick Compose supports a single recipient only. Space-separated email addresses are not permitted.' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Invalid email address format.' };
    }
  } else {
    // SMS or WhatsApp: allow standard phone formatting (+, spaces, hyphens, parentheses)
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      return { valid: false, error: 'Phone number is too short.' };
    }
    // E.164 max digits is 15. If multiple phone numbers are pasted with spaces, digits will exceed 15.
    if (/\s+/.test(trimmed) && digitsOnly.length > 15) {
      return { valid: false, error: 'Quick Compose supports a single recipient only. Multiple phone numbers detected.' };
    }
  }

  return { valid: true };
}

/**
 * Server Action: Dispatches a direct 1-to-1 message with full authentication and replay protection.
 */
export async function dispatchQuickDirectMessageAction(
  input: QuickDirectMessageInput
): Promise<QuickDirectMessageResult> {
  try {
    const parseResult = QuickDirectMessageInputSchema.safeParse(input);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]?.message ?? 'Invalid message parameters.';
      return { success: false, error: issue };
    }

    const { workspaceId, channel, recipient, body, subject, clientRequestId } = parseResult.data;

    // 1. Fail-closed multi-tenancy verification (Rule 8 & 18)
    const authContext = await requireWorkspace(workspaceId);
    const orgId = authContext.profile?.organizationId;
    if (!orgId) {
      return { success: false, error: 'Unable to resolve organization context for workspace.' };
    }

    // 2. Single-target validation (Rule 19)
    const recipientValidation = validateSingleRecipient(recipient, channel);
    if (!recipientValidation.valid) {
      return { success: false, error: recipientValidation.error };
    }

    // 3. Email channel validation
    if (channel === 'email' && (!subject || !subject.trim())) {
      return { success: false, error: 'Email subject is required for email messages.' };
    }

    // 4. Firestore-Persisted Idempotency / Replay Protection (Rule 20)
    const idempotencyDocId = `${workspaceId}_${clientRequestId}`;
    const idemRef = adminDb.collection(IDEMPOTENCY_COLLECTION).doc(idempotencyDocId);
    const idemSnap = await idemRef.get();

    if (idemSnap.exists) {
      const data = idemSnap.data();
      if (data?.status === 'completed' && data?.logId) {
        return {
          success: true,
          logId: String(data.logId),
          isDuplicate: true,
        };
      }
      if (data?.status === 'in_flight') {
        return {
          success: false,
          error: 'A dispatch with this request ID is currently in flight. Please wait.',
          code: 'IN_FLIGHT',
        };
      }
    }

    // Mark as in-flight
    await idemRef.set({
      workspaceId,
      organizationId: orgId,
      clientRequestId,
      channel,
      status: 'in_flight',
      createdAt: new Date().toISOString(),
    });

    // 5. Execute Raw Message Dispatch via Core Messaging Engine
    const dispatchResult = await sendRawMessage({
      channel,
      recipient: recipient.trim(),
      body: body.trim(),
      subject: channel === 'email' ? subject?.trim() : undefined,
      organizationId: orgId,
      workspaceIds: [workspaceId],
    });

    if (dispatchResult.success && dispatchResult.logId) {
      await idemRef.set(
        {
          status: 'completed',
          logId: dispatchResult.logId,
          completedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return {
        success: true,
        logId: dispatchResult.logId,
      };
    }

    // Clean up in-flight record so user can retry upon failure
    await idemRef.delete().catch(() => {});

    const errorMsg = dispatchResult.error || 'Failed to dispatch message.';
    if (/24-hour.*window.*closed/i.test(errorMsg)) {
      return {
        success: false,
        error: errorMsg,
        code: 'WHATSAPP_SESSION_CLOSED',
      };
    }

    return {
      success: false,
      error: errorMsg,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal dispatch error';
    return {
      success: false,
      error: errorMsg,
    };
  }
}
