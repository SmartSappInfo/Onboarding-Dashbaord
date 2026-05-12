import { IndustryTemplate } from '../types/dashboard';
import type { Layout } from 'react-grid-layout';

export const SaasDashboardTemplate: IndustryTemplate = {
  industry: 'saas',
  name: 'SaaS',
  description: 'Default dashboard for Software as a Service organizations.',
  defaultLayout: {
    id: 'saas-default',
    industry: 'saas',
    layouts: {
      lg: [
        { i: 'mrr-widget', x: 0, y: 0, w: 3, h: 2 },
        { i: 'active-users-widget', x: 3, y: 0, w: 3, h: 2 },
        { i: 'churn-widget', x: 6, y: 0, w: 3, h: 2 },
        { i: 'pipeline-overview', x: 0, y: 2, w: 6, h: 4 },
        { i: 'recent-activities', x: 6, y: 2, w: 3, h: 4 },
      ],
      md: [
        { i: 'mrr-widget', x: 0, y: 0, w: 2, h: 2 },
        { i: 'active-users-widget', x: 2, y: 0, w: 2, h: 2 },
        { i: 'churn-widget', x: 4, y: 0, w: 2, h: 2 },
        { i: 'pipeline-overview', x: 0, y: 2, w: 4, h: 4 },
        { i: 'recent-activities', x: 4, y: 2, w: 2, h: 4 },
      ],
      sm: [
        { i: 'mrr-widget', x: 0, y: 0, w: 1, h: 2 },
        { i: 'active-users-widget', x: 1, y: 0, w: 1, h: 2 },
        { i: 'churn-widget', x: 0, y: 2, w: 1, h: 2 },
        { i: 'pipeline-overview', x: 0, y: 4, w: 2, h: 4 },
        { i: 'recent-activities', x: 0, y: 8, w: 2, h: 4 },
      ]
    },
    widgets: [
      { id: 'mrr-widget', widgetId: 'saas-mrr', title: 'Monthly Recurring Revenue' },
      { id: 'active-users-widget', widgetId: 'saas-active-users', title: 'Active Users' },
      { id: 'churn-widget', widgetId: 'saas-churn', title: 'Churn Rate' },
      { id: 'pipeline-overview', widgetId: 'pipeline-overview', title: 'Sales Pipeline' },
      { id: 'recent-activities', widgetId: 'recent-activities', title: 'Recent Activities' },
    ]
  }
};

export const DashboardTemplates: Record<string, IndustryTemplate> = {
  saas: SaasDashboardTemplate,
  // Future phases: agency, consulting, real_estate, schools
};
