'use client';

/**
 * @fileOverview AI Administrative Command Center (Phase 9)
 *
 * Operational cockpit for generating natural language administrative action proposals,
 * simulating impact diffs, and executing approved batch workflows.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring animations.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Terminal,
  Sparkles,
  Users,
  Shield,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import type { AiAdminActionProposal } from '@/lib/types';
import {
  createAiActionProposalAction,
  listAiActionProposalsAction,
  approveAiProposalAction,
  rejectAiProposalAction,
} from '@/app/actions/ai-admin-actions';

import { AiCommandTerminal } from './components/AiCommandTerminal';
import { AiImpactPreviewDrawer } from './components/AiImpactPreviewDrawer';
import { AiProposalsQueueTable } from './components/AiProposalsQueueTable';

export function AiCommandCenterClient() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [proposals, setProposals] = React.useState<AiAdminActionProposal[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [inspectingProposal, setInspectingProposal] = React.useState<AiAdminActionProposal | null>(null);

  const loadProposals = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await listAiActionProposalsAction({
        idToken,
        organizationId: activeOrganizationId,
      });
      if (res.success) setProposals(res.proposals);
    } catch (err: unknown) {
      console.warn('[AiCommandCenterClient] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const handleGenerateProposal = async (prompt: string) => {
    if (!authUser || !activeOrganizationId) return;
    setIsGenerating(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await createAiActionProposalAction({
        idToken,
        organizationId: activeOrganizationId,
        prompt,
      });

      if (res.success && res.proposal) {
        toast({
          title: 'Action Proposal Generated',
          description: `Generated simulation for: "${res.proposal.title}"`,
        });
        setInspectingProposal(res.proposal);
        await loadProposals();
      } else {
        throw new Error(res.error || 'Failed to generate proposal');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating proposal';
      toast({ title: 'Proposal Generation Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveProposal = async (proposal: AiAdminActionProposal) => {
    if (!authUser || !activeOrganizationId) return;
    try {
      const idToken = await authUser.getIdToken();
      const res = await approveAiProposalAction({
        idToken,
        organizationId: activeOrganizationId,
        proposalId: proposal.id,
      });

      if (res.success) {
        toast({
          title: 'Action Executed Successfully',
          description: res.audit?.executionSummary || 'Administrative workflow executed.',
        });
        await loadProposals();
      } else {
        throw new Error(res.error || 'Execution failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error executing proposal';
      toast({ title: 'Execution Failed', description: msg, variant: 'destructive' });
    }
  };

  const handleRejectProposal = async (proposal: AiAdminActionProposal) => {
    if (!authUser || !activeOrganizationId) return;
    try {
      const idToken = await authUser.getIdToken();
      const res = await rejectAiProposalAction({
        idToken,
        organizationId: activeOrganizationId,
        proposalId: proposal.id,
      });

      if (res.success) {
        toast({ title: 'Proposal Rejected' });
        await loadProposals();
      } else {
        throw new Error(res.error || 'Failed to reject proposal');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error rejecting proposal';
      toast({ title: 'Rejection Failed', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="w-6 h-6 text-primary" /> AI Administrative Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Natural language administrative commands, pre-execution impact simulation diffs, and controlled execution
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/workforce/ai">
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" /> AI Advisor
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users">
              <Users className="h-3.5 w-3.5 mr-1.5 text-primary" /> Users Hub
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadProposals}
            disabled={isLoading}
            className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh Proposals
          </Button>
        </div>
      </div>

      {/* Natural Language Prompt Terminal */}
      <AiCommandTerminal
        onGenerateProposal={handleGenerateProposal}
        isGenerating={isGenerating}
      />

      {/* Proposals Queue Table */}
      <AiProposalsQueueTable
        proposals={proposals}
        isLoading={isLoading}
        onInspect={setInspectingProposal}
      />

      {/* Impact Simulation & Approval Drawer */}
      <AiImpactPreviewDrawer
        isOpen={Boolean(inspectingProposal)}
        onClose={() => setInspectingProposal(null)}
        proposal={inspectingProposal}
        onApprove={handleApproveProposal}
        onReject={handleRejectProposal}
      />
    </div>
  );
}

export default AiCommandCenterClient;
