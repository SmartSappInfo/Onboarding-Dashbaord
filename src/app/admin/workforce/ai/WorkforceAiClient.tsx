'use client';

/**
 * @fileOverview AI-Assisted Administration & Workforce Intelligence Control Center (Phase 8)
 *
 * Administrative control plane for workforce risk radar, AI role recommendations,
 * and automated least-privilege compliance advice.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring physics.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Sparkles,
  RefreshCw,
  Shield,
  Users,
  Briefcase,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import type {
  OrganizationRiskOverview,
  AiWorkforceRecommendation,
} from '@/lib/types';
import {
  getOrganizationRiskOverviewAction,
  listAiRecommendationsAction,
  generateAiRecommendationsAction,
  applyAiRecommendationAction,
  dismissAiRecommendationAction,
} from '@/app/actions/ai-workforce-actions';

import { WorkforceRiskRadar } from './components/WorkforceRiskRadar';
import { AiRecommendationsFeed } from './components/AiRecommendationsFeed';

export function WorkforceAiClient() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [overview, setOverview] = React.useState<OrganizationRiskOverview | null>(null);
  const [recommendations, setRecommendations] = React.useState<AiWorkforceRecommendation[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const [ovRes, recsRes] = await Promise.all([
        getOrganizationRiskOverviewAction({ idToken, organizationId: activeOrganizationId }),
        listAiRecommendationsAction({ idToken, organizationId: activeOrganizationId, status: 'active' }),
      ]);

      if (ovRes.success && ovRes.overview) setOverview(ovRes.overview);
      if (recsRes.success) setRecommendations(recsRes.recommendations);
    } catch (err: unknown) {
      console.warn('[WorkforceAiClient] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunAiScan = async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsScanning(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await generateAiRecommendationsAction({
        idToken,
        organizationId: activeOrganizationId,
      });

      if (res.success) {
        toast({
          title: 'AI Scan Completed',
          description: `Generated ${res.recommendations.length} new workforce risk and access recommendations.`,
        });
        await loadData();
      } else {
        throw new Error(res.error || 'Scan failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error running AI scan';
      toast({ title: 'AI Scan Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyRec = async (rec: AiWorkforceRecommendation) => {
    if (!authUser || !activeOrganizationId) return;
    try {
      const idToken = await authUser.getIdToken();
      const res = await applyAiRecommendationAction({
        idToken,
        organizationId: activeOrganizationId,
        recommendationId: rec.id,
      });

      if (res.success) {
        toast({
          title: 'Recommendation Applied',
          description: `Successfully applied: ${rec.title}`,
        });
        await loadData();
      } else {
        throw new Error(res.error || 'Failed to apply recommendation');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error applying recommendation';
      toast({ title: 'Execution Failed', description: msg, variant: 'destructive' });
    }
  };

  const handleDismissRec = async (rec: AiWorkforceRecommendation) => {
    if (!authUser || !activeOrganizationId) return;
    try {
      const idToken = await authUser.getIdToken();
      const res = await dismissAiRecommendationAction({
        idToken,
        organizationId: activeOrganizationId,
        recommendationId: rec.id,
      });

      if (res.success) {
        toast({ title: 'Recommendation Dismissed' });
        await loadData();
      } else {
        throw new Error(res.error || 'Failed to dismiss');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error dismissing recommendation';
      toast({ title: 'Dismiss Failed', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> AI Workforce Intelligence & Role Advisor
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Holistic workforce risk scoring, least-privilege pruning, and explainable access optimization
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users">
              <Users className="h-3.5 w-3.5 mr-1.5 text-primary" /> People Hub
            </Link>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleRunAiScan}
            disabled={isScanning || isLoading}
            className="rounded-lg h-9 px-4 text-xs font-semibold active:scale-[0.97]"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Scanning Workforce...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Run AI Security Scan
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Workforce Risk Radar Overview */}
      <WorkforceRiskRadar overview={overview} isLoading={isLoading} />

      {/* Actionable Recommendations Feed */}
      <AiRecommendationsFeed
        recommendations={recommendations}
        isLoading={isLoading}
        onApply={handleApplyRec}
        onDismiss={handleDismissRec}
      />
    </div>
  );
}

export default WorkforceAiClient;
