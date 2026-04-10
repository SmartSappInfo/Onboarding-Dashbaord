
'use client';

import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import RoleEditor from './components/RoleEditor';
import WorkspaceEditor from './components/WorkspaceEditor';
import { useTenant } from '@/context/TenantContext';
import { Building, Globe, Mail, Phone, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function SettingsClient() {
  const { activeOrganization } = useTenant();

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-12 bg-muted/5 text-left">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Organization Profile Header */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
          <div className="h-2 w-full bg-primary" />
          <CardContent className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
              {/* Logo Section */}
              <div className="shrink-0">
                {activeOrganization?.logoUrl ? (
                  <img 
                    src={activeOrganization.logoUrl} 
                    alt={activeOrganization.name}
                    className="h-32 w-32 md:h-40 md:w-40 rounded-[2rem] object-cover shadow-2xl ring-4 ring-primary/5"
                  />
                ) : (
                  <div className="h-32 w-32 md:h-40 md:w-40 rounded-[2rem] bg-primary/5 flex items-center justify-center shadow-inner">
                    <Building className="h-16 w-16 md:h-20 md:w-20 text-primary opacity-20" />
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div className="flex-1 space-y-6 text-center md:text-left min-w-0">
                <div className="space-y-2">
                  <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-foreground leading-none">
                    {activeOrganization?.name || 'Organization Settings'}
                  </h1>
                  <p className="text-sm md:text-lg font-medium text-muted-foreground leading-relaxed max-w-2xl">
                    {activeOrganization?.description || 'Manage your organization\'s workspaces, modules, zones, and security roles from a centralized command center.'}
                  </p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-muted">
                  {activeOrganization?.website && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <Globe className="h-4 w-4 text-primary" />
                      <a href={activeOrganization.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors truncate">
                        {activeOrganization.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {activeOrganization?.email && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <Mail className="h-4 w-4 text-primary" />
                      <a href={`mailto:${activeOrganization.email}`} className="hover:text-primary transition-colors truncate">
                        {activeOrganization.email}
                      </a>
                    </div>
                  )}
                  {activeOrganization?.phone && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground text-left">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="truncate">{activeOrganization.phone}</span>
                    </div>
                  )}
                  {activeOrganization?.address && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground text-left">
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

        <div className="space-y-8">
          <RoleEditor />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ModuleEditor />
            <ZoneEditor />
          </div>
        </div>
      </div>
    </div>
  );
}
