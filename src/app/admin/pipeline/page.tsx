import PipelineClient from './PipelineClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pipeline',
  description: 'Visual Kanban tracking for progression across stages.',
};

export default function PipelinePage() {
  return <PipelineClient />;
}
