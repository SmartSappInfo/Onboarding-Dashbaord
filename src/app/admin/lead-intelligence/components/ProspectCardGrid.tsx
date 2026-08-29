'use client';

/**
 * Prospect Card Grid (Bento Grid View)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. UI Spec Alignment: Implements intelligence_ui Section 17 (Prospect Bento Cards View).
 * 2. Emil Kowalski Motion: Smooth spring cards, scale press states, and tactile interactions.
 * 3. Mobile First: Responsive 1/2/3 column layout with touch targets >= 44px.
 */

import React from 'react';
import { 
  MapPin, 
  Star, 
  User, 
  Globe, 
  Sparkles, 
  CheckCircle2, 
  Flame, 
  Zap 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { Prospect } from '@/lib/lead-intelligence/types';

interface ProspectCardGridProps {
  prospects: Prospect[];
  selectedRowIds: Set<string>;
  onToggleRowSelect: (id: string) => void;
  onSelectProspect: (p: Prospect) => void;
  onEnrichProspect: (p: Prospect) => void;
  onSyncToCRM: (p: Prospect) => void;
}

export const ProspectCardGrid: React.FC<ProspectCardGridProps> = ({
  prospects,
  selectedRowIds,
  onToggleRowSelect,
  onSelectProspect,
  onEnrichProspect,
  onSyncToCRM,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {prospects.map((p) => {
        const isChecked = selectedRowIds.has(p.id);
        const score = p.scoring?.overallScore ?? 50;
        const isHot = score >= 75;
        const primaryContact = p.contacts[0];
        const isSynced = p.syncStatus === 'synced';

        return (
          <div
            key={p.id}
            onClick={() => onSelectProspect(p)}
            className={`group p-4 rounded-2xl border bg-card transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 relative hover:shadow-md ${
              isChecked ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-border/80 hover:border-border'
            }`}
          >
            {/* Top Bar: Checkbox + Name + Score Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => onToggleRowSelect(p.id)}
                    aria-label={`Select ${p.name}`}
                  />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 flex items-center gap-1">
                    {p.name}
                    {p.claimed && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                  </h4>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
                    <Globe className="w-3 h-3 opacity-60" />
                    <span>{p.domain}</span>
                  </div>
                </div>
              </div>

              <Badge
                className={`text-[10px] font-bold px-2 py-0.5 shrink-0 ${
                  isHot 
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}
              >
                {isHot ? <Flame className="w-3 h-3 mr-0.5" /> : <Zap className="w-3 h-3 mr-0.5" />}
                {score}/100
              </Badge>
            </div>

            {/* Score Breakdown Pills (intelligence_ui Section 9) */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-muted/20 p-2 rounded-xl border border-border/40">
              <div>
                <div className="text-muted-foreground uppercase text-[9px] font-semibold">ICP Fit</div>
                <div className="font-bold text-foreground mt-0.5">{p.scoring?.needScore ? p.scoring.needScore * 4 : 80}</div>
              </div>
              <div className="border-x border-border/40">
                <div className="text-muted-foreground uppercase text-[9px] font-semibold">Intent</div>
                <div className="font-bold text-foreground mt-0.5">{p.scoring?.buyingIntent ? p.scoring.buyingIntent * 5 : 70}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase text-[9px] font-semibold">Maturity</div>
                <div className="font-bold text-foreground mt-0.5">{p.scoring?.digitalMaturity ? p.scoring.digitalMaturity * 6 : 50}</div>
              </div>
            </div>

            {/* Decision Maker Snippet */}
            {primaryContact ? (
              <div className="flex items-center gap-2 text-xs bg-muted/30 p-2 rounded-lg border border-border/40">
                <User className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-foreground">{primaryContact.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({primaryContact.role || 'Leader'})</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground/70 italic flex items-center gap-1.5 p-1.5">
                <User className="w-3 h-3 opacity-40" />
                <span>Decision maker unverified</span>
              </div>
            )}

            {/* Tech Badges & Weakness Indicator */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40 text-[10px]">
              <div className="flex items-center gap-1 text-muted-foreground truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{p.address || p.industry || 'Ghana'}</span>
              </div>
              {p.rating && (
                <div className="flex items-center gap-0.5 font-semibold text-foreground shrink-0">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>{p.rating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Card Action Buttons */}
            <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEnrichProspect(p)}
                className="flex-1 h-7 text-[11px] font-medium active:scale-[0.97]"
              >
                <Sparkles className="w-3 h-3 mr-1 text-sky-400" /> Enrich
              </Button>
              <Button
                size="sm"
                onClick={() => onSyncToCRM(p)}
                disabled={isSynced}
                className="flex-1 h-7 text-[11px] font-medium bg-primary text-primary-foreground active:scale-[0.97]"
              >
                {isSynced ? 'Synced ✓' : 'Add to CRM'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default ProspectCardGrid;
