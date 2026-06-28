'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import type { Workspace, WorkspaceStatus, WorkspaceCapabilities, IndustryVertical } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { saveWorkspaceAction } from '@/lib/workspace-actions';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { INDUSTRY_METADATA } from '@/lib/industry-field-registry';
import { 
    Building, 
    Pencil, 
    ShieldCheck, 
    Info,
    Check,
    Briefcase,
    Building2,
    Users,
    User,
    Lock,
    Settings2,
    Palette,
    PlusCircle,
    X,
    Loader2
} from 'lucide-react';
import * as Icons from 'lucide-react';

export interface WorkspaceProfileTabProps {
  workspace: Workspace;
  onSaveSuccess: () => void;
  onBackToOrg: () => void;
}

export default function WorkspaceProfileTab({ workspace, onSaveSuccess, onBackToOrg }: WorkspaceProfileTabProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const [isSaving, setIsSaving] = React.useState(false);

  const [name, setName] = React.useState(workspace.name);
  const [description, setDescription] = React.useState(workspace.description || '');
  const [statuses, setStatuses] = React.useState<WorkspaceStatus[]>(workspace.statuses || []);
  const [singularTerm, setSingularTerm] = React.useState(workspace.terminology?.singular || '');
  const [pluralTerm, setPluralTerm] = React.useState(workspace.terminology?.plural || '');
  const [capabilities, setCapabilities] = React.useState<WorkspaceCapabilities>(
    workspace.capabilities || {
      billing: true,
      admissions: true,
      children: true,
      contracts: true,
      messaging: true,
      automations: true,
      tasks: true
    }
  );

  React.useEffect(() => {
    setName(workspace.name);
    setDescription(workspace.description || '');
    setStatuses(workspace.statuses || []);
    setSingularTerm(workspace.terminology?.singular || '');
    setPluralTerm(workspace.terminology?.plural || '');
    setCapabilities(
      workspace.capabilities || {
        billing: true,
        admissions: true,
        children: true,
        contracts: true,
        messaging: true,
        automations: true,
        tasks: true
      }
    );
  }, [workspace]);

  // Helper function to get industry icon
  const getIndustryIcon = (industryType: IndustryVertical): React.ComponentType<{ className?: string }> => {
    const meta = INDUSTRY_METADATA[industryType];
    const IconName = meta?.icon || 'Building2';
    const typedIcons = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
    return typedIcons[IconName] || Icons.Building2;
  };

  // Helper function to get industry display name
  const getIndustryDisplayName = (industryType: IndustryVertical) => {
    return INDUSTRY_METADATA[industryType]?.name || industryType;
  };

  // Helper function to get industry description
  const getIndustryDescription = (industryType: IndustryVertical) => {
    return INDUSTRY_METADATA[industryType]?.description || '';
  };

  const handleAddStatus = () => {
    setStatuses(prev => [...prev, { value: 'New Status', label: 'New Status', color: '#64748b' }]);
  };

  const updateStatus = (index: number, updates: Partial<WorkspaceStatus>) => {
    const next = [...statuses];
    next[index] = { ...next[index], ...updates };
    setStatuses(next);
  };

  const removeStatus = (index: number) => {
    if (statuses.length === 1) return;
    setStatuses(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleCapability = (key: keyof WorkspaceCapabilities) => {
    setCapabilities(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setIsSaving(true);
    try {
      const result = await saveWorkspaceAction(
        workspace.id,
        {
          name: name.trim(),
          description: description.trim(),
          statuses,
          capabilities,
          terminology: (singularTerm.trim() && pluralTerm.trim()) ? {
            singular: singularTerm.trim(),
            plural: pluralTerm.trim()
          } : undefined,
        },
        user.uid
      );

      if (result.success) {
        toast({ title: 'Workspace Settings Saved', description: 'Workspace architecture updated successfully.' });
        onSaveSuccess();
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast({ variant: 'destructive', title: 'Error saving settings', description: errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  const IndustryIcon = getIndustryIcon(workspace.industry || 'SaaS');

  return (
    <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden text-left">
      <CardHeader className="p-8 border-b flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Workspace Profile Settings
          </CardTitle>
          <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
            Configure labels, capability settings, terms, and status pipelines.
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          onClick={onBackToOrg} 
          className="rounded-xl font-bold text-xs h-9 px-4 active:scale-[0.97] transition-all"
        >
          Back to Organization Settings
        </Button>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSave} className="space-y-10">
          
          {/* Section 1: Label & Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Workspace Label</Label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Higher Education Onboarding" 
                className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg px-4" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Objective Brief</Label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Define the scope..." 
                className="min-h-[120px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed" 
              />
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Section 2: Industry & Contact Scope (Locked) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Industry Vertical Locked Card */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold">Industry Vertical</h4>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold tracking-wider">Locked</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 flex items-start gap-4 shadow-sm">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <IndustryIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    This workspace is configured for{' '}
                    <span className="text-primary">
                      {getIndustryDisplayName(workspace.industry)}
                    </span>
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                    {getIndustryDescription(workspace.industry)}
                  </p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-amber-900 ">Industry Locked</p>
                  <p className="text-[9px] font-medium text-amber-800/70 leading-relaxed">
                    Industry vertical cannot be changed after entities have been linked to this workspace. This ensures feature compatibility and data consistency.
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Scope Locked Card */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold">Contact Scope</h4>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold tracking-wider">Locked</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 flex items-start gap-4 shadow-sm">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {workspace.contactScope === 'institution' && <Building2 className="h-5 w-5 text-primary" />}
                  {workspace.contactScope === 'family' && <Users className="h-5 w-5 text-primary" />}
                  {workspace.contactScope === 'person' && <User className="h-5 w-5 text-primary" />}
                </div>
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    This workspace manages{' '}
                    <span className="text-primary">
                      {workspace.contactScope === 'institution' ? 'Schools' : 
                       workspace.contactScope === 'family' ? 'Families' : 'People'}
                    </span>
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                    {workspace.contactScope === 'institution' && 'Institutional contacts with billing, contracts, and subscription management.'}
                    {workspace.contactScope === 'family' && 'Family contacts with guardians, children, and admissions workflows.'}
                    {workspace.contactScope === 'person' && 'Individual contacts with personal CRM and lead management.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-amber-900 ">Scope Locked</p>
                  <p className="text-[9px] font-medium text-amber-800/70 leading-relaxed">
                    Contact scope cannot be changed after entities have been linked to this workspace. This protects existing data integrity.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Section 3: Workspace Capabilities */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Settings2 className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold">Workspace Capabilities</h4>
            </div>

            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
              Enable or disable default modules for this workspace. These controls restrict visible pages for users on a per-workspace basis.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(Object.keys(capabilities) as Array<keyof WorkspaceCapabilities>).map((key) => (
                <div 
                  key={key} 
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                    capabilities[key] ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-border opacity-70"
                  )}
                >
                  <div className="space-y-0.5 text-left">
                    <span className="text-xs font-bold capitalize text-foreground">{key}</span>
                    <p className="text-[8px] font-medium text-muted-foreground/80 leading-relaxed">
                      {key === 'billing' && 'Invoices and collections'}
                      {key === 'admissions' && 'Registration and onboarding'}
                      {key === 'children' && 'Dependents and relations'}
                      {key === 'contracts' && 'Electronic sign agreements'}
                      {key === 'messaging' && 'Interactive broadcasts'}
                      {key === 'automations' && 'AI triggers and hooks'}
                      {key === 'tasks' && 'Checklist nodes and todos'}
                    </p>
                  </div>
                  <Switch 
                    checked={capabilities[key]} 
                    onCheckedChange={() => handleToggleCapability(key)} 
                    className="data-[state=checked]:bg-primary active:scale-[0.97] transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Section 4: Terminology Architect */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-1">
              <Palette className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold ">Terminology Architect</h4>
              <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4 ml-auto">Visual Logic</Badge>
            </div>

            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
              Customize how entities are identified in this workspace. Labels will appear across navigation, forms, and reports. 
              Leaving these blank will use default labels (<span className="text-primary font-bold">Institution, Family, or Person</span>).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Singular Label</Label>
                <Input 
                  value={singularTerm} 
                  onChange={e => setSingularTerm(e.target.value)} 
                  placeholder="e.g. Company" 
                  className="h-11 rounded-xl bg-background border-none font-bold text-sm px-4" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Plural Label</Label>
                <Input 
                  value={pluralTerm} 
                  onChange={e => setPluralTerm(e.target.value)} 
                  placeholder="e.g. Companies" 
                  className="h-11 rounded-xl bg-background border-none font-bold text-sm px-4" 
                />
              </div>
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Section 5: Independent Status Lifecycle */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-semibold ">Independent Status Lifecycle</h4>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleAddStatus}
                className="h-8 rounded-xl font-bold border-dashed border-2 text-[10px] active:scale-[0.97] transition-all"
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Status Node
              </Button>
            </div>

            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
              Configure status nodes that define the onboarding pipeline flow for contacts in this specific hub.
            </p>

            <div className="space-y-3">
              {statuses.map((status, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 rounded-2xl bg-background border group shadow-sm transition-all duration-300">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="w-8 h-8 rounded-lg shadow-sm border shrink-0 active:scale-[0.9] transition-transform" style={{ backgroundColor: status.color }} />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <div className="grid grid-cols-6 gap-1">
                            {ONBOARDING_STAGE_COLORS.map(c => (
                              <button 
                                key={c} 
                                type="button" 
                                onClick={() => updateStatus(idx, { color: c })} 
                                className="w-5 h-5 rounded shadow-sm hover:scale-105 active:scale-95 transition-transform" 
                                style={{ backgroundColor: c }} 
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Input 
                        value={status.label} 
                        onChange={e => updateStatus(idx, { label: e.target.value, value: e.target.value })} 
                        className="h-9 bg-card font-bold text-xs" 
                      />
                    </div>
                    <Input 
                      value={status.description || ''} 
                      onChange={e => updateStatus(idx, { description: e.target.value })} 
                      placeholder="Short behavioral description..."
                      className="h-9 bg-card font-medium text-[10px]" 
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeStatus(idx)}
                    disabled={statuses.length === 1}
                    className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-opacity active:scale-90"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-4 shadow-inner">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-blue-900 ">Independent Logic</p>
                <p className="text-[9px] font-bold text-blue-800/60 leading-relaxed tracking-tighter text-left">
                  Statuses defined here will be available only when this workspace is active. Existing records using deleted statuses will retain their labels until updated.
                </p>
              </div>
            </div>
          </div>

          {/* Form Save Button Footer */}
          <div className="pt-6 border-t flex justify-end">
            <Button 
              type="submit" 
              disabled={isSaving || !name.trim()} 
              className="rounded-xl font-semibold px-10 shadow-2xl bg-primary text-white text-xs h-12 active:scale-[0.97] transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving Profile...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Save Profile & Lifecycle
                </>
              )}
            </Button>
          </div>

        </form>
      </CardContent>
    </Card>
  );
}
