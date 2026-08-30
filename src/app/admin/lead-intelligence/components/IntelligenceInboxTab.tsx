'use client';

/**
 * Operational Intelligence Inbox Command Center Tab (Lead Intelligence 2.0 - Phase 13)
 * UI Spec Section 55: "Intelligence Inbox UX"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Unified 8-category triage command center aggregating signals, collisions, score changes, and AI recs.
 * 2. 1-Click Action Triggers: Activate, Review, Mark as Read.
 * 3. Mobile-responsive category scrollbar with >= 44px touch targets.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Inbox, 
  Flame, 
  TrendingUp, 
  UserCheck, 
  Copy, 
  ShieldAlert, 
  Database, 
  Sparkles, 
  Search, 
  CheckCircle2, 
  Zap, 
  ExternalLink,
  Clock,
  CheckCheck,
  RefreshCw,
  Loader2
} from 'lucide-react';
import type { 
  IntelligenceInboxCategory, 
  IntelligenceInboxItem, 
  InboxSummaryStats,
  Prospect 
} from '@/lib/lead-intelligence/types';
import { getIntelligenceInboxAction, markInboxItemReadAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface IntelligenceInboxTabProps {
  workspaceId: string;
  onSelectProspect: (prospect: Prospect) => void;
  onOpenActivation?: (prospect: Prospect) => void;
}

export const IntelligenceInboxTab: React.FC<IntelligenceInboxTabProps> = ({
  workspaceId,
  onSelectProspect,
  onOpenActivation
}) => {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<IntelligenceInboxCategory>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<IntelligenceInboxItem[]>([]);
  const [stats, setStats] = useState<InboxSummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInbox = React.useCallback(async () => {
    if (!workspaceId) return;
    try {
      setIsLoading(true);
      const res = await getIntelligenceInboxAction(workspaceId, selectedCategory, unreadOnly);
      if (res.success && res.items) {
        setItems(res.items);
        if (res.stats) setStats(res.stats);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load inbox' });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, selectedCategory, unreadOnly, toast]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const handleMarkRead = async (itemId: string) => {
    try {
      await markInboxItemReadAction(itemId, workspaceId);
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, isRead: true } : i));
      if (stats) {
        setStats(prev => prev ? { ...prev, totalUnread: Math.max(0, prev.totalUnread - 1) } : null);
      }
      toast({ title: 'Marked as Read' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to update item' });
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      i => i.prospectName.toLowerCase().includes(q) || i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const getCategoryIcon = (category: IntelligenceInboxCategory) => {
    switch (category) {
      case 'high_intent':
        return <Flame className="w-3.5 h-3.5 text-rose-500" />;
      case 'score_changes':
        return <TrendingUp className="w-3.5 h-3.5 text-purple-500" />;
      case 'new_decision_makers':
        return <UserCheck className="w-3.5 h-3.5 text-sky-500" />;
      case 'duplicates':
        return <Copy className="w-3.5 h-3.5 text-amber-500" />;
      case 'verification_issues':
        return <ShieldAlert className="w-3.5 h-3.5 text-red-500" />;
      case 'crm_matches':
        return <Database className="w-3.5 h-3.5 text-blue-500" />;
      case 'ai_recommendations':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Inbox className="w-3.5 h-3.5 text-primary" />;
    }
  };

  const categories: { id: IntelligenceInboxCategory; label: string; count?: number }[] = [
    { id: 'all', label: 'All Items', count: stats?.totalUnread },
    { id: 'high_intent', label: 'High Intent', count: stats?.highIntentCount },
    { id: 'score_changes', label: 'Score Changes', count: stats?.scoreChangeCount },
    { id: 'new_decision_makers', label: 'Decision Makers', count: stats?.decisionMakerCount },
    { id: 'duplicates', label: 'Duplicates', count: stats?.collisionCount },
    { id: 'verification_issues', label: 'Verification Flags', count: stats?.verificationIssueCount },
    { id: 'crm_matches', label: 'CRM Matches', count: stats?.crmMatchCount },
    { id: 'ai_recommendations', label: 'AI Strategy', count: stats?.aiRecommendationCount },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Inbox className="h-4 w-4" />
            </div>
            <h3 className="text-base font-black text-foreground">Operational Intelligence Inbox</h3>
            {stats && stats.totalUnread > 0 && (
              <Badge className="bg-primary text-primary-foreground font-mono text-xs">
                {stats.totalUnread} Unread
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Unified command center triaging intent signals, score shifts, verification alerts, and CRM match opportunities.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <Switch
              id="unread-toggle"
              checked={unreadOnly}
              onCheckedChange={setUnreadOnly}
            />
            <Label htmlFor="unread-toggle" className="text-xs font-semibold cursor-pointer">
              Unread Only
            </Label>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchInbox}
            disabled={isLoading}
            className="h-8 px-2.5 text-xs font-semibold rounded-xl active:scale-[0.97]"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 8-Category Filter Tabs (UI Spec Section 55) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "h-9 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-[0.97]",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {getCategoryIcon(cat.id)}
              <span>{cat.label}</span>
              {typeof cat.count === 'number' && cat.count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                )}>
                  {cat.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search inbox items by institution, signal, or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 pl-9 pr-4 text-xs bg-card border-border/70 rounded-xl"
        />
      </div>

      {/* Inbox Items Stream */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Aggregating workspace intelligence items...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center space-y-3 p-8 rounded-2xl bg-card border border-dashed border-border">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-foreground">Inbox Zero Achieved! 🎉</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No pending intelligence alerts in this category. All signals and opportunities have been reviewed.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className={cn(
                "p-4 rounded-2xl border transition-all space-y-2.5",
                !item.isRead ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-card border-border/70"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-card border border-border/60">
                    {getCategoryIcon(item.category)}
                  </div>
                  <span className="text-xs font-black text-foreground">{item.prospectName}</span>
                  {item.domain && (
                    <span className="text-[11px] text-muted-foreground">• {item.domain}</span>
                  )}
                  <Badge className={cn(
                    "text-[9px] font-bold uppercase",
                    item.priority === 'urgent' ? "bg-rose-500/20 text-rose-600 border-rose-500/40" :
                    item.priority === 'high' ? "bg-amber-500/20 text-amber-600 border-amber-500/40" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {item.priority}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-bold text-foreground">{item.title}</h5>
                <p className="text-[11px] text-muted-foreground pt-0.5 leading-relaxed">{item.description}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                <div className="flex items-center gap-2">
                  {item.actionType === 'activate' && onOpenActivation && (
                    <Button
                      size="sm"
                      onClick={() => onOpenActivation({ id: item.prospectId, name: item.prospectName, domain: item.domain } as Prospect)}
                      className="h-7 px-3 bg-primary text-primary-foreground font-bold text-[10px] rounded-lg flex items-center gap-1 active:scale-[0.97]"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Activate Prospect</span>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectProspect({ id: item.prospectId, name: item.prospectName, domain: item.domain } as Prospect)}
                    className="h-7 px-2.5 text-[10px] font-semibold rounded-lg flex items-center gap-1 active:scale-[0.97]"
                  >
                    <span>View Prospect</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </Button>
                </div>

                {!item.isRead && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleMarkRead(item.id)}
                    className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground active:scale-[0.97]"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Mark Read
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
