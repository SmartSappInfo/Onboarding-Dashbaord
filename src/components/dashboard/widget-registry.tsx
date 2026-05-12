import React, { lazy } from 'react';

// Using React.lazy for client-side widgets, or we can just import server components if the registry is rendered on the server.
// For Next.js App Router, if WidgetRegistry is imported inside a Client Component, these will be treated as client imports.
// To keep data fetching in RSC, ideally the grid handles placing layout containers and the inner contents are passed as children from the server.
// However, since react-grid-layout is client-only, we usually pass an array of widget definitions and render them inside the grid.
// If we want RSC inside the grid, we have to pass them as a dictionary of React nodes from the server.

// Because react-grid-layout is a client component, any component we map here will become a client boundary.
// To avoid this and keep RSC benefits, we should just map strings to generic client wrappers, or we can use Server Actions inside the widgets if they are Client Components, 
// OR we map them to Server Components if this file is imported on the Server and we pass down the rendered nodes.

import { WidgetWrapper } from './widget-wrapper';

// Let's import existing widgets for now
import { MetricCard } from './MetricCard';
import { PipelineSnapshot } from './PipelineSnapshot';
import { RecentActivity } from './RecentActivity';
import { UpcomingMeetings } from './UpcomingMeetings';
import { LatestSurveys } from './LatestSurveys';
import { PipelineFunnel } from './PipelineFunnel';
import { DealsClosingSoon } from './DealsClosingSoon';
import { CampaignDeliveryRate } from './CampaignDeliveryRate';
import { TaskCompletionKpi } from './TaskCompletionKpi';

import { getSaasMetrics } from '@/app/actions/dashboard-actions';

// Wrapper component to handle async fetching for Metric Cards
function AsyncSaasMetric({ workspaceId, metricType, title, ...props }: any) {
  const [data, setData] = React.useState<any>(null);
  
  React.useEffect(() => {
    if (workspaceId) {
      getSaasMetrics(workspaceId).then(setData);
    }
  }, [workspaceId]);

  if (!data) return null; // Handled by Suspense/Skeleton above via WidgetWrapper if we used use() but here we use useEffect so we return null or skeleton

  let value, trend;
  if (metricType === 'mrr') {
    value = data.mrr;
    trend = data.mrrTrend;
  } else if (metricType === 'active-users') {
    value = data.activeUsers;
    trend = data.activeUsersTrend;
  } else if (metricType === 'churn') {
    value = data.churnRate;
    trend = data.churnTrend;
  }

  return <MetricCard title={title} value={value} trend={trend} {...props} />;
}

// This registry will map the `widgetId` from the config to the actual component.
export const WIDGET_REGISTRY: Record<string, React.ComponentType<any>> = {
  'saas-mrr': (props) => <AsyncSaasMetric metricType="mrr" title="MRR" {...props} />,
  'saas-active-users': (props) => <AsyncSaasMetric metricType="active-users" title="Active Users" {...props} />,
  'saas-churn': (props) => <AsyncSaasMetric metricType="churn" title="Churn" {...props} />,
  'pipeline-overview': (props) => <PipelineSnapshot {...props} />,
  'recent-activities': (props) => <RecentActivity activities={[]} {...props} />, // Will need real data fetching inside
  'upcoming-meetings': (props) => <UpcomingMeetings meetings={[]} {...props} />,
  'latest-surveys': (props) => <LatestSurveys surveys={[]} {...props} />,
  
  // Phase 2 Widgets
  'pipeline-funnel': (props) => <PipelineFunnel {...props} />,
  'deals-closing-soon': (props) => <DealsClosingSoon {...props} />,
  'campaign-delivery-rate': (props) => <CampaignDeliveryRate {...props} />,
  'task-completion-kpi': (props) => <TaskCompletionKpi {...props} />
};

export function renderWidget(widgetId: string, props: any = {}) {
  const WidgetComponent = WIDGET_REGISTRY[widgetId];
  if (!WidgetComponent) {
    return (
      <div className="p-4 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">
        Unknown widget: {widgetId}
      </div>
    );
  }
  return <WidgetComponent {...props} />;
}
