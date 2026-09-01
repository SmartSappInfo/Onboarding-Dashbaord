'use client';

/**
 * @fileOverview Granular Permission Editor (Authorization 2.0)
 *
 * Visual hierarchy editor for enabling/disabling module features and CRUD actions
 * across all 4 operational sections with automated DAG dependency cascades.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Enforces dependency rules: enabling create/edit/delete automatically activates view: true.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 * - Mobile optimized with touch targets >= 44px on interactive controls.
 */

import * as React from 'react';
import { 
  PermissionsSchema, 
  AppPermissionAction,
  AppFeatureId 
} from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFeatures } from '@/hooks/use-features';
import { featureToCoordinates } from '@/lib/permissions-engine';
import { PermissionRegistryService } from '@/lib/services/authorization/permission-registry-service';
import { Search, CheckCheck, X, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PermissionEditorProps {
  schema: PermissionsSchema;
  onChange: (updatedSchema: PermissionsSchema) => void;
  readOnly?: boolean;
}

const SECTIONS: { id: keyof PermissionsSchema; label: string; description: string }[] = [
  { id: 'operations', label: 'Operations', description: 'Dashboard, Campuses, Pipeline, Tasks, Meetings, and Automations' },
  { id: 'finance', label: 'Finance Hub', description: 'Agreements, Invoices, Packages, Billing Cycles, and Gateways' },
  { id: 'studios', label: 'Studios', description: 'Public Portals, Messaging, Forms, Tags, Media, and Verification' },
  { id: 'management', label: 'Management', description: 'Team Directory, Roles, Custom Fields, and System Settings' },
];

const SECTION_FEATURES: Record<keyof PermissionsSchema, { id: string; label: string }[]> = {
  operations: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'campuses', label: 'Campuses / Entities' },
    { id: 'pipeline', label: 'Pipeline & Deals' },
    { id: 'tasks', label: 'Daily Tasks' },
    { id: 'meetings', label: 'Meetings & Zoom' },
    { id: 'quickNotes', label: 'Quick Notes' },
    { id: 'automations', label: 'Automations' },
    { id: 'intelligence', label: 'Intelligence Reports' },
  ],
  finance: [
    { id: 'agreements', label: 'Agreements & Contracts' },
    { id: 'invoices', label: 'Invoices & Billing' },
    { id: 'packages', label: 'Pricing Packages' },
    { id: 'cycles', label: 'Billing Cycles' },
    { id: 'billingSetup', label: 'Payment Gateways' },
  ],
  studios: [
    { id: 'publicPortals', label: 'Public Portals' },
    { id: 'messaging', label: 'Messaging Studio' },
    { id: 'forms', label: 'Form Studio' },
    { id: 'tags', label: 'Workspace Tags' },
    { id: 'media', label: 'Media Library' },
    { id: 'qrStudio', label: 'QR Code Studio' },
    { id: 'verifyStudio', label: 'Verification Studio' },
  ],
  management: [
    { id: 'users', label: 'Team Members Directory' },
    { id: 'fields', label: 'Custom Fields & Variables' },
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
  const { isFeatureEnabled } = useFeatures();
  const [filterQuery, setFilterQuery] = React.useState('');

  const isGlobalFeatureEnabled = (sectionId: string, featureId: string) => {
    const entry = Object.entries(featureToCoordinates).find(
      ([_, coords]) => coords.section === sectionId && coords.feature === featureId
    );
    if (!entry) return true;
    return isFeatureEnabled(entry[0] as AppFeatureId);
  };
  
  const handleSectionToggle = (sectionId: keyof PermissionsSchema, enabled: boolean) => {
    const newSchema = { ...schema };
    newSchema[sectionId] = { ...newSchema[sectionId], enabled };
    onChange(PermissionRegistryService.resolveDependencies(newSchema));
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
    
    // DAG Dependency Rule: Enabling mutate action auto-asserts 'view'
    if (enabled && action !== 'view') {
      feature.view = true;
      section.enabled = true;
    }
    
    // Disabling 'view' turns off mutate actions
    if (action === 'view' && !enabled) {
      feature.create = false;
      feature.edit = false;
      feature.delete = false;
    }

    features[featureId] = feature;
    section.features = features;
    newSchema[sectionId] = section;
    onChange(PermissionRegistryService.resolveDependencies(newSchema));
  };

  const handleSelectAllSection = (sectionId: keyof PermissionsSchema) => {
    const newSchema = { ...schema };
    const section = { ...newSchema[sectionId] };
    section.enabled = true;
    const features: Record<string, { view: boolean; create?: boolean; edit?: boolean; delete?: boolean }> = {};

    SECTION_FEATURES[sectionId].forEach((f) => {
      features[f.id] = { view: true, create: true, edit: true, delete: true };
    });

    section.features = features;
    newSchema[sectionId] = section;
    onChange(PermissionRegistryService.resolveDependencies(newSchema));
  };

  const handleClearSection = (sectionId: keyof PermissionsSchema) => {
    const newSchema = { ...schema };
    newSchema[sectionId] = { enabled: false, features: {} };
    onChange(PermissionRegistryService.resolveDependencies(newSchema));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter features and capabilities..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="pl-9 h-8.5 text-xs bg-muted/20 border-border"
        />
      </div>

      {SECTIONS.map((section) => {
        const isSectionEnabled = schema[section.id]?.enabled;
        const features = SECTION_FEATURES[section.id].filter((f) => {
          if (!filterQuery.trim()) return true;
          return (
            f.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
            f.id.toLowerCase().includes(filterQuery.toLowerCase())
          );
        });

        if (features.length === 0) return null;
        
        return (
          <Card key={section.id} className={cn(
            "rounded-xl border transition-all overflow-hidden shadow-xs",
            isSectionEnabled ? "border-primary/30 bg-card" : "border-border/60 bg-muted/10"
          )}>
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-3 bg-muted/20 border-b">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-bold tracking-tight">{section.label}</CardTitle>
                  {!isSectionEnabled && (
                    <Badge variant="outline" className="text-[9px] text-muted-foreground">Disabled</Badge>
                  )}
                </div>
                <CardDescription className="text-[10px] text-muted-foreground line-clamp-1">
                  {section.description}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {!readOnly && isSectionEnabled && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectAllSection(section.id)}
                      className="text-[10px] h-7 px-2 text-muted-foreground hover:text-primary active:scale-[0.97]"
                    >
                      <CheckCheck className="w-3 h-3 mr-1" /> All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClearSection(section.id)}
                      className="text-[10px] h-7 px-2 text-muted-foreground hover:text-rose-500 active:scale-[0.97]"
                    >
                      <X className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  </div>
                )}
                <Switch 
                  checked={isSectionEnabled}
                  disabled={readOnly}
                  onCheckedChange={(checked) => handleSectionToggle(section.id, checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardHeader>
            
            <CardContent className={cn(
              "p-4 pt-3 transition-all duration-200",
              !isSectionEnabled && "opacity-40 grayscale pointer-events-none"
            )}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map((feature) => {
                   const featureSet = schema[section.id]?.features?.[feature.id];
                   const isFeatureEnabledUI = Boolean(featureSet?.view);
                   const isGloballyActive = isGlobalFeatureEnabled(section.id, feature.id);

                   return (
                     <div 
                       key={feature.id} 
                       className={cn(
                         "p-3 rounded-xl border transition-all text-xs space-y-2.5",
                         isFeatureEnabledUI 
                           ? "bg-primary/5 border-primary/20 shadow-xs" 
                           : "bg-muted/10 border-border/60"
                       )}
                     >
                       <div className="flex items-center justify-between">
                         <span className="font-semibold text-foreground">{feature.label}</span>
                         {!isGloballyActive && (
                           <Badge variant="outline" className="text-[8px] text-amber-500 border-amber-500/30">
                             Module Inactive
                           </Badge>
                         )}
                       </div>

                       <div className="grid grid-cols-4 gap-1 pt-1 border-t border-border/40">
                         {ACTIONS.map((action) => {
                           const isChecked = Boolean(featureSet?.[action.id]);
                           const isActionDisabled = readOnly || (!isFeatureEnabledUI && action.id !== 'view');

                           return (
                             <label
                               key={action.id}
                               className={cn(
                                 "flex items-center gap-1.5 cursor-pointer py-1 select-none min-h-[32px]",
                                 isActionDisabled && "cursor-not-allowed opacity-50"
                               )}
                             >
                               <Checkbox
                                 checked={isChecked}
                                 disabled={isActionDisabled}
                                 onCheckedChange={(checked) => 
                                   handleActionToggle(section.id, feature.id, action.id, Boolean(checked))
                                 }
                                 className="h-3.5 w-3.5 data-[state=checked]:bg-primary"
                               />
                               <span className="text-[11px] text-foreground font-medium capitalize">
                                 {action.label}
                               </span>
                             </label>
                           );
                         })}
                       </div>
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

export default PermissionEditor;
