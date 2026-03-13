
import PipelineSettingsClient from './PipelineSettingsClient';
import { Metadata } from 'next';

/**
 * @fileOverview Pipeline Configuration Hub (Server Entry).
 */

export const metadata: Metadata = {
  title: 'Pipeline Studio',
  description: 'Architect custom institutional onboarding workflows and define progression logic.',
};

export default function PipelineSettingsPage() {
  return <PipelineSettingsClient />;
}
