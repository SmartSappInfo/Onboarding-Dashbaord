'use client';

import * as React from 'react';
import ActivityTimeline from '../components/ActivityTimeline';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { WorkspaceEntity, UserProfile, Activity, Zone } from '@/lib/types';
import { X, Building, User, Tag, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';

/**
 * ActivitiesClient - Audit Timeline Registry
 * 
 * Updated to utilize the WorkspaceEntity model for institutional targeting.
 */
export default function ActivitiesClient() {
    const firestore = useFirestore();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
    const { singular, plural } = useTerminology();
    
    const [entityId, setEntityId] = React.useState<string | null>('all');
    const [userId, setUserId] = React.useState<string | null>('all');
    const [type, setType] = React.useState<string | null>('all');
    const [zoneId, setZoneId] = React.useState<string | null>('all');

    // ACTIVITY_TYPES with dynamic terminology
    const ACTIVITY_TYPES: { value: Activity['type']; label: string }[] = React.useMemo(() => [
        { value: 'note', label: 'Internal Notes' },
        { value: 'call', label: 'Phone Calls' },
        { value: 'visit', label: `${singular} Visits` },
        { value: 'email', label: 'Emails' },
        { value: 'school_created', label: `${singular} Onboarding` },
        { value: 'school_assigned', label: 'Ownership Changes' },
        { value: 'meeting_created', label: 'Meetings Scheduled' },
        { value: 'pipeline_stage_changed', label: 'Workflow Progression' },
        { value: 'notification_sent', label: 'Messaging Events' },
        { value: 'pdf_form_submitted', label: 'Doc Submissions' },
        { value: 'pdf_status_changed', label: 'Doc Status' },
    ], [singular]);

    // Fetch workspace_entities shared with this workspace
    const entitiesCol = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'workspace_entities'), 
            where('workspaceId', '==', activeWorkspaceId), 
            orderBy('displayName')
        ) : null, 
    [firestore, activeWorkspaceId]);
    
    // ORG-SCOPED IDENTITY LOOKUP
    const usersCol = useMemoFirebase(() => 
        firestore && activeOrganizationId ? query(
            collection(firestore, 'users'), 
            where('organizationId', '==', activeOrganizationId),
            orderBy('name')
        ) : null, 
    [firestore, activeOrganizationId]);
    
    // ORG-SCOPED REGIONAL LOOKUP
    const zonesCol = useMemoFirebase(() => 
        firestore && activeOrganizationId ? query(
            collection(firestore, 'zones'), 
            where('organizationId', '==', activeOrganizationId),
            orderBy('name')
        ) : null, 
    [firestore, activeOrganizationId]);

    const { data: entities } = useCollection<WorkspaceEntity>(entitiesCol);
    const { data: users } = useCollection<UserProfile>(usersCol);
    const { data: zones } = useCollection<Zone>(zonesCol);

    const hasActiveFilters = entityId !== 'all' || userId !== 'all' || type !== 'all' || zoneId !== 'all';

    const clearFilters = () => {
        setEntityId('all');
        setUserId('all');
        setType('all');
        setZoneId('all');
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-5xl mx-auto space-y-8 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6 text-left">
                    <div className="flex justify-end shrink-0 text-left">
                        {hasActiveFilters && (
                            <Button variant="ghost" onClick={clearFilters} className="text-xs font-black uppercase tracking-widest gap-2 h-8 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all text-left">
                                <X className="h-3 w-3" /> Clear All Filters
                            </Button>
                        )}
                    </div>
                </div>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white text-left">
                    <CardContent className="p-4 sm:p-6 text-left">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
                            <div className="space-y-2 text-left">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1 text-left">
                                    <MapPin className="h-3 w-3" /> Geographic Zone
                                </Label>
                                <Select value={zoneId || 'all'} onValueChange={setZoneId}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all text-left">
                                        <SelectValue placeholder="All Zones" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl text-left">
                                        <SelectItem value="all">All Zones</SelectItem>
                                        {zones?.map(z => (
                                            <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 text-left">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1 text-left">
                                    <Building className="h-3 w-3" /> {singular} Context
                                </Label>
                                <Select value={entityId || 'all'} onValueChange={setEntityId}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all text-left">
                                        <SelectValue placeholder={`All ${plural}`} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl text-left">
                                        <SelectItem value="all">All {plural}</SelectItem>
                                        {entities?.map(s => (
                                            <SelectItem key={s.id} value={s.entityId}>{s.displayName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 text-left">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1 text-left">
                                    <User className="h-3 w-3" /> Performed By
                                </Label>
                                <Select value={userId || 'all'} onValueChange={setUserId}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all text-left">
                                        <SelectValue placeholder="All Members" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl text-left">
                                        <SelectItem value="all">All Team Members</SelectItem>
                                        {users?.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 text-left">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1 text-left">
                                    <Tag className="h-3 w-3" /> Event Category
                                </Label>
                                <Select value={type || 'all'} onValueChange={setType}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all text-left">
                                        <SelectValue placeholder="All Categories" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl text-left">
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {ACTIVITY_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-card rounded-[2rem] p-6 sm:p-10 shadow-sm ring-1 ring-border min-h-[600px] text-left">
                    <div className="mb-8 flex items-center gap-3 text-left">
                        <Badge variant="outline" className="bg-background font-black text-[10px] uppercase tracking-widest px-3 py-1 border-primary/20 text-primary">Live Timeline</Badge>
                        <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent text-left" />
                    </div>
                    <ActivityTimeline 
                        entityId={entityId} 
                        userId={userId} 
                        type={type as any} 
                        zoneId={zoneId}
                    />
                </div>
            </div>
        </div>
    );
}
