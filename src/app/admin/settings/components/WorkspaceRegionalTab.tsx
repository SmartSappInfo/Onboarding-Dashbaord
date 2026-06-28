'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import type { Workspace, ContactIdentifierPolicy, EntityDefaults } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { saveWorkspaceAction } from '@/lib/workspace-actions';
import { 
  Sliders, 
  MapPin, 
  Globe, 
  Phone, 
  Mail, 
  MailCheck, 
  ShieldCheck, 
  Lock, 
  Eye, 
  Loader2, 
  Plus, 
  X, 
  Info,
  Check
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' }
];

const COUNTRIES = [
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' }
];

const IANA_TIMEZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'Africa/Accra', 'Africa/Lagos', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'];
  }
})();

export interface WorkspaceRegionalTabProps {
  workspace: Workspace;
  onSaveSuccess: () => void;
}

export default function WorkspaceRegionalTab({ workspace, onSaveSuccess }: WorkspaceRegionalTabProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const [isSaving, setIsSaving] = React.useState(false);

  const scope = (workspace.contactScope || 'institution') as 'institution' | 'family' | 'person';

  const [contactPolicySetting, setContactPolicySetting] = React.useState<ContactIdentifierPolicy>(
    workspace.contactPolicy || 'phone_or_email'
  );
  const [restrictVisibilityToAssigned, setRestrictVisibilityToAssigned] = React.useState(
    workspace.restrictVisibilityToAssigned !== false
  );

  // Load defaults from state
  const [entityDefaults, setEntityDefaults] = React.useState<Record<string, string>>(() => {
    const rawDefaults = (workspace.entityDefaults || {}) as Record<string, Record<string, string>>;
    return rawDefaults[scope] || {};
  });

  const [newKey, setNewKey] = React.useState('');
  const [newValue, setNewValue] = React.useState('');

  React.useEffect(() => {
    setContactPolicySetting(workspace.contactPolicy || 'phone_or_email');
    setRestrictVisibilityToAssigned(workspace.restrictVisibilityToAssigned !== false);
    const rawDefaults = (workspace.entityDefaults || {}) as Record<string, Record<string, string>>;
    setEntityDefaults(rawDefaults[scope] || {});
  }, [workspace, scope]);

  const updateDefaultValue = (keyName: string, valueStr: string) => {
    setEntityDefaults(prev => ({
      ...prev,
      [keyName]: valueStr
    }));
  };

  const removeDefaultValue = (keyName: string) => {
    setEntityDefaults(prev => {
      const next = { ...prev };
      delete next[keyName];
      return next;
    });
  };

  const handleAddDefault = () => {
    if (!newKey.trim()) return;
    updateDefaultValue(newKey.trim(), newValue.trim());
    setNewKey('');
    setNewValue('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const updatedEntityDefaults: EntityDefaults = {
        ...workspace.entityDefaults,
        [scope]: entityDefaults
      };

      const result = await saveWorkspaceAction(
        workspace.id,
        {
          contactPolicy: contactPolicySetting,
          restrictVisibilityToAssigned,
          entityDefaults: updatedEntityDefaults
        },
        user.uid
      );

      if (result.success) {
        toast({ title: 'Workspace Settings Saved', description: 'Localization & policies updated successfully.' });
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

  const SUGGESTED_KEYS: Record<string, string[]> = {
    institution: ['currency', 'countryCode', 'timezone', 'language', 'leadSource', 'billingAddress', 'subscriptionPackageName'],
    family: ['countryCode', 'timezone', 'language', 'leadSource', 'relationship'],
    person: ['countryCode', 'timezone', 'language', 'jobTitle', 'leadSource', 'company'],
  };
  const suggestedKeys = SUGGESTED_KEYS[scope] || [];
  const unusedSuggestions = suggestedKeys.filter(k => !(k in entityDefaults));

  return (
    <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden text-left">
      <CardHeader className="p-8 border-b">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" />
          Workspace Localization & Rules
        </CardTitle>
        <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
          Configure local workspace defaults, contact identifiers requirements, and record visibility.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSave} className="space-y-10">

          {/* Section 1: Contact Identifier Policy */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Globe className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold">Contact Identifier Policy</h4>
            </div>

            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
              Determines which contact fields must be provided before saving records in this hub.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                { value: 'phone_only' as const, icon: Phone, label: 'Phone Only', desc: 'Only phone number required — SMS-first workflows' },
                { value: 'email_only' as const, icon: Mail, label: 'Email Only', desc: 'Only email required — email-first campaigns' },
                { value: 'phone_or_email' as const, icon: MailCheck, label: 'Phone or Email', desc: 'Either phone or email acceptable (default)' },
              ]).map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setContactPolicySetting(value)}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all text-left hover:shadow-md active:scale-[0.97]",
                    contactPolicySetting === value
                      ? "bg-primary/5 border-primary shadow-sm"
                      : "bg-background border-border hover:border-primary/30"
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        contactPolicySetting === value ? "bg-primary/10" : "bg-muted"
                      )}>
                        <Icon className={cn(
                          "h-4 w-4",
                          contactPolicySetting === value ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      {contactPolicySetting === value && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <h5 className="text-xs font-semibold text-foreground">{label}</h5>
                      <p className="text-[8.5px] font-medium text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Section 2: Entity Visibility Scope */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <MapPin className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold">Entity Visibility Scope</h4>
            </div>

            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
              Determine whether users in this workspace can see all entities or only the ones explicitly assigned to them.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRestrictVisibilityToAssigned(true)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all text-left hover:shadow-md active:scale-[0.97]",
                  restrictVisibilityToAssigned
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "bg-background border-border hover:border-primary/30"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      restrictVisibilityToAssigned ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Lock className="h-4 w-4 text-primary" style={{ color: restrictVisibilityToAssigned ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                    </div>
                    {restrictVisibilityToAssigned && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-semibold text-foreground">Assigned Only (Default)</h5>
                    <p className="text-[8.5px] font-medium text-muted-foreground leading-relaxed">
                      Users can only view and interact with entities specifically assigned to them.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRestrictVisibilityToAssigned(false)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all text-left hover:shadow-md active:scale-[0.97]",
                  !restrictVisibilityToAssigned
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "bg-background border-border hover:border-primary/30"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      !restrictVisibilityToAssigned ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Eye className="h-4 w-4 text-primary" style={{ color: !restrictVisibilityToAssigned ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                    </div>
                    {!restrictVisibilityToAssigned && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-semibold text-foreground">All Entities</h5>
                    <p className="text-[8.5px] font-medium text-muted-foreground leading-relaxed">
                      Users can view and interact with all entities in the workspace.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Section 3: Entity Defaults Configuration */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-1">
              <Sliders className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold">Entity Defaults</h4>
              <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4 ml-auto">Per Workspace</Badge>
            </div>

            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
              Configure default values that are auto-applied to entities during bulk imports or creation pages.
            </p>

            <div className="space-y-4 max-w-xl">
              {Object.entries(entityDefaults).map(([keyName, valueStr]) => (
                <div key={keyName} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 border border-border/40 group">
                  <span className="text-xs font-bold text-primary min-w-[140px] truncate">{keyName}</span>
                  
                  {keyName === 'language' ? (
                    <Select value={valueStr} onValueChange={(val) => updateDefaultValue(keyName, val)}>
                      <SelectTrigger className="h-9 rounded-xl bg-background border-none flex-1 font-semibold text-xs shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(l => (
                          <SelectItem key={l.code} value={l.code} className="text-xs font-semibold">{l.flag} {l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : keyName === 'countryCode' ? (
                    <Select value={valueStr} onValueChange={(val) => updateDefaultValue(keyName, val)}>
                      <SelectTrigger className="h-9 rounded-xl bg-background border-none flex-1 font-semibold text-xs shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => (
                          <SelectItem key={c.code} value={c.code} className="text-xs font-semibold">{c.flag} {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : keyName === 'timezone' ? (
                    <Select value={valueStr} onValueChange={(val) => updateDefaultValue(keyName, val)}>
                      <SelectTrigger className="h-9 rounded-xl bg-background border-none flex-1 font-semibold text-xs shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IANA_TIMEZONES.map(t => (
                          <SelectItem key={t} value={t} className="text-xs font-semibold">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      value={valueStr} 
                      onChange={e => updateDefaultValue(keyName, e.target.value)}
                      className="h-9 rounded-xl bg-background border-none font-semibold text-xs shadow-sm flex-1" 
                    />
                  )}

                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeDefaultValue(keyName)}
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}

              <div className="flex items-center gap-3 pt-2">
                {unusedSuggestions.length > 0 ? (
                  <Select value={newKey} onValueChange={setNewKey}>
                    <SelectTrigger className="h-10 rounded-xl font-semibold text-xs w-[160px] bg-muted/20 border-none shadow-sm">
                      <SelectValue placeholder="Select Default Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {unusedSuggestions.map(k => (
                        <SelectItem key={k} value={k} className="text-xs font-semibold">{k}</SelectItem>
                      ))}
                      <SelectItem value="__custom" className="text-xs font-semibold">+ Custom field</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="Field key name"
                    className="h-10 rounded-xl font-semibold text-xs w-[160px] bg-muted/20 border-none shadow-sm"
                  />
                )}

                {newKey === '__custom' ? (
                  <Input 
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="Enter custom key..."
                    className="h-10 rounded-xl font-semibold text-xs w-[160px] bg-muted/20 border-none shadow-sm"
                  />
                ) : null}

                <Input 
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  placeholder="Enter default value"
                  className="h-10 rounded-xl font-semibold text-xs bg-muted/20 border-none shadow-sm flex-1"
                />

                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleAddDefault}
                  disabled={!newKey.trim() || newKey === '__custom'}
                  className="h-10 rounded-xl text-xs font-bold px-4 active:scale-95 transition-transform"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>

              {Object.keys(entityDefaults).length === 0 && (
                <p className="text-[10px] font-medium text-muted-foreground italic text-center py-4">
                  No workspace-specific overrides configured. Default rules will fallback to organization defaults.
                </p>
              )}

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 mt-4">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[9px] font-medium text-blue-800/70 leading-relaxed text-left">
                  Priority Resolution order: Imported entity data overrides local workspace defaults, which override global organization localization rules.
                </p>
              </div>
            </div>
          </div>

          {/* Form Save Button Footer */}
          <div className="pt-6 border-t flex justify-end">
            <Button 
              type="submit" 
              disabled={isSaving} 
              className="rounded-xl font-semibold px-10 shadow-2xl bg-primary text-white text-xs h-12 active:scale-[0.97] transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving Localization...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Save Localization & Rules
                </>
              )}
            </Button>
          </div>

        </form>
      </CardContent>
    </Card>
  );
}
