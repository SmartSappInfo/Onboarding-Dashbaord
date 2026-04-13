'use client';

import * as React from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Organization } from '@/lib/types';
import { 
    Building, 
    Plus, 
    Trash2, 
    Pencil, 
    Archive, 
    Globe,
    Mail,
    Phone,
    MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { deleteOrganizationAction, archiveOrganizationAction } from '@/lib/organization-actions';
import { cn } from '@/lib/utils';
import { format, isValid, parseISO } from 'date-fns';
import OrganizationManagementDialog from '../../components/OrganizationManagementDialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function OrganizationsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [activeOrganization, setActiveOrganization] = React.useState<Organization | null>(null);
    const [deleteConfirmOrg, setDeleteConfirmOrg] = React.useState<Organization | null>(null);

    const organizationsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'organizations'), orderBy('createdAt', 'desc')) : null, 
    [firestore]);
    const { data: organizations, isLoading } = useCollection<Organization>(organizationsQuery);

    const handleOpenEdit = (org?: Organization) => {
        setActiveOrganization(org || null);
        setIsDialogOpen(true);
    };

    const handleDelete = async (org: Organization) => {
        if (!user) return;
        const result = await deleteOrganizationAction(org.id, user.uid);
        
        if (result.success) {
            toast({ title: 'Organization Deleted' });
            setDeleteConfirmOrg(null);
        } else {
            toast({ 
                variant: 'destructive', 
                title: 'Cannot Delete', 
                description: result.error 
            });
        }
    };

    const handleArchive = async (org: Organization) => {
        const result = await archiveOrganizationAction(org.id, org.status !== 'archived');
        if (result.success) {
            toast({ title: org.status === 'archived' ? 'Organization Restored' : 'Organization Archived' });
        }
    };

    return (
 <div className="h-full overflow-y-auto  space-y-8 bg-background text-left">
 <div className=" space-y-8">
                {/* Header */}
 <div className="flex items-center justify-between px-1">
 <div className="text-left">
 <h1 className="text-3xl font-semibold tracking-tight text-foreground">Organizations</h1>
 <p className="text-sm text-muted-foreground font-medium mt-1">
                            Manage tenant organizations and their global settings
                        </p>
                    </div>
 <Button onClick={() => handleOpenEdit()} className="rounded-xl font-semibold h-11 px-6 shadow-lg gap-2">
 <Plus className="h-4 w-4" /> New Organization
                    </Button>
                </div>

                {/* Organizations Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
 Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-[2rem]" />)
                    ) : organizations?.map(org => (
 <Card key={org.id} className={cn(
                            "rounded-[2.5rem] glass-card overflow-hidden text-left group transition-all duration-500",
                            org.status === 'archived' ? "opacity-50 grayscale ring-border" : "ring-border hover:ring-primary/20 hover:shadow-xl"
                        )}>
 <div className="h-1.5 w-full bg-primary" />
 <CardHeader className="p-6 pb-4">
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {org.logoUrl ? (
                                            <img 
                                                src={org.logoUrl} 
                                                alt={org.name}
 className="h-12 w-12 rounded-xl object-cover shadow-sm shrink-0"
                                            />
                                        ) : (
 <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
 <Building className="h-6 w-6 text-primary" />
                                            </div>
                                        )}
 <div className="min-w-0">
 <CardTitle className="text-base font-semibold tracking-tight truncate">
                                                {org.name}
                                            </CardTitle>
                                            <Badge variant={org.status === 'archived' ? 'outline' : 'default'} className="text-[8px] font-semibold uppercase px-1.5 h-4 mt-1">
                                                {org.status || 'active'}
                                            </Badge>
                                        </div>
                                    </div>
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleOpenEdit(org)}>
 <Pencil className="h-4 w-4 text-primary" />
                                        </Button>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleArchive(org)}>
 <Archive className="h-4 w-4 text-orange-600" />
                                        </Button>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => setDeleteConfirmOrg(org)}>
 <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
 <CardContent className="p-6 pt-0 space-y-4">
                                {org.description && (
 <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]">
                                        {org.description}
                                    </p>
                                )}

                                {/* Contact Info */}
 <div className="space-y-2 pt-2 border-t">
                                    {org.website && (
 <div className="flex items-center gap-2 text-xs">
 <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <a 
                                                href={org.website} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
 className="text-primary hover:underline truncate"
                                            >
                                                {org.website.replace(/^https?:\/\//, '')}
                                            </a>
                                        </div>
                                    )}
                                    {org.email && (
 <div className="flex items-center gap-2 text-xs">
 <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <a 
                                                href={`mailto:${org.email}`}
 className="text-muted-foreground hover:text-foreground truncate"
                                            >
                                                {org.email}
                                            </a>
                                        </div>
                                    )}
                                    {org.phone && (
 <div className="flex items-center gap-2 text-xs">
 <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground">{org.phone}</span>
                                        </div>
                                    )}
                                    {org.address && (
 <div className="flex items-center gap-2 text-xs">
 <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground truncate">{org.address}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Settings */}
                                {org.settings && (
 <div className="flex items-center gap-2 pt-2 border-t">
                                        {org.settings.defaultCurrency && (
                                            <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4">
                                                {org.settings.defaultCurrency}
                                            </Badge>
                                        )}
                                        {org.settings.defaultTimezone && (
                                            <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4">
                                                {org.settings.defaultTimezone}
                                            </Badge>
                                        )}
                                        {org.settings.defaultLanguage && (
                                            <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4">
                                                {org.settings.defaultLanguage}
                                            </Badge>
                                        )}
                                    </div>
                                )}

 <div className="flex items-center justify-between pt-2">
 <span className="text-[9px] font-bold text-muted-foreground/40 tabular-nums">
                                        {(() => {
                                            try {
                                                if (!org.updatedAt) return 'Recently created';
                                                const date = typeof org.updatedAt === 'string' 
                                                    ? parseISO(org.updatedAt) 
                                                    : new Date(org.updatedAt);
                                                return isValid(date) 
                                                    ? `Updated: ${format(date, 'MMM d, yyyy')}` 
                                                    : 'Recently created';
                                            } catch {
                                                return 'Recently created';
                                            }
                                        })()}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Empty State */}
                {!isLoading && organizations?.length === 0 && (
 <div className="text-center py-16">
 <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
 <Building className="h-8 w-8 text-muted-foreground" />
                        </div>
 <h3 className="text-lg font-semibold tracking-tight mb-2">No Organizations</h3>
 <p className="text-sm text-muted-foreground mb-6">Get started by creating your first organization</p>
 <Button onClick={() => handleOpenEdit()} className="rounded-xl font-semibold px-6 shadow-lg gap-2">
 <Plus className="h-4 w-4" /> Create Organization
                        </Button>
                    </div>
                )}
            </div>

            {/* Organization Dialog */}
            <OrganizationManagementDialog 
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                organization={activeOrganization}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteConfirmOrg} onOpenChange={(open) => !open && setDeleteConfirmOrg(null)}>
 <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong>{deleteConfirmOrg?.name}</strong>. 
                            This action cannot be undone and will fail if the organization has any workspaces or users.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
 <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => deleteConfirmOrg && handleDelete(deleteConfirmOrg)}
 className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Organization
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
