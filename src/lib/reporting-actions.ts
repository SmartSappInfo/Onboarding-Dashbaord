'use server';

/**
 * SmartSapp Finance 2.0 - Executive Financial Reporting Server Actions
 * Queries executive telemetry, cashflow trends, and collector metrics with canUser RBAC.
 */

import { canUser } from './workspace-permissions';
import { 
  ActionResponse, 
  ExecutiveFinanceMetrics, 
  CollectorPerformanceMetric,
  DateRangePreset 
} from './types';
import { 
  FinanceReportingService, 
  MonthlyCashflowPoint 
} from './services/finance-reporting-service';

export async function getExecutiveFinanceMetricsAction(
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { metrics?: ExecutiveFinanceMetrics }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const metrics = await FinanceReportingService.getExecutiveMetrics(workspaceId);
    return { success: true, metrics };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to calculate executive finance metrics';
    return { success: false, error: msg };
  }
}

export async function getCashflowTrendAction(
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { trend?: MonthlyCashflowPoint[] }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const trend = await FinanceReportingService.getCashflowTrend(workspaceId);
    return { success: true, trend };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to calculate cashflow trend';
    return { success: false, error: msg };
  }
}

export async function getCollectorLeaderboardAction(
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { leaderboard?: CollectorPerformanceMetric[] }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const leaderboard = await FinanceReportingService.getCollectorLeaderboard(workspaceId);
    return { success: true, leaderboard };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to calculate collector leaderboard';
    return { success: false, error: msg };
  }
}

export async function getRevenueReportAction(
  workspaceId: string,
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
) {
  try {
    const { ModularReportingService } = await import('./services/modular-reporting-service');
    const data = await ModularReportingService.getRevenueReport(workspaceId, preset, customStart, customEnd);
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate revenue report';
    return { success: false, error: msg };
  }
}

export async function getAgingReportAction(
  workspaceId: string,
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
) {
  try {
    const { ModularReportingService } = await import('./services/modular-reporting-service');
    const data = await ModularReportingService.getAgingReport(workspaceId, preset, customStart, customEnd);
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate aging report';
    return { success: false, error: msg };
  }
}

export async function getTaxAuditReportAction(
  workspaceId: string,
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
) {
  try {
    const { ModularReportingService } = await import('./services/modular-reporting-service');
    const data = await ModularReportingService.getTaxAuditReport(workspaceId, preset, customStart, customEnd);
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate tax audit report';
    return { success: false, error: msg };
  }
}
