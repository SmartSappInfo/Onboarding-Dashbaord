'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, ShieldCheck, Download } from 'lucide-react';
import type { LeadIntelligenceSettings } from '@/lib/lead-intelligence/types';

interface SettingsTabProps {
  settings: LeadIntelligenceSettings;
  setSettings: React.Dispatch<React.SetStateAction<LeadIntelligenceSettings>>;
  activeWorkspaceId: string;
  onSaveSettings: () => void;
  onGenerateToken: () => void;
}

export default function SettingsTab({
  settings,
  setSettings,
  activeWorkspaceId,
  onSaveSettings,
  onGenerateToken
}: SettingsTabProps) {
  return (
    <div className="mt-6 space-y-6 text-xs text-left">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API keys credentials config */}
        <Card className="bg-card/35 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-emerald-400" />
              Credentials & Data Integration Keys
            </CardTitle>
            <CardDescription className="text-xs">Add your API credentials to connect Google Maps, BuiltWith technographics and Hunter decision makers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="google-key" className="font-bold text-[10px]">Google Places API Key</Label>
              <Input 
                id="google-key" 
                type="password"
                placeholder="AIzaSy..." 
                value={settings.googlePlacesApiKey || ''} 
                onChange={(e) => setSettings(prev => ({ ...prev, googlePlacesApiKey: e.target.value }))}
                className="h-9 text-xs border-border/60 bg-muted/10 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="builtwith-key" className="font-bold text-[10px]">BuiltWith API Key</Label>
              <Input 
                id="builtwith-key" 
                type="password"
                placeholder="e.g. 5d5a8..." 
                value={settings.builtwithApiKey || ''} 
                onChange={(e) => setSettings(prev => ({ ...prev, builtwithApiKey: e.target.value }))}
                className="h-9 text-xs border-border/60 bg-muted/10 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hunter-key" className="font-bold text-[10px]">Hunter.io API Key</Label>
              <Input 
                id="hunter-key" 
                type="password"
                placeholder="e.g. key_66a7b..." 
                value={settings.hunterApiKey || ''} 
                onChange={(e) => setSettings(prev => ({ ...prev, hunterApiKey: e.target.value }))}
                className="h-9 text-xs border-border/60 bg-muted/10 rounded-lg"
              />
            </div>
            <div className="pt-2">
              <Button 
                onClick={onSaveSettings} 
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-9 px-6 rounded-lg active:scale-[0.97]"
              >
                Save API settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Chrome extension bundle section */}
        <Card className="bg-card/35 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Chrome Extension Sideload Installer
            </CardTitle>
            <CardDescription className="text-xs">Integrate SmartSapp Lead Intelligence directly into your Chrome browser toolbar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <span className="font-bold block text-[10px] uppercase text-muted-foreground">Workspace Extension Token</span>
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={settings.chromeExtensionToken || 'No token generated'} 
                  className="h-9 text-xs border-border/60 bg-muted/10 rounded-lg"
                />
                <Button 
                  onClick={onGenerateToken} 
                  variant="outline" 
                  className="h-9 text-xs font-bold border-border/50 hover:bg-muted/10 active:scale-[0.97] rounded-lg"
                >
                  Generate
                </Button>
              </div>
            </div>

            {/* Download section */}
            <div className="p-3 bg-muted/10 border border-border/40 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold block">Download extension bundle</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Custom pre-configured ZIP containing your workspace token keys.</span>
              </div>
              <Button 
                asChild
                disabled={!settings.chromeExtensionToken}
                className="h-9 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-lg active:scale-[0.97]"
              >
                <a href={`/api/lead-intelligence/extension/download?workspaceId=${activeWorkspaceId}&token=${settings.chromeExtensionToken}`} download>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  ZIP Archive
                </a>
              </Button>
            </div>

            <div className="space-y-2 border-t border-border/30 pt-3">
              <span className="font-bold block text-[10px] uppercase text-muted-foreground">How to Install in Chrome</span>
              <ol className="list-decimal pl-4 space-y-1.5 text-muted-foreground">
                <li>Download the ZIP archive above and extract its contents to a local folder.</li>
                <li>Open Google Chrome and navigate to: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">chrome://extensions</code></li>
                <li>Toggle the <strong>Developer Mode</strong> switch in the upper-right corner of the extensions page.</li>
                <li>Click the <strong>Load Unpacked</strong> button and select the extracted folder.</li>
                <li>Pin the SmartSapp Extension to your toolbar. Start scanning any school or business domain!</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
