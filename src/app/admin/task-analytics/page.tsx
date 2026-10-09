import TaskAnalyticsClient from './TaskAnalyticsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Task Analytics & Operational Insights',
  description: 'Team delivery velocity, throughput, workload distribution, and blocker resolution analytics.',
};

export default function TaskAnalyticsPage() {
  return <TaskAnalyticsClient />;
}
