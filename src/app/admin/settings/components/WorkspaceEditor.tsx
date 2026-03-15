
'use client';

import * as React from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Workspace, WorkspaceStatus } from '@/lib/types';
import { 
    Zap, 
    Plus, 
    Trash2, 
    Pencil, 
    ShieldCheck, 
    Loader2, 
    Archive, 
    Settings2, 
    Info,
    X,
    Layout,
    Check,
    PlusCircle,
    Palette
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { saveWorkspaceAction, deleteWorkspaceAction, archiveWorkspaceAction } from '@/lib/workspace-actions';
import { cn } from '@/lib/utils';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

export default function WorkspaceEditor() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    const [isEditing, setIsEditing] = React.useState(false);
    const [activeWorkspace, setActiveWorkspace] = React.useState<Workspace | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [color, setColor] = React.useState('#3B5FFF');
    const [statuses, setStatuses] = React.useState<WorkspaceStatus[]>([]);

    const workspacesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'workspaces'), orderBy('createdAt', 'asc')) : null, 
    [firestore]);
    const { data: workspaces, isLoading } = useCollection<Workspace>(workspacesQuery);

    const handleOpenEdit = (w?: Workspace) => {
        if (w) {
            setActiveWorkspace(w);
            setName(w.name);
            setDescription(w.description || '');
            setColor(w.color || '#3B5FFF');
            setStatuses(w.statuses || []);
        } else {
            setActiveWorkspace(null);
            setName('');
            setDescription('');
            setColor('#3B5FFF');
            setStatuses([
                { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF' },
                { value: 'Active', label: 'Active', color: '#10b981' },
                { value: 'Churned', label: 'Churned', color: '#ef4444' }
            ]);
        }
        setIsEditing(true);
    };

    const handleAddStatus = () => {
        setStatuses(prev => [...prev, { value: 'New Status', label: 'New Status', color: '#64748b' }]);
    };

    const updateStatus = (index: number, updates: Partial<WorkspaceStatus>) => {
        const next = [...statuses];
        next[index] = { ...next[index], ...updates };
        setStatuses(next);
    };

    const removeStatus = (index: number) => {
        if (statuses.length === 1) return;
        setStatuses(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim()) return;
        setIsSaving(true);

        const result = await saveWorkspaceAction(
            activeWorkspace?.id || null,
            { name: name.trim(), description: description.trim(), color, statuses },
            user.uid
        );

        if (result.success) {
            toast({ title: activeWorkspace ? 'Workspace Updated' : 'Workspace Created' });
            setIsEditing(false);
        } else {
            toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
        }
        setIsSaving(false);
    };

    const handleDelete = async (w: Workspace) => {
        if (!user) return;
        const result = await deleteWorkspaceAction(w.id, user.uid);
        
        if (result.success) {
            toast({ title: 'Workspace Purged' });
        } else {
            toast({ variant: 'destructive', title: 'Constraint Alert', description: result.error });
        }
    };

    const handleArchive = async (w: Workspace) => {
        const result = await archiveWorkspaceAction(w.id, w.status === 'active');
        if (result.success) {
            toast({ title: w.status === 'active' ? 'Workspace Archived' : 'Workspace Restored' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="text-left">
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Workspace Architect</h3>
                    <p className="text-sm text-muted-foreground font-medium">Manage global tracks and independent status lifecycles.</p>
                </div>
                <Button onClick={() => handleOpenEdit()} className="rounded-xl font-black h-11 px-6 shadow-lg gap-2">
                    <Plus className="h-4 w-4" /> New Workspace
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-[2rem]" />)
                ) : workspaces?.map(w => (
                    <Card key={w.id} className={cn(
                        "rounded-[2.5rem] border-none ring-1 transition-all duration-500 overflow-hidden bg-white text-left group",
                        w.status === 'archived' ? "opacity-50 grayscale ring-border" : "ring-border shadow-sm hover:ring-primary/20 hover:shadow-xl"
                    )}>
                        <div className="h-1.5 w-full" style={{ backgroundColor: w.color || '#3B5FFF' }} />
                        <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between">
                            <div className="min-w-0">
                                <CardTitle className="text-base font-black uppercase tracking-tight truncate">{w.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-[8px] font-black uppercase px-1.5 h-4">{w.statuses?.length || 0} Statuses</Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleOpenEdit(w)}>
                                    <Pencil className="h-4 w-4 text-primary" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleArchive(w)}>
                                    <Archive className="h-4 w-4 text-orange-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleDelete(w)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 space-y-4">
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]">{w.description || 'No description provided.'}</p>
                            <div className="flex items-center justify-between pt-2">
                                <Badge variant={w.status === 'active' ? 'default' : 'outline'} className="text-[8px] font-black uppercase px-2 h-5">
                                    {w.status}
                                </Badge>
                                <span className="text-[9px] font-bold text-muted-foreground/40 tabular-nums">Sync: {format(new Date(w.updatedAt), 'MMM d, HH:mm')}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
                    <form onSubmit={handleSave} className="flex flex-col h-full text-left">
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                                    <Zap className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                        {activeWorkspace ? 'Modify Hub' : 'New Workspace'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Architect a new hub identity and its independent lifecycle.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden relative bg-background">
                            <ScrollArea className="h-full">
                                <div className="p-8 space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Label</Label>
                                                <Input 
                                                    value={name} 
                                                    onChange={e => setName(e.target.value)} 
                                                    placeholder="e.g. Higher Education Onboarding" 
                                                    className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg px-4" 
                                                    required 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Theme (Color)</Label>
                                                <div className="flex gap-3">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <button 
                                                                type="button" 
                                                                className="w-12 h-12 rounded-xl border-2 shadow-sm shrink-0" 
                                                                style={{ backgroundColor: color, borderColor: color + '40' }} 
                                                            />
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-3 rounded-2xl border-none shadow-2xl">
                                                            <div className="grid grid-cols-6 gap-2">
                                                                {ONBOARDING_STAGE_COLORS.map(c => (
                                                                    <button key={c} type="button" onClick={() => setColor(c)} className="w-6 h-6 rounded-md shadow-sm" style={{ backgroundColor: c }} />
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                    <Input value={color} onChange={e => setColor(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-mono font-black text-center uppercase" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objective Brief</Label>
                                            <Textarea 
                                                value={description} 
                                                onChange={e => setDescription(e.target.value)} 
                                                placeholder="Define the scope..." 
                                                className="min-h-[135px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed" 
                                            />
                                        </div>
                                    </div>

                                    <Separator className="opacity-50" />

                                    {/* STATUS ARCHITECT */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between px-1">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="h-4 w-4 text-primary" />
                                                <h4 className="text-xs font-black uppercase tracking-widest">Independent Status Lifecycle</h4>
                                            </div>
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={handleAddStatus}
                                                className="h-8 rounded-xl font-bold border-dashed border-2 text-[10px] uppercase tracking-widest"
                                            >
                                                <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Status Node
                                            </Button>
                                        </div>

                                        <div className="space-y-3">
                                            {statuses.map((status, idx) => (
                                                <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 rounded-2xl bg-muted/10 border group">
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="flex items-center gap-3">
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <button type="button" className="w-8 h-8 rounded-lg shadow-sm border shrink-0" style={{ backgroundColor: status.color }} />
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-2">
                                                                    <div className="grid grid-cols-6 gap-1">
                                                                        {ONBOARDING_STAGE_COLORS.map(c => (
                                                                            <button key={c} type="button" onClick={() => updateStatus(idx, { color: c })} className="w-5 h-5 rounded shadow-sm" style={{ backgroundColor: c }} />
                                                                        ))}
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                            <Input 
                                                                value={status.label} 
                                                                onChange={e => updateStatus(idx, { label: e.target.value, value: e.target.value })} 
                                                                className="h-9 bg-white font-bold text-xs" 
                                                            />
                                                        </div>
                                                        <Input 
                                                            value={status.description || ''} 
                                                            onChange={e => updateStatus(idx, { description: e.target.value })} 
                                                            placeholder="Short behavioral description..."
                                                            className="h-9 bg-white font-medium text-[10px]" 
                                                        />
                                                    </div>
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => removeStatus(idx)}
                                                        className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={16} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4 shadow-inner">
                                        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-blue-900 uppercase">Independent Logic</p>
                                            <p className="text-[9px] font-bold text-blue-800/60 leading-relaxed uppercase tracking-tighter text-left">
                                                Statuses defined here will be available only when this workspace is active. Existing records using deleted statuses will retain their labels until updated.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>

                        <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between">
                            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl font-bold h-12 px-8">Discard</Button>
                            <Button type="submit" disabled={isSaving || !name.trim()} className="rounded-xl font-black px-10 shadow-2xl bg-primary text-white uppercase text-xs h-12">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                Commit Workspace
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
