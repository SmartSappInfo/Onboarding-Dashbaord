'use client';

import * as React from 'react';
import { useFirestore, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAudiences, createAudience, updateAudience, deleteAudience, duplicateAudience } from '@/lib/audience-hooks';
import { useToast } from '@/hooks/use-toast';
import type { MessageAudience, AudienceFilter } from '@/lib/types';
import { FilterBuilder } from './components/filter-builder';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Plus, ArrowLeft, Users, Filter, MoreHorizontal, Copy, Trash2,
    Pencil, Save, Loader2, Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { PageContainer, PageContainerNarrow } from '@/components/ui/page-container';

export default function AudiencesPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspaceId } = useWorkspace() as any;
    const { toast } = useToast();
    const { audiences, isLoading } = useAudiences(activeWorkspaceId);

    const [editorOpen, setEditorOpen] = React.useState(false);
    const [editingAudience, setEditingAudience] = React.useState<MessageAudience | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<MessageAudience | null>(null);

    // Editor state
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [filters, setFilters] = React.useState<AudienceFilter[]>([]);
    const [filterLogic, setFilterLogic] = React.useState<'AND' | 'OR'>('AND');
    const [isSaving, setIsSaving] = React.useState(false);

    const openEditor = (audience?: MessageAudience) => {
        if (audience) {
            setEditingAudience(audience);
            setName(audience.name);
            setDescription(audience.description || '');
            setFilters(audience.filters || []);
            setFilterLogic(audience.filterLogic || 'AND');
        } else {
            setEditingAudience(null);
            setName('');
            setDescription('');
            setFilters([]);
            setFilterLogic('AND');
        }
        setEditorOpen(true);
    };

    const handleSave = async () => {
        if (!firestore || !user || !activeWorkspaceId || !name.trim()) return;
        setIsSaving(true);
        try {
            const data = {
                workspaceId: activeWorkspaceId,
                name: name.trim(),
                description: description.trim() || undefined,
                filters,
                filterLogic,
                createdBy: user.uid,
            };
            if (editingAudience) {
                await updateAudience(firestore, editingAudience.id, data);
                toast({ title: 'Audience Updated' });
            } else {
                await createAudience(firestore, data as any);
                toast({ title: 'Audience Saved' });
            }
            setEditorOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleClone = async (audience: MessageAudience) => {
        if (!firestore || !user) return;
        try {
            await duplicateAudience(firestore, audience, user.uid);
            toast({ title: 'Audience Cloned', description: `"Copy of ${audience.name}" created.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Clone Failed', description: e.message });
        }
    };

    const handleDelete = async () => {
        if (!firestore || !deleteTarget) return;
        try {
            await deleteAudience(firestore, deleteTarget.id);
            toast({ title: 'Audience Deleted' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
        } finally {
            setDeleteTarget(null);
        }
    };

    // ── Editor View ───────────────────────────────────────────────────────────
    if (editorOpen) {
        return (
            <div className="h-full overflow-y-auto">
                <PageContainerNarrow className="pb-20">
                    <div className="space-y-6">
                    <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)} className="gap-2 text-xs font-bold rounded-xl">
                        <ArrowLeft className="h-4 w-4" /> Back to Audiences
                    </Button>
                    <Card className="rounded-2xl border-border/50 shadow-lg">
                        <CardHeader className="bg-muted/20 border-b p-6">
                            <CardTitle className="text-lg font-semibold">{editingAudience ? 'Edit Audience' : 'New Audience'}</CardTitle>
                            <CardDescription className="text-[10px] font-bold text-muted-foreground">
                                Define a reusable audience segment for your campaigns
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Name</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VIP Clients, Active Schools..." className="h-10 rounded-xl bg-card border-border/50 font-bold text-xs" autoFocus />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Description (optional)</Label>
                                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this audience represents..." className="h-10 rounded-xl bg-card border-border/50 font-bold text-xs" />
                                </div>
                            </div>
                            <FilterBuilder filters={filters} filterLogic={filterLogic} onChange={(f, l) => { setFilters(f); setFilterLogic(l); }} />
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button variant="outline" onClick={() => setEditorOpen(false)} className="rounded-xl font-bold text-xs">Cancel</Button>
                                <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="rounded-xl font-bold text-xs gap-1.5 px-6 shadow-lg">
                                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                    {editingAudience ? 'Update Audience' : 'Save Audience'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    </div>
                </PageContainerNarrow>
            </div>
        );
    }

    // ── List View ─────────────────────────────────────────────────────────────
    return (
        <div className="h-full overflow-y-auto">
            <PageContainer>
                <div className="space-y-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">Saved Audiences</h2>
                            <p className="text-[10px] font-bold text-muted-foreground">Reusable segments for targeted campaigns</p>
                        </div>
                    </div>
                    <Button onClick={() => openEditor()} className="h-11 px-6 rounded-xl font-bold text-xs shadow-lg gap-2">
                        <Plus className="h-4 w-4" /> New Audience
                    </Button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
                    </div>
                ) : audiences.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {audiences.map(aud => (
                            <Card key={aud.id} className="group rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/20 overflow-hidden">
                                <CardHeader className="p-5 pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0">
                                            <CardTitle className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{aud.name}</CardTitle>
                                            {aud.description && <CardDescription className="text-[9px] font-bold mt-0.5 line-clamp-2">{aud.description}</CardDescription>}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl w-40">
                                                <DropdownMenuItem onClick={() => openEditor(aud)} className="gap-2 text-xs font-semibold"><Pencil className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleClone(aud)} className="gap-2 text-xs font-semibold"><Copy className="h-3.5 w-3.5" /> Clone</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setDeleteTarget(aud)} className="gap-2 text-xs font-semibold text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-5 pb-5 pt-0 space-y-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Badge variant="outline" className="text-[9px] font-bold h-5 px-2 rounded-lg gap-1">
                                            <Filter className="h-2.5 w-2.5" /> {aud.filters?.length || 0} filter{(aud.filters?.length || 0) !== 1 ? 's' : ''}
                                        </Badge>
                                        {aud.estimatedCount != null && (
                                            <Badge variant="outline" className="text-[9px] font-bold h-5 px-2 rounded-lg gap-1">
                                                <Users className="h-2.5 w-2.5" /> ~{aud.estimatedCount}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[8px] font-bold text-muted-foreground">
                                        Updated {formatDistanceToNow(new Date(aud.updatedAt), { addSuffix: true })}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                            <Inbox className="h-8 w-8 text-primary/40" />
                        </div>
                        <p className="text-lg font-semibold text-foreground/80">No saved audiences</p>
                        <p className="text-xs font-semibold text-muted-foreground mt-1 max-w-sm">Build your first segment to target the right people for your campaigns.</p>
                    </div>
                )}
            </div>

            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Audience?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-semibold">
                            &quot;{deleteTarget?.name}&quot; will be permanently deleted. Campaigns using this audience will keep their snapshot.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-bold text-xs">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="rounded-xl font-bold text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </PageContainer>
        </div>
    );
}
