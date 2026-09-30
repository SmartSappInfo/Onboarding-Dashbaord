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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFeatures } from '@/hooks/use-features';
import { featureToCoordinates } from '@/lib/permissions-engine';
import { PermissionRegistryService } from '@/lib/services/authorization/permission-registry-service';
import { Search, CheckCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PermissionEditorProps {
  schema: PermissionsSchema;
  onChange: (updatedSchema: PermissionsSchema) => void;
  readOnly?: boolean;
}

const SECTIONS: { id: keyof PermissionsSchema; label: string; description: string }[] = [
  { id: 'operations', label: 'Operations', description: 'Dashboard, Campuses, Pipeline, Tasks, Meetings, Automations, Brain, Reports, and Graph' },
  { id: 'studios', label: 'Studios', description: 'Portals, Landing Pages, Media, Flipbooks, Thumbnails, Surveys, Signatures, Messaging, Call Centre, Forms, Tags, and QR' },
  { id: 'finance', label: 'Finance Hub', description: 'Agreements, Invoices, Pricing Packages, Billing Cycles, and Payment Gateways' },
  { id: 'social', label: 'Social Hub', description: 'Omnichannel Dashboard, Post Composer, Content Calendar, Unified Inbox, and Connected Accounts' },
  { id: 'workforce', label: 'Workspace and Users', description: 'Workforce Intelligence, Directory, Onboarding, Command Center, Advisor, Governance, Workload, Identity, and Roles' },
  { id: 'management', label: 'Management', description: 'Audit Activities, Lead Scores, Messaging Channels, Custom Fields, AI Prompts, Effort Rules, System Settings, Developer API, and Webhooks' },
];

const SECTION_FEATURES: Record<keyof PermissionsSchema, { id: string; label: string }[]> = {
  operations: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'campuses', label: 'Campuses / Entities' },
    { id: 'leadIntelligence', label: 'Lead Intelligence' },
    { id: 'pipeline', label: 'Pipeline & Deals' },
    { id: 'tasks', label: 'Daily Tasks' },
    { id: 'meetings', label: 'Meetings & Zoom' },
    { id: 'automations', label: 'Automations Engine' },
    { id: 'intelligence', label: 'Intelligence Reports' },
    { id: 'quickNotes', label: 'Company Brain' },
    { id: 'knowledgeGraph', label: 'Knowledge Graph' },
    { id: 'salesEffort', label: 'Sales Effort Analytics' },
  ],
  studios: [
    { id: 'publicPortals', label: 'Public Portals' },
    { id: 'landingPages', label: 'Landing Pages' },
    { id: 'media', label: 'Media Library' },
    { id: 'flipbooks', label: 'Interactive Flipbooks' },
    { id: 'thumbnails', label: 'Thumbnail Studio' },
    { id: 'surveys', label: 'Survey Studio' },
    { id: 'docSigning', label: 'Document Signing & Templates' },
    { id: 'messaging', label: 'Messaging Studio' },
    { id: 'callCentre', label: 'Call Centre' },
    { id: 'forms', label: 'Form Studio' },
    { id: 'tags', label: 'Workspace Tags' },
    { id: 'qrStudio', label: 'QR Code Studio' },
    { id: 'verifyStudio', label: 'Verification Studio' },
    { id: 'socialIntelligence', label: 'Social Studio Legacy' },
  ],
  finance: [
    { id: 'agreements', label: 'Agreements & Contracts' },
    { id: 'invoices', label: 'Invoices & Billing' },
    { id: 'packages', label: 'Pricing Packages' },
    { id: 'cycles', label: 'Billing Cycles' },
    { id: 'billingSetup', label: 'Payment Gateways' },
  ],
  social: [
    { id: 'dashboard', label: 'Social Hub Dashboard' },
    { id: 'composer', label: 'Post Composer' },
    { id: 'calendar', label: 'Content Calendar' },
    { id: 'inbox', label: 'Unified Inbox' },
    { id: 'accounts', label: 'Connected Accounts' },
  ],
  workforce: [
    { id: 'intelligence', label: 'Workforce Intelligence' },
    { id: 'users', label: 'Team Members Directory' },
    { id: 'onboarding', label: 'Staff Onboarding' },
    { id: 'commandCenter', label: 'Workforce Command Center' },
    { id: 'advisor', label: 'Workforce Advisor' },
    { id: 'governance', label: 'Workforce Governance' },
    { id: 'crmWorkload', label: 'CRM Workload Distribution' },
    { id: 'enterpriseIdentity', label: 'Enterprise Identity' },
    { id: 'roles', label: 'Roles & Permissions' },
  ],
  management: [
    { id: 'activities', label: 'Audit Activities' },
    { id: 'leadScores', label: 'Lead Scoring Rules' },
    { id: 'messagingSettings', label: 'Messaging Channels & Gateways' },
    { id: 'fields', label: 'Custom Fields & Variables' },
    { id: 'aiPrompts', label: 'AI Prompt Templates' },
    { id: 'effortRules', label: 'Sales Effort Scoring' },
    { id: 'systemSettings', label: 'System Settings' },
    { id: 'developerApi', label: 'Developer API & Keys' },
    { id: 'webhooks', label: 'Self-Healing Webhooks' },
    { id: 'users', label: 'Organization User Management' },
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
    const currentSection = schema[sectionId] || { enabled: false, features: {} };
    const updatedFeatures = { ...currentSection.features };
    if (!enabled) {
      Object.keys(updatedFeatures).forEach((k) => {
        const feat = updatedFeatures[k];
        if (feat) {
          updatedFeatures[k] = { ...feat, create: false, edit: false, delete: false };
        }
      });
    }
    const updated = {
      ...schema,
      [sectionId]: { ...currentSection, enabled, features: updatedFeatures },
    };
    onChange(PermissionRegistryService.resolveDependencies(updated));
  };

  const handleActionToggle = (
    sectionId: keyof PermissionsSchema, 
    featureId: string, 
    action: AppPermissionAction, 
    enabled: boolean
  ) => {
    const currentSection = schema[sectionId] || { enabled: false, features: {} };
    const features = { ...currentSection.features };
    const feature = { ...(features[featureId] || { view: false }) };
    
    feature[action] = enabled;
    let sectionEnabled = currentSection.enabled;
    
    // DAG Dependency Rule: Enabling mutate action auto-asserts 'view'
    if (enabled && action !== 'view') {
      feature.view = true;
      sectionEnabled = true;
    }
    
    // Disabling 'view' turns off mutate actions
    if (action === 'view' && !enabled) {
      feature.create = false;
      feature.edit = false;
      feature.delete = false;
    }

    features[featureId] = feature;
    const updated = {
      ...schema,
      [sectionId]: {
        ...currentSection,
        enabled: sectionEnabled,
        features,
      },
    };
    onChange(PermissionRegistryService.resolveDependencies(updated));
  };

  const handleSelectAllSection = (sectionId: keyof PermissionsSchema) => {
    const currentSection = schema[sectionId] || { enabled: false, features: {} };
    const features: Record<string, { view: boolean; create?: boolean; edit?: boolean; delete?: boolean }> = {};

    SECTION_FEATURES[sectionId].forEach((f) => {
      features[f.id] = { view: true, create: true, edit: true, delete: true };
    });

    const updated = {
      ...schema,
      [sectionId]: {
        ...currentSection,
        enabled: true,
        features,
      },
    };
    onChange(PermissionRegistryService.resolveDependencies(updated));
  };

  const handleClearSection = (sectionId: keyof PermissionsSchema) => {
    const updated = {
      ...schema,
      [sectionId]: { enabled: false, features: {} },
    };
    onChange(PermissionRegistryService.resolveDependencies(updated));
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
                                 "flex items-center gap-1.5 cursor-pointer py-1 select-none min-h-[44px] active:scale-[0.97] transition-transform",
                                 isActionDisabled && "cursor-not-allowed opacity-50 active:scale-100"
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
