'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where, or } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser, useAuth } from '@/firebase';
import type { MessageTemplate, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm, AppField, TemplateStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { TemplateGallery } from './components/template-gallery';
import { TemplateWorkshop } from './components/template-workshop';
import { TemplatePreviewModal } from './components/template-preview-modal';
// import { cloneTemplate } from '@/lib/template-actions'; // TODO: Implement cloneTemplate function
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import type { UnifiedVariable } from '@/lib/types/variables';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, Plus, Sparkles, Wand2, X, Zap, ChevronDown, RefreshCw, Mail, Smartphone, MessageCircle, ArrowUpToLine } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { AnimatePresence, motion } from 'framer-motion';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { generateEmailTemplate } from '@/ai/flows/generate-email-template-flow';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTerminology } from '@/hooks/use-terminology';
import { PageContainer } from '@/components/ui/page-container';
import { invalidateAllTemplatesCache } from '@/app/admin/components/template-cache-manager';
import { useLiveAiModel } from '@/hooks/use-live-ai-model';
import { createLearningSignalAction, finalizeLearningSignalAction } from '@/lib/learning-loop-actions';
import { AiAssistantModalHeader } from '@/components/ai/AiAssistantModalHeader';
import { WhatsAppPreviewModal } from './components/template-preview-modal';
import { useWhatsAppTemplates } from './hooks/use-whatsapp-templates';
import {
    mapWhatsAppToGallery,
    partitionAdopted,
    mergeGalleryTemplates,
    isWhatsAppDisplay,
    toWhatsAppTemplateName,
    type GalleryTemplate,
    type WhatsAppDisplayTemplate,
} from './lib/unified-template';
import type { TemplateDraft } from './components/whatsapp/shared';
import type { WhatsAppTemplate } from '@/lib/whatsapp/whatsapp-types';
import { bulkPushWhatsAppSkeletonsAction } from '@/app/actions/bulk-push-whatsapp-skeletons-action';
import dynamic from 'next/dynamic';

// WhatsApp authoring dialogs — lazy + conditional: only loaded when opened, so the
// Meta builder stays out of the main templates bundle (vercel:bundle-conditional).
const WhatsAppCreateDialog = dynamic(() => import('./components/whatsapp/WhatsAppCreateDialog'), { ssr: false });
const WhatsAppSendTestDialog = dynamic(() => import('./components/whatsapp/WhatsAppSendTestDialog'), { ssr: false });
const WhatsAppAdoptDialog = dynamic(() => import('./components/whatsapp/WhatsAppAdoptDialog'), { ssr: false });

/** Channel chosen from the "New Template" menu (drives the workshop seed). */
type NewTemplateChannel = 'email' | 'sms' | 'whatsapp';
/** Which WhatsApp dialog (if any) is currently open. */
type ActiveWhatsAppDialog =
    | { kind: 'create'; draft?: TemplateDraft }
    | { kind: 'sendTest'; template: WhatsAppTemplate }
    | { kind: 'adopt'; template: WhatsAppTemplate }
    | null;
/** AI channel selector value. */
type AiChannel = 'email' | 'sms' | 'whatsapp';

