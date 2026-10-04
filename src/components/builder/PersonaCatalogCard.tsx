'use client';

/**
 * @fileOverview Persona Catalog Card Component (Phase 8 Milestone 5 Task 4)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 7: Mobile-first touch targets >= 44px with Emil Kowalski mechanical feel.
 * - Rule 12: Standardized risk level badge indicators.
 * - Rule 65: Canary Releases & Staging Draft status display.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  UserSearch,
  Target,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Edit3,
  FlaskConical,
  GitCompare,
  UploadCloud,
  Layers,
} from 'lucide-react';
import type { CustomAgentPersona } from '@/platform/ui/builder/agent-builder-types';

export interface PersonaCatalogCardProps {
  persona: CustomAgentPersona;
  onEdit: (persona: CustomAgentPersona) => void;
  onTest: (persona: CustomAgentPersona) => void;
  onViewDiff: (persona: CustomAgentPersona) => void;
  onPublish: (persona: CustomAgentPersona) => void;
}

function renderAvatarIcon(iconName: string) {
  const iconProps = { className: 'h-6 w-6 text-primary' };
  switch (iconName.toLowerCase()) {
    case 'usersearch':
      return <UserSearch {...iconProps} />;
    case 'target':
      return <Target {...iconProps} />;
    case 'trendingup':
      return <TrendingUp {...iconProps} />;
    case 'shieldcheck':
      return <ShieldCheck {...iconProps} />;
    case 'sparkles':
      return <Sparkles {...iconProps} />;
    default:
      return <Bot {...iconProps} />;
  }
}

function getRiskBadge(riskLevel: string) {
  switch (riskLevel) {
    case 'L0_READ':
      return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">L0 Read-Only</Badge>;
    case 'L1_INTERNAL_DRAFT':
      return <Badge variant="secondary" className="bg-sky-500/10 text-sky-500 border-sky-500/20 text-xs">L1 Draft Mutation</Badge>;
    case 'L2_STATE_MUTATION':
      return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">L2 State Mutation</Badge>;
    case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
      return <Badge variant="secondary" className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-xs">L3 External/Finance</Badge>;
    case 'L4_PRIVILEGED_DESTRUCTIVE':
      return <Badge variant="secondary" className="bg-red-700/10 text-red-600 border-red-700/20 text-xs">L4 Privileged</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{riskLevel}</Badge>;
  }
}

export function PersonaCatalogCard({
  persona,
  onEdit,
  onTest,
  onViewDiff,
  onPublish,
}: PersonaCatalogCardProps) {
  const isDraft = persona.status === 'draft';

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              {renderAvatarIcon(persona.identity.avatarIcon || 'Bot')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base tracking-tight text-foreground">
                  {persona.identity.name}
                </h3>
                {persona.isBuiltIn && (
                  <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 bg-muted/40">
                    System
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium">{persona.identity.role}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <Badge
                variant={isDraft ? 'outline' : 'secondary'}
                className={
                  isDraft
                    ? 'border-amber-500/40 text-amber-500 bg-amber-500/5 text-xs'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs'
                }
              >
                {isDraft ? 'Draft' : 'Published'}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">v{persona.version}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
          {persona.identity.description}
        </p>

        {/* Metadata Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          {getRiskBadge(persona.governance.maxAutonomousRiskLevel)}
          <Badge variant="outline" className="text-[11px] gap-1 bg-muted/20">
            <Layers className="h-3 w-3 text-muted-foreground" />
            {persona.capabilities.allowedDomains.length} domains
          </Badge>
          <Badge variant="outline" className="text-[11px] font-mono bg-muted/20">
            {persona.modelsAndBudgets.primaryModelTier} tier
          </Badge>
          {persona.governance.delegationDepthCeiling > 1 && (
            <Badge variant="outline" className="text-[11px] bg-muted/20">
              depth ≤ {persona.governance.delegationDepthCeiling}
            </Badge>
          )}
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl flex-1 min-h-[44px] active:scale-[0.97] text-xs font-medium"
          onClick={() => onEdit(persona)}
        >
          <Edit3 className="mr-1.5 h-3.5 w-3.5" />
          Edit in Studio
        </Button>

        <Button
          size="sm"
          variant="secondary"
          className="rounded-xl flex-1 min-h-[44px] active:scale-[0.97] text-xs font-medium bg-secondary/80 hover:bg-secondary"
          onClick={() => onTest(persona)}
        >
          <FlaskConical className="mr-1.5 h-3.5 w-3.5 text-primary" />
          Test in Lab
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl h-[44px] w-[44px] p-0 active:scale-[0.97] text-muted-foreground hover:text-foreground"
          title="Compare Version Diff"
          onClick={() => onViewDiff(persona)}
        >
          <GitCompare className="h-4 w-4" />
        </Button>

        {!persona.isBuiltIn && isDraft && (
          <Button
            size="sm"
            variant="default"
            className="rounded-xl min-h-[44px] active:scale-[0.97] text-xs font-medium"
            onClick={() => onPublish(persona)}
          >
            <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
            Publish
          </Button>
        )}
      </div>
    </div>
  );
}
