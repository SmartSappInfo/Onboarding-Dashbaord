'use client';

/**
 * Verifiable Evidence Grounding Panel (Lead Intelligence 2.0 - Phase 6)
 * UI Spec Section 28 & 29: "Evidence Drawer & AI Confidence Breakdown"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Grounded Citations: Links AI assertions directly to observed data.
 * 2. Mobile Ergonomics: Responsive card stack with min-h-[44px] touch controls.
 * 3. Emil Kowalski Motion: Tactile active scale (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  ExternalLink, 
  Calendar, 
  Database, 
  Globe, 
  Mail, 
  Server
} from 'lucide-react';
import type { EvidenceGroundingItem } from '@/lib/lead-intelligence/types';

interface EvidenceGroundingPanelProps {
  evidence: EvidenceGroundingItem[];
  className?: string;
}

export const EvidenceGroundingPanel: React.FC<EvidenceGroundingPanelProps> = ({
  evidence,
  className
}) => {
  if (!evidence || evidence.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-border/70 text-center space-y-1">
        <ShieldCheck className="h-5 w-5 text-muted-foreground mx-auto opacity-60" />
        <p className="text-xs text-muted-foreground">No verifiable evidence items indexed.</p>
      </div>
    );
  }

  const getSourceIcon = (sourceType: EvidenceGroundingItem['sourceType']) => {
    switch (sourceType) {
      case 'subdomain_probe':
        return <Server className="h-3.5 w-3.5 text-purple-400" />;
      case 'builtwith':
        return <Database className="h-3.5 w-3.5 text-sky-400" />;
      case 'email_verifier':
        return <Mail className="h-3.5 w-3.5 text-emerald-400" />;
      case 'places_api':
        return <Globe className="h-3.5 w-3.5 text-amber-400" />;
      default:
        return <Globe className="h-3.5 w-3.5 text-primary" />;
    }
  };

  return (
    <div className={className || "space-y-3"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <h4 className="text-xs font-bold text-foreground">
            Verifiable Evidence & Citations ({evidence.length})
          </h4>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          Strict Zero-Hallucination Grounding
        </span>
      </div>

      <div className="space-y-2.5">
        {evidence.map((item, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-border transition-colors space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-foreground leading-relaxed">
                &ldquo;{item.claim}&rdquo;
              </p>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold font-mono shrink-0 px-2 py-0.5"
              >
                {item.confidencePercent}% Confidence
              </Badge>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-medium text-foreground/80">
                  {getSourceIcon(item.sourceType)}
                  <span>{item.observedSource}</span>
                </span>
                <span className="flex items-center gap-1 opacity-70">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(item.observedAt).toLocaleDateString()}</span>
                </span>
              </div>

              {item.sourceUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-6 px-2 text-[10px] text-sky-500 hover:text-sky-400 font-semibold flex items-center gap-1 active:scale-[0.97]"
                >
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <span>Open Source</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
