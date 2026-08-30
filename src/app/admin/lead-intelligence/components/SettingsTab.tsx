'use client';

/**
 * Enterprise Governance & Settings Studio (Lead Intelligence 2.0 - Phase 14)
 * UI Spec Sections 56-60: "Enterprise Governance & Provider Management"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 10-Dimension enterprise governance console: Discovery, Enrichment, Verification, Scoring, Providers, Credits, Territory, Compliance, Monitors.
 * 2. Provider Health & Diagnostics with live circuit breaker and latency meters.
 * 3. Mobile-responsive with touch targets >= 44px.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Download, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Chrome, 
  ShieldCheck, 
  Sliders, 
  Activity, 
  MapPin, 
  Coins, 
  Cpu, 
  Clock, 
  RotateCcw,
  Loader2
} from 'lucide-react';
import type { 
  LeadIntelligenceSettings, 
  EnterpriseGovernanceConfig, 
  ProviderHealthRecord,
  ProviderRoutingRule,
  TerritoryRule
} from '@/lib/lead-intelligence/types';
import { 
  getEnterpriseGovernanceConfigAction, 
  saveEnterpriseGovernanceConfigAction, 
  getProviderHealthStatusAction 
} from '@/app/actions/lead-intelligence-actions';
import { ProviderHealthStatusCard } from './ProviderHealthStatusCard';
import { ProviderRoutingMatrixModal } from './ProviderRoutingMatrixModal';
import { TerritoryRulesManagerModal } from './TerritoryRulesManagerModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SettingsTabProps {
  settings: LeadIntelligenceSettings;
  setSettings: React.Dispatch<React.SetStateAction<LeadIntelligenceSettings>>;
  activeWorkspaceId: string;
  onSaveSettings: () => void;
  onGenerateToken: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  setSettings,
  activeWorkspaceId,
  onSaveSettings,
  onGenerateToken,
}) => {
  const { toast } = useToast();
  const [showPlacesKey, setShowPlacesKey] = useState(false);
  const [showBuiltwithKey, setShowBuiltwithKey] = useState(false);
  const [showHunterKey, setShowHunterKey] = useState(false);
  const [showApolloKey, setShowApolloKey] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Enterprise Governance State
  const [govConfig, setGovConfig] = useState<EnterpriseGovernanceConfig | null>(null);
  const [providers, setProviders] = useState<ProviderHealthRecord[]>([]);
  const [isRoutingModalOpen, setIsRoutingModalOpen] = useState(false);
  const [isTerritoryModalOpen, setIsTerritoryModalOpen] = useState(false);
  const [isSavingGov, setIsSavingGov] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    const loadData = async () => {
      try {
        const [govRes, provRes] = await Promise.all([
          getEnterpriseGovernanceConfigAction(activeWorkspaceId),
          getProviderHealthStatusAction(activeWorkspaceId)
        ]);

        if (govRes.success && govRes.config) {
          setGovConfig(govRes.config);
        }
        if (provRes.success && provRes.providers) {
          setProviders(provRes.providers);
        }
      } catch {
        console.error('Failed to load enterprise settings');
      }
    };

    loadData();
  }, [activeWorkspaceId]);

  const handleCopyToken = () => {
    if (settings.chromeExtensionToken) {
      navigator.clipboard.writeText(settings.chromeExtensionToken);
      setCopiedToken(true);
      toast({ title: 'Copied ✓', description: 'Extension token copied to clipboard!' });
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleSaveGovConfig = async () => {
    if (!govConfig || !activeWorkspaceId) return;
    try {
      setIsSavingGov(true);
      const res = await saveEnterpriseGovernanceConfigAction(activeWorkspaceId, govConfig);
      if (res.success) {
        toast({ title: 'Enterprise Governance Saved ✓', description: 'Updated rules applied across workspace.' });
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error saving governance settings' });
    } finally {
      setIsSavingGov(false);
    }
  };

  const handleSaveRoutingRules = async (rules: ProviderRoutingRule[]) => {
    if (!govConfig) return;
    const updated = {
      ...govConfig,
      enrichment: { ...govConfig.enrichment, routingRules: rules }
    };
    setGovConfig(updated);
    await saveEnterpriseGovernanceConfigAction(activeWorkspaceId, updated);
    setIsRoutingModalOpen(false);
    toast({ title: 'Provider Routing Rules Saved ✓' });
  };

  const handleSaveTerritoryRules = async (rules: TerritoryRule[]) => {
    if (!govConfig) return;
    const updated = { ...govConfig, territoryRules: rules };
    setGovConfig(updated);
    await saveEnterpriseGovernanceConfigAction(activeWorkspaceId, updated);
    setIsTerritoryModalOpen(false);
    toast({ title: 'Territory Rules Saved ✓' });
  };

  return (
    <div className="space-y-6 text-xs text-left">
      {/* 1. Provider Health & Diagnostics Card Suite (UI Spec Section 57) */}
      <ProviderHealthStatusCard
        providers={providers}
        onOpenRouting={() => setIsRoutingModalOpen(true)}
      />

      {/* 2. Enterprise Governance 10-Dimension Console (UI Spec Section 56) */}
      {govConfig && (
        <Card className="bg-card border border-border/70 shadow-sm rounded-2xl">
          <CardHeader className="p-6 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Sliders className="h-5 w-5 text-primary" /> Enterprise Governance Controls
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Configure discovery radius, SMTP strictness, monthly credit caps, and compliance policies.
                </CardDescription>
              </div>
              <Button
                onClick={handleSaveGovConfig}
                disabled={isSavingGov}
                className="h-8 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl active:scale-[0.97] self-start sm:self-center"
              >
                {isSavingGov ? 'Saving...' : 'Save Governance'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Grid of Dimension Groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Group A: Discovery & Rate Limits */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
                <span className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Discovery & Geo Limits
                </span>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Default Radius (km)</Label>
                    <Input
                      type="number"
                      value={govConfig.discovery.defaultRadiusKm}
                      onChange={(e) => setGovConfig({
                        ...govConfig,
                        discovery: { ...govConfig.discovery, defaultRadiusKm: Number(e.target.value) || 25 }
                      })}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Default Target City</Label>
                    <Input
                      value={govConfig.discovery.defaultCity}
                      onChange={(e) => setGovConfig({
                        ...govConfig,
                        discovery: { ...govConfig.discovery, defaultCity: e.target.value }
                      })}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Group B: Verification & SMTP Strictness */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
                <span className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Verification & Deliverability
                </span>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground cursor-pointer">Block Disposable Domains</Label>
                    <Switch
                      checked={govConfig.verification.enforceDisposableBlock}
                      onCheckedChange={(c) => setGovConfig({
                        ...govConfig,
                        verification: { ...govConfig.verification, enforceDisposableBlock: c }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Catch-All Risk Threshold (%)</Label>
                    <Input
                      type="number"
                      value={govConfig.verification.catchAllRiskThreshold}
                      onChange={(e) => setGovConfig({
                        ...govConfig,
                        verification: { ...govConfig.verification, catchAllRiskThreshold: Number(e.target.value) || 65 }
                      })}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Group C: Credits & Quotas */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
                <span className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Credits & Budget Caps
                </span>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Monthly Budget (Credits)</Label>
                    <Input
                      type="number"
                      value={govConfig.credits.monthlyBudget}
                      onChange={(e) => setGovConfig({
                        ...govConfig,
                        credits: { ...govConfig.credits, monthlyBudget: Number(e.target.value) || 10000 }
                      })}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Label className="text-[11px] text-muted-foreground cursor-pointer">Enforce Hard Cap</Label>
                    <Switch
                      checked={govConfig.credits.enforceHardCap}
                      onCheckedChange={(c) => setGovConfig({
                        ...govConfig,
                        credits: { ...govConfig.credits, enforceHardCap: c }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-4 bg-muted/20 border border-border/70 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-bold block text-foreground">Territory & Rep Auto-Routing</span>
                <span className="text-[11px] text-muted-foreground">
                  {govConfig.territoryRules.length} regional routing rules active across Greater Accra & Ashanti.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTerritoryModalOpen(true)}
                className="h-8 px-4 text-xs font-semibold rounded-xl active:scale-[0.97]"
              >
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Manage Territory Rules
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. API Keys & Credentials Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border border-border/70 shadow-sm rounded-2xl">
          <CardHeader className="p-6 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <KeyRound className="h-5 w-5 text-primary" /> Credentials & Data Integration Keys
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure your API credentials to connect Google Places, BuiltWith technographics, and Hunter.io lookups.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Google Places API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="google-key" className="font-semibold text-xs text-foreground">Google Places API Key</Label>
              <div className="relative flex items-center">
                <Input 
                  id="google-key" 
                  type={showPlacesKey ? 'text' : 'password'}
                  placeholder="AIzaSy..." 
                  value={settings.googlePlacesApiKey || ''} 
                  onChange={(e) => setSettings(prev => ({ ...prev, googlePlacesApiKey: e.target.value }))}
                  className="h-10 pr-10 text-xs bg-background border-border/80 rounded-xl font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPlacesKey(!showPlacesKey)}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPlacesKey ? 'Hide Google Places Key' : 'Show Google Places Key'}
                >
                  {showPlacesKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* BuiltWith API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="builtwith-key" className="font-semibold text-xs text-foreground">BuiltWith API Key</Label>
              <div className="relative flex items-center">
                <Input 
                  id="builtwith-key" 
                  type={showBuiltwithKey ? 'text' : 'password'}
                  placeholder="e.g. 5d5a8..." 
                  value={settings.builtwithApiKey || ''} 
                  onChange={(e) => setSettings(prev => ({ ...prev, builtwithApiKey: e.target.value }))}
                  className="h-10 pr-10 text-xs bg-background border-border/80 rounded-xl font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowBuiltwithKey(!showBuiltwithKey)}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                  aria-label={showBuiltwithKey ? 'Hide BuiltWith Key' : 'Show BuiltWith Key'}
                >
                  {showBuiltwithKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Hunter.io API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="hunter-key" className="font-semibold text-xs text-foreground">Hunter.io API Key</Label>
              <div className="relative flex items-center">
                <Input 
                  id="hunter-key" 
                  type={showHunterKey ? 'text' : 'password'}
                  placeholder="e.g. key_66a7b..." 
                  value={settings.hunterApiKey || ''} 
                  onChange={(e) => setSettings(prev => ({ ...prev, hunterApiKey: e.target.value }))}
                  className="h-10 pr-10 text-xs bg-background border-border/80 rounded-xl font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowHunterKey(!showHunterKey)}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                  aria-label={showHunterKey ? 'Hide Hunter Key' : 'Show Hunter Key'}
                >
                  {showHunterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Apollo.io API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="apollo-key" className="font-semibold text-xs text-foreground">Apollo.io API Key (Waterfall Email/Firmographics)</Label>
              <div className="relative flex items-center">
                <Input 
                  id="apollo-key" 
                  type={showApolloKey ? 'text' : 'password'}
                  placeholder="e.g. apollo_live_..." 
                  value={settings.apolloApiKey || ''} 
                  onChange={(e) => setSettings(prev => ({ ...prev, apolloApiKey: e.target.value }))}
                  className="h-10 pr-10 text-xs bg-background border-border/80 rounded-xl font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApolloKey(!showApolloKey)}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                  aria-label={showApolloKey ? 'Hide Apollo Key' : 'Show Apollo Key'}
                >
                  {showApolloKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button 
                onClick={onSaveSettings} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-10 px-6 rounded-xl active:scale-[0.97]"
              >
                Save Integration Keys
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Chrome Extension Sideload Installer */}
        <Card className="bg-card border border-border/70 shadow-sm rounded-2xl">
          <CardHeader className="p-6 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Chrome className="h-5 w-5 text-sky-400" /> Chrome Extension Sideload Installer
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Integrate SmartSapp Lead Intelligence directly into your Chrome browser toolbar.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <span className="font-semibold block text-xs text-foreground">Workspace Extension Token</span>
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={settings.chromeExtensionToken || 'No token generated'} 
                  className="h-10 text-xs bg-background border-border/80 rounded-xl font-mono"
                />
                {settings.chromeExtensionToken && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyToken}
                    className="h-10 px-3 border-border rounded-xl active:scale-[0.97]"
                    title="Copy token"
                  >
                    {copiedToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
                <Button 
                  onClick={onGenerateToken} 
                  variant="outline" 
                  className="h-10 px-4 text-xs font-semibold border-border rounded-xl active:scale-[0.97]"
                >
                  Generate
                </Button>
              </div>
            </div>

            {/* Download section */}
            <div className="p-4 bg-muted/20 border border-border/70 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold block text-foreground">Download Extension Bundle</span>
                <span className="text-[11px] text-muted-foreground">Pre-configured ZIP archive with your workspace credentials.</span>
              </div>
              <Button 
                asChild
                disabled={!settings.chromeExtensionToken}
                className="h-9 px-4 bg-primary text-primary-foreground font-semibold text-xs rounded-xl active:scale-[0.97] shrink-0"
              >
                <a href={`/api/lead-intelligence/extension/download?workspaceId=${activeWorkspaceId}&token=${settings.chromeExtensionToken}`} download>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  ZIP Archive
                </a>
              </Button>
            </div>

            <div className="space-y-2 border-t border-border/40 pt-4 text-muted-foreground">
              <span className="font-semibold block text-xs text-foreground">How to Install in Chrome</span>
              <ol className="list-decimal pl-4 space-y-1 text-xs">
                <li>Download the ZIP archive above and extract it locally.</li>
                <li>Navigate to <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-foreground">chrome://extensions</code> in Chrome.</li>
                <li>Enable <strong>Developer Mode</strong> in the top-right corner.</li>
                <li>Click <strong>Load Unpacked</strong> and select the extracted folder.</li>
                <li>Open any business or school website to run live lead intelligence audits!</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {govConfig && (
        <>
          <ProviderRoutingMatrixModal
            isOpen={isRoutingModalOpen}
            onClose={() => setIsRoutingModalOpen(false)}
            routingRules={govConfig.enrichment.routingRules}
            onSaveRouting={handleSaveRoutingRules}
          />

          <TerritoryRulesManagerModal
            isOpen={isTerritoryModalOpen}
            onClose={() => setIsTerritoryModalOpen(false)}
            rules={govConfig.territoryRules}
            onSaveRules={handleSaveTerritoryRules}
          />
        </>
      )}
    </div>
  );
};
export default SettingsTab;
