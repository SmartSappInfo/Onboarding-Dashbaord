import PipelineSettingsClient from './PipelineSettingsClient';
import { Metadata } from 'next';

/**
 * @fileOverview Pipeline Configuration Hub (Server Entry).
 */

export const metadata: Metadata = {
  title: 'Pipeline Configuration',
  description: 'Modify your pipeline stages and access architecture.',
};

export default function PipelineSettingsPage() {
  return <PipelineSettingsClient />;
}
