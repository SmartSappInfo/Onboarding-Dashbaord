/**
 * @fileoverview Platform Control Plane Survey Governance RSC Page
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - RSC boundary delegating telemetry to `SurveyGovernanceClient`.
 */

import { Metadata } from 'next';
import SurveyGovernanceClient from './components/SurveyGovernanceClient';

export const metadata: Metadata = {
  title: 'Survey & Intake Governance | SmartSapp Backoffice',
  description: 'Cross-tenant survey traffic, drop-off intelligence, and spam abuse triage.',
};

export default function SurveyGovernancePage() {
  return <SurveyGovernanceClient />;
}
