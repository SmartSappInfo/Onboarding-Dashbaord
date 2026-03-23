'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, VariableDefinition, MessageStyle, School, Meeting, Survey, PDFForm } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { TemplateGallery } from './components/template-gallery';
import { TemplateWorkshop } from './components/template-workshop';
import { cloneTemplate } from '@/lib/template-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Plus, Sparkles, Wand2, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { generateEmailTemplate } from '@/ai/flows/generate-email-template-flow';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * @fileOverview Messaging Templates Management Page.
 * Features an AI Architect for generative drafting and a Manual Workshop for precision design.
 * Upgraded with Multi-Workspace Sharing logic.
 */

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const { activeWorkspaceId } = useWorkspace();
    
    // Global Navigation State
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    const [cloningId, setCloningId] = React.useState<string | null>(null);
    const [templateToDelete, setTemplateToDelete] = React.useState<MessageTemplate | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    // AI Architect State
    const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);

    // Data Subscriptions - Filtered by Active Workspace
    const templatesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_templates'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, activeWorkspaceId]);

    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc'));
    }, [firestore]);

    const stylesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_styles'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);

    const schoolsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'schools'), where('workspaceIds', 'array-contains', activeWorkspaceId), orderBy('name', 'asc'));
    }, [firestore, activeWorkspaceId]);

    const meetingsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'meetings'), orderBy('meetingTime', 'desc'));
    }, [firestore]);

    const surveysQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'surveys'), where('status', '==', 'published'));
    }, [firestore]);

    const pdfsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'pdfs'), where('status', '==', 'published'));
    }, [firestore]);

    const { data: templates, isLoading: isLoadingTemplates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);
    const { data: styles } = useCollection<MessageStyle>(stylesQuery);
    const { data: schools } = useCollection<School>(schoolsQuery);
    const { data: meetings } = useCollection<Meeting>(meetingsQuery);
    const { data: surveys } = useCollection<Survey>(surveysQuery);
    const { data: pdfs } = useCollection<PDFForm>(pdfsQuery);

    const handleEdit = (tmpl: MessageTemplate) => {
        setEditingTemplate(tmpl);
        setIsAdding(true);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingTemplate(null);
    };

    const handleAiArchitect = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiProcessing(true);
        try {
            const availableKeys = (variables || []).map(v => v.key);
            
            const result = await generateEmailTemplate({
                prompt: aiPrompt,
                channel: 'email',
                availableVariables: availableKeys
            });

            const draftTemplate: any = {
                name: result.name,
                subject: result.subject || '',
                body: result.body,
                blocks: result.blocks || [],
                channel: 'email',
                category: 'general',
                workspaceIds: [activeWorkspaceId], // Automatically bind to current hub
                isActive: true
            };

            setEditingTemplate(draftTemplate);
            setIsAdding(true);
            setIsAiModalOpen(false);
            setAiPrompt('');
            toast({ title: 'AI Architecture Generated', description: result.explanation });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Architect Failure', description: e.message });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleSave = async (data: any) => {
        if (!firestore || !user) return;
        
        const contentForExtraction = `${data.subject || ''} ${data.body} ${JSON.stringify(data.blocks || [])}`;
        const varMatches = contentForExtraction.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        // Ensure workspaceIds exists
        const workspaceIds = data.workspaceIds && data.workspaceIds.length > 0 
            ? data.workspaceIds 
            : [activeWorkspaceId];

        const templateData = {
            ...data,
            workspaceIds,
            variables: variableList,
            isActive: true,
            updatedAt: new Date().toISOString(),
        };

        const sanitizedData = JSON.parse(JSON.stringify(templateData));

        try {
            if (editingTemplate?.id) {
                await updateDoc(doc(firestore, 'message_templates', editingTemplate.id), sanitizedData);
            } else {
                await addDoc(collection(firestore, 'message_templates'), { 
                    ...sanitizedData, 
                    createdAt: new Date().toISOString() 
                });
            }
            toast({ title: 'Template Protocol Saved' });
            setIsAdding(false);
            setEditingTemplate(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        }
    };

    const handleClone = async (tmpl: MessageTemplate) => {
        if (!user) return;
        setCloningId(tmpl.id);
        try {
            const result = await cloneTemplate(tmpl.id, user.uid);
            if (result.success) toast({ title: 'Clone Successful' });
            else throw new Error(result.error);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Clone Error', description: e.message });
        } finally {
            setCloningId(null);
        }
    };

    const handleDelete = async () => {
        if (!firestore || !templateToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'message_templates', templateToDelete.id));
            toast({ title: 'Template Removed' });
            setTemplateToDelete(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background">
            <AnimatePresence mode="wait">
                {isAdding ? (
                    <TemplateWorkshop 
                        key="workshop"
                        initialTemplate={editingTemplate}
                        variables={variables || []}
                        styles={styles || []}
                        schools={schools || []}
                        meetings={meetings || []}
                        surveys={surveys || []}
                        pdfs={pdfs || []}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        isSaving={false}
                    />
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
                        <div className="max-w-7xl mx-auto space-y-8">
                            <div className="flex items-center justify-end flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                    <RainbowButton 
                                        onClick={() => setIsAiModalOpen(true)} 
                                        className="h-11 px-6 gap-2 font-black uppercase text-[10px] tracking-widest shadow-xl"
                                    >
                                        <Sparkles className="h-4 w-4" /> AI Architect
                                    </RainbowButton>
                                    <Button 
                                        onClick={() => { setEditingTemplate(null); setIsAdding(true); }} 
                                        className="rounded-xl font-bold h-11 px-6 shadow-lg gap-2"
                                    >
                                        <Plus className="h-5 w-5" /> Manual Create
                                    </Button>
                                </div>
                            </div>

                            <TemplateGallery 
                                templates={templates || []}
                                isLoading={isLoadingTemplates}
                                cloningId={cloningId}
                                onEdit={handleEdit}
                                onClone={handleClone}
                                onDelete={setTemplateToDelete}
                                onPreview={handleEdit}
                            />
                        </div>
                    </div>
                )}
            </AnimatePresence>

            <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
                <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-8 bg-primary/5 border-b border-primary/10 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                <Wand2 className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">AI Template Architect</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-primary/60">Generate a high-fidelity communication blueprint.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Communication Goal</Label>
                            <Textarea 
                                value={aiPrompt} 
                                onChange={e => setAiPrompt(e.target.value)} 
                                placeholder="e.g. Create a formal email inviting parents to a meeting. Mention that we'll discuss the new security module."
                                className="min-h-[180px] rounded-[2rem] bg-muted/20 border-none shadow-inner p-6 leading-relaxed text-lg"
                                autoFocus
                            />
                        </div>
                        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4">
                            <Zap className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-black text-blue-900 uppercase tracking-tighter">Institutional Track Context</p>
                                <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-widest opacity-80">
                                    The AI will bind the new template to the **{activeWorkspaceId}** hub and automatically scan for relevant dynamic tags.
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/30 p-6 border-t flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" onClick={() => setIsAiModalOpen(false)} disabled={isAiProcessing} className="font-bold rounded-xl h-12 px-8">Discard</Button>
                        <RainbowButton 
                            onClick={handleAiArchitect} 
                            disabled={isAiProcessing || !aiPrompt.trim()}
                            className="h-12 px-12 font-black shadow-2xl uppercase tracking-widest text-sm"
                        >
                            {isAiProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            {isAiProcessing ? 'Architecting...' : 'Generate Blueprint'}
                        </RainbowButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!templateToDelete} onOpenChange={(o) => !o && setTemplateToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black text-xl uppercase tracking-tight">Remove Template?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">
                            Deleting <span className="font-bold text-foreground">"{templateToDelete?.name}"</span> will permanently remove it from the institutional repository.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl font-bold">Retain Blueprint</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            disabled={isDeleting}
                            className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Permanently Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
