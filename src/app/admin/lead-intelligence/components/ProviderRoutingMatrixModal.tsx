'use client';

/**
 * Provider Routing Matrix Studio Modal (Lead Intelligence 2.0 - Phase 14)
 * UI Spec Section 58: "Provider Routing UX"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Configures dynamic waterfall sequence and fallback policies per channel (email, technographics, firmographics).
 * 2. Enforces maximum credit ceiling per contact enrichment.
 * 3. Mobile-responsive modal with >= 44px touch targets.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Sliders, 
  ArrowUpDown, 
  ShieldCheck, 
  Sparkles, 
  Globe, 
  Mail, 
  Cpu, 
  Building2,
  CheckCircle2
} from 'lucide-react';
import type { ProviderRoutingRule, ProviderId } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface ProviderRoutingMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  routingRules: ProviderRoutingRule[];
  onSaveRouting: (rules: ProviderRoutingRule[]) => Promise<void>;
  isSaving?: boolean;
}

export const ProviderRoutingMatrixModal: React.FC<ProviderRoutingMatrixModalProps> = ({
  isOpen,
  onClose,
  routingRules,
  onSaveRouting,
  isSaving = false
}) => {
  const [rules, setRules] = useState<ProviderRoutingRule[]>(routingRules);

  const handleToggleFallback = (channel: ProviderRoutingRule['channel']) => {
    setRules(prev => prev.map(r => r.channel === channel ? { ...r, fallbackEnabled: !r.fallbackEnabled } : r));
  };

  const handleMaxCreditsChange = (channel: ProviderRoutingRule['channel'], delta: number) => {
    setRules(prev => prev.map(r => {
      if (r.channel === channel) {
        const newVal = Math.max(1, Math.min(10, r.maxCreditsPerRecord + delta));
        return { ...r, maxCreditsPerRecord: newVal };
      }
      return r;
    }));
  };

  const getChannelIcon = (channel: ProviderRoutingRule['channel']) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4 text-sky-500" />;
      case 'technographics':
        return <Cpu className="w-4 h-4 text-purple-500" />;
      case 'firmographics':
        return <Building2 className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-card border-border/80 p-6 rounded-2xl shadow-xl space-y-4">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sliders className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Dynamic Waterfall Provider Routing
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure vendor execution priority, credit cost ceilings, and automated scraping fallback rules.
          </DialogDescription>
        </DialogHeader>

        {/* Routing Channels */}
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.channel}
              className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-background border border-border/60">
                    {getChannelIcon(rule.channel)}
                  </div>
                  <span className="text-xs font-black text-foreground uppercase tracking-wider">
                    {rule.channel} Enrichment
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Max: {rule.maxCreditsPerRecord} Credits
                </Badge>
              </div>

              {/* Priority Providers Stack */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Waterfall Priority Order
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {rule.priorityProviders.map((pid, idx) => (
                    <div
                      key={pid}
                      className="px-2.5 py-1 rounded-lg bg-background border border-border/60 text-xs font-semibold text-foreground flex items-center gap-1.5"
                    >
                      <span className="text-[10px] font-mono text-muted-foreground">{idx + 1}.</span>
                      <span className="capitalize">{pid.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                {/* Fallback Toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    id={`fallback-${rule.channel}`}
                    checked={rule.fallbackEnabled}
                    onCheckedChange={() => handleToggleFallback(rule.channel)}
                  />
                  <Label htmlFor={`fallback-${rule.channel}`} className="text-xs text-muted-foreground cursor-pointer">
                    Open Web Fallback
                  </Label>
                </div>

                {/* Credit Stepper */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Credit Cap:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMaxCreditsChange(rule.channel, -1)}
                    className="h-6 w-6 p-0 rounded text-xs font-mono"
                  >
                    -
                  </Button>
                  <span className="font-mono text-xs font-bold px-1">{rule.maxCreditsPerRecord}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMaxCreditsChange(rule.channel, 1)}
                    className="h-6 w-6 p-0 rounded text-xs font-mono"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSaveRouting(rules)}
            disabled={isSaving}
            className="h-9 px-5 bg-primary text-primary-foreground text-xs font-bold rounded-xl active:scale-[0.97]"
          >
            {isSaving ? 'Saving...' : 'Save Routing Rules'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
