'use client';

/**
 * Intelligence + CRM Unified Activity Timeline (Lead Intelligence 2.0 - Phase 9)
 * UI Spec Section 39: "Phase 9 UX — Intelligence + CRM Unified Timeline"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Single coherent customer history combining intelligence, signals, AI briefs, and CRM deal activities.
 * 2. Polymorphic event rendering with category filtering.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  History, 
  Flame, 
  Sparkles, 
  Globe, 
  Mail, 
  Briefcase, 
  Building2, 
  CheckCircle2, 
  Activity, 
  Phone, 
  Search, 
  Loader2,
  Calendar
} from 'lucide-react';
import type { Prospect, UnifiedActivityItem } from '@/lib/lead-intelligence/types';
import { getUnifiedActivityTimelineAction } from '@/app/actions/lead-intelligence-actions';
import { cn } from '@/lib/utils';

interface UnifiedActivityTimelineProps {
  prospect: Prospect;
  className?: string;
}

export const UnifiedActivityTimeline: React.FC<UnifiedActivityTimelineProps> = ({
  prospect,
  className
}) => {
  const [activities, setActivities] = useState<UnifiedActivityItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getUnifiedActivityTimelineAction(prospect.id, prospect.syncedEntityId, prospect.workspaceId)
      .then((res) => {
        if (isMounted && res.success) {
          setActivities(res.activities);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [prospect.id, prospect.syncedEntityId, prospect.workspaceId]);

  const filteredActivities = activities.filter((act) => {
    const matchesCategory =
      activeCategory === 'all' ||
      (activeCategory === 'intelligence' && (act.source === 'intelligence' || act.source === 'signals')) ||
      (activeCategory === 'signals' && act.source === 'signals') ||
      (activeCategory === 'crm' && (act.source === 'crm' || act.source === 'deals')) ||
      (activeCategory === 'ai' && act.source === 'ai');

    if (!matchesCategory) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      act.title.toLowerCase().includes(q) ||
      act.description.toLowerCase().includes(q) ||
      (act.actorName && act.actorName.toLowerCase().includes(q))
    );
  });

  const getEventIcon = (iconType: UnifiedActivityItem['iconType']) => {
    switch (iconType) {
      case 'flame':
        return <Flame className="h-4 w-4 text-rose-500" />;
      case 'sparkles':
        return <Sparkles className="h-4 w-4 text-sky-500" />;
      case 'globe':
        return <Globe className="h-4 w-4 text-purple-500" />;
      case 'mail':
        return <Mail className="h-4 w-4 text-blue-500" />;
      case 'phone':
        return <Phone className="h-4 w-4 text-emerald-500" />;
      case 'briefcase':
        return <Briefcase className="h-4 w-4 text-amber-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className={cn("p-4 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5">
            <History className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Unified Activity Timeline
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground pt-0.5">
            Single customer chronology combining intelligence, signals, and CRM interactions
          </p>
        </div>

        <Badge variant="outline" className="text-[10px] font-mono font-bold">
          {activities.length} Recorded Event{activities.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All History' },
            { id: 'intelligence', label: 'Intelligence' },
            { id: 'signals', label: '🔥 Signals' },
            { id: 'crm', label: 'CRM & Deals' },
            { id: 'ai', label: 'AI Strategy' }
          ].map((cat) => (
            <Button
              key={cat.id}
              size="sm"
              variant={activeCategory === cat.id ? 'default' : 'ghost'}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "h-7 px-2.5 text-xs font-semibold rounded-lg shrink-0",
                activeCategory === cat.id && "bg-primary text-primary-foreground font-bold shadow-sm"
              )}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search activity chronology..."
            className="pl-8 h-8 text-xs rounded-lg bg-muted/20 border-border/70"
          />
        </div>
      </div>

      {/* Timeline Stream (UI Spec Section 39) */}
      <div className="pt-2">
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Assembling customer timeline...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No events match your current filter.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/70">
            {filteredActivities.map((act) => (
              <div key={act.id} className="relative group">
                {/* Node Dot / Icon */}
                <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-card border border-border flex items-center justify-center shadow-xs">
                  {getEventIcon(act.iconType)}
                </div>

                <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h5 className="text-xs font-bold text-foreground">{act.title}</h5>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(act.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                    {act.description}
                  </p>

                  <div className="flex items-center gap-2 pt-0.5">
                    {act.actorName && (
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        By {act.actorName}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4 bg-background">
                      {act.source}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
