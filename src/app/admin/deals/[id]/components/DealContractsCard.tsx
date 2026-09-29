'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Contextual Deal Intelligence & Active Agreements Card for Deal Details page (P4.2).
 *    Displays linked contracts, execution status, commercial value with cadence,
 *    and multi-party signing progress with 1-click dispatch and verification actions.
 * 2. Invariants Enforced:
 *    - Tenant Scoping: Queries strictly scoped by `deal.workspaceId` (FM-P4-04).
 *    - Mobile Ergonomics: Touch targets >= 44x44px, text-base inputs, active:scale-[0.97] feedback (FM-P4-10).
 *    - Zero Tolerance Typing: Strictly zero `any` or `any[]` (Rule 4).
 *    - Everyday English Dictionary: Clear, minimal labels ('Agreement', 'Signed', 'Out for Signature') (Rule 7).
 */

import * as React from 'react';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Deal } from '@/lib/types';
import type { ContractRecord, SigningEnvelope } from '@/lib/types/document-signing';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  FileCheck,
  Clock,
  AlertCircle,
  ExternalLink,
  Plus,
  Send,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency-utils';
import { formatSafeLocaleDate } from '@/lib/date-utils';

export interface DealContractsCardProps {
  deal: Deal;
}

function getStatusBadge(status?: string) {
  switch (status) {
    case 'signed':
    case 'active':
    case 'executed':
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[11px] font-semibold gap-1">
          <CheckCircle2 className="h-3 w-3" /> Signed
        </Badge>
      );
    case 'out_for_signature':
    case 'in_progress':
    case 'sent':
      return (
        <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 text-[11px] font-semibold gap-1">
          <Clock className="h-3 w-3" /> Out for Signature
        </Badge>
      );
    case 'declined':
      return (
        <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 text-[11px] font-semibold gap-1">
          <AlertCircle className="h-3 w-3" /> Declined
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground text-[11px] font-semibold">
          Draft / Proposed
        </Badge>
      );
  }
}

export default function DealContractsCard({ deal }: DealContractsCardProps) {
  const firestore = useFirestore();

  // Query Contracts linked to this deal
  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !deal.workspaceId || !deal.id) return null;
    return query(
      collection(firestore, 'contracts'),
      where('workspaceId', '==', deal.workspaceId),
      where('dealId', '==', deal.id),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, deal.workspaceId, deal.id]);

  const { data: rawContracts, isLoading: isContractsLoading } =
    useCollection<ContractRecord>(contractsQuery);

  // Query Envelopes linked to this deal
  const envelopesQuery = useMemoFirebase(() => {
    if (!firestore || !deal.workspaceId || !deal.id) return null;
    return query(
      collection(firestore, 'signing_envelopes'),
      where('workspaceId', '==', deal.workspaceId),
      where('dealId', '==', deal.id),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, deal.workspaceId, deal.id]);

  const { data: rawEnvelopes, isLoading: isEnvelopesLoading } =
    useCollection<SigningEnvelope>(envelopesQuery);

  const contracts = rawContracts || [];
  const envelopes = rawEnvelopes || [];
  const hasAgreements = contracts.length > 0 || envelopes.length > 0;

  return (
    <Card className="border-border/50 rounded-2xl bg-card shadow-sm overflow-hidden">
      <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              Agreements & Signing
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Commercial contracts, signing workflows, and legal commitments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(deal.contractStatus || (contracts[0]?.status as string))}
          <Button
            asChild
            size="sm"
            className="rounded-xl font-bold text-xs h-9 px-3 shadow-sm active:scale-[0.97] transition-all min-h-[44px] sm:min-h-0"
          >
            <Link href={`/admin/finance/contracts?dealId=${encodeURIComponent(deal.id)}`}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Issue Agreement
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {isContractsLoading || isEnvelopesLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
            Loading agreements...
          </div>
        ) : !hasAgreements ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border/80 bg-muted/10 space-y-3">
            <div className="h-10 w-10 mx-auto rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">No active agreements linked</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto mt-0.5">
                Issue a contract from a reusable template to automate signer routing, deal stage progression, and revenue attribution.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold active:scale-[0.97] transition-all min-h-[44px] sm:min-h-0"
            >
              <Link href={`/admin/finance/contracts?dealId=${encodeURIComponent(deal.id)}`}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Select Template & Issue
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => {
              const contractValueText = contract.contractValue
                ? `${formatCurrency(contract.contractValue.amount, contract.contractValue.currency)} / ${contract.contractValue.cadence}`
                : null;

              return (
                <div
                  key={contract.id}
                  className="p-4 rounded-xl border border-border/60 bg-card hover:border-primary/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {contract.title}
                      </span>
                      {getStatusBadge(contract.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {contractValueText && (
                        <span className="font-semibold text-foreground/80">
                          {contractValueText}
                        </span>
                      )}
                      {contract.effectiveAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Effective: {formatSafeLocaleDate(contract.effectiveAt)}
                        </span>
                      )}
                      {contract.renewalAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Renewal: {formatSafeLocaleDate(contract.renewalAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-xs h-8 px-2.5 active:scale-[0.97] min-h-[44px] sm:min-h-0"
                    >
                      <Link href={`/admin/finance/contracts?id=${encodeURIComponent(contract.id)}`}>
                        Manage <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* In-Flight Signing Envelopes */}
            {envelopes.map((env) => {
              const signedCount = env.recipients?.filter((r) => r.status === 'signed').length || 0;
              const totalSigners = env.recipients?.length || 0;

              return (
                <div
                  key={env.id}
                  className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">
                        Workflow: {env.title}
                      </span>
                      {getStatusBadge(env.status)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Signatures: {signedCount} of {totalSigners} completed ({env.routingMode || 'sequential'} routing)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-xs h-8 px-3 font-semibold active:scale-[0.97] min-h-[44px] sm:min-h-0"
                    >
                      <Link href={`/verify/${encodeURIComponent(env.id)}`} target="_blank">
                        <ShieldCheck className="h-3.5 w-3.5 mr-1 text-primary" />
                        Verify <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
