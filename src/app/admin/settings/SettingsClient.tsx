'use client';

import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import LocationHierarchyEditor from './components/LocationHierarchyEditor';
import WorkspaceEditor from './components/WorkspaceEditor';
import FeatureManager from './components/FeatureManager';
import OrganizationBrandingTab from './components/OrganizationBrandingTab';
import OrganizationRegionalTab from './components/OrganizationRegionalTab';
import OrganizationIntegrationsTab from './components/OrganizationIntegrationsTab';
import WorkspaceProfileTab from './components/WorkspaceProfileTab';
import WorkspaceBrandingTab from './components/WorkspaceBrandingTab';
import WorkspaceRegionalTab from './components/WorkspaceRegionalTab';
import WorkspaceIntegrationsTab from './components/WorkspaceIntegrationsTab';
import { MessagingSettingsTab } from './components/MessagingSettingsTab';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Building, Globe, Mail, Phone, MapPin, Pencil, Sparkles, Sliders, Key, Layers, CreditCard, MessageSquare, Receipt, ArrowRight, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as React from 'react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import OrganizationManagementDialog from '../components/OrganizationManagementDialog';
import MediaSelectorTrigger from '../components/MediaSelectorTrigger';
import { saveOrganizationAction } from '@/lib/organization-actions';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/page-container';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { AISeedResult, Workspace } from '@/lib/types';

