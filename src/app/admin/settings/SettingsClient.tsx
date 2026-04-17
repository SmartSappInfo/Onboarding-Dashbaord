
'use client';

import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
// RoleEditor has been moved to /admin/users/roles/RolesClient.tsx
import WorkspaceEditor from './components/WorkspaceEditor';
import FeatureManager from './components/FeatureManager';
import { useTenant } from '@/context/TenantContext';
import { Building, Globe, Mail, Phone, MapPin, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as React from 'react';
import OrganizationManagementDialog from '../components/OrganizationManagementDialog';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function SettingsClient() {
  const { activeOrganization } = useTenant();
  const [isOrgDialogOpen, setIsOrgDialogOpen] = React.useState(false);

  return (
 <div className="h-full overflow-y-auto  space-y-12 bg-background text-left">
 <div className=" space-y-12">
        {/* Organization Profile Header */}
        <Card className="rounded-2xl border border-border bg-card overflow-hidden">
 <div className="h-2 w-full bg-primary" />
 <CardContent className="p-8 md:p-12">
 <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
              {/* Logo Section */}
 <div className="shrink-0">
                {activeOrganization?.logoUrl ? (
                  <img 
                    src={activeOrganization.logoUrl} 
                    alt={activeOrganization.name}
                    className="h-32 w-32 md:h-40 md:w-40 rounded-2xl object-cover shadow-sm ring-1 ring-border"
                  />
                ) : (
                  <div className="h-32 w-32 md:h-40 md:w-40 rounded-2xl bg-muted/50 border border-border flex items-center justify-center">
                    <Building className="h-16 w-16 md:h-20 md:w-20 text-muted-foreground opacity-40" />
                  </div>
                )}
              </div>

              {/* Info Section */}
 <div className="flex-1 space-y-6 text-center md:text-left min-w-0">
 <div className="space-y-2">
 <div className="flex flex-col md:flex-row items-center justify-between gap-4">
 <h1 className="text-4xl md:text-5xl font-semibold tracking-tighter text-foreground leading-none">
                      {activeOrganization?.name || 'Organization Settings'}
                    </h1>
                    {activeOrganization && (
 <Button variant="outline" size="sm" onClick={() => setIsOrgDialogOpen(true)} className="rounded-xl font-bold text-[10px] h-8 shrink-0">
 <Pencil className="w-3 h-3 mr-2" />
                        Edit Organization
                      </Button>
                    )}
                  </div>
 <p className="text-sm md:text-lg font-medium text-muted-foreground leading-relaxed max-w-2xl">
                    {activeOrganization?.description || 'Manage your organization\'s workspaces, modules, zones, and security roles from a centralized command center.'}
                  </p>
                </div>

                {/* Metadata Grid */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-muted">
                  {activeOrganization?.website && (
 <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold text-muted-foreground">
 <Globe className="h-4 w-4 text-primary" />
 <a href={activeOrganization.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors truncate">
                        {activeOrganization.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {activeOrganization?.email && (
 <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold text-muted-foreground">
 <Mail className="h-4 w-4 text-primary" />
 <a href={`mailto:${activeOrganization.email}`} className="hover:text-primary transition-colors truncate">
                        {activeOrganization.email}
                      </a>
                    </div>
                  )}
                  {activeOrganization?.phone && (
 <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold text-muted-foreground text-left">
 <Phone className="h-4 w-4 text-primary" />
 <span className="truncate">{activeOrganization.phone}</span>
                    </div>
                  )}
                  {activeOrganization?.address && (
 <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold text-muted-foreground text-left">
 <MapPin className="h-4 w-4 text-primary" />
 <span className="truncate">{activeOrganization.address}</span>
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
        </div>
      </div>

      <OrganizationManagementDialog 
        open={isOrgDialogOpen} 
        onOpenChange={setIsOrgDialogOpen} 
        organization={activeOrganization} 
      />
    </div>
  );
}
