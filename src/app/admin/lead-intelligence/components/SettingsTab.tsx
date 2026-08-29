'use client';

/**
 * Lead Intelligence Settings Tab
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Credential Security: Passwords/API keys support masked visibility toggles.
 * 2. Extension Packager: Download link targets `/api/lead-intelligence/extension/download` with injected workspace token.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, Copy, Check, Eye, EyeOff, KeyRound, Chrome } from 'lucide-react';
import type { LeadIntelligenceSettings } from '@/lib/lead-intelligence/types';
import { useToast } from '@/hooks/use-toast';

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
  const [copiedToken, setCopiedToken] = useState(false);

  const handleCopyToken = () => {
    if (settings.chromeExtensionToken) {
      navigator.clipboard.writeText(settings.chromeExtensionToken);
      setCopiedToken(true);
      toast({ title: 'Copied ✓', description: 'Extension token copied to clipboard!' });
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="space-y-6 text-xs text-left">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API keys credentials config */}
        <Card className="bg-card border border-border/70 shadow-sm rounded-2xl">
          <CardHeader className="p-6 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <KeyRound className="h-5 w-5 text-primary" /> Credentials & Data Integration Keys
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure your API credentials to connect Google Places, BuiltWith technographics, and Hunter.io decision maker lookups.
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

        {/* Chrome extension bundle section */}
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
    </div>
  );
};
export default SettingsTab;
