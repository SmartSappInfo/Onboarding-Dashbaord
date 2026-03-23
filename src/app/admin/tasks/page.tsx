import TasksClient from './TasksClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM Task Registry',
  description: 'Proactive intervention management and automated onboarding workflow tracking.',
};

export default function TasksPage() {
  return <TasksClient />;
}
