/**
 * SmartSapp Finance 2.0 - Executive Financial Reporting Service
 * Answers the 4 core executive questions, cashflow trends, and collector leaderboards.
 */

import { adminDb } from '../firebase-admin';
import { 
  Invoice, 
  Payment, 
  CollectionCase, 
  PromiseToPay, 
  ExecutiveFinanceMetrics, 
  CollectorPerformanceMetric 
} from '../types';
import { AgingService } from './aging-service';

export interface MonthlyCashflowPoint {
  month: string; // e.g. "2026-03"
  billed: number;
  collected: number;
}

export class FinanceReportingService {
  /**
   * Calculates the 4 Executive Telemetry Questions:
   * 1. What did we bill?
   * 2. What did we collect?
   * 3. What are we owed?
   * 4. What is at risk (>60d overdue)?
   */
  static async getExecutiveMetrics(workspaceId: string): Promise<ExecutiveFinanceMetrics> {
    const [invSnap, paySnap, caseSnap, accSnap] = await Promise.all([
      adminDb.collection('invoices').where('workspaceIds', 'array-contains', workspaceId).get(),
      adminDb.collection('payments').where('workspaceId', '==', workspaceId).get(),
      adminDb.collection('collection_cases').where('workspaceIds', 'array-contains', workspaceId).get(),
      adminDb.collection('financial_accounts').where('workspaceId', '==', workspaceId).get(),
    ]);

    let totalBilled = 0;
    let paidInvoicesCount = 0;
    let totalOutstandingAR = 0;
    let totalAtRiskDebt = 0;
    const now = new Date();

    for (const doc of invSnap.docs) {
      const inv = doc.data() as Invoice;
      if (inv.status === 'void' || inv.lifecycleStatus === 'void' || inv.status === 'draft') {
        continue;
      }

      totalBilled += Number(inv.totalPayable || 0);

      const bal = Number(inv.balanceDue ?? (inv.totalPayable - (inv.amountPaid || 0)));
      if (bal <= 0 || inv.status === 'paid') {
        paidInvoicesCount++;
      } else {
        totalOutstandingAR += bal;
        const aging = AgingService.calculateInvoiceAging(inv, now);
        if (aging.bucket === '61_90' || aging.bucket === '90_plus') {
          totalAtRiskDebt += bal;
        }
      }
    }

    let totalCollected = 0;
    for (const doc of paySnap.docs) {
      const pay = doc.data() as Payment;
      if (pay.status && pay.status !== 'confirmed') continue;
      totalCollected += Number(pay.amount || 0);
    }

    // Active cases count
    let activeCasesCount = 0;
    for (const doc of caseSnap.docs) {
      const c = doc.data() as CollectionCase;
      if (c.stage !== 'resolved') {
        activeCasesCount++;
      }
    }

    const safeBilled = Math.round(totalBilled * 100) / 100;
    const safeCollected = Math.round(totalCollected * 100) / 100;
    const safeAR = Math.round(totalOutstandingAR * 100) / 100;
    const safeAtRisk = Math.round(totalAtRiskDebt * 100) / 100;
    const efficiency = safeBilled > 0 ? Math.round((safeCollected / safeBilled) * 100) : 0;

    return {
      totalBilledRevenue: safeBilled,
      totalCollectedRevenue: safeCollected,
      totalOutstandingAR: safeAR,
      totalAtRiskDebt: safeAtRisk,
      collectionEfficiencyRate: efficiency,
      invoicesCount: invSnap.size,
      paidInvoicesCount,
      debtorsCount: accSnap.size,
      activeCasesCount,
    };
  }

  /**
   * Generates 6-month historical cashflow comparison (Billed vs Collected).
   */
  static async getCashflowTrend(workspaceId: string): Promise<MonthlyCashflowPoint[]> {
    const [invSnap, paySnap] = await Promise.all([
      adminDb.collection('invoices').where('workspaceIds', 'array-contains', workspaceId).get(),
      adminDb.collection('payments').where('workspaceId', '==', workspaceId).get(),
    ]);

    const monthMap = new Map<string, { billed: number; collected: number }>();

    // Seed last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, { billed: 0, collected: 0 });
    }

    for (const doc of invSnap.docs) {
      const inv = doc.data() as Invoice;
      if (inv.status === 'void' || inv.status === 'draft') continue;
      const dateStr = inv.issuedAt || inv.createdAt;
      if (!dateStr) continue;
      const key = dateStr.substring(0, 7);
      const entry = monthMap.get(key);
      if (entry) {
        entry.billed = Math.round((entry.billed + Number(inv.totalPayable || 0)) * 100) / 100;
      }
    }

    for (const doc of paySnap.docs) {
      const pay = doc.data() as Payment;
      if (pay.status && pay.status !== 'confirmed') continue;
      const dateStr = pay.receivedAt || pay.createdAt;
      if (!dateStr) continue;
      const key = dateStr.substring(0, 7);
      const entry = monthMap.get(key);
      if (entry) {
        entry.collected = Math.round((entry.collected + Number(pay.amount || 0)) * 100) / 100;
      }
    }

    const points: MonthlyCashflowPoint[] = [];
    for (const [month, data] of monthMap.entries()) {
      points.push({
        month,
        billed: data.billed,
        collected: data.collected,
      });
    }

    return points;
  }

  /**
   * Calculates collector recovery leaderboard metrics.
   */
  static async getCollectorLeaderboard(workspaceId: string): Promise<CollectorPerformanceMetric[]> {
    const [casesSnap, promisesSnap] = await Promise.all([
      adminDb.collection('collection_cases').where('workspaceIds', 'array-contains', workspaceId).get(),
      adminDb.collection('promises_to_pay').where('workspaceIds', 'array-contains', workspaceId).get(),
    ]);

    const collectorMap = new Map<string, CollectorPerformanceMetric>();

    for (const doc of casesSnap.docs) {
      const c = doc.data() as CollectionCase;
      const userId = c.assignedToUserId || 'unassigned';
      const userName = c.assignedToName || 'Unassigned Queue';

      let entry = collectorMap.get(userId);
      if (!entry) {
        entry = {
          userId,
          userName,
          assignedCasesCount: 0,
          recoveredAmount: 0,
          fulfilledPromisesCount: 0,
          brokenPromisesCount: 0,
          ptpSuccessRate: 0,
        };
        collectorMap.set(userId, entry);
      }

      entry.assignedCasesCount++;
      if (c.stage === 'resolved') {
        entry.recoveredAmount = Math.round((entry.recoveredAmount + Number(c.totalDebt || 0)) * 100) / 100;
      }
    }

    for (const doc of promisesSnap.docs) {
      const p = doc.data() as PromiseToPay;
      const userId = p.createdBy || 'unassigned';
      const entry = collectorMap.get(userId);
      if (entry) {
        if (p.status === 'fulfilled') entry.fulfilledPromisesCount++;
        else if (p.status === 'broken') entry.brokenPromisesCount++;
      }
    }

    // Calculate rates
    const leaderboard: CollectorPerformanceMetric[] = [];
    for (const item of collectorMap.values()) {
      const totalPtp = item.fulfilledPromisesCount + item.brokenPromisesCount;
      item.ptpSuccessRate = totalPtp > 0 ? Math.round((item.fulfilledPromisesCount / totalPtp) * 100) : 0;
      leaderboard.push(item);
    }

    return leaderboard.sort((a, b) => b.recoveredAmount - a.recoveredAmount);
  }
}
