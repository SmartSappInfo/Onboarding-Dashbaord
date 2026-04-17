'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ToggleRight,
  ShieldAlert,
  Settings,
  Users,
  Activity,
  Plus,
  Trash2,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getFeatureDetail, updateFeatureRolloutRules, toggleFeatureKillSwitch } from '@/lib/backoffice/backoffice-feature-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { PlatformFeature, RolloutRule } from '@/lib/backoffice/backoffice-types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const STABILITY_COLORS: Record<string, string> = {
  stable: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  beta: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  internal: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

export default function FeatureDetailClient({ featureId }: { featureId: string }) {
  const { profile, can } = useBackoffice();
  const [feature, setFeature] = React.useState<PlatformFeature | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Local state for editing rollout rules
  const [rules, setRules] = React.useState<RolloutRule[]>([]);

  const loadFeature = React.useCallback(async () => {
    setIsLoading(true);
    const result = await getFeatureDetail(featureId);
    if (result.success && result.data) {
      setFeature(result.data);
      setRules(result.data.rolloutRules || []);
    }
    setIsLoading(false);
  }, [featureId]);

  React.useEffect(() => {
    loadFeature();
  }, [loadFeature]);

  // Rollout Rule Editor Handlers
  const handleUpdateRule = (index: number, updates: Partial<RolloutRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    setRules(newRules);
  };

  const handleAddRule = () => {
    setRules([...rules, { type: 'percentage', percentage: 10, enabled: false }]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSaveRules = async () => {
    if (!profile || !feature) return;
    setIsSaving(true);
    const result = await updateFeatureRolloutRules(feature.id, rules, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });
    
    if (result.success) {
      alert('Rollout rules updated safely.');
      loadFeature();
    } else {
      alert(`Failed to save: ${result.error}`);
    }
    setIsSaving(false);
  };

  const handleKillSwitch = async () => {
    if (!profile || !feature) return;
    const newState = !feature.killSwitch;
    
    if (newState && !confirm('ATTENTION: Enabling the Kill Switch will immediately turn off this feature for everyone, overriding all default states and rollout rules. Proceed?')) {
      return;
    }
    
    setIsSaving(true);
    const result = await toggleFeatureKillSwitch(feature.id, newState, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });
    
    if (result.success) {
      loadFeature();
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-accent rounded-lg animate-pulse" />
        <div className="h-64 bg-muted/50 rounded-2xl border border-border animate-pulse" />
      </div>
    );
  }

  if (!feature) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ToggleRight className="h-12 w-12 text-slate-700 mb-4" />
        <p className="text-sm text-muted-foreground">Feature Flag not found.</p>
        <Link href="/backoffice/features">
          <Button variant="ghost" className="mt-4 text-emerald-400">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Features
          </Button>
        </Link>
      </div>
    );
  }

  const hasChanges = JSON.stringify(rules) !== JSON.stringify(feature.rolloutRules || []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/backoffice/features">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Back to features"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {feature.label}
              </h1>
              <Badge
                variant="outline"
                className={`text-[9px] uppercase font-bold px-2 h-5 ${STABILITY_COLORS[feature.stability] || STABILITY_COLORS.internal}`}
              >
                {feature.stability}
              </Badge>
              {feature.killSwitch ? (
                <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] uppercase flex items-center gap-1 h-5">
                   <ShieldAlert className="h-2.5 w-2.5" />
                   KILLED
                </Badge>
              ) : (
                <Badge variant="outline" className={feature.defaultState ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[9px] uppercase' : 'bg-slate-500/15 text-muted-foreground border-slate-500/20 text-[9px] uppercase'}>
                   {feature.defaultState ? 'Default ON' : 'Default OFF'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">{feature.key}</p>
          </div>
        </div>
        
        {/* Global Action Header */}
        <div className="flex items-center gap-3">
           {can('features', 'edit') && (
              <Button
                variant={feature.killSwitch ? 'outline' : 'destructive'}
                onClick={handleKillSwitch}
                disabled={isSaving}
                className={`rounded-xl h-10 ${!feature.killSwitch ? 'bg-red-600 hover:bg-red-700 text-foreground' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}`}
              >
                 {feature.killSwitch ? (
                    'Restore from Kill Switch'
                 ) : (
                    <><AlertTriangle className="h-4 w-4 mr-2" /> Activate Kill Switch</>
                 )}
              </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Properties & Override State */}
        <div className="md:col-span-1 space-y-6">
           <div className="rounded-2xl border border-border bg-muted/50 p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                 <Settings className="h-4 w-4 text-emerald-400" />
                 Properties
              </h3>
              <div className="space-y-4 text-sm">
                 <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Description</span>
                    <span className="text-foreground/80">{feature.description || 'No description provided.'}</span>
                 </div>
                 <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Category</span>
                    <span className="text-foreground">{feature.category}</span>
                 </div>
                 <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Last Updated</span>
                    <span className="text-foreground">{feature.updatedAt ? new Date(feature.updatedAt).toLocaleString() : '—'}</span>
                 </div>
                 <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Updated By</span>
                    <span className="text-foreground">{feature.updatedBy || 'System'}</span>
                 </div>
              </div>
           </div>
           
           <div className="rounded-2xl border border-border bg-muted/50 p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                 <Activity className="h-4 w-4 text-emerald-400" />
                 Active Org Overrides
              </h3>
               <p className="text-xs text-muted-foreground mb-3">
                 Orgs with manual overrides will bypass the default state and rollout rules.
               </p>
               {Object.keys(feature.orgOverrides || {}).length > 0 ? (
                  <div className="space-y-2">
                     {Object.entries(feature.orgOverrides || {}).map(([orgId, isEnabled]) => (
                        <div key={orgId} className="flex items-center justify-between p-2 rounded-lg bg-accent/30 border border-border/30">
                           <span className="text-xs text-foreground/80 font-mono truncate mr-2">{orgId}</span>
                           <Badge variant="outline" className={`text-[8px] uppercase font-bold px-1.5 h-4 ${isEnabled ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10'}`}>
                              {isEnabled ? 'ON' : 'OFF'}
                           </Badge>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="text-center py-4 bg-accent/20 rounded-xl border border-border/30 border-dashed">
                      <p className="text-xs text-muted-foreground">No organizations have manual overrides.</p>
                  </div>
               )}
           </div>
        </div>

        {/* Right Column: Rollout Rules Builder */}
        <div className="md:col-span-2">
           <div className={`rounded-2xl border border-border bg-muted/50 flex flex-col h-full relative overflow-hidden ${feature.killSwitch ? 'opacity-70 pointer-events-none' : ''}`}>
               {feature.killSwitch && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                     <div className="bg-red-500/10 border border-red-500/20 px-6 py-4 rounded-2xl flex flex-col items-center">
                        <ShieldAlert className="h-8 w-8 text-red-500 mb-2" />
                        <span className="text-red-400 font-bold text-lg">Kill Switch Active</span>
                        <span className="text-red-400/80 text-xs mt-1 text-center max-w-[200px]">Rollout rules are disabled while the kill switch is engaged.</span>
                     </div>
                  </div>
               )}
               <div className="p-6 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-400" />
                      Rollout Configuration
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Configure gradual rollout rules for this feature.</p>
                  </div>
                  {can('features', 'edit') && (
                     <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleAddRule}
                        className="h-8 rounded-lg border-border text-foreground/80 hover:text-foreground"
                     >
                       <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
                     </Button>
                  )}
               </div>
               
               <div className="p-6 flex-1 space-y-4">
                  {rules.length === 0 ? (
                      <div className="text-center py-12 bg-accent/20 rounded-xl border border-border/30 border-dashed">
                          <Users className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground mb-1">No rollout rules configured.</p>
                          <p className="text-xs text-slate-600">The feature uses the 'Default State' for all organizations without manual overrides.</p>
                      </div>
                  ) : (
                     rules.map((rule, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-border bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 self-start sm:self-auto">
                               <Switch 
                                  checked={rule.enabled} 
                                  onCheckedChange={(val) => handleUpdateRule(idx, { enabled: val })}
                                  disabled={!can('features', 'edit')}
                               />
                            </div>
                            
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Type</label>
                                  <Select 
                                     value={rule.type} 
                                     onValueChange={(val: 'percentage' | 'allowlist' | 'channel') => handleUpdateRule(idx, { type: val })}
                                     disabled={!can('features', 'edit')}
                                  >
                                      <SelectTrigger className="h-9 bg-muted border-border text-sm">
                                         <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                         <SelectItem value="percentage">Percentage Based</SelectItem>
                                         <SelectItem value="allowlist">Org Allowlist</SelectItem>
                                         <SelectItem value="channel">Release Channel</SelectItem>
                                      </SelectContent>
                                  </Select>
                               </div>
                               
                               {rule.type === 'percentage' && (
                                  <div>
                                     <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Percentage (0-100)</label>
                                     <Input 
                                        type="number" 
                                        min="0" max="100" 
                                        value={rule.percentage || 0}
                                        onChange={(e) => handleUpdateRule(idx, { percentage: parseInt(e.target.value) || 0 })}
                                        className="h-9 bg-muted border-border"
                                        disabled={!can('features', 'edit')}
                                     />
                                  </div>
                               )}
                               
                               {rule.type === 'allowlist' && (
                                  <div>
                                     <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Organization IDs (comma-separated)</label>
                                     <Input 
                                        placeholder="org123, org456"
                                        value={rule.orgIds?.join(', ') || ''}
                                        onChange={(e) => handleUpdateRule(idx, { orgIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                        className="h-9 bg-muted border-border"
                                        disabled={!can('features', 'edit')}
                                     />
                                  </div>
                               )}
                               
                               {rule.type === 'channel' && (
                                  <div>
                                     <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Channel</label>
                                     <Select 
                                        value={rule.channel || 'internal'} 
                                        onValueChange={(val: 'internal' | 'beta' | 'stable') => handleUpdateRule(idx, { channel: val })}
                                        disabled={!can('features', 'edit')}
                                     >
                                         <SelectTrigger className="h-9 bg-muted border-border text-sm">
                                            <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent>
                                            <SelectItem value="internal">Internal Only</SelectItem>
                                            <SelectItem value="beta">Beta Participants</SelectItem>
                                            <SelectItem value="stable">Stable / General Release</SelectItem>
                                         </SelectContent>
                                     </Select>
                                  </div>
                               )}
                            </div>
                            
                            {can('features', 'edit') && (
                               <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleRemoveRule(idx)}
                                  className="h-9 w-9 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0 self-end sm:self-start mt-2"
                               >
                                  <Trash2 className="h-4 w-4" />
                               </Button>
                            )}
                        </div>
                     ))
                  )}
               </div>
               
               {/* Save Action Bar */}
               {can('features', 'edit') && hasChanges && (
                   <div className="p-4 border-t border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
                       <span className="text-xs text-emerald-400 font-medium">You have unsaved rollout changes.</span>
                       <div className="flex items-center gap-2">
                           <Button 
                              variant="ghost" 
                              onClick={() => setRules(feature.rolloutRules || [])}
                              className="h-9 text-muted-foreground hover:text-foreground"
                              disabled={isSaving}
                           >
                              Revert
                           </Button>
                           <Button 
                              onClick={handleSaveRules}
                              disabled={isSaving}
                              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-lg"
                           >
                              {isSaving ? 'Saving...' : <><Check className="h-4 w-4 mr-2" /> Save Rules</>}
                           </Button>
                       </div>
                   </div>
               )}
           </div>
        </div>
      </div>
    </div>
  );
}