export default function SettingsClient() {
  const { activeOrganizationId, activeOrganization } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();
  const [isOrgDialogOpen, setIsOrgDialogOpen] = React.useState(false);
  const [selectedScope, setSelectedScope] = React.useState<string>('organization');

  const firestore = useFirestore();

  // Query workspaces
  const workspacesQuery = useMemoFirebase(() => 
    firestore && activeOrganizationId 
        ? query(
            collection(firestore, 'workspaces'), 
            where('organizationId', '==', activeOrganizationId),
            orderBy('createdAt', 'asc')
        ) 
        : null, 
  [firestore, activeOrganizationId]);
  
  const { data: workspaces } = useCollection<Workspace>(workspacesQuery);

  const searchParams = useSearchParams();
  const targetWorkspaceId = searchParams.get('workspaceId');
  const tabParam = searchParams.get('tab');
  const validTabs = React.useMemo(() => ['profile', 'branding', 'regional', 'integrations', 'billing', 'messaging'], []);
  const [activeTab, setActiveTab] = React.useState<string>(
    tabParam && validTabs.includes(tabParam) ? tabParam : 'profile'
  );

  React.useEffect(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam, validTabs]);

  const hasAutoOpenedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (workspaces && targetWorkspaceId && hasAutoOpenedRef.current !== targetWorkspaceId) {
      const found = workspaces.find(w => w.id === targetWorkspaceId);
      if (found) {
        hasAutoOpenedRef.current = targetWorkspaceId;
        setSelectedScope(targetWorkspaceId);
      }
    }
  }, [workspaces, targetWorkspaceId]);

  const activeWorkspace = React.useMemo(() => {
    if (selectedScope === 'organization') return null;
    return workspaces?.find(w => w.id === selectedScope) || null;
  }, [selectedScope, workspaces]);

  const handleSeedApplied = async (seed: AISeedResult) => {
    if (!activeOrganization || !user) return;
    try {
      const updates: Record<string, string> = {};
      if (seed.name) updates.name = seed.name;
      if (seed.description) updates.description = seed.description;
      if (seed.logoUrl) updates.logoUrl = seed.logoUrl;
      if (seed.country) updates.defaultCountryCode = seed.country.toUpperCase();
      if (seed.language) {
        updates['settings.defaultLanguage'] = seed.language.toLowerCase();
      }
      if (Object.keys(updates).length > 0) {
        await saveOrganizationAction(activeOrganization.id, updates);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast({ variant: 'destructive', title: 'Seed Save Failed', description: errorMsg });
    }
  };

  const handleLogoChange = async (url: string) => {
    if (!activeOrganization || !user) return;

    try {
      const result = await saveOrganizationAction(
        activeOrganization.id,
        { logoUrl: url }
      );

      if (result.success) {
        toast({
          title: "Success",
          description: "Organization logo updated successfully.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: result.error || "Failed to update logo.",
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    }
  };

  const orgInitials = React.useMemo(() => {
    if (!activeOrganization?.name) return 'ORG';
    const parts = activeOrganization.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [activeOrganization?.name]);

  return (
    <PageContainer>
      <div className="space-y-8 pb-32 w-full text-left">
        {/* Header Block */}
        <div className="flex items-center gap-2.5 px-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Settings & Configurations
          </h1>
          <CardInfoTooltip text="Manage your workspaces, brand aesthetics, localization parameters, and API keys." />
        </div>

        {/* Scope Switcher Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm">
          <div className="flex items-center gap-3.5 text-left">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Layers className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Configuration Scope
                </h2>
                <CardInfoTooltip text="Switch between global organization-level governance and workspace-specific settings." />
                <Badge variant="outline" className="text-[9px] uppercase font-extrabold tracking-widest px-2 h-4.5 bg-primary/5 text-primary border-primary/20">
                  {selectedScope === 'organization' ? 'Global Org' : 'Workspace'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="w-full sm:w-[320px] shrink-0">
            <Select value={selectedScope} onValueChange={setSelectedScope}>
              <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-card border border-border/80 hover:border-primary/40 focus:ring-primary font-semibold text-xs px-3.5 shadow-xs transition-all">
                <SelectValue placeholder="Select Configuration Scope" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-border shadow-xl z-50">
                <SelectItem value="organization" className="font-bold text-xs py-2.5 cursor-pointer">
                  🏢 {activeOrganization?.name || 'Organization'} (Global)
                </SelectItem>
                {workspaces?.map((w) => (
                  <SelectItem key={w.id} value={w.id} className="font-semibold text-xs py-2.5 cursor-pointer">
                    💼 {w.name} (Workspace)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-muted/30 dark:bg-muted/40 p-1 rounded-xl border border-border/60 shadow-inner h-auto w-full md:w-auto flex flex-wrap md:inline-flex items-center gap-1">
            <TabsTrigger 
              value="profile" 
              className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              <Building className="h-3.5 w-3.5 shrink-0" /> Profile & Workspaces
            </TabsTrigger>
            <TabsTrigger 
              value="branding" 
              className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" /> Brand & Styling
            </TabsTrigger>
            <TabsTrigger 
              value="regional" 
              className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              <Sliders className="h-3.5 w-3.5 shrink-0" /> Localization Settings
            </TabsTrigger>
            <TabsTrigger 
              value="integrations" 
              className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              <Key className="h-3.5 w-3.5 shrink-0" /> AI & Integrations
            </TabsTrigger>
            <TabsTrigger 
              value="billing" 
              className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              <CreditCard className="h-3.5 w-3.5 shrink-0" /> SMS Units & Billing
            </TabsTrigger>
            <TabsTrigger 
              value="messaging" 
              className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" /> Messaging Hub
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Profile & Workspaces */}
          <TabsContent value="profile" className="space-y-8 outline-none">
            {selectedScope === 'organization' ? (
              <>
                <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground text-left relative group/card transition-all">
                  <div className="h-1.5 w-full bg-gradient-to-r from-primary via-blue-500 to-indigo-600" />
                  <CardContent className="p-6 md:p-8 relative z-10">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
                      {/* Logo Section */}
                      <div className="shrink-0 flex flex-col items-center gap-2">
                        <MediaSelectorTrigger 
                            value={activeOrganization?.logoUrl}
                            onSelect={handleLogoChange}
                            label="Organization Logo"
                            subLabel="Tap to update brand identity"
                            workspaceId={activeWorkspaceId || 'global'}
                            fallbackInitials={orgInitials}
                            hideText={true}
                            previewClassName="h-28 w-28 md:h-32 md:w-32 rounded-2xl shadow-lg ring-2 ring-border/80 group-hover:ring-primary/40 transition-all duration-300"
                        />
                        <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">
                          {activeOrganization?.logoUrl ? 'Click to change' : 'Upload logo'}
                        </span>
                      </div>

                      {/* Info Section */}
                      <div className="flex-1 space-y-5 text-center md:text-left min-w-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-center md:justify-start gap-2.5 flex-wrap">
                              <h2 className="text-2xl font-black text-foreground tracking-tight">
                                {activeOrganization?.name || 'System Parameters'}
                              </h2>
                              <CardInfoTooltip text={activeOrganization?.description || "Manage your organization's workspaces, modules, zones, and security roles from a centralized command center."} />
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active Institution
                              </div>
                            </div>
                          </div>
                          {activeOrganization && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setIsOrgDialogOpen(true)} 
                              className="rounded-xl font-bold text-xs h-10 px-4.5 shrink-0 border-border/80 bg-white dark:bg-card hover:bg-muted/60 hover:text-foreground transition-all duration-200 shadow-xs active:scale-[0.97] self-center md:self-start"
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1.5" />
                              Edit Profile Details
                            </Button>
                          )}
                        </div>

                        {/* Metadata / Contact Chips */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-border/50">
                          {activeOrganization?.email ? (
                            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-left min-w-0">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Mail className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Email</span>
                                <a href={`mailto:${activeOrganization.email}`} className="text-xs font-semibold text-foreground hover:text-primary transition-colors truncate">
                                  {activeOrganization.email}
                                </a>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setIsOrgDialogOpen(true)} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-border/70 hover:border-primary/50 text-left min-w-0 group/btn transition-colors">
                              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover/btn:bg-primary/10 group-hover/btn:text-primary transition-colors">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover/btn:text-primary" />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground group-hover/btn:text-foreground truncate">+ Add Email</span>
                            </button>
                          )}

                          {activeOrganization?.website ? (
                            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-left min-w-0">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Globe className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Website</span>
                                <a href={activeOrganization.website} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-foreground hover:text-primary transition-colors truncate">
                                  {activeOrganization.website.replace(/^https?:\/\//, '')}
                                </a>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setIsOrgDialogOpen(true)} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-border/70 hover:border-primary/50 text-left min-w-0 group/btn transition-colors">
                              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover/btn:bg-primary/10 group-hover/btn:text-primary transition-colors">
                                <Globe className="h-3.5 w-3.5 text-muted-foreground group-hover/btn:text-primary" />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground group-hover/btn:text-foreground truncate">+ Add Website</span>
                            </button>
                          )}

                          {activeOrganization?.phone ? (
                            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-left min-w-0">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Phone className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Support</span>
                                <span className="text-xs font-semibold text-foreground truncate">{activeOrganization.phone}</span>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setIsOrgDialogOpen(true)} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-border/70 hover:border-primary/50 text-left min-w-0 group/btn transition-colors">
                              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover/btn:bg-primary/10 group-hover/btn:text-primary transition-colors">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover/btn:text-primary" />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground group-hover/btn:text-foreground truncate">+ Add Phone</span>
                            </button>
                          )}

                          {activeOrganization?.address ? (
                            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-left min-w-0">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <MapPin className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Location</span>
                                <span className="text-xs font-semibold text-foreground truncate">{activeOrganization.address}</span>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setIsOrgDialogOpen(true)} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-border/70 hover:border-primary/50 text-left min-w-0 group/btn transition-colors">
                              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover/btn:bg-primary/10 group-hover/btn:text-primary transition-colors">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground group-hover/btn:text-primary" />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground group-hover/btn:text-foreground truncate">+ Add Location</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <WorkspaceEditor 
                  workspaces={workspaces || []} 
                  selectedScope={selectedScope}
                  onSelectWorkspace={setSelectedScope}
                />
                <FeatureManager />

                <div className="space-y-8">
                  <Card className="rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden">
                    <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                      <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-primary/10 text-primary border border-primary/20 rounded-xl shrink-0">
                          <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold tracking-tight text-foreground">Role Architecture</h3>
                          <CardInfoTooltip text="Role definition and permission management has been unified into a dedicated security center." />
                        </div>
                      </div>
                      <Button asChild className="rounded-xl font-bold h-11 px-8 whitespace-nowrap active:scale-[0.97]">
                        <Link href="/admin/users/roles">Manage Roles</Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ModuleEditor />
                    <ZoneEditor />
                  </div>

                  <LocationHierarchyEditor />
                </div>
              </>
            ) : (
              activeWorkspace && (
                <WorkspaceProfileTab 
                  workspace={activeWorkspace}
                  onSaveSuccess={() => {}}
                  onBackToOrg={() => setSelectedScope('organization')}
                />
              )
            )}
          </TabsContent>

          {/* TAB 2: Brand & Styling */}
          <TabsContent value="branding" className="outline-none">
            {selectedScope === 'organization' ? (
              activeOrganization ? (
                <OrganizationBrandingTab organization={activeOrganization} onSeedApplied={handleSeedApplied} />
              ) : (
                <div className="text-center py-16 text-muted-foreground text-sm font-medium">Select an organization to customize branding.</div>
              )
            ) : (
              activeWorkspace && (
                <WorkspaceBrandingTab 
                  workspace={activeWorkspace}
                  onSaveSuccess={() => {}}
                />
              )
            )}
          </TabsContent>

          {/* TAB 3: Localization Settings */}
          <TabsContent value="regional" className="outline-none">
            {selectedScope === 'organization' ? (
              activeOrganization ? (
                <OrganizationRegionalTab organization={activeOrganization} />
              ) : (
                <div className="text-center py-16 text-muted-foreground text-sm font-medium">Select an organization to customize regional configs.</div>
              )
            ) : (
              activeWorkspace && (
                <WorkspaceRegionalTab 
                  workspace={activeWorkspace}
                  onSaveSuccess={() => {}}
                />
              )
            )}
          </TabsContent>

          {/* TAB 4: AI & Integrations */}
          <TabsContent value="integrations" className="outline-none">
            {selectedScope === 'organization' ? (
              activeOrganization ? (
                <OrganizationIntegrationsTab organization={activeOrganization} />
              ) : (
                <div className="text-center py-16 text-muted-foreground text-sm font-medium">Select an organization to configure integrations.</div>
              )
            ) : (
              activeWorkspace && (
                <WorkspaceIntegrationsTab 
                  workspace={activeWorkspace}
                  onSaveSuccess={() => {}}
                />
              )
            )}
          </TabsContent>

          {/* TAB 5: SMS Units & Billing */}
          <TabsContent value="billing" className="space-y-6 outline-none text-left">
            <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground">
              <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-primary to-purple-600" />
              <CardHeader className="p-6 sm:p-8 border-b border-border/60">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                        SMS Units & Billing Management
                      </CardTitle>
                      <CardInfoTooltip text="Manage SMS unit credits, gateway routing credentials, and institutional billing protocols." />
                    </div>
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      Monitor credit reserves, top up dispatch capacity, and configure organization tax and remittance profiles.
                    </CardDescription>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-xl font-bold text-xs h-10 px-4 border-border/80 active:scale-[0.97]"
                  >
                    <Link href="/admin/messaging">
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-primary" />
                      Open Messaging Hub
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SMS Gateway & Units Card */}
                  <div className="p-5 rounded-2xl border border-border/80 bg-muted/10 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          SMS Gateway Capacity
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                          Active Gateway
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold text-foreground">mNotify Provider Credits</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Outbound SMS dispatches route through your configured mNotify gateway credentials. To purchase additional units or renew your sending bundle, access your provider dashboard.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-wrap gap-2.5 items-center">
                      <Button
                        asChild
                        className="rounded-xl font-bold text-xs h-10 px-4 bg-primary text-primary-foreground active:scale-[0.97]"
                      >
                        <a href="https://apps.mnotify.com" target="_blank" rel="noopener noreferrer">
                          Top Up SMS Units <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTab('integrations')}
                        className="rounded-xl font-bold text-xs h-10 px-4 border-border/80 active:scale-[0.97]"
                      >
                        Configure API Keys
                      </Button>
                    </div>
                  </div>

                  {/* Finance & Invoicing Protocols Card */}
                  <div className="p-5 rounded-2xl border border-border/80 bg-muted/10 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Institutional Protocols
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold text-primary bg-primary/10 border-primary/20">
                          Finance Hub
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Billing & Remittance Protocols</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Configure institutional tax codes, VAT/Levy schedules, bank remittance details, authorized digital signatures, and fee invoicing schedules.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-wrap gap-2.5 items-center">
                      <Button
                        asChild
                        variant="outline"
                        className="rounded-xl font-bold text-xs h-10 px-4 border-border/80 active:scale-[0.97]"
                      >
                        <Link href="/admin/finance/settings">
                          Billing Protocols <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        className="rounded-xl font-bold text-xs h-10 px-4 active:scale-[0.97]"
                      >
                        <Link href="/admin/finance/invoices">
                          <Receipt className="h-3.5 w-3.5 mr-1.5 text-primary" />
                          View Invoices
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: Messaging Hub Codeless Controls */}
          <TabsContent value="messaging" className="space-y-6 outline-none text-left">
            <MessagingSettingsTab workspaceId={activeWorkspace?.id || activeWorkspaceId || ''} />
          </TabsContent>
        </Tabs>
      </div>

      <OrganizationManagementDialog 
        open={isOrgDialogOpen} 
        onOpenChange={setIsOrgDialogOpen} 
        organization={activeOrganization} 
      />
    </PageContainer>
  );
}
