'use server';

/**
 * SmartSapp Finance 2.0 - Credit & Debit Note Server Actions
 */

import { adminDb } from './firebase-admin';
import { canUser } from './workspace-permissions';
import { CreditNote, CreditNoteReason, ActionResponse } from './types';
import { CreditNoteService } from './services/credit-note-service';

export interface CreateCreditNoteInput {
  workspaceId: string;
  userId: string;
  accountId: string;
  amount: number;
  reason: CreditNoteReason;
  reasonDetails?: string;
  invoiceId?: string;
  organizationId?: string;
}

export async function createCreditNoteAction(
  input: CreateCreditNoteInput
): Promise<ActionResponse & { creditNote?: CreditNote }> {
  try {
    const { workspaceId, userId, accountId, amount, reason, reasonDetails, invoiceId, organizationId } = input;

    const permission = await canUser(userId, 'finance', 'invoices', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance management permissions.' };
    }

    const res = await CreditNoteService.issueCreditNote({
      workspaceId,
      userId,
      accountId,
      amount,
      reason,
      reasonDetails,
      invoiceId,
      organizationId,
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to issue credit note';
    return { success: false, error: msg };
  }
}

export async function getCreditNotesByAccountAction(
  accountId: string,
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { creditNotes?: CreditNote[] }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const snap = await adminDb
      .collection('credit_notes')
      .where('accountId', '==', accountId)
      .where('workspaceIds', 'array-contains', workspaceId)
      .orderBy('createdAt', 'desc')
      .get();

    const creditNotes: CreditNote[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CreditNote, 'id'>),
    }));

    return { success: true, creditNotes };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve credit notes';
    return { success: false, error: msg };
  }
}
