'use client';

/**
 * @fileoverview Leaderboard & Visibility Policy Tab for Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 8.3 & Section 22 Leaderboard Governance:
 * - 4 visibility modes: Organization-wide, Team-only, Private (Self-only), or Disabled.
 * - Peer Anonymization toggle (protects rep psychological safety while preserving gamification).
 * - Primary ranking metric selection (Composite Index, Total Points, Target Attainment).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Controls enforce >= 44px touch envelopes.
 * - Micro-interactions use active:scale-[0.97].
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Trophy,
  Users,
  EyeOff,
  UserCheck,
  Award,
  Target,
  BarChart2,
  Check,
} from 'lucide-react';
import type {
  LeaderboardPolicy,
  LeaderboardMode,
  LeaderboardRankingMetric,
} from '@/lib/policy-studio/types';

interface LeaderboardPolicyTabProps {
  leaderboardPolicy: LeaderboardPolicy;
  onChange: (updated: LeaderboardPolicy) => void;
}

interface ModeCardOption {
  mode: LeaderboardMode;
  title: string;
  description: string;
  icon: React.ElementType;
}

const MODE_OPTIONS: ModeCardOption[] = [
  {
    mode: 'organization',
    title: 'Organization-Wide',
    description: 'Full public standings across all teams and branches in the workspace.',
    icon: Trophy,
  },
  {
    mode: 'team',
    title: 'Team-Only',
    description: 'Sales representatives only see colleagues in their assigned sales team.',
    icon: Users,
  },
  {
    mode: 'private',
    title: 'Private (Self-Only)',
    description: 'Representatives only view their own score and rank; peer data is hidden.',
    icon: UserCheck,
  },
  {
    mode: 'disabled',
    title: 'Disabled',
    description: 'Leaderboard is completely turned off workspace-wide for all non-admins.',
    icon: EyeOff,
  },
];

const METRIC_OPTIONS: Array<{
  metric: LeaderboardRankingMetric;
  label: string;
  desc: string;
  icon: React.ElementType;
}> = [
  {
    metric: 'compositeIndex',
    label: 'Composite Performance Index (0–100)',
    desc: 'Holistic multi-dimensional evaluation factoring in effort, quality, and outcomes.',
    icon: Award,
  },
  {
    metric: 'totalPoints',
    label: 'Total Effort Points Earned',
    desc: 'Pure points currency accumulated from completed CRM activities and tasks.',
    icon: BarChart2,
  },
  {
    metric: 'targetAttainment',
    label: 'Quota Attainment Percent (%)',
    desc: 'Progress toward individual and team commercial revenue targets.',
    icon: Target,
  },
];

export function LeaderboardPolicyTab({
  leaderboardPolicy,
  onChange,
}: LeaderboardPolicyTabProps) {
  const handleSelectMode = (mode: LeaderboardMode) => {
    onChange({
      ...leaderboardPolicy,
      mode,
    });
  };

  const handleSelectMetric = (rankingMetric: LeaderboardRankingMetric) => {
    onChange({
      ...leaderboardPolicy,
      rankingMetric,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl text-left">
      {/* 1. Leaderboard Visibility Mode */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            Leaderboard Visibility Mode
          </h3>
          <p className="text-xs text-muted-foreground">
            Control the degree of transparency and peer comparison permitted across the sales workforce.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {MODE_OPTIONS.map((opt) => {
            const isSelected = leaderboardPolicy.mode === opt.mode;
            const Icon = opt.icon;

            return (
              <div
                key={opt.mode}
                onClick={() => handleSelectMode(opt.mode)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 active:scale-[0.97] flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'bg-card/60 hover:border-primary/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-foreground">{opt.title}</span>
                  </div>

                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {opt.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Peer Anonymization */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-sm font-bold text-foreground">
              Peer Anonymization
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              When enabled, representatives see their own rank and full name, but peer rows appear as generic identifiers (e.g. &quot;Representative A&quot;, &quot;Representative B&quot;) to avoid unconstructive comparison. Managers retain full visibility.
            </p>
          </div>

          <Switch
            checked={leaderboardPolicy.anonymizePeers}
            onCheckedChange={(checked) =>
              onChange({
                ...leaderboardPolicy,
                anonymizePeers: checked,
              })
            }
            className="data-[state=checked]:bg-emerald-500 shrink-0"
          />
        </div>
      </Card>

      {/* 3. Primary Ranking Metric */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            Primary Standings Ranking Metric
          </h3>
          <p className="text-xs text-muted-foreground">
            Determines how representatives are sorted on the leaderboard table.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          {METRIC_OPTIONS.map((m) => {
            const isSelected = leaderboardPolicy.rankingMetric === m.metric;
            const Icon = m.icon;

            return (
              <div
                key={m.metric}
                onClick={() => handleSelectMetric(m.metric)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 active:scale-[0.97] flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'bg-card/60 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                  </div>
                </div>

                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40'
                  }`}
                >
                  {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
