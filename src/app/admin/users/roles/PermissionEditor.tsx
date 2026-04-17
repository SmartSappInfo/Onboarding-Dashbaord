'use client';

import * as React from 'react';
import { 
  PermissionsSchema, 
  SectionPermissions, 
  FeaturePermissionSet, 
  AppPermissionAction 
} from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Shield, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';

interface PermissionEditorProps {
  schema: PermissionsSchema;
  onChange: (updatedSchema: PermissionsSchema) => void;
  readOnly?: boolean;
}

const SECTIONS: { id: keyof PermissionsSchema; label: string; description: string }[] = [
  { id: 'operations', label: 'Operations', description: 'Dashboard, Campuses, Pipeline, and Daily Tasks' },
  { id: 'finance', label: 'Finance Hub', description: 'Agreements, Invoices, Packages, and Billing' },
  { id: 'studios', label: 'Studios', description: 'Portals, Landing Pages, Messaging, and Media' },
  { id: 'management', label: 'Management', description: 'Users, Settings, and Field Definitions' },
];

const SECTION_FEATURES: Record<keyof PermissionsSchema, { id: string; label: string }[]> = {
  operations: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'campuses', label: 'Campuses' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'meetings', label: 'Meetings' },
    { id: 'automations', label: 'Automations' },
    { id: 'intelligence', label: 'Intelligence' },
  ],
  finance: [
    { id: 'agreements', label: 'Agreements' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'packages', label: 'Packages' },
    { id: 'cycles', label: 'Cycles' },
    { id: 'billingSetup', label: 'Billing Setup' },
  ],
  studios: [
    { id: 'publicPortals', label: 'Public Portals' },
    { id: 'landingPages', label: 'Landing Pages' },
    { id: 'media', label: 'Media' },
    { id: 'surveys', label: 'Surveys' },
    { id: 'docSigning', label: 'Doc Signing' },
    { id: 'messaging', label: 'Messaging' },
    { id: 'forms', label: 'Forms' },
    { id: 'tags', label: 'Tags' },
  ],
  management: [
    { id: 'activities', label: 'Activities' },
    { id: 'users', label: 'Users' },
    { id: 'fields', label: 'Fields & Variables' },
    { id: 'systemSettings', label: 'System Settings' },
  ],
};

const ACTIONS: { id: AppPermissionAction; label: string }[] = [
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'delete', label: 'Delete' },
];

export function PermissionEditor({ schema, onChange, readOnly = false }: PermissionEditorProps) {
  
  const handleSectionToggle = (sectionId: keyof PermissionsSchema, enabled: boolean) => {
    const newSchema = { ...schema };
    newSchema[sectionId] = { ...newSchema[sectionId], enabled };
    onChange(newSchema);
  };

  const handleFeatureToggle = (sectionId: keyof PermissionsSchema, featureId: string, enabled: boolean) => {
    const newSchema = { ...schema };
    const section = { ...newSchema[sectionId] };
    const features = { ...section.features };
    
    if (enabled) {
      features[featureId] = { view: true };
    } else {
      delete features[featureId];
    }
    
    section.features = features;
    newSchema[sectionId] = section;
    onChange(newSchema);
  };

  const handleActionToggle = (
    sectionId: keyof PermissionsSchema, 
    featureId: string, 
    action: AppPermissionAction, 
    enabled: boolean
  ) => {
    const newSchema = { ...schema };
    const section = { ...newSchema[sectionId] };
    const features = { ...section.features };
    const feature = { ...features[featureId] };
    
    feature[action] = enabled;
    
    // Rule: If you enable any action, you must have 'view'
    if (enabled && action !== 'view') {
      feature.view = true;
    }
    
    // Rule: If you disable 'view', you disable everything for that feature
    if (action === 'view' && !enabled) {
      feature.create = false;
      feature.edit = false;
      feature.delete = false;
    }

    features[featureId] = feature;
    section.features = features;
    newSchema[sectionId] = section;
    onChange(newSchema);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {SECTIONS.map((section) => {
        const isSectionEnabled = schema[section.id].enabled;
        
        return (
          <Card key={section.id} className={cn(
            "rounded-[2rem] border-none ring-1 transition-all overflow-hidden",
            isSectionEnabled ? "ring-primary/20 bg-primary/5" : "ring-border bg-muted/20"
          )}>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold tracking-tight">{section.label}</CardTitle>
                <CardDescription className="text-xs font-medium uppercase tracking-tighter opacity-70">
                  {section.description}
                </CardDescription>
              </div>
              <Switch 
                checked={isSectionEnabled}
                disabled={readOnly}
                onCheckedChange={(checked) => handleSectionToggle(section.id, checked)}
              />
            </CardHeader>
            
            <CardContent className={cn(
              "space-y-6 pt-0 transition-all duration-300",
              !isSectionEnabled && "opacity-40 grayscale pointer-events-none"
            )}>
              <Separator className="bg-primary/10" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {SECTION_FEATURES[section.id].map((feature) => {
                  const featureSet = schema[section.id].features[feature.id];
                  const isFeatureEnabled = !!featureSet?.view;

                  return (
                    <div key={feature.id} className="p-5 rounded-3xl bg-white border border-border/50 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-black uppercase tracking-tight cursor-pointer" htmlFor={`feat-${feature.id}`}>
                          {feature.label}
                        </Label>
                        <Switch 
                          id={`feat-${feature.id}`}
                          checked={isFeatureEnabled}
                          disabled={readOnly}
                          onCheckedChange={(checked) => handleFeatureToggle(section.id, feature.id, checked)}
                        />
                      </div>

                      {isFeatureEnabled && (
                        <div className="flex flex-wrap gap-4 pt-2 border-t border-dashed">
                          {ACTIONS.map((action) => (
                            <div key={action.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`${feature.id}-${action.id}`}
                                checked={!!featureSet[action.id]}
                                disabled={readOnly}
                                onCheckedChange={(checked) => 
                                  handleActionToggle(section.id, feature.id, action.id, !!checked)
                                }
                                className="h-4 w-4 rounded-md border-2"
                              />
                              <label
                                htmlFor={`${feature.id}-${action.id}`}
                                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground cursor-pointer select-none"
                              >
                                {action.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
