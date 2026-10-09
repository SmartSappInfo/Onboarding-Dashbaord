import React, { Suspense } from 'react';
import { requireAuth } from '@/lib/auth/require-auth';
import { getCashFlowForecastingService } from '@/platform/agents/finance/analytics/cash-flow-forecasting-service';
import { getFinanceEmergencyControls } from '@/platform/policy/finance-control-policy';
import { getSchoolOperationsService } from '@/platform/agents/school/school-operations-service';
import { CashFlowClient } from './CashFlowClient';
import { PageContainerFluid } from '@/components/ui/page-container';
import { type CashFlowForecastResult } from '@/platform/agents/finance/analytics/cash-flow-types';
import { type AttendanceAnomalyResult } from '@/platform/agents/school/school-operations-types';

export const metadata = {
  title: 'Predictive Cash Flow Cockpit | SmartSapp',
  description: 'Predictive 30/60/90-day cash runway forecasting, collections velocity, and school operations intelligence.',
};

async function CashFlowDataFetcher() {
  const auth = await requireAuth();
  const organizationId = auth.profile?.organizationId || 'org_default';
  const workspaceId = auth.profile?.lastActiveWorkspaceId || 'ws_default';

  // 1. Fetch initial forecast
  const forecastingService = getCashFlowForecastingService();
  const initialForecast: CashFlowForecastResult = await forecastingService.forecastCashFlow({
    organizationId,
    workspaceId,
    cashOnHand: 50000,
    totalCreditSales90d: 120000,
    currency: 'GHS',
    invoices: [],
    installmentPlans: [],
    promisesToPay: [],
    timeHorizonDays: 90,
  });

  // 2. Fetch emergency controls
  const initialControls = await getFinanceEmergencyControls(organizationId);

  // 3. Fetch school operations anomalies
  let initialAnomalies: AttendanceAnomalyResult[] = [];
  try {
    const schoolService = getSchoolOperationsService();
    const records = await schoolService.getAttendanceReport({ organizationId, workspaceId });
    for (const record of records.slice(0, 5)) {
      const anomaly = await schoolService.analyzeAttendanceAnomaly(record);
      if (anomaly.isAnomalyFlagged) {
        initialAnomalies.push(anomaly);
      }
    }
  } catch {
    // Non-blocking fallback for anomalies
  }

  return (
    <CashFlowClient
      initialForecast={initialForecast}
      initialControls={initialControls}
      initialAnomalies={initialAnomalies}
    />
  );
}

function CashFlowLoadingSkeleton() {
  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-20 w-full text-left animate-pulse">
        <div className="h-10 bg-muted/40 rounded-xl w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-xl" />
          ))}
        </div>
        <div className="h-48 bg-muted/20 rounded-xl" />
      </div>
    </PageContainerFluid>
  );
}

export default function CashFlowCockpitPage() {
  return (
    <Suspense fallback={<CashFlowLoadingSkeleton />}>
      <CashFlowDataFetcher />
    </Suspense>
  );
}
