import * as React from 'react';
import { OnboardingClient } from '@/app/admin/onboarding/OnboardingClient';

export const metadata = {
  title: 'Onboarding Journey Engine | SmartSapp Workforce',
  description: 'Manage dynamic employee onboarding paths, step graphs, and active member queues',
};

export default function WorkforceOnboardingPage() {
  return <OnboardingClient />;
}
