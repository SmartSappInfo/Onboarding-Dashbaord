'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { EntityNote } from '@/lib/types';
import { MessageSquare, Trash2, Edit2, Check, X, Send, Loader2, Pin, PinOff, Phone, Users, AlertTriangle, Clock, Filter, Reply, CornerDownRight, Briefcase, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Badge } from '@/components/ui/badge';
import { logNoteActivity, getEntityAiSummary } from '@/lib/note-actions';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Sparkles, BrainCircuit, ListChecks, TrendingUp, TrendingDown, Info, Settings2 } from 'lucide-react';
import PromptSettingsSheet from '@/app/admin/components/PromptSettingsSheet';

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
    const [searchQuery, setSearchQuery] = React.useState('');
    const [composerDropdownOpen, setComposerDropdownOpen] = React.useState(false);
    const [filterDropdownOpen, setFilterDropdownOpen] = React.useState(false);
    
    const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
    const [aiSummary, setAiSummary] = React.useState<any>(null);
    const [promptSettingsOpen, setPromptSettingsOpen] = React.useState(false);

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
                orderBy('createdAt', 'desc'),
                limit(100)
            );
        }
        if (!entityId) return null;
        return query(
            collection(firestore, 'entity_notes'),
            where('entityId', '==', entityId),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('createdAt', 'desc'),
            limit(100)
        );
    }, [firestore, entityId, activeWorkspaceId, scope, dealId]);

    const { data: notes, isLoading } = useCollection<EntityNote>(notesQuery);

    const handleAddNote = async (parentId?: string) => {
        const content = parentId ? replyContent : newNote;
        if (!content.trim() || !firestore || !user || !activeWorkspaceId) return;
        
        // Escape HTML / Script tags to prevent XSS payloads
        const sanitizedContent = content.trim()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        setIsSubmitting(true);
        try {
            const noteData: any = {
                entityId,
                workspaceId: activeWorkspaceId,
                content: sanitizedContent,
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
            const result = await getEntityAiSummary(
                notes,
                undefined, // entityName will fallback inside flow
                activeWorkspaceId,
                activeOrganizationId
            );
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
        
        // Filter by search query if present
        if (searchQuery.trim()) {
            const queryText = searchQuery.toLowerCase().trim();
            result = result.filter(n => 
                n.content.toLowerCase().includes(queryText) ||
                (n.createdByName && n.createdByName.toLowerCase().includes(queryText))
            );
        }

        // Sorting: Pinned first, then by date
        result.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        if (filterType === 'pinned') return result.filter(n => n.isPinned);
        if (filterType !== 'all') return result.filter(n => n.noteType === filterType);
        return result;
    }, [notes, filterType, searchQuery]);

    const getRepliesForNote = (noteId: string) => {
        if (!notes) return [];
        return notes
            .filter(n => n.parentNoteId === noteId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    };

    return (
        <div className="space-y-6 text-left">
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-border/40 bg-card/30 backdrop-blur-md p-3 rounded-2xl relative overflow-visible">
                <div className="relative flex-1 min-w-[200px]">
                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <input
                        type="text"
                        placeholder="Search notes history..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900/50 border border-border/40 text-slate-100 placeholder:text-slate-650 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30"
                    />
                </div>
                <div className="flex items-center gap-2 relative overflow-visible">
                    {/* Dropdown Select menu for filtering */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setFilterDropdownOpen(!filterDropdownOpen);
                                setComposerDropdownOpen(false);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-border/40 bg-slate-900/50 text-slate-300 hover:text-slate-100 transition-all select-none"
                        >
                            <Filter className="h-3.5 w-3.5 opacity-60" />
                            <span>
                                {filterType === 'all' 
                                    ? 'All Notes' 
                                    : filterType === 'pinned' 
                                    ? 'Pinned' 
                                    : noteTypes.find(t => t.id === filterType)?.label || filterType}
                            </span>
                            <ChevronDown className="h-3.5 w-3.5 opacity-45" />
                        </button>
                        {filterDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-40 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <button
                                    onClick={() => { setFilterType('all'); setFilterDropdownOpen(false); }}
                                    className={cn("w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-900 transition-colors", filterType === 'all' ? "text-primary" : "text-slate-400")}
                                >
                                    All Notes
                                </button>
                                <button
                                    onClick={() => { setFilterType('pinned'); setFilterDropdownOpen(false); }}
                                    className={cn("w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-900 transition-colors", filterType === 'pinned' ? "text-amber-400" : "text-slate-400")}
                                >
                                    Pinned Notes
                                </button>
                                <div className="h-px bg-border/40 my-1" />
                                {noteTypes.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { setFilterType(t.id as EntityNote['noteType']); setFilterDropdownOpen(false); }}
                                        className={cn("w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-900 transition-colors", filterType === t.id ? "text-primary" : "text-slate-400")}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={() => setShowAddNote(!showAddNote)}
                        className={cn(
                            "rounded-xl font-bold text-xs h-9 px-4 shadow-sm gap-1.5 transition-all select-none",
                            showAddNote ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/25" : "bg-violet-600 hover:bg-violet-500 text-white"
                        )}
                    >
                        {showAddNote ? 'Close' : 'Add Note'}
                    </Button>
                </div>
            </div>

            {/* Collapsible Inline Composer Accordion */}
            <div className={cn(
                "grid transition-all duration-300 ease-in-out overflow-visible",
                showAddNote ? "grid-rows-[1fr] opacity-100 mb-4" : "grid-rows-[0fr] opacity-0 pointer-events-none"
            )}>
                <div className="min-h-0 overflow-visible">
                    <div className="bg-card/45 rounded-2xl p-4 border border-border/40 shadow-sm space-y-3 relative overflow-visible">
                        <div className="flex-1">
                            <Textarea 
                                placeholder={noteType === 'call' ? "Summarize the call outcome…" : "Type a new note…"}
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                className="w-full bg-slate-900/40 border border-border/30 rounded-xl text-xs p-3 text-slate-200 placeholder:text-slate-650 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:ring-offset-0 min-h-[80px] resize-none"
                                autoFocus={compact}
                            />
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border/30 overflow-visible">
                            {/* Note Type select dropdown pill */}
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        setComposerDropdownOpen(!composerDropdownOpen);
                                        setFilterDropdownOpen(false);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border border-border/50 bg-slate-900/60 text-slate-300 hover:text-slate-100 transition-all select-none"
                                >
                                    {React.createElement(noteTypes.find(t => t.id === noteType)?.icon || MessageSquare, { className: "h-3.5 w-3.5 opacity-60" })}
                                    <span>{noteTypes.find(t => t.id === noteType)?.label || noteType}</span>
                                    <ChevronDown className="h-3 w-3 opacity-65" />
                                </button>

                                {composerDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1.5 w-40 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {noteTypes.map((t) => {
                                            const Icon = t.icon;
                                            return (
                                                <button
                                                    key={t.id}
                                                    onClick={() => {
                                                        setNoteType(t.id as EntityNote['noteType']);
                                                        setComposerDropdownOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-bold hover:bg-slate-800 transition-colors",
                                                        noteType === t.id ? "text-primary bg-slate-900" : "text-slate-400 hover:text-slate-200"
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                    <span>{t.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <Button 
                                onClick={() => handleAddNote()} 
                                disabled={!newNote.trim() || isSubmitting}
                                className="rounded-full h-8 px-4 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-500/10 active:scale-[0.98] transition-all"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    'Save Note'
                                )}
                            </Button>
                    </div>
                </div>
            </div>
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
                        <div className="flex items-center gap-2">
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
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-indigo-500 hover:bg-indigo-500/10 rounded-xl"
                                onClick={() => setPromptSettingsOpen(true)}
                                title="Configure Prompt Overrides"
                            >
                                <Settings2 className="h-4 w-4" />
                            </Button>
                        </div>

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
                                    "rounded-xl p-4 transition-all duration-200 group relative border border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/50 shadow-sm",
                                    note.noteType === 'call' ? "border-l-2 border-l-blue-500/70" :
                                    note.noteType === 'meeting' ? "border-l-2 border-l-purple-500/70" :
                                    note.noteType === 'escalation' ? "border-l-2 border-l-red-500/70" :
                                    note.noteType === 'followup' ? "border-l-2 border-l-amber-500/70" :
                                    "border-l-2 border-l-slate-600/40",
                                    note.isPinned && "shadow-md ring-1 ring-amber-500/10"
                                )}>
                                    {note.isPinned && (
                                        <div className="absolute -top-2.5 -left-1 bg-amber-500 text-white p-1 rounded-lg shadow-lg z-10">
                                            <Pin className="h-3 w-3 fill-current" />
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-350">
                                                {note.createdByName ? note.createdByName.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-semibold text-slate-200 leading-none">{note.createdByName || 'Unknown User'}</p>
                                                    {note.noteType && note.noteType !== 'general' && (
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
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
                                                <p className="text-[9px] text-slate-500 mt-0.5">
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
                                                    note.isPinned ? "text-amber-500 hover:bg-slate-800" : "text-muted-foreground hover:text-amber-500"
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
                                                className="min-h-[80px] text-xs resize-none rounded-xl bg-slate-900 border-slate-800"
                                                autoFocus
                                            />
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="outline" className="rounded-lg h-8 text-[10px]" onClick={() => setEditingNoteId(null)}>
                                                    <X className="h-3 w-3 mr-1" /> Cancel
                                                </Button>
                                                <Button size="sm" className="rounded-lg h-8 text-[10px]" onClick={() => handleUpdateNote(note.id)}>
                                                    <Check className="h-3 w-3 mr-1" /> Save
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-normal">{note.content}</p>
                                    )}
                                </div>

                                {/* Replies */}
                                {replies.length > 0 && (
                                    <div className="ml-8 space-y-3 border-l-2 border-border/30 pl-4 py-1">
                                        {replies.map(reply => (
                                            <div key={reply.id} className="bg-slate-900/20 rounded-xl p-4 border border-slate-800/40 relative">
                                                <CornerDownRight className="absolute -left-5 top-4 h-4 w-4 text-border/30" />
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-350">
                                                            {reply.createdByName?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-slate-200">{reply.createdByName}</p>
                                                            <p className="text-[9px] text-slate-500">{format(new Date(reply.createdAt), 'MMM d, h:mm a')}</p>
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
                                                <p className="text-xs text-slate-300 whitespace-pre-wrap">{reply.content}</p>
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

            {activeOrganizationId && (
                <PromptSettingsSheet
                    open={promptSettingsOpen}
                    onOpenChange={setPromptSettingsOpen}
                    flowName="summarizeEntityNotesFlow"
                    organizationId={activeOrganizationId}
                    workspaceId={activeWorkspaceId || ''}
                />
            )}
        </div>
    );
}
