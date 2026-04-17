'use client';

import * as React from 'react';
import { Network, Search, Save, KeyRound, Globe, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { listProviderSettings, saveProviderSetting } from '@/lib/backoffice/backoffice-provider-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { PlatformProviderSetting, PlatformProviderType } from '@/lib/backoffice/backoffice-types';

export default function ProviderSettingsEditor() {
  const { profile, can } = useBackoffice();
  const [providers, setProviders] = React.useState<PlatformProviderSetting[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    load();
  }, []);

  async function load() {
    setIsLoading(true);
    const res = await listProviderSettings();
    if (res.success && res.data) {
      setProviders(res.data);
    }
    setIsLoading(false);
  }

  const handleUpdateConfig = (id: string, key: string, value: string) => {
    setProviders(prev => prev.map(p => {
      if (p.id === id) {
        return {
           ...p,
           config: {
              ...(p.config || {}),
              [key]: value
           }
        };
      }
      return p;
    }));
  };

  const handleUpdateSetting = (id: string, partial: Partial<PlatformProviderSetting>) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...partial } : p));
  };

  const saveConfig = async (provider: PlatformProviderSetting) => {
    if (!profile) return;
    setIsSaving(true);
    const res = await saveProviderSetting(provider, {
       userId: profile.id,
       name: profile.name,
       email: profile.email,
       role: 'super_admin'
    });
    if (res.success) {
       alert(`${provider.provider} settings saved via audit log.`);
       load();
    }
    setIsSaving(false);
  };

  // Organize by type
  const emailProviders = providers.filter(p => p.type === 'email');
  const smsProviders = providers.filter(p => p.type === 'sms');

  if (isLoading) {
     return (
        <div className="space-y-6">
           <div className="h-8 w-48 bg-accent rounded-lg animate-pulse" />
           <div className="h-64 bg-muted/50 rounded-2xl border border-border animate-pulse" />
        </div>
     );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Platform Settings & Providers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage global integration credentials, tracking domains, and base rate limits.
          </p>
        </div>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border rounded-xl p-1 h-auto flex flex-wrap gap-1">
           <TabsTrigger
            value="email"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <KeyRound className="h-3.5 w-3.5 mr-2" /> Email Providers
          </TabsTrigger>
          <TabsTrigger
            value="sms"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Network className="h-3.5 w-3.5 mr-2" /> SMS Integration
          </TabsTrigger>
          <TabsTrigger
            value="webhook"
            disabled
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
          >
            <Workflow className="h-3.5 w-3.5 mr-2" /> Webhook Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4 space-y-4">
           {emailProviders.length === 0 && (
              <div className="text-center py-12 bg-accent/20 rounded-xl border border-border/30 border-dashed">
                 <p className="text-sm text-muted-foreground">No Email Providers configured. Add via system seed scripts.</p>
              </div>
           )}
           {emailProviders.map(p => (
              <div key={p.id} className="rounded-2xl border border-border bg-muted/50 p-6 relative">
                 <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                       <h3 className="text-lg font-semibold text-foreground capitalize">{p.provider}</h3>
                       {p.isDefault && (
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase px-2 py-0.5 rounded font-bold border border-emerald-500/20">System Default</span>
                       )}
                    </div>
                    {can('settings', 'edit') && (
                       <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                             <span className="text-xs text-muted-foreground">Make Default</span>
                             <Switch checked={p.isDefault} onCheckedChange={(val) => handleUpdateSetting(p.id, { isDefault: val })} />
                          </div>
                          <Button 
                             onClick={() => saveConfig(p)} 
                             disabled={isSaving}
                             className="bg-emerald-600 hover:bg-emerald-700 text-foreground h-9 px-4 rounded-lg"
                          >
                             {isSaving ? 'Saving...' : <><Save className="h-4 w-4 mr-2" /> Save Config</>}
                          </Button>
                       </div>
                    )}
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <h4 className="text-sm font-semibold text-foreground">Credentials</h4>
                       {Object.entries((p.config || {})).map(([k, v]) => (
                          <div key={k}>
                             <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">{k}</label>
                             <Input 
                                type={k.toLowerCase().includes('key') || k.toLowerCase().includes('token') ? "password" : "text"}
                                value={String(v) || ''}
                                onChange={(e) => handleUpdateConfig(p.id, k, e.target.value)}
                                className="h-9 bg-background border-border text-foreground/80 font-mono"
                                disabled={!can('settings', 'edit')}
                             />
                          </div>
                       ))}
                       {Object.keys(p.config || {}).length === 0 && (
                           <div className="text-xs text-muted-foreground italic">No keys defined.</div>
                       )}
                    </div>
                    
                    <div className="space-y-4">
                       <h4 className="text-sm font-semibold text-foreground">Global Rate Limits</h4>
                       <div className="grid grid-cols-3 gap-4">
                          <div>
                             <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Per Minute</label>
                             <Input 
                                type="number"
                                value={p.rateLimits?.maxPerMinute || 0}
                                onChange={(e) => handleUpdateSetting(p.id, { rateLimits: { ...p.rateLimits, maxPerMinute: parseInt(e.target.value) || 0 }})}
                                className="h-9 bg-background border-border"
                                disabled={!can('settings', 'edit')}
                             />
                          </div>
                          <div>
                             <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Per Hour</label>
                             <Input 
                                type="number"
                                value={p.rateLimits?.maxPerHour || 0}
                                onChange={(e) => handleUpdateSetting(p.id, { rateLimits: { ...p.rateLimits, maxPerHour: parseInt(e.target.value) || 0 }})}
                                className="h-9 bg-background border-border"
                                disabled={!can('settings', 'edit')}
                             />
                          </div>
                          <div>
                             <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Per Day</label>
                             <Input 
                                type="number"
                                value={p.rateLimits?.maxPerDay || 0}
                                onChange={(e) => handleUpdateSetting(p.id, { rateLimits: { ...p.rateLimits, maxPerDay: parseInt(e.target.value) || 0 }})}
                                className="h-9 bg-background border-border"
                                disabled={!can('settings', 'edit')}
                             />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           ))}
        </TabsContent>

        <TabsContent value="sms" className="mt-4 space-y-4">
            {smsProviders.length === 0 && (
              <div className="text-center py-12 bg-accent/20 rounded-xl border border-border/30 border-dashed">
                 <p className="text-sm text-muted-foreground">No SMS Providers configured. Add via system seed scripts.</p>
              </div>
           )}
           {smsProviders.map(p => (
              <div key={p.id} className="rounded-2xl border border-border bg-muted/50 p-6 relative">
                 <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                       <h3 className="text-lg font-semibold text-foreground capitalize">{p.provider}</h3>
                       {p.isDefault && (
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase px-2 py-0.5 rounded font-bold border border-emerald-500/20">System Default</span>
                       )}
                    </div>
                    {can('settings', 'edit') && (
                       <Button 
                          onClick={() => saveConfig(p)} 
                          disabled={isSaving}
                          className="bg-emerald-600 hover:bg-emerald-700 text-foreground h-9 px-4 rounded-lg"
                       >
                          {isSaving ? 'Saving...' : <><Save className="h-4 w-4 mr-2" /> Save Config</>}
                       </Button>
                    )}
                 </div>
                 {/* Similar config mappings for SMS ... */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <h4 className="text-sm font-semibold text-foreground">Credentials</h4>
                       {Object.entries((p.config || {})).map(([k, v]) => (
                          <div key={k}>
                             <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">{k}</label>
                             <Input 
                                type={k.toLowerCase().includes('key') || k.toLowerCase().includes('token') ? "password" : "text"}
                                value={String(v) || ''}
                                onChange={(e) => handleUpdateConfig(p.id, k, e.target.value)}
                                className="h-9 bg-background border-border text-foreground/80 font-mono"
                                disabled={!can('settings', 'edit')}
                             />
                          </div>
                       ))}
                    </div>
                  </div>
              </div>
           ))}
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
