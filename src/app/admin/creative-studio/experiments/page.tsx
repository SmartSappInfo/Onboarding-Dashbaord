/**
 * ARCHITECTURE:
 * Experiments & Creative Analytics Page (Phase 9)
 * 
 * Server Component fetching workspace A/B and multivariate experiments.
 */

import { listProjectExperimentsAction } from '@/app/actions/creative-experiment-actions';
import { ExperimentsClient } from './ExperimentsClient';

export default async function ExperimentsPage() {
  const workspaceId = 'default-workspace';
  const res = await listProjectExperimentsAction(workspaceId);
  const experiments = res.success && res.data ? res.data : [];

  return <ExperimentsClient initialExperiments={experiments} />;
}
