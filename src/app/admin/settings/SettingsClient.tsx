'use client';

import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import LocationHierarchyEditor from './components/LocationHierarchyEditor';
import WorkspaceEditor from './components/WorkspaceEditor';
import FeatureManager from './components/FeatureManager';
import OrganizationBrandingTab from './components/OrganizationBrandingTab';
import OrganizationRegionalTab from './components/OrganizationRegionalTab';
import OrganizationIntegrationsTab from './components/OrganizationIntegrationsTab';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { Building, Globe, Mail, Phone, MapPin, Pencil, Image as ImageIcon, Sparkles, Sliders, Shield, Key } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as React from 'react';
import OrganizationManagementDialog from '../components/OrganizationManagementDialog';
import MediaSelectorTrigger from '../components/MediaSelectorTrigger';
import { saveOrganizationAction } from '@/lib/organization-actions';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/page-container';

import type { AISeedResult } from '@/lib/types';

export default function SettingsClient() {
  const { activeOrganization } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();
  const [isOrgDialogOpen, setIsOrgDialogOpen] = React.useState(false);

  const handleSeedApplied = async (seed: AISeedResult) => {
    if (!activeOrganization || !user) return;
    try {
      // Persist fields extracted by AI that live outside the branding tab
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
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Seed Save Failed', description: err.message });
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

  return (
    <PageContainer>
      <div className="space-y-8 pb-32 w-full text-left">
        {/* Header Block */}
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Settings & Configurations
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Manage your workspaces, brand aesthetics, localization parameters, and API keys.
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-8">
          <TabsList className="bg-muted/50 p-1 rounded-2xl border border-border/80 w-full md:w-auto grid grid-cols-2 md:flex md:items-center gap-1 min-h-[52px]">
            <TabsTrigger value="profile" className="rounded-xl font-bold text-xs h-10 px-6 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Building className="h-4 w-4" /> Profile & Workspaces
            </TabsTrigger>
            <TabsTrigger value="branding" className="rounded-xl font-bold text-xs h-10 px-6 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Sparkles className="h-4 w-4" /> Brand & Styling
            </TabsTrigger>
            <TabsTrigger value="regional" className="rounded-xl font-bold text-xs h-10 px-6 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Sliders className="h-4 w-4" /> Localization Settings
            </TabsTrigger>
            <TabsTrigger value="integrations" className="rounded-xl font-bold text-xs h-10 px-6 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Key className="h-4 w-4" /> AI & Integrations
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Profile & Workspaces */}
          <TabsContent value="profile" className="space-y-8 outline-none">
            <Card className="border-none shadow-2xl ring-1 ring-border rounded-[2.5rem] overflow-hidden bg-background/40 backdrop-blur-sm relative group/card">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
              <CardContent className="p-8 md:p-14 relative z-10">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-16">
                  {/* Logo Section */}
                  <div className="shrink-0">
                    <MediaSelectorTrigger 
                        value={activeOrganization?.logoUrl}
                        onSelect={handleLogoChange}
                        label="Organization Logo"
                        subLabel="Tap to update your institution's brand identity."
                        workspaceId={activeWorkspaceId || 'global'}
                        previewClassName="h-32 w-32 md:h-44 md:w-44 shadow-2xl ring-4 ring-background group-hover:ring-primary/20 transition-all duration-500"
                    />
                  </div>

                  {/* Info Section */}
                  <div className="flex-1 space-y-8 text-center md:text-left min-w-0 pt-2">
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-1">
                          <h1 className="text-2xl font-bold text-foreground tracking-tight">
                            {activeOrganization?.name || 'System Parameters'}
                          </h1>
                          <div className="flex items-center justify-center md:justify-start gap-2">
                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Active Institution</span>
                          </div>
                        </div>
                        {activeOrganization && (
                          <Button 
                            variant="outline" 
                            size="lg" 
                            onClick={() => setIsOrgDialogOpen(true)} 
                            className="rounded-2xl font-bold text-xs h-12 px-6 shrink-0 border-2 hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 shadow-lg shadow-primary/5"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Profile Details
                          </Button>
                        )}
                      </div>
                      <p className="text-base md:text-lg font-medium text-muted-foreground/80 leading-relaxed max-w-3xl">
                        {activeOrganization?.description || 'Manage your organization\'s workspaces, modules, zones, and security roles from a centralized command center.'}
                      </p>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-8 border-t border-border/50">
                      {activeOrganization?.website && (
                        <div className="flex items-center justify-center md:justify-start gap-3 group/link">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover/link:bg-primary group-hover/link:text-white transition-all duration-300">
                            <Globe className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Website</span>
                            <a href={activeOrganization.website} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-foreground hover:text-primary transition-colors truncate">
                              {activeOrganization.website.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        </div>
                      )}
                      {activeOrganization?.email && (
                        <div className="flex items-center justify-center md:justify-start gap-3 group/link">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover/link:bg-primary group-hover/link:text-white transition-all duration-300">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Email</span>
                            <a href={`mailto:${activeOrganization.email}`} className="text-xs font-bold text-foreground hover:text-primary transition-colors truncate">
                              {activeOrganization.email}
                            </a>
                          </div>
                        </div>
                      )}
                      {activeOrganization?.phone && (
                        <div className="flex items-center justify-center md:justify-start gap-3 group/link">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover/link:bg-primary group-hover/link:text-white transition-all duration-300">
                            <Phone className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Support</span>
                            <span className="text-xs font-bold text-foreground truncate">{activeOrganization.phone}</span>
                          </div>
                        </div>
                      )}
                      {activeOrganization?.address && (
                        <div className="flex items-center justify-center md:justify-start gap-3 group/link">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover/link:bg-primary group-hover/link:text-white transition-all duration-300">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col min-w-0 text-left">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Location</span>
                            <span className="text-xs font-bold text-foreground truncate">{activeOrganization.address}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <WorkspaceEditor />
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
          </TabsContent>

          {/* TAB 2: Brand & Aesthetics */}
          <TabsContent value="branding" className="outline-none">
            {activeOrganization ? (
              <OrganizationBrandingTab organization={activeOrganization} onSeedApplied={handleSeedApplied} />
            ) : (
              <div className="text-center py-16 text-muted-foreground text-sm font-medium">Select an organization to customize branding.</div>
            )}
          </TabsContent>

          {/* TAB 3: Localization Settings */}
          <TabsContent value="regional" className="outline-none">
            {activeOrganization ? (
              <OrganizationRegionalTab organization={activeOrganization} />
            ) : (
              <div className="text-center py-16 text-muted-foreground text-sm font-medium">Select an organization to customize regional configs.</div>
            )}
          </TabsContent>

          {/* TAB 4: AI & Integrations */}
          <TabsContent value="integrations" className="outline-none">
            {activeOrganization ? (
              <OrganizationIntegrationsTab organization={activeOrganization} />
            ) : (
              <div className="text-center py-16 text-muted-foreground text-sm font-medium">Select an organization to configure integrations.</div>
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
