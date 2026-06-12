'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { EntityNote } from '@/lib/types';
import { MessageSquare, Trash2, Edit2, Check, X, Send, Loader2, Pin, PinOff, Phone, Users, AlertTriangle, Clock, Filter, Reply, CornerDownRight, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Badge } from '@/components/ui/badge';
import { logNoteActivity, getEntityAiSummary } from '@/lib/note-actions';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Sparkles, BrainCircuit, ListChecks, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface EntityNotesTabProps {
    entityId: string;
    /** When true, hide the text area until "Add Note" is clicked */
    compact?: boolean;
    /**
     * When set, the tab operates in "deal scope": it queries notes for this
     * deal (not the whole entity) and stamps new notes with the deal link.
     * Notes still carry `entityId`, so they also appear in the entity panel.
     */
    dealId?: string;
    dealName?: string;
}

export default function EntityNotesTab({ entityId, compact = false, dealId, dealName }: EntityNotesTabProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
    const { toast } = useToast();
    const confirm = useConfirm();

    const [newNote, setNewNote] = React.useState('');
    const [noteType, setNoteType] = React.useState<EntityNote['noteType']>('general');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showAddNote, setShowAddNote] = React.useState(false);
    
    const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
    const [editContent, setEditContent] = React.useState('');
    const [replyingToId, setReplyingToId] = React.useState<string | null>(null);
    const [replyContent, setReplyContent] = React.useState('');
    const [filterType, setFilterType] = React.useState<'all' | 'pinned' | EntityNote['noteType']>('all');
    
    const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
    const [aiSummary, setAiSummary] = React.useState<any>(null);

    const noteTypes = [
        { id: 'general', label: 'General', icon: MessageSquare, color: 'text-muted-foreground bg-muted/50' },
        { id: 'call', label: 'Call Summary', icon: Phone, color: 'text-blue-500 bg-blue-500/10' },
        { id: 'meeting', label: 'Meeting', icon: Users, color: 'text-purple-500 bg-purple-500/10' },
        { id: 'escalation', label: 'Escalation', icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
        { id: 'followup', label: 'Follow-up', icon: Clock, color: 'text-amber-500 bg-amber-500/10' },
    ];

    // 'deal' scope shows only this deal's notes; 'entity' scope shows all of
    // the entity's notes (including deal-linked ones, badged with a deal chip).
    const scope: 'deal' | 'entity' = dealId ? 'deal' : 'entity';

    // Fetch Notes
    const notesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        if (scope === 'deal') {
            return query(
                collection(firestore, 'entity_notes'),
                where('dealId', '==', dealId),
                where('workspaceId', '==', activeWorkspaceId),
                orderBy('createdAt', 'desc')
            );
        }
        if (!entityId) return null;
        return query(
            collection(firestore, 'entity_notes'),
            where('entityId', '==', entityId),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, entityId, activeWorkspaceId, scope, dealId]);

    const { data: notes, isLoading } = useCollection<EntityNote>(notesQuery);

    const handleAddNote = async (parentId?: string) => {
        const content = parentId ? replyContent : newNote;
        if (!content.trim() || !firestore || !user || !activeWorkspaceId) return;
        
        setIsSubmitting(true);
        try {
            const noteData: any = {
                entityId,
                workspaceId: activeWorkspaceId,
                content: content.trim(),
                noteType: parentId ? 'general' : noteType,
                isPinned: false,
                createdBy: user.uid,
                createdByName: user.displayName || 'Unknown User',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            if (parentId) {
                noteData.parentNoteId = parentId;
            }

            // Stamp the deal link in deal scope (and on replies, which inherit it).
            if (dealId) {
                noteData.dealId = dealId;
                if (dealName) noteData.dealName = dealName;
            }

            await addDoc(collection(firestore, 'entity_notes'), noteData);
            
            if (parentId) {
                // Increment parent reply count
                await updateDoc(doc(firestore, 'entity_notes', parentId), {
                    replyCount: (notes?.find(n => n.id === parentId)?.replyCount || 0) + 1
                });
                setReplyContent('');
                setReplyingToId(null);
            } else {
                setNewNote('');
                setNoteType('general');
                if (compact) setShowAddNote(false);
            }

            // Log to activity feed (non-blocking server action)
            logNoteActivity(noteData, activeOrganizationId);
            
            toast({ title: parentId ? 'Reply added' : 'Note added successfully' });
        } catch (error: any) {
            console.error('Error adding note:', error);
            toast({ title: 'Failed to add note', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateNote = async (noteId: string) => {
        if (!editContent.trim() || !firestore) return;
        
        try {
            await updateDoc(doc(firestore, 'entity_notes', noteId), {
                content: editContent.trim(),
                updatedAt: new Date().toISOString()
            });
            setEditingNoteId(null);
            setEditContent('');
            toast({ title: 'Note updated successfully' });
        } catch (error: any) {
            console.error('Error updating note:', error);
            toast({ title: 'Failed to update note', description: error.message, variant: 'destructive' });
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!firestore) return;
        if (!(await confirm({ title: 'Delete note?', description: 'This note will be permanently deleted.', confirmText: 'Delete', variant: 'destructive' }))) return;
        
        try {
            await deleteDoc(doc(firestore, 'entity_notes', noteId));
            toast({ title: 'Note deleted' });
        } catch (error: any) {
            console.error('Error deleting note:', error);
            toast({ title: 'Failed to delete note', description: error.message, variant: 'destructive' });
        }
    };

    const togglePin = async (note: EntityNote) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'entity_notes', note.id), {
                isPinned: !note.isPinned,
                pinnedAt: !note.isPinned ? new Date().toISOString() : null,
                pinnedBy: !note.isPinned ? user?.uid : null
            });
            toast({ title: note.isPinned ? 'Note unpinned' : 'Note pinned' });
        } catch (error: any) {
            console.error('Error pinning note:', error);
            toast({ title: 'Failed to update pin', variant: 'destructive' });
        }
    };

    const handleGenerateAiBrief = async () => {
        if (!notes || notes.length === 0) return;
        setIsGeneratingSummary(true);
        try {
            const result = await getEntityAiSummary(notes);
            if (result.success) {
                setAiSummary(result.summary);
                toast({ title: 'AI Brief generated' });
            } else {
                toast({ title: 'AI Generation failed', description: result.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'Error generating brief', variant: 'destructive' });
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const filteredNotes = React.useMemo(() => {
        if (!notes) return [];
        
        // Filter out replies from the top-level list
        let result = notes.filter(n => !n.parentNoteId);
        
        // Sorting: Pinned first, then by date
        result.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        if (filterType === 'pinned') return result.filter(n => n.isPinned);
        if (filterType !== 'all') return result.filter(n => n.noteType === filterType);
        return result;
    }, [notes, filterType]);

    const getRepliesForNote = (noteId: string) => {
        if (!notes) return [];
        return notes
            .filter(n => n.parentNoteId === noteId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    };

    return (
        <div className="space-y-6 text-left">
            {showAddNote ? (
                <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {noteTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => setNoteType(type.id as EntityNote['noteType'])}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                                        noteType === type.id 
                                            ? "bg-primary border-primary text-primary-foreground shadow-sm" 
                                            : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    <type.icon className="h-3 w-3" />
                                    {type.label}
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "p-3 rounded-xl shrink-0 transition-colors duration-300",
                                noteTypes.find(t => t.id === noteType)?.color
                            )}>
                                {React.createElement(noteTypes.find(t => t.id === noteType)?.icon || MessageSquare, { className: "h-5 w-5" })}
                            </div>
                            <div className="flex-1 space-y-3">
                                <Textarea 
                                    placeholder={noteType === 'call' ? "Summarize the call outcome…" : "Type a new note…"}
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    className="min-h-[100px] resize-y rounded-xl border-border/50 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/20"
                                    autoFocus={compact}
                                />
                                <div className="flex justify-end gap-2">
                                    {compact && (
                                        <Button variant="ghost" size="sm" className="rounded-xl font-bold" onClick={() => { setShowAddNote(false); setNewNote(''); setNoteType('general'); }}>
                                            Cancel
                                        </Button>
                                    )}
                                    <Button 
                                        onClick={() => handleAddNote()} 
                                        disabled={!newNote.trim() || isSubmitting}
                                        className="rounded-xl shadow-sm gap-2 font-bold px-6"
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        Add Note
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <Button 
                    variant="outline" 
                    className="w-full rounded-xl font-bold h-10 border-dashed border-border/50 text-muted-foreground hover:text-primary hover:border-primary/30 gap-2"
                    onClick={() => setShowAddNote(true)}
                >
                    <MessageSquare className="h-4 w-4" /> Add Note
                </Button>
            )}

            {/* Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <div className="p-1.5 bg-muted/30 rounded-lg shrink-0">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <button
                    onClick={() => setFilterType('all')}
                    className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all",
                        filterType === 'all' ? "bg-primary text-primary-foreground" : "bg-card border border-border/50 text-muted-foreground hover:bg-muted"
                    )}
                >
                    All Notes
                </button>
                <button
                    onClick={() => setFilterType('pinned')}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all",
                        filterType === 'pinned' ? "bg-amber-500 text-white" : "bg-card border border-border/50 text-muted-foreground hover:bg-muted"
                    )}
                >
                    <Pin className="h-3 w-3" /> Pinned
                </button>
                <div className="h-4 w-[1px] bg-border/50 mx-1 shrink-0" />
                {noteTypes.map(type => (
                    <button
                        key={type.id}
                        onClick={() => setFilterType(type.id as EntityNote['noteType'])}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all",
                            filterType === type.id ? "bg-primary text-primary-foreground" : "bg-card border border-border/50 text-muted-foreground hover:bg-muted"
                        )}
                    >
                        {type.label}
                    </button>
                ))}
            </div>

            {/* AI Summary Section */}
            {notes && notes.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-2xl p-6 border border-indigo-500/20 shadow-sm relative overflow-hidden group/ai">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/ai:opacity-20 transition-opacity">
                        <BrainCircuit className="h-24 w-24 text-indigo-500" />
                    </div>
                    
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                <Sparkles className="h-4 w-4 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground leading-none">AI Intelligence Brief</h3>
                                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-black opacity-50">Experimental • Gemini 2.0 Flash</p>
                            </div>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl h-8 bg-background/50 border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-500/10 gap-2 font-bold transition-all"
                            onClick={handleGenerateAiBrief}
                            disabled={isGeneratingSummary}
                        >
                            {isGeneratingSummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            {aiSummary ? 'Refresh Brief' : 'Generate Brief'}
                        </Button>
                    </div>

                    {!aiSummary && !isGeneratingSummary && (
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                            Analyze interaction history to extract key themes, sentiment, and recommended next steps for this entity.
                        </p>
                    )}

                    {isGeneratingSummary && (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-indigo-500/10 rounded w-3/4" />
                            <div className="h-4 bg-indigo-500/5 rounded w-1/2" />
                            <div className="h-16 bg-indigo-500/5 rounded w-full" />
                        </div>
                    )}

                    {aiSummary && !isGeneratingSummary && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 relative z-10">
                            <div>
                                <p className="text-sm text-foreground/90 leading-relaxed italic font-medium border-l-4 border-indigo-500/50 pl-4 py-1">
                                    "{aiSummary.executiveSummary}"
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                                        <TrendingUp className="h-3 w-3" /> Key Themes
                                    </h4>
                                    <ul className="space-y-2">
                                        {aiSummary.keyThemes.map((theme: string, i: number) => (
                                            <li key={i} className="text-xs flex items-start gap-2 text-muted-foreground">
                                                <div className="h-1 w-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                                {theme}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                                        <ListChecks className="h-3 w-3" /> Action Items
                                    </h4>
                                    <ul className="space-y-2">
                                        {aiSummary.actionItems.map((item: string, i: number) => (
                                            <li key={i} className="text-xs flex items-start gap-2 text-foreground/80 font-medium">
                                                <div className="h-1.5 w-1.5 rounded-full border border-indigo-500/50 mt-1 shrink-0" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-indigo-500/10">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Sentiment</span>
                                        <Badge className={cn(
                                            "text-[9px] h-5 px-2 font-black uppercase",
                                            aiSummary.recentSentiment === 'positive' && "bg-green-500/10 text-green-500 border-green-500/20",
                                            aiSummary.recentSentiment === 'negative' && "bg-red-500/10 text-red-500 border-red-500/20",
                                            aiSummary.recentSentiment === 'urgent' && "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
                                            aiSummary.recentSentiment === 'neutral' && "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                        )} variant="outline">
                                            {aiSummary.recentSentiment}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground italic">
                                    <Info className="h-3 w-3" />
                                    Generated from {notes.length} history items
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card rounded-2xl p-6 border border-border/50 space-y-3">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                    ))
                ) : filteredNotes && filteredNotes.length > 0 ? (
                    filteredNotes.map(note => {
                        const replies = getRepliesForNote(note.id);
                        
                        return (
                            <div key={note.id} className="space-y-3">
                                <div className={cn(
                                    "rounded-xl p-6 border-l-4 border-amber-400 bg-amber-50/50 transition-shadow duration-200 group relative border-t-0 border-r-0 border-b-0",
                                    note.isPinned ? "shadow-md ring-1 ring-amber-500/10" : "shadow-sm hover:shadow-md"
                                )}>
                                    {note.isPinned && (
                                        <div className="absolute -top-2.5 -left-1 bg-amber-500 text-white p-1 rounded-lg shadow-lg z-10">
                                            <Pin className="h-3 w-3 fill-current" />
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between mb-3 opacity-60">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-amber-200/50 flex items-center justify-center text-[8px] font-medium text-amber-700">
                                                {note.createdByName ? note.createdByName.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] font-medium text-amber-900/70 leading-none">{note.createdByName || 'Unknown User'}</p>
                                                    {note.noteType && note.noteType !== 'general' && (
                                                        <span className="text-[9px] font-medium text-amber-900/50 uppercase tracking-wider">
                                                            • {note.noteType}
                                                        </span>
                                                    )}
                                                    {scope === 'entity' && note.dealId && (
                                                        <Link
                                                            href={`/admin/deals/${note.dealId}`}
                                                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[8px] font-bold hover:bg-primary/20 transition-colors"
                                                            title={note.dealName ? `On deal: ${note.dealName}` : 'View deal'}
                                                        >
                                                            <Briefcase className="h-2.5 w-2.5 shrink-0" />
                                                            <span className="truncate max-w-[120px]">{note.dealName || 'Deal'}</span>
                                                        </Link>
                                                    )}
                                                </div>
                                                <p className="text-[9px] text-amber-900/40 mt-0.5">
                                                    {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
                                                    {note.updatedAt !== note.createdAt && ' (edited)'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg" 
                                                onClick={() => { setReplyingToId(note.id); setReplyContent(''); }} 
                                                aria-label="Reply to note"
                                            >
                                                <Reply className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className={cn(
                                                    "h-8 w-8 rounded-lg transition-colors",
                                                    note.isPinned ? "text-amber-500 hover:bg-amber-50" : "text-muted-foreground hover:text-amber-500"
                                                )} 
                                                onClick={() => togglePin(note)}
                                                aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                                            >
                                                {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                            </Button>
                                            {user?.uid === note.createdBy && editingNoteId !== note.id && (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg" onClick={() => { setEditingNoteId(note.id); setEditContent(note.content); }} aria-label="Edit note">
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg" onClick={() => handleDeleteNote(note.id)} aria-label="Delete note">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {editingNoteId === note.id ? (
                                        <div className="space-y-3 mt-2 animate-in zoom-in-95 duration-200">
                                            <Textarea 
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className="min-h-[80px] text-sm resize-none rounded-xl"
                                                autoFocus
                                            />
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => setEditingNoteId(null)}>
                                                    <X className="h-3 w-3 mr-1" /> Cancel
                                                </Button>
                                                <Button size="sm" className="rounded-lg h-8" onClick={() => handleUpdateNote(note.id)}>
                                                    <Check className="h-3 w-3 mr-1" /> Save
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-amber-950/80 whitespace-pre-wrap leading-relaxed font-normal">{note.content}</p>
                                    )}
                                </div>

                                {/* Replies */}
                                {replies.length > 0 && (
                                    <div className="ml-8 space-y-3 border-l-2 border-border/30 pl-4 py-1">
                                        {replies.map(reply => (
                                            <div key={reply.id} className="bg-muted/30 rounded-xl p-4 border border-border/30 relative">
                                                <CornerDownRight className="absolute -left-5 top-4 h-4 w-4 text-border/50" />
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-bold text-primary">
                                                            {reply.createdByName?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold">{reply.createdByName}</p>
                                                            <p className="text-[9px] text-muted-foreground">{format(new Date(reply.createdAt), 'MMM d, h:mm a')}</p>
                                                        </div>
                                                    </div>
                                                    {user?.uid === reply.createdBy && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-lg opacity-0 group-hover:opacity-100" 
                                                            onClick={() => handleDeleteNote(reply.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-foreground/80 whitespace-pre-wrap">{reply.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Reply Input */}
                                {replyingToId === note.id && (
                                    <div className="ml-8 bg-card rounded-xl p-4 border border-primary/20 animate-in slide-in-from-left-4 duration-300">
                                        <Textarea 
                                            placeholder="Write a reply…"
                                            value={replyContent}
                                            onChange={(e) => setReplyContent(e.target.value)}
                                            className="min-h-[60px] text-xs resize-none rounded-lg mb-3"
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setReplyingToId(null)}>
                                                Cancel
                                            </Button>
                                            <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => handleAddNote(note.id)} disabled={!replyContent.trim() || isSubmitting}>
                                                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                                                Post Reply
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-background/20 opacity-50 flex flex-col items-center gap-3">
                        <MessageSquare className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-semibold text-muted-foreground">No notes found matching your filter</p>
                    </div>
                )}
            </div>
        </div>
    );
}
