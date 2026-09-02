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
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Building, Globe, Mail, Phone, MapPin, Pencil, Sparkles, Sliders, Key, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as React from 'react';
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
        await saveOrganizationAction(activeOrganization.id, updates, user.uid);
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
        { logoUrl: url },
        user.uid
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
    } catch (error) {
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
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Settings & Configurations
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Manage your workspaces, brand aesthetics, localization parameters, and API keys.
          </p>
        </div>

        {/* Scope Switcher Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-3.5 text-left">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Layers className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Configuration Scope
                </h2>
                <Badge variant="outline" className="text-[9px] uppercase font-extrabold tracking-widest px-2 h-4.5 bg-primary/5 text-primary border-primary/20">
                  {selectedScope === 'organization' ? 'Global Org' : 'Workspace'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground/90 font-medium">
                Switch between global organization-level governance and workspace-specific settings.
              </p>
            </div>
          </div>
          <div className="w-full sm:w-[320px] shrink-0">
            <Select value={selectedScope} onValueChange={setSelectedScope}>
              <SelectTrigger className="h-11 rounded-xl bg-background border border-border hover:border-primary/40 focus:ring-primary font-semibold text-xs px-3.5 shadow-sm transition-all">
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

        <Tabs defaultValue="profile" className="space-y-8">
          <TabsList className="bg-muted/60 p-1.5 rounded-2xl border border-border/70 w-full md:w-auto flex flex-wrap md:inline-flex items-center gap-1.5 shadow-sm">
            <TabsTrigger 
              value="profile" 
              className="rounded-xl font-semibold text-xs h-9 px-5 gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-bold"
            >
              <Building className="h-4 w-4 shrink-0" /> Profile & Workspaces
            </TabsTrigger>
            <TabsTrigger 
              value="branding" 
              className="rounded-xl font-semibold text-xs h-9 px-5 gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-bold"
            >
              <Sparkles className="h-4 w-4 shrink-0" /> Brand & Styling
            </TabsTrigger>
            <TabsTrigger 
              value="regional" 
              className="rounded-xl font-semibold text-xs h-9 px-5 gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-bold"
            >
              <Sliders className="h-4 w-4 shrink-0" /> Localization Settings
            </TabsTrigger>
            <TabsTrigger 
              value="integrations" 
              className="rounded-xl font-semibold text-xs h-9 px-5 gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-bold"
            >
              <Key className="h-4 w-4 shrink-0" /> AI & Integrations
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Profile & Workspaces */}
          <TabsContent value="profile" className="space-y-8 outline-none">
            {selectedScope === 'organization' ? (
              <>
                <Card className="border border-border/70 shadow-xl ring-1 ring-border/40 rounded-3xl overflow-hidden bg-card text-left relative group/card transition-all">
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
                            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                              <h2 className="text-2xl font-black text-foreground tracking-tight">
                                {activeOrganization?.name || 'System Parameters'}
                              </h2>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active Institution
                              </div>
                            </div>
                            <p className="text-sm font-normal text-muted-foreground leading-relaxed max-w-2xl">
                              {activeOrganization?.description || 'Manage your organization\'s workspaces, modules, zones, and security roles from a centralized command center.'}
                            </p>
                          </div>
                          {activeOrganization && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setIsOrgDialogOpen(true)} 
                              className="rounded-xl font-bold text-xs h-10 px-4.5 shrink-0 border-border/80 hover:bg-primary hover:text-white hover:border-primary transition-all duration-200 shadow-sm active:scale-[0.98] self-center md:self-start"
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
                  <Card className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
                    <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                      <div className="flex items-center gap-4">
                        <div className="p-4 bg-primary text-white rounded-2xl shadow-lg">
                          <ShieldCheck className="h-8 w-8" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold tracking-tight text-foreground">Role Architecture</h3>
                          <p className="text-sm font-medium text-muted-foreground mt-1">
                            Role definition and permission management has been unified into a dedicated security center.
                          </p>
                        </div>
                      </div>
                      <Button asChild className="rounded-xl font-bold h-12 px-8 whitespace-nowrap">
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
