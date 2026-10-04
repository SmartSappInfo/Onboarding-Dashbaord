'use client';

/**
 * @fileOverview Relationship Health Meter Module (Phase 8 Milestone 4 Task 4)
 *
 * Implements Module 4 of the Global Context Rail:
 * - Circular score gauge (0-100) with color-coded health bands
 * - Trend vector indicator (improving, stable, declining)
 * - 4-component breakdown signals: Recency, Frequency, Sentiment, Engagement
 * - Explanatory diagnostic factors
 * - Rule 4 (Zero any/any[] strict typing)
 * - Rule 7 (Accessible touch targets >= 44px)
 */

import * as React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Heart,
  Calendar,
  Smile,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RelationshipHealth } from '@/platform/ui/context-rail';

export interface RelationshipHealthModuleProps {
  health: RelationshipHealth;
}

export function RelationshipHealthModule({ health }: RelationshipHealthModuleProps) {
  const getBandConfig = (band: RelationshipHealth['band']) => {
    switch (band) {
      case 'champion':
      case 'excellent':
        return {
          label: 'Champion',
          badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          ringColor: 'text-emerald-500',
        };
      case 'healthy':
      case 'good':
        return {
          label: 'Healthy',
          badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
          ringColor: 'text-blue-500',
        };
      case 'neutral':
      case 'fair':
        return {
          label: 'Neutral',
          badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
          ringColor: 'text-amber-500',
        };
      case 'at_risk':
        return {
          label: 'At Risk',
          badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
          ringColor: 'text-orange-500',
        };
      case 'critical':
        return {
          label: 'Critical',
          badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
          ringColor: 'text-rose-500',
        };
      default:
        return {
          label: 'Unknown',
          badgeClass: 'bg-muted text-muted-foreground',
          ringColor: 'text-muted-foreground',
        };
    }
  };

  const getTrendIcon = (trend: RelationshipHealth['trend']) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
      case 'declining':
        return <TrendingDown className="h-3.5 w-3.5 text-rose-500" />;
      case 'stable':
      default:
        return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const bandConfig = getBandConfig(health.band);

  // SVG Circular Gauge parameters
  const radius = 32;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (health.score / 100) * circumference;

  return (
    <div data-testid="context-rail-health-module" className="space-y-3.5">
      {/* Score & Gauge Hero */}
      <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/15">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {health.score}
            </span>
            <span className="text-xs text-muted-foreground font-mono">/ 100</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-xs px-2 py-0.5 font-medium ${bandConfig.badgeClass}`}>
              {bandConfig.label}
            </Badge>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium capitalize">
              {getTrendIcon(health.trend)}
              <span>{health.trend}</span>
            </div>
          </div>
        </div>

        {/* SVG Circular Ring Gauge */}
        <div className="relative h-18 w-18 flex items-center justify-center">
          <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
            <circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={stroke}
              className="text-muted/30"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            <circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset }}
              strokeLinecap="round"
              className={`${bandConfig.ringColor} transition-all duration-700 ease-out`}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className={`h-4 w-4 ${bandConfig.ringColor}`} />
          </div>
        </div>
      </div>

      {/* Signal Breakdown Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-lg border border-border/50 bg-muted/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Recency
            </span>
            <span className="font-mono font-medium text-foreground">{health.signals.recencyScore}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${health.signals.recencyScore}%` }}
            />
          </div>
        </div>

        <div className="p-2.5 rounded-lg border border-border/50 bg-muted/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" /> Frequency
            </span>
            <span className="font-mono font-medium text-foreground">{health.signals.activityFrequencyScore}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${health.signals.activityFrequencyScore}%` }}
            />
          </div>
        </div>

        <div className="p-2.5 rounded-lg border border-border/50 bg-muted/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Smile className="h-3 w-3" /> Sentiment
            </span>
            <span className="font-mono font-medium text-foreground">{health.signals.sentimentScore}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${health.signals.sentimentScore}%` }}
            />
          </div>
        </div>

        <div className="p-2.5 rounded-lg border border-border/50 bg-muted/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> Depth
            </span>
            <span className="font-mono font-medium text-foreground">{health.signals.engagementDepthScore}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${health.signals.engagementDepthScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Diagnostic Factors */}
      {health.factors.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="text-[11px] font-medium text-muted-foreground">Key Drivers:</div>
          <ul className="space-y-1">
            {health.factors.map((factor, idx) => (
              <li
                key={idx}
                className="text-[11px] text-foreground/80 flex items-start gap-1.5 leading-tight"
              >
                <span className="text-primary font-bold mt-0.5">•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
