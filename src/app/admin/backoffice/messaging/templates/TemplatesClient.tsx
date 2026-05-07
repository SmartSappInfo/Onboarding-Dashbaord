'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { TemplateGallery } from '../../../messaging/templates/components/template-gallery';
import { TemplateWorkshop } from '../../../messaging/templates/components/template-workshop';
import { generateContactVariableDefinitions } from '@/lib/contact-variable-definitions';
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
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Plus, Zap, Database, ShieldCheck } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { seedGlobalMessagingBlueprint } from '@/lib/seed-messaging-blueprint';

export default function TemplatesClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    const [templateToDelete, setTemplateToDelete] = React.useState<MessageTemplate | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isSeeding, setIsSeeding] = React.useState(false);

    // Data Subscriptions - Filtered for GLOBAL scope
    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'message_templates'), 
            where('scope', '==', 'global'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore]);

    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc'));
    }, [firestore]);

    const stylesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'message_styles'), 
            where('workspaceIds', 'array-contains', ''), // Empty array-contains or similar for global? 
            // Better: use scope: 'global' if we add it, or just fetch all global ones
            orderBy('name', 'asc')
        );
    }, [firestore]);

    const { data: templates, isLoading: isLoadingTemplates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: firestoreVariables } = useCollection<VariableDefinition>(varsQuery);
    const { data: styles } = useCollection<MessageStyle>(stylesQuery);

    const variables = React.useMemo(() => {
        const contactVarDefs = generateContactVariableDefinitions('institution');
        const firestoreVars = firestoreVariables || [];
        const existingKeys = new Set(contactVarDefs.map(v => v.key));
        const deduped = firestoreVars.filter(v => !existingKeys.has(v.key));
        return [...contactVarDefs, ...deduped];
    }, [firestoreVariables]);

    const handleEdit = (tmpl: MessageTemplate) => {
        setEditingTemplate(tmpl);
        setIsAdding(true);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingTemplate(null);
    };

    const handleSave = async (data: any) => {
        if (!firestore || !user) return;
        
        const templateData = {
            ...data,
            scope: 'global',
            workspaceIds: [], // Global templates have no specific workspaceIds
            status: data.status || 'active',
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
            toast({ title: 'Global Template Saved' });
            setIsAdding(false);
            setEditingTemplate(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
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

    const handleSyncBlueprint = async () => {
        setIsSeeding(true);
        try {
            const result = await seedGlobalMessagingBlueprint();
            if (result.success) {
                toast({ title: 'Sync Successful', description: `Restored ${result.templates} system blueprints.` });
            } else {
                throw new Error(result.error);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Sync Failed', description: e.message });
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
                {isAdding ? (
                    <TemplateWorkshop 
                        key="workshop"
                        initialTemplate={editingTemplate}
                        variables={variables || []}
                        styles={styles || []}
                        entities={[]}
                        meetings={[]}
                        surveys={[]}
                        pdfs={[]}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        isSaving={false}
                    />
                ) : (
                    <div className="flex-1 overflow-y-auto text-left space-y-8">
                        {/* Header */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="space-y-1">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1">Superadmin Hub</Badge>
                                <h1 className="text-3xl font-bold tracking-tight">Global Message Blueprints</h1>
                                <p className="text-muted-foreground text-sm">Manage the system-wide default templates used by all organizations.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="outline"
                                    onClick={handleSyncBlueprint} 
                                    disabled={isSeeding}
                                    className="rounded-xl font-bold h-11 px-6 shadow-sm gap-2 border-primary/20 hover:bg-primary/5"
                                >
                                    {isSeeding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Database className="h-5 w-5" />}
                                    Sync Blueprint Registry
                                </Button>
                                <Button 
                                    onClick={() => { setEditingTemplate(null); setIsAdding(true); }} 
                                    className="rounded-xl font-bold h-11 px-6 shadow-lg gap-2"
                                >
                                    <Plus className="h-5 w-5" /> Create Global Template
                                </Button>
                            </div>
                        </div>

                        {/* Info Banner */}
                        <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                            <Zap className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="text-sm font-bold text-amber-900">Blueprint Management</h4>
                                <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">
                                    Changes made here will affect the "Default" options for all workspaces. Organizations can still create their own overrides which will take precedence over these global blueprints.
                                </p>
                            </div>
                        </div>

                        <TemplateGallery 
                            templates={templates || []}
                            isLoading={isLoadingTemplates}
                            cloningId={null}
                            onEdit={handleEdit}
                            onClone={() => {}}
                            onDelete={setTemplateToDelete as any}
                            onPreview={handleEdit}
                        />
                    </div>
                )}
            </AnimatePresence>

            <AlertDialog open={!!templateToDelete} onOpenChange={(o) => !o && setTemplateToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-semibold text-xl tracking-tight text-destructive flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Delete Global Blueprint?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">
                            This will permanently remove <span className="font-bold text-foreground">"{templateToDelete?.name}"</span> from the global registry. All workspaces currently using this blueprint will lose access to it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            disabled={isDeleting}
                            className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Permanently Delete Blueprint
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
