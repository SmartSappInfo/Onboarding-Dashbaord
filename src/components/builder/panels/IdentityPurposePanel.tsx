'use client';

/**
 * @fileOverview Panel 1: Identity & Purpose Configuration (Phase 8 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 7: Accessible touch targets >= 44px.
 * - IdentityPurposeConfig form controls with live validation feedback.
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  Bot,
  UserSearch,
  Target,
  TrendingUp,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { IdentityPurposeConfig } from '@/platform/ui/builder/agent-builder-types';

export interface IdentityPurposePanelProps {
  value: IdentityPurposeConfig;
  onChange: (value: IdentityPurposeConfig) => void;
  isBuiltIn?: boolean;
}

const AVAILABLE_AVATARS = [
  { name: 'Bot', icon: Bot },
  { name: 'UserSearch', icon: UserSearch },
  { name: 'Target', icon: Target },
  { name: 'TrendingUp', icon: TrendingUp },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'ShieldCheck', icon: ShieldCheck },
];

export function IdentityPurposePanel({
  value,
  onChange,
  isBuiltIn = false,
}: IdentityPurposePanelProps) {
  const handleChange = <K extends keyof IdentityPurposeConfig>(
    field: K,
    val: IdentityPurposeConfig[K]
  ) => {
    onChange({
      ...value,
      [field]: val,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
            Agent Persona Name <span className="text-destructive">*</span>
          </label>
          <Input
            value={value.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Lead Qualification Specialist"
            disabled={isBuiltIn}
            className="rounded-xl min-h-[44px] text-xs font-medium"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
            Unique Slug ID <span className="text-destructive">*</span>
          </label>
          <Input
            value={value.slug}
            onChange={(e) =>
              handleChange(
                'slug',
                e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
              )
            }
            placeholder="e.g. lead_qualification_specialist"
            disabled={isBuiltIn}
            className="rounded-xl min-h-[44px] text-xs font-mono"
          />
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Lowercase alphanumeric & underscores only.
          </span>
        </div>
      </div>

      {/* Role Title */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
          Role & Specialty <span className="text-destructive">*</span>
        </label>
        <Input
          value={value.role}
          onChange={(e) => handleChange('role', e.target.value)}
          placeholder="e.g. Autonomous Outbound Sales Development"
          disabled={isBuiltIn}
          className="rounded-xl min-h-[44px] text-xs"
        />
      </div>

      {/* Avatar Icon Selector */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
          Persona Avatar Icon
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_AVATARS.map((avatar) => {
            const Icon = avatar.icon;
            const isSelected = value.avatarIcon === avatar.name;
            return (
              <button
                key={avatar.name}
                type="button"
                disabled={isBuiltIn}
                onClick={() => handleChange('avatarIcon', avatar.name)}
                className={`flex items-center gap-2 rounded-xl border p-2.5 min-h-[44px] transition-all text-xs active:scale-[0.97] ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border/70 bg-card hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{avatar.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
          Description & Mission Scope <span className="text-destructive">*</span>
        </label>
        <textarea
          value={value.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe what this agent is designed to accomplish, who it serves, and its boundaries..."
          rows={3}
          disabled={isBuiltIn}
          className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        />
      </div>

      {/* System Prompt Snippet */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            System Prompt Directive <span className="text-destructive">*</span>
          </label>
          <span className="font-mono text-[11px] text-muted-foreground">
            {value.systemPromptSnippet.length} / 4000
          </span>
        </div>
        <textarea
          value={value.systemPromptSnippet}
          onChange={(e) => handleChange('systemPromptSnippet', e.target.value)}
          placeholder="You are the SmartSapp Lead Qualification Agent. You analyze incoming leads..."
          rows={6}
          disabled={isBuiltIn}
          className="w-full font-mono text-xs rounded-xl border border-input bg-background/50 px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y leading-relaxed"
        />
      </div>
    </div>
  );
}
