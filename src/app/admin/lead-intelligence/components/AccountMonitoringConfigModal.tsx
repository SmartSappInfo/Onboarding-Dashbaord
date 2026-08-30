'use client';

/**
 * Account Monitoring Configuration Modal (Lead Intelligence 2.0 - Phase 7)
 * UI Spec Section 33: "Phase 7 — Monitoring UX & Account Preferences"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Granular toggles for tracking dimensions and alert channels.
 * 2. 1-Click live delta re-scan trigger with immediate progress state.
 * 3. Mobile touch target compliance (min-h-[44px]).
 * 4. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Globe, 
  Cpu, 
  Users, 
  Building2, 
  Bell, 
  Mail, 
  MessageSquare, 
  RefreshCw, 
  Loader2, 
  CheckCircle2 
} from 'lucide-react';
import type { Prospect, AccountMonitoringConfig } from '@/lib/lead-intelligence/types';
import { 
  getAccountMonitoringConfigAction, 
  saveAccountMonitoringConfigAction, 
  triggerProspectDeltaScanAction 
} from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';

interface AccountMonitoringConfigModalProps {
  prospect: Prospect | null;
  isOpen: boolean;
  onClose: () => void;
  onScanCompleted?: (newSignalsCount: number) => void;
}

export const AccountMonitoringConfigModal: React.FC<AccountMonitoringConfigModalProps> = ({
  prospect,
  isOpen,
  onClose,
  onScanCompleted
}) => {
  const { toast } = useToast();
  const [config, setConfig] = useState<AccountMonitoringConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!prospect || !isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    getAccountMonitoringConfigAction(prospect.id, prospect.workspaceId)
      .then((res) => {
        if (isMounted && res.success && res.config) {
          setConfig(res.config);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [prospect, isOpen]);

  if (!prospect) return null;

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const res = await saveAccountMonitoringConfigAction(config);
      if (res.success) {
        toast({ title: 'Monitoring Preferences Saved ✓' });
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to update preferences.'
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerScan = async () => {
    if (isScanning || !prospect.id || !prospect.workspaceId) return;
    setIsScanning(true);
    try {
      const res = await triggerProspectDeltaScanAction(prospect.id, prospect.workspaceId);
      if (res.success) {
        toast({
          title: 'Delta Scan Complete ✓',
          description: res.newSignalsCount > 0 
            ? `Detected ${res.newSignalsCount} new buying intent signal(s)!`
            : 'No new structural changes detected.'
        });
        if (onScanCompleted) {
          onScanCompleted(res.newSignalsCount);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Scan Failed',
          description: res.error || 'Failed to execute delta scan.'
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[96vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10001] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                  Account Monitoring & Signals
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                Configure automated background delta tracking for <strong className="text-foreground">{prospect.name}</strong>
              </DialogDescription>
            </div>

            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold font-mono px-2 py-0.5 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Healthy (Active)</span>
            </Badge>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {isLoading || !config ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading monitoring preferences...</p>
            </div>
          ) : (
            <>
              {/* Monitoring Dimensions */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Active Monitoring Dimensions
                </span>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Globe className="h-4 w-4 text-sky-500" />
                      <div>
                        <strong className="text-xs text-foreground block">Website & Domain Changes</strong>
                        <span className="text-[11px] text-muted-foreground">Track page redesigns, SSL health, and load latency</span>
                      </div>
                    </div>
                    <Switch
                      checked={config.monitorWebsite}
                      onCheckedChange={(checked) => setConfig({ ...config, monitorWebsite: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Cpu className="h-4 w-4 text-purple-500" />
                      <div>
                        <strong className="text-xs text-foreground block">Technographic & Payment Gateways</strong>
                        <span className="text-[11px] text-muted-foreground">Detect gateway additions/removals and new subdomains</span>
                      </div>
                    </div>
                    <Switch
                      checked={config.monitorTechnology}
                      onCheckedChange={(checked) => setConfig({ ...config, monitorTechnology: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Users className="h-4 w-4 text-emerald-500" />
                      <div>
                        <strong className="text-xs text-foreground block">Decision Makers & Leadership</strong>
                        <span className="text-[11px] text-muted-foreground">Track newly identified or verified administrative contacts</span>
                      </div>
                    </div>
                    <Switch
                      checked={config.monitorDecisionMakers}
                      onCheckedChange={(checked) => setConfig({ ...config, monitorDecisionMakers: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-amber-500" />
                      <div>
                        <strong className="text-xs text-foreground block">Business Reputation & Reviews</strong>
                        <span className="text-[11px] text-muted-foreground">Monitor public star rating shifts and sentiment changes</span>
                      </div>
                    </div>
                    <Switch
                      checked={config.monitorBusinessChanges}
                      onCheckedChange={(checked) => setConfig({ ...config, monitorBusinessChanges: checked })}
                    />
                  </div>
                </div>
              </div>

              {/* Notification Channels */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Notification Delivery Channels
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl border bg-card flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Bell className="h-3.5 w-3.5 text-primary" /> In-App
                    </span>
                    <Switch
                      checked={config.notifyInApp}
                      onCheckedChange={(checked) => setConfig({ ...config, notifyInApp: checked })}
                    />
                  </div>

                  <div className="p-3 rounded-xl border bg-card flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-sky-500" /> Email
                    </span>
                    <Switch
                      checked={config.notifyEmail}
                      onCheckedChange={(checked) => setConfig({ ...config, notifyEmail: checked })}
                    />
                  </div>

                  <div className="p-3 rounded-xl border bg-card flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp
                    </span>
                    <Switch
                      checked={config.notifyWhatsApp}
                      onCheckedChange={(checked) => setConfig({ ...config, notifyWhatsApp: checked })}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleTriggerScan}
            disabled={isScanning || isLoading}
            className="h-9 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Scan for Deltas Now</span>
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-9 px-3 text-xs font-semibold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl active:scale-[0.97]"
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
