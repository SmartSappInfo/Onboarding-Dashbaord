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
import { Loader2, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

/**
 * @fileOverview Messaging Templates Management Page.
 * Orchestrates the relationship between the Template Gallery and the Design Workshop.
 */

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    // Global Navigation State
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    const [cloningId, setCloningId] = React.useState<string | null>(null);
    const [templateToDelete, setTemplateToDelete] = React.useState<MessageTemplate | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Data Subscriptions
    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc'));
    }, [firestore]);

    const stylesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_styles'), orderBy('name', 'asc'));
    }, [firestore]);

    const schoolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'schools'), orderBy('name', 'asc'));
    }, [firestore]);

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

    const handleSave = async (data: any) => {
        if (!firestore) return;
        
        // Extract technical tags from all content fields
        const contentForExtraction = `${data.subject || ''} ${data.body} ${JSON.stringify(data.blocks || [])}`;
        const varMatches = contentForExtraction.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        const templateData = {
            ...data,
            variables: variableList,
            isActive: true,
            updatedAt: new Date().toISOString(),
        };

        // Ensure we don't send undefined to Firestore
        const sanitizedData = JSON.parse(JSON.stringify(templateData));

        try {
            if (editingTemplate) {
                await updateDoc(doc(firestore, 'message_templates', editingTemplate.id), sanitizedData);
            } else {
                await addDoc(collection(firestore, 'message_templates'), { 
                    ...sanitizedData, 
                    createdAt: new Date().toISOString() 
                });
            }
            toast({ title: 'Template Saved', description: 'Institutional communications updated.' });
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
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
                        <div className="max-w-7xl mx-auto">
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
