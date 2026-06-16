'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm, AppField } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { TemplateGallery } from './components/template-gallery';
import { TemplateWorkshop } from './components/template-workshop';
import { TemplatePreviewModal } from './components/template-preview-modal';
// import { cloneTemplate } from '@/lib/template-actions'; // TODO: Implement cloneTemplate function
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
import { Loader2, Trash2, Plus, Sparkles, Wand2, X, Zap } from 'lucide-react';
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
import dynamic from 'next/dynamic';

// Heavy, WhatsApp-only management UI — lazy-loaded so it stays out of the main
// templates bundle (vercel:bundle-dynamic-imports).
const WhatsAppTemplatePanel = dynamic(
  () => import('./components/WhatsAppTemplatePanel'),
  { ssr: false },
);

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
    
    // Live AI preferences & ULL tracking state
    const { provider: liveProvider, modelId: liveModelId } = useLiveAiModel();
    const [currentSignalId, setCurrentSignalId] = React.useState<string | null>(null);

    // Global Navigation State
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    const [cloningId, setCloningId] = React.useState<string | null>(null);
    const [templateToDelete, setTemplateToDelete] = React.useState<MessageTemplate | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [previewTemplate, setPreviewTemplate] = React.useState<MessageTemplate | null>(null);

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
                // Clear the edit param so it doesn't reopen if cancelled
                const params = new URLSearchParams(window.location.search);
                params.delete('edit');
                router.replace(`${window.location.pathname}?${params.toString()}`);
            }
        }
    }, [editId, allTemplates, router]);

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

    const variables = React.useMemo(() => {
        const contactVarDefs = generateContactVariableDefinitions('institution');
        const firestoreVars = firestoreVariables || [];
        // Deduplicate by key — dynamic defs take precedence for contact_* keys
        const existingKeys = new Set(contactVarDefs.map(v => v.key));
        const deduped = firestoreVars.filter(v => !existingKeys.has(v.key) && !v.key.startsWith('school_'));

        // Map workspace-specific active custom fields
        const customFieldVars = (appFields || []).map(f => {
            let category = 'custom';
            let source = 'custom_fields';
            let sourceName = 'Custom Fields';
            let path = `customData.${f.variableName}`;

            if (f.id.startsWith('survey_')) {
                category = 'surveys';
                source = 'surveys';
                sourceName = 'Surveys';
                path = f.variableName; // Survey responses are resolved directly
            } else if (f.id.startsWith('pdf_')) {
                category = 'forms';
                source = 'forms';
                sourceName = 'Forms';
                path = f.variableName; // PDF fields are resolved directly
            }

            return {
                id: f.id,
                key: f.variableName,
                label: f.label,
                category,
                source,
                sourceName,
                entity: 'Entity',
                path,
                type: f.type,
            };
        }).filter(f => !f.key.startsWith('school_'));

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

        return [...contactVarDefs, ...terminologyVars, ...deduped, ...customFieldVars];
    }, [firestoreVariables, appFields, singular]);

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
                availableVariables: availableKeys,
                organizationId: activeOrganizationId,
                provider: liveProvider,
                modelId: liveModelId,
            });

            // ULL Signal Registration
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

            const draftTemplate: any = {
                name: result.name,
                subject: result.subject || '',
                body: result.body,
                blocks: result.blocks || [],
                channel: 'email',
                category: 'general',
                target: 'external_client',
                contentMode: 'rich_builder',
                status: 'active',
                scope: 'organization',
                workspaceIds: [activeWorkspaceId],
                templateType: `ai_draft_${Date.now()}`,
                recipientType: 'participant',
            };

            setEditingTemplate(draftTemplate);
            setIsAdding(true);
            setIsAiModalOpen(false);
            setAiPrompt('');
            toast({ title: 'Template Draft Created', description: result.explanation });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message });
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
            organizationId: activeOrganizationId,
            scope: data.scope || 'organization',
            variables: variableList,
            status: data.status || 'active',
            isActive: (data.status || 'active') !== 'archived', // backward compat
            target: data.target || 'external_client',
            contentMode: data.contentMode || (data.channel === 'sms' ? 'plain_text' : 'rich_builder'),
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

    const handleUpdateStatus = async (tmpl: MessageTemplate, status: any) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'message_templates', tmpl.id), {
                status,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Template Status Updated', description: `Set to ${status}` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
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
                                    <RainbowButton 
                                        onClick={() => setIsAiModalOpen(true)} 
                                    >
                                        <Sparkles className="h-4 w-4" /> AI Template Generator
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
                                styles={styles || []}
                                isLoading={isLoadingTemplates}
                                cloningId={cloningId}
                                onEdit={handleEdit}
                                onClone={handleClone}
                                onDelete={setTemplateToDelete}
                                onPreview={setPreviewTemplate}
                                onUpdateStatus={handleUpdateStatus}
                            />

                            {activeOrganizationId && (
                                <WhatsAppTemplatePanel organizationId={activeOrganizationId} />
                            )}
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
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Describe Your Message</Label>
                            <Textarea 
                                value={aiPrompt} 
                                onChange={e => setAiPrompt(e.target.value)} 
                                placeholder="e.g. Create a formal email inviting parents to a meeting. Mention that we'll discuss the new security module."
 className="min-h-[180px] rounded-[2rem] bg-muted/20 border-none shadow-inner p-6 leading-relaxed text-lg"
                                autoFocus
                            />
                        </div>
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
                template={previewTemplate}
                isOpen={!!previewTemplate}
                onClose={() => setPreviewTemplate(null)}
                onEdit={handleEdit}
                styles={styles || []}
            />
        </div>
    );
}
