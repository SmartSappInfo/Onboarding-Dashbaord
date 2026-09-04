'use client';

/**
 * @fileoverview Buyer Signal Center Tab (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 4018 and UI Specification Section 3140:
 * 1. Unified stream of real-time buyer signals (intent spikes, proposal downloads, pricing visits).
 * 2. Intent level filtering (All, High, Medium, Low) and confidence scoring.
 * 3. 1-Click "Action Signal" converts signal to task and awards +10 effort points via Phase 1 ledger.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing (zero 'any' or 'any[]').
 * - Touch targets maintain >= 44px height (min-h-[44px]) for mobile accessibility.
 * - Tactile micro-interactions use active:scale-[0.97] (emilkowal-animations).
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Zap,
  Globe,
  FileText,
  Mail,
  Users,
  CheckCircle2,
  Loader2,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import type { BuyerSignal, SignalIntentLevel } from '@/lib/deal-intelligence/types';
import { actionBuyerSignalAction } from '@/app/actions/deal-intelligence-actions';

interface BuyerSignalCenterTabProps {
  signals: BuyerSignal[];
  workspaceId: string;
  organizationId: string;
  currentUserId: string;
  currentUserName: string;
  onRefreshSignals?: () => void;
}

export const BuyerSignalCenterTab: React.FC<BuyerSignalCenterTabProps> = ({
  signals,
  workspaceId,
  organizationId,
  currentUserId,
  currentUserName,
  onRefreshSignals,
}) => {
  const { toast } = useToast();
  const [selectedIntent, setSelectedIntent] = React.useState<string>('all');
  const [actioningId, setActioningId] = React.useState<string | null>(null);

  const filteredSignals = React.useMemo(() => {
    if (selectedIntent === 'all') return signals;
    return signals.filter((s) => s.intentLevel === selectedIntent);
  }, [signals, selectedIntent]);

  const handleActionSignal = async (signal: BuyerSignal) => {
    try {
      setActioningId(signal.id);
      const res = await actionBuyerSignalAction({
        signalId: signal.id,
        workspaceId,
        organizationId,
        actorId: currentUserId,
        actorName: currentUserName,
      });

      if (res.success) {
        toast({
          title: 'Signal Actioned (+10 Points)',
          description: `Action initiated for ${signal.entityName}. 10 sales effort points awarded.`,
          actionConfig: {
            path: '/admin/my-day',
            label: 'View in My Day',
          },
        });
        if (onRefreshSignals) onRefreshSignals();
      } else {
        toast({
          title: 'Action Failed',
          description: res.error || 'Failed to update signal status.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Unable to communicate with the server.',
        variant: 'destructive',
      });
    } finally {
      setActioningId(null);
    }
  };

  const getSourceIcon = (source: BuyerSignal['source']) => {
    switch (source) {
      case 'web':
        return <Globe className="w-4 h-4 text-blue-500" />;
      case 'proposal':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'email':
        return <Mail className="w-4 h-4 text-amber-500" />;
      case 'meeting':
        return <Users className="w-4 h-4 text-purple-500" />;
      default:
        return <Zap className="w-4 h-4 text-primary" />;
    }
  };

  const getIntentBadge = (intent: SignalIntentLevel) => {
    switch (intent) {
      case 'high':
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">High Intent</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">Medium Intent</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Low Intent</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Buyer Signal Center
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time customer engagement and intent spikes across web, documents, and meetings.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `All Signals (${signals.length})` },
            { id: 'high', label: `High Intent (${signals.filter((s) => s.intentLevel === 'high').length})` },
            { id: 'medium', label: 'Medium' },
            { id: 'low', label: 'Low' },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={selectedIntent === tab.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedIntent(tab.id)}
              className="min-h-[44px] text-xs font-semibold active:scale-[0.97]"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Signal Stream List */}
      {filteredSignals.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">No signals match this filter</h3>
            <p className="text-xs text-muted-foreground">
              All active customer signals in this category have been addressed.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSignals.map((signal) => {
            const isActioning = actioningId === signal.id;
            const isActioned = signal.status === 'actioned';

            return (
              <Card
                key={signal.id}
                className="p-5 transition-all hover:border-primary/40 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {getSourceIcon(signal.source)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">{signal.title}</h3>
                        {getIntentBadge(signal.intentLevel)}
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {signal.confidenceScore}% Confidence
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-primary">
                        {signal.entityName}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                        {signal.description}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {new Date(signal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Suggested Action Box */}
                {signal.suggestedAction && (
                  <div className="rounded-lg bg-muted/40 border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-bold text-foreground">
                          Recommended Action:
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase font-semibold"
                        >
                          {signal.suggestedAction.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {signal.suggestedAction.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isActioned ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Actioned
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleActionSignal(signal)}
                          className="min-h-[44px] active:scale-[0.97] text-xs font-semibold w-full sm:w-auto"
                        >
                          {isActioning ? (
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4 mr-1.5" />
                          )}
                          Action Signal (+10 pts)
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
