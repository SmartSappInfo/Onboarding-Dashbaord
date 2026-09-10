'use client';

/**
 * @fileoverview Play Library Tab Component (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 1 (Play Library):
 * - Displays pre-built and custom Sales Play templates with filtering and search.
 * - 1-click status toggling (enable/disable) via toggleSalesPlayStatusAction.
 * - Performance analytics pills (Execution count, Win rate %, Avg duration).
 * - Mobile-first touch targets (min-h-[44px], active:scale-[0.97]).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - No raw HTML tags in UI.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Play,
  Search,
  Zap,
  Clock,
  Workflow,
} from 'lucide-react';
import type { SalesPlay, PlayCategory } from '@/lib/sales-orchestration/types';
import {
  toggleSalesPlayStatusAction,
  triggerSalesPlayManuallyAction,
} from '@/app/actions/sales-orchestration-actions';
import { useToast } from '@/hooks/use-toast';

interface PlayLibraryTabProps {
  plays: SalesPlay[];
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  onRefresh: () => void;
  onSelectPlayForBuilder: (play: SalesPlay) => void;
}

export function PlayLibraryTab({
  plays,
  workspaceId,
  organizationId,
  actorId,
  actorName,
  onRefresh,
  onSelectPlayForBuilder,
}: PlayLibraryTabProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [launchingPlay, setLaunchingPlay] = React.useState<SalesPlay | null>(null);
  const [entityName, setEntityName] = React.useState('');
  const [entityValue, setEntityValue] = React.useState('25000');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredPlays = React.useMemo(() => {
    return plays.filter((play) => {
      const matchesSearch =
        play.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        play.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || play.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [plays, searchQuery, selectedCategory]);

  const handleToggleStatus = async (playId: string, currentEnabled: boolean) => {
    try {
      const res = await toggleSalesPlayStatusAction({
        workspaceId,
        playId,
        actorId,
        enabled: !currentEnabled,
      });

      if (res.success) {
        toast({
          title: 'Play Updated',
          description: `Play has been ${!currentEnabled ? 'activated' : 'deactivated'}.`,
        });
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: res.error || 'Failed to toggle play status.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred.',
      });
    }
  };

  const handleLaunchPlay = async () => {
    if (!launchingPlay || !entityName.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await triggerSalesPlayManuallyAction({
        workspaceId,
        organizationId,
        actorId,
        actorName,
        playId: launchingPlay.id,
        entityId: `deal_${Date.now()}`,
        entityType: 'deal',
        entityName: entityName.trim(),
        entityValue: Number(entityValue) || 10000,
      });

      if (res.success) {
        toast({
          title: 'Sales Play Launched',
          description: `Instance started for "${entityName}". Action items added to seller queue.`,
        });
        setLaunchingPlay(null);
        setEntityName('');
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Launch Failed',
          description: res.error || 'Failed to trigger play.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to launch sales play.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryBadge = (category: PlayCategory) => {
    switch (category) {
      case 'inbound_lead':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">Inbound Lead</Badge>;
      case 'deal_acceleration':
        return <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-medium">Acceleration</Badge>;
      case 'deal_recovery':
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium">Recovery</Badge>;
      case 'governance':
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-medium">Governance</Badge>;
      default:
        return <Badge variant="secondary">Expansion</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Category Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search play templates by name or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 rounded-xl text-sm min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Plays' },
            { id: 'inbound_lead', label: 'Inbound' },
            { id: 'deal_acceleration', label: 'Acceleration' },
            { id: 'deal_recovery', label: 'Recovery' },
            { id: 'governance', label: 'Governance' },
          ].map((cat) => (
            <Button
              key={cat.id}
              type="button"
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="h-10 rounded-xl text-xs font-semibold px-3 min-h-[44px] active:scale-[0.97] transition-transform shrink-0"
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Play Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredPlays.map((play) => (
          <Card
            key={play.id}
            className={`border rounded-2xl transition-all shadow-sm ${
              play.enabled
                ? 'border-border/70 hover:border-primary/40 bg-card'
                : 'border-dashed border-border/50 bg-muted/20 opacity-75'
            }`}
          >
            <CardHeader className="pb-3 px-6 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getCategoryBadge(play.category)}
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Workflow className="h-3.5 w-3.5 text-primary" />
                      {play.steps.length} Steps
                    </span>
                    {play.allowReentry && (
                      <span className="text-xs text-muted-foreground">
                        • 24h Cooldown
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base font-bold tracking-tight text-foreground">
                    {play.title}
                  </CardTitle>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={play.enabled}
                    onCheckedChange={() => handleToggleStatus(play.id, play.enabled)}
                    aria-label={`Toggle ${play.title}`}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-5 space-y-4">
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {play.description}
              </p>

              {/* Trigger & Step Outline */}
              <div className="bg-muted/40 rounded-xl p-3 border border-border/40 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                  <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>
                    Trigger:{' '}
                    <strong className="text-foreground">
                      {play.triggers.map((t) => t.type.replace(/_/g, ' ')).join(', ')}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span>
                    First Action:{' '}
                    <strong className="text-foreground">
                      {play.steps[0]?.title || 'Immediate Task'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Performance Stats */}
              {play.executionStats && (
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-center">
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      {play.executionStats.totalTriggered}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Triggered</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {Math.round(
                        (play.executionStats.convertedWon /
                          Math.max(1, play.executionStats.completed)) *
                          100
                      )}
                      %
                    </div>
                    <div className="text-[10px] text-muted-foreground">Win Rate</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      {play.executionStats.avgDurationHours}h
                    </div>
                    <div className="text-[10px] text-muted-foreground">Avg Time</div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectPlayForBuilder(play)}
                  className="flex-1 h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform"
                >
                  <Workflow className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Open in Builder
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!play.enabled}
                  onClick={() => {
                    setLaunchingPlay(play);
                    setEntityName('');
                  }}
                  className="h-10 rounded-xl text-xs font-semibold px-4 min-h-[44px] active:scale-[0.97] transition-transform"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  Launch
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Launch Play Dialog */}
      <Dialog open={!!launchingPlay} onOpenChange={(open) => !open && setLaunchingPlay(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Launch {launchingPlay?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manually start this sales play on an active deal or prospect. Action steps will be placed into your priority queue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Deal or Company Name
              </label>
              <Input
                placeholder="e.g., Acme Cloud Migration"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                className="h-11 rounded-xl text-sm min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Deal Value ($)
              </label>
              <Input
                type="number"
                value={entityValue}
                onChange={(e) => setEntityValue(e.target.value)}
                className="h-11 rounded-xl text-sm min-h-[44px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLaunchingPlay(null)}
              className="h-11 rounded-xl text-xs font-semibold min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting || !entityName.trim()}
              onClick={handleLaunchPlay}
              className="h-11 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform"
            >
              {isSubmitting ? 'Launching...' : 'Confirm & Launch Play'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
