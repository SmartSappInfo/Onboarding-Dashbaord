import * as React from 'react';
import { 
  Smartphone,
  CheckSquare,
  Mail,
  Bell,
  X as XIcon,
  Building,
  UserPlus
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';
import { MappableInputField } from './MappableInputField';
import type { UserProfile, OnboardingStage, VariableDefinition, Pipeline, Automation } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';

const NATIVE_ENTITY_FIELDS = [
  // Common
  { id: 'status', name: 'status', label: 'Status', compatibilityScope: ['common'] },
  { id: 'locationString', name: 'locationString', label: 'Physical Address', compatibilityScope: ['common'] },
  { id: 'currentNeeds', name: 'currentNeeds', label: 'Current Needs', compatibilityScope: ['common'] },
  { id: 'currentChallenges', name: 'currentChallenges', label: 'Current Challenges', compatibilityScope: ['common'] },
  { id: 'interests', name: 'interests', label: 'Interests (Comma Separated)', compatibilityScope: ['common'] },
  
  // Institution
  { id: 'initials', name: 'initials', label: 'Initials / Acronym', compatibilityScope: ['institution'] },
  { id: 'slogan', name: 'slogan', label: 'Motto / Slogan', compatibilityScope: ['institution'] },
  { id: 'capacity', name: 'capacity', label: 'Capacity', compatibilityScope: ['institution'] },
  { id: 'subscriptionPackageId', name: 'subscriptionPackageId', label: 'Subscription Package ID', compatibilityScope: ['institution'] },
  { id: 'currency', name: 'currency', label: 'Billing Currency', compatibilityScope: ['institution'] },
  { id: 'subscriptionRate', name: 'subscriptionRate', label: 'Subscription Rate', compatibilityScope: ['institution'] },
  { id: 'discountPercentage', name: 'discountPercentage', label: 'Preferred Grant / Discount', compatibilityScope: ['institution'] },
  { id: 'billingAddress', name: 'billingAddress', label: 'Billing Address', compatibilityScope: ['institution'] },
  { id: 'arrearsBalance', name: 'arrearsBalance', label: 'Arrears Balance', compatibilityScope: ['institution'] },
  { id: 'creditBalance', name: 'creditBalance', label: 'Credit Balance', compatibilityScope: ['institution'] },
  
  // Online Presence (Institution only)
  { id: 'website', name: 'website', label: 'Website', compatibilityScope: ['institution'] },
  { id: 'digitalAddress', name: 'digitalAddress', label: 'Digital Address', compatibilityScope: ['institution'] },
  { id: 'googleMapLocation', name: 'googleMapLocation', label: 'Google Map Link', compatibilityScope: ['institution'] },
  { id: 'facebook', name: 'facebook', label: 'Facebook', compatibilityScope: ['institution'] },
  { id: 'whatsapp', name: 'whatsapp', label: 'WhatsApp', compatibilityScope: ['institution'] },
  { id: 'instagram', name: 'instagram', label: 'Instagram', compatibilityScope: ['institution'] },
  { id: 'linkedin', name: 'linkedin', label: 'LinkedIn', compatibilityScope: ['institution'] },
  { id: 'x_twitter', name: 'x_twitter', label: 'X (Twitter)', compatibilityScope: ['institution'] },
  { id: 'youtube', name: 'youtube', label: 'YouTube', compatibilityScope: ['institution'] },
  { id: 'tiktok', name: 'tiktok', label: 'TikTok', compatibilityScope: ['institution'] },
  { id: 'pinterest', name: 'pinterest', label: 'Pinterest', compatibilityScope: ['institution'] },

  // Person
  { id: 'firstName', name: 'firstName', label: 'First Name', compatibilityScope: ['person'] },
  { id: 'lastName', name: 'lastName', label: 'Last Name', compatibilityScope: ['person'] },
  { id: 'company', name: 'company', label: 'Company / Organisation', compatibilityScope: ['person'] },
  { id: 'jobTitle', name: 'jobTitle', label: 'Job Title', compatibilityScope: ['person'] },
  { id: 'leadSource', name: 'leadSource', label: 'Lead Source', compatibilityScope: ['person', 'family'] },
];

interface UpdateEntityConfigPanelProps {
  config: Record<string, any>;
  updateConfig: (updates: Record<string, any>) => void;
  users: UserProfile[];
  pipelines: Pipeline[];
  stages: OnboardingStage[];
  activeWorkspace: any;
  appFields: any[];
  fieldGroups: any[];
}

const UpdateEntityConfigPanel = React.memo(function UpdateEntityConfigPanel({
  config,
  updateConfig,
  users,
  pipelines,
  stages,
  activeWorkspace,
  appFields,
  fieldGroups,
}: UpdateEntityConfigPanelProps) {
  const updates = config.updates || {};

  const nativeFields = React.useMemo(() => [
    { key: 'displayName', label: 'Display Name', type: 'text' },
    { key: 'primaryEmail', label: 'Primary Email', type: 'text' },
    { key: 'primaryPhone', label: 'Primary Phone', type: 'text' },
    { key: 'assignedTo', label: 'Account Manager', type: 'select', options: (users || []).map(u => ({ value: u.id, label: u.name })) },
    { key: 'pipelineId', label: 'Pipeline', type: 'select', options: (pipelines || []).map(p => ({ value: p.id, label: p.name })) },
    { key: 'stageId', label: 'Pipeline Stage', type: 'select', options: (stages || []).filter(s => !config.pipelineId || s.pipelineId === config.pipelineId).map(s => ({ value: s.id, label: `${s.name} (${(pipelines || []).find(p => p.id === s.pipelineId)?.name || 'Default'})` })) }
  ], [users, pipelines, stages, config.pipelineId]);

  const filteredAppFields = React.useMemo(() => {
    if (!fieldGroups || !appFields) return [];
    const activeNonSystemGroupIds = new Set(
      (fieldGroups || [])
        .filter((g: any) => !g.isSystem)
        .map((g: any) => g.id)
    );
    const contactScope = activeWorkspace?.contactScope || 'institution';

    const custom = (appFields || []).filter((f: any) => {
      const scopes = f.compatibilityScope || ['common'];
      const isCompatible = scopes.includes('common') || scopes.includes(contactScope);
      const isActive = f.status === 'active';
      const isNotHidden = f.type !== 'hidden';
      const belongsToNonSystemGroup = f.groupId && activeNonSystemGroupIds.has(f.groupId);
      
      return isCompatible && isActive && isNotHidden && belongsToNonSystemGroup;
    });

    const native = NATIVE_ENTITY_FIELDS.filter((f: any) => {
      const scopes = f.compatibilityScope || ['common'];
      return scopes.includes('common') || scopes.includes(contactScope);
    });

    const seen = new Set<string>();
    const combined: any[] = [];
    
    [...native, ...custom].forEach(f => {
      const key = f.id || f.name;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(f);
      }
    });

    return combined;
  }, [appFields, fieldGroups, activeWorkspace?.contactScope]);

  const customFields = React.useMemo(() => {
    return filteredAppFields.map((f: any) => ({
      key: f.id || f.name,
      label: f.label || f.name,
      type: f.options && f.options.length > 0 ? 'select' : 'text',
      options: f.options?.map((o: any) => ({ value: o.value || o, label: o.label || o.value || o }))
    }));
  }, [filteredAppFields]);

  const allFields = React.useMemo(() => [...nativeFields, ...customFields], [nativeFields, customFields]);
  const availableToAdd = React.useMemo(() => allFields.filter(f => !Object.prototype.hasOwnProperty.call(updates, f.key)), [allFields, updates]);

  const handleAddField = (fieldKey: string) => {
    if (!fieldKey || fieldKey === 'none') return;
    const fieldDef = allFields.find(f => f.key === fieldKey);
    if (!fieldDef) return;
    
    const nextUpdates = {
      ...updates,
      [fieldKey]: fieldDef.type === 'select' && fieldDef.options && fieldDef.options.length > 0 ? fieldDef.options[0].value : ''
    };

    const nextConfig: Record<string, any> = { updates: nextUpdates };
    if (['pipelineId', 'stageId', 'assignedTo'].includes(fieldKey)) {
      nextConfig[fieldKey] = nextUpdates[fieldKey];
    }
    updateConfig(nextConfig);
  };

  const handleUpdateFieldVal = (fieldKey: string, val: any) => {
    const nextUpdates = {
      ...updates,
      [fieldKey]: val
    };
    const nextConfig: Record<string, any> = { updates: nextUpdates };
    if (['pipelineId', 'stageId', 'assignedTo'].includes(fieldKey)) {
      nextConfig[fieldKey] = val;
    }
    if (fieldKey === 'pipelineId') {
      delete nextUpdates.stageId;
      nextConfig.stageId = '';
    }
    updateConfig(nextConfig);
  };

  const handleRemoveField = (fieldKey: string) => {
    const nextUpdates = { ...updates };
    delete nextUpdates[fieldKey];
    const nextConfig: Record<string, any> = { updates: nextUpdates };
    if (['pipelineId', 'stageId', 'assignedTo'].includes(fieldKey)) {
      nextConfig[fieldKey] = '';
    }
    updateConfig(nextConfig);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Add Field to Update</Label>
        <Select value="" onValueChange={handleAddField}>
          <SelectTrigger className="h-12 rounded-xl bg-card border text-sm font-semibold text-left">
            <SelectValue placeholder="+ Choose field to add..." />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] rounded-xl border bg-card/95 backdrop-blur-md">
            {availableToAdd.length > 0 ? (
              availableToAdd.map((f) => (
                <SelectItem key={f.key} value={f.key} className="rounded-lg text-xs font-semibold">
                  {f.label}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled className="text-xs">
                All fields added
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {Object.keys(updates).length > 0 ? (
        <div className="space-y-4 pt-2">
          <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Configured Field Updates</Label>
          {Object.entries(updates).map(([key, val]) => {
            const fieldDef = allFields.find(f => f.key === key) || { key, label: key, type: 'text', options: [] };
            return (
              <div key={key} className="p-4 rounded-2xl border bg-muted/20 flex flex-col gap-3 relative group/field">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">{fieldDef.label}</Label>
                  <button
                    type="button"
                    onClick={() => handleRemoveField(key)}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1 transition-all"
                  >
                    Remove
                  </button>
                </div>
                
                {fieldDef.type === 'select' ? (
                  <Select value={String(val ?? '')} onValueChange={(newVal) => handleUpdateFieldVal(key, newVal)}>
                    <SelectTrigger className="h-10 rounded-xl bg-card border text-xs font-semibold text-left">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px] rounded-xl border bg-card/95 backdrop-blur-md">
                      {fieldDef.options?.map((opt: any) => (
                        <SelectItem key={opt.value} value={String(opt.value)} className="rounded-lg text-xs font-semibold">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <MappableInputField
                    value={String(val ?? '')}
                    onChange={(newVal) => handleUpdateFieldVal(key, newVal)}
                    inputClassName="h-10"
                    placeholder={`Enter value for ${fieldDef.label}...`}
                    appFields={appFields}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-center border-2 border-dashed rounded-2xl border-border bg-muted/10">
          <p className="text-xs font-semibold text-muted-foreground">No fields configured yet. Select a field above to start updating.</p>
        </div>
      )}
    </div>
  );
});

interface CreateEntityConfigPanelProps {
  config: Record<string, any>;
  updateConfig: (updates: Record<string, any>) => void;
  singular: string;
  appFields: any[];
  fieldGroups: any[];
}

const CreateEntityConfigPanel = React.memo(function CreateEntityConfigPanel({
  config,
  updateConfig,
  singular,
  appFields,
  fieldGroups,
}: CreateEntityConfigPanelProps) {
  const customData = config.customData || {};
  const selectedType = config.entityType || 'institution';

  const filteredAppFields = React.useMemo(() => {
    if (!fieldGroups || !appFields) return [];
    const activeNonSystemGroupIds = new Set(
      (fieldGroups || [])
        .filter((g: any) => !g.isSystem)
        .map((g: any) => g.id)
    );

    const custom = (appFields || []).filter((f: any) => {
      const scopes = f.compatibilityScope || ['common'];
      const isCompatible = scopes.includes('common') || scopes.includes(selectedType);
      const isActive = f.status === 'active';
      const isNotHidden = f.type !== 'hidden';
      const belongsToNonSystemGroup = f.groupId && activeNonSystemGroupIds.has(f.groupId);
      
      return isCompatible && isActive && isNotHidden && belongsToNonSystemGroup;
    });

    const native = NATIVE_ENTITY_FIELDS.filter((f: any) => {
      const scopes = f.compatibilityScope || ['common'];
      return scopes.includes('common') || scopes.includes(selectedType);
    });

    const seen = new Set<string>();
    const combined: any[] = [];
    
    [...native, ...custom].forEach(f => {
      const key = f.id || f.name;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(f);
      }
    });

    return combined;
  }, [appFields, selectedType, fieldGroups]);

  const availableToAdd = React.useMemo(() => {
    return filteredAppFields.filter(f => !Object.prototype.hasOwnProperty.call(customData, f.id || f.name));
  }, [filteredAppFields, customData]);

  const handleAddCustomField = (fieldKey: string) => {
    if (!fieldKey || fieldKey === 'none') return;
    const nextCustomData = {
      ...customData,
      [fieldKey]: ''
    };
    updateConfig({ customData: nextCustomData });
  };

  const handleUpdateCustomFieldVal = (fieldKey: string, val: string) => {
    const nextCustomData = {
      ...customData,
      [fieldKey]: val
    };
    updateConfig({ customData: nextCustomData });
  };

  const handleRemoveCustomField = (fieldKey: string) => {
    const nextCustomData = { ...customData };
    delete nextCustomData[fieldKey];
    updateConfig({ customData: nextCustomData });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-5 rounded-3xl bg-muted/20 border border-border/50 text-left">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
          <Building className="h-4 w-4 text-primary animate-pulse" /> Core {singular} Details
        </h4>
        
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">{singular} Type</Label>
          <Select
            value={config.entityType || 'institution'}
            onValueChange={(v) => updateConfig({ entityType: v })}
          >
            <SelectTrigger className="h-10 rounded-xl bg-card border shadow-sm font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="institution">Institution (Business/School)</SelectItem>
              <SelectItem value="person">Person (Individual)</SelectItem>
              <SelectItem value="family">Family (Household)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">{singular} Name (Tag/Variable Supported)</Label>
          <MappableInputField 
            placeholder="e.g. {{1.body.name}}" 
            value={config.name || ''} 
            onChange={(val) => updateConfig({ name: val })} 
            inputClassName="h-10 shadow-sm"
            appFields={appFields}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Primary Phone (Variable Supported)</Label>
            <MappableInputField 
              placeholder="e.g. {{1.body.phone}}" 
              value={config.phone || ''} 
              onChange={(val) => updateConfig({ phone: val })} 
              inputClassName="h-10 shadow-sm"
              appFields={appFields}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Primary Email (Variable Supported)</Label>
            <MappableInputField 
              placeholder="e.g. {{1.body.email}}" 
              value={config.email || ''} 
              onChange={(val) => updateConfig({ email: val })} 
              inputClassName="h-10 shadow-sm"
              appFields={appFields}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 text-left">
        <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-2">Custom Fields Mapping</Label>
        
        <div className="space-y-2">
          <Select value="" onValueChange={handleAddCustomField}>
            <SelectTrigger className="h-12 rounded-xl bg-card border text-xs font-semibold text-left">
              <SelectValue placeholder="+ Map workspace custom field..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] rounded-xl border bg-card/95 backdrop-blur-md">
              {availableToAdd.length > 0 ? (
                availableToAdd.map((f) => (
                  <SelectItem key={f.id || f.name} value={f.id || f.name} className="rounded-lg text-xs font-semibold">
                    {f.label || f.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled className="text-xs">
                  All workspace fields mapped
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {Object.keys(customData).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(customData)
              .filter(([key]) => {
                return filteredAppFields.some(f => (f.id || f.name) === key);
              })
              .map(([key, val]) => {
                const fieldDef = (appFields || []).find(f => (f.id || f.name) === key) || { name: key, label: key };
                return (
                  <div key={key} className="p-4 rounded-2xl border bg-muted/10 flex flex-col gap-3 relative animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">{fieldDef.label || fieldDef.name}</Label>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(key)}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1 transition-all"
                      >
                        Remove
                      </button>
                    </div>
                    <MappableInputField
                      value={String(val ?? '')}
                      onChange={(newVal) => handleUpdateCustomFieldVal(key, newVal)}
                      inputClassName="h-10 rounded-xl bg-card border text-xs font-semibold"
                      placeholder={`e.g. {{1.body.${key}}} or static value`}
                      appFields={appFields}
                    />
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="p-6 text-center border-2 border-dashed rounded-2xl border-border bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground">No custom fields mapped yet. Select a field above to start mapping.</p>
          </div>
        )}
      </div>
    </div>
  );
});

interface ActionConfigPanelProps {
  actionType: string;
  config: Record<string, any>;
  onUpdateConfig: (updates: Record<string, any>) => void;
  users: UserProfile[];
  stages: OnboardingStage[];
  pipelines: Pipeline[];
  variables: VariableDefinition[];
  singular: string;
  automations?: Automation[];
  appFields?: any[];
  fieldGroups?: any[];
}

export const ActionConfigPanel = React.memo(function ActionConfigPanel({
  actionType,
  config,
  onUpdateConfig,
  users,
  stages,
  pipelines,
  variables,
  singular,
  automations = [],
  appFields = [],
  fieldGroups = [],
}: ActionConfigPanelProps) {
  const { toast } = useToast();
  const { activeWorkspace } = useWorkspace() as any;

  React.useEffect(() => {
    if (actionType === 'SEND_MESSAGE' && config.recipientTargets === undefined) {
      onUpdateConfig({ recipientTargets: ['triggering'] });
    }
  }, [actionType, config.recipientTargets, onUpdateConfig]);

  const updateConfig = (updates: Record<string, any>) => {
    onUpdateConfig(updates);
  };

  return (
    <div className="w-full">
      {actionType === 'SEND_MESSAGE' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-2">
              <Smartphone className="h-3 w-3" /> Channel
            </Label>
            <Select
              value={config.channel || 'email'}
              onValueChange={(v) => updateConfig({ channel: v })}
            >
              <SelectTrigger className="h-10 rounded-xl bg-card border shadow-sm font-bold px-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Master Template</Label>
            <MessagingTemplateSelector
              category="all"
              channel={(config.channel as 'email' | 'sms' | 'whatsapp') || 'email'}
              recipientType="all"
              value={config.templateId}
              onValueChange={(v) => updateConfig({ templateId: v })}
              onSelect={(tmpl) => updateConfig({ templateId: tmpl?.id || '', templateName: tmpl?.name || '' })}
              placeholder="Choose blueprint..."
              compact
            />
          </div>

          <div className="space-y-4">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Contact Recipients</Label>
            <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/50">
              {[
                { key: 'triggering', label: 'Triggering Contact', desc: 'The contact that triggered this automation' },
                { key: 'primary', label: 'Primary Contact', desc: 'The designated primary contact of the entity' },
                { key: 'signatories', label: 'Campus Signatories', desc: 'All contacts flagged as campus signatories' },
                { key: 'roles', label: 'Specific Role(s)', desc: 'Contacts with specific custom roles' },
                { key: 'all', label: 'All Contacts', desc: 'Send to all contacts associated with the entity' },
                { key: 'fixed', label: 'Manual Identity Entry', desc: 'Specify static destination addresses manually' },
              ].map((target) => {
                const currentTargets = config.recipientTargets === undefined ? ['triggering'] : (config.recipientTargets || []);
                const isChecked = currentTargets.includes(target.key as any);
                return (
                  <div key={target.key} className="flex flex-col space-y-1.5 animate-in fade-in duration-200">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = config.recipientTargets === undefined ? ['triggering'] : (config.recipientTargets || []);
                          const updated = e.target.checked
                            ? [...current, target.key]
                            : current.filter((k: string) => k !== target.key);
                          updateConfig({ recipientTargets: updated });
                        }}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary mt-0.5"
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold leading-none mb-0.5 text-foreground">{target.label}</span>
                        <span className="text-[9px] font-medium text-muted-foreground leading-none">{target.desc}</span>
                      </div>
                    </label>

                    {target.key === 'roles' && isChecked ? (
                      <div className="pl-6 pt-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {(config.recipientRoles || []).map((role: string) => (
                            <Badge key={role} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 rounded-lg bg-primary/10 text-primary border-none">
                              <span className="text-[10px] font-bold tracking-tight">{role}</span>
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 rounded-md hover:bg-primary/20"
                                onClick={() => updateConfig({ recipientRoles: config.recipientRoles.filter((r: string) => r !== role) })}
                              >
                                <XIcon className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                        <Input
                          placeholder="Type role and press Enter (e.g. Signatory, Billing)..."
                          id="new-role-input"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val) {
                                const current = config.recipientRoles || [];
                                if (!current.includes(val)) {
                                  updateConfig({ recipientRoles: [...current, val] });
                                }
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                          className="h-8 rounded-lg bg-background text-xs"
                        />
                      </div>
                    ) : null}

                    {target.key === 'fixed' && isChecked ? (
                      <div className="pl-6 pt-2 animate-in slide-in-from-top-1 duration-200">
                        <Label className="text-[9px] font-bold text-primary ml-1 block mb-1">Static Target (Tag Supported)</Label>
                        <MappableInputField 
                          placeholder="e.g. {{1.body.email}}" 
                          value={config.recipient || ''} 
                          onChange={(val) => updateConfig({ recipient: val })} 
                          inputClassName="font-mono text-xs px-4"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      
      {actionType.startsWith('SEND_NOTIFICATION_') ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Direct Notification To</Label>
            <div className="space-y-2.5 p-4 rounded-2xl bg-muted/20 border border-border/50">
              {[
                { key: 'assignee', label: 'Workspace Assignee', desc: 'Direct to the designated owner/manager of the entity' },
                { key: 'users', label: 'Selected Team Members', desc: 'Direct to specific workspace team members' },
                { key: 'custom', label: 'Custom Destination Address', desc: actionType === 'SEND_NOTIFICATION_SMS' ? 'Direct to a custom mobile number' : 'Direct to a custom email address' },
              ].map((target) => {
                const isChecked = (config.notificationTargets || []).includes(target.key as any);
                return (
                  <div key={target.key} className="flex flex-col space-y-1.5 animate-in fade-in duration-200">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = config.notificationTargets || [];
                          const updated = e.target.checked
                            ? [...current, target.key]
                            : current.filter((k: string) => k !== target.key);
                          updateConfig({ notificationTargets: updated });
                        }}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary mt-0.5"
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold leading-none mb-0.5 text-foreground">{target.label}</span>
                        <span className="text-[9px] font-medium text-muted-foreground leading-none">{target.desc}</span>
                      </div>
                    </label>

                    {target.key === 'users' && isChecked ? (
                      <div className="pl-6 pt-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
                        <Label className="text-[9px] font-bold text-primary ml-1 block mb-1">Target Workspace Users</Label>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {(config.notificationUserIds || []).map((uid: string) => {
                            const u = users?.find((user) => user.id === uid);
                            return (
                              <Badge key={uid} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 rounded-lg bg-primary/10 text-primary border-none animate-in zoom-in-95 duration-150">
                                <span className="text-[10px] font-bold tracking-tight">{u?.name || uid}</span>
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-4 w-4 rounded-md hover:bg-primary/20"
                                  onClick={() => updateConfig({ notificationUserIds: config.notificationUserIds.filter((id: string) => id !== uid) })}
                                >
                                  <XIcon className="h-3 w-3" />
                                </Button>
                              </Badge>
                            );
                          })}
                        </div>
                        <Select 
                          value="" 
                          onValueChange={(v) => {
                            const current = config.notificationUserIds || [];
                            if (!current.includes(v)) {
                              updateConfig({ notificationUserIds: [...current, v] });
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 rounded-lg bg-background text-xs border border-border/50 px-3">
                            <SelectValue placeholder="Add workspace users..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[250px] overflow-y-auto">
                            {(users || []).map((u) => (
                              <SelectItem key={u.id} value={u.id} className="rounded-lg p-2 font-semibold">
                                {u.name} ({u.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {target.key === 'custom' && isChecked ? (
                      <div className="pl-6 pt-2 animate-in slide-in-from-top-1 duration-200">
                        <Label className="text-[9px] font-bold text-primary ml-1 block mb-1">
                          {actionType === 'SEND_NOTIFICATION_SMS' ? 'Custom Mobile Number' : 'Custom Email Address'}
                        </Label>
                        <MappableInputField 
                          placeholder={actionType === 'SEND_NOTIFICATION_SMS' ? 'e.g. {{1.body.phone}}' : 'e.g. {{1.body.email}}'} 
                          value={config.customRecipient || ''} 
                          onChange={(val) => updateConfig({ customRecipient: val })} 
                          inputClassName="font-mono text-xs px-4"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Master Template</Label>
            <MessagingTemplateSelector 
              category="all"
              channel={
                actionType === 'SEND_NOTIFICATION_EMAIL' ? 'email' :
                actionType === 'SEND_NOTIFICATION_SMS' ? 'sms' :
                actionType === 'SEND_NOTIFICATION_IN_APP' ? 'in_app' :
                'push'
              }
              recipientType="all"
              value={config.templateId}
              onValueChange={(v) => updateConfig({ templateId: v })}
              onSelect={(tmpl) => updateConfig({ templateId: tmpl?.id || '', templateName: tmpl?.name || '' })}
              placeholder="Choose blueprint..."
              compact
            />
          </div>
        </div>
      ) : null}
      
      {actionType === 'CREATE_TASK' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Task Definition</Label>
            <MappableInputField 
              placeholder="e.g. Follow up with {{1.body.name}}" 
              value={config.title || ''} 
              onChange={(val) => updateConfig({ title: val })} 
              inputClassName="h-12 font-bold text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Priority</Label>
              <Select value={config.priority || 'medium'} onValueChange={(v) => updateConfig({ priority: v })}>
                <SelectTrigger className="h-10 rounded-xl bg-card shadow-sm font-semibold text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="low" className="text-[10px] font-semibold ">Low</SelectItem>
                  <SelectItem value="medium" className="text-[10px] font-semibold ">Medium</SelectItem>
                  <SelectItem value="high" className="text-[10px] font-semibold text-orange-500">High</SelectItem>
                  <SelectItem value="urgent" className="text-[10px] font-semibold text-rose-500">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">SLA Target</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={config.dueOffsetDays || 3} 
                  onChange={(e) => updateConfig({ dueOffsetDays: parseInt(e.target.value, 10) || 0 })} 
                  className="h-10 rounded-xl bg-card text-center font-semibold w-16"
                />
                <span className="text-[9px] font-bold opacity-40">Days</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-left">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assigned Identity</Label>
            <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="Auto-Resolve from Entity" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                <SelectItem value="auto" className="font-semibold italic text-primary rounded-lg py-2.5">Auto-Resolve (Manager)</SelectItem>
                {users?.map(u => (
                  <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'UPDATE_ENTITY' ? (
        <UpdateEntityConfigPanel
          config={config}
          updateConfig={updateConfig}
          users={users}
          pipelines={pipelines}
          stages={stages}
          activeWorkspace={activeWorkspace}
          appFields={appFields}
          fieldGroups={fieldGroups}
        />
      ) : null}

      {actionType === 'ASSIGN_ENTITY' ? (
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assign To</Label>
          <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
            <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl p-2 max-h-[300px] overflow-y-auto">
              <SelectItem value="auto">Auto-Resolve (Manager)</SelectItem>
              {users?.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {actionType === 'ADD_NOTE' ? (
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Note Content</Label>
          <MappableInputField
            placeholder="e.g. Automated follow-up for {{1.body.name}}"
            value={config.content || ''}
            onChange={(val) => updateConfig({ content: val })}
            inputClassName="font-bold text-sm"
            isTextArea
          />
        </div>
      ) : null}

      {actionType === 'TRIGGER_OUTBOUND_WEBHOOK' ? (
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Webhook ID</Label>
          <MappableInputField
            placeholder="Firestore webhook document ID"
            value={config.webhookId || ''}
            onChange={(val) => updateConfig({ webhookId: val })}
            inputClassName="font-mono text-sm"
          />
        </div>
      ) : null}

      {actionType === 'UPDATE_TASK' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Status</Label>
            <Select value={config.status || ''} onValueChange={(v) => updateConfig({ status: v })}>
              <SelectTrigger className="h-10 rounded-xl bg-card font-bold"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'RUN_AUTOMATION' ? (
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Select Automation</Label>
          <Select
            value={config.automationId || ''}
            onValueChange={(val) => {
              const matched = automations?.find(a => a.id === val);
              updateConfig({ 
                automationId: val, 
                automationName: matched ? (matched.name || 'Unnamed Automation') : '' 
              });
            }}
          >
            <SelectTrigger className="h-12 rounded-xl bg-card border text-sm font-semibold text-left">
              <SelectValue placeholder="Choose an automation to run..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] rounded-xl border bg-card/95 backdrop-blur-md">
              {automations && automations.length > 0 ? (
                automations.map((auto) => (
                  <SelectItem key={auto.id} value={auto.id || ''} className="rounded-lg text-xs font-semibold">
                    {auto.name || 'Unnamed Automation'}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled className="text-xs">
                  No active automations found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {actionType === 'CREATE_DEAL' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Deal Title (Tag Supported)</Label>
            <MappableInputField 
              placeholder="e.g. {{1.body.name}} Deal" 
              value={config.name || ''} 
              onChange={(val) => updateConfig({ name: val })} 
              inputClassName="h-12 font-bold text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Estimated Value ($)</Label>
              <Input 
                type="number"
                placeholder="0.00" 
                value={config.value || ''} 
                onChange={(e) => updateConfig({ value: parseFloat(e.target.value) || 0 })} 
                className="h-12 rounded-xl bg-card border shadow-sm font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assignee</Label>
              <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-semibold text-xs"><SelectValue placeholder="Auto-Resolve" /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                  <SelectItem value="auto" className="font-semibold italic text-primary rounded-lg py-2.5">Auto-Resolve (Entity Owner)</SelectItem>
                  {users?.map(u => (
                    <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Pipeline</Label>
            <Select value={config.pipelineId || ''} onValueChange={(val) => updateConfig({ pipelineId: val, stageId: '' })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="Select Pipeline..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                {pipelines?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Stage (Optional)</Label>
            <Select value={config.stageId || ''} onValueChange={(val) => updateConfig({ stageId: val })} disabled={!config.pipelineId}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="First Pipeline Stage" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                {stages?.filter(s => s.pipelineId === config.pipelineId).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'UPDATE_DEAL_STAGE' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Filter by Pipeline</Label>
            <Select value={config.pipelineId || ''} onValueChange={(val) => updateConfig({ pipelineId: val, stageId: '' })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="All Pipelines..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                <SelectItem value="">All Pipelines</SelectItem>
                {pipelines?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Stage</Label>
            <Select value={config.stageId || ''} onValueChange={(val) => updateConfig({ stageId: val })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="Select stage to move to..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                {stages?.filter(s => !config.pipelineId || s.pipelineId === config.pipelineId).map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({pipelines?.find(p => p.id === s.pipelineId)?.name || 'Default Pipeline'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'UPDATE_DEAL_VALUE' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">New Value ($)</Label>
            <MappableInputField 
              placeholder="e.g. 5000 or {{1.body.value}}" 
              value={config.value || ''} 
              onChange={(val) => updateConfig({ value: val })} 
              inputClassName="font-mono text-sm"
            />
            <span className="text-[9px] font-semibold text-muted-foreground leading-relaxed block ml-1 opacity-70">
              Tip: Prefix with + or - to perform a relative adjustment of the deal value.
            </span>
          </div>
        </div>
      ) : null}

      {actionType === 'UPDATE_DEAL_STATUS' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Status</Label>
            <Select value={config.status || 'open'} onValueChange={(v) => updateConfig({ status: v })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="open">Open (Active)</SelectItem>
                <SelectItem value="won">Won (Closed Won)</SelectItem>
                <SelectItem value="lost">Lost (Closed Lost)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'CREATE_ENTITY' ? (
        <CreateEntityConfigPanel
          config={config}
          updateConfig={updateConfig}
          singular={singular}
          appFields={appFields}
          fieldGroups={fieldGroups}
        />
      ) : null}

      {actionType === 'ADD_CONTACT_TO_ENTITY' ? (
        <div className="space-y-6">
          <div className="space-y-4 p-5 rounded-3xl bg-muted/20 border border-border/50 text-left">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Building className="h-4 w-4 text-primary animate-pulse" /> Target Entity Selection
            </h4>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Entity Name (Variable Supported)</Label>
              <Input 
                placeholder="e.g. {{companyName}} or {{contact.company}}" 
                value={config.entityName || ''} 
                onChange={(e) => updateConfig({ entityName: e.target.value })} 
                className="h-10 rounded-xl bg-card border shadow-sm font-semibold"
              />
              <span className="text-[9px] font-medium text-muted-foreground leading-relaxed block ml-1 opacity-70">
                Note: Locates the entity in this workspace with the display name matching this field.
              </span>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!config.caseInsensitive}
                    onChange={(e) => updateConfig({ caseInsensitive: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary mt-0.5"
                  />
                  <div className="flex flex-col text-left">
                    <span className="text-[11px] font-bold leading-none mb-0.5 text-foreground">Case-Insensitive Match</span>
                    <span className="text-[9px] font-medium text-muted-foreground leading-none">Allow matching even if capitalization differs</span>
                  </div>
                </label>
              </div>

              {!config.caseInsensitive && (
                <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 leading-relaxed block ml-1 pt-1">
                  ⚠️ Exact Case Sensitivity: Matching display names will be case-sensitive.
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 p-5 rounded-3xl bg-muted/20 border border-border/50 text-left">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Contact Details
            </h4>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Contact Name (Variable Supported)</Label>
              <Input 
                placeholder="e.g. {{contact.name}}" 
                value={config.contactName || ''} 
                onChange={(e) => updateConfig({ contactName: e.target.value })} 
                className="h-10 rounded-xl bg-card border shadow-sm font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Contact Phone (Variable Supported)</Label>
                <Input 
                  placeholder="e.g. {{contact.phone}}" 
                  value={config.contactPhone || ''} 
                  onChange={(e) => updateConfig({ contactPhone: e.target.value })} 
                  className="h-10 rounded-xl bg-card border shadow-sm font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Contact Email (Variable Supported)</Label>
                <Input 
                  placeholder="e.g. {{contact.email}}" 
                  value={config.contactEmail || ''} 
                  onChange={(e) => updateConfig({ contactEmail: e.target.value })} 
                  className="h-10 rounded-xl bg-card border shadow-sm font-semibold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Contact Role / Type (e.g. Billing, Manager)</Label>
              <Input 
                placeholder="e.g. Billing Officer or {{contact.role}}" 
                value={config.contactRole || ''} 
                onChange={(e) => updateConfig({ contactRole: e.target.value })} 
                className="h-10 rounded-xl bg-card border shadow-sm font-semibold"
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!config.isPrimary}
                  onChange={(e) => updateConfig({ isPrimary: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary mt-0.5"
                />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-none mb-0.5 text-foreground">Designated Primary</span>
                  <span className="text-[9px] font-medium text-muted-foreground leading-none">Make primary contact of this entity</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!config.isSignatory}
                  onChange={(e) => updateConfig({ isSignatory: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary mt-0.5"
                />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-none mb-0.5 text-foreground">Designated Signatory</span>
                  <span className="text-[9px] font-medium text-muted-foreground leading-none">Make signatory of this entity</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {actionType === 'UPDATE_LEAD_SCORE' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Operation</Label>
            <Select value={config.operation || 'add'} onValueChange={(v) => updateConfig({ operation: v })}>
              <SelectTrigger className="h-10 rounded-xl bg-card font-bold"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="add">Add Points (+)</SelectItem>
                <SelectItem value="subtract">Subtract Points (-)</SelectItem>
                <SelectItem value="set">Set Score To (=)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Value (Points)</Label>
            <MappableInputField 
              placeholder="e.g. 10 or {{1.body.score_value}}" 
              value={config.value !== undefined ? String(config.value) : ''} 
              onChange={(val) => {
                const parsed = Number(val);
                updateConfig({ value: isNaN(parsed) ? val : parsed });
              }} 
              inputClassName="font-mono text-sm"
              appFields={appFields}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Contact (Optional)</Label>
            <MappableInputField 
              placeholder="e.g. {{1.body.email}} or {{1.body.contactId}}" 
              value={config.contactEmailOrId || ''} 
              onChange={(val) => updateConfig({ contactEmailOrId: val })} 
              inputClassName="font-mono text-xs"
              appFields={appFields}
            />
            <span className="text-[9px] font-medium text-muted-foreground leading-relaxed block ml-1 opacity-70">
              Leave blank to automatically target the triggering contact, primary contact, or first contact in the entity.
            </span>
          </div>
        </div>
      ) : null}

      {actionType === 'END_AUTOMATION' ? (
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2 text-center text-xs">
          <CheckSquare className="h-8 w-8 text-primary mx-auto opacity-60" />
          <p className="font-bold text-sm">End/Complete Flow Step</p>
          <p className="text-[10px] text-muted-foreground">Flow execution ends here. The workflow run status will update to "completed".</p>
        </div>
      ) : null}
    </div>
  );
});
