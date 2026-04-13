'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useFeatures } from '@/hooks/use-features';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { APP_FEATURES, type AppFeatureId, type FeatureToggleMap } from '@/lib/types';
import { updateOrganizationFeaturesAction, updateWorkspaceFeaturesAction } from '@/lib/feature-actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Loader2,
  ShieldCheck,
  Building,
  Zap,
  Lock,
  Info,
  School,
  Workflow,
  CheckSquare,
  Calendar,
  BarChart3,
  Globe,
  Film,
  ClipboardList,
  FileText,
  MessageSquareText,
  Tags,
  FileCheck,
  Receipt,
  Package,
  Timer,
  Settings2,
  Target,
  History,
  MapPin,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ICON_MAP: Record<string, React.ElementType> = {
  School, Workflow, CheckSquare, Calendar, Zap, BarChart3,
  Globe, Film, ClipboardList, FileText, MessageSquareText, Tags,
  FileCheck, Receipt, Package, Timer, Settings2, Target, History, MapPin,
};

/**
 * Feature Manager component for the Settings page.
 * Super admins can toggle org-level features.
 * All admins can toggle workspace-level features (bounded by org ceiling).
 */
export default function FeatureManager() {
  const { activeOrganization, activeOrganizationId, activeWorkspaceId, activeWorkspace, isSuperAdmin } = useTenant();
  const { orgFeatures, workspaceFeatures, isLoading: isFeaturesLoading } = useFeatures();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSavingOrg, setIsSavingOrg] = React.useState(false);
  const [isSavingWs, setIsSavingWs] = React.useState(false);

  // Local state mirrors for optimistic UI
  const [localOrgFeatures, setLocalOrgFeatures] = React.useState<FeatureToggleMap>({});
  const [localWsFeatures, setLocalWsFeatures] = React.useState<FeatureToggleMap>({});

  // Sync from context when it changes
  React.useEffect(() => {
    setLocalOrgFeatures(activeOrganization?.enabledFeatures || {});
  }, [activeOrganization?.enabledFeatures]);

  React.useEffect(() => {
    setLocalWsFeatures(activeWorkspace?.enabledFeatures || {});
  }, [activeWorkspace?.enabledFeatures]);

  const isOrgFeatureEnabled = (featureId: AppFeatureId): boolean => {
    const feature = APP_FEATURES.find(f => f.id === featureId);
    const val = localOrgFeatures[featureId];
    return val !== undefined ? val : (feature?.defaultEnabled ?? true);
  };

  const isWsFeatureEnabled = (featureId: AppFeatureId): boolean => {
    const feature = APP_FEATURES.find(f => f.id === featureId);
    const val = localWsFeatures[featureId];
    return val !== undefined ? val : (feature?.defaultEnabled ?? true);
  };

  // --- Org-level toggle ---
  const handleOrgToggle = async (featureId: AppFeatureId, enabled: boolean) => {
    if (!activeOrganizationId) return;
    const updated = { ...localOrgFeatures, [featureId]: enabled };
    setLocalOrgFeatures(updated);
    setIsSavingOrg(true);

    const result = await updateOrganizationFeaturesAction(activeOrganizationId, updated);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      setLocalOrgFeatures(prev => ({ ...prev, [featureId]: !enabled }));
    }
    setIsSavingOrg(false);
  };

  // --- Workspace-level toggle ---
  const handleWsToggle = async (featureId: AppFeatureId, enabled: boolean) => {
    if (!activeWorkspaceId) return;
    const updated = { ...localWsFeatures, [featureId]: enabled };
    setLocalWsFeatures(updated);
    setIsSavingWs(true);

    const result = await updateWorkspaceFeaturesAction(activeWorkspaceId, updated);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      setLocalWsFeatures(prev => ({ ...prev, [featureId]: !enabled }));
    }
    setIsSavingWs(false);
  };

  if (isFeaturesLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const categories = [...new Set(APP_FEATURES.map(f => f.category))];

  const renderFeatureGrid = (
    scope: 'org' | 'workspace',
    isEnabled: (id: AppFeatureId) => boolean,
    onToggle: (id: AppFeatureId, enabled: boolean) => void,
    isSaving: boolean,
  ) => (
    <div className="space-y-8">
      {categories.map(category => {
        const features = APP_FEATURES.filter(f => f.category === category);
        return (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Badge variant="outline" className="text-[9px] font-bold uppercase px-2 h-5">
                {category}
              </Badge>
              <span className="text-[10px] font-medium text-muted-foreground">
                {features.filter(f => isEnabled(f.id as AppFeatureId)).length}/{features.length} active
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {features.map(feature => {
                const featureId = feature.id as AppFeatureId;
                const enabled = isEnabled(featureId);
                const Icon = ICON_MAP[feature.icon] || Zap;
                
                // For workspace scope: check if org allows this feature
                const orgAllows = scope === 'workspace' ? isOrgFeatureEnabled(featureId) : true;
                const isLocked = scope === 'workspace' && !orgAllows;

                return (
                  <div
                    key={featureId}
                    className={cn(
                      'relative p-4 rounded-2xl border-2 transition-all duration-300 group',
                      isLocked
                        ? 'bg-muted/10 border-border opacity-40 cursor-not-allowed'
                        : enabled
                          ? 'bg-primary/[0.03] border-primary/20 hover:border-primary/40 hover:shadow-md'
                          : 'bg-muted/5 border-border hover:border-muted-foreground/20'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'p-2 rounded-xl transition-colors shrink-0',
                          enabled && !isLocked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold tracking-tight truncate">{feature.label}</p>
                          {isLocked && (
                            <div className="flex items-center gap-1 mt-1">
                              <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-[8px] font-bold text-muted-foreground">Disabled by organization</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(val) => onToggle(featureId, val)}
                        disabled={isLocked || isSaving}
                        className="shrink-0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {isSaving && (
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-[10px] font-bold">Saving changes...</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div className="text-left">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">Feature Manager</h3>
          <p className="text-sm text-muted-foreground font-medium">
            Control which features are available across the organization and workspace.
          </p>
        </div>
      </div>

      <Tabs defaultValue={isSuperAdmin ? 'organization' : 'workspace'} className="space-y-6">
        <TabsList className="bg-muted/30 p-1.5 rounded-xl h-auto shadow-inner">
          {isSuperAdmin && (
            <TabsTrigger 
              value="organization" 
              className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-primary font-bold text-xs h-9 px-4 gap-2 transition-all"
            >
              <Building className="h-3.5 w-3.5" />
              Organization
            </TabsTrigger>
          )}
          <TabsTrigger 
            value="workspace" 
            className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-primary font-bold text-xs h-9 px-4 gap-2 transition-all"
          >
            <Zap className="h-3.5 w-3.5" />
            Workspace
          </TabsTrigger>
        </TabsList>

        {isSuperAdmin && (
          <TabsContent value="organization" className="space-y-6 mt-0">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-blue-900">Organization-Level Control</p>
                <p className="text-[9px] font-medium text-blue-800/70 leading-relaxed">
                  Disabling a feature here removes it from <strong>all workspaces</strong> in{' '}
                  <span className="font-bold">{activeOrganization?.name}</span>. Workspace admins won&apos;t
                  be able to re-enable it.
                </p>
              </div>
            </div>
            {renderFeatureGrid('org', isOrgFeatureEnabled, handleOrgToggle, isSavingOrg)}
          </TabsContent>
        )}

        <TabsContent value="workspace" className="space-y-6 mt-0">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-emerald-900">Workspace-Level Control</p>
              <p className="text-[9px] font-medium text-emerald-800/70 leading-relaxed">
                Toggle features for{' '}
                <span className="font-bold" style={{ color: activeWorkspace?.color }}>
                  {activeWorkspace?.name}
                </span>
                . Features disabled at the organization level are locked and cannot be enabled here.
              </p>
            </div>
          </div>
          {renderFeatureGrid('workspace', isWsFeatureEnabled, handleWsToggle, isSavingWs)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
