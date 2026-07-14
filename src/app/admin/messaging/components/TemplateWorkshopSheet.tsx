'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, addDoc, or } from 'firebase/firestore';
import type { MessageTemplate, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { invalidateAllTemplatesCache } from '@/app/admin/components/template-cache-manager';
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import { useTerminology } from '@/hooks/use-terminology';

const TemplateWorkshop = dynamic(
    () => import('../templates/components/template-workshop').then(m => m.TemplateWorkshop),
    {
        ssr: false,
        loading: () => (
            <div className="h-full w-full flex flex-col items-center justify-center bg-background gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-xs font-bold text-muted-foreground opacity-50 uppercase tracking-widest">Loading Template Engine...</p>
            </div>
        )
    }
);

interface TemplateWorkshopSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: (template: MessageTemplate) => void;
    templateId?: string; // If provided, fetches and edits this template
    cloneTemplateId?: string; // If provided, fetches and clones this template
    initialContext?: {
        category?: MessageTemplate['category'];
        channel?: MessageTemplate['channel'];
        recipientType?: MessageTemplate['recipientType'];
        templateType?: string;
    };
}

export function TemplateWorkshopSheet({
    open,
    onOpenChange,
    onCreated,
    templateId,
    cloneTemplateId,
    initialContext
}: TemplateWorkshopSheetProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId } = useWorkspace();
    const { activeOrganizationId } = useTenant();
    const { singular } = useTerminology();

    const [isSaving, setIsSaving] = React.useState(false);
    const [isLoadingTemplate, setIsLoadingTemplate] = React.useState(false);
    const [initialTemplate, setInitialTemplate] = React.useState<MessageTemplate | null>(null);
    const [mountKey, setMountKey] = React.useState(Date.now());
    const [variables, setVariables] = React.useState<VariableDefinition[]>([]);

    React.useEffect(() => {
        if (!activeWorkspaceId) return;

        let active = true;
        getVariablesAction({
            workspaceId: activeWorkspaceId,
            organizationId: activeOrganizationId,
            terminology: singular ? { singular, plural: `${singular}s` } : undefined
        }).then((res) => {
            if (!active) return;
            const mapped = res.map((v) => ({
                id: v.key,
                key: v.key,
                label: v.label,
                category: v.category,
                source: v.source,
                entity: 'Entity',
                path: v.path || '',
                type: v.dataType,
            }));
            setVariables(mapped);
        }).catch(console.error);

        return () => {
            active = false;
        };
    }, [activeWorkspaceId, activeOrganizationId, singular]);

    React.useEffect(() => {
        if (open) {
            setMountKey(Date.now());
            if (templateId && firestore) {
                const fetchTemplate = async () => {
                    setIsLoadingTemplate(true);
                    try {
                        const { getDoc, doc } = await import('firebase/firestore');
                        const docSnap = await getDoc(doc(firestore, 'message_templates', templateId));
                        if (docSnap.exists()) {
                            setInitialTemplate({ id: docSnap.id, ...docSnap.data() } as MessageTemplate);
                        } else {
                            toast({ variant: 'destructive', title: 'Error', description: 'Template not found.' });
                        }
                    } catch (e) {
                        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load template.' });
                    } finally {
                        setIsLoadingTemplate(false);
                    }
                };
                fetchTemplate();
            } else if (cloneTemplateId && firestore) {
                const fetchTemplateForClone = async () => {
                    setIsLoadingTemplate(true);
                    try {
                        const { getDoc, doc } = await import('firebase/firestore');
                        const docSnap = await getDoc(doc(firestore, 'message_templates', cloneTemplateId));
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            setInitialTemplate({
                                ...data,
                                id: '',
                                name: `${data.name || ''} - Copy`,
                                templateType: `custom_${data.category || 'general'}_${Date.now()}`,
                                createdAt: undefined,
                                updatedAt: undefined,
                            } as unknown as MessageTemplate);
                        } else {
                            toast({ variant: 'destructive', title: 'Error', description: 'Source template not found.' });
                        }
                    } catch (e) {
                        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load template to clone.' });
                    } finally {
                        setIsLoadingTemplate(false);
                    }
                };
                fetchTemplateForClone();
            } else {
                setInitialTemplate(null);
            }
        }
    }, [open, templateId, cloneTemplateId, firestore, toast]);

    // Data subscriptions — only active while dialog is mounted
    const varsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc')) : null, [firestore]);
    const stylesQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrganizationId || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_styles'),
            or(
                where('scope', '==', 'global'),
                where('organizationId', '==', activeOrganizationId),
                where('workspaceIds', 'array-contains', activeWorkspaceId)
            )
        );
    }, [firestore, activeOrganizationId, activeWorkspaceId]);
    const meetingsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'meetings'), orderBy('meetingTime', 'desc')) : null, [firestore]);
    const surveysQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'surveys'), where('status', '==', 'published')) : null, [firestore]);
    const pdfsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'pdfs'), where('status', '==', 'published')) : null, [firestore]);

    const { data: firestoreVariables } = useCollection<VariableDefinition>(varsQuery);
    const { data: styles } = useCollection<MessageStyle>(stylesQuery);
    const { data: meetings } = useCollection<Meeting>(meetingsQuery);
    const { data: surveys } = useCollection<Survey>(surveysQuery);
    const { data: pdfs } = useCollection<PDFForm>(pdfsQuery);

    const handleSave = async (data: any) => {
        if (!firestore) return;
        setIsSaving(true);

        const contentForExtraction = `${data.subject || ''} ${data.body} ${JSON.stringify(data.blocks || [])}`;
        const varMatches = contentForExtraction.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches
            ? [...new Set(varMatches.map((m: string) => m.replace(/\{\{|\}\}/g, '').trim()))]
            : [];

        const workspaceIds =
            data.workspaceIds && data.workspaceIds.length > 0 ? data.workspaceIds : [activeWorkspaceId];

        const templateData = {
            ...data,
            workspaceIds,
            organizationId: activeOrganizationId,
            scope: data.scope || 'organization',
            variables: variableList,
            status: data.status || 'active',
            isActive: (data.status || 'active') !== 'archived',
            target: data.target || 'external_client',
            contentMode: data.contentMode || (data.channel === 'sms' ? 'plain_text' : 'rich_builder'),
            templateType: data.templateType || `custom_${data.category || 'general'}_${Date.now()}`,
            updatedAt: new Date().toISOString(),
        };

        const sanitizedData = JSON.parse(JSON.stringify(templateData));

        try {
            if (templateId) {
                const { updateDoc, doc } = await import('firebase/firestore');
                await updateDoc(doc(firestore, 'message_templates', templateId), sanitizedData);
                invalidateAllTemplatesCache();
                toast({ title: 'Template Updated Successfully' });
                if (onCreated) onCreated({ id: templateId, ...sanitizedData });
            } else {
                const docRef = await addDoc(collection(firestore, 'message_templates'), {
                    ...sanitizedData,
                    createdAt: new Date().toISOString(),
                });
                invalidateAllTemplatesCache();
                toast({ title: 'Template Saved Successfully' });
                if (onCreated) onCreated({ id: docRef.id, ...sanitizedData });
            }
            onOpenChange(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/*
             * Full-viewport modal — no padding, no rounding, no default close button.
             * The TemplateWorkshop renders its own Cancel/Save controls.
             * [&>button]:hidden suppresses the Radix default close × button.
             */}
            <DialogContent className="max-w-none w-screen h-screen p-0 border-none rounded-none shadow-2xl z-[100] flex flex-col [&>button]:hidden">
                <div className="sr-only">
                    <DialogTitle>{templateId ? 'Edit Template' : 'Create New Template'}</DialogTitle>
                    <DialogDescription>
                        {templateId
                            ? 'Edit an existing messaging template.'
                            : 'Create a new messaging template for your automation.'}
                    </DialogDescription>
                </div>

                {open && isLoadingTemplate ? (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-xs font-bold text-muted-foreground opacity-50 uppercase tracking-widest">
                            Loading Template...
                        </p>
                    </div>
                ) : open && (
                    <TemplateWorkshop
                        key={mountKey}
                        initialTemplate={initialTemplate}
                        variables={variables || []}
                        styles={styles || []}
                        meetings={meetings || []}
                        surveys={surveys || []}
                        pdfs={pdfs || []}
                        onSave={handleSave}
                        onCancel={() => onOpenChange(false)}
                        isSaving={isSaving}
                        initialContext={initialContext}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
