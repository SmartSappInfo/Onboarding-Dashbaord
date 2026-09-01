import * as React from 'react';
import { Suspense } from 'react';
import { OnboardingExecutionClient } from './OnboardingExecutionClient';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Member Onboarding | SmartSapp Workforce',
  description: 'Complete your tailored organization induction journey',
};

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Loading onboarding journey...</p>
          </div>
        </div>
      }
    >
      <OnboardingExecutionClient />
    </Suspense>
  );
}
