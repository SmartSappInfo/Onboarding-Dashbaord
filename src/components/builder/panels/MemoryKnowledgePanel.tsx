'use client';

/**
 * @fileOverview Panel 3: Memory & Knowledge Tiers Configuration (Phase 8 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 7: Accessible touch targets >= 44px.
 * - 5-Tier Memory Architecture controls (working, episodic, semantic, relational, procedural).
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  type MemoryKnowledgeConfig,
  type MemoryTier,
  type DecayPreset,
} from '@/platform/ui/builder/agent-builder-types';
import { Brain, Cpu, Database, Network, Clock } from 'lucide-react';

export interface MemoryKnowledgePanelProps {
  value: MemoryKnowledgeConfig;
  onChange: (value: MemoryKnowledgeConfig) => void;
  isBuiltIn?: boolean;
}

const MEMORY_TIERS: Array<{
  id: MemoryTier;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'working', label: 'Working Memory', desc: 'Short-term context window for active conversation', icon: Cpu },
  { id: 'episodic', label: 'Episodic Memory', desc: 'Timestamped timeline of past interactions & actions', icon: Clock },
  { id: 'semantic', label: 'Semantic Memory', desc: 'Vector embeddings of corporate knowledge & docs', icon: Brain },
  { id: 'relational', label: 'Relational Memory', desc: 'Entity graph relationships (Accounts, Contacts, Deals)', icon: Network },
  { id: 'procedural', label: 'Procedural Memory', desc: 'Standard operating procedures and runbook schemas', icon: Database },
];

export function MemoryKnowledgePanel({
  value,
  onChange,
  isBuiltIn = false,
}: MemoryKnowledgePanelProps) {
  const toggleTier = (tier: MemoryTier) => {
    if (isBuiltIn) return;
    const exists = value.enabledTiers.includes(tier);
    let updated: MemoryTier[];
    if (exists) {
      if (value.enabledTiers.length <= 1) return; // Keep at least 1
      updated = value.enabledTiers.filter((t) => t !== tier);
    } else {
      updated = [...value.enabledTiers, tier];
    }
    onChange({
      ...value,
      enabledTiers: updated,
    });
  };

  const handleDecayChange = (preset: DecayPreset) => {
    if (isBuiltIn) return;
    onChange({
      ...value,
      decayPreset: preset,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Enabled Memory Tiers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            5-Tier Cognitive Memory Hierarchy
          </label>
          <Badge variant="outline" className="text-[10px]">
            {value.enabledTiers.length} Enabled
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {MEMORY_TIERS.map((tier) => {
            const isChecked = value.enabledTiers.includes(tier.id);
            const Icon = tier.icon;
            return (
              <button
                key={tier.id}
                type="button"
                disabled={isBuiltIn}
                onClick={() => toggleTier(tier.id)}
                className={`flex items-start gap-3 rounded-xl border p-3 min-h-[44px] text-left transition-all active:scale-[0.97] ${
                  isChecked
                    ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm'
                    : 'border-border/70 bg-card hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border/80 shrink-0 mt-0.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground tracking-tight">{tier.label}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-normal">
                    {tier.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Memory Decay & Retrieval Tuning */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/60 pt-5">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
            Decay Profile
          </label>
          <div className="flex rounded-xl border border-border/80 p-1 bg-muted/20">
            {(['fast', 'standard', 'persistent'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={isBuiltIn}
                onClick={() => handleDecayChange(preset)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-all ${
                  value.decayPreset === preset
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Controls how fast episodic memories fade.
          </span>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
            Retrieval Token Limit
          </label>
          <Input
            type="number"
            min={500}
            max={4000}
            step={100}
            disabled={isBuiltIn}
            value={value.retrievalTokenLimit}
            onChange={(e) =>
              onChange({
                ...value,
                retrievalTokenLimit: Math.max(500, Math.min(4000, parseInt(e.target.value, 10) || 2000)),
              })
            }
            className="rounded-xl min-h-[44px] text-xs font-mono"
          />
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Ceiling for memory retrieval injection (500 - 4000).
          </span>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
            Vector Similarity Threshold
          </label>
          <Input
            type="number"
            min={0.1}
            max={1.0}
            step={0.05}
            disabled={isBuiltIn}
            value={value.searchThreshold}
            onChange={(e) =>
              onChange({
                ...value,
                searchThreshold: Math.max(0.1, Math.min(1.0, parseFloat(e.target.value) || 0.7)),
              })
            }
            className="rounded-xl min-h-[44px] text-xs font-mono"
          />
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Cosine similarity threshold (0.1 - 1.0).
          </span>
        </div>
      </div>
    </div>
  );
}
