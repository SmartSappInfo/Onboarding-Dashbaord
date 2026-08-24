'use server';

/**
 * SmartSapp Finance 2.0 - Accounts Receivable & Statements Server Actions
 */

import { canUser } from './workspace-permissions';
import { ActionResponse, AgingSummary, CustomerStatement } from './types';
import { AgingService, AccountAgingProfile } from './services/aging-service';
import { StatementService } from './services/statement-service';

export async function getWorkspaceAgingSummaryAction(
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { summary?: AgingSummary }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const summary = await AgingService.calculateWorkspaceAgingSummary(workspaceId);
    return { success: true, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to calculate aging summary';
    return { success: false, error: msg };
  }
}

export async function getAccountAgingProfileAction(
  accountId: string,
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { profile?: AccountAgingProfile }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const profile = await AgingService.getAccountReceivablesProfile(accountId);
    if (!profile) {
      return { success: false, error: 'Account not found.' };
    }

    return { success: true, profile };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve account aging profile';
    return { success: false, error: msg };
  }
}

export async function getCustomerStatementAction(
  accountId: string,
  workspaceId: string,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<ActionResponse & { statement?: CustomerStatement }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const statement = await StatementService.generateCustomerStatement(accountId, startDate, endDate);
    return { success: true, statement };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate customer statement';
    return { success: false, error: msg };
  }
}

export async function getPublicStatementAction(
  tokenOrId: string
): Promise<ActionResponse & { statement?: CustomerStatement }> {
  try {
    if (!tokenOrId) {
      return { success: false, error: 'Invalid statement reference token.' };
    }

    const statement = await StatementService.getStatementByToken(tokenOrId);
    if (!statement) {
      return { success: false, error: 'Statement not found or link has expired.' };
    }

    return { success: true, statement };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load public statement';
    return { success: false, error: msg };
  }
}
