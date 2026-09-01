'use client';

/**
 * @fileOverview Member Onboarding Execution Surface (Onboarding 2.0)
 *
 * Hydrates member onboarding instances and renders the interactive execution wizard.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Automatically spins up default instance if none exists for active user.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { Card } from '@/components/ui/card';
import { Loader2, AlertTriangle, Layers } from 'lucide-react';
import type { OnboardingInstance } from '@/lib/types';
import {
  getMemberOnboardingInstanceAction,
  startOnboardingJourneyAction,
} from '@/app/actions/onboarding-actions';
import { MemberOnboardingWizard } from './components/MemberOnboardingWizard';

export function OnboardingExecutionClient() {
  const searchParams = useSearchParams();
  const instanceIdParam = searchParams.get('instanceId') || undefined;

  const { user: authUser, isUserLoading } = useUser();
  const { activeOrganizationId, isTenantLoading } = useTenant();

  const [instance, setInstance] = React.useState<OnboardingInstance | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function loadOrCreateInstance() {
      if (isUserLoading || isTenantLoading) return;
      if (!authUser || !activeOrganizationId) {
        if (isMounted) {
          setIsLoading(false);
          setErrorMsg('Authentication or active organization context required.');
        }
        return;
      }

      setIsLoading(true);
      try {
        const idToken = await authUser.getIdToken();

        // 1. Try to fetch existing instance
        const res = await getMemberOnboardingInstanceAction({
          idToken,
          organizationId: activeOrganizationId,
          instanceId: instanceIdParam,
          personId: authUser.uid,
        });

        if (res.success && res.instance) {
          if (isMounted) setInstance(res.instance);
        } else {
          // 2. Start default journey instance
          const startRes = await startOnboardingJourneyAction({
            idToken,
            organizationId: activeOrganizationId,
            personId: authUser.uid,
          });

          if (startRes.success && startRes.instance) {
            if (isMounted) setInstance(startRes.instance);
          } else {
            throw new Error(startRes.error || 'Failed to initialize onboarding journey.');
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error loading onboarding';
          setErrorMsg(msg);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadOrCreateInstance();
    return () => {
      isMounted = false;
    };
  }, [authUser, activeOrganizationId, isUserLoading, isTenantLoading, instanceIdParam]);

  if (isLoading || isUserLoading || isTenantLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-4 shadow-xl border">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm font-semibold text-foreground">Preparing your personalized onboarding...</p>
          <p className="text-xs text-muted-foreground">Evaluating adaptive step graph requirements</p>
        </Card>
      </div>
    );
  }

  if (errorMsg || !instance) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4 shadow-xl border border-destructive/30">
          <div className="p-3 bg-rose-500/10 text-rose-600 rounded-full w-fit mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Unable to Load Onboarding</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{errorMsg}</p>
        </Card>
      </div>
    );
  }

  return <MemberOnboardingWizard initialInstance={instance} />;
}

export default OnboardingExecutionClient;