/**
 * @fileOverview Messaging Templates Management Page.
 * Features an AI Architect for generative drafting and a Manual Workshop for precision design.
 * Upgraded with Multi-Workspace Sharing logic.
 */

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const { singular } = useTerminology();
    const { activeWorkspaceId } = useWorkspace();
    const { activeOrganizationId } = useTenant();
    const searchParams = useSearchParams();
    const router = useRouter();
    const auth = useAuth();
    const [isBulkPushing, setIsBulkPushing] = React.useState(false);
    
    // Live AI preferences & ULL tracking state
    const { provider: liveProvider, modelId: liveModelId } = useLiveAiModel();
    const [currentSignalId, setCurrentSignalId] = React.useState<string | null>(null);

    // Global Navigation State
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    const [newTemplateContext, setNewTemplateContext] = React.useState<{ channel: NewTemplateChannel } | undefined>(undefined);
    const [cloningId, setCloningId] = React.useState<string | null>(null);
    const [templateToDelete, setTemplateToDelete] = React.useState<MessageTemplate | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [previewTemplate, setPreviewTemplate] = React.useState<GalleryTemplate | null>(null);

    // WhatsApp (Meta-mirror) templates + dialog orchestration.
    const whatsapp = useWhatsAppTemplates(activeOrganizationId);
    const [activeWaDialog, setActiveWaDialog] = React.useState<ActiveWhatsAppDialog>(null);
    const [aiChannel, setAiChannel] = React.useState<AiChannel>('email');

    // Data Subscriptions - GLOBAL + WORKSPACE
    const workspaceTemplatesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_templates'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId)
        );
    }, [firestore, activeWorkspaceId]);

    const globalTemplatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'message_templates'),
            where('scope', '==', 'global')
        );
    }, [firestore]);

    const { data: workspaceTemplates, isLoading: isLoadingW } = useCollection<MessageTemplate>(workspaceTemplatesQuery);
    const { data: globalTemplates, isLoading: isLoadingG } = useCollection<MessageTemplate>(globalTemplatesQuery);
    
    const isLoadingTemplates = isLoadingW || isLoadingG;

    const allTemplates = React.useMemo(() => {
        if (!workspaceTemplates && !globalTemplates) return null;
        const wList = workspaceTemplates || [];
        const gList = globalTemplates || [];
        const seen = new Set<string>();
        const combined: MessageTemplate[] = [];
        for (const t of [...wList, ...gList]) {
            if (!seen.has(t.id)) {
                seen.add(t.id);
                combined.push(t);
            }
        }
        // Sort by createdAt descending client-side to avoid requiring a composite index
        return combined.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }, [workspaceTemplates, globalTemplates]);

    const editId = searchParams.get('edit');

    React.useEffect(() => {
        if (editId && allTemplates) {
            const tmpl = allTemplates.find(t => t.id === editId);
            if (tmpl) {
                setEditingTemplate(tmpl);
                setIsAdding(true);
                // Clear the edit param and set mode=edit
                const params = new URLSearchParams(window.location.search);
                params.delete('edit');
                params.set('mode', 'edit');
                router.replace(`${window.location.pathname}?${params.toString()}`);
            }
        }
    }, [editId, allTemplates, router]);

    const mode = searchParams.get('mode');
    React.useEffect(() => {
        if (!mode) {
            setIsAdding(false);
            setEditingTemplate(null);
            setNewTemplateContext(undefined);
        }
    }, [mode]);

    // AI Architect State
    const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);

    // Filter and Deduplicate (Org > Global)
    const templates = React.useMemo(() => {
        if (!allTemplates) return [];
        
        // Templates belonging to this workspace
        const workspaceTemplatesList = allTemplates.filter(t => t.workspaceIds?.includes(activeWorkspaceId));
        
        // Global templates
        const globalTemplatesList = allTemplates.filter(t => t.scope === 'global');

        // Logic: For each unique 'templateType', if a workspace version exists, hide the global one.
        const workspaceTypes = new Set(workspaceTemplatesList.map(t => t.templateType).filter(Boolean));
        const filteredGlobal = globalTemplatesList.filter(t => !t.templateType || !workspaceTypes.has(t.templateType));

        return [...workspaceTemplatesList, ...filteredGlobal];
    }, [allTemplates, activeWorkspaceId]);

    const unpushedSkeletons = React.useMemo(() => {
        return templates.filter(t => t.channel === 'whatsapp' && !t.whatsappTemplateName);
    }, [templates]);

    // Merge Firestore (email/SMS + orphan WhatsApp) with Meta-mirror WhatsApp
    // templates into one gallery list. Adopted WhatsApp docs are hidden in favor
    // of their canonical Meta card, but their names mark cards as "Enabled".
    const galleryTemplates = React.useMemo<GalleryTemplate[]>(() => {
        const { adoptedNames, visible } = partitionAdopted(templates);
        const whatsappDisplays = whatsapp.templates.map((t) => mapWhatsAppToGallery(t, adoptedNames));
        return mergeGalleryTemplates(visible, whatsappDisplays);
    }, [templates, whatsapp.templates]);

    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc'));
    }, [firestore]);

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



    const meetingsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'meetings'),
            where('workspaceIds', 'array-contains', activeWorkspaceId)
        );
    }, [firestore, activeWorkspaceId]);

    const surveysQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'surveys'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            where('status', '==', 'published')
        );
    }, [firestore, activeWorkspaceId]);

    const pdfsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'pdfs'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            where('status', '==', 'published')
        );
    }, [firestore, activeWorkspaceId]);

    const appFieldsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'app_fields'),
            where('workspaceId', '==', activeWorkspaceId),
            where('status', '==', 'active')
        );
    }, [firestore, activeWorkspaceId]);

    const { data: firestoreVariables } = useCollection<VariableDefinition>(varsQuery);
    const { data: styles } = useCollection<MessageStyle>(stylesQuery);
    const { data: meetings } = useCollection<Meeting>(meetingsQuery);
    const { data: surveys } = useCollection<Survey>(surveysQuery);
    const { data: pdfs } = useCollection<PDFForm>(pdfsQuery);
    const { data: appFields } = useCollection<AppField>(appFieldsQuery);

    const sortedMeetings = React.useMemo(() => {
        return (meetings || []).toSorted((a, b) => (b.meetingTime || '').localeCompare(a.meetingTime || ''));
    }, [meetings]);

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
    }, [activeWorkspaceId, activeOrganizationId, firestoreVariables, appFields, singular]);

    const handleEdit = (tmpl: MessageTemplate) => {
        setEditingTemplate(tmpl);
        setIsAdding(true);
        const params = new URLSearchParams(window.location.search);
        params.set('mode', 'edit');
        router.replace(`${window.location.pathname}?${params.toString()}`);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingTemplate(null);
        setNewTemplateContext(undefined);
        const params = new URLSearchParams(window.location.search);
        params.delete('mode');
        router.replace(`${window.location.pathname}?${params.toString()}`);
    };

    /** Open the manual workshop seeded for a specific channel. */
    const openWorkshop = (channel: NewTemplateChannel) => {
        setEditingTemplate(null);
        setNewTemplateContext({ channel });
        setIsAdding(true);
        const params = new URLSearchParams(window.location.search);
        params.set('mode', 'new');
        router.replace(`${window.location.pathname}?${params.toString()}`);
    };

    const handleAiArchitect = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiProcessing(true);
        try {
            const availableKeys = (variables || []).map(v => v.key);

            const result = await generateEmailTemplate({
                prompt: aiPrompt,
                channel: aiChannel,
                availableVariables: availableKeys,
                organizationId: activeOrganizationId,
                provider: liveProvider,
                modelId: liveModelId,
            });

            // ULL Signal Registration (all channels)
            const signalResult = await createLearningSignalAction({
                prompt: aiPrompt,
                initialState: result,
                artifactType: 'template',
                organizationId: activeOrganizationId || 'default',
                workspaceId: activeWorkspaceId || '',
                userId: user?.uid || '',
                modelId: liveModelId,
                provider: liveProvider,
            });

            if (signalResult.success && signalResult.id) {
                setCurrentSignalId(signalResult.id);
            }

            setIsAiModalOpen(false);
            setAiPrompt('');

            if (aiChannel === 'whatsapp') {
                // WhatsApp can't be created instantly — pre-fill the Meta builder so the
                // user reviews and submits for approval (honors Meta's approval flow).
                const draft: TemplateDraft = {
                    name: toWhatsAppTemplateName(result.name) || undefined,
                    category: result.whatsappCategory ?? 'UTILITY',
                    bodyText: result.body,
                    bodyExamples: result.bodyParams ?? [],
                    footerText: result.footer,
                    headerText: result.header,
                };
                setActiveWaDialog({ kind: 'create', draft });
                toast({ title: 'Draft ready', description: 'Review and submit to Meta for approval.' });
                return;
            }

            const draftTemplate: MessageTemplate = {
                id: '',
                name: result.name,
                subject: result.subject || '',
                body: result.body,
                blocks: result.blocks || [],
                channel: aiChannel,
                category: 'general',
                target: 'external_client',
                contentMode: aiChannel === 'sms' ? 'plain_text' : 'rich_builder',
                status: 'active',
                scope: 'organization',
                workspaceIds: [activeWorkspaceId],
                templateType: `ai_draft_${Date.now()}`,
                variableContext: 'common',
                declaredVariables: [],
                version: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            setEditingTemplate(draftTemplate);
            setNewTemplateContext(undefined);
            setIsAdding(true);
            const params = new URLSearchParams(window.location.search);
            params.set('mode', 'new');
            router.replace(`${window.location.pathname}?${params.toString()}`);
            toast({ title: 'Template Draft Created', description: result.explanation });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Generation Failed', description: e instanceof Error ? e.message : 'Unknown error' });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleSave = async (data: Partial<MessageTemplate>) => {
        if (!firestore || !user) return;

        const contentForExtraction = `${data.subject || ''} ${data.body || ''} ${JSON.stringify(data.blocks || [])}`;
        const varMatches = contentForExtraction.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        // Ensure workspaceIds exists
        const workspaceIds = data.workspaceIds && data.workspaceIds.length > 0 
            ? data.workspaceIds 
            : [activeWorkspaceId];

        const templateData = {
            ...data,
            workspaceIds,
            organizationId: activeOrganizationId,
            scope: data.scope || 'organization',
            variables: variableList,
            status: data.status || 'active',
            isActive: data.channel === 'whatsapp' ? false : ((data.status || 'active') !== 'archived'),
            target: data.target || 'external_client',
            contentMode: data.contentMode || (data.channel === 'sms' || data.channel === 'whatsapp' ? 'plain_text' : 'rich_builder'),
            templateType: data.templateType || `custom_${data.category || 'general'}_${Date.now()}`,
            updatedAt: new Date().toISOString(),
        };

        const sanitizedData = JSON.parse(JSON.stringify(templateData));

        try {
            if (editingTemplate?.id && editingTemplate.scope !== 'global') {
                await updateDoc(doc(firestore, 'message_templates', editingTemplate.id), sanitizedData);
            } else {
                // If it's a global template being edited or a new one, save it as a new organization template
                const { id: _, ...dataToSave } = sanitizedData;
                await addDoc(collection(firestore, 'message_templates'), { 
                    ...dataToSave, 
                    scope: 'organization',
                    createdAt: new Date().toISOString() 
                });
            }

            // ULL Signal Finalization
            if (currentSignalId) {
                await finalizeLearningSignalAction(currentSignalId, sanitizedData, []);
                setCurrentSignalId(null);
            }

            invalidateAllTemplatesCache();
            toast({ title: 'Template Saved' });
            setIsAdding(false);
            setEditingTemplate(null);
            const params = new URLSearchParams(window.location.search);
            params.delete('mode');
            router.replace(`${window.location.pathname}?${params.toString()}`);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        }
    };

    const handleClone = async (tmpl: MessageTemplate) => {
        if (!user || !firestore) return;
        setCloningId(tmpl.id);
        try {
            const { id: _, createdAt: __, updatedAt: ___, ...rest } = tmpl;
            
            const clonedData = {
                ...rest,
                name: `Copy of ${tmpl.name}`,
                status: 'draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                workspaceIds: [activeWorkspaceId],
                organizationId: activeOrganizationId,
                scope: 'organization'
            };

            const sanitizedData = JSON.parse(JSON.stringify(clonedData));
            await addDoc(collection(firestore, 'message_templates'), sanitizedData);
            invalidateAllTemplatesCache();
            
            toast({ title: 'Template Cloned Successfully', description: `Created "${clonedData.name}"` });
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
            invalidateAllTemplatesCache();
            toast({ title: 'Template Removed' });
            setTemplateToDelete(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleUpdateStatus = async (tmpl: MessageTemplate, status: TemplateStatus) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'message_templates', tmpl.id), {
                status,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Template Status Updated', description: `Set to ${status}` });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e instanceof Error ? e.message : 'Unknown error' });
        }
    };

    const handleWaSendTest = (t: WhatsAppDisplayTemplate) => setActiveWaDialog({ kind: 'sendTest', template: t.raw });
    const handleWaAdopt = (t: WhatsAppDisplayTemplate) => setActiveWaDialog({ kind: 'adopt', template: t.raw });

    const handlePushSkeleton = (template: MessageTemplate) => {
        const matches = (template.body || '').match(/\{\{([^{}]+?)\}\}/g);
        const vars = matches ? [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];
        
        let bodyText = template.body || '';
        const paramVars: Record<number, string> = {};
        vars.forEach((v, index) => {
            const escapedVar = v.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`\\{\\{\\s*${escapedVar}\\s*\\}\\}`, 'g');
            bodyText = bodyText.replace(regex, `{{${index + 1}}}`);
            paramVars[index] = v;
        });

        const draft: TemplateDraft = {
            name: toWhatsAppTemplateName(template.name) || undefined,
            category: 'UTILITY',
            bodyText,
            bodyExamples: Array(vars.length).fill(''),
            skeletonId: template.id,
            paramVars,
            appCategory: template.category === 'all' ? 'general' : template.category,
            templateType: template.templateType,
        };

        setActiveWaDialog({ kind: 'create', draft });
    };

    const handleBulkPushSkeletons = async () => {
        if (!activeOrganizationId) return;
        setIsBulkPushing(true);
        try {
            const skeletonIds = unpushedSkeletons.map(s => s.id);
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error('Not authenticated');
            const res = await bulkPushWhatsAppSkeletonsAction(idToken, activeOrganizationId, skeletonIds);
            if (!res.success) {
                throw new Error(res.error);
            }
            toast({
                title: 'Bulk Push Successful',
                description: `Successfully pushed ${res.count} skeleton templates to Meta.`,
            });
            // Trigger WhatsApp status sync
            await whatsapp.sync();
        } catch (e: unknown) {
            toast({
                variant: 'destructive',
                title: 'Bulk Push Failed',
                description: e instanceof Error ? e.message : 'An error occurred while pushing templates to Meta.',
            });
        } finally {
            setIsBulkPushing(false);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
                {isAdding ? (
                    <TemplateWorkshop
                        key="workshop"
                        initialTemplate={editingTemplate}
                        initialContext={newTemplateContext}
                        variables={variables || []}
                        styles={styles || []}
                        meetings={meetings || []}
                        surveys={surveys || []}
                        pdfs={pdfs || []}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        isSaving={false}
                    />
                ) : (
                    <div className="flex-1 overflow-y-auto text-left">
                        <PageContainer>
                            <div className="space-y-8">
                            {/* Dashboard Header */}
                            <div className="flex items-center justify-between flex-wrap gap-6">
                                <div className="space-y-1">
                                    <Badge variant="outline" className="bg-blue-500/5 text-blue-600 border-blue-500/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1">Communications Hub</Badge>
                                    <h1 className="text-3xl font-bold tracking-tight">Client Messaging Library</h1>
                                    <p className="text-muted-foreground text-sm max-w-lg">Manage your organization's messaging blueprints. These templates are automatically synced across all platform modules.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {activeOrganizationId ? (
                                        <Button
                                            onClick={whatsapp.sync}
                                            disabled={whatsapp.isSyncing}
                                            variant="outline"
                                            className="rounded-xl font-bold h-11 px-5 gap-2"
                                            title="Pull the latest WhatsApp template statuses from Meta"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${whatsapp.isSyncing ? 'animate-spin' : ''}`} /> Sync from Meta
                                        </Button>
                                    ) : null}
                                    {whatsapp.connected && activeOrganizationId && unpushedSkeletons.length > 0 ? (
                                        <Button
                                            onClick={handleBulkPushSkeletons}
                                            disabled={isBulkPushing}
                                            variant="outline"
                                            className="rounded-xl font-bold h-11 px-5 gap-2 border-emerald-500/20 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                            title="Push all offline drafted WhatsApp skeletons to Meta"
                                        >
                                            <ArrowUpToLine className={`h-4 w-4 ${isBulkPushing ? 'animate-pulse' : ''}`} /> Push All Skeletons ({unpushedSkeletons.length})
                                        </Button>
                                    ) : null}
                                    <RainbowButton
                                        onClick={() => setIsAiModalOpen(true)}
                                    >
                                        <Sparkles className="h-4 w-4" /> AI Template Generator
                                    </RainbowButton>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button className="rounded-xl font-bold h-11 px-6 shadow-lg gap-2">
                                                <Plus className="h-5 w-5" /> New Template <ChevronDown className="h-4 w-4 opacity-80" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl w-48">
                                            <DropdownMenuItem onClick={() => openWorkshop('sms')} className="font-semibold gap-2 cursor-pointer">
                                                <Smartphone className="h-4 w-4 text-orange-500" /> SMS Template
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openWorkshop('email')} className="font-semibold gap-2 cursor-pointer">
                                                <Mail className="h-4 w-4 text-blue-500" /> Email Template
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => openWorkshop('whatsapp')}
                                                disabled={!activeOrganizationId}
                                                className="font-semibold gap-2 cursor-pointer"
                                            >
                                                <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp Template
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {whatsapp.error && activeOrganizationId ? (
                                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <MessageCircle className="h-4 w-4 shrink-0" />
                                    WhatsApp templates couldn’t be loaded: {whatsapp.error}
                                </div>
                            ) : null}

                            <TemplateGallery
                                templates={galleryTemplates}
                                styles={styles || []}
                                isLoading={isLoadingTemplates || whatsapp.isLoading}
                                cloningId={cloningId}
                                onEdit={handleEdit}
                                onClone={handleClone}
                                onDelete={setTemplateToDelete}
                                onPreview={setPreviewTemplate}
                                onUpdateStatus={handleUpdateStatus}
                                onWhatsAppSendTest={handleWaSendTest}
                                onWhatsAppAdopt={handleWaAdopt}
                                onWhatsAppPushSkeleton={handlePushSkeleton}
                            />
                            </div>
                        </PageContainer>
                    </div>
                )}
            </AnimatePresence>

            <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
                <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-6 overflow-hidden border-none shadow-2xl bg-card">
                    <AiAssistantModalHeader 
                        title="AI Template Generator" 
                        description="Describe your message and the AI will draft a complete template with dynamic tags." 
                        onClose={() => setIsAiModalOpen(false)} 
                    />
                    <div className="space-y-6 mt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Channel</Label>
                            <div className="flex gap-2">
                                {([
                                    ['email', 'Email', Mail],
                                    ['sms', 'SMS', Smartphone],
                                    ['whatsapp', 'WhatsApp', MessageCircle],
                                ] as const).map(([val, label, Icon]) => (
                                    <Button
                                        key={val}
                                        type="button"
                                        variant={aiChannel === val ? 'default' : 'outline'}
                                        onClick={() => setAiChannel(val)}
                                        disabled={val === 'whatsapp' && !activeOrganizationId}
                                        className="rounded-xl font-bold gap-2 h-10"
                                    >
                                        <Icon className="h-4 w-4" /> {label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Describe Your Message</Label>
                            <Textarea
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                                placeholder="e.g. Create a formal email inviting parents to a meeting. Mention that we'll discuss the new security module."
 className="min-h-[180px] rounded-[2rem] bg-muted/20 border-none shadow-inner p-6 leading-relaxed text-lg"
                                autoFocus
                            />
                        </div>
                        {aiChannel === 'whatsapp' ? (
                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 leading-relaxed">
                                WhatsApp templates need Meta approval. The AI drafts the body and sample values, then opens the builder so you can review and submit for approval.
                            </div>
                        ) : null}
 <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-4">
 <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 tracking-tighter">Workspace Context</p>
 <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 leading-relaxed font-bold opacity-80">
                                    The AI will create a template for your workspace and automatically scan for relevant dynamic variables.
                                </p>
                            </div>
                        </div>
                    </div>
 <DialogFooter className="bg-muted/30 p-6 border-t flex justify-between items-center sm:justify-between">
 <Button variant="ghost" onClick={() => setIsAiModalOpen(false)} disabled={isAiProcessing} className="font-bold rounded-xl h-12 px-8">Discard</Button>
                        <RainbowButton 
                            onClick={handleAiArchitect} 
                            disabled={isAiProcessing || !aiPrompt.trim()}
 className="h-12 px-12 font-semibold shadow-2xl text-sm"
                        >
 {isAiProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            {isAiProcessing ? 'Generating…' : 'Generate Template'}
                        </RainbowButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!templateToDelete} onOpenChange={(o) => !o && setTemplateToDelete(null)}>
 <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
 <AlertDialogTitle className="font-semibold text-xl tracking-tight">Remove Template?</AlertDialogTitle>
 <AlertDialogDescription className="text-sm font-medium">
 Deleting <span className="font-bold text-foreground">"{templateToDelete?.name}"</span> will permanently remove it from your template library.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
 <AlertDialogFooter className="mt-4">
 <AlertDialogCancel className="rounded-xl font-bold">Keep Template</AlertDialogCancel>
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

            <TemplatePreviewModal
                template={previewTemplate && !isWhatsAppDisplay(previewTemplate) ? previewTemplate : null}
                isOpen={!!previewTemplate && !isWhatsAppDisplay(previewTemplate)}
                onClose={() => setPreviewTemplate(null)}
                onEdit={handleEdit}
                styles={styles || []}
            />

            <WhatsAppPreviewModal
                template={previewTemplate && isWhatsAppDisplay(previewTemplate) ? previewTemplate : null}
                isOpen={!!previewTemplate && isWhatsAppDisplay(previewTemplate)}
                onClose={() => setPreviewTemplate(null)}
            />

            {activeWaDialog?.kind === 'create' && activeOrganizationId ? (
                <WhatsAppCreateDialog
                    organizationId={activeOrganizationId}
                    initialDraft={activeWaDialog.draft}
                    variables={variables}
                    onClose={() => setActiveWaDialog(null)}
                    onCreated={() => {
                        setActiveWaDialog(null);
                        whatsapp.refetch();
                        toast({ title: 'Submitted to Meta', description: 'Template sent for approval. It can send once APPROVED.' });
                    }}
                />
            ) : null}

            {activeWaDialog?.kind === 'sendTest' && activeOrganizationId ? (
                <WhatsAppSendTestDialog
                    template={activeWaDialog.template}
                    organizationId={activeOrganizationId}
                    onClose={() => setActiveWaDialog(null)}
                    onSent={(wamid) => {
                        setActiveWaDialog(null);
                        toast({ title: 'Test sent', description: wamid ? `Message queued (${wamid}).` : 'Message queued.' });
                    }}
                />
            ) : null}

            {activeWaDialog?.kind === 'adopt' && activeOrganizationId ? (
                <WhatsAppAdoptDialog
                    template={activeWaDialog.template}
                    organizationId={activeOrganizationId}
                    onClose={() => setActiveWaDialog(null)}
                    onAdopted={() => {
                        setActiveWaDialog(null);
                        invalidateAllTemplatesCache();
                        whatsapp.refetch();
                        toast({ title: 'Enabled', description: 'Template is now selectable on the WhatsApp channel.' });
                    }}
                />
            ) : null}
        </div>
    );
}
