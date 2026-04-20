'use client';

import * as React from 'react';
import { Network, Search, Save, KeyRound, Globe, Workflow, Brain, Plus, X } from 'lucide-react';
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
  
  // Local state for adding a new model name per provider ID
  const [newModelInputs, setNewModelInputs] = React.useState<Record<string, string>>({});

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
  
  const handleAddModel = (id: string) => {
    const model = newModelInputs[id];
    if (!model || !model.trim()) return;
    
    setProviders(prev => prev.map(p => {
      if (p.id === id) {
        const current = p.supportedModels || [];
        if (!current.includes(model.trim())) return { ...p, supportedModels: [...current, model.trim()] };
      }
      return p;
    }));
    setNewModelInputs(prev => ({ ...prev, [id]: '' }));
  };

  const handleRemoveModel = (id: string, model: string) => {
    setProviders(prev => prev.map(p => {
      if (p.id === id) {
        const current = p.supportedModels || [];
        return { ...p, supportedModels: current.filter(m => m !== model) };
      }
      return p;
    }));
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
    } else {
       alert(`Failed to save: ${res.error}`);
    }
    setIsSaving(false);
  };

  // Organize by type
  const emailProviders = providers.filter(p => p.type === 'email');
  const smsProviders = providers.filter(p => p.type === 'sms');
  const aiProviders = providers.filter(p => p.type === 'ai');

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
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-500 cursor-pointer flex-1 sm:flex-none"
          >
            <KeyRound className="h-3.5 w-3.5 mr-2" /> Email Providers
          </TabsTrigger>
          <TabsTrigger
            value="sms"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-500 cursor-pointer flex-1 sm:flex-none"
          >
            <Network className="h-3.5 w-3.5 mr-2" /> SMS Integration
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-500 cursor-pointer flex-1 sm:flex-none"
          >
            <Brain className="h-3.5 w-3.5 mr-2" /> AI Integrations
          </TabsTrigger>
          <TabsTrigger
            value="webhook"
            disabled
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-500 cursor-pointer flex-1 sm:flex-none"
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
                          <span className="bg-emerald-500/10 text-emerald-600 text-[10px] uppercase px-2 py-0.5 rounded font-bold border border-emerald-500/20">System Default</span>
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
                             className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-4 rounded-lg"
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
                          <span className="bg-emerald-500/10 text-emerald-600 text-[10px] uppercase px-2 py-0.5 rounded font-bold border border-emerald-500/20">System Default</span>
                       )}
                    </div>
                    {can('settings', 'edit') && (
                       <Button 
                          onClick={() => saveConfig(p)} 
                          disabled={isSaving}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-4 rounded-lg"
                       >
                          {isSaving ? 'Saving...' : <><Save className="h-4 w-4 mr-2" /> Save Config</>}
                       </Button>
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
                    </div>
                  </div>
              </div>
           ))}
        </TabsContent>
        
        <TabsContent value="ai" className="mt-4 space-y-4">
            {aiProviders.length === 0 && (
              <div className="text-center py-12 bg-accent/20 rounded-xl border border-border/30 border-dashed">
                 <p className="text-sm text-muted-foreground">No AI Providers configured (e.g. OpenAI, Anthropic). Add via system seed scripts.</p>
              </div>
           )}
           {aiProviders.map(p => (
              <div key={p.id} className="rounded-2xl border border-border bg-muted/50 p-6 relative">
                 <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                       <h3 className="text-lg font-semibold text-foreground capitalize">{p.provider}</h3>
                       {p.isDefault && (
                          <span className="bg-emerald-500/10 text-emerald-600 text-[10px] uppercase px-2 py-0.5 rounded font-bold border border-emerald-500/20">System Default</span>
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
                             className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-4 rounded-lg"
                          >
                             {isSaving ? 'Saving...' : <><Save className="h-4 w-4 mr-2" /> Save Config</>}
                          </Button>
                       </div>
                    )}
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <h4 className="text-sm font-semibold text-foreground">Global API Configuration</h4>
                       <p className="text-[10px] text-muted-foreground mt-1">
                          Sets the foundation fallback API keys used by the SmartSapp AI router. Tenants can override these keys in their own settings.
                       </p>
                       {Object.entries((p.config || { apiKey: '' })).map(([k, v]) => (
                          <div key={k} className="mt-4">
                             <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">{k}</label>
                             <Input 
                                type={k.toLowerCase().includes('key') ? "password" : "text"}
                                value={String(v) || ''}
                                onChange={(e) => handleUpdateConfig(p.id, k, e.target.value)}
                                className="h-9 bg-background border-border text-foreground/80 font-mono"
                                disabled={!can('settings', 'edit')}
                             />
                          </div>
                       ))}
                    </div>
                    
                    <div className="space-y-4">
                       <div className="flex items-start justify-between">
                          <div>
                             <h4 className="text-sm font-semibold text-foreground">Supported Models Registry</h4>
                             <p className="text-[10px] text-muted-foreground mt-1">
                                Dictates which explicit model identifiers (e.g. "gpt-4o") map to this provider. <b>Only manipulable by the SuperAdmin Control Plane. Tenants cannot dictate logic bounds.</b>
                             </p>
                          </div>
                       </div>
                       
                       <div className="flex flex-wrap gap-2 mt-4">
                          {(p.supportedModels || []).map(model => (
                             <div key={model} className="flex items-center gap-1 bg-background border border-border pl-2.5 pr-1 rounded-md h-7">
                                <span className="text-xs font-mono text-foreground/80">{model}</span>
                                {can('settings', 'edit') && (
                                   <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleRemoveModel(p.id, model)}
                                      className="h-5 w-5 hover:bg-accent hover:text-red-500 rounded p-0 text-muted-foreground"
                                   >
                                      <X className="h-3 w-3" />
                                   </Button>
                                )}
                             </div>
                          ))}
                          {(p.supportedModels || []).length === 0 && (
                             <span className="text-xs text-muted-foreground italic">No models registered globally.</span>
                          )}
                       </div>

                       {can('settings', 'edit') && (
                          <div className="flex items-center gap-2 mt-2">
                             <Input 
                                placeholder="Add model (e.g., gpt-4-turbo)"
                                value={newModelInputs[p.id] || ''}
                                onChange={(e) => setNewModelInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                                className="h-8 bg-background border-border text-xs text-foreground/80 font-mono flex-1 max-w-[200px]"
                                onKeyDown={(e) => {
                                   if (e.key === 'Enter') { e.preventDefault(); handleAddModel(p.id); }
                                }}
                             />
                             <Button 
                                type="button"
                                variant="secondary"
                                onClick={() => handleAddModel(p.id)}
                                className="h-8 px-3 text-xs bg-accent hover:bg-accent/80 text-foreground"
                             >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add
                             </Button>
                          </div>
                       )}
                    </div>
                 </div>
              </div>
           ))}
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
