'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm, TemplateStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { TemplateGallery } from '../../../messaging/templates/components/template-gallery';
import { TemplateWorkshop } from '../../../messaging/templates/components/template-workshop';
import { TemplatePreviewModal } from '../../../messaging/templates/components/template-preview-modal';
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
import { useTerminology } from '@/hooks/use-terminology';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageContainerFluid } from '@/components/ui/page-container';

export default function TemplatesClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const { singular } = useTerminology();
    const searchParams = useSearchParams();
    const router = useRouter();
    
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    const [templateToDelete, setTemplateToDelete] = React.useState<MessageTemplate | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isSeeding, setIsSeeding] = React.useState(false);
    const [previewTemplate, setPreviewTemplate] = React.useState<MessageTemplate | null>(null);

    const editId = searchParams.get('edit');

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

    React.useEffect(() => {
        if (editId && templates) {
            const tmpl = templates.find(t => t.id === editId);
            if (tmpl) {
                setEditingTemplate(tmpl);
                setIsAdding(true);
                // Clear the edit param so it doesn't reopen if cancelled
                const params = new URLSearchParams(window.location.search);
                params.delete('edit');
                router.replace(`${window.location.pathname}?${params.toString()}`);
            }
        }
    }, [editId, templates, router]);

    const variables = React.useMemo(() => {
        const contactVarDefs = generateContactVariableDefinitions('institution');
        const firestoreVars = firestoreVariables || [];
        const existingKeys = new Set(contactVarDefs.map(v => v.key));
        const deduped = firestoreVars.filter(v => !existingKeys.has(v.key) && !v.key.startsWith('school_'));

        // Dynamic terminology variables
        const terminologyVars: VariableDefinition[] = [
            {
                id: 'branding_entity_name',
                key: 'entity_name',
                label: `${singular || 'Campus'} Name`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'name',
                type: 'string',
            },
            {
                id: 'branding_entity_email',
                key: 'entity_email',
                label: `${singular || 'Campus'} Email`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'email',
                type: 'string',
            },
            {
                id: 'branding_entity_phone',
                key: 'entity_phone',
                label: `${singular || 'Campus'} Phone`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'phone',
                type: 'string',
            },
            {
                id: 'branding_entity_location',
                key: 'entity_location',
                label: `${singular || 'Campus'} Location`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'locationString',
                type: 'string',
            },
            {
                id: 'branding_entity_initials',
                key: 'entity_initials',
                label: `${singular || 'Campus'} Initials`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'initials',
                type: 'string',
            },
            {
                id: 'branding_entity_package',
                key: 'entity_package',
                label: `${singular || 'Campus'} Package`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'subscriptionPackageName',
                type: 'string',
            }
        ];

        return [...contactVarDefs, ...terminologyVars, ...deduped];
    }, [firestoreVariables, singular]);

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

    const handleUpdateStatus = async (tmpl: MessageTemplate, newStatus: TemplateStatus) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'message_templates', tmpl.id), {
                status: newStatus,
                isActive: newStatus !== 'archived',
                updatedAt: new Date().toISOString()
            });
            toast({ title: `Global Blueprint status updated to ${newStatus}` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to update status', description: e.message });
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
                    <div className="flex-1 overflow-y-auto text-left">
                        <PageContainerFluid>
                            <div className="space-y-8">
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
                            onPreview={setPreviewTemplate}
                            onUpdateStatus={handleUpdateStatus}
                        />
                            </div>
                        </PageContainerFluid>
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

            <TemplatePreviewModal 
                template={previewTemplate}
                isOpen={!!previewTemplate}
                onClose={() => setPreviewTemplate(null)}
                onEdit={handleEdit}
                styles={styles || []}
            />
        </div>
    );
}
