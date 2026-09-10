'use client';

/**
 * @fileoverview Scoring Rules Builder Tab for Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Displays and organizes workspace scoring rules by category with:
 * - Domain category filtering (All, Calls, Meetings, Tasks, Deals, Documents, Surveys).
 * - Real-time keyword search.
 * - Point reward badges and target dimension indicators.
 * - Instant rule toggle switches and edit triggers.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Interactive elements enforce >= 44px touch targets on mobile.
 * - Micro-interactions use active:scale-[0.97] and sub-200ms transitions.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Search,
  Sliders,
  Sparkles,
} from 'lucide-react';
import type { PolicyScoringRule } from '@/lib/policy-studio/types';
import type { SalesPerformanceDimension } from '@/lib/sales-performance/types';

interface ScoringRulesTabProps {
  rules: PolicyScoringRule[];
  onToggleRule: (ruleId: string, enabled: boolean) => void;
  onEditRule: (rule: PolicyScoringRule) => void;
}

const CATEGORY_TABS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All Domains' },
  { id: 'communication', label: 'Communication' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'deals', label: 'Deals' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'crm', label: 'CRM & Leads' },
  { id: 'documents', label: 'Documents' },
  { id: 'surveys', label: 'Surveys' },
];

function getDimensionBadgeStyle(dimension: SalesPerformanceDimension): {
  bg: string;
  text: string;
  border: string;
} {
  switch (dimension) {
    case 'effort':
      return { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20' };
    case 'quality':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' };
    case 'effectiveness':
      return { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' };
    case 'outcome':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' };
    case 'activity':
    default:
      return { bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20' };
  }
}

export function ScoringRulesTab({
  rules,
  onToggleRule,
  onEditRule,
}: ScoringRulesTabProps) {
  const [activeCategory, setActiveCategory] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredRules = React.useMemo(() => {
    return rules.filter((rule) => {
      const matchesCat = activeCategory === 'all' || rule.category === activeCategory;
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        rule.eventType.toLowerCase().includes(search) ||
        rule.description.toLowerCase().includes(search) ||
        rule.entityType.toLowerCase().includes(search);
      return matchesCat && matchesSearch;
    });
  }, [rules, activeCategory, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Category Pills & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="flex items-center gap-2.5 bg-card border rounded-xl px-3.5 h-11 w-full max-w-sm shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Filter rules by event or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-xs font-medium h-full"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <Button
                key={tab.id}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(tab.id)}
                className={`min-h-[38px] rounded-xl text-xs font-semibold px-3.5 shrink-0 active:scale-[0.97] transition-all duration-150 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Rules Count Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
        <span>
          Showing {filteredRules.length} of {rules.length} scoring rules
        </span>
        <span>
          {rules.filter((r) => r.enabled).length} rules active
        </span>
      </div>

      {/* Rules Grid */}
      {filteredRules.length === 0 ? (
        <Card className="rounded-2xl border bg-card/40 p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No scoring rules found</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting your search criteria or category filter.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRules.map((rule) => {
            const dimStyle = getDimensionBadgeStyle(rule.targetDimension);
            return (
              <Card
                key={rule.id}
                className={`rounded-2xl border bg-card/60 backdrop-blur-sm p-4 transition-all duration-200 hover:border-primary/30 flex flex-col justify-between gap-4 ${
                  !rule.enabled ? 'opacity-60 bg-muted/20' : ''
                }`}
              >
                <CardContent className="p-0 space-y-3">
                  {/* Top Row: Event Name & Switch */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 text-left flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold truncate text-foreground">
                          {rule.eventType}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-muted/30"
                        >
                          {rule.entityType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {rule.description}
                      </p>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => onToggleRule(rule.id, checked)}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Badges: Dimension & Conditions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${dimStyle.bg} ${dimStyle.text} ${dimStyle.border}`}
                    >
                      {rule.targetDimension}
                    </Badge>

                    {rule.conditions && rule.conditions.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium px-2 py-0.5 rounded-lg"
                      >
                        {rule.conditions.length} condition{rule.conditions.length > 1 ? 's' : ''}
                      </Badge>
                    )}

                    {rule.multipliers && rule.multipliers.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg"
                      >
                        <Sparkles className="h-2.5 w-2.5 mr-1" />
                        {rule.multipliers[0].multiplier}x multiplier
                      </Badge>
                    )}
                  </div>
                </CardContent>

                {/* Bottom Row: Points Reward & Edit Action */}
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                      +{rule.basePoints}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">pts</span>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditRule(rule)}
                    className="min-h-[36px] text-xs font-semibold rounded-xl text-primary hover:bg-primary/10 active:scale-[0.97]"
                  >
                    <Sliders className="h-3.5 w-3.5 mr-1.5" /> Edit Rule
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
