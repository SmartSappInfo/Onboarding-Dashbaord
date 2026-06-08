import React, { useState, useEffect } from 'react';
import { ImportState } from '../../types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Tag as TagIcon, Zap, Settings2, Info, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getContactPolicyLabel } from '@/lib/contact-policy';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { ContactIdentifierPolicy } from '@/lib/types';
import { TagSelector } from '@/components/tags/TagSelector';

interface Props {
  state: ImportState;
  updateState: (s: Partial<ImportState>) => void;
  onNext: () => void;
  onBack: () => void;
}

// Scope-aware default field definitions
const DEFAULT_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
  person: [
    { key: 'leadSource', label: 'Default Lead Source', placeholder: 'e.g., File Import, Event 2024...' },
    { key: 'jobTitle', label: 'Default Job Title', placeholder: 'e.g., Prospect' },
    { key: 'company', label: 'Default Company', placeholder: 'e.g., Unknown' },
  ],
  family: [
    { key: 'leadSource', label: 'Default Lead Source', placeholder: 'e.g., Open Day, Referral...' },
    { key: 'guardian1_relationship', label: 'Default Guardian Relationship', placeholder: 'e.g., Parent' },
  ],
  institution: [
    { key: 'leadSource', label: 'Default Lead Source', placeholder: 'e.g., File Import, Partner Referral...' },
    { key: 'currency', label: 'Default Currency', placeholder: 'e.g., USD, GHS' },
  ],
};

export function ConfigurationStep({ state, updateState, onNext, onBack }: Props) {
  const firestore = useFirestore();
  const { activeWorkspace } = useWorkspace();
  const [availableAutomations, setAvailableAutomations] = useState<Array<{ id: string, name: string }>>([]);

  const contactPolicy: ContactIdentifierPolicy = activeWorkspace?.contactPolicy || 'phone_or_email';
  const entityType = state.entityType || 'institution';
  const scopeKey = (activeWorkspace?.contactScope || entityType) as 'institution' | 'family' | 'person';
  const workspaceDefaults = activeWorkspace?.entityDefaults?.[scopeKey] || {};
  const wsDefaultEntries = Object.entries(workspaceDefaults);

  const config = state.configuration || {
    selectedTags: [],
    selectedAutomations: [],
    globalDefaults: {}
  };

  useEffect(() => {
    async function loadResources() {
      if (!firestore || !state.workspaceId || !state.organizationId) return;

      try {
        // Load Automations
        const autoRef = collection(firestore, 'automations');
        const qAuto = query(autoRef, where('workspaceIds', 'array-contains', state.workspaceId), where('isActive', '==', true));
        const autoSnap = await getDocs(qAuto);
        const loadedAuto = autoSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
        setAvailableAutomations(loadedAuto);
      } catch (err) {
        console.error("Failed to load automations:", err);
      }
    }

    loadResources();
  }, [firestore, state.workspaceId, state.organizationId]);

  const toggleAutomation = (id: string) => {
    const current = config.selectedAutomations || [];
    const next = current.includes(id)
      ? current.filter(a => a !== id)
      : [...current, id];

    updateState({
      configuration: { ...config, selectedAutomations: next }
    });
  };

  const handleDefaultChange = (key: string, value: string) => {
    updateState({
      configuration: {
        ...config,
        globalDefaults: {
          ...config.globalDefaults,
          [key]: value
        }
      }
    });
  };

  const defaultFields = DEFAULT_FIELDS[entityType] || DEFAULT_FIELDS.institution;

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center">Enrichment & Configuration</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Apply tags, trigger automations, and set default values for all imported contacts.
          </p>
        </div>
      </div>

      {/* Workspace Context Banner */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Workspace Import Context</span>
          <Badge variant="outline" className="text-[8px] h-4 px-1.5 ml-auto">{activeWorkspace?.industry || 'SaaS'}</Badge>
          <Badge variant="outline" className="text-[8px] h-4 px-1.5">{getContactPolicyLabel(contactPolicy)}</Badge>
        </div>

        {wsDefaultEntries.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" /> Workspace defaults that will auto-apply to empty fields:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {wsDefaultEntries.map(([key, value]) => (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border text-[9px] font-medium">
                  <span className="text-primary font-bold">{key}</span>
                  <span className="text-muted-foreground">= {value}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {wsDefaultEntries.length === 0 && (
          <p className="text-[9px] font-medium text-muted-foreground italic">
            No workspace-level defaults configured. Values set below will be applied as import defaults.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-8">

        {/* TAGS SECTION */}
        <section className="space-y-4">
          <h4 className="text-md font-medium flex items-center text-foreground">
            <TagIcon className="w-4 h-4 mr-2 text-primary" /> Apply Tags
          </h4>
          <div className="bg-card/50 border rounded-xl p-5 shadow-sm">
            <TagSelector
              currentTagIds={config.selectedTags || []}
              onTagsChange={(tagIds) => {
                React.startTransition(() => {
                  updateState({
                    configuration: { ...config, selectedTags: tagIds }
                  });
                });
              }}
            />
          </div>
        </section>

        {/* AUTOMATIONS SECTION */}
        <section className="space-y-4">
          <h4 className="text-md font-medium flex items-center text-foreground">
            <Zap className="w-4 h-4 mr-2 text-amber-500" /> Enroll in Automations
          </h4>
          <div className="bg-card/50 border rounded-xl p-5 shadow-sm space-y-3">
            {availableAutomations.map(auto => {
              const isSelected = config.selectedAutomations.includes(auto.id);
              return (
                <label key={auto.id} className="flex items-center space-x-3 p-3 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary rounded border-muted-foreground focus:ring-primary"
                    checked={isSelected}
                    onChange={() => toggleAutomation(auto.id)}
                  />
                  <span className="text-sm font-medium">{auto.name}</span>
                </label>
              )
            })}
            {availableAutomations.length === 0 && (
              <span className="text-sm text-muted-foreground italic">No active automations found for this workspace.</span>
            )}
          </div>
        </section>

        {/* SCOPE-AWARE DEFAULTS SECTION */}
        <section className="space-y-4 pb-4">
          <h4 className="text-md font-medium flex items-center text-foreground">
            <Settings2 className="w-4 h-4 mr-2 text-blue-500" /> Import Defaults
            <Badge variant="outline" className="text-[8px] ml-2 h-4 px-1.5">{entityType}</Badge>
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            These values override workspace defaults and apply to every entity where the field is empty in the CSV.
          </p>
          <div className="bg-card/50 border rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            {defaultFields.map(field => (
              <div key={field.key} className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  {field.label}
                  {workspaceDefaults[field.key] && (
                    <span className="text-[8px] text-muted-foreground font-normal">
                      (ws default: {workspaceDefaults[field.key]})
                    </span>
                  )}
                </Label>
                <Input
                  placeholder={field.placeholder}
                  value={config.globalDefaults[field.key] || ''}
                  onChange={e => handleDefaultChange(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Priority explanation */}
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
              <strong>Priority chain:</strong> CSV data (highest) → Import defaults (above) → Workspace defaults → System defaults (lowest).
            </p>
          </div>
        </section>

      </div>

      <div className="flex justify-between mt-auto pt-6 border-t">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={onNext} className="shadow-md">
          Validate Data <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
