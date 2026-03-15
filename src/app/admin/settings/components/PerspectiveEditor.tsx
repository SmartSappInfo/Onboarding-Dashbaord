
'use client';

import * as React from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Perspective } from '@/lib/types';
import { 
    Zap, 
    Plus, 
    Trash2, 
    Pencil, 
    ShieldCheck, 
    Loader2, 
    Archive, 
    Check, 
    X,
    Layout,
    Settings2,
    Info,
    ArrowRight,
    AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { savePerspectiveAction, deletePerspectiveAction, archivePerspectiveAction } from '@/lib/perspective-actions';
import { cn } from '@/lib/utils';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * @fileOverview Perspective Architect Console.
 * Allows administrators to manage institutional tracks (Onboarding, Prospects, etc.)
 */
export default function PerspectiveEditor() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    const [isEditing, setIsEditing] = React.useState(false);
    const [activePerspective, setActivePerspective] = React.useState<Perspective | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // Form State
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [color, setColor] = React.useState('#3B5FFF');

    const perspectivesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'perspectives'), orderBy('createdAt', 'asc')) : null, 
    [firestore]);
    const { data: perspectives, isLoading } = useCollection<Perspective>(perspectivesQuery);

    const handleOpenEdit = (p?: Perspective) => {
        if (p) {
            setActivePerspective(p);
            setName(p.name);
            setDescription(p.description || '');
            setColor(p.color || '#3B5FFF');
        } else {
            setActivePerspective(null);
            setName('');
            setDescription('');
            setColor('#3B5FFF');
        }
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim()) return;
        setIsSaving(true);

        const result = await savePerspectiveAction(
            activePerspective?.id || null,
            { name: name.trim(), description: description.trim(), color },
            user.uid
        );

        if (result.success) {
            toast({ title: activePerspective ? 'Perspective Updated' : 'Perspective Created' });
            setIsEditing(false);
        } else {
            toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
        }
        setIsSaving(false);
    };

    const handleDelete = async (p: Perspective) => {
        if (!user) return;
        const result = await deletePerspectiveAction(p.id, user.uid);
        
        if (result.success) {
            toast({ title: 'Perspective Purged' });
        } else {
            toast({ 
                variant: 'destructive', 
                title: 'Constraint Alert', 
                description: result.error 
            });
        }
    };

    const handleArchive = async (p: Perspective) => {
        const result = await archivePerspectiveAction(p.id, p.status === 'active');
        if (result.success) {
            toast({ title: p.status === 'active' ? 'Perspective Archived' : 'Perspective Restored' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="text-left">
                    <h3 className="text-xl font-black uppercase tracking-tight">Perspective Architect</h3>
                    <p className="text-sm text-muted-foreground font-medium">Define managed institutional tracks and workspaces.</p>
                </div>
                <Button onClick={() => handleOpenEdit()} className="rounded-xl font-black h-11 px-6 shadow-lg gap-2">
                    <Plus className="h-4 w-4" /> New Perspective
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-[2rem]" />)
                ) : perspectives?.map(p => (
                    <Card key={p.id} className={cn(
                        "rounded-[2.5rem] border-none ring-1 transition-all duration-500 overflow-hidden bg-white text-left group",
                        p.status === 'archived' ? "opacity-50 grayscale ring-border" : "ring-border shadow-sm hover:ring-primary/20 hover:shadow-xl"
                    )}>
                        <div className="h-1.5 w-full" style={{ backgroundColor: p.color || '#3B5FFF' }} />
                        <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between">
                            <div className="min-w-0">
                                <CardTitle className="text-base font-black uppercase tracking-tight truncate">{p.name}</CardTitle>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">ID: {p.id}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleOpenEdit(p)}>
                                    <Pencil className="h-4 w-4 text-primary" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleArchive(p)}>
                                    <Archive className="h-4 w-4 text-orange-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleDelete(p)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 space-y-4">
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]">{p.description || 'No description provided.'}</p>
                            <div className="flex items-center justify-between pt-2">
                                <Badge variant={p.status === 'active' ? 'default' : 'outline'} className="text-[8px] font-black uppercase px-2 h-5">
                                    {p.status}
                                </Badge>
                                <span className="text-[9px] font-bold text-muted-foreground/40 tabular-nums">Sync: {format(new Date(p.updatedAt), 'MMM d, HH:mm')}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <form onSubmit={handleSave} className="text-left">
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                                    <Zap className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                        {activePerspective ? 'Modify Workspace' : 'New Perspective'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Architect a new institutional track</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="p-8 space-y-8 bg-background">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Label</Label>
                                <Input 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    placeholder="e.g. Higher Education Onboarding" 
                                    className="h-12 rounded-xl bg-muted/20 border-none font-bold text-lg px-4" 
                                    required 
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Thematic Branding (Color)</Label>
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

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objective Brief</Label>
                                <Textarea 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    placeholder="Define the scope of this perspective..." 
                                    className="min-h-[100px] rounded-xl bg-muted/20 border-none p-4 font-medium" 
                                />
                            </div>

                            <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4 shadow-inner">
                                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-blue-900 uppercase">Seamless Linking</p>
                                    <p className="text-[9px] font-bold text-blue-800/60 leading-relaxed uppercase tracking-tighter">
                                        Perspectives are linked to schools via unique identifiers. Renaming a perspective will instantly update its display name across all linked records.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between items-center sm:justify-between">
                            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl font-bold h-12 px-8">Discard</Button>
                            <Button 
                                type="submit" 
                                disabled={isSaving || !name.trim()} 
                                className="rounded-xl font-black h-12 px-10 shadow-2xl bg-primary text-white gap-2 uppercase tracking-widest text-xs"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                Commit Blueprint
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
