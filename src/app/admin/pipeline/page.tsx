import PipelineClient from './PipelineClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Onboarding Pipeline',
  description: 'Visual Kanban tracking for school progression from initial signup to go-live.',
};

export default function PipelinePage() {
  return <PipelineClient />;
}
