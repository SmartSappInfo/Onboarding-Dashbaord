'use client';

/**
 * Live Continuous Signals Feed Tab (Lead Intelligence 2.0 - Phase 7)
 * UI Spec Section 31: "Phase 7 UX — Signals Feed & Real-Time Intent"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Category and strength filter chips with active indicators.
 * 2. Instant forensic inspection trigger linking to SignalDetailModal.
 * 3. Mobile touch target compliance (min-h-[44px]).
 * 4. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Flame, 
  TrendingUp, 
  Users, 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  Filter, 
  ExternalLink, 
  Eye, 
  CheckCircle2, 
  Loader2,
  Radio
} from 'lucide-react';
import type { LeadSignal, LeadSignalCategory, Prospect } from '@/lib/lead-intelligence/types';
import { getWorkspaceSignalsAction } from '@/app/actions/lead-intelligence-actions';
import { SignalDetailModal } from './SignalDetailModal';
import { cn } from '@/lib/utils';

interface SignalsFeedTabProps {
  workspaceId: string;
  onSelectProspect?: (prospectId: string) => void;
  onCreateTask?: (signal: LeadSignal) => void;
}

export const SignalsFeedTab: React.FC<SignalsFeedTabProps> = ({
  workspaceId,
  onSelectProspect,
  onCreateTask
}) => {
  const [signals, setSignals] = useState<LeadSignal[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [activeSignal, setActiveSignal] = useState<LeadSignal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchSignals = async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await getWorkspaceSignalsAction(workspaceId, {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        unreadOnly
      });
      if (res.success && res.signals) {
        setSignals(res.signals);
        setUnreadCount(res.unreadCount || 0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [workspaceId, selectedCategory, unreadOnly]);

  const filteredSignals = signals.filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.prospectName.toLowerCase().includes(q) ||
      s.prospectDomain.toLowerCase().includes(q) ||
      s.headline.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  });

  const getRelativeTime = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const getCategoryIcon = (cat: LeadSignalCategory) => {
    switch (cat) {
      case 'intent':
        return <Flame className="h-4 w-4 text-rose-500" />;
      case 'technographic':
        return <TrendingUp className="h-4 w-4 text-purple-500" />;
      case 'leadership':
        return <Users className="h-4 w-4 text-sky-500" />;
      case 'compliance':
        return <ShieldAlert className="h-4 w-4 text-amber-500" />;
      default:
        return <Radio className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Category Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/80 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className="h-8 text-xs font-bold rounded-xl active:scale-[0.97]"
          >
            All Signals
          </Button>

          <Button
            variant={selectedCategory === 'intent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('intent')}
            className="h-8 text-xs font-bold rounded-xl flex items-center gap-1 active:scale-[0.97]"
          >
            <Flame className="h-3.5 w-3.5 text-rose-500" />
            <span>High Intent</span>
          </Button>

          <Button
            variant={selectedCategory === 'technographic' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('technographic')}
            className="h-8 text-xs font-bold rounded-xl flex items-center gap-1 active:scale-[0.97]"
          >
            <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
            <span>Technology</span>
          </Button>

          <Button
            variant={selectedCategory === 'leadership' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('leadership')}
            className="h-8 text-xs font-bold rounded-xl flex items-center gap-1 active:scale-[0.97]"
          >
            <Users className="h-3.5 w-3.5 text-sky-500" />
            <span>Leadership</span>
          </Button>

          <Button
            variant={selectedCategory === 'compliance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('compliance')}
            className="h-8 text-xs font-bold rounded-xl flex items-center gap-1 active:scale-[0.97]"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            <span>Compliance</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant={unreadOnly ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
            className="h-8 px-2.5 text-xs font-semibold rounded-xl"
          >
            Unread ({unreadCount})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchSignals}
            disabled={isLoading}
            className="h-8 w-8 p-0 rounded-xl"
            title="Refresh Feed"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter signals by company name, domain, or keyword..."
          className="pl-9 h-10 rounded-xl bg-card border-border/80 text-xs"
        />
      </div>

      {/* Signals List Stream */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-card rounded-2xl border border-dashed border-border/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-80" />
          <p className="text-xs text-muted-foreground font-medium">Scanning live intent feeds...</p>
        </div>
      ) : filteredSignals.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-card rounded-2xl border border-dashed border-border/80 text-center px-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Radio className="h-6 w-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">No Live Intent Signals Found</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              All monitored accounts are currently stable. Run delta scans to detect website redesigns, payment changes, and newly identified decision makers.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSignals.map((sig) => (
            <div
              key={sig.id}
              className={cn(
                "p-4 rounded-2xl border bg-card hover:border-border transition-all space-y-2.5 shadow-sm",
                !sig.isRead ? "border-primary/40 bg-primary/[0.02]" : "border-border/70"
              )}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-muted/40 shrink-0 mt-0.5">
                    {getCategoryIcon(sig.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-foreground hover:underline cursor-pointer"
                        onClick={() => {
                          setActiveSignal(sig);
                          setIsDetailOpen(true);
                        }}
                      >
                        {sig.headline}
                      </h4>
                      {!sig.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5">
                      <span className="font-semibold text-foreground/80">{sig.prospectName}</span>
                      <span>•</span>
                      <a
                        href={`https://${sig.prospectDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-500 hover:text-sky-400 flex items-center gap-0.5"
                      >
                        <span>{sig.prospectDomain}</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge 
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-wider px-2 py-0.2",
                      sig.strength === 'critical' && "bg-rose-500/20 text-rose-600 border-rose-500/40",
                      sig.strength === 'high' && "bg-amber-500/20 text-amber-600 border-amber-500/40",
                      sig.strength === 'medium' && "bg-sky-500/20 text-sky-600 border-sky-500/40"
                    )}
                  >
                    {sig.strength}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {getRelativeTime(sig.detectedAt)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed pl-10">
                {sig.description}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-border/40 pl-10 flex-wrap gap-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  Confidence: <strong className="text-foreground">{sig.confidence}%</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveSignal(sig);
                      setIsDetailOpen(true);
                    }}
                    className="h-7 px-2.5 text-xs font-semibold rounded-lg flex items-center gap-1 active:scale-[0.97]"
                  >
                    <Eye className="h-3 w-3" />
                    <span>View Forensic Diff</span>
                  </Button>

                  {onCreateTask && (
                    <Button
                      size="sm"
                      onClick={() => onCreateTask(sig)}
                      className="h-7 px-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg active:scale-[0.97]"
                    >
                      Follow Up
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Forensic Signal Detail Modal */}
      <SignalDetailModal
        signal={activeSignal}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onCreateTask={onCreateTask}
        onSignalUpdated={(sigId, isRead, isDismissed) => {
          setSignals((prev) =>
            prev
              .map((s) => (s.id === sigId ? { ...s, isRead: Boolean(isRead), isDismissed: Boolean(isDismissed) } : s))
              .filter((s) => !s.isDismissed)
          );
        }}
      />
    </div>
  );
};
